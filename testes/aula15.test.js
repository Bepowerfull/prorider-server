// 03/10x — ENSAIO DA AULA DE 17/10: 15 bikes Keiser no dongle da TV + 15 celulares pelo servidor.
// Cada aluno entra com o FTP dele; a TV junta o watt do dongle com o FTP do celular e devolve a
// intensidade certa (%FTP e zona) para o celular de cada um. Mede o atraso e o esforço da TV.
const fs = require('fs'), path = require('path'), os = require('os');
const B = 'http://127.0.0.1:3999', PROD = 'https://app.prorider.app.br', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: ensaio PULADO.\n    Instale uma vez: npm i -D playwright && npx playwright install chromium'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const { sql, codigoTv } = require('./comum');
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const N = 15, SEG = parseInt(process.env.ENSAIO_SEG || '45', 10);
const NOMES = ['Marina Silva', 'Thiago Ferreira', 'Patricia Gomes', 'Ricardo Borges', 'Larissa Dias', 'Felipe Araujo', 'Camila Torres', 'Bruno Castro', 'Ana Paula', 'Diego Santos', 'Rafael Nunes', 'Carla Mendes', 'Lucas Pereira', 'Fernanda Lima', 'Gustavo Reis'];
const FTP = b => 140 + b * 10;            // FTP de cada aluno: 150 … 290
const W = (b, fase) => 120 + b * 8 + (fase ? 40 : 0);   // watts de cada bike (a "fase" sobe todo mundo 40 W)
const zona = p => p <= 55 ? 'z1' : p <= 75 ? 'z2' : p <= 90 ? 'z3' : p <= 105 ? 'z4' : p <= 120 ? 'z5' : p <= 150 ? 'z6' : 'z7';
(async () => {
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-ensaio-17', nome_computador: 'TV ensaio' })).d.token;
  await sql(`DELETE FROM users WHERE email LIKE 'ensaio%@x.test'`);
  const alunos = [];
  for (let b = 1; b <= N; b++) { const r = await j('POST', '/user/register', { email: `ensaio${b}@x.test`, nome: NOMES[b - 1], senha: '123456', ftp: FTP(b), aceite_termos: true, aceite_saude: true }, null, { 'X-Forwarded-For': '10.17.0.' + b }); alunos.push({ b, tok: r.d && r.d.token, nome: NOMES[b - 1] }); }
  ok(alunos.every(a => a.tok), '15 alunos com conta');

  const nav = await chromium.launch(); const p = await nav.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Sao_Paulo' });
  const erros = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160))); if (process.env.DBG) p.on('console', m => { if (/aluno|sala|conect|erro/i.test(m.text())) console.log('TV:', m.text().slice(0, 160)); });
  await p.route(/^https?:/, async r => { const u = r.request().url();
    if (u.startsWith(PROD)) { const q = r.request(); try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined }); return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
    if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });
    return r.abort(); });
  await p.addInitScript(([tk, prod, b, n]) => { try { localStorage.setItem('pr_display_token', tk);
      const m = {}; for (let i = 1; i <= n; i++) m[i] = { tipo: 'keiser', bled112: true, mac: 'AA:BB:CC:00:00:' + String(i).padStart(2, '0'), nome: 'M3i ' + i }; localStorage.setItem('prorider_bike_map', JSON.stringify(m)); localStorage.setItem('prorider_num_bikes', String(n)); } catch (e) {}
    const Wo = window.WebSocket; const Nw = function (u, x) { return new Wo(String(u).replace(prod.replace('https', 'wss'), b.replace('http', 'ws')), x); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [TK, PROD, B, N]);
  await p.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(3000);
  // dongle de mentira: a mesma entrada que o BLED112 de verdade usa
  await p.evaluate(() => { BLED112.connected = true; BLED112.startScan = cb => { window.__dongle = cb; }; BLED112.stopScan = () => {}; try { _parCarregarSalvo(); } catch (e) {} _parIniciarLiveBLED112(); });
  let fase = 0; const bomba = setInterval(() => { p.evaluate(([n, fase]) => { if (!window.__dongle) return; for (let i = 1; i <= n; i++) window.__dongle({ mac: 'AA:BB:CC:00:00:' + String(i).padStart(2, '0'), watts: 120 + i * 8 + (fase ? 40 : 0), cadence: 88 + (i % 5), gear: 12, heartRate: 135 + i }); }, [N, fase]).catch(() => {}); }, 320);

  console.log('1) Preparar a aula e os 15 celulares entrarem');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = []; for (let k = 0; k < 6; k++) workout.push({ intensity: ['z2', 'z3', 'z4', 'z5', 'z3', 'z2'][k], durationSec: 120, ftpMin: 70, ftpMax: 95, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' });
    try { _prNormWorkout(workout); } catch (e) {} segments = [{ id: 'main_1', name: 'Bloco Principal', type: 'main' }]; videoSource = 'none';
    document.getElementById('className').value = 'ENSAIO 17/10'; mostrarPreAula({ nome: 'ENSAIO 17/10' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  await espera(2500);
  const SALA = await p.evaluate(() => salaCode);
  const cels = [];
  for (const a of alunos) { const w = new WS(B.replace('http', 'ws')); w.a = a; w.ult = null; w.hist = [];
    w.on('message', m => { let d; try { d = JSON.parse(m); } catch (e) { return; } if (d.tipo === 'bikes_live') { const x = (d.bikes || []).find(k => k.b === a.b); if (x) { w.ult = x; w.hist.push([Date.now(), x.w]); } } if (d.tipo === 'fim_aula') w.fim = true; if (d.tipo === 'conectado') w.dentro = true; });
    await new Promise(o => w.on('open', o));
    w.send(JSON.stringify({ tipo: 'entrar_sala', codigo: SALA, nome: a.nome, bike: a.b, ftpBase: FTP(a.b), token: a.tok })); cels.push(w); await espera(60); }
  await espera(2500);
  ok(cels.every(w => w.dentro), '15 celulares entraram na sala', cels.filter(w => w.dentro).length);
  if (process.env.DBG) console.log('DBG', JSON.stringify(await p.evaluate(() => ({ k: Object.keys(alunosMap), ws: wsProf && wsProf.readyState, sala: salaCode }))));
  const naTv = await p.evaluate(() => Object.keys(alunosMap).filter(n => !alunosMap[n]._virtual).length);
  ok(naTv === N, 'TV mostra os 15 alunos (sem bike virtual sobrando)', naTv);
  const reais = await p.evaluate(() => Object.keys(alunosMap).filter(n => alunosMap[n]._virtual).length);
  ok(reais === 0, 'nenhuma bike ficou como "Bike N" sem dono', reais);

  console.log('2) START e aula rodando');
  await p.keyboard.press('Enter'); await espera(4000);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Performance.enable');
  const met = async () => (await cdp.send('Performance.getMetrics')).metrics.reduce((o, x) => (o[x.name] = x.value, o), {});
  const m0 = await met(); const t0 = Date.now();
  await espera(Math.max(10, SEG - 15) * 1000);
  let tv = await p.evaluate(() => Object.values(alunosMap).filter(a => !a._virtual).map(a => ({ n: a.nome, b: parseInt(a.bike), w: a.watts, f: a.ftp, z: a.zona, base: a.ftpBase })));
  const erradosTv = tv.filter(a => a.w !== W(a.b, 0) || a.f !== Math.round(W(a.b, 0) / FTP(a.b) * 100) || a.base !== FTP(a.b));
  ok(tv.length === N && erradosTv.length === 0, 'TV: watts do dongle + FTP do celular = %FTP certo nos 15', erradosTv.slice(0, 3));
  const erradosCel = cels.filter(w => !w.ult || w.ult.w !== W(w.a.b, 0) || w.ult.ftp !== Math.round(W(w.a.b, 0) / FTP(w.a.b) * 100) || w.ult.z !== zona(Math.round(W(w.a.b, 0) / FTP(w.a.b) * 100)));
  ok(erradosCel.length === 0, 'celulares: cada um recebe a intensidade certa da sua bike', erradosCel.slice(0, 3).map(w => [w.a.b, w.ult]));
  // degrau: todo mundo sobe 40 W; mede quanto tempo até cada celular ver o número novo
  cels.forEach(w => { w.hist = []; }); const tDeg = Date.now(); fase = 1; await espera(6000);
  const atrasos = cels.map(w => { const h = w.hist.find(x => x[1] === W(w.a.b, 1)); return h ? h[0] - tDeg : null; });
  const ord = atrasos.filter(x => x !== null).sort((a, b) => a - b);
  ok(ord.length === N, 'todos os celulares viram a mudança', ord.length);
  const p95 = ord[Math.floor(ord.length * 0.95)] || 0;
  ok(p95 < 1500, 'atraso dongle → TV → servidor → celular (p95) abaixo de 1,5 s', { min: ord[0], mediana: ord[Math.floor(ord.length / 2)], p95, max: ord[ord.length - 1] });
  const m1 = await met(), dt = (Date.now() - t0) / 1000;
  const cpu = ((m1.TaskDuration - m0.TaskDuration) / dt * 100), heap = Math.round(m1.JSHeapUsedSize / 1048576);
  ok(cpu < 60, 'TV com folga: ocupa ' + cpu.toFixed(0) + '% de um núcleo do processador', { cpu: cpu.toFixed(1) + '%', memoria_js_mb: heap });
  await p.evaluate(() => ctrlSetScreen(1)); await espera(1500);
  const cortes = await p.evaluate(() => { const out = []; document.querySelectorAll('#ftpGrid .ctrl-card').forEach(c => { const cr = c.getBoundingClientRect(); c.querySelectorAll('.ctrl-card-value,.ctrl-card-zone,.pc-foot span').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > cr.right + 1 || r.left < cr.left - 1)) out.push(e.textContent); }); }); return { n: document.querySelectorAll('#ftpGrid .ctrl-card').length, out }; });
  ok(cortes.n === N && cortes.out.length === 0, 'tela de potência: 15 cartões, nada cortado', cortes);
  const fotos = fs.mkdtempSync(path.join(os.tmpdir(), 'prorider-ensaio-17-')); await p.screenshot({ path: path.join(fotos, 'cartoes_15.png') });
  await p.evaluate(() => ctrlSetScreen(4)); await espera(1200); await p.screenshot({ path: path.join(fotos, 'ranking_15.png') }); await p.evaluate(() => ctrlSetScreen(0));

  console.log('3) Fim da aula');
  await p.evaluate(() => ctrlConfirmYes()); await espera(5000);
  ok(cels.every(w => w.fim), 'os 15 celulares receberam o fim da aula', cels.filter(w => w.fim).length);
  let res = ''; for (let i = 0; i < 20 && !/^15$/.test(res); i++) { res = await sql(`SELECT n_alunos FROM aulas_tv WHERE license_id='D5448D47' AND sala='${SALA}'`); if (!/^15$/.test(res)) await espera(400); }
  ok(res === '15', 'resumo da aula com os 15 alunos no servidor', res);
  ok(erros.length === 0, 'nenhum erro de JavaScript na TV', erros.slice(0, 3));
  clearInterval(bomba); cels.forEach(w => { try { w.close(); } catch (e) {} }); await nav.close();
  console.log('  fotos: ' + fotos);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
