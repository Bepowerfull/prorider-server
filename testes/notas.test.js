// 07/10d — NOTA DA AULA E E-MAIL "SEU MÊS"
//  1) TV abre a sala e começa a aula → o aluno dá de 1 a 5 estrelas (uma nota por aula; dar de novo troca)
//  2) nota fora de 1–5, sala que não existe e sem login: recusadas
//  3) Portal (Ocupação): média geral, por professor (da grade) e por horário; outra academia não vê
//  4) dia 1º: e-mail "O seu mês" com aulas, horas, kcal, dias pedalados e comparação; desligado pelo gestor = não sai
const path = require('path'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999', MOCK = 'http://127.0.0.1:3014';
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const bcrypt = require(require.resolve('bcryptjs', { paths: [RAIZ] }));
const { sql, codigoTv, ADMIN, ADMIN_SENHA } = require('./comum');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const IP = n => ({ 'X-Forwarded-For': '10.79.0.' + n });
const login = async (e, ip) => (await j('POST', '/user/login', { email: e, password: '123456' }, null, IP(ip))).d.token;
const sock = () => new Promise(o => { const w = new WS(B.replace('http', 'ws')); w.on('open', () => o(w)); });
const caixa = async () => (await (await fetch(MOCK + '/_emails')).json());
(async () => {
  const H = await bcrypt.hash('123456', 10);
  await sql(`DELETE FROM users WHERE email LIKE '%@nota.test'`);
  await sql(`DELETE FROM aulas_agenda WHERE nome LIKE 'Spin Nota%'`);
  await sql(`INSERT INTO users (email,name,password_hash,role,license_id,termos_versao) VALUES ('gestor@nota.test','Gestor Nota','${H}','gestor','D5448D47','x'),
    ('ana@nota.test','Ana Nota','${H}','aluno','D5448D47','x'), ('beto@nota.test','Beto Nota','${H}','aluno','D5448D47','x'), ('caio@nota.test','Caio Nota','${H}','aluno','D5448D47','x')`);
  const G = await login('gestor@nota.test', 1), A = await login('ana@nota.test', 2), Bt = await login('beto@nota.test', 3), C = await login('caio@nota.test', 4);
  // aula da grade agora (horário de Brasília), com professor
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hh = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_nome,dia_semana,hora,duracao_min,vagas_max) VALUES ('D5448D47','Spin Nota','Prof Nota',${agora.getDay()},'${hh}',45,12)`);
  await sql(`DELETE FROM aulas_notas WHERE license_id='D5448D47'`);

  console.log('1) Aula na TV e notas do app');
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-nota', nome_computador: 'TV nota' })).d.token;
  const tv = await sock(), SALA = 'PR-NT01-TEST';
  tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: TK })); await espera(300);
  ok((await j('POST', '/aluno/nota', { sala: SALA, nota: 5 }, A)).s === 404, 'antes de a aula começar: não aceita nota');
  tv.send(JSON.stringify({ tipo: 'iniciar_aula', grafico: [], blocoIdx: 0, nomeAula: 'Spin Nota' })); await espera(400);
  let r = await j('POST', '/aluno/nota', { sala: SALA.toLowerCase(), nota: 3, aula_nome: 'Spin Nota' }, A);
  ok(r.s === 200 && r.d.ok, 'aluna dá 3 estrelas', r.s);
  r = await j('POST', '/aluno/nota', { sala: SALA, nota: 5 }, A);
  ok(r.s === 200 && await sql(`SELECT count(*)||'|'||max(nota) FROM aulas_notas WHERE sala='${SALA}'`) === '1|5', 'dar de novo troca a nota (uma por aluno por aula)');
  ok((await j('POST', '/aluno/nota', { sala: SALA, nota: 4 }, Bt)).s === 200, 'outro aluno dá 4');
  console.log('2) Recusas');
  ok((await j('POST', '/aluno/nota', { sala: SALA, nota: 6 }, C)).s === 400 && (await j('POST', '/aluno/nota', { sala: SALA, nota: 0 }, C)).s === 400 && (await j('POST', '/aluno/nota', { sala: SALA, nota: 'x' }, C)).s === 400, 'nota fora de 1 a 5: recusada');
  ok((await j('POST', '/aluno/nota', { sala: 'PR-NAO-EXISTE', nota: 5 }, C)).s === 404, 'sala que não existe: recusada');
  ok((await j('POST', '/aluno/nota', { sala: SALA, nota: 5 })).s === 401, 'sem login: recusada');
  ok(await sql(`SELECT license_id FROM aulas_notas WHERE sala='${SALA}' LIMIT 1`) === 'D5448D47', 'nota fica na academia da TV');

  console.log('3) Portal: médias');
  r = await j('GET', '/gestor/notas', null, G);
  const d = r.d || {};
  ok(r.s === 200 && d.total && d.total.n === 2 && d.total.media === 4.5, 'média geral 4,5 de 2 notas', d.total);
  ok(JSON.stringify(d.dist) === '[0,0,0,1,1]', 'distribuição das estrelas', d.dist);
  ok((d.professores || []).some(x => x.k === 'Prof Nota' && x.media === 4.5 && x.n === 2), 'por professor: o da grade naquele horário', d.professores);
  ok((d.horarios || []).some(x => x.dow === agora.getDay() && x.hora === agora.getHours() && x.media === 4.5), 'por horário: dia e hora da aula', d.horarios);
  ok((await j('GET', '/gestor/notas', null, A)).s === 403 || (await j('GET', '/gestor/notas', null, A)).s === 401, 'aluno não vê as notas');
  await sql(`INSERT INTO users (email,name,password_hash,role,license_id,termos_versao) VALUES ('outra@nota.test','Outra Gestora','${H}','gestor','OUTRA-NOTA','x')`);
  const G2 = await login('outra@nota.test', 5);
  const o = (await j('GET', '/gestor/notas', null, G2)).d || {};
  ok(o.total && o.total.n === 0, 'outra academia não vê estas notas', o.total);
  if (chromium) {
    const nav = await chromium.launch(); const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
    const erros = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160)));
    await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
    await p.addInitScript(([t]) => { try { localStorage.setItem('pr_token', t); } catch (e) {} }, [G]);
    await p.goto(B + '/academia.html'); await espera(1200);
    await p.evaluate(() => { const e = document.getElementById('lEmail'); if (e && e.offsetParent) { e.value = 'gestor@nota.test'; document.getElementById('lPass').value = '123456'; doLogin(); } }); await espera(2000);
    await p.evaluate(() => { const t = document.querySelector('#prsTermos'); if (t) { t.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); const b = t.querySelector('[data-ok]'); if (b) b.click(); } }); await espera(1200);
    await p.evaluate(() => showTab('ocupacao'));
    let txt = ''; for (let i = 0; i < 20 && !/Prof Nota/.test(txt); i++) { await espera(300); txt = await p.evaluate(() => (document.getElementById('ocNotas') || {}).innerText || ''); }
    ok(/4,5/.test(txt) && /média de 2 notas/.test(txt) && /Prof Nota/.test(txt) && /2 notas/.test(txt), 'tela Ocupação mostra "Nota das aulas" com professor e horário', txt.replace(/\s+/g, ' ').slice(0, 160));
    ok(!erros.length, 'sem erro de JavaScript no Portal', erros);
    // app: a folha "Como foi a aula?" grava a nota
    const ap = await nav.newPage({ viewport: { width: 390, height: 844 } }); const ea = []; ap.on('pageerror', e => ea.push(e.message.slice(0, 160)));
    const rq = []; ap.on('response', r => { if (/\/aluno\/nota/.test(r.url())) rq.push(r.status()); }); ap.on('requestfailed', r => { if (/nota/.test(r.url())) rq.push('falhou ' + r.url()); });
    await ap.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
    await ap.addInitScript(([t]) => { try { localStorage.setItem('pr_token', t); } catch (e) {} }, [C]);
    await ap.goto(B + '/aluno/'); await espera(2500);
    await ap.evaluate(([s]) => { window._prNotaSala = s; window._prNotaNome = 'Spin Nota'; prNotaPedir(); }, [SALA]); await espera(400);
    const tem = await ap.evaluate(() => { const e = document.getElementById('prNota'); return e && /Como foi a aula/.test(e.innerText) && e.querySelectorAll('#prNotaEst button').length === 5; });
    ok(tem, 'app mostra "Como foi a aula?" com 5 estrelas');
    await ap.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-nota-app.png') }).catch(() => {});
    await ap.evaluate(() => document.querySelector('#prNotaEst button[data-n="2"]').click()); await espera(1800);   // clique por script: os termos novos cobrem a tela neste aluno de teste
    ok(await sql(`SELECT n.nota FROM aulas_notas n JOIN users u ON u.id=n.user_id WHERE u.email='caio@nota.test' AND n.sala='${SALA}'`) === '2' && await ap.evaluate(() => !document.getElementById('prNota')), 'tocar na 2ª estrela grava 2 e a folha fecha', rq);
    ok(!ea.length, 'sem erro de JavaScript no app', ea);
    await nav.close();
  }
  tv.send(JSON.stringify({ tipo: 'fim_aula' })); await espera(300); tv.close();

  console.log('4) E-mail "O seu mês" (dia 1º)');
  const ADM = (await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA }, null, IP(9))).d.token;
  const idA = await sql(`SELECT id FROM users WHERE email='ana@nota.test'`);
  // outubro de 2031: 3 aulas em 3 dias; setembro: 1 aula
  await sql(`INSERT INTO aula_historico (user_id, nome, dur_seg, kcal, avg_watts, data_aula) VALUES
    (${idA},'Spin',2700,500,160,'2031-10-03 21:00:00+00'),(${idA},'Spin',3600,620,180,'2031-10-10 21:00:00+00'),(${idA},'Spin',2700,480,0,'2031-10-27 21:00:00+00'),
    (${idA},'Spin',2700,450,150,'2031-09-12 21:00:00+00')`);
  const pv = (await j('POST', '/gestor/emails/previa', { tipo: 'seu_mes' }, G)).d || {};
  ok(/OS DIAS EM QUE VOCÊ PEDALOU/.test(pv.html || '') && /Ana!/.test(pv.html || '') && !/\{[a-z_]+\}|undefined|NaN/.test(pv.html + pv.subject), 'prévia do Portal monta limpa', pv.subject);
  ok((await j('GET', '/gestor/emails', null, G)).d.cfg.seu_mes === true, 'vem ligado');
  const antes = (await caixa()).length;
  r = await j('POST', '/_teste/rotina-emails', { data: '2031-11-01' }, ADM);
  ok(r.s === 200, 'rotina do dia 1º rodou', r.s);
  let em = []; for (let i = 0; i < 20 && !em.length; i++) { await espera(250); em = (await caixa()).slice(antes).filter(x => (x.to || []).includes('ana@nota.test') && /outubro/.test(x.subject || '')); }
  const h = (em[0] || {}).html || '';
  ok(em.length === 1, 'aluna recebeu "o seu outubro na bike"', (em[0] || {}).subject);
  ok(/>3<\/span>/.test(h) && />2,5<\/span>/.test(h) && />1.600<\/span>/.test(h) && />170<\/span>/.test(h) && />\+2<\/span>/.test(h), 'cartões: 3 aulas, 2,5 h, 1.600 kcal, 170 W (sem contar 0 W), +2 vs setembro');
  const dias = (h.match(/background:#ea860c;font-size:9px[^>]*>(\d+)</g) || []).map(x => +x.match(/>(\d+)</)[1]);
  ok(JSON.stringify(dias) === '[3,10,27]' && (h.match(/<td style="height:22px;border-radius:4px/g) || []).length === 31, 'calendário de 31 dias com os dias 3, 10 e 27 marcados', dias);
  ok((await caixa()).slice(antes).filter(x => (x.to || []).includes('beto@nota.test') && /na bike/.test(x.subject || '')).length === 0, 'quem não pedalou no mês não recebe');
  await j('POST', '/_teste/rotina-emails', { data: '2031-11-01' }, ADM); await espera(800);
  ok((await caixa()).slice(antes).filter(x => (x.to || []).includes('ana@nota.test') && /outubro/.test(x.subject || '')).length === 1, 'não manda duas vezes no mesmo mês');
  ok((await j('POST', '/_teste/rotina-emails', { data: '2031-11-01' }, A)).s === 403, 'aluno não dispara a rotina');
  const cfg = (await j('GET', '/gestor/emails', null, G)).d.cfg; cfg.seu_mes = false;
  ok((await j('PUT', '/gestor/emails', cfg, G)).s === 200, 'gestor desliga "O seu mês"');
  await sql(`INSERT INTO aula_historico (user_id, nome, dur_seg, kcal, avg_watts, data_aula) VALUES (${idA},'Spin',2700,500,160,'2031-11-05 21:00:00+00')`);
  await j('POST', '/_teste/rotina-emails', { data: '2031-12-01' }, ADM); await espera(800);
  ok((await caixa()).slice(antes).filter(x => (x.to || []).includes('ana@nota.test') && /novembro/.test(x.subject || '')).length === 0, 'desligado: não sai em dezembro');
  cfg.seu_mes = true; await j('PUT', '/gestor/emails', cfg, G);
  await sql(`DELETE FROM aula_historico WHERE user_id=${idA}`); await sql(`DELETE FROM users WHERE email LIKE '%@nota.test'`); await sql(`DELETE FROM aulas_agenda WHERE nome LIKE 'Spin Nota%'`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
