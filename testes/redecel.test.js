// 03/10y — INTERNET RUIM NO CELULAR DO ALUNO (Wi-Fi da academia cheio, 3G, sinal caindo).
// TV de verdade (dongle simulado, rede boa) + 3 celulares de verdade, cada um atrás de uma "rede de mentira":
//   aluno 1: 3G (300–600 ms)      aluno 2: rede péssima (1–1,5 s)      aluno 3: começa bom e sofre:
//   engasgos de 6 s, internet some sem aviso por 20 s e por 70 s, e queda com aviso.
// Confere: números certos, quanto atrasa, ninguém sai da aula, todos voltam sozinhos, resumo com os 3.
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
const N = 3, NOMES = ['Joana Prado', 'Paulo Vieira', 'Sofia Ramos'], FTP = b => 160 + b * 20;
let fase = 0; const W = b => 140 + b * 25 + fase * 30;
const ate = async (pg, fn, arg, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await pg.evaluate(fn, arg); if (v) return v; } catch (e) {} await espera(250); } return null; };
(async () => {
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-redecel', nome_computador: 'TV rede cel' })).d.token;
  await sql(`DELETE FROM users WHERE email LIKE 'redecel%@x.test'`);
  const alunos = [];
  for (let b = 1; b <= N; b++) { const r = await j('POST', '/user/register', { email: `redecel${b}@x.test`, nome: NOMES[b - 1], senha: '123456', ftp: FTP(b), aceite_termos: true, aceite_saude: true }, null, { 'X-Forwarded-For': '10.50.0.' + b }); alunos.push({ b, tok: r.d && r.d.token }); }
  const nav = await chromium.launch(); const erros = [];
  // ── TV (rede boa) ──
  const tv = await nav.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Sao_Paulo' });
  tv.on('pageerror', e => erros.push('TV: ' + e.message.slice(0, 160)));
  await tv.route(/^https?:/, async r => { const u = r.request().url();
    if (u.startsWith(PROD)) { const q = r.request(); try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined }); return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
    if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });
    return r.abort(); });
  await tv.addInitScript(([tk, prod, b, n]) => { try { localStorage.setItem('pr_display_token', tk);
      const m = {}; for (let i = 1; i <= n; i++) m[i] = { tipo: 'keiser', bled112: true, mac: 'AA:BB:CC:00:01:' + String(i).padStart(2, '0'), nome: 'M3i ' + i }; localStorage.setItem('prorider_bike_map', JSON.stringify(m)); localStorage.setItem('prorider_num_bikes', String(n)); } catch (e) {}
    const Wo = window.WebSocket; const Nw = function (u, x) { return new Wo(String(u).replace(prod.replace('https', 'wss'), b.replace('http', 'ws')), x); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [TK, PROD, B, N]);
  await tv.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(3000);
  await tv.evaluate(() => { BLED112.connected = true; BLED112.startScan = cb => { window.__dongle = cb; }; BLED112.stopScan = () => {}; try { _parCarregarSalvo(); } catch (e) {} _parIniciarLiveBLED112(); });
  const bomba = setInterval(() => { tv.evaluate(([n, ws]) => { if (!window.__dongle) return; for (let i = 1; i <= n; i++) window.__dongle({ mac: 'AA:BB:CC:00:01:' + String(i).padStart(2, '0'), watts: ws[i - 1], cadence: 90, gear: 12, heartRate: 140 }); }, [N, [1, 2, 3].map(W)]).catch(() => {}); }, 320);
  await tv.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = []; for (let k = 0; k < 20; k++) workout.push({ intensity: ['z2', 'z3', 'z4'][k % 3], durationSec: 60, ftpMin: 70, ftpMax: 95, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' });
    try { _prNormWorkout(workout); } catch (e) {} segments = [{ id: 'main_1', name: 'Bloco Principal', type: 'main' }]; videoSource = 'none';
    document.getElementById('className').value = 'TESTE REDE CELULAR'; mostrarPreAula({ nome: 'TESTE REDE CELULAR' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  await espera(2500);
  const SALA = await tv.evaluate(() => salaCode);

  // ── 3 celulares, cada um na sua rede ──
  const cel = [];
  for (const a of alunos) {
    const r = await rede(3999); const O = 'http://127.0.0.1:' + r.porta;
    const pg = await nav.newPage({ viewport: { width: 390, height: 844 } }); pg.a = a; pg.r = r;
    pg.on('pageerror', e => erros.push('app ' + a.b + ': ' + e.message.slice(0, 160)));
    await pg.route(/^https?:/, rr => rr.request().url().startsWith(O) ? rr.continue() : rr.abort());
    await pg.addInitScript(([tok, ftp]) => { try { localStorage.setItem('pr_token', tok); localStorage.setItem('pr_ftp', String(ftp)); } catch (e) {}
      window.__ult = null; const Wo = window.WebSocket;
      const Nw = function (u, x) { const w = new Wo(u, x); w.addEventListener('message', e => { try { const d = JSON.parse(e.data); if (d.tipo === 'bikes_live' && typeof _bikeSelNum !== 'undefined') { const k = (d.bikes || []).find(q => q.b === _bikeSelNum); if (k) window.__ult = { t: Date.now(), w: k.w, ftp: k.ftp }; } } catch (er) {} }); return w; };
      Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [a.tok, FTP(a.b)]);
    await pg.goto(O + '/aluno/'); await espera(1200);
    await pg.evaluate(c => connectQR(c), SALA);
    await ate(pg, () => document.querySelector('.screen.active') && document.querySelector('.screen.active').id === 'sBikeSel');
    await pg.evaluate(n => selectBike(n), a.b); cel.push(pg);
  }
  await espera(2500);
  cel[0].r.lenta(300, 300); cel[1].r.lenta(1000, 500);   // 3G e rede péssima a partir daqui
  await tv.keyboard.press('Enter');
  const emAula = pg => pg.evaluate(() => { const a = document.querySelector('.screen.active'); return !!a && a.id === 'sLive'; }).catch(() => false);
  for (const pg of cel) await ate(pg, () => { const a = document.querySelector('.screen.active'); return a && a.id === 'sLive'; }, null, 30000);
  ok((await Promise.all(cel.map(emAula))).every(Boolean), 'aula começou nos 3 celulares (até no de rede péssima)');
  await espera(6000);
  const certo = async () => (await Promise.all(cel.map(pg => pg.evaluate(() => window.__ult)))).map((x, i) => x && Date.now() - x.t < 4000 && x.w === W(i + 1) && x.ftp === Math.round(W(i + 1) / FTP(i + 1) * 100));
  ok((await certo()).every(Boolean), 'os 3 recebem a intensidade certa da sua bike (3G e rede péssima também)', await certo());

  console.log('  … todo mundo sobe 30 W: quanto cada celular demora para ver');
  const tDeg = Date.now(); fase = 1; const atraso = [];
  await Promise.all(cel.map(async (pg, i) => { const v = await ate(pg, w => window.__ult && window.__ult.w === w ? window.__ult.t : 0, W(i + 1), 10000); atraso[i] = v ? v - tDeg : null; }));
  console.log('     atraso até o celular: normal ' + atraso[2] + ' ms · 3G ' + atraso[0] + ' ms · péssima ' + atraso[1] + ' ms');
  ok(atraso[0] !== null && atraso[0] < 2000, '3G: número novo em menos de 2 s', atraso[0]);
  ok(atraso[1] !== null && atraso[1] < 3500, 'rede péssima: número novo em menos de 3,5 s', atraso[1]);

  const p3 = cel[2], volta = async (rotulo, ms = 60000) => { const t = Date.now(); const v = await ate(p3, () => window.__ult && Date.now() - window.__ult.t < 1500, null, ms); return v ? Math.round((Date.now() - t) / 100) / 10 : null; };
  console.log('  … aluno 3: Wi-Fi engasga 6 s, duas vezes');
  p3.r.travar(6000); await espera(7000); let s1 = await volta(); p3.r.travar(6000); await espera(7000); let s2 = await volta();
  ok(s1 !== null && s2 !== null && await emAula(p3), 'engasgos de 6 s: continua na aula e os números voltam na hora', [s1, s2]);
  console.log('  … aluno 3: a internet some sem aviso por 20 s');
  p3.r.sumir(); await espera(20000); p3.r.voltar(); let s3 = await volta();
  ok(s3 !== null && s3 < 15 && await emAula(p3), 'sumiu 20 s: voltou sozinho e continua na aula (segundos até os números voltarem)', s3);
  console.log('  … aluno 3: a internet some sem aviso por 70 s (o servidor já desistiu da conexão)');
  p3.r.sumir(); await espera(70000);
  const tela70 = await p3.evaluate(() => ({ tela: (document.querySelector('.screen.active') || {}).id, aviso: (document.getElementById('reconOverlay') || {}).style ? document.getElementById('reconOverlay').style.display : '' }));
  p3.r.voltar(); let s4 = await volta('70s', 45000);
  ok(s4 !== null && await emAula(p3), 'sumiu 70 s: voltou sozinho e continua na aula (segundos até os números voltarem)', { volta_s: s4, durante: tela70 });
  const tvSem = await tv.evaluate(n => { const a = alunosMap[n]; return a ? { sem: !!a._semSala, b: parseInt(a.bike), base: a.ftpBase } : null; }, NOMES[2]);
  ok(tvSem && tvSem.b === 3 && tvSem.base === FTP(3), 'na TV o aluno 3 continua na bike 3 com o FTP dele', tvSem);
  console.log('  … aluno 2 (rede péssima): queda com aviso por 10 s');
  cel[1].r.cortar(); await espera(10000); cel[1].r.voltar();
  const v2 = await ate(cel[1], () => window.__ult && Date.now() - window.__ult.t < 3000, null, 60000);
  ok(!!v2 && await emAula(cel[1]), 'aluno 2 voltou depois da queda com aviso, ainda na aula');
  ok((await certo()).every(Boolean), 'no fim, os 3 de novo com a intensidade certa', await certo());

  console.log('  … fim da aula');
  await tv.evaluate(() => ctrlConfirmYes());
  const fins = []; for (const pg of cel) fins.push(!!(await ate(pg, () => { const a = document.querySelector('.screen.active'); return a && a.id !== 'sLive'; }, null, 20000)));
  ok(fins.every(Boolean), 'fim da aula chegou nos 3 (até no de rede péssima)', fins);
  let res = ''; for (let i = 0; i < 25 && res !== String(N); i++) { res = await sql(`SELECT n_alunos FROM aulas_tv WHERE license_id='D5448D47' AND sala='${SALA}'`); if (res !== String(N)) await espera(400); }
  ok(res === String(N), 'resumo da aula com os 3 alunos (ninguém a mais por ter caído)', res === String(N) ? res : [res, await sql(`SELECT detalhe::text FROM aulas_tv WHERE license_id='D5448D47' AND sala='${SALA}'`)]);
  ok(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 4));
  clearInterval(bomba); cel.forEach(pg => pg.r.fechar()); await nav.close();
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
