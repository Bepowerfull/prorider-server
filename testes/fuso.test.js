// 03/10s — HORÁRIO DE BRASÍLIA. O banco do Railway fica em UTC: depois das 21h o "hoje" do banco já
// era amanhã (a reserva da aula da noite sumia do app) e a conta dos minutos até a próxima aula
// (contagem e início automático na TV) saía errada em horas. Este teste roda a qualquer hora.
const B = 'http://127.0.0.1:3999';
async function j(m, p, body, tok) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
const { sql , codigoTv } = require('./comum');
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
(async () => {
  const br = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = br.getFullYear() + '-' + String(br.getMonth() + 1).padStart(2, '0') + '-' + String(br.getDate()).padStart(2, '0');
  const agoraMin = br.getHours() * 60 + br.getMinutes(), alvoMin = Math.min(agoraMin + 30, 23 * 60 + 59);
  const hora = String(Math.floor(alvoMin / 60)).padStart(2, '0') + ':' + String(alvoMin % 60).padStart(2, '0');
  console.log('  (agora em Brasília: ' + hoje + ' ' + String(br.getHours()).padStart(2, '0') + ':' + String(br.getMinutes()).padStart(2, '0') + ', aula às ' + hora + ')');
  await sql(`DELETE FROM aulas_agenda WHERE nome='Aula Fuso'`); await sql(`DELETE FROM users WHERE email='fuso@x.com'`);
  const AG = await sql(`INSERT INTO aulas_agenda (license_id,nome,professor_nome,dia_semana,hora,duracao_min,vagas_max,ativa) VALUES ('D5448D47','Aula Fuso','Prof',${br.getDay()},'${hora}',45,12,true) RETURNING id`);
  const D = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-fuso', nome_computador: 'TV fuso' })).d.token;

  console.log('1) Próxima aula na TV');
  const r = await j('GET', '/display/proxima-aula', null, D), pa = r.d && r.d.proxima_aula;
  const esperado = (alvoMin - agoraMin) * 60 - br.getSeconds();
  ok(pa && pa.nome === 'Aula Fuso', 'acha a aula de hoje (dia de Brasília)', pa && pa.nome);
  ok(pa && Math.abs(pa.segundos_ate_aula - esperado) <= 120, 'minutos até a aula certos (antes errava em horas)', pa && { servidor: pa.segundos_ate_aula, esperado });

  console.log('2) Reserva de hoje aparece no app (também à noite)');
  const U = (await j('POST', '/user/register', { email: 'fuso@x.com', nome: 'Fuso Teste', senha: '123456', aceite_termos: true, aceite_saude: true })).d.token;
  const rv = await j('POST', '/aluno/reservar', { agenda_id: parseInt(AG, 10), data_aula: hoje, bike: 2 }, U);
  ok(rv.s === 200, 'reservou a bike 2', rv.s);
  const l = (await j('GET', '/aluno/reservas', null, U)).d || [];
  ok(l.some(x => x.agenda_id === parseInt(AG, 10) && x.data_aula === hoje), '"Minhas reservas" mostra a de hoje', l.map(x => x.data_aula));
  const g = (await j('GET', '/display/reservas/agora', null, D)).d;
  ok(g && Array.isArray(g.reservas), 'TV lê as reservas de agora sem erro');

  await sql(`DELETE FROM aulas_agenda WHERE nome='Aula Fuso'`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
