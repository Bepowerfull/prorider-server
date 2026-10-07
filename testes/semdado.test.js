// 03/10w — SEM NÚMERO INVENTADO: aula do app sem bike conectada mostra "—" e não conta nada.
// Antes o app simulava rpm, watts e %FTP (o "83 RPM") e isso podia ir para o resultado e o histórico.
const path = require('path');
const B = 'http://127.0.0.1:3999', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste PULADO.\n    Instale uma vez: npm i -D playwright && npx playwright install chromium'); process.exit(3); }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const nav = await chromium.launch(); const p = await nav.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160)));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('pr_ftp', '200'); } catch (e) {} });
  await p.goto(B + '/aluno/'); await espera(1200);
  console.log('1) Aula do app sem aparelho');
  await p.evaluate(() => { cAula = aulas[0]; startLive(); });
  await espera(4500);
  let s = await p.evaluate(() => ({ rpm: document.getElementById('bigRpm').textContent, w: document.getElementById('bigWatts').textContent, g: document.getElementById('gValue').textContent,
    hr: document.getElementById('p2Hr').textContent, dist: document.getElementById('p2Dist').textContent, acc: _lsAcc.dur, t: totS }));
  ok(s.rpm === '—' && s.w === '—' && s.g === '—', 'rpm, watts e %FTP mostram "—" (nada inventado)', s);
  ok(s.hr === '—' && s.dist === '—', 'sem FC nem distância de mentira', { hr: s.hr, dist: s.dist });
  ok(s.acc === 0 && s.t >= 3, 'o tempo da aula corre, mas nada é contado como medido', { medido: s.acc, tempo: s.t });
  console.log('2) Chega dado do Bluetooth');
  for (let i = 0; i < 4; i++) { await p.evaluate(() => { connected.bike = true; _bleRpm = 92; _bleWatts = 180; _bleTs = Date.now(); }); await espera(1000); }
  s = await p.evaluate(() => ({ rpm: document.getElementById('bigRpm').textContent, w: document.getElementById('bigWatts').textContent, g: document.getElementById('gValue').textContent, acc: _lsAcc.dur, f: _lsAcc.ftpSum / Math.max(1, _lsAcc.ftpCnt) }));
  ok(s.rpm === '92' && s.w === '180' && s.g === '90', 'com a bike: 92 rpm, 180 W, 90% (FTP 200 do aluno)', s);
  ok(s.acc >= 2 && Math.round(s.f) === 90, 'só o tempo com dado é contado, com o FTP do aluno', { medido: s.acc, ftpMedio: Math.round(s.f) });
  console.log('3) Resultado');
  await p.evaluate(() => { _bleTs = 0; connected.bike = false; showResultsReal(); }); await espera(800);
  s = await p.evaluate(() => ({ rpm: document.getElementById('resAvgRpm').textContent, max: document.getElementById('resMaxRpm').textContent, w: document.getElementById('resWatts').textContent, ftp: document.getElementById('resAvgFtp').textContent, dist: document.getElementById('resDist').textContent }));
  ok(s.rpm === '92' && s.max === '92' && s.w === '180' && s.ftp === '90', 'resultado só com o que foi medido', s);
  ok(s.dist === '—', 'sem distância inventada no resultado');
  ok(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 3));
  await nav.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
