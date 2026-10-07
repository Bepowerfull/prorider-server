// ═══════════════════════════════════════════════════════════════════
// ProRider — ATUALIZAÇÃO AUTOMÁTICA DA TV (07/10a) — módulo do PROCESSO PRINCIPAL do Electron
//
// Vai junto do main.js do programa da TV (uma vez só; depois disso as TVs se atualizam sozinhas).
// O que ele faz:
//  - guarda as versões do Ginásio em  <dados do app>/versoes/<versão>/  (fora do programa instalado)
//  - abre a versão ativa; se não houver nenhuma, abre a que veio no instalador (como hoje)
//  - instala uma versão nova quando a TELA pede (a tela decide a hora: madrugada, sem aula):
//      baixa só de https://app.prorider.app.br, confere o SHA-256 e a ASSINATURA (chave da ProRider),
//      confere os nomes dos arquivos, grava numa pasta nova e só então troca
//  - a versão nova precisa se CONFIRMAR em até 3 min depois de abrir; senão volta sozinha para a anterior
//    (também volta se o programa fechar duas vezes sem confirmar)
// Sem dependências: só o Node que já vem no Electron.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');

const ARQS_OK = /^[a-z0-9][a-z0-9_.-]{0,60}\.(html|js|css|png|json|txt)$/i;   // só arquivos simples, sem pastas
const OBRIGATORIOS = ['ginasio.html', 'script.js', 'style.css', 'bled112.js'];

function criar(opts) {
  const o = Object.assign({
    hosts: ['app.prorider.app.br'],          // de onde pode baixar
    baixar: null,                            // (url) => Promise<Buffer>  (padrão: https do Node)
    prazoConfirmarMs: 180000,
    log: (...a) => console.log('[atualizador]', ...a)
  }, opts || {});
  if (!o.pastaDados) throw new Error('pastaDados obrigatória (app.getPath("userData"))');
  if (!o.chavePublica) throw new Error('chavePublica obrigatória (PEM Ed25519 da ProRider)');
  const RAIZ = path.join(o.pastaDados, 'versoes'), EST = path.join(RAIZ, 'estado.json');
  fs.mkdirSync(RAIZ, { recursive: true });
  const ler = () => { try { return JSON.parse(fs.readFileSync(EST, 'utf8')); } catch (e) { return { atual: null, anterior: null, pendente: false, aberturas: 0, historico: [] }; } };
  const gravar = e => { const t = EST + '.tmp'; fs.writeFileSync(t, JSON.stringify(e, null, 1)); fs.renameSync(t, EST); };
  const hist = (e, txt) => { e.historico = (e.historico || []).concat([{ em: new Date().toISOString(), txt }]).slice(-30); };
  const pastaVer = v => path.join(RAIZ, String(v).replace(/[^0-9a-z_-]/gi, '_'));
  const existe = v => !!v && fs.existsSync(path.join(pastaVer(v), 'ginasio.html'));
  let timerConfirmar = null;

  function voltar(e, motivo) {
    o.log('voltando para a versão anterior:', motivo);
    hist(e, 'VOLTOU de ' + e.atual + ' para ' + (e.anterior || 'a do instalador') + ' — ' + motivo);
    e.falhou = { versao: e.atual, motivo, em: new Date().toISOString() };
    e.atual = existe(e.anterior) ? e.anterior : null; e.anterior = null; e.pendente = false; e.aberturas = 0;
    gravar(e);
  }

  // Chamado ao ABRIR o programa: decide o arquivo a carregar. Versão pendente que já abriu 2 vezes
  // sem confirmar (travou, fechou, reiniciou) volta para a anterior.
  function arquivoInicial(padrao) {
    const e = ler();
    if (e.pendente) {
      e.aberturas = (e.aberturas || 0) + 1;
      if (e.aberturas > 2) voltar(e, 'abriu 2 vezes sem confirmar');
      else gravar(e);
    }
    const e2 = ler();
    if (e2.atual && existe(e2.atual)) return path.join(pastaVer(e2.atual), 'ginasio.html');
    return padrao;
  }

  // Depois de carregar uma versão pendente: se ela não confirmar a tempo, volta e recarrega.
  function vigiarConfirmacao(recarregar) {
    clearTimeout(timerConfirmar);
    const e = ler(); if (!e.pendente) return;
    timerConfirmar = setTimeout(() => { const e2 = ler(); if (e2.pendente) { voltar(e2, 'não confirmou em ' + Math.round(o.prazoConfirmarMs / 1000) + ' s'); try { recarregar && recarregar(); } catch (x) {} } }, o.prazoConfirmarMs);
  }

  function baixarPadrao(url) {
    return new Promise((ok, falha) => {
      const req = require(url.startsWith('http:') ? 'http' : 'https').get(url, { timeout: 60000 }, r => {   // http só passa para 127.0.0.1 (testes)
        if (r.statusCode !== 200) { r.resume(); return falha(new Error('HTTP ' + r.statusCode)); }
        const partes = []; let n = 0;
        r.on('data', c => { n += c.length; if (n > 30 * 1048576) { req.destroy(); falha(new Error('arquivo grande demais')); } else partes.push(c); });
        r.on('end', () => ok(Buffer.concat(partes))); r.on('error', falha);
      });
      req.on('timeout', () => req.destroy(new Error('tempo esgotado'))); req.on('error', falha);
    });
  }

  // Instala a versão do manifesto: { versao, url, sha256, assinatura }. Só troca se TUDO conferir.
  async function instalar(m) {
    if (!m || !/^\d\d\/\d\d[a-z]$/.test(String(m.versao || ''))) throw new Error('versão inválida');
    let u; try { u = new URL(String(m.url)); } catch (e) { throw new Error('endereço inválido'); }
    const local = u.hostname === '127.0.0.1' && o.hosts.indexOf('127.0.0.1') >= 0;   // só nos testes
    if (o.hosts.indexOf(u.hostname) < 0 || (u.protocol !== 'https:' && !local)) throw new Error('endereço não permitido: ' + u.host);
    const assinado = Buffer.from(m.versao + '|' + String(m.sha256 || '').toLowerCase());
    let sigOk = false; try { sigOk = crypto.verify(null, assinado, o.chavePublica, Buffer.from(String(m.assinatura || ''), 'base64')); } catch (e) {}
    if (!sigOk) throw new Error('assinatura inválida — pacote recusado');
    const buf = await (o.baixar || baixarPadrao)(u.toString());
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    if (sha !== String(m.sha256).toLowerCase()) throw new Error('arquivo diferente do assinado (SHA-256 não confere)');
    let pac; try { pac = JSON.parse(zlib.gunzipSync(buf).toString('utf8')); } catch (e) { throw new Error('pacote corrompido'); }
    if (!pac || pac.versao !== m.versao || !pac.arquivos || typeof pac.arquivos !== 'object') throw new Error('pacote não é desta versão');
    const nomes = Object.keys(pac.arquivos);
    for (const n of nomes) if (!ARQS_OK.test(n)) throw new Error('nome de arquivo recusado: ' + n);
    for (const n of OBRIGATORIOS) if (nomes.indexOf(n) < 0) throw new Error('falta ' + n + ' no pacote');
    const sc = Buffer.from(pac.arquivos['script.js'], 'base64').toString('utf8');
    if (sc.indexOf("var PR_BUILD='BUILD " + m.versao + "'") < 0) throw new Error('script.js não é da versão ' + m.versao);
    const dest = pastaVer(m.versao), tmp = dest + '.baixando';
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    for (const n of nomes) fs.writeFileSync(path.join(tmp, n), Buffer.from(pac.arquivos[n], 'base64'));
    fs.rmSync(dest, { recursive: true, force: true }); fs.renameSync(tmp, dest);
    const e = ler();
    if (e.atual !== m.versao) { e.anterior = e.atual; e.atual = m.versao; }
    e.pendente = true; e.aberturas = 0; e.falhou = null; hist(e, 'instalada ' + m.versao + ' (aguardando confirmar)'); gravar(e);
    // limpa versões velhas (fica a atual e a anterior)
    for (const d of fs.readdirSync(RAIZ)) { const full = path.join(RAIZ, d); if (d === 'estado.json' || !fs.statSync(full).isDirectory()) continue;
      if (full !== pastaVer(e.atual) && (!e.anterior || full !== pastaVer(e.anterior))) fs.rmSync(full, { recursive: true, force: true }); }
    o.log('instalada', m.versao, '— recarregando');
    return { ok: true, versao: m.versao, arquivo: path.join(dest, 'ginasio.html') };
  }

  function confirmar(build) {
    const e = ler(); if (!e.pendente) return { ok: true, ja: true };
    if (String(build || '') !== 'BUILD ' + e.atual) return { ok: false, erro: 'a tela abriu ' + build + ', esperado BUILD ' + e.atual };
    e.pendente = false; e.aberturas = 0; hist(e, 'confirmada ' + e.atual); gravar(e); clearTimeout(timerConfirmar);
    return { ok: true };
  }

  // Liga no ipcMain do Electron (a tela chama pelo preload: window.prAtualizador)
  function ligarIpc(ipcMain, janela, padrao) {
    const recarregar = () => { const f = arquivoInicial(padrao); janela().loadFile(f); vigiarConfirmacao(recarregar); };
    ipcMain.handle('pr-atu-estado', () => { const e = ler(); return { atual: e.atual, anterior: e.anterior, pendente: !!e.pendente, falhou: e.falhou || null, historico: (e.historico || []).slice(-5) }; });
    ipcMain.handle('pr-atu-confirmar', (ev, build) => confirmar(build));
    ipcMain.handle('pr-atu-instalar', async (ev, m) => {
      try { const r = await instalar(m); setTimeout(recarregar, 1500); return r; }
      catch (err) { o.log('recusada:', err.message); return { ok: false, erro: err.message }; }
    });
    return { recarregar };
  }

  return { arquivoInicial, vigiarConfirmacao, instalar, confirmar, ligarIpc, estado: ler, _pastaVer: pastaVer };
}
module.exports = criar;
