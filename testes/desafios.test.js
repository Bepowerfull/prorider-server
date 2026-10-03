const B='http://127.0.0.1:3999';
async function j(m,p,body,tok){const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined});let d;try{d=await r.json()}catch(e){d=null}return {s:r.status,d};}
const { sql, pool, ADMIN, ADMIN_SENHA } = require('./comum');
let f=0; const ok=(c,t,x)=>{ console.log((c?'  OK ':'FALHA ')+t+(x!==undefined?'  → '+JSON.stringify(x):'')); if(!c) f++; };
(async()=>{
  await sql("delete from users where email in ('d1@x.com','d2@x.com')");
  await j('POST','/user/register',{name:'Dani Um',email:'d1@x.com',password:'123456'}); await j('POST','/user/register',{name:'Duda Dois',email:'d2@x.com',password:'123456'});
  const A=(await j('POST','/user/login',{email:'d1@x.com',password:'123456'})).d.token, Bt=(await j('POST','/user/login',{email:'d2@x.com',password:'123456'})).d.token;
  const ida=await sql("select id from users where email='d1@x.com'"), idb=await sql("select id from users where email='d2@x.com'");
  console.log('1) 21 dias');
  let m=(await j('GET','/desafios/meus',null,A)).d; ok(m.d21.dias===0&&m.d21.meta===21,'começa em 0/21');
  // 20 dias diferentes (2 aulas no mesmo dia contam 1)
  for(let i=0;i<20;i++) await sql(`insert into aula_historico (user_id,nome,data_aula) values (${ida},'x',now()-interval '${i} days')`);
  await sql(`insert into aula_historico (user_id,nome,data_aula) values (${ida},'x',now()-interval '1 hour')`);
  m=(await j('GET','/desafios/meus',null,A)).d; ok(m.d21.dias===20&&!m.d21.conquistado_agora,'20 dias (2 aulas no mesmo dia = 1)',m.d21.dias);
  await sql(`insert into aula_historico (user_id,nome,data_aula) values (${ida},'x',now()-interval '25 days')`);
  const pts0=+await sql(`select points from users where id=${ida}`);
  m=(await j('GET','/desafios/meus',null,A)).d; ok(m.d21.dias===21&&m.d21.conquistado_agora,'21 dias → conquistou');
  ok(+await sql(`select points from users where id=${ida}`)===pts0+500,'+500 pontos');
  m=(await j('GET','/desafios/meus',null,A)).d; ok(!m.d21.conquistado_agora,'não ganha duas vezes');
  console.log('2) Quebra FTP');
  await sql(`update users set ftp=200 where id in (${ida},${idb})`);
  await sql(`update ftp_historico set created_at=date_trunc('month',now())-interval '3 days' where user_id in (${ida},${idb})`);
  await sql(`update users set ftp=212 where id=${ida}`); await sql(`update users set ftp=204 where id=${idb}`);
  m=(await j('GET','/desafios/meus',null,A)).d; ok(m.ftp.base===200&&m.ftp.atual===212&&m.ftp.ganho_pct===6&&m.ftp.conquistado_agora,'200 → 212 = +6% (meta 5%) → conquistou',m.ftp);
  let rk=(await j('GET','/desafios/ranking/ftp')).d.ranking; ok(rk[0].nome==='Dani Um'&&rk[0].valor===6&&rk.find(x=>x.nome==='Duda Dois').valor===2,'ranking FTP',rk.slice(0,2));
  console.log('3) Ranking mensal e grupos');
  rk=(await j('GET','/desafios/ranking/mensal')).d.ranking; ok(rk.find(x=>x.nome==='Dani Um'),'mensal tem a Dani');
  rk=(await j('GET','/desafios/ranking/21dias')).d.ranking; ok(rk[0].nome==='Dani Um'&&rk[0].valor===21,'ranking 21 dias');
  let g=(await j('POST','/desafios/grupos',{nome:'Turma Terça',desafio_id:'21dias'},A)).d; ok(/^GRP-/.test(g.codigo),'grupo criado',g.codigo);
  ok((await j('POST','/desafios/grupos/'+g.codigo+'/entrar',null,Bt)).d.ok,'Duda entra');
  let gr=(await j('GET','/desafios/grupos/'+g.codigo+'/ranking')).d; ok(gr.ranking.length===2&&gr.ranking[0].nome==='Dani Um'&&gr.ranking[1].valor===0,'ranking do grupo (21 dias, Duda com 0)',gr.ranking.map(x=>x.nome+':'+x.valor));
  ok((await j('GET','/desafios/meus',null,Bt)).d.grupos.length===1,'grupo aparece em "meus" (qualquer aparelho)');
  ok((await j('POST','/desafios/grupos/'+g.codigo+'/sair',null,Bt)).d.ok && (await j('GET','/desafios/meus',null,Bt)).d.grupos.length===0,'sair do grupo');
  console.log(f?f+' FALHA(S)':'TUDO OK'); await pool.end(); process.exit(f?1:0);
})();
