// 15/10 — PONTOS POR APROXIMAÇÃO (a conta principal): fazer a aula nos blocos certos.
//  1) servidor: 2 pts por minuto de wpp (na zona pedida; 1 zona de distância vale metade) + 50 completou + 25 sem parar;
//     teste de FTP não pontua; sem alvo = 0; wpp não passa do tempo de aula; app antigo continua na conta antiga
//  2) app: soma o wpp segundo a segundo pelo bloco da aula; parado não pontua; aula da TV usa o alvo que a TV manda
//  3) TV: o WPP do ranking com a mesma conta; aula LIVRE = a zona do professor na bike 99 é a base; sem professor, ninguém pontua
const path = require('path'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999';
const bcrypt = require(require.resolve('bcryptjs', { paths: [RAIZ] }));
const { sql } = require('./comum');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
async function j(m, p, body, tok) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), 'X-Forwarded-For': '10.83.0.1' }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const H = await bcrypt.hash('123456', 10);
  await sql(`DELETE FROM users WHERE email='pts@pontos.test'`);
  await sql(`INSERT INTO users (email,name,password_hash,role,license_id,termos_versao,ftp) VALUES ('pts@pontos.test','Paulo Pontos','${H}','aluno','D5448D47','x',200)`);
  const A = (await j('POST', '/user/login', { email: 'pts@pontos.test', password: '123456' })).d.token;
  const aula = (x) => j('POST', '/aula/complete', Object.assign({ aula_nome: 'Endurance', duracao_sec: 2700, zona_predominante: 'z3', zonas: {}, watts_med: 150, rpm_med: 85, kcal: 400 }, x), A).then(r => r.d && r.d.pontos_ganhos);

  console.log('1) Servidor');
  ok(await aula({ wpp: 40, alvo_seg: 2700, completou: true, sem_pausas: true }) === 155, '40 min na zona (wpp 40) = 80 + 50 completou + 25 sem parar = 155');
  ok(await aula({ wpp: 40, alvo_seg: 2700, completou: true, sem_pausas: false }) === 130, 'parou: sem os 25 = 130');
  ok(await aula({ wpp: 10, alvo_seg: 900, completou: false, sem_pausas: true }) === 20, 'saiu no meio: só os minutos na zona (10 × 2 = 20)');
  ok(await aula({ wpp: 999, alvo_seg: 2700, completou: true, sem_pausas: true }) === 166, 'wpp não passa do tempo de aula (45 min → 91 + 75)');
  ok(await aula({ wpp: 30, alvo_seg: 2700, completou: true, sem_pausas: true, ftp: true }) === 0, 'teste de FTP (marcado pelo app) não pontua');
  ok(!(await aula({ aula_nome: 'FTP Test 20 min', wpp: 30, alvo_seg: 2700, completou: true })), 'teste de FTP pelo nome da aula não pontua');
  ok(!(await aula({ wpp: 0, alvo_seg: 0, completou: true, sem_pausas: true })), 'aula sem alvo nenhum (pedal livre sem professor) = 0');
  ok(await aula({ sem_pausas: true }) === 125, 'app antigo (sem wpp) continua na conta antiga até atualizar');
  ok(await sql(`SELECT count(*) FROM aulas_completadas c JOIN users u ON u.id=c.user_id WHERE u.email='pts@pontos.test'`) !== '0', 'aulas gravadas no histórico');

  if (chromium) {
    const nav = await chromium.launch();
    console.log('2) App: wpp segundo a segundo');
    const ap = await nav.newPage({ viewport: { width: 390, height: 844 } }); const ea = []; ap.on('pageerror', e => ea.push(e.message.slice(0, 160)));
    await ap.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
    await ap.goto(B + '/aluno/'); await espera(2500);
    const r = await ap.evaluate(() => {
      const t = document.getElementById('prsTermos'); if (t) t.remove();
      clearInterval(_lsInt); document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById('sLive').classList.add('active');
      isPaused = false; _lsReset(); window._prAlvoTV = null; window._prErgGrv = null; window._prAulaTotSeg = 0; _bleTs = 0;
      const seg = (n, w, z) => { for (let i = 0; i < n; i++) { liveRelay = { w, r: w ? 90 : 0, ftp: 0, z, ts: Date.now() }; _lsTick(); } };
      aulaGrafico = [{ z: 'z3', ftpMin: 76, ftpMax: 90 }, { pos: 'Livre', z: 'z1', ftpMin: 40, ftpMax: 135 }]; aulaBlocoIdx = 0;
      seg(60, 160, 'z3'); const naZona = _lsAcc.wpp;
      seg(60, 200, 'z4'); const umaZona = _lsAcc.wpp - naZona;
      seg(60, 260, 'z5'); const duas = _lsAcc.wpp - naZona - umaZona;
      const antes = _lsAcc.wpp; seg(30, 0, 'z3'); const parado = { ganho: _lsAcc.wpp - antes, seg: _lsAcc.parado };
      aulaBlocoIdx = 1; const a1 = _lsAcc.wpp, s1 = _lsAcc.alvoSeg; seg(30, 150, 'z2'); const livreSemTV = { ganho: _lsAcc.wpp - a1, alvo: _lsAcc.alvoSeg - s1 };
      window._prAlvoTV = { z: 'z2', ts: Date.now() }; const a2 = _lsAcc.wpp; seg(60, 150, 'z2'); const livreComProf = _lsAcc.wpp - a2;
      window._prAulaTotSeg = 300; const pd = prPontosDados(); window._prAulaTotSeg = 1000; const pd2 = prPontosDados();
      _lsReset(); _lsAcc.ftp = true; window._prAlvoTV = null; aulaBlocoIdx = 0; seg(60, 160, 'z3'); const ftp = _lsAcc.wpp;
      return { naZona, umaZona, duas, parado, livreSemTV, livreComProf, pd, pd2, ftp };
    });
    const q = x => Math.round(x * 100) / 100;
    ok(q(r.naZona) === 1 && q(r.umaZona) === 0.5 && q(r.duas) === 0.25, '1 min na zona = 1; uma zona acima = 0,5; duas = 0,25', { a: q(r.naZona), b: q(r.umaZona), c: q(r.duas) });
    ok(r.parado.ganho === 0 && r.parado.seg === 30, 'parado não pontua (e conta como parada)', r.parado);
    ok(r.livreSemTV.ganho === 0 && r.livreSemTV.alvo === 0, 'bloco livre sem professor: sem alvo, sem pontos', r.livreSemTV);
    ok(q(r.livreComProf) === 1, 'bloco livre com o alvo da TV (professor na 99 em Z2): pontua por ele', q(r.livreComProf));
    ok(r.pd.completou === true && r.pd.sem_pausas === true && q(r.pd.wpp) === 2.75 && r.pd.alvo_seg === 270 && r.pd.ftp === false, 'dados que vão para o servidor (wpp, segundos com alvo, completou, sem parar)', r.pd);
    ok(r.pd2.completou === false, 'fez só 300 s de uma aula de 1000 s: não completou', r.pd2.completou);
    ok(r.ftp === 0, 'teste de FTP não soma wpp');
    ok(!ea.length, 'sem erro de JavaScript no app', ea);

    console.log('3) TV: WPP do ranking e a bike 99 na aula livre');
    const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
    const tv = await nav.newPage({ viewport: { width: 1920, height: 1080 } }); const et = []; tv.on('pageerror', e => et.push(e.message.slice(0, 160)));
    await tv.route(/^https?:/, rt => rt.abort());
    await tv.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(2500);
    const rodar = (ms) => tv.evaluate(ms => new Promise(res => { startWPP(); setTimeout(() => { stopWPP(); res(); }, ms); }), ms);
    await tv.evaluate(() => { workout = [{ intensity: 'z3', duration: 10, ftpMin: 76, ftpMax: 90, position: 'Sentado', segmentId: 'main_1' }]; currentBlockIndex = 0; isPlaying = true;
      alunosMap = { 'Ana Z3': { bike: 3, zona: 'z3', watts: 150, rpm: 85 }, 'Beto Z5': { bike: 4, zona: 'z5', watts: 250, rpm: 95 }, 'Caio Parado': { bike: 5, zona: 'z3', watts: 0, rpm: 0 } }; wppScores = {}; alunoStats = {}; });
    await rodar(3000);
    let w = await tv.evaluate(() => ({ a: wppScores['Ana Z3'], b: wppScores['Beto Z5'], c: wppScores['Caio Parado'] || 0, alvo: window._prAlvoZona }));
    ok(w.alvo === 'z3' && w.a > 0.035 && Math.abs(w.b / w.a - 0.25) < 0.02 && w.c === 0, 'bloco Z3: na zona soma 1/min, duas zonas acima 1/4, parado nada', w);
    await tv.evaluate(() => { workout = [{ intensity: 'z1', duration: 10, ftpMin: 40, ftpMax: 135, position: 'Livre', segmentId: 'main_1' }];
      alunosMap = { 'Prof': { bike: 99, zona: 'z4', watts: 220, rpm: 90 }, 'Ana Z4': { bike: 3, zona: 'z4', watts: 180, rpm: 88 }, 'Beto Z2': { bike: 4, zona: 'z2', watts: 100, rpm: 80 } }; wppScores = {}; alunoStats = {}; });
    await rodar(3000);
    w = await tv.evaluate(() => ({ prof: wppScores['Prof'] || 0, a: wppScores['Ana Z4'], b: wppScores['Beto Z2'], alvo: window._prAlvoZona }));
    ok(w.alvo === 'z4' && w.a > 0.035 && Math.abs(w.b / w.a - 0.25) < 0.02 && w.prof === 0, 'aula livre: a zona do professor (bike 99, Z4) é a base; ele mesmo não pontua', w);
    await tv.evaluate(() => { delete alunosMap['Prof']; wppScores = {}; });
    await rodar(2000);
    w = await tv.evaluate(() => ({ a: wppScores['Ana Z4'] || 0, alvo: window._prAlvoZona }));
    ok(w.alvo === null && w.a === 0, 'aula livre sem o professor na 99: ninguém pontua', w);
    const msg = await tv.evaluate(() => { let m = null; wsProf = { readyState: 1, send: x => { m = JSON.parse(x); } }; window._prAlvoZona = 'z4'; wsBroadcast(workout[0], 10, 5, null, 100, 10); wsProf = null; return m; });
    ok(msg && msg.tipo === 'update_aula' && msg.alvoZona === 'z4', 'a TV manda o alvo (zona do professor) para os celulares', msg && msg.alvoZona);
    ok(!et.length, 'sem erro de JavaScript na TV', et);
    await nav.close();
  }
  await sql(`DELETE FROM users WHERE email='pts@pontos.test'`);
  console.log(f ? '\n' + f + ' FALHA(S)' : '\nTUDO OK'); process.exit(f ? 1 : 0);
})().catch(e => { console.log('FALHA erro: ' + (e.stack || e.message)); process.exit(1); });
