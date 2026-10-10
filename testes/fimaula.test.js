// 09/10 — AULA NA TV → FIM → O APP GRAVA A AULA E O ALUNO RECEBE O E-MAIL (app de verdade num navegador)
//  Conta de aluno e conta de super admin (o Mario testa com a dele): as duas gravam e recebem.
const path = require('path'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999', MOCK = 'http://127.0.0.1:3014';
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const bcrypt = require(require.resolve('bcryptjs', { paths: [RAIZ] }));
const { sql, codigoTv } = require('./comum');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste PULADO.'); process.exit(3); }
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const sock = () => new Promise(o => { const w = new WS(B.replace('http', 'ws')); w.on('open', () => o(w)); });
const caixa = async () => (await (await fetch(MOCK + '/_emails')).json());
(async () => {
  const H = await bcrypt.hash('123456', 10);
  await sql(`DELETE FROM users WHERE email LIKE '%@fim.test'`);
  await sql(`INSERT INTO users (email,name,password_hash,role,license_id,termos_versao,ftp) VALUES ('aluna@fim.test','Aluna Fim','${H}','aluno',NULL,'x',200), ('chefe@fim.test','Chefe Fim','${H}','super_admin',NULL,'x',220)`);
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-fim', nome_computador: 'TV fim' })).d.token;
  const nav = await chromium.launch();
  let n = 0;
  for (const [email, nome] of [['aluna@fim.test', 'Aluna Fim'], ['chefe@fim.test', 'Chefe Fim']]) {
    n++; console.log(n + ') ' + nome);
    const tok = (await j('POST', '/user/login', { email, password: '123456' }, null, { 'X-Forwarded-For': '10.80.0.' + n })).d.token;
    const tv = await sock(), SALA = 'PR-FIM' + n + '-TEST';
    tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: TK })); await espera(300);
    const ap = await nav.newPage({ viewport: { width: 390, height: 844 } }); const ea = []; ap.on('pageerror', e => ea.push(e.message.slice(0, 160)));
    await ap.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
    await ap.addInitScript(([t]) => { try { localStorage.setItem('pr_token', t); } catch (e) {} }, [tok]);
    await ap.goto(B + '/aluno/'); await espera(3000);
    await ap.evaluate(([s]) => { _bikeSelNum = 3; connectQR(s); }, [SALA]); await espera(2500);
    const antes = (await caixa()).length;
    const graf = [{ idx: 0, z: 'z2', dur: 1, ftpMin: 60, ftpMax: 70, rpmMin: 85, rpmMax: 95, pos: 'Sentado' }, { idx: 1, z: 'z4', dur: 1, ftpMin: 90, ftpMax: 100, rpmMin: 85, rpmMax: 95, pos: 'Sentado' }];
    tv.send(JSON.stringify({ tipo: 'iniciar_aula', grafico: graf, blocoIdx: 0, nomeAula: 'Spin Fim ' + n }));
    for (let i = 0; i < 25; i++) { tv.send(JSON.stringify({ tipo: 'bikes_live', bikes: [{ b: 3, w: 180, r: 90, ftp: 90, z: 'z3' }] }));
      tv.send(JSON.stringify({ tipo: 'update_aula', nomeAula: 'Spin Fim ' + n, grafico: graf, blocoIdx: 0, totTime: i, segTime: i })); await espera(400); }
    tv.send(JSON.stringify({ tipo: 'fim_aula' })); await espera(4000);
    const st = await ap.evaluate(() => ({ tela: (document.querySelector('.screen.active') || {}).id, cAula: !!cAula, nota: !!document.getElementById('prNota') }));
    const reg = await sql(`SELECT count(*) FROM aulas_completadas a JOIN users u ON u.id=a.user_id WHERE u.email='${email}'`);
    ok(reg === '1', 'aula gravada no servidor (histórico) — ' + nome, { reg, st });
    let em = []; for (let i = 0; i < 16 && !em.length; i++) { await espera(250); em = (await caixa()).slice(antes).filter(x => (x.to || []).includes(email) && /resumo/.test(x.subject || '')); }
    ok(em.length === 1, 'e-mail "seu resumo da aula" enviado — ' + nome, (em[0] || {}).subject);
    ok(st.nota, 'app pergunta "Como foi a aula?"');
    if (n === 1) {   // 09/10: tela de fim nova + compartilhar com 2 modelos
      await ap.evaluate(() => { const x = document.getElementById('prNota'); if (x) x.remove(); const t = document.getElementById('prsTermos'); if (t) t.remove(); });
      const fim = await ap.evaluate(() => ({ tela: (document.querySelector('.screen.active') || {}).id, pts: getComputedStyle(document.getElementById('resPtsBox')).display, w: document.getElementById('resWatts').textContent,
        kcal: document.getElementById('resKcal').textContent, graf: getComputedStyle(document.getElementById('resGrafBox')).display, barras: document.querySelectorAll('#resGraf .rs-gb i').length,
        zonas: document.querySelectorAll('#resZoneList .rs-zr').length, data: document.getElementById('resData').textContent, larg: document.documentElement.scrollWidth }));
      ok(fim.tela === 'sResults' && fim.pts === 'flex' && +fim.w > 0 && +fim.kcal > 0 && fim.zonas >= 1 && /\d{2} [A-Z]{3} \d{4}/.test(fim.data) && fim.larg <= 390, 'tela de fim nova: pontos, cartões com números, zonas e data, sem rolar para o lado', fim);
      await ap.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-fim-1.png'), fullPage: false });
      await ap.evaluate(() => document.getElementById('sResults').scrollTop = 99999); await espera(300);
      await ap.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-fim-2.png') });
      await ap.evaluate(() => shareCard()); await espera(1500);
      const sh = await ap.evaluate(() => ({ c1: document.getElementById('shareCanvas1').width, c2: document.getElementById('shareCanvas2').height, dica: getComputedStyle(document.getElementById('shDica')).display, atual: _shAtual }));
      ok(sh.c1 === 1080 && sh.c2 === 1456 && sh.dica !== 'none' && sh.atual === 0, 'compartilhar: 2 modelos 1080×1456 (como a arte), começa no 1 com a dica "arraste para o lado"', sh);
      await ap.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-share-1.png') });
      // foto de teste (gerada aqui) como fundo
      await ap.evaluate(() => new Promise(r => { const c = document.createElement('canvas'); c.width = 900; c.height = 1600; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 1600); g.addColorStop(0, '#f6a443'); g.addColorStop(.5, '#7a3b2e'); g.addColorStop(1, '#1d1a24'); x.fillStyle = g; x.fillRect(0, 0, 900, 1600);
        x.fillStyle = '#111'; x.beginPath(); x.ellipse(560, 900, 170, 420, 0, 0, 7); x.fill(); x.beginPath(); x.arc(560, 420, 90, 0, 7); x.fill();
        const im = new Image(); im.onload = () => { _cardBgImage = im; shDesenhar(); r(); }; im.src = c.toDataURL(); }));
      await ap.evaluate(() => shIr(1, true)); await espera(500);
      ok(await ap.evaluate(() => _shAtual === 1 && getComputedStyle(document.getElementById('shDica')).display === 'none'), 'arrastar para o 2: marca o modelo 2 e a dica some');
      await ap.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-share-2.png') });
      // aula longa simulada (50 min) para ver o gráfico e as zonas
      await ap.evaluate(() => { const t0 = Date.now() - 3000000, ftp = 200; _lsAcc.am = []; for (let i = 0; i < 3000; i++) { const m = i / 60; const w = m < 10 ? 110 + m * 9 : m < 20 ? 180 + (m - 10) * 4 : m < 30 ? 210 : m < 40 ? 245 + (m % 3) * 8 : 150 - (m - 40) * 6; _lsAcc.am.push([t0 + i * 1000, Math.round(w), 90, 148]); }
        totS = 3000; zoneTime = { z1: 300, z2: 600, z3: 700, z4: 650, z5: 600, z6: 150, z7: 0 }; try { localStorage.setItem('pr_ftp', '200'); profData.ftp = '200'; } catch (e) {}
        prResExtra(); buildResChart(); shDesenhar(); });
      ok(await ap.evaluate(() => document.querySelectorAll('#resGraf .rs-gb i').length === 50), 'aula de 50 min: gráfico com 50 barras (uma por minuto)');
      await ap.evaluate(() => { document.getElementById('shareOverlay').style.display = 'none'; document.getElementById('sResults').scrollTop = 520; }); await espera(300);
      await ap.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-fim-3.png') });
      for (const k of [1, 2]) { const b64 = await ap.evaluate(k => document.getElementById('shareCanvas' + k).toDataURL('image/png').split(',')[1], k); require('fs').writeFileSync(path.join(require('os').tmpdir(), 'prorider-modelo-' + k + '.png'), Buffer.from(b64, 'base64')); }
    }
    ok(!ea.length, 'sem erro de JavaScript no app', ea);
    await ap.close(); tv.close();
  }
  // helpers para os casos seguintes
  const abrirApp = async tok => { const ap = await nav.newPage({ viewport: { width: 390, height: 844 } }); ap._erros = []; ap.on('pageerror', e => ap._erros.push(e.message.slice(0, 160)));
    await ap.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
    await ap.addInitScript(([t]) => { try { if (t) localStorage.setItem('pr_token', t); else localStorage.removeItem('pr_token'); } catch (e) {} }, [tok || '']);
    await ap.goto(B + '/aluno/'); await espera(3000); await ap.evaluate(() => { const t = document.getElementById('prsTermos'); if (t) t.remove(); }); return ap; };   // termos novos: fora deste teste
  const graf = [{ idx: 0, z: 'z2', dur: 1, ftpMin: 60, ftpMax: 70, rpmMin: 85, rpmMax: 95, pos: 'Sentado' }, { idx: 1, z: 'z4', dur: 1, ftpMin: 90, ftpMax: 100, rpmMin: 85, rpmMax: 95, pos: 'Sentado' }];
  const pedalar = async (tv, nomeA, seg) => { tv.send(JSON.stringify({ tipo: 'iniciar_aula', grafico: graf, blocoIdx: 0, nomeAula: nomeA }));
    for (let i = 0; i < seg; i++) { tv.send(JSON.stringify({ tipo: 'bikes_live', bikes: [{ b: 3, w: 160, r: 88, ftp: 80, z: 'z3' }] }));
      tv.send(JSON.stringify({ tipo: 'update_aula', nomeAula: nomeA, grafico: graf, blocoIdx: 0, totTime: i, segTime: i })); await espera(400); } };
  const conta = async e => parseInt(await sql(`SELECT count(*) FROM aulas_completadas a JOIN users u ON u.id=a.user_id WHERE u.email='${e}'`), 10);
  const chegou = async (para, antes) => { let em = []; for (let i = 0; i < 16 && !em.length; i++) { await espera(250); em = (await caixa()).slice(antes).filter(x => (x.to || []).includes(para) && /resumo/.test(x.subject || '')); } return em; };

  console.log('3) Aluno encerra a própria aula no meio (botão Encerrar Aula)');
  { const tok = (await j('POST', '/user/login', { email: 'aluna@fim.test', password: '123456' }, null, { 'X-Forwarded-For': '10.80.0.7' })).d.token;
    const tv = await sock(), SALA = 'PR-FIM3-TEST'; tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: TK })); await espera(300);
    const ap = await abrirApp(tok); await ap.evaluate(([s]) => { _bikeSelNum = 3; connectQR(s); }, [SALA]); await espera(2500);
    const c0 = await conta('aluna@fim.test'), antes = (await caixa()).length;
    await pedalar(tv, 'Spin Fim 3', 12);
    const bt = await ap.evaluate(() => { const b = document.getElementById('lbotBtn'); const r = b && b.getBoundingClientRect(); return b ? { h: Math.round(r.height), w: Math.round(r.width), cor: getComputedStyle(b).backgroundImage.slice(0, 40) } : null; });
    ok(bt && bt.h >= 40 && bt.w >= 200, 'botão CONTROLES laranja na aula (um toque abre)', bt);
    await ap.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-botao-controles.png') }).catch(() => {});
    await ap.click('#lbotBtn'); await espera(600);
    ok(await ap.evaluate(() => document.getElementById('drawer').classList.contains('open')), 'tocar no botão abre os controles (sem arrastar)');
    await ap.evaluate(() => quitW()); await espera(2500);
    ok(await conta('aluna@fim.test') === c0 + 1, 'aula gravada com o que fez até sair');
    ok((await chegou('aluna@fim.test', antes)).length === 1, 'e-mail do resumo enviado');
    ok(!ap._erros.length, 'sem erro de JavaScript', ap._erros); await ap.close(); tv.send(JSON.stringify({ tipo: 'fim_aula' })); tv.close(); }

  console.log('4) Sem login: convite no fim; ao criar a conta, a aula vai e o e-mail chega');
  { const tv = await sock(), SALA = 'PR-FIM4-TEST'; tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: TK })); await espera(300);
    const ap = await abrirApp(null); await ap.evaluate(([s]) => { entrarSemLogin(); _entrarNome = 'Visitante Fim'; _bikeSelNum = 3; connectQR(s); }, [SALA]); await espera(2500);
    await pedalar(tv, 'Spin Fim 4', 12); tv.send(JSON.stringify({ tipo: 'fim_aula' })); await espera(3500);
    const cv = await ap.evaluate(() => { const c = document.getElementById('prConvite'); return { conv: !!c && c.style.display !== 'none' && /RECEBA ESTE RESUMO/.test(c.innerText), pend: !!localStorage.getItem('pr_aula_pendente') }; });
    ok(cv.conv && cv.pend, 'resultado mostra "Receba este resumo por e-mail" e guarda a aula no aparelho', cv);
    const antes = (await caixa()).length;
    const reg = await ap.evaluate(async () => { const r = await fetch(SERVER_HTTP + '/user/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'novo@fim.test', name: 'Novo Fim', password: '123456', aceite_termos: true, aceite_saude: true, onde: 'app' }) });
      const d = await r.json(); if (d.token) { prToken = d.token; prUser = d.user; localStorage.setItem('pr_token', prToken); updateProfileUI(); } return r.status; });
    await espera(2500);
    ok(reg < 300 && await conta('novo@fim.test') === 1, 'conta criada: a aula de antes foi gravada nela', reg);
    ok((await chegou('novo@fim.test', antes)).length === 1, 'e-mail do resumo enviado para a conta nova');
    ok(await ap.evaluate(() => !localStorage.getItem('pr_aula_pendente')), 'a aula guardada sai do aparelho (não vai duas vezes)');
    ok(!ap._erros.length, 'sem erro de JavaScript', ap._erros); await ap.close(); tv.close(); }

  console.log('5) Totem (sem celular, identificado pelo e-mail)');
  { await sql(`UPDATE licencas SET totem_token='totemfimteste123456789' WHERE codigo='D5448D47'`);
    const idA = parseInt(await sql(`SELECT id FROM users WHERE email='aluna@fim.test'`), 10);
    await sql(`UPDATE users SET license_id='D5448D47' WHERE id=${idA}`);
    const tv = await sock(), SALA = 'PR-FIM5-TEST'; tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: TK })); await espera(400);
    const en = await j('POST', '/totem/totemfimteste123456789/entrar', { bike: 7, user_id: idA });
    ok(en.s === 200, 'aluna entra pelo totem', en.d);
    const c0 = await conta('aluna@fim.test'), antes = (await caixa()).length, UID = 'fim5-' + Date.now();
    const corpo = { uid: UID, sala: SALA, nome_aula: 'Spin Totem', dur_seg: 1800, alunos: [{ nome: 'Aluna Fim', w: 150, kcal: 320, wpp: 2.1, km: 12 }] };
    let r = await j('POST', '/display/aula/resumo', corpo, TK);
    let em = await chegou('aluna@fim.test', antes);
    ok(r.s === 200 && await conta('aluna@fim.test') === c0 + 1, 'aula do totem gravada no histórico', r.s);
    ok(em.length === 1 && />30<\/span>/.test(em[0].html) && />320<\/span>/.test(em[0].html) && />150<\/span>/.test(em[0].html) && !/NaN|undefined/.test(em[0].html), 'e-mail do resumo com 30 min, 320 kcal e 150 W', (em[0] || {}).subject);
    await j('POST', '/display/aula/resumo', corpo, TK); await espera(1200);
    ok(await conta('aluna@fim.test') === c0 + 1 && (await chegou('aluna@fim.test', antes)).length === 1, 'TV reenviando o mesmo resumo não duplica');
    tv.close(); await sql(`UPDATE licencas SET totem_token=NULL WHERE codigo='D5448D47'`); }
  await nav.close();
  await sql(`DELETE FROM users WHERE email LIKE '%@fim.test'`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
