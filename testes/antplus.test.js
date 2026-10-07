// 07/10b — PENDRIVE ANT+ NA TV. Bikes que só falam ANT+ (Schwinn Echelon2, Spinner Blade ION, ICG TFT 1.0…)
// lidas pela TV ao mesmo tempo, como a Keiser no BLED112. O Ginásio de verdade roda com um pendrive
// ANT+ de mentira que responde no protocolo ANT (A4 <tam> <id> <dados> <xor>) e transmite:
//   bike FE-C nº 12345 (230 W, 85 rpm) · medidor de potência nº 5678 (180 W, 90 rpm) ·
//   sensor de cadência nº 777 · cinta de FC nº 999 (não pode aparecer como bike) · um pacote estragado.
// Confere: comandos de preparo do pendrive, lista do pareamento, cartões com watts/rpm/%FTP,
// aluno de verdade com o FTP dele, repasse ao celular, e religar sozinho depois de reabrir a TV.
const path = require('path');
const B = 'http://127.0.0.1:3999', PROD = 'https://app.prorider.app.br', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste PULADO.'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const { codigoTv } = require('./comum');
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const ate = async (pg, fn, arg, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await pg.evaluate(fn, arg); if (v) return v; } catch (e) {} await espera(200); } return null; };
(async () => {
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-ant', nome_computador: 'TV ANT' })).d.token;
  const nav = await chromium.launch(); const erros = [];
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1080 } });
  const abrir = async (mapaSalvo) => {
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message.slice(0, 160)));
    await p.route(/^https?:/, async r => { const u = r.request().url();
      if (u.startsWith(PROD)) { const q = r.request(); try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined }); return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
      if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
      if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });
      return r.abort(); });
    await p.addInitScript(([tk, mapa]) => {
      try { localStorage.setItem('pr_display_token', tk); if (mapa) localStorage.setItem('prorider_bike_map', mapa); } catch (e) {}
      const Wo = window.WebSocket; const Nw = function (u, x) { return new Wo(String(u).replace('wss://app.prorider.app.br', 'ws://127.0.0.1:3999'), x); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw;
      // ── pendrive ANT+ de mentira ──
      const msg = (id, d) => { const m = [0xA4, d.length, id, ...d]; let x = 0; m.forEach(b => x ^= b); m.push(x); return m; };
      const quadro = (num, tipo, p) => msg(0x4E, [0, ...p, 0xC0, num & 255, num >> 8, tipo, 0x05, 0x20, (256 - 62) & 255, 0]);
      let ouvinte = null, timer = null, t = 0, n = 0;
      const fake = window.__antFake = { tipo: 'teste', enviados: [], conexoes: 0,
        enviar(m) { const a = Array.from(m); fake.enviados.push(a);
          if (a[2] === 0x5B && !timer) timer = setInterval(() => { if (!ouvinte) return; t += 256; n += 1;
            const w = window.__antW || { fec: 230, pw: 180 };
            const fr = [ quadro(12345, 0x11, [0x19, 1, 85, 0, 0, w.fec & 255, (w.fec >> 8) & 0x0F, 0x20]),
              quadro(12345, 0x11, [0x10, 0x19, 0, 0, 0, 0, 0xFF, 0x24]),
              quadro(5678, 0x0B, [0x10, 1, 0xFF, 90, 0, 0, w.pw & 255, w.pw >> 8]),
              quadro(777, 0x7A, [0, 0, 0, 0, t & 255, (t >> 8) & 255, n & 255, n >> 8]),
              quadro(999, 0x78, [0, 0, 0, 0, 0, 0, 0, 140]) ];
            const ruim = quadro(4242, 0x11, [0x19, 1, 99, 0, 0, 0xE7, 0x03, 0x20]); ruim[ruim.length - 1] ^= 0xFF;   // checksum errado
            ouvinte(new Uint8Array([].concat(...fr, ruim))); }, 250);
          return Promise.resolve(); },
        aoReceber(f) { ouvinte = f; fake.conexoes++; }, aoCair() {}, fechar() { clearInterval(timer); timer = null; } };
      Object.defineProperty(window, 'ANTPLUS', { configurable: true, set(v) { v._transporteTeste = fake; Object.defineProperty(window, 'ANTPLUS', { value: v, writable: true, configurable: true }); }, get() { return undefined; } });
    }, [TK, mapaSalvo || null]);
    await p.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(3000);
    return p;
  };
  let p = await abrir();
  ok(await p.evaluate(() => typeof ANTPLUS === 'object' && !!ANTPLUS._transporteTeste), 'leitor ANT+ carregado na TV');
  const pg = await p.evaluate(() => ({ fec: ANTPLUS._lerPagina(0x11, 1, [0x19, 1, 85, 0, 0, 0xE6, 0x00, 0x20]), pw: ANTPLUS._lerPagina(0x0B, 2, [0x10, 1, 0xFF, 0xFF, 0, 0, 0x2C, 0x01]), hr: ANTPLUS._lerPagina(0x78, 3, [0, 0, 0, 0, 0, 0, 0, 150]), bike: ANTPLUS._lerPagina(0x11, 1, [0x15, 0, 0, 0, 77, 0x10, 0x01, 0]) }));
  ok(pg.fec.watts === 230 && pg.fec.cadence === 85 && pg.pw.watts === 300 && pg.pw.cadence === 0 && pg.hr.heartRate === 150 && pg.bike.watts === 272 && pg.bike.cadence === 77, 'páginas ANT+ lidas: FE-C 0x19 e 0x15, potência 0x10 (sem cadência = 0), FC', pg);

  console.log('1) Pareamento pelo pendrive ANT+');
  await p.evaluate(() => { try { localStorage.removeItem('prorider_bike_map'); } catch (e) {} parBikeMap = {}; abrirPareamento(); parSetTipo('ant'); _parScanBike(1); });
  await ate(p, () => document.querySelectorAll('.bled112Item').length >= 3, null, 10000);
  const cmds = await p.evaluate(() => __antFake.enviados.map(a => a[2].toString(16)));
  ok(cmds.slice(0, 7).join(',') === '4a,46,42,51,45,6e,5b', 'pendrive preparado: reset, chave ANT+, canal, qualquer aparelho, 2457 MHz, nº+sinal, escuta contínua', cmds);
  const chave = await p.evaluate(() => __antFake.enviados[1].slice(4, 12).map(b => b.toString(16)).join(' '));
  const somas = await p.evaluate(() => __antFake.enviados.every(a => a.slice(0, -1).reduce((x, b) => x ^ b, 0) === a[a.length - 1]));
  ok(chave === 'b9 a5 21 fb bd 72 c3 45' && somas, 'chave da rede ANT+ e conferência (XOR) de todos os comandos', chave);
  const lista = await p.evaluate(() => [...document.querySelectorAll('.bled112Item')].map(e => e.innerText.replace(/\n/g, ' ')));
  ok(lista.some(x => /FE-C 12345.*230 W.*85 rpm/.test(x)) && lista.some(x => /Potência 5678/.test(x)) && lista.some(x => /Cadência 777/.test(x)), 'lista mostra as bikes ANT+ com watts e rpm (gire o pedal da sua)', lista);
  ok(!lista.some(x => /FC 999/.test(x)) && !lista.some(x => /4242/.test(x)), 'cinta de FC não aparece como bike; pacote estragado é descartado');
  ok(await p.evaluate(() => /ANT\+ — Bike 1/.test(document.getElementById('bled112DevList').innerText)), 'janela da lista diz "ANT+ — Bike 1"');
  await p.evaluate(() => _parSelecionarBLED112(1, 'ANT:12345:17')); await espera(1200);
  await p.evaluate(() => _parScanBike(2)); await ate(p, () => document.querySelectorAll('.bled112Item').length >= 2, null, 8000);
  await p.evaluate(() => _parSelecionarBLED112(2, 'ANT:5678:11')); await espera(1200);
  const mapa = await p.evaluate(() => ({ 1: parBikeMap[1] && { mac: parBikeMap[1].mac, ant: parBikeMap[1].ant, d: parBikeMap[1].bled112 }, 2: parBikeMap[2] && parBikeMap[2].mac }));
  ok(mapa[1] && mapa[1].mac === 'ANT:12345:17' && mapa[1].ant && mapa[1].d && mapa[2] === 'ANT:5678:11', 'bike 1 = FE-C 12345, bike 2 = potência 5678 (guardado)', mapa);
  await p.evaluate(() => { try { fecharPareamento(); } catch (e) {} });

  console.log('2) Aula: cartões e aluno com o FTP dele');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = [{ intensity: 'z3', durationSec: 300, ftpMin: 76, ftpMax: 90, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' }];
    try { _prNormWorkout(workout); } catch (e) {} segments = [{ id: 'main_1', name: 'Bloco Principal', type: 'main' }]; videoSource = 'none';
    document.getElementById('className').value = 'ANT'; mostrarPreAula({ nome: 'ANT' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  await espera(2500);
  let v = await ate(p, () => { const a = alunosMap['Aluno 01'], b = alunosMap['Aluno 02']; return a && b && a.watts === 230 && b.watts === 180 ? { a: [a.watts, a.rpm, a.ftp], b: [b.watts, b.rpm, b.ftp] } : null; });
  ok(!!v && v.a[1] === 85 && v.b[1] === 90 && v.a[2] === 153, 'TV mostra bike 1 (230 W, 85 rpm, 153% com o padrão 150) e bike 2 (180 W, 90 rpm)', v);
  const SALA = await p.evaluate(() => salaCode);
  const cel = new WS(B.replace('http', 'ws')); let ult = null; cel.on('message', m => { try { const d = JSON.parse(m); if (d.tipo === 'bikes_live') { const x = (d.bikes || []).find(k => k.b === 1); if (x) ult = x; } } catch (e) {} });
  await new Promise(o => cel.on('open', o));
  cel.send(JSON.stringify({ tipo: 'entrar_sala', codigo: SALA, nome: 'Rita Lopes', bike: 1, ftpBase: 200 }));
  v = await ate(p, () => { const a = alunosMap['Rita Lopes']; return a && a.watts === 230 ? [a.watts, a.ftp, a.ftpBase] : null; });
  ok(!!v && v[1] === 115, 'aluna de verdade na bike 1: 230 W = 115% do FTP 200 dela', v);
  await p.evaluate(() => { window.__antW = { fec: 260, pw: 180 }; }); await espera(1500);
  ok(ult && ult.w === 260 && ult.ftp === 130, 'celular dela recebe a intensidade certa da bike ANT+ (260 W, 130%)', ult);

  console.log('3) TV reabre: liga o pendrive sozinha');
  // o que a TV guardou (no programa da TV o localStorage fica no disco; aqui é entregue à página nova)
  const mapaJson = await p.evaluate(() => localStorage.getItem('prorider_bike_map')), salvo = Object.keys(JSON.parse(mapaJson || '{}'));
  cel.close(); await p.close(); p = await abrir(mapaJson);
  v = await ate(p, () => { const a = Object.values(alunosMap).find(x => parseInt(x.bike) === 1); return a && a.watts > 0 ? [a.nome, a.watts] : null; }, null, 12000);
  ok(!!v, 'depois de reabrir, as bikes ANT+ pareadas voltam a mostrar watts sem pedir nada', v || await p.evaluate(s0 => ({ salvoAntes: s0, agora: Object.keys(JSON.parse(localStorage.getItem('prorider_bike_map') || '{}')), con: ANTPLUS.connected, env: __antFake.enviados.map(a => a[2].toString(16)), mapa: Object.keys(parBikeMap), al: Object.keys(alunosMap) }), salvo));
  ok(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 3));
  await nav.close();
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
