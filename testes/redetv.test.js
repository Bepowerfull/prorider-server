// 03/10y — A INTERNET DA ACADEMIA CAI NO MEIO DA AULA (a TV fica sem servidor; os celulares no 4G seguem).
// TV de verdade atrás de uma "rede de mentira" + 3 celulares de verdade direto no servidor.
//   1) a internet da TV some sem aviso por 60 s     2) some por 4 min (passa dos 3 min de carência da sala)
//   3) a aula termina com a TV sem internet: o resumo fica guardado e vai quando a internet volta.
// Confere: a aula continua na TV (relógio e watts do dongle), os celulares não são expulsos e são
// avisados, tudo volta sozinho, e o resumo chega com os 3 alunos.
const fs = require('fs'), path = require('path');
const B = 'http://127.0.0.1:3999', PROD = 'https://app.prorider.app.br', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste PULADO.'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
const { sql, codigoTv } = require('./comum');
const { rede } = require('./rede');
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
const N = 3, NOMES = ['Lia Moraes', 'Caio Duarte', 'Bia Teles'], FTP = b => 170 + b * 15;
let fase = 0; const W = b => 150 + b * 20 + fase * 25;
const ate = async (pg, fn, arg, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await pg.evaluate(fn, arg); if (v) return v; } catch (e) {} await espera(250); } return null; };
const SUMIR2 = parseInt(process.env.REDETV_LONGO_S || '240', 10);
(async () => {
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-redetv', nome_computador: 'TV rede' })).d.token;
  await sql(`DELETE FROM users WHERE email LIKE 'redetv%@x.test'`);
  const alunos = [];
  for (let b = 1; b <= N; b++) { const r = await j('POST', '/user/register', { email: `redetv${b}@x.test`, nome: NOMES[b - 1], senha: '123456', ftp: FTP(b), aceite_termos: true, aceite_saude: true }, null, { 'X-Forwarded-For': '10.60.0.' + b }); alunos.push({ b, tok: r.d && r.d.token }); }
  const net = await rede(3999), TVB = 'http://127.0.0.1:' + net.porta;   // a internet da academia
  const nav = await chromium.launch(); const erros = [];
  const tv = await nav.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Sao_Paulo' });
  tv.on('pageerror', e => erros.push('TV: ' + e.message.slice(0, 160))); if (process.env.DBG) tv.on('console', m => { if (/ProRider\]/.test(m.text())) console.log('   TV>', m.text().slice(0, 160)); });
  let semNet = false;
  await tv.route(/^https?:/, async r => { const u = r.request().url();
    if (u.startsWith(PROD)) { if (semNet) return r.abort('internetdisconnected'); const q = r.request(); try { const resp = await fetch(TVB + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined }); return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
    if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });
    return r.abort(); });
  await tv.addInitScript(([tk, prod, b, n]) => { try { localStorage.setItem('pr_display_token', tk);
      const m = {}; for (let i = 1; i <= n; i++) m[i] = { tipo: 'keiser', bled112: true, mac: 'AA:BB:CC:00:02:' + String(i).padStart(2, '0'), nome: 'M3i ' + i }; localStorage.setItem('prorider_bike_map', JSON.stringify(m)); localStorage.setItem('prorider_num_bikes', String(n)); } catch (e) {}
    const Wo = window.WebSocket; const Nw = function (u, x) { return new Wo(String(u).replace(prod.replace('https', 'wss'), b.replace('http', 'ws')), x); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [TK, PROD, TVB, N]);
  await tv.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(3000);
  await tv.evaluate(() => { BLED112.connected = true; BLED112.startScan = cb => { window.__dongle = cb; }; BLED112.stopScan = () => {}; try { _parCarregarSalvo(); } catch (e) {} _parIniciarLiveBLED112(); });
  const bomba = setInterval(() => { tv.evaluate(([n, ws]) => { if (!window.__dongle) return; for (let i = 1; i <= n; i++) window.__dongle({ mac: 'AA:BB:CC:00:02:' + String(i).padStart(2, '0'), watts: ws[i - 1], cadence: 90, gear: 12, heartRate: 140 }); }, [N, [1, 2, 3].map(W)]).catch(() => {}); }, 320);
  await tv.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = []; for (let k = 0; k < 30; k++) workout.push({ intensity: ['z2', 'z3', 'z4'][k % 3], durationSec: 60, ftpMin: 70, ftpMax: 95, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' });
    try { _prNormWorkout(workout); } catch (e) {} segments = [{ id: 'main_1', name: 'Bloco Principal', type: 'main' }]; videoSource = 'none';
    document.getElementById('className').value = 'TESTE INTERNET DA TV'; mostrarPreAula({ nome: 'TESTE INTERNET DA TV' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  await espera(2500);
  const SALA = await tv.evaluate(() => salaCode);
  const cel = [];
  for (const a of alunos) {
    const pg = await nav.newPage({ viewport: { width: 390, height: 844 } }); pg.a = a;
    pg.on('pageerror', e => erros.push('app ' + a.b + ': ' + e.message.slice(0, 160)));
    await pg.route(/^https?:/, rr => rr.request().url().startsWith(B) ? rr.continue() : rr.abort());
    await pg.addInitScript(([tok, ftp]) => { try { localStorage.setItem('pr_token', tok); localStorage.setItem('pr_ftp', String(ftp)); } catch (e) {}
      window.__ult = null; window.__msgs = []; const Wo = window.WebSocket;
      const Nw = function (u, x) { const w = new Wo(u, x); w.addEventListener('message', e => { try { const d = JSON.parse(e.data); if (/^tv_|sala_encerrada|fim_aula/.test(d.tipo)) window.__msgs.push(d.tipo); if (d.tipo === 'bikes_live' && typeof _bikeSelNum !== 'undefined') { const k = (d.bikes || []).find(q => q.b === _bikeSelNum); if (k) window.__ult = { t: Date.now(), w: k.w, ftp: k.ftp }; } } catch (er) {} }); return w; };
      Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [a.tok, FTP(a.b)]);
    await pg.goto(B + '/aluno/'); await espera(1200);
    await pg.evaluate(c => connectQR(c), SALA);
    await ate(pg, () => document.querySelector('.screen.active') && document.querySelector('.screen.active').id === 'sBikeSel');
    await pg.evaluate(n => selectBike(n), a.b); cel.push(pg);
  }
  await espera(2500);
  await tv.keyboard.press('Enter');
  const emAula = pg => pg.evaluate(() => { const a = document.querySelector('.screen.active'); return !!a && a.id === 'sLive'; }).catch(() => false);
  for (const pg of cel) await ate(pg, () => { const a = document.querySelector('.screen.active'); return a && a.id === 'sLive'; }, null, 30000);
  ok((await Promise.all(cel.map(emAula))).every(Boolean), 'aula começou nos 3 celulares');
  await espera(5000);
  const certo = async () => (await Promise.all(cel.map(pg => pg.evaluate(() => window.__ult)))).map((x, i) => !!x && Date.now() - x.t < 3000 && x.w === W(i + 1) && x.ftp === Math.round(W(i + 1) / FTP(i + 1) * 100));
  ok((await certo()).every(Boolean), 'antes: os 3 com a intensidade certa', await certo());
  const relogio = () => tv.evaluate(() => Math.round(_prSecTotal(workout.slice(0, currentBlockIndex)) + (isPlaying ? (performance.now() - blockStartTime) / 1000 : 0)));
  const aviso = pg => pg.evaluate(() => { const e = document.getElementById('prTvAviso'); return !!(e && getComputedStyle(e).display !== 'none'); });
  const voltaram = async ms => { const t = Date.now(); const r = await Promise.all(cel.map(pg => ate(pg, () => window.__ult && Date.now() - window.__ult.t < 1500, null, ms))); return r.every(Boolean) ? Math.round((Date.now() - t) / 1000) : null; };

  async function queda(seg, rotulo) {
    console.log(`  … ${rotulo}: a internet da academia some sem aviso por ${seg} s`);
    const r0 = await relogio(); semNet = true; net.sumir(); const t0 = Date.now();
    await espera(Math.min(seg, 32) * 1000); fase++;                       // no meio da queda os alunos aceleram
    const avisados = await Promise.all(cel.map(aviso));
    await espera(Math.max(0, seg * 1000 - (Date.now() - t0)));
    const tvW = await tv.evaluate(() => Object.values(alunosMap).filter(a => !a._virtual).map(a => ({ b: parseInt(a.bike), w: a.watts, f: a.ftp })));
    const r1 = await relogio(), naAula = await Promise.all(cel.map(emAula));
    ok(r1 - r0 >= seg - 3, rotulo + ': a aula continuou na TV (relógio andou)', { antes: r0, depois: r1 });
    ok(tvW.length === N && tvW.every(a => a.w === W(a.b) && a.f === Math.round(W(a.b) / FTP(a.b) * 100)), rotulo + ': TV seguiu com os watts do dongle e o %FTP de cada um', tvW);
    ok(naAula.every(Boolean), rotulo + ': nenhum celular foi expulso da aula', naAula);
    ok(avisados.every(Boolean), rotulo + ': celulares avisam "TV sem internet"', avisados);
    semNet = false; net.voltar();
    const s = await voltaram(90000);
    ok(s !== null, rotulo + ': números voltaram aos 3 celulares (segundos depois da internet voltar)', s);
    ok((await certo()).every(Boolean), rotulo + ': intensidade certa de novo', await certo());
    ok(!(await Promise.all(cel.map(aviso))).some(Boolean), rotulo + ': aviso some sozinho');
    const tvAl = await tv.evaluate(() => Object.values(alunosMap).filter(a => !a._virtual).map(a => ({ n: a.nome, sem: !!a._semSala })));
    ok(tvAl.length === N && tvAl.every(a => !a.sem), rotulo + ': TV com os 3 alunos ligados de novo', tvAl);
  }
  await queda(60, 'queda curta');
  await queda(SUMIR2, 'queda longa');

  console.log('  … a aula termina com a TV sem internet');
  semNet = true; net.sumir(); await espera(3000);
  await tv.evaluate(() => ctrlConfirmYes()); await espera(4000);
  const guardado = await tv.evaluate(() => { try { return JSON.parse(localStorage.getItem('pr_fila') || '[]').length; } catch (e) { return -1; } });
  semNet = false; net.voltar();
  const fins = await Promise.all(cel.map(pg => ate(pg, () => { const a = document.querySelector('.screen.active'); return a && a.id !== 'sLive'; }, null, 60000)));
  ok(fins.every(Boolean), 'fim da aula chegou nos 3 celulares quando a internet voltou', fins.map(Boolean));
  let res = ''; for (let i = 0; i < 150 && res !== String(N); i++) { res = await sql(`SELECT n_alunos FROM aulas_tv WHERE license_id='D5448D47' AND sala='${SALA}'`); if (res !== String(N)) await espera(1000); }
  ok(res === String(N), 'resumo guardado na TV chegou ao servidor com os 3 alunos', { n: res, fila_na_tv: guardado });
  ok(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 4));
  clearInterval(bomba); net.fechar(); await nav.close();
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
