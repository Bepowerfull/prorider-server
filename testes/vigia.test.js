// 03/10g — vigia: o servidor avisa por e-mail na hora (TV desligada perto da aula, TV caiu na aula, picos, Asaas)
const B='http://127.0.0.1:3999', M='http://127.0.0.1:3014';
const path=require('path'); const WebSocket=require(require.resolve('ws',{paths:[path.join(__dirname,'..')]}));
async function j(m,p,body,tok,h){const r=await fetch((p.startsWith('http')?'':B)+p,{method:m,headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{}),...(h||{})},body:body?JSON.stringify(body):undefined});let d;try{d=await r.json()}catch(e){d=null}return {s:r.status,d};}
const { sql, pool, ADMIN, ADMIN_SENHA } = require('./comum');
let f=0; const ok=(c,t,x)=>{ console.log((c?'  OK ':'FALHA ')+t+(x!==undefined?'  → '+JSON.stringify(x):'')); if(!c) f++; };
const espera=ms=>new Promise(r=>setTimeout(r,ms));
const IP=n=>({'X-Forwarded-For':'10.8.0.'+n});
async function rodar(SA){ for(let i=0;i<20;i++){ const r=(await j('POST','/admin/alertas/rodar',null,SA)).d; if(!r||!r.pulou) return r||{}; await espera(300);} return {}; }
const emails=async re=>(await j('GET',M+'/_emails')).d.filter(e=>re.test(e.subject));
(async()=>{
  const SA=(await j('POST','/user/login',{email:ADMIN,password:ADMIN_SENHA},null,IP(1))).d.token;
  await sql(`DELETE FROM sistema_alertas`); await j('POST',M+'/_reset');
  const TV=(await j('POST','/display/ativar',{codigo:'D5448D47',device_id:'dev-vigia',nome_computador:'PC Vigia'},null,IP(2))).d.token;
  console.log('1) TV desligada perto da aula da grade');
  await sql(`UPDATE licenca_computadores SET visto_em=NOW()-INTERVAL '20 minutes' WHERE license_codigo='D5448D47'`);
  await sql(`DELETE FROM aulas_agenda WHERE license_id='D5448D47' AND nome='Aula Vigia'`);
  await sql(`INSERT INTO aulas_agenda (license_id, nome, professor_nome, dia_semana, hora) VALUES ('D5448D47','Aula Vigia','Prof Teste',
    EXTRACT(DOW FROM NOW() AT TIME ZONE 'America/Sao_Paulo')::int, ((NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '6 minutes')::time)`);
  let r=await rodar(SA); ok(r.abertos>=1,'aviso aberto',r);
  let em=await emails(/TV desligada/); ok(em.length===1&&em[0].to[0]===ADMIN,'e-mail na hora para o super admin',em.map(e=>e.subject));
  ok(/Aula Vigia/.test(em[0]&&em[0].subject)&&/em 6 min|em 5 min/.test(em[0]&&em[0].html),'diz a aula e quanto falta');
  await rodar(SA); ok((await emails(/desligada/)).length===1,'não repete o mesmo aviso');
  let av=(await j('GET','/admin/alertas',null,SA)).d; ok(av.lista.some(a=>a.tipo==='tv_sem_aula'&&!a.resolvido_em&&a.email_ok),'aparece na Saúde "em aberto", e-mail enviado');
  await j('GET','/display/licenca',null,TV,{'X-PR-Build':'BUILD 03/10g'});   // a TV volta a falar com o servidor
  await rodar(SA);
  av=(await j('GET','/admin/alertas',null,SA)).d; ok(av.lista.find(a=>a.tipo==='tv_sem_aula').resolvido_em,'TV ligou → aviso resolvido');
  ok((await emails(/ligou de novo/)).length===1,'e-mail "TV ligou de novo"');
  console.log('2) TV caiu no meio da aula');
  const ws=new WebSocket(B.replace('http','ws')); await new Promise(o=>ws.on('open',o));
  ws.send(JSON.stringify({tipo:'criar_sala',codigo:'VIG001',display_token:TV})); await espera(300);
  ws.send(JSON.stringify({tipo:'iniciar_aula',grafico:[],blocoIdx:0,nomeAula:'Spinning 19h'})); await espera(300);
  await rodar(SA); ok((await emails(/caiu/)).length===0,'TV ligada: nenhum aviso');
  ws.terminate(); await sql(`UPDATE licenca_computadores SET visto_em=NOW()-INTERVAL '20 minutes' WHERE license_codigo='D5448D47'`);
  await espera(4000); await rodar(SA);
  em=await emails(/caiu no meio da aula/); ok(em.length===1&&/Spinning 19h/.test(em[0].subject),'aviso "TV caiu no meio da aula"',em.map(e=>e.subject));
  const ws2=new WebSocket(B.replace('http','ws')); await new Promise(o=>ws2.on('open',o));
  ws2.send(JSON.stringify({tipo:'criar_sala',codigo:'VIG001',display_token:TV})); await espera(400);
  await rodar(SA); ok((await emails(/voltou/)).length===1,'TV voltou → e-mail "voltou"'); ws2.close();
  console.log('3) Picos e Asaas');
  await sql(`INSERT INTO sistema_eventos (nivel,msg) SELECT 'erro','erro de teste '||g FROM generate_series(1,10) g`);
  await rodar(SA); ok((await emails(/erros do servidor em 10 minutos/)).length===1,'10 erros em 10 min → aviso');
  await j('POST','/webhook/asaas',{event:'PAYMENT_RECEIVED'}); await espera(500);
  await rodar(SA); ok((await emails(/Asaas estão sendo recusados/)).length===1,'webhook do Asaas recusado → aviso');
  await sql(`INSERT INTO sistema_eventos (nivel,msg,origem,licenca,vezes) VALUES ('erro','tela de teste','app','D5448D47',30)`);
  await rodar(SA); const tp=(await j('GET','/admin/alertas',null,SA)).d.lista.find(a=>a.tipo==='telas_pico');
  ok(tp&&tp.email_ok===null&&(await emails(/erros nas telas/)).length===0,'aviso amarelo fica só no painel (sem e-mail)');
  await j('POST','/admin/alertas/email',{ligado:false},SA); await sql(`DELETE FROM sistema_alertas WHERE tipo='erros_pico'`);
  await rodar(SA); ok((await emails(/erros do servidor em 10 minutos/)).length===1,'e-mail dos vermelhos desligado: não manda de novo');
  await j('POST','/admin/alertas/email',{ligado:true},SA); await sql(`DELETE FROM sistema_eventos WHERE msg='tela de teste'`);
  console.log('4) Liga/desliga e teste');
  await j('POST','/admin/alertas/ligar',{ligado:false},SA); r=await rodar(SA); ok(r.desligado,'desligado não verifica');
  await j('POST','/admin/alertas/ligar',{ligado:true},SA);
  r=(await j('POST','/admin/alertas/teste',null,SA)).d; ok(r.ok&&(await emails(/teste dos avisos/)).length===1,'e-mail de teste');
  ok((await j('GET','/admin/alertas',null,null)).s===401,'lista só para o admin');
  await sql(`DELETE FROM sistema_eventos WHERE msg LIKE 'erro de teste %'`); await sql(`DELETE FROM aulas_agenda WHERE nome='Aula Vigia'`);
  await pool.end();
  console.log(f?`\n${f} FALHA(S)`:'\nvigia: tudo OK'); process.exit(f?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
