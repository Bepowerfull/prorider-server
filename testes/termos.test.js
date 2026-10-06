// 03/10o — Termos de uso e Política de privacidade: aceite no cadastro e no 1º acesso (LGPD)
const B='http://127.0.0.1:3999';
async function j(m,p,body,tok,h){const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{}),...(h||{})},body:body?JSON.stringify(body):undefined});let d;try{d=await r.json()}catch(e){d=null}return {s:r.status,d};}
const { sql, pool, ADMIN, ADMIN_SENHA } = require('./comum');
let f=0; const ok=(c,t,x)=>{ console.log((c?'  OK ':'FALHA ')+t+(x!==undefined?'  → '+JSON.stringify(x):'')); if(!c) f++; };
const IP=n=>({'X-Forwarded-For':'10.7.0.'+n});
(async()=>{
  await sql(`DELETE FROM users WHERE email IN ('termos1@x.com','termos2@x.com')`);
  console.log('1) Páginas');
  for (const pg of ['termos','privacidade']) { const r=await fetch(B+'/'+pg+'.html'); const t=await r.text(); ok(r.status===200&&/LGPD|Termos de uso/.test(t),'/'+pg+'.html no ar'); }
  const v=(await j('GET','/termos/versao')).d.versao; ok(v==='2026-10-06','versão lida da página de termos (meta pr-versao)',v);
  console.log('2) Cadastro');
  let r=await j('POST','/user/register',{name:'Termos Um',email:'termos1@x.com',password:'123456'},null,IP(1));
  ok(r.s===400&&r.d.termos,'sem aceite: não cria a conta',r.d&&r.d.error);
  r=await j('POST','/user/register',{name:'Termos Um',email:'termos1@x.com',password:'123456',aceite_termos:true,aceite_saude:false},null,IP(1));
  ok(r.s===400,'sem a caixa dos dados de saúde: não cria');
  r=await j('POST','/user/register',{name:'Termos Um',email:'termos1@x.com',password:'123456',aceite_termos:true,aceite_saude:true,onde:'app'},null,IP(1));
  ok(r.s===200&&r.d.token,'com as duas caixas: conta criada');
  const ac=await sql(`SELECT versao, saude, onde, ip IS NOT NULL FROM termos_aceites WHERE email='termos1@x.com'`);
  ok(ac==='2026-10-06|true|app|true','aceite registrado (versão, saúde, onde, IP)',ac);
  r=await j('POST','/user/login',{email:'termos1@x.com',password:'123456'},null,IP(1)); ok(r.d.user.termos_pendente===false,'login: nada pendente');
  console.log('3) Conta antiga (sem aceite) e versão nova');
  const hash=await sql(`SELECT password_hash FROM users WHERE email='termos1@x.com'`);
  await sql(`INSERT INTO users (email,name,password_hash,role) VALUES ('termos2@x.com','Termos Dois','${hash}','aluno')`);
  r=await j('POST','/user/login',{email:'termos2@x.com',password:'123456'},null,IP(2)); const T2=r.d.token;
  ok(r.d.user.termos_pendente===true,'conta sem aceite: login avisa que falta aceitar');
  ok((await j('GET','/user/me',null,T2)).d.termos_pendente===true,'/user/me também avisa (o app e o Portal abrem a tela de aceite)');
  ok((await j('POST','/user/termos/aceitar',{aceite:true,saude:false},T2)).s===400,'aceitar sem a caixa de saúde: recusado');
  ok((await j('POST','/user/termos/aceitar',{aceite:true,saude:true})).s===401,'aceitar sem login: recusado');
  r=await j('POST','/user/termos/aceitar',{aceite:true,saude:true,onde:'portal'},T2); ok(r.d.ok,'aceite pela tela do 1º acesso');
  ok((await j('GET','/user/me',null,T2)).d.termos_pendente===false,'depois de aceitar: não pede mais');
  await sql(`UPDATE users SET termos_versao='2020-01-01' WHERE email='termos2@x.com'`);
  ok((await j('GET','/user/me',null,T2)).d.termos_pendente===true,'aceitou versão antiga: pede de novo');
  const SA=(await j('POST','/user/login',{email:ADMIN,password:ADMIN_SENHA},null,IP(3))).d;
  ok(SA.user.termos_pendente===false,'super admin não é bloqueado pela tela de aceite');
  await sql(`DELETE FROM termos_aceites WHERE email IN ('termos1@x.com','termos2@x.com')`); await sql(`DELETE FROM users WHERE email IN ('termos1@x.com','termos2@x.com')`);
  await pool.end();
  console.log(f?`\n${f} FALHA(S)`:'\ntermos: tudo OK'); process.exit(f?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
