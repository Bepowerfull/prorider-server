// 10/10i — PAINEL DO PROFESSOR, BIBLIOTECA DA REDE, BRASÃO NA TV E SAÚDE COM 10 LINHAS
//  1) gestor liga/desliga o painel de cada professor; desligado = 403; ligado = aulas, alunos, presença, notas, evolução
//  2) biblioteca da rede: só o super admin sobe/renomeia/apaga; toda academia vê e usa na aula automática; a TV baixa
//  3) Portal: menu "Meu painel" do professor e o painel aberto pelo gestor; Admin: tela "Aulas da rede"; Saúde mostra 10 linhas + setinha
//  4) TV: brasão do aluno no cartão de potência e na tela final
const path = require('path'), fs = require('fs'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999';
const bcrypt = require(require.resolve('bcryptjs', { paths: [RAIZ] }));
const { sql, codigoTv, ADMIN, ADMIN_SENHA } = require('./comum');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const IP = n => ({ 'X-Forwarded-For': '10.81.0.' + n });
const login = async (e, ip, s) => (await j('POST', '/user/login', { email: e, password: s || '123456' }, null, IP(ip))).d.token;
const AULA = JSON.stringify({ workout: [{ intensity: 'z2', duration: 10 }, { intensity: 'z4', duration: 5 }] });
(async () => {
  const H = await bcrypt.hash('123456', 10);
  await sql(`DELETE FROM aulas_agenda WHERE nome LIKE 'Spin Painel%'`);
  await sql(`DELETE FROM treinos_professor WHERE nome LIKE 'Rede Teste%'`);
  await sql(`DELETE FROM users WHERE email LIKE '%@painel.test'`);
  await sql(`INSERT INTO users (email,name,password_hash,role,license_id,termos_versao) VALUES
    ('gestor@painel.test','Gestor Painel','${H}','gestor','D5448D47','x'), ('prof@painel.test','Paula Professora','${H}','professor','D5448D47','x'),
    ('outro@painel.test','Otto Professor','${H}','professor','D5448D47','x'), ('ana@painel.test','Ana Painel','${H}','aluno','D5448D47','x'),
    ('beto@painel.test','Beto Painel','${H}','aluno','D5448D47','x'), ('gfora@painel.test','Gestor Fora','${H}','gestor','OUTRA-PAINEL','x')`);
  const G = await login('gestor@painel.test', 1), P = await login('prof@painel.test', 2), O = await login('outro@painel.test', 3), A = await login('ana@painel.test', 4), GF = await login('gfora@painel.test', 5);
  const SA = await login(ADMIN, 6, ADMIN_SENHA);
  const pid = await sql(`SELECT id FROM users WHERE email='prof@painel.test'`);
  // grade da Paula: uma aula por id, outra só pelo nome; a do Otto não pode aparecer
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })), dow = agora.getDay();
  const ag1 = await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_id,professor_nome,dia_semana,hora,duracao_min,vagas_max) VALUES ('D5448D47','Spin Painel 1',${pid},'Paula Professora',${dow},'07:00',45,12) RETURNING id`);
  await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_nome,dia_semana,hora,duracao_min,vagas_max) VALUES ('D5448D47','Spin Painel 2','paula professora',${(dow + 1) % 7},'19:00',45,12)`);
  await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_nome,dia_semana,hora,duracao_min,vagas_max) VALUES ('D5448D47','Spin Painel Otto','Otto Professor',${dow},'08:00',45,12)`);
  // presença dos alunos (semana passada) e uma aula dada na TV no horário dela, com nota
  await sql(`INSERT INTO aulas_reservas (agenda_id,user_id,data_aula,status) SELECT ${ag1}, id, CURRENT_DATE - 7, 'presente' FROM users WHERE email IN ('ana@painel.test','beto@painel.test')`);
  await sql(`INSERT INTO aulas_reservas (agenda_id,user_id,data_aula,status) SELECT ${ag1}, id, CURRENT_DATE - 14, 'ausente' FROM users WHERE email='beto@painel.test'`);
  await sql(`DELETE FROM aulas_tv WHERE sala='PR-PAINEL-1'`); await sql(`DELETE FROM aulas_notas WHERE sala='PR-PAINEL-1'`);
  await sql(`INSERT INTO aulas_tv (license_id,uid,sala,nome_aula,inicio,dur_seg,n_alunos,watts_med,kcal_total) VALUES ('D5448D47','painel-1','PR-PAINEL-1','Spin Painel 1',
    (((NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 7)::timestamp + TIME '07:02') AT TIME ZONE 'America/Sao_Paulo', 2700, 2, 160, 900)`);
  await sql(`INSERT INTO aulas_notas (user_id,license_id,sala,aula_nome,nota,inicio) SELECT id,'D5448D47','PR-PAINEL-1','Spin Painel 1', CASE WHEN email LIKE 'ana%' THEN 5 ELSE 4 END, NOW() - INTERVAL '7 days' FROM users WHERE email IN ('ana@painel.test','beto@painel.test')`);

  console.log('1) Painel do professor');
  let r = await j('GET', '/professor/painel', null, P);
  ok(r.s === 403 && r.d.desligado, 'vem desligado: professor não vê o painel', r.s);
  ok((await j('PUT', '/gestor/equipe/' + pid + '/painel', { ligado: true }, P)).s === 403, 'professor não liga o próprio painel');
  ok((await j('PUT', '/gestor/equipe/' + pid + '/painel', { ligado: true }, GF)).s === 404, 'gestor de outra academia não mexe');
  r = await j('GET', '/gestor/equipe', null, G);
  const eq = (Array.isArray(r.d) ? r.d : (r.d && (r.d.equipe || r.d.usuarios)) || []).find(x => String(x.id) === pid);
  ok(eq && eq.painel_prof === false, 'Equipe mostra o painel desligado', eq && eq.painel_prof);
  r = await j('PUT', '/gestor/equipe/' + pid + '/painel', { ligado: true }, G);
  ok(r.s === 200 && r.d.painel_prof === true, 'gestor liga o painel da Paula', r.d);
  r = await j('GET', '/professor/painel', null, P); const d = r.d || {};
  ok(r.s === 200 && (d.aulas || []).length === 2 && !(d.aulas || []).some(a => /Otto/.test(a.nome)), 'painel: as 2 aulas dela (por id e por nome), sem a do Otto', (d.aulas || []).map(a => a.nome));
  const a1 = (d.aulas || []).find(a => a.nome === 'Spin Painel 1') || {};
  ok(a1.presencas_30d === 2 && a1.faltas_30d === 1, 'presenças e faltas dos últimos 30 dias', a1);
  ok((d.dadas || []).length === 1 && d.dadas[0].nota === 4.5 && d.dadas[0].n_notas === 2 && d.dadas[0].n_alunos === 2, 'aula dada na TV no horário dela, com nota 4,5', d.dadas);
  ok((d.alunos || []).length === 2 && d.alunos[0].presencas === 1 && (d.alunos.find(x => x.nome === 'Beto Painel') || {}).faltas === 1, 'alunos da turma com presença e falta', d.alunos);
  ok(d.resumo && d.resumo.aulas_30d === 1 && d.resumo.media_alunos === 2 && d.resumo.nota_media === 4.5 && d.resumo.alunos_60d === 2, 'resumo: aulas, média de alunos, nota média, alunos', d.resumo);
  r = await j('GET', '/professor/painel?id=' + pid, null, O);
  ok(r.s === 403 && r.d.desligado, 'professor não abre o painel de outro (o ?id= é ignorado: vale o dele, desligado)', r.s);
  r = await j('GET', '/professor/painel?id=' + pid, null, G);
  ok(r.s === 200 && r.d.professor.nome === 'Paula Professora', 'gestor abre o painel da Paula', r.s);
  ok((await j('GET', '/professor/painel?id=' + pid, null, GF)).s === 404, 'gestor de outra academia não abre');
  ok([401, 403].includes((await j('GET', '/professor/painel', null, A)).s), 'aluno não abre painel');
  ok((await j('PUT', '/gestor/equipe/' + pid + '/painel', { ligado: false }, G)).s === 200 && (await j('GET', '/professor/painel', null, P)).s === 403, 'gestor desliga: some de novo');
  await j('PUT', '/gestor/equipe/' + pid + '/painel', { ligado: true }, G);

  console.log('2) Biblioteca da rede');
  ok((await j('POST', '/admin/biblioteca-rede', { nome: 'Rede Teste X', json: AULA }, G)).s === 403, 'gestor não sobe aula da rede');
  ok((await j('POST', '/admin/biblioteca-rede', { nome: 'Rede Teste X', json: '{"oi":1}' }, SA)).s === 400, 'arquivo que não é aula: recusado');
  r = await j('POST', '/admin/biblioteca-rede', { nome: 'Rede Teste Endurance', json: AULA }, SA);
  ok(r.s === 200 && r.d.id && r.d.duracao_sec === 900, 'super admin sobe "Rede Teste Endurance" (15 min)', r.d); const rid = r.d && r.d.id;
  r = await j('GET', '/gestor/biblioteca', null, G);
  ok((r.d.rede || []).some(x => x.id === rid) && !(r.d.aulas || []).some(x => x.id === rid), 'academia vê no grupo da rede (não misturada com as dela)', (r.d.rede || []).length);
  ok(((await j('GET', '/gestor/biblioteca', null, GF)).d.rede || []).some(x => x.id === rid), 'outra academia também vê');
  r = await j('POST', '/gestor/agenda', { nome: 'Spin Painel Rede', professor_nome: 'Paula Professora', dia_semana: dow, hora: '06:00', duracao_min: 45, vagas_max: 10, treino_id: rid, modo_inicio: 'automatico' }, G);
  ok(r.s === 200 || r.s === 201, 'gestor monta aula automática com a aula da rede', r.d);
  const agR = await sql(`SELECT id||'|'||COALESCE(treino_id::text,'') FROM aulas_agenda WHERE nome='Spin Painel Rede'`);
  ok(agR.split('|')[1] === String(rid), 'grade guardou a aula da rede', agR);
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-painel', nome_computador: 'TV painel' })).d.token;
  r = await j('GET', '/display/aula-automatica/' + agR.split('|')[0], null, TK);
  ok(r.s === 200 && r.d.nome === 'Rede Teste Endurance' && /workout/.test(JSON.stringify(r.d.json)), 'a TV baixa a aula da rede', r.s);
  r = await j('PUT', '/admin/biblioteca-rede/' + rid, { nome: 'Rede Teste Endurance 2' }, SA);
  ok(r.s === 200 && r.d.nome === 'Rede Teste Endurance 2', 'super admin renomeia', r.d);
  ok((await j('DELETE', '/admin/biblioteca-rede/' + rid, null, G)).s === 403, 'gestor não apaga aula da rede');
  r = await j('GET', '/admin/biblioteca-rede', null, SA);
  ok((r.d.aulas || []).some(x => x.id === rid && x.em_grades === 1), 'Admin vê em quantas grades ela está', (r.d.aulas || []).find(x => x.id === rid));

  if (chromium) {
    const nav = await chromium.launch();
    console.log('3) Telas');
    const p = await nav.newPage({ viewport: { width: 1440, height: 900 } }); const erros = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160)));
    await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
    await p.goto(B + '/academia.html'); await espera(1200);
    await p.evaluate(() => { const e = document.getElementById('lEmail'); if (e && e.offsetParent) { e.value = 'prof@painel.test'; document.getElementById('lPass').value = '123456'; doLogin(); } }); await espera(2500);
    await p.evaluate(() => { const t = document.querySelector('#prsTermos'); if (t) t.remove(); });
    const temMenu = await p.evaluate(() => !!document.querySelector('[onclick*="meupainel"]') || /Meu painel/.test((document.getElementById('sidebar') || document.body).innerText));
    ok(temMenu, 'professor com painel ligado vê "Meu painel" no menu');
    await p.evaluate(() => showTab('meupainel')); let txt = '';
    for (let i = 0; i < 20 && !/Beto Painel/.test(txt); i++) { await espera(300); txt = await p.evaluate(() => (document.getElementById('mpConteudo') || {}).innerText || ''); }
    ok(/Spin Painel 1/.test(txt) && /Beto Painel/.test(txt) && /4,5/.test(txt), 'painel mostra aulas, alunos e nota', txt.replace(/\s+/g, ' ').slice(0, 200));
    await p.screenshot({ path: path.join(require('os').tmpdir(), 'prorider-painel-professor.png') }).catch(() => {});
    ok(!erros.length, 'sem erro de JavaScript no painel', erros);
    await p.close();
    // Admin: aulas da rede e Saúde com 10 linhas
    const q = await nav.newPage({ viewport: { width: 1440, height: 900 } }); const e2 = []; q.on('pageerror', e => e2.push(e.message.slice(0, 160)));
    await q.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
    await q.addInitScript(([t, e]) => { localStorage.setItem('pr_admin_token', t); localStorage.setItem('pr_admin_user', JSON.stringify({ name: 'Admin', email: e, role: 'super_admin' })); }, [SA, ADMIN]);
    await q.goto(B + '/index.html'); await espera(1500);
    await q.evaluate(() => showPage('rede')); txt = '';
    for (let i = 0; i < 15 && !/Rede Teste Endurance 2/.test(txt); i++) { await espera(300); txt = await q.evaluate(() => document.getElementById('redeTab').innerText); }
    ok(/Rede Teste Endurance 2/.test(txt) && /15 min/.test(txt), 'Admin: tela "Aulas da rede" lista a aula', txt.replace(/\s+/g, ' ').slice(0, 120));
    // 12 linhas num setor da Saúde: mostra 10 e a setinha abre todas
    await q.evaluate(() => showPage('saude')); await espera(2500);
    const sd = await q.evaluate(async () => {
      const w = document.createElement('div'); w.className = 'table-wrap'; w.innerHTML = '<div class="table-header"><h2>Teste linhas</h2></div><table><thead><tr><th>x</th></tr></thead><tbody>' + Array.from({ length: 12 }, (_, i) => '<tr><td>L' + i + '</td></tr>').join('') + '</tbody></table>';
      document.getElementById('sdConteudo').appendChild(w); await new Promise(r => setTimeout(r, 300));
      const vis = () => [...w.querySelectorAll('tbody tr')].filter(r => r.style.display !== 'none').length;
      const a = vis(), bt = w.querySelector('.sd-mais'), t1 = bt && bt.textContent; bt && bt.click(); await new Promise(r => setTimeout(r, 200));
      const b = vis(), rol = w.querySelector('.sd-rol'), t2 = w.querySelector('.sd-mais').textContent;
      return { a, b, t1, t2, rolagem: rol && getComputedStyle(rol).overflowY };
    });
    ok(sd.a === 10 && sd.b === 12 && /Ver todas \(12\)/.test(sd.t1) && /só as 10/.test(sd.t2) && sd.rolagem === 'auto', 'Saúde: setor com 12 linhas mostra 10; a setinha abre todas com rolagem', sd);
    ok(!e2.length, 'sem erro de JavaScript no Admin', e2);
    // tela de entrada: arte estendida ocupando a tela toda (sem faixa preta dos lados)
    await q.evaluate(() => { localStorage.clear(); }); const L = await nav.newPage({ viewport: { width: 1920, height: 1080 } });
    await L.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort()); await L.goto(B + '/index.html'); await espera(1500);
    const lx = await L.evaluate(() => { const i = document.querySelector('#lpxArt img'), r = i.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), ok: i.complete && i.naturalWidth > 2000 }; });
    ok(lx.ok && lx.l <= 0 && lx.r >= 1920, 'entrada do Admin: arte estendida cobre a largura toda em 1920×1080', lx);
    await L.close(); await q.close();

    console.log('4) TV: brasão');
    const GIN = process.env.GINASIO_DIR || path.join(RAIZ, 'ginasio');
    const t = await nav.newPage({ viewport: { width: 1920, height: 1080 } }); const e3 = []; t.on('pageerror', e => e3.push(e.message.slice(0, 160)));
    await t.route(/^https?:/, rt => rt.abort());
    await t.goto('file://' + path.join(GIN, 'ginasio.html')); await espera(2500);
    const br = await t.evaluate(() => {
      alunosMap['Ana Brasao'] = { nivel: 'ouro2', bike: 3, watts: 210 }; alunosMap['Beto Sem'] = { nivel: 'aquecimento', bike: 4, watts: 150 };
      const card = _rkBrasao('Ana Brasao'), sem = _rkBrasao('Beto Sem');
      delete alunosMap['Ana Brasao'];   // saiu da sala antes da tela final
      const fim = _fimLinha({ nome: 'Ana Brasao', wpp: 12.3 }, 4, '#ea860c', 20), pod = _fimPodioCol([{ nome: 'Ana Brasao', wpp: 12.3 }]);
      const src = String(atualizaCards);
      return { card: /<svg/.test(card), sem, fim: /dsx-nome"><svg/.test(fim), pod: /dsx-pd-nome"><svg/.test(pod), noCartao: /pc-name">'\+_rkBrasao\(nome\)/.test(src) };
    });
    ok(br.card && br.sem === '' && br.noCartao, 'cartão de potência: brasão ao lado do nome (aquecimento não tem)', br);
    ok(br.fim && br.pod, 'tela final: brasão no pódio e na lista, mesmo de quem já saiu da sala', br);
    ok(!e3.length, 'sem erro de JavaScript na TV', e3);
    await nav.close();
  }
  // limpeza: a aula da rede some e a grade volta a "aula livre"
  r = await j('DELETE', '/admin/biblioteca-rede/' + rid, null, SA);
  ok(r.s === 200 && await sql(`SELECT COALESCE(treino_id::text,'livre') FROM aulas_agenda WHERE nome='Spin Painel Rede'`) === 'livre', 'apagar a aula da rede: grade vira "aula livre"', r.s);
  await sql(`DELETE FROM aulas_agenda WHERE nome LIKE 'Spin Painel%'`); await sql(`DELETE FROM aulas_tv WHERE sala='PR-PAINEL-1'`); await sql(`DELETE FROM aulas_notas WHERE sala='PR-PAINEL-1'`);
  console.log(f ? '\n' + f + ' FALHA(S)' : '\nTUDO OK'); process.exit(f ? 1 : 0);
})().catch(e => { console.log('FALHA erro: ' + (e.stack || e.message)); process.exit(1); });
