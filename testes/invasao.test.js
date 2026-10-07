// 03/10w — TENTATIVAS DE INVASÃO (revisão de segurança antes do lançamento).
// Cada item tenta de verdade o que um aluno, um gestor de outra academia ou alguém de fora
// conseguia fazer antes, e confere que agora é recusado.
const path = require('path'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999';
const WS = require(require.resolve('ws', { paths: [RAIZ] })), bcrypt = require(require.resolve('bcryptjs', { paths: [RAIZ] }));
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
const { sql, ADMIN, ADMIN_SENHA, codigoTv } = require('./comum');
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const IP = n => ({ 'X-Forwarded-For': '10.77.0.' + n });
const login = async (e, ip) => (await j('POST', '/user/login', { email: e, password: '123456' }, null, IP(ip || 1))).d.token;
function sock() { const w = new WS(B.replace('http', 'ws')); w.msgs = []; w.on('message', m => { try { w.msgs.push(JSON.parse(m)); } catch (e) {} }); return new Promise(o => w.on('open', () => o(w))); }
(async () => {
  const H = await bcrypt.hash('123456', 10);
  await sql(`DELETE FROM users WHERE email LIKE '%@inv.test'`); await sql(`DELETE FROM licencas WHERE codigo='INVB0001'`);
  await sql(`INSERT INTO licencas (codigo, nome, status, max_bikes, valor_mensal) VALUES ('INVB0001','Academia B','ativa',10,199)`);
  for (const [e, n, r, l] of [['gestora@inv.test', 'Gestora A', 'gestor', 'D5448D47'], ['coord@inv.test', 'Coord A', 'coordenador', 'D5448D47'], ['gestorb@inv.test', 'Gestor B', 'gestor', 'INVB0001'],
    ['aluna@inv.test', 'Aluna Vitima', 'aluno', 'D5448D47'], ['alunob@inv.test', 'Aluno Bea Silva', 'aluno', 'INVB0001'], ['esperto@inv.test', 'Aluno Esperto', 'aluno', 'D5448D47']])
    await sql(`INSERT INTO users (email,name,password_hash,role,license_id,termos_versao) VALUES ('${e}','${n}','${H}','${r}','${l}','x')`);
  const id = async e => parseInt(await sql(`SELECT id FROM users WHERE email='${e}'`), 10);
  const SA = (await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA }, null, IP(2))).d.token;
  const GA = await login('gestora@inv.test', 3), CO = await login('coord@inv.test', 4), GB = await login('gestorb@inv.test', 5), AL = await login('esperto@inv.test', 6);
  const idAdmin = parseInt(await sql(`SELECT id FROM users WHERE email='${ADMIN}'`), 10), idAlunaB = await id('alunob@inv.test'), idGestora = await id('gestora@inv.test');

  console.log('1) Rotas antigas de licença (aluno virava professor)');
  ok((await j('POST', '/license/generate-mobile-token', { license_token: AL })).s === 404, '/license/generate-mobile-token não existe mais');
  ok((await j('POST', '/license/activate-mobile', { qr_token: 'x', device_id: 'y' }, AL)).s === 404, '/license/activate-mobile não existe mais');

  console.log('2) Gestor/coordenador fora da própria academia');
  let r = await j('POST', '/gestor/alunos/' + idAdmin + '/reset-senha', { password: 'hacked1' }, CO);
  ok(r.s === 403, 'coordenador NÃO troca a senha do super admin', r.s);
  ok((await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA }, null, IP(7))).s === 200, 'senha do super admin continua a mesma');
  ok((await j('POST', '/gestor/alunos/' + idGestora + '/reset-senha', { password: 'hacked1' }, CO)).s === 403, 'coordenador NÃO troca a senha da própria gestora');
  ok((await j('POST', '/gestor/alunos/' + idAlunaB + '/reset-senha', { password: 'hacked1' }, GA)).s === 403, 'gestora NÃO troca senha de aluno de outra academia');
  ok((await j('PUT', '/gestor/alunos/' + idAlunaB, { email: 'roubado@inv.test' }, GA)).s === 403, 'gestora NÃO edita aluno de outra academia');
  ok((await j('GET', '/gestor/alunos/' + idAdmin, null, GA)).s === 404, 'gestora NÃO lê os dados do super admin');
  ok((await j('GET', '/gestor/alunos/' + idAlunaB, null, GA)).s === 404, 'gestora NÃO lê aluno de outra academia');
  ok((await j('GET', '/gestor/alunos/' + (await id('aluna@inv.test')), null, GA)).s === 200, 'gestora lê aluno da própria academia (continua funcionando)');
  r = await j('POST', '/gestor/professores', { email: 'gestora@inv.test', license_id: 'INVB0001' }, GA);
  ok(await sql(`SELECT count(*) FROM professor_licencas WHERE license_id='INVB0001' AND user_id=${idGestora}`) === '0', 'gestora NÃO se dá acesso à outra academia', r.s);
  r = await j('POST', '/gestor/equipe', { email: 'alunob@inv.test', papel: 'professor' }, GA);
  ok(r.s === 409 && await sql(`SELECT role || ' ' || license_id FROM users WHERE id=${idAlunaB}`) === 'aluno INVB0001', 'gestora NÃO puxa aluno de outra academia para a equipe', r.s);
  const agB = await sql(`INSERT INTO aulas_agenda (license_id,nome,dia_semana,hora,ativa) VALUES ('INVB0001','Aula B',1,'08:00',true) RETURNING id`);
  ok((await j('POST', '/gestor/agenda/' + parseInt(agB) + '/walkin', { user_id: idAlunaB }, GA)).s === 404, 'gestora NÃO lança presença em aula de outra academia');
  r = await j('POST', '/gestor/emails/teste', { email: 'qualquer@externo.com' }, GA);
  ok(!r.d || r.d.para !== 'qualquer@externo.com', 'e-mail de teste só vai para o próprio gestor', r.d && (r.d.para || r.d.error));

  console.log('3) Ativar TV de outra academia');
  ok((await j('POST', '/display/ativar', { codigo: 'D5448D47', device_id: 'invasor' }, null, IP(8))).s === 404, 'o código público da licença NÃO ativa a TV');
  const CT = await codigoTv('D5448D47');
  ok(/^[A-Z0-9]{8}$/.test(CT || '') && (await j('POST', '/display/ativar', { codigo: CT.toLowerCase(), device_id: 'tv-inv' }, null, IP(8))).s === 200, 'o código secreto da TV ativa (maiúscula/minúscula tanto faz)');
  const lista = (await j('GET', '/admin/licencas', null, SA)).d; const la = (Array.isArray(lista) ? lista : lista.licencas || []).find(x => x.codigo === 'D5448D47');
  ok(la && la.codigo_tv === CT, 'Admin → Licenças mostra o código da TV');

  console.log('4) Sala ao vivo (WebSocket)');
  const TVA = (await j('POST', '/display/ativar', { codigo: CT, device_id: 'tv-inv-a' }, null, IP(9))).d.token;
  const TVB = (await j('POST', '/display/ativar', { codigo: await codigoTv('INVB0001'), device_id: 'tv-inv-b' }, null, IP(9))).d.token;
  const tv = await sock(); tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: 'PR-INV1-TEST', display_token: TVA })); await espera(300);
  ok(tv.msgs.some(m => m.tipo === 'sala_criada'), 'TV com token abre a sala');
  const x1 = await sock(); x1.send(JSON.stringify({ tipo: 'criar_sala', codigo: 'PR-INV1-TEST' })); await espera(300);
  ok(x1.msgs.some(m => m.tipo === 'erro') && !x1.msgs.some(m => m.tipo === 'sala_criada'), 'sem token NÃO toma a sala', x1.msgs.map(m => m.tipo));
  const x2 = await sock(); x2.send(JSON.stringify({ tipo: 'criar_sala', codigo: 'PR-INV1-TEST', display_token: TVB })); await espera(300);
  ok(x2.msgs.some(m => m.tipo === 'erro'), 'TV de outra academia NÃO toma a sala');
  const vit = await sock(); vit.send(JSON.stringify({ tipo: 'entrar_sala', codigo: 'PR-INV1-TEST', nome: 'Aluna Vitima', bike: 2, token: await login('aluna@inv.test', 10) })); await espera(300);
  const esp = await sock(); esp.send(JSON.stringify({ tipo: 'entrar_sala', codigo: 'PR-INV1-TEST', nome: 'Aluno Esperto', bike: 3, token: AL })); await espera(300);
  esp.send(JSON.stringify({ tipo: 'fim_aula' })); esp.send(JSON.stringify({ tipo: 'update_aula', grafico: [{ z: 'z7' }], blocoIdx: 0 })); await espera(400);
  ok(!vit.msgs.some(m => m.tipo === 'fim_aula' || m.tipo === 'update_aula'), 'aluno NÃO encerra a aula nem manda gráfico falso para os outros', vit.msgs.map(m => m.tipo));
  const sq = await sock(); sq.send(JSON.stringify({ tipo: 'entrar_sala', codigo: 'PR-INV1-TEST', nome: 'Aluna Vitima', bike: 5 })); await espera(300);
  ok(sq.msgs.some(m => m.tipo === 'erro') && vit.readyState === 1, 'ninguém derruba a aluna usando o nome dela', sq.msgs.map(m => m.tipo));
  const agA = parseInt(await sql(`INSERT INTO aulas_agenda (license_id,nome,dia_semana,hora,ativa) VALUES ('D5448D47','Aula Inv',${new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()},'23:59',true) RETURNING id`), 10);
  const hoje = await sql(`SELECT to_char((NOW() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD')`);
  await sql(`INSERT INTO aulas_reservas (agenda_id,user_id,data_aula,status,bike_numero) VALUES (${agA},${await id('aluna@inv.test')},'${hoje}','reservado',2)`);
  const fake = await sock(); fake.send(JSON.stringify({ tipo: 'entrar_sala', codigo: 'PR-INV1-TEST', nome: 'Fulano', bike: 6, user_id: await id('aluna@inv.test') })); await espera(500);
  ok(await sql(`SELECT status FROM aulas_reservas WHERE agenda_id=${agA}`) === 'reservado', 'mandar o user_id de outra pessoa NÃO marca presença por ela');
  [tv, x1, x2, vit, esp, sq, fake].forEach(w => { try { w.close(); } catch (e) {} });

  console.log('5) Link de cadastro da academia');
  await sql(`UPDATE licencas SET onboarding_token='tok-inv-123' WHERE codigo='INVB0001'`);
  r = await j('POST', '/onboarding/tok-inv-123', { gestor_email: ADMIN, gestor_senha: 'hacked1' });
  ok(r.s === 409 && (await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA }, null, IP(11))).s === 200, 'link de cadastro NÃO troca a senha de conta que já existe', r.s);

  console.log('6) Totem da academia');
  const tt = (await j('GET', '/gestor/totem', null, GA)).d; const T = tt && (tt.token || (tt.url || '').split('#')[1]);
  if (T) {
    ok((await j('POST', '/totem/' + T + '/identificar', { email: 'alunob@inv.test' })).s === 404, 'totem NÃO mostra aluno de outra academia');
    ok((await j('POST', '/totem/' + T + '/identificar', { email: ADMIN })).s === 404, 'totem NÃO mostra o super admin');
    ok((await j('POST', '/totem/' + T + '/identificar', { email: 'aluna@inv.test' })).s === 200, 'totem acha aluno da própria academia');
    ok((await j('POST', '/totem/' + T + '/reservar', { user_id: idAlunaB, agenda_id: agA, data_aula: hoje })).s === 404, 'totem NÃO reserva em nome de aluno de outra academia');
  } else ok(false, 'totem de teste criado', tt);

  console.log('7) Rankings abertos');
  await sql(`INSERT INTO aula_historico (user_id, nome, data_aula, dur_seg) VALUES (${idAlunaB},'x',NOW(),3000)`).catch(() => {});
  const rk = (await j('GET', '/desafios/ranking/mensal')).d.ranking || [];
  ok(!rk.some(x => /Bea Silva/.test(x.nome || '')), 'ranking sem login mostra só primeiro nome + inicial', rk.map(x => x.nome).slice(0, 5));

  await sql(`DELETE FROM aulas_reservas WHERE agenda_id=${agA}`); await sql(`DELETE FROM aulas_agenda WHERE id IN (${agA},${parseInt(agB)})`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
