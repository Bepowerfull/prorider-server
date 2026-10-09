// 03/10s — TESTE DAS TELAS DA TV (Ginásio) de ponta a ponta, num navegador de verdade
// A TV (pasta ginasio/) abre contra o servidor de teste e passa por uma aula inteira:
//   tela de espera → tela do QR → aluno entra pelo "celular" → START → aula com números
//   → fim de aula (resumo no banco) → volta para o início.
// Precisa do Playwright (uma vez): npm i -D playwright && npx playwright install chromium
// Sem ele, o teste é pulado com aviso (código 3). Fotos de cada tela: pasta mostrada no fim.
const fs = require('fs'), path = require('path'), os = require('os');
const B = 'http://127.0.0.1:3999', PROD = 'https://app.prorider.app.br';
const RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste da TV PULADO.\n    Instale uma vez: npm i -D playwright && npx playwright install chromium'); process.exit(3); }
const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
if (!fs.existsSync(path.join(GIN, 'ginasio.html'))) { console.log('FALHA pasta do Ginásio não encontrada: ' + GIN + ' (copie os arquivos do zip 3_GINASIO para ginasio/ na raiz do repositório)'); process.exit(1); }
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const { sql, ADMIN, ADMIN_SENHA , codigoTv } = require('./comum');
async function j(m, p, body, tok) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
// espera até a condição dar certo (no máximo ms)
async function ate(p, fn, ms) { const t = Date.now() + (ms || 8000); let v; while (Date.now() < t) { v = await p.evaluate(fn).catch(() => null); if (v) return v; await espera(300); } return v; }
const FOTOS = fs.mkdtempSync(path.join(os.tmpdir(), 'prorider-telas-tv-'));

(async () => {
  const inicio = new Date().toISOString();
  const at = await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-teste-telas', nome_computador: 'TV do teste' });
  ok(at.s === 200 && at.d.token, 'TV ativada no servidor de teste', at.s); const TK = at.d.token;
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  await sql(`DELETE FROM aulas_agenda WHERE nome='Spin Teste TV'`);
  await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_nome,dia_semana,hora,duracao_min,vagas_max) VALUES ('D5448D47','Spin Teste TV','Prof Teste',${agora.getDay()},'23:58',45,12)`);
  const build = (fs.readFileSync(path.join(GIN, 'script.js'), 'utf8').match(/var PR_BUILD='([^']+)'/) || [])[1];

  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' });   // a TV fica no Brasil
  const erros = [], cons = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160))); p.on('console', m => cons.push(m.type() + ': ' + m.text().slice(0, 200)));
  const foto = async n => { try { await p.screenshot({ path: path.join(FOTOS, n + '.png') }); } catch (e) {} };
  await p.route(/^https?:/, async r => {
    const u = r.request().url();
    if (u.startsWith(PROD)) { const q = r.request();
      try { const resp = await fetch(B + u.slice(PROD.length), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined });
        return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) }); } catch (e) { return r.abort(); } }
    if (/qrcode\.min\.js/.test(u)) return r.fulfill({ path: path.join(__dirname, 'qrcode.min.js'), contentType: 'application/javascript' });
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' });   // as mesmas letras da TV, sem internet
    return r.abort();
  });
  await p.addInitScript(([tk, prod, b]) => { try { localStorage.setItem('pr_display_token', tk); } catch (e) {}
    const W = window.WebSocket; const N = function (u, x) { return new W(String(u).replace(prod.replace('https', 'wss'), b.replace('http', 'ws')), x); };
    N.prototype = W.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => N[k] = W[k]); window.WebSocket = N; }, [TK, PROD, B]);

  console.log('1) Abrir a TV');
  await p.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(4000);
  let s = await p.evaluate(() => ({ idle: typeof idleOn !== 'undefined' && idleOn, ativ: (function () { const e = document.getElementById('boxAtivacao'); return !!e && getComputedStyle(e).display !== 'none'; })(), txt: document.body.innerText }));
  ok(!s.ativ, 'licença aceita (não pede o código de ativação)');
  ok(s.idle, 'abre na tela de espera');
  ok(await ate(p, () => /Spin Teste TV/.test((document.getElementById('idleAulas') || {}).textContent || '')), 'tela de espera mostra a aula de hoje da grade');
  await foto('1_espera');
  await p.evaluate(() => { sairIdle(); mostrarEscolha(); }); await espera(1200);
  s = await p.evaluate(() => ({ modo: boxMode, txt: document.body.innerText }));
  ok(s.modo === 'escolha' && build && s.txt.indexOf(build) >= 0, 'menu inicial abre e mostra a versão (' + build + ')', s.modo);
  await foto('1b_menu');

  console.log('2) Preparar a aula (tela do QR)');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {}
    workout = [{ intensity: 'z2', durationSec: 40, ftpMin: 60, ftpMax: 70, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'warmup' },
               { intensity: 'z4', durationSec: 40, ftpMin: 90, ftpMax: 100, rpmMin: 85, rpmMax: 95, position: 'Sentado', segmentId: 'main_1' },
               { intensity: 'z1', durationSec: 40, ftpMin: 50, ftpMax: 60, rpmMin: 80, rpmMax: 90, position: 'Sentado', segmentId: 'cooldown' }];
    try { _prNormWorkout(workout); } catch (e) {}
    segments = [{ id: 'warmup', name: 'Aquecimento', type: 'warmup' }, { id: 'main_1', name: 'Bloco Principal', type: 'main' }, { id: 'cooldown', name: 'Volta à calma', type: 'cooldown' }];
    videoSource = 'none'; document.getElementById('className').value = 'AULA TESTE TV';
    mostrarPreAula({ nome: 'AULA TESTE TV' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  await espera(2500);
  s = await p.evaluate(() => ({ modo: boxMode, sala: salaCode, cod: (document.getElementById('preAulaCodigo') || {}).textContent, qr: !!document.querySelector('#preAulaQR canvas,#preAulaQR img'), ws: wsProf && wsProf.readyState, idle: _podeIdle() }));
  ok(s.modo === 'preAula' && s.sala && s.cod === s.sala, 'tela do QR com o código da sala', s.sala);
  ok(s.qr, 'QR desenhado');
  ok(s.ws === 1, 'TV conectada ao servidor (sala aberta)');
  ok(s.idle === false, 'tela do QR nunca volta sozinha para a espera');
  const sala = s.sala;

  console.log('3) Aluno entra pelo celular');
  const al = new WS(B.replace('http', 'ws')); const rec = []; al.on('message', m => { try { rec.push(JSON.parse(m)); } catch (e) {} });
  await new Promise((o, x) => { al.on('open', o); al.on('error', x); });
  al.send(JSON.stringify({ tipo: 'entrar_sala', codigo: sala, nome: 'Aluna Teste', bike: 3, ftpBase: 200, genero: 'F' }));
  await espera(1500);
  ok(rec.some(m => m.tipo === 'conectado'), 'servidor aceitou o aluno na sala');
  s = await p.evaluate(() => ({ no: !!alunosMap['Aluna Teste'], lista: document.getElementById('boxPreAula').innerText }));
  ok(s.no && /Aluna Teste/.test(s.lista), 'aluno aparece na tela do QR');
  await foto('2_qr_com_aluno');

  console.log('3b) Diagnóstico da sala (07/10d): LB+RB 2 s na tela do QR, B fecha');
  await p.evaluate(() => { window._gpFake = { index: 0, id: 'teste', axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window._gpFake]; startGamepad();
    parBikeMap[13] = { tipo: 'keiser', mac: 'AA:BB:CC:00:00:13', bled112: true, rssi: -62, _lastSeen: Date.now() };
    parBikeMap[7] = { tipo: 'keiser', mac: 'AA:BB:CC:00:00:07', bled112: true, rssi: -70, _lastSeen: Date.now() - 95000 }; });
  const aperta = (bs, v) => p.evaluate(([bs, v]) => bs.forEach(b => { window._gpFake.buttons[b] = { pressed: v, value: v ? 1 : 0 }; }), [bs, v]);
  await aperta([4, 5], true); await espera(900);
  ok(await p.evaluate(() => !_diag.on && boxMode === 'preAula'), 'segurar LB+RB menos de 2 s não abre nada');
  for (let i = 0; i < 6; i++) { await p.evaluate(() => _prProcessDevice({ mac: 'AA:BB:CC:00:00:13', rssi: -62, watts: 0, cadence: 0 })); await espera(250); }
  const dg = await ate(p, () => { const e = document.getElementById('diagSala'); return _diag.on && e && /Aluna Teste/.test(e.innerText) && /ms/.test(e.innerText) ? e.innerText : null; }, 7000);
  ok(!!dg && /DIAGNÓSTICO/.test(dg) && /1\/2/.test(dg) && /-62 dBm/.test(dg) && /7\s*sem sinal há (9\d s|1 min)/.test(dg), 'painel abre: bikes 1/2 ok, sinal -62 dBm, bike 7 "sem sinal há X min"', (dg || '').replace(/\s+/g, ' ').slice(0, 220));
  ok(!!dg && /Aluna Teste[\s\S]*bike 3[\s\S]*\d+ ms/.test(dg) && /INTERNET\s*/.test(dg) && /OK/.test(dg), 'celular da aluna com bike e atraso em ms; internet OK');
  await aperta([4, 5], false); await espera(200);
  await foto('2b_diagnostico');
  await aperta([9], true); await espera(300); await aperta([9], false); await espera(300);
  ok(await p.evaluate(() => boxMode === 'preAula' && _diag.on), 'com o painel aberto, START não começa a aula');
  await aperta([1], true); await espera(300); await aperta([1], false); await espera(300);
  ok(await p.evaluate(() => boxMode === 'preAula' && !_diag.on && getComputedStyle(document.getElementById('diagSala')).display === 'none'), 'B fecha o painel e continua na tela do QR');
  await p.evaluate(() => { delete parBikeMap[13]; delete parBikeMap[7]; navigator.getGamepads = () => []; });
  // o professor pede; um aluno pedindo não recebe nada
  const rec2 = []; al.on('message', m => { try { const x = JSON.parse(m); if (x.tipo === 'diag') rec2.push(x); } catch (e) {} });
  al.send(JSON.stringify({ tipo: 'diag_pedir' })); await espera(2000);
  ok(rec2.length === 0, 'aluno não consegue pedir o diagnóstico');

  console.log('4) START');
  await p.keyboard.press('Enter'); await espera(5000);
  s = await p.evaluate(() => ({ modo: boxMode, tocando: typeof isPlaying !== 'undefined' && isPlaying, idle: _podeIdle() }));
  ok(s.modo === 'live', 'aula começou', s.modo);
  ok(rec.some(m => m.tipo === 'aula_iniciada' && Array.isArray(m.grafico) && m.grafico.length), 'celular recebeu o início da aula com o gráfico');
  ok(s.idle === false, 'aula rodando nunca volta para a espera');

  console.log('5) Pedalando');
  for (let i = 0; i < 8; i++) { al.send(JSON.stringify({ tipo: 'dados_aluno', nome: 'Aluna Teste', watts: 200, rpm: 90, fonte: 'celular' })); await espera(500); }
  s = await p.evaluate(() => { const a = alunosMap['Aluna Teste'] || {}; return { w: a.watts, rpm: a.rpm, kcal: a.kcal, txt: document.body.innerText }; });
  ok(s.w === 200 && s.rpm === 90, 'números do aluno chegam na TV', { w: s.w, rpm: s.rpm });
  ok(s.kcal > 0, 'calorias somando', s.kcal);
  await foto('3_aula');
  await p.evaluate(() => ctrlSetScreen(1)); await espera(1500);
  s = await p.evaluate(() => (document.getElementById('overlayFTP') || {}).innerText || '');
  ok(/Aluna/.test(s) && /200/.test(s), 'tela de cartões: aluno com os watts');
  await foto('3b_cartoes');
  await p.evaluate(() => ctrlSetScreen(4)); await espera(1500);
  s = await p.evaluate(() => (document.getElementById('overlayRank') || {}).innerText || '');
  ok(/Aluna/.test(s), 'tela de ranking com o aluno');
  await foto('3c_ranking');
  await p.evaluate(() => ctrlSetScreen(0)); await espera(800);

  console.log('5b) Cartões cabem na tela (1 a 30 alunos, números de 3 dígitos, nomes longos)');
  const ruins = await p.evaluate(async () => {
    const guarda = alunosMap, gW = Object.assign({}, wppScores), gS = Object.assign({}, alunoStats), nomes = ['Maria Fernanda Albuquerque', 'Joao Pedro Santos Silva', 'Ana', 'Bruno Castro Lima', 'Carla Dias', 'Diego Nogueira Prado'];
    const zz = ['z7', 'z6', 'z5', 'z4'], out = [];
    const dentro = (r, c) => r.width === 0 || (r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1);
    for (const tela of [1, 2]) {
      ctrlSetScreen(tela); await new Promise(r => setTimeout(r, 400));
      for (const n of [1, 4, 8, 12, 16, 20, 30]) {
        alunosMap = {};
        for (let i = 0; i < n; i++) { const nm = nomes[i % nomes.length] + (i >= nomes.length ? ' ' + i : ''); alunosMap[nm] = { nome: nm, bike: i + 10, watts: 1888, rpm: 128, ftp: 188, ftpBase: 200, zona: zz[i % 4], gear: 24, bpm: 188 }; }
        atualizaCards(); await new Promise(r => setTimeout(r, 350)); atualizaCards(); await new Promise(r => setTimeout(r, 200));
        const grid = document.getElementById(tela === 1 ? 'ftpGrid' : 'rpmGrid'), vw = innerWidth, vh = innerHeight;
        grid.querySelectorAll('.ctrl-card').forEach((c, i) => {
          const cr = c.getBoundingClientRect();
          if (cr.right > vw + 1 || cr.bottom > vh + 1) out.push('tela ' + tela + ', ' + n + ' alunos: cartão ' + (i + 1) + ' sai da tela');
          c.querySelectorAll('.ctrl-card-value,.ctrl-card-unit,.ctrl-card-zone,.pc-foot span,.ctrl-card-av').forEach(e => { if (!dentro(e.getBoundingClientRect(), cr)) out.push('tela ' + tela + ', ' + n + ' alunos: "' + (e.textContent || e.className).trim().slice(0, 14) + '" cortado' + (window.__DBG ? ' card=' + Math.round(cr.width) + 'x' + Math.round(cr.height) + ' V=' + grid.style.getPropertyValue('--pcVal') + ' el=' + Math.round(e.getBoundingClientRect().left - cr.left) + '-' + Math.round(e.getBoundingClientRect().right - cr.left) + ' val=' + Math.round(c.querySelector('.pc-val').getBoundingClientRect().width) + ' gw=' + grid.clientWidth : '')); });
          const nm = c.querySelector('.pc-name'), bk = c.querySelector('.pc-bike');
          if (nm && bk) { const rg = document.createRange(); rg.selectNodeContents(nm); const fim = Math.max(...[...rg.getClientRects()].map(x => x.right)); if (fim > bk.getBoundingClientRect().left + 1) out.push('tela ' + tela + ', ' + n + ' alunos: nome por baixo do número da bike'); }
        });
      }
    }
    ctrlSetScreen(0); alunosMap = guarda; wppScores = gW; alunoStats = gS; return [...new Set(out)];
  });
  ok(ruins.length === 0, 'nenhum número, zona ou nome cortado nos cartões', ruins.slice(0, 6));

  console.log('6) Fim da aula');
  await p.evaluate(() => ctrlConfirmYes()); await espera(5000);
  s = await p.evaluate(() => ({ modo: boxMode, txt: document.body.innerText }));
  ok(s.modo === 'end' || s.modo === 'endRanking', 'tela de fim de aula', s.modo);
  ok(rec.some(m => m.tipo === 'fim_aula'), 'celular recebeu o fim da aula');
  let res = ''; for (let i = 0; i < 20 && !res; i++) { res = await sql(`SELECT n_alunos, nome_aula FROM aulas_tv WHERE license_id='D5448D47' AND sala='${sala}'`); if (!res) await espera(300); }
  ok(/^1\|AULA TESTE TV$/.test(res), 'resumo da aula gravado no servidor, com o código da sala', res || (await sql(`SELECT sala, n_alunos FROM aulas_tv ORDER BY id DESC LIMIT 1`)));
  if (!res) console.log(cons.filter(x => /ProRider|resumo|error/i.test(x)).slice(-15).join('\n'));
  await foto('4_fim');

  console.log('7) Voltar para o início');
  await p.evaluate(() => { try { _endUnlockedAt = 0; } catch (e) {} resetCompleto(); }); await espera(2000);
  s = await p.evaluate(() => ({ modo: boxMode, sala: salaCode, ws: wsProf && wsProf.readyState }));
  ok(['idle', 'escolha'].indexOf(s.modo) >= 0, 'voltou para o início', s.modo);
  ok(s.sala !== sala, 'aula seguinte terá sala nova');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {} mostrarEscolha(); IDLE_MS = 1500; resetIdleTimer(); }); await espera(3000);
  ok(await p.evaluate(() => idleOn), 'parada no menu, volta sozinha para a tela de espera');
  await foto('5_espera_de_novo');

  console.log('8) Sem erros');
  ok(erros.length === 0, 'nenhum erro de JavaScript na TV', erros.slice(0, 3));
  ok(!cons.some(x => /servidor caiu/.test(x)), 'nenhuma queda falsa do servidor (fim de aula e início não contam como queda)', cons.filter(x => /servidor caiu/.test(x)));
  await espera(1500);
  const ev = await sql(`SELECT nivel || ': ' || msg FROM sistema_eventos WHERE origem='tv' AND created_at>='${inicio}'`);
  ok(ev === '', 'nenhum erro nem aviso falso da TV chegou na Saúde', ev);
  console.log('9) Alunos demo ficam ligados (07/10d)');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {} if (settingsDemo) settingsToggleDemo(); settingsNumDemo_val = 8; settingsToggleDemo(); });
  ok(await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('pr_demo') || 'null'); return d && d.on === true && d.n === 8; }), 'ligar o demo fica salvo na TV');
  // (o Chromium do teste nem sempre guarda o localStorage de file:// ao recarregar; a TV de verdade guarda — o token da TV fica no mesmo lugar)
  await p.addInitScript(() => { try { if (!localStorage.getItem('pr_demo')) localStorage.setItem('pr_demo', JSON.stringify({ on: true, n: 8 })); } catch (e) {} });
  await p.reload(); await espera(4000);
  ok(await p.evaluate(() => settingsDemo === true && demoWanted === true && settingsNumDemo_val === 8), 'depois de reabrir o programa, o demo continua ligado (8 alunos)');
  await p.evaluate(() => { try { sairIdle(); } catch (e) {} videoSource = 'none'; mostrarPreAula({ nome: 'AULA DEMO' }, { ok: false, msg: '--' }, { ok: false, msg: '--' }); });
  ok(!!(await ate(p, () => demoOn && DNOMES.some(n => alunosMap[n]), 6000)), 'na tela do QR os alunos demo voltam sozinhos', await p.evaluate(() => ({ modo: boxMode, w: demoWanted, on: demoOn })));
  await p.evaluate(() => { fecharPreAula(); settingsToggleDemo(); }); await espera(500);
  ok(await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('pr_demo') || 'null'); return d && d.on === false && !demoOn; }), 'desligar também fica salvo');
  ok(erros.length === 0, 'sem erro de JavaScript no demo', erros.slice(0, 3));
  al.close(); await nav.close();
  await sql(`DELETE FROM aulas_agenda WHERE nome='Spin Teste TV'`);
  console.log('  fotos das telas: ' + FOTOS);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
