// 07/10c — E-MAILS DO ALUNO NO MODELO NOVO. Usa o Resend simulado (asaas-simulado.js guarda o que "saiu").
//  1) prévia do Portal: os 11 tipos montam sem {palavra} sobrando, sem "undefined"/"NaN", com a moldura nova
//  2) fim de aula: o app manda a potência minuto a minuto → o e-mail tem os 6 cartões e o gráfico na escala certa;
//     app antigo (sem a série) → barra com o tempo em cada zona
//  3) desafio 21 dias concluído → e-mail "Desafio concluído" (uma vez só)
//  4) campeonato encerrado → e-mail "camisa conquistada" para quem levou a camisa
const path = require('path'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999', MOCK = 'http://127.0.0.1:3014';
const bcrypt = require(require.resolve('bcryptjs', { paths: [RAIZ] }));
const { sql } = require('./comum');
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const IP = n => ({ 'X-Forwarded-For': '10.78.0.' + n });
const login = async (e, ip) => (await j('POST', '/user/login', { email: e, password: '123456' }, null, IP(ip))).d.token;
const caixa = async () => (await (await fetch(MOCK + '/_emails')).json());
async function chegou(para, re, ms = 6000) { const t = Date.now(); while (Date.now() - t < ms) { const e = (await caixa()).filter(x => (x.to || []).includes(para) && re.test(x.subject || '')); if (e.length) return e; await espera(250); } return []; }
const limpo = h => !/\{[a-z_]+\}|undefined|NaN|\[object/.test(h);
(async () => {
  const H = await bcrypt.hash('123456', 10);
  await sql(`DELETE FROM users WHERE email LIKE '%@em.test'`);
  await sql(`INSERT INTO users (email,name,password_hash,role,license_id,termos_versao,ftp) VALUES ('gestora@em.test','Gestora Em','${H}','gestor','D5448D47','x',0),
    ('mario@em.test','Mario Teste','${H}','aluno','D5448D47','x',230), ('bia@em.test','Bia Antiga','${H}','aluno','D5448D47','x',0)`);
  const G = await login('gestora@em.test', 1), A = await login('mario@em.test', 2), A2 = await login('bia@em.test', 3);
  const idA = parseInt(await sql(`SELECT id FROM users WHERE email='mario@em.test'`), 10);

  console.log('1) Prévia do Portal: todos os tipos no modelo novo');
  const g = (await j('GET', '/gestor/emails', null, G)).d;
  const tipos = Object.keys(g.padrao || {});
  ok(tipos.includes('conquista_camisa') && tipos.includes('desafio_concluido') && tipos.includes('seu_mes') && tipos.length === 11, 'Portal lista os 11 tipos', tipos);
  ok(g.cfg.conquista_camisa === true && g.cfg.desafio_concluido === true, 'os 2 novos já vêm ligados', g.cfg);
  for (const t of tipos) {
    const p = (await j('POST', '/gestor/emails/previa', { tipo: t }, G)).d || {};
    ok(!!p.html && limpo(p.html + p.subject) && /RIDE WITH/.test(p.html) && /email-hero\.jpg/.test(p.html) && /email-logo\.png/.test(p.html), 'prévia "' + t + '" monta limpa na moldura nova', p.subject);
  }
  const pv = async t => (await j('POST', '/gestor/emails/previa', { tipo: t }, G)).d.html;
  const todos = {}; for (const t of tipos) todos[t] = await pv(t);
  ok(tipos.filter(t => t !== 'relatorio_mensal').every(t => />Ana!/.test(todos[t])), 'todos os e-mails do aluno trazem o nome em destaque', tipos.filter(t => !/>Ana!/.test(todos[t])));
  ok(/Escaneie o QR da bike/.test(todos.boas_vindas) && /SENTIMOS SUA FALTA/.test(todos.sumido) && />16<\/div>/.test(todos.sumido) && /FELIZ ANIVERSÁRIO/.test(todos.aniversario)
    && />18:30<\/div>/.test(todos.lembrete_aula) && /VAGA GARANTIDA/.test(todos.vaga_aberta) && />192<\/span>/.test(todos.novo_ftp) && /Imprevisto\?/.test(todos.vaga_aberta), 'cada tipo com o seu selo/cartões e o recado em caixa');
  const pr = (await j('POST', '/gestor/emails/previa', { tipo: 'resumo_aula' }, G)).d.html;
  ok(/POTÊNCIA MINUTO A MINUTO · 55 MIN/.test(pr) && /Excelente trabalho!/.test(pr) && />Ana! 🔥</.test(pr), 'resumo: gráfico de 55 min, recado e o nome em destaque');
  const pt = (await j('POST', '/gestor/emails/previa', { tipo: 'resumo_aula', texto: { titulo: 'Valeu, {nome}!', fechamento: 'Até quinta <b>!' } }, G)).d.html;
  ok(/Valeu,<\/div>/.test(pt) && />Ana!</.test(pt) && /Até quinta &lt;b&gt;!/.test(pt), 'texto próprio da academia: título dividido no nome e HTML escapado');
  const pc = (await j('POST', '/gestor/emails/previa', { tipo: 'conquista_camisa' }, G)).d;
  ok(/CAMISA AMARELA/.test(pc.html) && /#ffd400/.test(pc.html) && /Camisa amarela/.test(pc.subject), 'camisa: selo amarelo e assunto com a camisa', pc.subject);
  const pd = (await j('POST', '/gestor/emails/previa', { tipo: 'desafio_concluido' }, G)).d;
  ok(/DESAFIO 21 DIAS/.test(pd.html) && /\+500 pontos na sua conta/.test(pd.html) && /Quebra FTP/.test(pd.html) && /21 dias concluído: \+500/.test(pd.subject), 'desafio: selo, pontos, próximo desafio', pd.subject);

  console.log('2) Fim de aula: o e-mail que sai de verdade');
  const serie = Array.from({ length: 44 }, (_, i) => i < 10 ? 100 : i < 30 ? 240 : i < 37 ? 270 : 110);
  let r = await j('POST', '/aula/complete', { aula_nome: 'HIIT Threshold #3', duracao_sec: 2640, zona_predominante: 'z4', zonas: { z2: 30, z4: 50, z5: 20 }, watts_med: 205, rpm_med: 92, kcal: 312, serie_min: serie.concat(['x', -5, 99999]) }, A);
  ok(r.s === 200, 'aula gravada', r.s);
  let e = await chegou('mario@em.test', /resumo da aula/);
  const h = e[0] && e[0].html || '';
  ok(e.length === 1, 'e-mail de resumo saiu para o aluno', e.length);
  ok(/Parabéns pela aula,<\/div>/.test(h) && />Mario! 🔥</.test(h) && /HIIT Threshold #3/.test(h), 'título com o nome em destaque e o nome da aula');
  ok(/>44<\/span>/.test(h) && />312<\/span>/.test(h) && />205<\/span>/.test(h) && />92<\/span>/.test(h) && />Z4<\/span>/.test(h), 'os 6 cartões com os números da aula');
  const barras = (h.match(/border-radius:2px 2px 0 0/g) || []).length;
  ok(/POTÊNCIA MINUTO A MINUTO · 44 MIN/.test(h) && barras === 47, 'gráfico: 44 minutos + os 3 valores lixo viram barras limpas (sem quebrar)', barras);
  // escala: 100 W / FTP 230 = 43% → Z1 cinza ; 240 W = 104% → Z4 ; 270 W = 117% → Z5
  ok(/height:39px;background:#a1a1a1/.test(h) && /height:93px;background:#d7c414/.test(h) && /height:104px;background:#ea860c/.test(h), 'barras na altura e na cor da zona (FTP 230 do aluno)');
  ok(limpo(h) && /Excelente trabalho!/.test(h), 'sem {palavra}, undefined ou NaN');
  await j('POST', '/aula/complete', { aula_nome: 'Aula antiga', duracao_sec: 1800, zona_predominante: 'z3', zonas: { z1: 20, z3: 80 }, watts_med: 150, rpm_med: 85, kcal: 200 }, A2);
  e = await chegou('bia@em.test', /resumo da aula/);
  const h2 = e[0] && e[0].html || '';
  ok(/TEMPO EM CADA ZONA/.test(h2) && !/MINUTO A MINUTO/.test(h2) && /width="80%"/.test(h2), 'app antigo / sem FTP: barra com o tempo em cada zona', e.length);

  console.log('3) Desafio 21 dias');
  for (let d = 0; d < 21; d++) await sql(`INSERT INTO aula_historico (user_id, nome, dur_seg, kcal, zona_pct, avg_ftp, avg_rpm, avg_watts, data_aula) VALUES (${idA},'x',1800,200,'{}',80,85,180, NOW() - INTERVAL '${d} days')`);
  const m = (await j('GET', '/desafios/meus', null, A)).d;
  ok(m.d21 && m.d21.conquistado_agora, 'conquistou o 21 dias', m.d21);
  e = await chegou('mario@em.test', /Desafio 21 dias concluído/);
  ok(e.length === 1 && /21 dias diferentes pedalando/.test(e[0].html) && /\+500 pontos na sua conta/.test(e[0].html) && limpo(e[0].html), 'e-mail do desafio saiu', e.length);
  await j('GET', '/desafios/meus', null, A); await espera(800);
  ok((await chegou('mario@em.test', /Desafio 21 dias/, 500)).length === 1, 'não manda duas vezes');

  console.log('4) Camisa conquistada no campeonato');
  const hoje = new Date().toISOString().slice(0, 10);
  r = await j('POST', '/gestor/campeonatos', { nome: 'Copa Teste', tipo: 'tour', etapas: [{ data: hoje, hora: '07:00', nome: 'Etapa 1' }] }, G);
  ok(r.s === 200 && r.d.id, 'campeonato criado', r.s);
  const et = parseInt(await sql(`SELECT id FROM campeonato_etapas WHERE campeonato_id=${r.d.id}`), 10);
  await sql(`UPDATE campeonato_etapas SET feita=true, feita_em=NOW() WHERE id=${et}`);
  await sql(`INSERT INTO campeonato_resultados (etapa_id, campeonato_id, user_id, nome, posicao, pontos) VALUES (${et}, ${r.d.id}, ${idA}, 'Mario Teste', 1, 150), (${et}, ${r.d.id}, NULL, 'Visitante', 2, 90)`);
  const enc = await j('POST', '/gestor/campeonatos/' + r.d.id + '/encerrar', {}, G);
  ok(enc.s === 200, 'campeonato encerrado', enc.s);
  e = await chegou('mario@em.test', /conquistou a Camisa amarela/);
  ok(e.length === 1 && /CAMISA AMARELA/.test(e[0].html) && /Copa Teste/.test(e[0].html) && />150<\/span>/.test(e[0].html) && limpo(e[0].html), 'e-mail da camisa amarela saiu (com os pontos)', e.map(x => x.subject));

  console.log('5) Aula lotada → lista de espera → abriu vaga → e-mail');
  const am = new Date(Date.now() - 3 * 3600e3 + 24 * 3600e3), dia = am.toISOString().slice(0, 10);
  const AG = parseInt(await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_nome,dia_semana,hora,duracao_min,vagas_max,ativa) VALUES ('D5448D47','Aula Lotada','Prof',${am.getUTCDay()},'19:00',45,1,true) RETURNING id`), 10);
  const rA = await j('POST', '/aluno/reservar', { agenda_id: AG, data_aula: dia, bike: 1 }, A);
  ok(rA.s === 200 && rA.d.id, 'Mario pegou a única bike', rA.s);
  const rB = await j('POST', '/aluno/reservar', { agenda_id: AG, data_aula: dia, bike: 1 }, A2);
  ok(rB.s === 409 && rB.d.lotada === true, 'Bia tenta reservar: aula lotada (o app já põe ela na fila)', rB.d);
  const fB = await j('POST', '/aluno/espera', { agenda_id: AG, data_aula: dia }, A2);
  ok(fB.s === 200 && fB.d.posicao === 1, 'Bia entrou na fila: 1ª', fB.d);
  await j('DELETE', '/aluno/reservar/' + rA.d.id, null, A);
  e = await chegou('bia@em.test', /Abriu uma vaga: Aula Lotada às 19:00/);
  ok(e.length === 1 && /VAGA GARANTIDA/.test(e[0].html) && />Bia!</.test(e[0].html) && limpo(e[0].html), 'Mario cancelou → Bia recebe "Abriu uma vaga" (bike 1)', e.map(x => x.subject));
  ok(await sql(`SELECT bike_numero||'|'||status FROM aulas_reservas WHERE agenda_id=${AG} AND user_id=(SELECT id FROM users WHERE email='bia@em.test')`) === '1|reservado', 'a reserva da Bia já está feita na bike 1');

  console.log('6) Academia desligou → não sai');
  await j('PUT', '/gestor/emails', Object.assign({}, g.cfg, { resumo_aula: false }), G);
  const antes = (await caixa()).length;
  await j('POST', '/aula/complete', { aula_nome: 'Mais uma', duracao_sec: 600, zona_predominante: 'z2', zonas: { z2: 100 }, watts_med: 120, rpm_med: 80, kcal: 60 }, A); await espera(1500);
  ok((await caixa()).length === antes, 'resumo desligado no Portal: nada sai');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
