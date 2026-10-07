// Servidor HTTP local para ProRider Ginásio
// Serve os ficheiros estáticos na porta 3000
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

function getLocalIP() {
  var ifaces = os.networkInterfaces();
  var result = 'localhost';
  Object.keys(ifaces).forEach(function(name) {
    ifaces[name].forEach(function(iface) {
      if (iface.family === 'IPv4' && !iface.internal) result = iface.address;
    });
  });
  return result;
}

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.mp3':  'audio/mpeg',
  '.webm': 'video/webm',
  '.m4a':  'audio/mp4',
  '.mov':  'video/quicktime',
  '.m4v':  'video/mp4',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ── Procura do pendrive ────────────────────────────────────────────
var PASTA_RAIZ = 'ProRider';
var EXT_VIDEO  = ['.mp4', '.webm', '.mkv', '.mov', '.m4v'];
var EXT_AUDIO  = ['.mp3', '.m4a', '.aac', '.wav', '.ogg'];
var _pendriveRaiz = '';           // guardado para validar os pedidos de /midia

function listarUnidades() {
  var out = [];
  if (process.platform === 'win32') {
    for (var i = 67; i <= 90; i++) out.push(String.fromCharCode(i) + ':\\');  // C: ate Z:
  } else {
    ['/media', '/mnt', '/Volumes'].forEach(function(base) {
      try { fs.readdirSync(base).forEach(function(n){ out.push(path.join(base, n)); }); } catch(e) {}
    });
  }
  return out;
}

function juntarArquivos(dir, exts, saida, prof) {
  if ((prof||0) > 2) return;
  var itens = [];
  try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return; }
  itens.forEach(function(it) {
    var cheio = path.join(dir, it.name);
    if (it.isDirectory()) { juntarArquivos(cheio, exts, saida, (prof||0)+1); return; }
    var ext = path.extname(it.name).toLowerCase();
    if (exts.indexOf(ext) >= 0) {
      saida.push({ nome: it.name, caminho: cheio, url: '/midia?p=' + encodeURIComponent(cheio) });
    }
  });
}

function acharPendrive() {
  var unidades = listarUnidades();
  for (var i = 0; i < unidades.length; i++) {
    var raiz = path.join(unidades[i], PASTA_RAIZ);
    var ok = false;
    try { ok = fs.statSync(raiz).isDirectory(); } catch(e) { ok = false; }
    if (!ok) continue;

    var videos = [], musicas = [], aulas = [];
    juntarArquivos(raiz, EXT_VIDEO, videos, 0);
    juntarArquivos(raiz, EXT_AUDIO, musicas, 0);
    try {
      fs.readdirSync(raiz).forEach(function(n) {
        if (/\.prorider$/i.test(n) || /\.json$/i.test(n)) {
          aulas.push({ nome: n, caminho: path.join(raiz, n), url: '/midia?p=' + encodeURIComponent(path.join(raiz, n)) });
        }
      });
    } catch(e) {}

    // So aceita se houver de facto conteudo — evita pegar um C:\ProRider vazio
    if (videos.length || musicas.length || aulas.length) {
      _pendriveRaiz = raiz;
      console.log('  Pendrive encontrado: ' + raiz + '  (' + videos.length + ' video(s), '
                  + musicas.length + ' musica(s), ' + aulas.length + ' aula(s))');
      return { ok: true, raiz: raiz, videos: videos, musicas: musicas, aulas: aulas };
    }
  }
  return { ok: false, raiz: '', videos: [], musicas: [], aulas: [] };
}

function dentroDoPendrive(p) {
  if (!_pendriveRaiz) acharPendrive();
  if (!_pendriveRaiz) return false;
  try {
    var norm = path.resolve(p);
    return norm.toLowerCase().indexOf(path.resolve(_pendriveRaiz).toLowerCase()) === 0;
  } catch(e) { return false; }
}

// Entrega o arquivo aceitando pedidos por trecho (Range). Sem isto o navegador
// nao consegue posicionar o video, e era um dos motivos do
// ERR_REQUEST_RANGE_NOT_SATISFIABLE.
function servirComRange(req, res, arquivo) {
  var st;
  try { st = fs.statSync(arquivo); } catch(e) { res.writeHead(404); res.end('nao encontrado'); return; }
  var tipo = MIME[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
  var faixa = req.headers.range;

  if (!faixa) {
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(arquivo).pipe(res);
    return;
  }
  var m = /bytes=(\d*)-(\d*)/.exec(faixa);
  var ini = m && m[1] ? parseInt(m[1], 10) : 0;
  var fim = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
  if (isNaN(ini) || ini >= st.size) {
    res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); res.end(); return;
  }
  if (fim >= st.size) fim = st.size - 1;
  res.writeHead(206, {
    'Content-Type': tipo,
    'Content-Range': 'bytes ' + ini + '-' + fim + '/' + st.size,
    'Accept-Ranges': 'bytes',
    'Content-Length': (fim - ini + 1),
  });
  fs.createReadStream(arquivo, { start: ini, end: fim }).pipe(res);
}

// ── 02/10b: GRAVAR A AULA E TRANSMITIR NO YOUTUBE ─────────────────
// A TV grava a câmera com a faixa da aula (MediaRecorder) e manda os pedaços
// para cá. Gravação: arquivo .webm na pasta ProRider\Gravacoes (C:\ no
// Windows, pasta do usuário nos outros). YouTube: os mesmos pedaços entram no
// ffmpeg, que manda para o RTMP do YouTube com a chave da academia.
// Só aceita pedidos do próprio computador (não da rede).
var cp = require('child_process');
var PASTA_GRAV = process.platform === 'win32' ? 'C:\\ProRider\\Gravacoes' : path.join(os.homedir(), 'ProRider', 'Gravacoes');
var _grav = {}, _yt = {};
function soLocal(req) { var a = String(req.socket.remoteAddress || ''); return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'; }
function jsonResp(res, st, obj) { res.writeHead(st, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(obj)); }
function lerCorpo(req, cb) { var partes = []; req.on('data', function(c){ partes.push(c); }); req.on('end', function(){ cb(Buffer.concat(partes)); }); }
function nomeSeguro(t) { return String(t || 'aula').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'aula'; }
function acharFfmpeg() {
  var cands = [path.join(__dirname, 'ffmpeg.exe'), path.join(__dirname, 'ffmpeg'), 'C:\\ProRider\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\ffmpeg\\bin\\ffmpeg.exe'];
  for (var i = 0; i < cands.length; i++) { try { if (fs.statSync(cands[i]).isFile()) return cands[i]; } catch(e) {} }
  try { var r = cp.spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg']); var o = String(r.stdout || '').split(/\r?\n/)[0].trim(); if (o) return o; } catch(e) {}
  return null;
}
// ── 02/10j: CACHE DE MÍDIA POR LINK ────────────────────────────────
// Música e vídeo da aula que vêm por link (Dropbox, Google Drive, nuvem):
// o Ginásio pede para baixar assim que conhece a aula (aula em rede: até 1 h
// antes) e na hora toca do disco, sem depender da internet. Arquivos com mais
// de 2 dias são apagados para não encher o computador.
var https = require('https');
var PASTA_CACHE = process.platform === 'win32' ? 'C:\\ProRider\\Cache' : path.join(os.homedir(), 'ProRider', 'Cache');
var _baixando = {};   // id -> {bytes, total, erro}
function cacheId(u) { return require('crypto').createHash('sha1').update(String(u)).digest('hex').slice(0, 20); }
function cacheExt(u) { var e = ''; try { e = path.extname(new URL(u).pathname).toLowerCase(); } catch(x) {} return /^\.(mp3|m4a|aac|wav|ogg|mp4|webm|mov|m4v|mkv)$/.test(e) ? e : '.bin'; }
function cacheArq(u) { return path.join(PASTA_CACHE, cacheId(u) + cacheExt(u)); }
function cacheBaixar(u, arq, redirs) {
  var id = cacheId(u), tmp = arq + '.part', est = _baixando[id] || (_baixando[id] = { bytes: 0, total: 0 });
  var lib = /^https:/.test(u) ? https : http;
  lib.get(u, { headers: { 'User-Agent': 'ProRider-Ginasio' } }, function(r) {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && (redirs || 0) < 6) { r.resume(); return cacheBaixar(new URL(r.headers.location, u).href, arq, (redirs || 0) + 1); }
    if (r.statusCode !== 200) { r.resume(); est.erro = 'HTTP ' + r.statusCode; delete _baixando[id]; console.log('[cache] falhou ' + r.statusCode + ': ' + u.slice(0, 80)); return; }
    est.total = parseInt(r.headers['content-length'], 10) || 0;
    var f = fs.createWriteStream(tmp);
    r.on('data', function(c) { est.bytes += c.length; });
    r.pipe(f);
    f.on('finish', function() { f.close(function() { try { fs.renameSync(tmp, arq); console.log('[cache] pronto: ' + path.basename(arq) + ' (' + Math.round(est.bytes / 1048576) + ' MB)'); } catch(e) {} delete _baixando[id]; }); });
    r.on('error', function() { est.erro = 'conexão caiu'; delete _baixando[id]; });
  }).on('error', function(e) { est.erro = e.message; delete _baixando[id]; console.log('[cache] erro: ' + e.message); });
}
function cacheLimpar() {
  var limite = Date.now() - 2 * 86400000;
  try { fs.readdirSync(PASTA_CACHE).forEach(function(n) { var a = path.join(PASTA_CACHE, n); try { var st = fs.statSync(a); if (Math.max(st.mtimeMs, st.atimeMs) < limite) fs.unlinkSync(a); } catch(e) {} }); } catch(e) {}
}
setTimeout(cacheLimpar, 5000); setInterval(cacheLimpar, 3600000);
function tratarCache(req, res, url) {
  if (url.indexOf('/cache/') !== 0) return false;
  if (!soLocal(req)) { jsonResp(res, 403, { erro: 'só no próprio computador' }); return true; }
  var q = {}; (req.url.split('?')[1] || '').split('&').forEach(function(kv){ var p = kv.split('='); if (p[0]) { try { q[p[0]] = decodeURIComponent(p[1] || ''); } catch(e) {} } });
  var u = String(q.u || '');
  if (!/^https?:\/\//i.test(u)) { jsonResp(res, 400, { erro: 'link inválido' }); return true; }
  var arq = cacheArq(u), id = cacheId(u);
  if (url === '/cache/arquivo') {
    try { var agora = new Date(); fs.utimesSync(arq, agora, fs.statSync(arq).mtime); } catch(e) {}   // em uso: conta os 2 dias a partir do último uso
    servirComRange(req, res, arq); return true;
  }
  if (url === '/cache/baixar' || url === '/cache/status') {
    var pronto = fs.existsSync(arq), est = _baixando[id];
    if (url === '/cache/baixar' && !pronto && !est) { try { fs.mkdirSync(PASTA_CACHE, { recursive: true }); } catch(e) {} cacheBaixar(u, arq, 0); est = _baixando[id]; console.log('[cache] baixando: ' + u.slice(0, 80)); }
    jsonResp(res, 200, { pronto: pronto, baixando: !!est, bytes: est ? est.bytes : 0, total: est ? est.total : 0, erro: est && est.erro || null, url: '/cache/arquivo?u=' + encodeURIComponent(u) });
    return true;
  }
  return false;
}
function tratarGravacao(req, res, url) {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(); return true; }
  if (url.indexOf('/gravacao') !== 0 && url.indexOf('/yt/') !== 0) return false;
  if (!soLocal(req)) { jsonResp(res, 403, { erro: 'só no próprio computador' }); return true; }
  var q = {}; (req.url.split('?')[1] || '').split('&').forEach(function(kv){ var p = kv.split('='); if (p[0]) { try { q[p[0]] = decodeURIComponent(p[1] || ''); } catch(e) {} } });
  if (url === '/gravacao/status') { jsonResp(res, 200, { ok: true, pasta: PASTA_GRAV, ffmpeg: !!acharFfmpeg() }); return true; }
  if (url === '/gravacao/inicio' && req.method === 'POST') {
    try { fs.mkdirSync(PASTA_GRAV, { recursive: true }); } catch(e) {}
    var d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '_' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
    var arq = path.join(PASTA_GRAV, stamp + '_' + nomeSeguro(q.aula) + (q.prof ? '_' + nomeSeguro(q.prof) : '') + '.webm');
    var id = 'g' + Date.now().toString(36);
    try { _grav[id] = { arq: arq, fd: fs.openSync(arq, 'w'), bytes: 0 }; } catch(e) { jsonResp(res, 500, { erro: 'não consegui criar o arquivo: ' + e.message }); return true; }
    console.log('  Gravando a aula em ' + arq);
    jsonResp(res, 200, { ok: true, id: id, arquivo: arq }); return true;
  }
  // arquivo gravado (para o envio ao servidor de teste), com Range
  if (url === '/gravacao/arquivo') {
    var n = path.basename(String(q.n || ''));
    if (!/\.(webm|json)$/i.test(n)) { jsonResp(res, 400, { erro: 'arquivo inválido' }); return true; }
    var alvo = path.join(PASTA_GRAV, n);
    try { fs.statSync(alvo); } catch(e) { jsonResp(res, 404, { erro: 'não encontrado' }); return true; }
    res.setHeader('Access-Control-Allow-Origin', '*'); servirComRange(req, res, alvo); return true;
  }
  // roteiro da aula (bloco, segundo, tela, pausa e desafio a cada segundo) ao lado do vídeo
  var rt = /^\/gravacao\/([a-z0-9]+)\/roteiro$/.exec(url);
  if (rt && req.method === 'POST') {
    var gr = _grav[rt[1]]; if (!gr) { jsonResp(res, 404, { erro: 'gravação não encontrada' }); return true; }
    lerCorpo(req, function(buf){ try { fs.writeFileSync(gr.arq.replace(/\.webm$/, '.json'), buf); jsonResp(res, 200, { ok: true }); } catch(e) { jsonResp(res, 500, { erro: e.message }); } });
    return true;
  }
  var m = /^\/gravacao\/([a-z0-9]+)\/(parte|fim)$/.exec(url);
  if (m && req.method === 'POST') {
    var g = _grav[m[1]]; if (!g) { jsonResp(res, 404, { erro: 'gravação não encontrada' }); return true; }
    if (m[2] === 'parte') { lerCorpo(req, function(buf){ try { fs.writeSync(g.fd, buf); g.bytes += buf.length; jsonResp(res, 200, { ok: true, bytes: g.bytes }); } catch(e) { jsonResp(res, 500, { erro: e.message }); } }); return true; }
    try { fs.closeSync(g.fd); } catch(e) {}
    delete _grav[m[1]]; console.log('  Gravação salva: ' + g.arq + ' (' + Math.round(g.bytes / 1048576) + ' MB)');
    // o .webm do navegador não traz a duração: com o ffmpeg, regrava o índice (sem
    // recodificar, leva segundos) antes de responder — assim dá para avançar o vídeo
    var ff = acharFfmpeg(), pronto = function(){ var b = g.bytes; try { b = fs.statSync(g.arq).size; } catch(e) {} jsonResp(res, 200, { ok: true, arquivo: g.arq, bytes: b }); };
    if (!ff) { pronto(); return true; }
    var tmp = g.arq.replace(/\.webm$/, '.tmp.webm');
    var pr = cp.spawn(ff, ['-hide_banner', '-loglevel', 'error', '-y', '-i', g.arq, '-c', 'copy', tmp], { stdio: 'ignore' });
    pr.on('exit', function(code){ if (code === 0) { try { fs.renameSync(tmp, g.arq); } catch(e) {} } else { try { fs.unlinkSync(tmp); } catch(e) {} } pronto(); });
    pr.on('error', function(){ pronto(); });
    return true;
  }
  if (url === '/yt/inicio' && req.method === 'POST') {
    lerCorpo(req, function(buf){
      var b = {}; try { b = JSON.parse(String(buf)); } catch(e) {}
      var chave = String(b.chave || '').trim(); if (!/^[A-Za-z0-9_-]{8,80}$/.test(chave)) { jsonResp(res, 400, { erro: 'chave do YouTube inválida' }); return; }
      var ff = acharFfmpeg(); if (!ff) { jsonResp(res, 501, { erro: 'ffmpeg não encontrado neste computador (veja o LEIA-ME: pasta C:\\ProRider\\ffmpeg)' }); return; }
      var copiar = /h264|avc1/i.test(String(b.codec || ''));
      var args = ['-hide_banner', '-loglevel', 'warning', '-fflags', '+genpts', '-i', 'pipe:0']
        .concat(copiar ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-b:v', '2500k', '-maxrate', '2500k', '-bufsize', '5000k', '-pix_fmt', 'yuv420p', '-g', '60'])
        .concat(['-c:a', 'aac', '-ar', '44100', '-b:a', '128k', '-f', 'flv', (process.env.PR_RTMP_BASE || 'rtmp://a.rtmp.youtube.com/live2/') + chave]);
      var pr; try { pr = cp.spawn(ff, args, { stdio: ['pipe', 'ignore', 'pipe'] }); } catch(e) { jsonResp(res, 500, { erro: e.message }); return; }
      var id = 'y' + Date.now().toString(36); _yt[id] = { pr: pr, erro: '' };
      pr.stderr.on('data', function(c){ var t = String(c).trim(); if (t) { _yt[id] && (_yt[id].erro = t.slice(-300)); console.log('  [YouTube] ' + t.slice(0, 200)); } });
      pr.on('exit', function(code){ console.log('  [YouTube] transmissão terminou (' + code + ')'); if (_yt[id]) _yt[id].fim = true; });
      pr.stdin.on('error', function(){});
      console.log('  [YouTube] transmitindo ' + (copiar ? '(vídeo direto, sem recodificar)' : '(recodificando em H.264)'));
      jsonResp(res, 200, { ok: true, id: id });
    });
    return true;
  }
  var y = /^\/yt\/([a-z0-9]+)\/(parte|fim)$/.exec(url);
  if (y && req.method === 'POST') {
    var t = _yt[y[1]]; if (!t) { jsonResp(res, 404, { erro: 'transmissão não encontrada' }); return true; }
    if (t.fim) { jsonResp(res, 410, { erro: 'o ffmpeg parou: ' + (t.erro || 'sem detalhe') }); delete _yt[y[1]]; return true; }
    if (y[2] === 'parte') { lerCorpo(req, function(buf){ try { t.pr.stdin.write(buf); } catch(e) {} jsonResp(res, 200, { ok: true }); }); return true; }
    try { t.pr.stdin.end(); } catch(e) {}
    setTimeout(function(){ try { t.pr.kill(); } catch(e) {} }, 8000);
    delete _yt[y[1]]; jsonResp(res, 200, { ok: true }); return true;
  }
  jsonResp(res, 404, { erro: 'rota desconhecida' }); return true;
}

http.createServer(function(req, res) {
  var url = req.url.split('?')[0];
  if (tratarGravacao(req, res, url)) return;
  if (tratarCache(req, res, url)) return;

  // ── PENDRIVE NATIVO ──────────────────────────────────────────────
  // O navegador nao pode varrer unidades sozinho — exige que o utilizador
  // escolha a pasta, e a autorizacao guardada apodrece quando o pendrive muda
  // (foi a origem dos arquivos de 0 bytes). Aqui, do lado do Node, isso nao
  // existe: procuramos o pendrive direto no Windows.
  // Estrutura esperada:  <unidade>:\ProRider\  com as aulas .prorider e as
  // pastas musica(s) e video(s) dentro.
  if (url === '/pendrive') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(acharPendrive()));
    return;
  }

  // Serve um arquivo do pendrive por endereco FIXO, com suporte a Range —
  // sem Range o navegador nao consegue posicionar o video.
  if (url === '/midia') {
    var alvo = '';
    try { alvo = decodeURIComponent((req.url.split('?')[1]||'').replace(/^p=/, '')); } catch(e) {}
    if (!alvo || !dentroDoPendrive(alvo)) { res.writeHead(403); res.end('fora do pendrive'); return; }
    servirComRange(req, res, alvo);
    return;
  }

  // Endpoint que devolve o IP local para o QR do browser
  if (url === '/localip') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ ip: getLocalIP(), port: PORT }));
    return;
  }

  if (url === '/' || url === '/ginasio') url = '/ginasio.html';
  var filePath = path.join(ROOT, url);

  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404); res.end('404 Not Found: ' + url);
      return;
    }
    var ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', function() {
  var ip = getLocalIP();
  console.log('');
  console.log('  ProRider GYM — Servidor local a correr');
  console.log('  http://localhost:' + PORT + '/ginasio');
  console.log('  Rede local: http://' + ip + ':' + PORT + '/ginasio');
  console.log('  Aluno (celular): http://' + ip + ':' + PORT + '/aluno');
  console.log('');
  console.log('  Para parar: fechar esta janela');
  try {
    var pd = acharPendrive();
    if (!pd.ok) console.log('  Pendrive: nenhuma pasta ProRider encontrada nas unidades.');
  } catch(e) {}
});
