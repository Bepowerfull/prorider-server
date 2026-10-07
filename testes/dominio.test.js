// 03/10r — domínio próprio app.prorider.app.br (o endereço antigo do Railway continua valendo)
const fs=require('fs'), path=require('path');
const B='http://127.0.0.1:3999';
async function j(m,p,body,tok){const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined});let d;try{d=await r.json();}catch(e){}return{s:r.status,d};}
const { ADMIN, ADMIN_SENHA } = require('./comum');
let f=0; const ok=(c,t,x)=>{ console.log((c?'  OK ':'FALHA ')+t+(x!==undefined?'  → '+JSON.stringify(x):'')); if(!c) f++; };
const RAIZ=path.join(__dirname,'..'), PUB=path.join(RAIZ,'public');
(async()=>{
  console.log('1) Nenhuma tela presa ao endereço antigo');
  const arqs=[]; (function v(d){ for(const n of fs.readdirSync(d)){ const p=path.join(d,n); if(fs.statSync(p).isDirectory()){ if(n!=='img') v(p); } else if(/\.(html|js)$/.test(n)) arqs.push(p); } })(PUB);
  const presos=arqs.filter(p=>/prorider-server-production/.test(fs.readFileSync(p,'utf8'))).map(p=>path.relative(PUB,p));
  ok(arqs.length>10&&presos.length===0,'site e app sem o endereço antigo fixo',presos);
  const srv=fs.readFileSync(path.join(RAIZ,'server.js'),'utf8');
  ok(/PORTAL_URL \|\| 'https:\/\/app\.prorider\.app\.br'/.test(srv),'links dos e-mails usam app.prorider.app.br por padrão');
  ok(!/prorider-server-production/.test(srv),'servidor sem endereço antigo fixo');
  const semOrigem=['academia.html','index.html','aluno.html','financeiro.html','totem.html','academia-publica.html','jim.html','onboarding.html','studio.html'].filter(n=>!/location\.origin/.test(fs.readFileSync(path.join(PUB,n),'utf8')));
  ok(semOrigem.length===0,'Portal usa o endereço por onde foi aberto (antigo ou novo)',semOrigem);
  ok(/PR_ORIGEM=\/\^https\?:\/\.test\(location\.protocol\)\?location\.origin/.test(fs.readFileSync(path.join(PUB,'aluno','index.html'),'utf8')),'app do aluno usa o endereço por onde abriu');
  console.log('2) Link de aula compartilhada');
  const SA=(await j('POST','/user/login',{email:ADMIN,password:ADMIN_SENHA})).d.token;
  const r=await j('POST','/aula/share',{aula_json:{nome:'Teste domínio',blocos:[]}},SA);
  ok(r.s===200&&r.d.url===B+'/aula/load/'+r.d.share_id,'link sai do endereço configurado (antes saía de um endereço que não existia)',r.d&&r.d.url);
  const l=await fetch(r.d.url); ok(l.status===200,'link abre',l.status);
  process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
