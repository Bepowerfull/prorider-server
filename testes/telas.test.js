// 03/10f — erros das telas chegam na Saúde + envios do fim da aula aceitam repetição (TV sem internet)
const B='http://127.0.0.1:3999';
async function j(m,p,body,tok,h){const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{}),...(h||{})},body:body?JSON.stringify(body):undefined});let d;try{d=await r.json()}catch(e){d=null}return {s:r.status,d};}
const { sql, pool, ADMIN, ADMIN_SENHA } = require('./comum');
let f=0; const ok=(c,t,x)=>{ console.log((c?'  OK ':'FALHA ')+t+(x!==undefined?'  → '+JSON.stringify(x):'')); if(!c) f++; };
const IP=n=>({'X-Forwarded-For':'10.9.0.'+n});
(async()=>{
  const SA=(await j('POST','/user/login',{email:ADMIN,password:ADMIN_SENHA},null,IP(1))).d.token;
  await j('POST','/admin/saude/eventos/limpar',{tipo:'telas'},SA);
  const at=await j('POST','/display/ativar',{codigo:'D5448D47',device_id:'dev-telas',nome_computador:'PC Teste'},null,IP(2));
  ok(at.s===200&&at.d.token,'TV ativada para o teste',at.s); const TV=at.d.token;

  console.log('1) Erros das telas');
  let r=await j('POST','/suporte/erro',{origem:'tv',versao:'BUILD 03/10f',erros:[{msg:"Cannot read properties of null (reading 'x') at 12",stack:'at f (script.js:12)',onde:'script.js:12'}]},TV,IP(3));
  ok(r.d&&r.d.gravados===1,'erro da TV gravado',r.d);
  await j('POST','/suporte/erro',{origem:'tv',erros:[{msg:"Cannot read properties of null (reading 'x') at 99"}]},TV,IP(3));
  let ln=(await sql(`select origem, licenca, vezes from sistema_eventos where origem='tv'`)).split('\n');
  ok(ln.length===1&&ln[0]==='tv|D5448D47|2','mesmo erro (só muda número) soma em "vezes" e sabe a academia',ln);
  r=await j('POST','/suporte/erro',{origem:'app',erros:[{msg:'Script error.'},{msg:'ResizeObserver loop limit exceeded'},{msg:'x is not a function',nivel:'erro'}]},null,IP(4));
  ok(r.d.gravados===1,'ruído do navegador ignorado; sem login também aceita',r.d);
  const velho=new Date(Date.now()-3*3600000).toISOString();
  r=await j('POST','/suporte/erro',{origem:'tv',erros:[{msg:'TV ficou sem internet: resumo guardado',nivel:'aviso',quando:velho}]},TV,IP(3));
  const q=(await sql(`select created_at from sistema_eventos where msg like 'TV ficou sem internet%'`));
  ok(r.d.gravados===1&&q.length>0,'aviso offline guarda a hora em que aconteceu',q);
  ok((await j('POST','/suporte/erro',{origem:'tv'},null,IP(5))).s===400,'pedido vazio recusado');
  let bloq=0; for(let i=0;i<125;i++){ const x=await j('POST','/suporte/erro',{origem:'portal',erros:[{msg:'flood '+String.fromCharCode(97+i%26)+i}]},null,IP(6)); if(x.s===429) bloq++; }
  ok(bloq>0,'limite por IP (ninguém lota o banco)',bloq);
  const sd=(await j('GET','/admin/saude',null,SA)).d;
  ok(Array.isArray(sd.telas)&&sd.telas.some(e=>e.origem==='tv'&&e.academia==='Academia Teste'),'Saúde mostra "o que as telas avisaram" com o nome da academia');
  ok(sd.telas_24h&&sd.telas_24h.tv&&sd.telas_24h.tv.erro===2&&sd.telas_24h.tv.aviso===1,'contagem por origem (24 h)',sd.telas_24h&&sd.telas_24h.tv);
  ok(!sd.eventos.some(e=>/Cannot read/.test(e.msg)),'erros das telas não misturam com os do servidor');
  ok(sd.alertas.some(a=>/erro\(s\) nas telas/.test(a.txt)),'alerta no topo da Saúde');
  await j('POST','/admin/saude/eventos/limpar',{tipo:'servidor'},SA);
  ok(+(await sql(`select count(*) from sistema_eventos where origem is not null`))>0,'"limpar servidor" não apaga os avisos das telas');
  await j('POST','/admin/saude/eventos/limpar',{tipo:'telas'},SA);
  ok(+(await sql(`select count(*) from sistema_eventos where origem is not null`))===0,'"limpar telas" apaga só as telas');

  console.log('2) TV sem internet: reenviar não duplica');
  const uid='a'+Date.now().toString(36);
  const corpo={uid,sala:'ZZ11',nome_aula:'Aula offline',inicio:new Date().toISOString(),dur_seg:2700,alunos:[{nome:'Ana',wpp:2.5,kcal:400,km:20,w:180}]};
  r=await j('POST','/display/aula/resumo',corpo,TV); ok(r.s===200,'resumo enviado',r.s);
  r=await j('POST','/display/aula/resumo',corpo,TV); ok(r.s===200,'mesmo resumo de novo (fila da TV) aceito',r.s);
  ok((await sql(`select count(*) from aulas_tv where uid='${uid}'`))==='1','resumo continua 1 só');
  const g={nome_aula:'Aula offline',professor:'Prof',dur_seg:60,arquivo:'C:/x.webm',bytes:1000,uid:'g'+uid,roteiro:{uid:'g'+uid,a:[[1,2]]}};
  const g1=await j('POST','/display/gravacao',g,TV), g2=await j('POST','/display/gravacao',g,TV);
  ok(g1.s===200&&g2.d.id===g1.d.id&&g2.d.repetida,'ficha da gravação repetida = mesma gravação',[g1.d.id,g2.d.id]);
  ok((await sql(`select count(*) from aulas_gravadas where uid='g${uid}'`))==='1','gravação continua 1 só');
  await pool.end();
  console.log(f?`\n${f} FALHA(S)`:'\ntelas: tudo OK'); process.exit(f?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
