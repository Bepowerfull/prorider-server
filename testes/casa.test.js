// 13/10 — ALUNO PEDALANDO DE CASA numa aula da academia (rolo/bike própria ligada no celular)
//   app: botão "Vou pedalar de casa" → entra sem bike (remoto). TV: faixa DE CASA na tela do QR (não ocupa bike),
//   cartão "EM CASA", números do celular, aula gravada com os dois alunos.
// (base: 03/10s — teste das telas da TV)
// A TV (pasta ginasio/) abre contra o servidor de teste e passa por uma aula inteira:
//   tela de espera → tela do QR → aluno entra pelo "celular" → START → aula com números
//   → fim de aula (resumo no banco) → volta para o início.
// Precisa do Playwright (uma vez): npm i -D playwright && npx playwright install chromium
// Sem ele, o teste é pulado com aviso (código 3). Fotos de cada tela: pasta mostrada no fim.
const fs = require('fs'), path = require('path'), os = require('os');
const B = 'http://127.0.0.1:3999', PROD = 'https://app.prorider.app.br';
const RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste da TV PULADO.\n    Instale uma vez: npm i -D playwright && npx playwright install chromium'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
if (!fs.existsSync(path.join(GIN, 'ginasio.html'))) { console.log('FALHA pasta do Ginásio não encontrada: ' + GIN + ' (copie os arquivos do zip 3_GINASIO para ginasio/ na raiz do repositório)'); process.exit(1); }
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const { sql, ADMIN, ADMIN_SENHA , codigoTv } = require('./comum');
async function j(m, p, body, tok) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
// espera até a condição dar certo (no máximo ms)
async function ate(p, fn, ms) { const t = Date.now() + (ms || 8000); let v; while (Date.now() < t) { v = await p.evaluate(fn).catch(() => null); if (v) return v; await espera(300); } return v; }
const FOTOS = fs.mkdtempSync(path.join(os.tmpdir(), 'prorider-telas-tv-'));

(async () => {
  const inicio = new Date().toISOString();
  const at = await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-teste-casa', nome_computador: 'TV casa' });
  ok(at.s === 200 && at.d.token, 'TV ativada no servidor de teste', at.s); const TK = at.d.token;
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  await sql(`DELETE FROM aulas_agenda WHERE nome='Spin Teste TV'`);
  await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_nome,dia_semana,hora,duracao_min,vagas_max) VALUES ('D5448D47','Spin Teste TV','Prof Teste',${agora.getDay()},'23:58',45,12)`);
  const build = (fs.readFileSync(path.join(GIN, 'script.js'), 'utf8').match(/var PR_BUILD='([^']+)'/) || [])[1];

  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' });   // a TV fica no Brasil
  const erros = [], cons = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160) + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ').slice(0, 220))); p.on('console', m => cons.push(m.type() + ': ' + m.text().slice(0, 200)));
  const foto = async n => { try { await p.screenshot({ path: path.join(FOTOS, n + '.png') }); } catch (e) {} };
  await p.route(/^https?:/, async r => {
    const u = r.request().url();
    if (u.startsWith(PROD)) { const q = r.request();
      try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined });
        return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
    if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });   // as mesmas letras da TV, sem internet
    return r.abort();
  });
  await p.addInitScript(([tk, prod, b]) => { try { localStorage.setItem('pr_display_token', tk); } catch (e) {}
    const W = window.WebSocket; const N = function (u, x) { return new W(String(u).replace(prod.replace('https', 'wss'), b.replace('http', 'ws')), x); };
    N.prototype = W.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => N[k] = W[k]); window.WebSocket = N; }, [TK, PROD, B]);

  console.log('1) Abrir a TV');
  await p.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(4000);
  let s = await p.evaluate(() => ({ idle: typeof idleOn !== 'undefined' && idleOn, ativ: (function () { const e = document.getElementById('boxAtivacao'); return !!e && getComputedStyle(e).display !== 'none'; })(), txt: document.body.innerText }));
  ok(!s.ativ, 'licença aceita (não pede o código de ativação)');
  ok(s.idle, 'abre na tela de espera');
  ok(await ate(p, () => /Spin Teste TV/.test((document.getElementById('idleAulas') || {}).textContent || '')), 'tela de espera mostra a aula de hoje da grade');
  await foto('1_espera');
  await p.evaluate(() => { sairIdle(); mostrarEscolha(); }); await espera(1200);
  s = await p.evaluate(() => ({ modo: boxMode, txt: document.body.innerText }));
  ok(s.modo === 'escolha' && build && s.txt.indexOf(build) >= 0, 'menu inicial abre e mostra a versão (' + build + ')', s.modo);
  await foto('1b_menu');

  console.log('2) Tela do QR');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = [{ intensity: 'z2', durationSec: 60, ftpMin: 60, ftpMax: 70, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'warmup' },
               { intensity: 'z4', durationSec: 60, ftpMin: 90, ftpMax: 100, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' }];
    try { _prNormWorkout(workout); } catch (e) {}
    segments = [{ id: 'warmup', name: 'Aquecimento', type: 'warmup' }, { id: 'main_1', name: 'Bloco Principal', type: 'main' }];
    videoSource = 'none'; document.getElementById('className').value = 'AULA CASA';
    mostrarPreAula({ nome: 'AULA CASA' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  await espera(2500);
  const sala = await p.evaluate(() => salaCode);
  const mk = async (nome, bike, extra) => { const w = new WS(B.replace('http', 'ws')); const r = []; w.on('message', m => { try { r.push(JSON.parse(m)); } catch (e) {} });
    await new Promise(o => w.on('open', o)); w.send(JSON.stringify(Object.assign({ tipo: 'entrar_sala', codigo: sala, nome, bike, ftpBase: 200, genero: 'M' }, extra || {}))); return { w, r }; };
  const sala1 = await mk('Aluno Sala', 3), casa = await mk('Joao Casa', 0, { remoto: true });
  await espera(1500);
  ok(casa.r.some(m => m.tipo === 'conectado'), 'servidor aceita o aluno de casa (sem bike)');
  s = await p.evaluate(() => ({ remoto: (alunosMap['Joao Casa'] || {}).remoto, faixa: (document.getElementById('preAulaCasa') || {}).innerText || '', grade: document.getElementById('preAulaAlunos').innerText, cont: (document.getElementById('preAulaConect') || {}).textContent }));
  ok(s.remoto === true && /DE CASA/.test(s.faixa) && /Joao Casa/.test(s.faixa), 'tela do QR: faixa "DE CASA" com o aluno', s.faixa);
  ok(!/Joao Casa/.test(s.grade) && /1 de casa/.test(s.cont), 'aluno de casa não ocupa bike da sala; contador "1 de casa"', s.cont);
  await foto('casa_qr');
  await p.keyboard.press('Enter'); await espera(5000);
  ok(casa.r.some(m => m.tipo === 'aula_iniciada'), 'celular de casa recebe o início da aula');
  for (let i = 0; i < 8; i++) { sala1.w.send(JSON.stringify({ tipo: 'dados_aluno', nome: 'Aluno Sala', watts: 180, rpm: 88, fonte: 'celular' })); casa.w.send(JSON.stringify({ tipo: 'dados_aluno', nome: 'Joao Casa', watts: 210, rpm: 92, fc: 140, fonte: 'celular' })); await espera(500); }
  s = await p.evaluate(() => { const a = alunosMap['Joao Casa'] || {}; return { w: a.watts, rpm: a.rpm, fc: a.fc }; });
  ok(s.w === 210 && s.rpm === 92 && s.fc === 140, 'TV recebe potência, cadência e FC do celular de casa', s);
  await p.evaluate(() => ctrlSetScreen(1)); await espera(1500); await foto('casa_cartoes');
  const ct = await p.evaluate(() => (document.getElementById('overlayFTP') || {}).innerText || '');
  ok(/Joao Casa[\s\S]*EM CASA/.test(ct) && /BIKE 3/.test(ct), 'cartão do aluno de casa mostra "EM CASA" (o da sala, a bike)', ct.replace(/\s+/g, ' ').slice(0, 200));
  await p.evaluate(() => ctrlSetScreen(4)); await espera(1500); await foto('casa_ranking');
  await p.evaluate(() => ctrlConfirmYes()); await espera(5000); await foto('casa_fim');
  ok(casa.r.some(m => m.tipo === 'fim_aula'), 'celular de casa recebe o fim da aula');
  let n = ''; for (let i = 0; i < 20 && !n; i++) { n = await sql(`SELECT n_alunos FROM aulas_tv WHERE sala='${sala}'`); if (!n) await espera(300); }
  ok(n === '2', 'aula gravada com os dois alunos (sala + casa)', n);
  sala1.w.close(); casa.w.close();
  // app: botão "Vou pedalar de casa" na escolha da bike → entra com remoto e sem bike
  const ap = await nav.newPage({ viewport: { width: 390, height: 844 } }); const ea = []; ap.on('pageerror', e => ea.push(e.message.slice(0, 160)));
  await ap.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
  await ap.goto(B + '/aluno/'); await espera(2500);
  const app = await ap.evaluate(async () => { const t = document.getElementById('prsTermos'); if (t) t.remove();
    lastCode = 'PR-CASA-TEST'; _salaInfo = { numBikes: 6, bikes: [], ocupadas: [], ocupantes: {}, trancadas: [], keiser: {} }; go('sBikeSel'); _renderBikeGrid();
    const bt = document.querySelector('#bikeSelCasa button'); const env = [];
    wsConn = { readyState: 1, send: x => env.push(JSON.parse(x)), close() {} }; window.prUser = window.prUser || { name: 'Joao Casa' };
    try { localStorage.setItem('profNome', 'Joao Casa'); } catch (e) {}
    bt && bt.click(); await new Promise(r => setTimeout(r, 300));
    const m = env.find(x => x.tipo === 'entrar_sala') || {};
    return { tem: !!bt && /pedalar de casa/i.test(bt.innerText), bike: m.bike, remoto: m.remoto, marcado: /VOCÊ/.test((document.getElementById('bikeSelCasa') || {}).innerText || ''), casa: _prCasa }; });
  ok(app.tem && app.bike === 0 && app.remoto === true && app.casa === true && app.marcado, 'app: "Vou pedalar de casa" entra sem bike e marcado como de casa', app);
  // 16/10: depois de entrar de casa, abre "Conectar aparelhos" (rolo e cinta); "Ir para a aula" volta para a aula da TV
  const cn = await ap.evaluate(async () => { _prConnCasa(); await new Promise(r => setTimeout(r, 300));
    const sc = document.getElementById('sConnect'), st = { tela: sc.classList.contains('active'), titulo: document.getElementById('connAulaName').textContent, dica: document.getElementById('cnDica').innerText, botao: document.getElementById('btnStartSem').textContent, gaveta: getComputedStyle(document.getElementById('dCasaConn')).display };
    document.getElementById('btnStartSem').click(); await new Promise(r => setTimeout(r, 300));
    st.depois = document.getElementById('sLive').classList.contains('active'); st.contagem = document.getElementById('sCountdown').classList.contains('active');
    st.restaurado = document.getElementById('btnStartSem').textContent; st.modo = !!window._prConnModoTV; return st; });
  ok(cn.tela && cn.titulo === 'Pedalar de casa' && /rolo/.test(cn.dica) && /Ir para a aula/.test(cn.botao) && cn.gaveta === 'block', 'de casa: abre a tela de conectar o rolo e a cinta (e o botão fica na gaveta)', cn);
  ok(cn.depois && !cn.contagem && !cn.modo && cn.restaurado === 'Começar sem aparelho', '"Ir para a aula" volta para a aula da TV (não começa aula do app)', cn);
  await ap.screenshot({ path: path.join(FOTOS, 'casa_app.png') }).catch(() => {});
  ok(!ea.length, 'sem erro de JavaScript no app', ea);
  ok(!erros.length, 'sem erro de JavaScript na TV', erros.slice(0, 3));
  await sql(`DELETE FROM aulas_agenda WHERE nome='Spin Teste TV'`);
  console.log('  fotos: ' + FOTOS);
  await nav.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
