// 03/10x — O SERVIDOR CAI NO MEIO DA AULA (reinício do Railway, deploy, travamento).
// Sobe um servidor só deste teste (porta 4011, mesmo banco de teste), abre a TV de verdade
// (Ginásio com o dongle simulado) e 3 celulares de verdade (app do aluno). No meio da aula
// MATA o servidor e sobe de novo. Confere: a aula continua na TV, os celulares voltam sozinhos
// para a mesma bike, os números voltam, ninguém é expulso da aula, e o resumo final é salvo.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const PORTA = 4011, B = 'http://127.0.0.1:' + PORTA, PROD = 'https://app.prorider.app.br', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste PULADO.'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
const { sql, codigoTv } = require('./comum');
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
const PAUSA = parseInt(process.env.QUEDA_SEG || '8', 10);   // quanto tempo o servidor fica fora
const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prorider-queda-')), 'servidor.log');
let srv = null;
async function subir() {
  const fd = fs.openSync(log, 'a');
  srv = spawn(process.execPath, [path.join(RAIZ, 'server.js')], { cwd: RAIZ, env: Object.assign({}, process.env, { PORT: String(PORTA), PORTAL_URL: B }), stdio: ['ignore', fd, fd] });
  for (let i = 0; i < 60; i++) { await espera(500); try { if ((await fetch(B + '/ping')).ok) return true; } catch (e) {} }
  return false;
}
const N = 3, NOMES = ['Marina Silva', 'Thiago Ferreira', 'Patricia Gomes'], FTP = b => 150 + b * 20;
const ate = async (pg, fn, arg, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await pg.evaluate(fn, arg); if (v) return v; } catch (e) {} await espera(300); } return null; };
(async () => {
  ok(await subir(), 'servidor próprio do teste no ar (porta ' + PORTA + ')');
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-queda', nome_computador: 'TV queda' })).d.token;
  await sql(`DELETE FROM users WHERE email LIKE 'queda%@x.test'`);
  const alunos = [];
  for (let b = 1; b <= N; b++) { const r = await j('POST', '/user/register', { email: `queda${b}@x.test`, nome: NOMES[b - 1], senha: '123456', ftp: FTP(b), aceite_termos: true, aceite_saude: true }, null, { 'X-Forwarded-For': '10.40.0.' + b }); alunos.push({ b, tok: r.d && r.d.token, nome: NOMES[b - 1] }); }
  ok(alunos.every(a => a.tok), '3 alunos com conta');

  const nav = await chromium.launch();
  const erros = [];
  const rotear = async pg => pg.route(/^https?:/, async r => { const u = r.request().url();
    if (u.startsWith(B)) return r.continue();
    if (u.startsWith(PROD)) { const q = r.request(); try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined }); return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
    if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });
    return r.abort(); });

  // ── TV ──
  const tv = await nav.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Sao_Paulo' });
  tv.on('pageerror', e => erros.push('TV: ' + e.message.slice(0, 160))); if (process.env.DBG) tv.on('console', m => console.log('   TV>', m.text().slice(0, 200)));
  await rotear(tv);
  await tv.addInitScript(([tk, prod, b, n]) => { try { localStorage.setItem('pr_display_token', tk);
      const m = {}; for (let i = 1; i <= n; i++) m[i] = { tipo: 'keiser', bled112: true, mac: 'AA:BB:CC:00:00:' + String(i).padStart(2, '0'), nome: 'M3i ' + i }; localStorage.setItem('prorider_bike_map', JSON.stringify(m)); localStorage.setItem('prorider_num_bikes', String(n)); } catch (e) {}
    const Wo = window.WebSocket; const Nw = function (u, x) { return new Wo(String(u).replace(prod.replace('https', 'wss'), b.replace('http', 'ws')), x); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [TK, PROD, B, N]);
  await tv.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(3000);
  await tv.evaluate(() => { BLED112.connected = true; BLED112.startScan = cb => { window.__dongle = cb; }; BLED112.stopScan = () => {}; try { _parCarregarSalvo(); } catch (e) {} _parIniciarLiveBLED112(); });
  const bomba = setInterval(() => { tv.evaluate(n => { if (!window.__dongle) return; for (let i = 1; i <= n; i++) window.__dongle({ mac: 'AA:BB:CC:00:00:' + String(i).padStart(2, '0'), watts: 150 + i * 20, cadence: 90, gear: 12, heartRate: 140 }); }, N).catch(() => {}); }, 320);
  await tv.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = []; for (let k = 0; k < 10; k++) workout.push({ intensity: ['z2', 'z3', 'z4'][k % 3], durationSec: 60, ftpMin: 70, ftpMax: 95, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' });
    try { _prNormWorkout(workout); } catch (e) {} segments = [{ id: 'main_1', name: 'Bloco Principal', type: 'main' }]; videoSource = 'none';
    document.getElementById('className').value = 'TESTE QUEDA'; mostrarPreAula({ nome: 'TESTE QUEDA' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  await espera(2500);
  const SALA = await tv.evaluate(() => salaCode);
  ok(/^PR-/.test(SALA || ''), 'TV abriu a sala', SALA);

  // ── 3 celulares de verdade ──
  const cel = [];
  for (const a of alunos) {
    const pg = await nav.newPage({ viewport: { width: 390, height: 844 } }); pg.a = a;
    pg.on('pageerror', e => erros.push('app ' + a.b + ': ' + e.message.slice(0, 160))); if (process.env.DBG) pg.on('console', m => { if (/ProRider/.test(m.text())) console.log('   app' + a.b + '>', m.text().slice(0, 200)); });
    await rotear(pg);
    await pg.addInitScript(([tok, ftp]) => { try { localStorage.setItem('pr_token', tok); localStorage.setItem('pr_ftp', String(ftp)); } catch (e) {} }, [a.tok, FTP(a.b)]);
    await pg.goto(B + '/aluno/'); await espera(1500);
    await pg.evaluate(c => connectQR(c), SALA);
    await ate(pg, () => document.querySelector('.screen.active') && document.querySelector('.screen.active').id === 'sBikeSel');
    await pg.evaluate(n => selectBike(n), a.b); cel.push(pg);
  }
  await espera(2500);
  ok((await tv.evaluate(() => Object.keys(alunosMap).filter(n => !alunosMap[n]._virtual).length)) === N, 'os 3 alunos aparecem na TV');

  await tv.keyboard.press('Enter');
  const emAula = pg => pg.evaluate(() => { const a = document.querySelector('.screen.active'); return a && a.id === 'sLive'; });
  for (const pg of cel) await ate(pg, () => { const a = document.querySelector('.screen.active'); return a && a.id === 'sLive'; });
  ok((await Promise.all(cel.map(emAula))).every(Boolean), 'aula começou nos 3 celulares');
  // o que o celular recebe da TV (bikes_live) — marca o último horário
  for (const pg of cel) await pg.evaluate(() => { const W = window.WebSocket.prototype; if (window.__liveMarcado) return; window.__liveMarcado = 1;
    const orig = Object.getOwnPropertyDescriptor(W, 'onmessage'); window.__ultLive = 0;
    setInterval(() => { try { if (wsConn && !wsConn.__esp) { wsConn.__esp = 1; wsConn.addEventListener('message', e => { try { const d = JSON.parse(e.data); if (d.tipo === 'bikes_live') { const x = (d.bikes || []).find(k => k.b === _bikeSelNum); if (x) window.__ultLive = { t: Date.now(), w: x.w, ftp: x.ftp }; } } catch (er) {} }); } } catch (er) {} }, 200); });
  await espera(8000);
  const antes = await Promise.all(cel.map(pg => pg.evaluate(() => window.__ultLive)));
  ok(antes.every((x, i) => x && x.w === 150 + (i + 1) * 20), 'antes da queda: cada celular recebe os watts da sua bike', antes.map(x => x && x.w));
  const tvSegAntes = await tv.evaluate(() => Math.round(_prSecTotal(workout.slice(0, currentBlockIndex)) + (isPlaying ? (performance.now() - blockStartTime) / 1000 : 0)));

  console.log(`  … derrubando o servidor por ${PAUSA} s (como um reinício do Railway)`);
  const tQueda = Date.now();
  srv.kill('SIGKILL'); await espera(PAUSA * 1000);
  ok(await subir(), 'servidor voltou');
  const tVolta = Date.now();

  // TV religa sozinha (3 → 6 → 12 s) e recria a sala
  const tvVoltou = await ate(tv, () => wsProf && wsProf.readyState === 1, null, 45000);
  ok(!!tvVoltou, 'TV religou sozinha ao servidor', Math.round((Date.now() - tVolta) / 1000) + ' s depois');
  // celulares voltam e continuam NA AULA (não podem ser expulsos com "aula encerrada")
  const voltou = [];
  for (const pg of cel) { const t = Date.now(); const r = await ate(pg, () => window.__ultLive && Date.now() - window.__ultLive.t < 1500, null, 60000); voltou.push(r ? Math.round((Date.now() - tVolta) / 1000) : null); }
  ok(voltou.every(x => x !== null), 'os 3 celulares voltaram a receber os números (segundos depois do servidor voltar)', voltou);
  ok((await Promise.all(cel.map(emAula))).every(Boolean), 'os 3 celulares continuam na tela da aula (ninguém foi expulso)', await Promise.all(cel.map(pg => pg.evaluate(() => document.querySelector('.screen.active') && document.querySelector('.screen.active').id))));
  const depois = await Promise.all(cel.map(pg => pg.evaluate(() => window.__ultLive)));
  ok(depois.every((x, i) => x && Date.now() - x.t < 3000 && x.w === 150 + (i + 1) * 20 && x.ftp === Math.round((150 + (i + 1) * 20) / FTPX(i + 1) * 100)), 'depois da queda: mesma bike, mesma intensidade', depois);
  function FTPX(b) { return FTP(b); }
  const tvAl = await tv.evaluate(() => Object.values(alunosMap).filter(a => !a._virtual).map(a => ({ n: a.nome, b: parseInt(a.bike), sem: !!a._semSala, base: a.ftpBase })));
  ok(tvAl.length === N && tvAl.every(a => !a.sem && a.base === FTP(a.b)), 'TV continua com os 3 alunos, cada um com seu FTP', tvAl);
  const tvSegDepois = await tv.evaluate(() => Math.round(_prSecTotal(workout.slice(0, currentBlockIndex)) + (isPlaying ? (performance.now() - blockStartTime) / 1000 : 0)));
  ok(tvSegAntes > 0 && tvSegDepois - tvSegAntes >= (Date.now() - tQueda) / 1000 - 3, 'o relógio da aula na TV não parou durante a queda', { antes: tvSegAntes, depois: tvSegDepois });
  const salaSrv = await new Promise(res => { const WS = require(require.resolve('ws', { paths: [RAIZ] })); const w = new WS(B.replace('http', 'ws')); w.on('open', () => w.send(JSON.stringify({ tipo: 'assinar_sala', codigo: SALA }))); w.on('message', m => { try { const d = JSON.parse(m); if (d.tipo === 'assinado') { w.close(); res(d); } } catch (e) {} }); setTimeout(() => { w.close(); res(null); }, 4000); });
  ok(!!salaSrv && salaSrv.tipo === 'assinado', 'servidor novo conhece a sala de novo');

  console.log('  … fim da aula');
  await tv.evaluate(() => ctrlConfirmYes());
  const fins = []; for (const pg of cel) fins.push(!!(await ate(pg, () => { const a = document.querySelector('.screen.active'); return a && a.id !== 'sLive'; }, null, 15000)));
  ok(fins.every(Boolean), 'fim da aula chegou nos 3 celulares', fins);
  let res = ''; for (let i = 0; i < 25 && res !== String(N); i++) { res = await sql(`SELECT n_alunos FROM aulas_tv WHERE license_id='D5448D47' AND sala='${SALA}'`); if (res !== String(N)) await espera(400); }
  ok(res === String(N), 'resumo da aula salvo com os 3 alunos, mesmo com a queda no meio', res);
  ok(erros.length === 0, 'nenhum erro de JavaScript na TV e nos celulares', erros.slice(0, 4));
  clearInterval(bomba); await nav.close(); srv.kill('SIGKILL');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); try { srv && srv.kill('SIGKILL'); } catch (x) {} process.exit(1); });
