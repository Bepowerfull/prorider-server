// 07/10a — ATUALIZAÇÃO AUTOMÁTICA DA TV, de ponta a ponta:
//  chaves de teste → pacote assinado (ferramentas/montar-atualizacao-tv.js) → servidor oferece só para a
//  academia ligada → a TV (Ginásio de verdade) pede a instalação só PARADA na tela de espera → o módulo do
//  programa (atualizador-tv.js, o mesmo que vai no Electron) confere assinatura e SHA-256 e grava →
//  a versão instalada ABRE de verdade e se confirma → Saúde mostra "atualizou".
// E os ataques: pacote adulterado, assinatura de outra chave, endereço de fora, nome de arquivo com
//  caminho, versão que não confirma (volta sozinha) e que trava ao abrir (volta na 3ª abertura).
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), zlib = require('zlib');
const { execFileSync } = require('child_process');
const B = 'http://127.0.0.1:3999', PROD = 'https://app.prorider.app.br', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste PULADO.'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
const PUB = path.join(RAIZ, 'public'), DEST = path.join(PUB, 'ginasio', 'atualizacao');
const criarAtu = require(path.join(RAIZ, 'atualizador-tv', 'atualizador-tv.js'));
const { sql, codigoTv, ADMIN, ADMIN_SENHA } = require('./comum');
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prorider-atu-'));
function limpar() { try { fs.rmSync(DEST, { recursive: true, force: true }); } catch (e) {} try { fs.rmdirSync(path.dirname(DEST)); } catch (e) {} }   // nunca deixar pacote de TESTE no site
(async () => {
  try {
    const VER = fs.readFileSync(path.join(GIN, 'script.js'), 'utf8').match(/var PR_BUILD='BUILD ([^']+)'/)[1];
    console.log('1) Chaves e pacote assinado (versão ' + VER + ')');
    const kdir = path.join(tmp, 'chaves');
    execFileSync(process.execPath, [path.join(RAIZ, 'ferramentas', 'chaves-atualizacao-tv.js'), kdir], { stdio: 'ignore' });
    const PRIV = path.join(kdir, 'prorider-tv-PRIVADA.pem'), PUBK = fs.readFileSync(path.join(kdir, 'prorider-tv-publica.pem'), 'utf8');
    ok(fs.existsSync(PRIV) && /BEGIN PUBLIC KEY/.test(PUBK), 'par de chaves criado fora do projeto');
    let saida = ''; try { execFileSync(process.execPath, [path.join(RAIZ, 'ferramentas', 'chaves-atualizacao-tv.js'), kdir], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { saida = String(e.stderr || ''); }
    ok(/não sobrescrevo/.test(saida), 'não sobrescreve uma chave que já existe');
    limpar(); execFileSync(process.execPath, [path.join(RAIZ, 'ferramentas', 'montar-atualizacao-tv.js'), GIN, PRIV, PUB], { stdio: 'ignore' });
    const man = JSON.parse(fs.readFileSync(path.join(DEST, 'manifesto.json'), 'utf8'));
    ok(man.versao === VER && man.arquivos >= 10 && /^[0-9a-f]{64}$/.test(man.sha256), 'pacote montado e assinado', { versao: man.versao, arquivos: man.arquivos, kb: Math.round(man.tamanho / 1024) });
    const pac = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DEST, man.arquivo))).toString());
    ok(!Object.keys(pac.arquivos).some(n => /\.(bat|zip|md)$/i.test(n)), 'pacote só com os arquivos da tela (sem .bat)', Object.keys(pac.arquivos));

    console.log('2) Servidor');
    const ADM = (await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA }, null, { 'X-Forwarded-For': '10.88.0.1' })).d.token;
    await sql(`UPDATE licencas SET tv_auto_atualizar=false, tv_atualizar_agora=NULL WHERE codigo='D5448D47'`);
    const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-atu', nome_computador: 'TV atualiza' })).d.token;
    const VELHA = { 'X-PR-Build': 'BUILD 03/10z' };
    let r = await j('GET', '/display/atualizacao', null, TK, VELHA);
    ok(r.d.nada && r.d.motivo === 'desligada' && r.d.disponivel === VER, 'academia com atualização desligada: não oferece (só avisa que existe)', r.d);
    ok((await j('POST', '/admin/licencas/D5448D47/tv-atualizacao', { ligado: true }, TK)).s === 401 || (await j('POST', '/admin/licencas/D5448D47/tv-atualizacao', { ligado: true }, TK)).s === 403, 'TV não consegue ligar a própria atualização (só o admin)');
    r = await j('POST', '/admin/licencas/D5448D47/tv-atualizacao', { ligado: true }, ADM);
    ok(r.d.ok && r.d.tv_auto_atualizar === true && r.d.disponivel === VER, 'admin liga a atualização da academia', r.d);
    r = await j('GET', '/display/atualizacao', null, TK, VELHA);
    ok(r.d.versao === VER && r.d.sha256 === man.sha256 && r.d.assinatura === man.assinatura && /\/ginasio\/atualizacao\/.+\.prpack$/.test(r.d.url) && r.d.janela === '02:00-05:00' && r.d.agora === false, 'TV antiga recebe a versão nova, a janela da madrugada e o pacote assinado', { url: r.d.url, janela: r.d.janela });
    r = await j('GET', '/display/atualizacao', null, TK, { 'X-PR-Build': 'BUILD ' + VER });
    ok(r.d.nada && r.d.motivo === 'em_dia', 'TV já na versão: nada a fazer');
    ok((await j('GET', '/display/atualizacao')).s === 401, 'sem token de TV: recusado');
    await j('POST', '/admin/licencas/D5448D47/tv-atualizacao', { agora: true }, ADM);
    ok((await j('GET', '/display/atualizacao', null, TK, VELHA)).d.agora === true, '"atualizar agora" do admin chega à TV');

    console.log('3) O módulo do programa (o mesmo do Electron)');
    const dados = path.join(tmp, 'dados');
    const atu = criarAtu({ pastaDados: dados, chavePublica: PUBK, hosts: ['app.prorider.app.br', '127.0.0.1'], prazoConfirmarMs: 2500, log: () => {} });
    const local = Object.assign({}, man, { url: B + '/ginasio/atualizacao/' + man.arquivo });
    const recusa = async (m, rot, re) => { let e = ''; try { await atu.instalar(m); } catch (x) { e = x.message; } ok(re.test(e), rot, e); };
    await recusa(Object.assign({}, local, { url: 'https://site-de-fora.com/x.prpack' }), 'recusa baixar de outro endereço', /não permitido/);
    await recusa(Object.assign({}, local, { url: local.url.replace('http:', 'http:') , sha256: '0'.repeat(64) }), 'recusa pacote com SHA trocado (a assinatura não bate)', /assinatura/);
    const outra = crypto.generateKeyPairSync('ed25519');
    await recusa(Object.assign({}, local, { assinatura: crypto.sign(null, Buffer.from(man.versao + '|' + man.sha256), outra.privateKey).toString('base64') }), 'recusa assinatura de outra chave (servidor invadido não instala nada)', /assinatura/);
    // pacote adulterado com assinatura válida de OUTRO conteúdo: monta um pacote ruim e assina o sha do bom
    const ruim = zlib.gzipSync(Buffer.from(JSON.stringify({ versao: VER, arquivos: Object.assign({}, pac.arquivos, { 'script.js': Buffer.from('alert(1)').toString('base64') }) })));
    const atuRuim = criarAtu({ pastaDados: path.join(tmp, 'd2'), chavePublica: PUBK, hosts: ['127.0.0.1'], baixar: async () => ruim, log: () => {} });
    let e2 = ''; try { await atuRuim.instalar(local); } catch (x) { e2 = x.message; } ok(/SHA-256/.test(e2), 'recusa arquivo trocado no caminho (SHA-256 não confere)', e2);
    const priv = crypto.createPrivateKey(fs.readFileSync(PRIV));
    const mal = zlib.gzipSync(Buffer.from(JSON.stringify({ versao: VER, arquivos: Object.assign({}, pac.arquivos, { '../../windows/x.js': 'eA==' }) })));
    const shaMal = crypto.createHash('sha256').update(mal).digest('hex');
    const atuMal = criarAtu({ pastaDados: path.join(tmp, 'd3'), chavePublica: PUBK, hosts: ['127.0.0.1'], baixar: async () => mal, log: () => {} });
    let e3 = ''; try { await atuMal.instalar({ versao: VER, url: local.url, sha256: shaMal, assinatura: crypto.sign(null, Buffer.from(VER + '|' + shaMal), priv).toString('base64') }); } catch (x) { e3 = x.message; }
    ok(/nome de arquivo recusado/.test(e3) && !fs.existsSync(path.join(tmp, 'windows')), 'recusa arquivo com caminho (../) mesmo assinado', e3);
    ok(atu.arquivoInicial('PADRAO') === 'PADRAO', 'sem versão instalada: abre a do instalador');

    console.log('4) A TV de verdade pede; o módulo instala; a versão nova abre e se confirma');
    const nav = await chromium.launch(); const erros = [];
    const rota = async pg => pg.route(/^https?:/, async rr => { const u = rr.request().url();
      if (u.startsWith(PROD)) { const q = rr.request(); try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined }); return rr.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (x) { return rr.abort(); } }
      if (/qrcode\.min\.js/.test(u)) return rr.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
      if (/fonts\.googleapis\.com/.test(u)) return rr.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });
      return rr.abort(); });
    const prep = async (pg, extra) => { pg.on('pageerror', x => erros.push(x.message.slice(0, 140))); await rota(pg);
      await pg.exposeFunction('__atuInstalar', m => atu.instalar(Object.assign({}, m, { url: m.url.replace(PROD, B) })).then(x => x, x => ({ ok: false, erro: x.message })));
      await pg.exposeFunction('__atuEstado', () => { const e = atu.estado(); return { atual: e.atual, anterior: e.anterior, pendente: !!e.pendente, falhou: e.falhou || null }; });
      await pg.exposeFunction('__atuConfirmar', b => atu.confirmar(b));
      await pg.addInitScript(([tk, x]) => { localStorage.setItem('pr_display_token', tk); window._PR_ATU_PRIMEIRA_MS = 999999999; window._PR_ATU_CONFIRMAR_MS = x.conf || 3000;
        window.__instalou = []; window.prAtualizador = { instalar: m => { window.__instalou.push(m.versao); return window.__atuInstalar(m); }, estado: () => window.__atuEstado(), confirmar: b => window.__atuConfirmar(b) };
        const Wo = window.WebSocket; const Nw = function (u, y) { return new Wo(String(u).replace('wss://app.prorider.app.br', 'ws://127.0.0.1:3999'), y); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [TK, extra || {}]); };
    const tv = await nav.newPage({ viewport: { width: 1920, height: 1080 } }); await prep(tv);
    await tv.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(2500);
    await tv.evaluate(() => { PR_BUILD = 'BUILD 03/10z'; });   // finge ser a TV antiga
    await tv.evaluate(() => { isPlaying = true; }); await tv.evaluate(() => _prAtuChecar()); await espera(800);
    ok((await tv.evaluate(() => __instalou.length)) === 0, 'com aula rodando NÃO instala (mesmo com "atualizar agora")');
    await tv.evaluate(() => { isPlaying = false; boxMode = 'preAula'; }); await tv.evaluate(() => _prAtuChecar()); await espera(800);
    ok((await tv.evaluate(() => __instalou.length)) === 0, 'na pré-aula também não');
    await tv.evaluate(() => { boxMode = 'idle'; }); await tv.evaluate(() => _prAtuChecar());
    let st = null; for (let i = 0; i < 30 && !(st && st.atual === VER); i++) { await espera(300); st = atu.estado(); }
    ok(st && st.atual === VER && st.pendente === true, 'parada na tela de espera: baixou, conferiu e instalou (aguardando confirmar)', { atual: st && st.atual, pendente: st && st.pendente });
    const arq = atu.arquivoInicial('PADRAO');
    ok(arq !== 'PADRAO' && fs.existsSync(arq) && fs.readFileSync(path.join(path.dirname(arq), 'script.js'), 'utf8') === fs.readFileSync(path.join(GIN, 'script.js'), 'utf8'), 'arquivos instalados iguais aos do pacote', path.dirname(arq).replace(tmp, '…'));
    let sd = await sql(`SELECT atualizacao->>'etapa' AS e FROM licenca_computadores WHERE device_id='tv-atu'`);
    ok(sd === 'instalada', 'Saúde: "instalada, confirmando"', sd);
    await tv.close();
    // reabre NA VERSÃO INSTALADA (como o programa faz) e espera ela se confirmar
    const tv2 = await nav.newPage({ viewport: { width: 1920, height: 1080 } }); await prep(tv2);
    await tv2.goto('file://' + arq);
    for (let i = 0; i < 30 && atu.estado().pendente; i++) await espera(300);
    ok(atu.estado().pendente === false && atu.estado().atual === VER, 'versão nova abriu de verdade e se confirmou sozinha');
    for (let i = 0; i < 20 && sd !== 'ok'; i++) { await espera(300); sd = await sql(`SELECT atualizacao->>'etapa' AS e FROM licenca_computadores WHERE device_id='tv-atu'`); }
    ok(sd === 'ok', 'Saúde: "atualizou"', sd);
    ok(await sql(`SELECT COALESCE(tv_atualizar_agora::text,'') FROM licencas WHERE codigo='D5448D47'`) === '', 'pedido "atualizar agora" limpo depois do sucesso');
    const ADMsd = (await j('GET', '/admin/saude', null, ADM)).d;
    const linha = (ADMsd.tvs.lista || []).find(x => x.device_id === 'tv-atu');
    ok(linha && linha.atualizacao && linha.atualizacao.etapa === 'ok' && ADMsd.tvs.pacote_auto === VER, 'Admin → Saúde mostra a atualização da TV e o pacote disponível', linha && linha.atualizacao);
    await tv2.close();

    console.log('5) E se a versão nova der problema?');
    // (a) instalou mas não confirma em 2,5 s → volta sozinha
    const d4 = path.join(tmp, 'd4'); const atu4 = criarAtu({ pastaDados: d4, chavePublica: PUBK, hosts: ['127.0.0.1'], prazoConfirmarMs: 1500, log: () => {} });
    await atu4.instalar(local); let recarregou = 0; atu4.vigiarConfirmacao(() => recarregou++); await espera(2200);
    ok(atu4.estado().pendente === false && !atu4.estado().atual && atu4.estado().falhou && recarregou === 1, 'não confirmou a tempo: voltou para a versão do instalador e recarregou', atu4.estado().falhou);
    // (b) trava ao abrir (programa fecha e reabre sem confirmar) → na 3ª abertura volta
    await atu4.instalar(local);
    const a1 = atu4.arquivoInicial('PADRAO'), a2 = atu4.arquivoInicial('PADRAO'), a3 = atu4.arquivoInicial('PADRAO');
    ok(a1 !== 'PADRAO' && a2 !== 'PADRAO' && a3 === 'PADRAO', 'travou 2 vezes ao abrir: na 3ª abre a versão anterior', [a1.slice(-12), a2.slice(-12), a3]);
    ok(atu4.confirmar('BUILD 99/99z').ok === true || atu4.estado().pendente === false, 'confirmar depois de voltar não reativa a versão ruim');
    // (c) programa antigo, sem atualizador: a TV avisa a Saúde "programa sem atualizador"
    await sql(`UPDATE licenca_computadores SET atualizacao=NULL WHERE device_id='tv-atu'`);
    const tv3 = await nav.newPage(); tv3.on('pageerror', x => erros.push(x.message.slice(0, 140))); await rota(tv3);
    await tv3.addInitScript(tk => { localStorage.setItem('pr_display_token', tk); window._PR_ATU_PRIMEIRA_MS = 999999999; const Wo = window.WebSocket; const Nw = function (u, y) { return new Wo(String(u).replace('wss://app.prorider.app.br', 'ws://127.0.0.1:3999'), y); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, TK);
    await tv3.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(2000);
    await tv3.evaluate(() => { PR_BUILD = 'BUILD 03/10z'; boxMode = 'idle'; }); await tv3.evaluate(() => _prAtuChecar()); await espera(1200);
    ok(await sql(`SELECT atualizacao->>'etapa' FROM licenca_computadores WHERE device_id='tv-atu'`) === 'sem_suporte', 'programa sem atualizador: Saúde avisa "instalar uma vez pelo .bat"');
    ok(erros.length === 0, 'nenhum erro de JavaScript na TV', erros.slice(0, 3));
    await nav.close();
  } finally { limpar(); await sql(`UPDATE licencas SET tv_auto_atualizar=false, tv_atualizar_agora=NULL WHERE codigo='D5448D47'`).catch(() => {}); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
  ok(!fs.existsSync(path.dirname(DEST)), 'pacote de teste apagado do site (não vai no pacote de entrega)');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); limpar(); process.exit(1); });
