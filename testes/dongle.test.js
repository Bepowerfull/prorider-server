// 16/10 (07/10o) — DONGLE DAS BIKES NO PROGRAMA DA TV (Electron)
//   No ensaio de 16/10 as bikes ficaram apagadas: ao abrir, o programa pedia a porta do dongle
//   (requestPort) e o navegador recusava porque não houve clique. Só voltava abrindo o pareamento.
//   Agora: 1) tenta primeiro as portas já autorizadas (getPorts, sem clique);
//          2) se precisar de clique, mostra uma faixa e o primeiro clique/tecla liga o dongle e o scan.
// Dongle de mentira: uma porta serial que responde a qualquer comando (como o BLED112 respondendo ao HELLO).
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste do dongle PULADO.'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
if (!fs.existsSync(path.join(GIN, 'ginasio.html'))) { console.log('FALHA pasta do Ginásio não encontrada: ' + GIN); process.exit(1); }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
async function ate(p, fn, ms) { const t = Date.now() + (ms || 8000); let v; while (Date.now() < t) { v = await p.evaluate(fn).catch(() => null); if (v) return v; await espera(250); } return v; }

function mockSerial(autorizada) {
  window.__escritas = [];
  function porta() { let ctrl = null; return {
    getInfo: () => ({ usbVendorId: 0x2458, usbProductId: 1 }), readable: null, writable: null, _aberta: false,
    async open() { if (this._aberta) throw new Error('The port is already open.'); this._aberta = true;
      this.readable = new ReadableStream({ start(c) { ctrl = c; } });
      this.writable = new WritableStream({ write(ch) { window.__escritas.push(Array.from(ch)); setTimeout(() => { try { ctrl.enqueue(new Uint8Array([0, 0, 0, 1])); } catch (e) {} }, 10); } }); },
    async close() { this._aberta = false; try { ctrl && ctrl.close(); } catch (e) {} this.readable = null; this.writable = null; } }; }
  // gesto do usuário (como no navegador de verdade: só tecla/clique libera o pedido da porta por alguns segundos)
  window.__gestoAte = 0; ['keydown', 'pointerdown'].forEach(n => document.addEventListener(n, e => { if (e.isTrusted) window.__gestoAte = Date.now() + 5000; }, true));
  window.__porta = porta(); window.__autorizadas = autorizada ? [window.__porta] : []; window.__pedidos = 0;
  Object.defineProperty(navigator, 'serial', { configurable: true, value: {
    getPorts: async () => window.__autorizadas.slice(),
    requestPort: async () => { window.__pedidos++;
      if (!(Date.now() < window.__gestoAte)) throw new DOMException("Failed to execute 'requestPort' on 'Serial': Must be handling a user gesture to show a permission request.", 'SecurityError');
      window.__autorizadas = [window.__porta]; return window.__porta; },
    addEventListener() {} } });
}

(async () => {
  const nav = await chromium.launch();
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) prorider/1.0 Chrome/124.0 Electron/30.0.0 Safari/537.36';
  const abrir = async (autorizada) => {
    const ctx = await nav.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: UA });
    const p = await ctx.newPage(); const erros = [], cons = [];
    p.on('pageerror', e => erros.push(e.message.slice(0, 160))); p.on('console', m => cons.push(m.text().slice(0, 160)));
    await p.route(/^https?:/, r => r.abort());
    await p.addInitScript(mockSerial, autorizada);
    await p.goto('file://' + path.join(GIN, 'ginasio.html'));
    return { p, ctx, erros, cons };
  };

  console.log('1) Programa abre SEM clique e a porta ainda não foi autorizada');
  let t = await abrir(false);
  if (process.env.DBG) t.p.on('console', m => console.log('C:', m.text().slice(0, 160)));
  let s = await ate(t.p, () => document.getElementById('prDongleFaixa') ? { faixa: document.getElementById('prDongleFaixa').innerText, con: BLED112.connected } : null, 9000);
  ok(s && !s.con && /BIKES DESLIGADAS/.test(s.faixa), 'aparece a faixa "BIKES DESLIGADAS — clique…" (antes: nada, bikes apagadas em silêncio)', s);
  await espera(6000);
  s = await t.p.evaluate(() => ({ pedidos: window.__pedidos }));
  ok(s.pedidos <= 2, 'não fica insistindo sem clique (sem encher o console)', s);
  await t.p.keyboard.press('Enter');
  s = await ate(t.p, () => (BLED112.connected && _bled112LiveActive && !document.getElementById('prDongleFaixa')) ? { con: true, live: true, n: window.__escritas.length } : null, 8000);
  ok(s && s.con && s.live, 'uma tecla (ENTER) liga o dongle e o scan das bikes, e a faixa some', s);
  ok(t.erros.length === 0, 'nenhum erro de JavaScript', t.erros.slice(0, 3));
  await t.ctx.close();

  console.log('2) Programa abre e a porta JÁ foi autorizada antes');
  t = await abrir(true);
  s = await ate(t.p, () => (BLED112.connected && _bled112LiveActive) ? { con: true, faixa: !!document.getElementById('prDongleFaixa'), pedidos: window.__pedidos } : null, 9000);
  ok(s && s.con && !s.faixa && s.pedidos === 0, 'liga sozinho pelas portas autorizadas, sem clique e sem faixa', s);
  ok(t.cons.some(x => /dongle ligado sem clique/.test(x)), 'console registra "dongle ligado sem clique"');
  ok(t.erros.length === 0, 'nenhum erro de JavaScript', t.erros.slice(0, 3));
  await t.ctx.close();

  await nav.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
