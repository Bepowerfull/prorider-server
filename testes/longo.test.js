// 03/10x — AULA LONGA (vazamento de memória): a TV de verdade com 15 bikes no dongle e 15 celulares,
// blocos curtos (muitas trocas de bloco), por LONGO_MIN minutos (padrão 4; o ensaio de verdade: 20+).
// A cada 30 s força a coleta de lixo e mede a memória do JavaScript e os nós da tela. Reprova se
// a memória sobe mais de 40 MB/h ou se a tela acumula nós. Confere também a saúde da TV no servidor.
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
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-longo', nome_computador: 'TV longo' })).d.token;
  await sql(`DELETE FROM users WHERE email LIKE 'longo%@x.test'`);
  const alunos = [];
  for (let b = 1; b <= N; b++) { const r = await j('POST', '/user/register', { email: `longo${b}@x.test`, nome: NOMES[b - 1], senha: '123456', ftp: FTP(b), aceite_termos: true, aceite_saude: true }, null, { 'X-Forwarded-For': '10.18.0.' + b }); alunos.push({ b, tok: r.d && r.d.token, nome: NOMES[b - 1] }); }
  ok(alunos.every(a => a.tok), '15 alunos com conta');

  const nav = await chromium.launch(); const p = await nav.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Sao_Paulo' });
  const erros = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160))); if (process.env.DBG) p.on('console', m => { if (/aluno|sala|conect|erro/i.test(m.text())) console.log('TV:', m.text().slice(0, 160)); });
  await p.route(/^https?:/, async r => { const u = r.request().url();
    if (u.startsWith(PROD)) { const q = r.request(); try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined }); return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
    if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });
    return r.abort(); });
  await p.addInitScript(([tk, prod, b, n]) => { try { localStorage.setItem('pr_display_token', tk); window._PR_SAUDE_MS = 5000;
      const m = {}; for (let i = 1; i <= n; i++) m[i] = { tipo: 'keiser', bled112: true, mac: 'AA:BB:CC:00:00:' + String(i).padStart(2, '0'), nome: 'M3i ' + i }; localStorage.setItem('prorider_bike_map', JSON.stringify(m)); localStorage.setItem('prorider_num_bikes', String(n)); } catch (e) {}
    const Wo = window.WebSocket; const Nw = function (u, x) { return new Wo(String(u).replace(prod.replace('https', 'wss'), b.replace('http', 'ws')), x); }; Nw.prototype = Wo.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => Nw[k] = Wo[k]); window.WebSocket = Nw; }, [TK, PROD, B, N]);
  await p.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(3000);
  // dongle de mentira: a mesma entrada que o BLED112 de verdade usa
  await p.evaluate(() => { BLED112.connected = true; BLED112.startScan = cb => { window.__dongle = cb; }; BLED112.stopScan = () => {}; try { _parCarregarSalvo(); } catch (e) {} _parIniciarLiveBLED112(); });
  let fase = 0; const bomba = setInterval(() => { p.evaluate(([n, fase]) => { if (!window.__dongle) return; for (let i = 1; i <= n; i++) window.__dongle({ mac: 'AA:BB:CC:00:00:' + String(i).padStart(2, '0'), watts: 120 + i * 8 + (fase ? 40 : 0), cadence: 88 + (i % 5), gear: 12, heartRate: 135 + i }); }, [N, fase]).catch(() => {}); }, 320);

  console.log('1) Preparar a aula e os 15 celulares entrarem');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = []; for (let k = 0; k < 400; k++) workout.push({ intensity: ['z2', 'z3', 'z4', 'z5', 'z3', 'z2'][k % 6], durationSec: 30, ftpMin: 70, ftpMax: 95, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' });
    try { _prNormWorkout(workout); } catch (e) {} segments = [{ id: 'main_1', name: 'Bloco Principal', type: 'main' }]; videoSource = 'none';
    document.getElementById('className').value = 'AULA LONGA'; mostrarPreAula({ nome: 'AULA LONGA' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
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

  const MIN = parseFloat(process.env.LONGO_MIN || '4');
  console.log(`2) Aula rodando por ${MIN} min (bloco de 30 s, 15 bikes, 15 celulares)`);
  await p.keyboard.press('Enter'); await espera(5000);
  const cdp = await p.context().newCDPSession(p); await cdp.send('HeapProfiler.enable');
  const amostra = async () => { await cdp.send('HeapProfiler.collectGarbage'); await espera(300); const hu = await cdp.send('Runtime.getHeapUsage'); return p.evaluate(m => ({ t: Date.now(), mem: m, nos: document.getElementsByTagName('*').length, bloco: currentBlockIndex, live: Object.keys(alunosMap).length }), hu.usedSize / 1048576); };
  const pts = []; const tFim = Date.now() + MIN * 60000;
  while (Date.now() < tFim) { pts.push(await amostra()); if (process.env.DBG) console.log('   ', JSON.stringify(pts[pts.length - 1])); await espera(30000); }
  pts.push(await amostra());
  const meio = pts.slice(Math.floor(pts.length / 3));   // ignora o começo (cache, fontes, primeira pintura)
  const n = meio.length, mx = meio.reduce((a, x) => a + x.t, 0) / n, my = meio.reduce((a, x) => a + x.mem, 0) / n;
  const incl = meio.reduce((a, x) => a + (x.t - mx) * (x.mem - my), 0) / (meio.reduce((a, x) => a + (x.t - mx) ** 2, 0) || 1);   // MB por ms
  const mbh = incl * 3600000;
  const r = { inicio_mb: +pts[0].mem.toFixed(1), fim_mb: +pts[pts.length - 1].mem.toFixed(1), tendencia_mb_por_hora: +mbh.toFixed(1), nos_inicio: pts[0].nos, nos_fim: pts[pts.length - 1].nos, trocas_de_bloco: pts[pts.length - 1].bloco - pts[0].bloco };
  console.log('   ' + JSON.stringify(r));
  ok(r.trocas_de_bloco >= Math.floor(MIN * 2) - 2, 'a aula andou (trocas de bloco)', r.trocas_de_bloco);
  ok(mbh < 40, 'memória da TV estável (tendência abaixo de 40 MB/h)', r.tendencia_mb_por_hora + ' MB/h');
  ok(r.nos_fim <= r.nos_inicio * 1.2 + 50, 'a tela não acumula elementos', [r.nos_inicio, r.nos_fim]);
  ok(cels.every(w => w.ult && Date.now() - (w.hist.length ? w.hist[w.hist.length - 1][0] : 0) < 3000), 'os 15 celulares continuam recebendo no fim');
  const sd = await sql(`SELECT saude->>'mem_mb' AS a, saude->>'fps' AS b, saude->>'aula_min' AS c, saude->>'alunos' AS d, saude->>'atualizador' AS e FROM licenca_computadores WHERE license_codigo='D5448D47' AND device_id='tv-longo'`);
  const [smem, sfps, saula, salunos, satu] = sd.split('|');
  ok(satu === 'false', 'saúde da TV diz se o programa tem o atualizador (aqui: não tem)', satu);
  ok(parseFloat(smem) > 0 && parseFloat(saula) > 0 && salunos === '15', 'saúde da TV chegando ao servidor (memória, fps, aula, alunos)', { mem_mb: smem, fps: sfps, aula_min: saula, alunos: salunos });
  ok(erros.length === 0, 'nenhum erro de JavaScript na TV', erros.slice(0, 3));
  await p.evaluate(() => ctrlConfirmYes()); await espera(2000);
  clearInterval(bomba); cels.forEach(w => { try { w.close(); } catch (e) {} }); await nav.close();
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
