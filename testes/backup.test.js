// 03/10j — backup feito pelo servidor: fazer, baixar e RESTAURAR num banco vazio (prova de que volta)
const B='http://127.0.0.1:3999';
const path=require('path'), fs=require('fs'), os=require('os'), zlib=require('zlib'), { spawn, spawnSync }=require('child_process');
const RAIZ=path.join(__dirname,'..'); const { Client }=require(require.resolve('pg',{paths:[RAIZ]}));
async function j(m,p,body,tok){const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined});let d;try{d=await r.json()}catch(e){d=null}return {s:r.status,d};}
const { sql, pool, ADMIN, ADMIN_SENHA } = require('./comum');
let f=0; const ok=(c,t,x)=>{ console.log((c?'  OK ':'FALHA ')+t+(x!==undefined?'  → '+JSON.stringify(x):'')); if(!c) f++; };
const espera=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const SA=(await j('POST','/user/login',{email:ADMIN,password:ADMIN_SENHA})).d.token;
  console.log('1) Fazer o backup');
  await sql(`INSERT INTO users (email, name, password_hash, role) VALUES ('backup.teste@x.com','Ção Ácentos "aspas"','x','aluno') ON CONFLICT (email) DO NOTHING`);
  let r=await j('POST','/admin/backup/agora',null,SA);
  ok(r.d&&r.d.ok&&/^prorider_\d{4}-\d\d-\d\d_\d{4}\.json\.gz$/.test(r.d.arquivo),'backup feito',r.d&&{arquivo:r.d.arquivo,bytes:r.d.bytes});
  const arq=r.d.arquivo;
  const st=(await j('GET','/admin/backup',null,SA)).d;
  ok(st.lista.some(b=>b.arquivo===arq)&&st.ultimo&&st.ultimo.ok,'aparece na lista com "último backup ok"');
  ok((await j('GET','/admin/backup',null,null)).s===401,'só o admin vê');
  console.log('2) Baixar');
  ok((await fetch(B+'/admin/backup/baixar/'+arq)).status===401,'baixar sem login: recusado');
  ok((await fetch(B+'/admin/backup/baixar/..%2F..%2Fetc%2Fpasswd',{headers:{Authorization:'Bearer '+SA}})).status===404,'nome estranho: recusado');
  const resp=await fetch(B+'/admin/backup/baixar/'+arq,{headers:{Authorization:'Bearer '+SA}});
  const buf=Buffer.from(await resp.arrayBuffer()); const local=path.join(os.tmpdir(),arq); fs.writeFileSync(local,buf);
  const linhas=zlib.gunzipSync(buf).toString('utf8').trim().split('\n'), meta=JSON.parse(linhas[0]), fim=JSON.parse(linhas[linhas.length-1]);
  ok(resp.status===200&&meta.prorider_backup===1&&fim.fim&&fim.contagem.users>0,'arquivo baixado é um backup completo',{tabelas:meta.tabelas.length,users:fim.contagem.users});
  ok(!!(await j('GET','/admin/backup',null,SA)).d.baixado,'fica registrado que foi baixado (o aviso "baixe uma cópia" some)');
  console.log('3) Restaurar num banco vazio');
  const u=new URL(process.env.T_DB_URL); const dest='prorider_teste_restaura';
  const adm=new Client({host:u.hostname,port:+u.port||5432,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)});
  await adm.connect(); await adm.query(`DROP DATABASE IF EXISTS ${dest}`); await adm.query(`CREATE DATABASE ${dest}`); await adm.end();
  // o servidor cria as tabelas no banco novo (como no passo 1 do restaurar-backup.js)
  const env=Object.assign({},process.env,{PGDATABASE:dest,PORT:'3988',BACKUP_DESLIGADO:'1',ALERTAS_INTERVALO_S:'3600'});
  const srv=spawn(process.execPath,[path.join(RAIZ,'server.js')],{cwd:RAIZ,env,stdio:'ignore'});
  const dc=()=>new Client({host:u.hostname,port:+u.port||5432,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:dest});
  let pronto=false; for(let i=0;i<60&&!pronto;i++){ await espera(1000); try{ const k=dc(); await k.connect(); const t=await k.query("SELECT to_regclass('public.sistema_alertas') a, to_regclass('public.loja_pedidos') b, to_regclass('public.erro_codigos') c"); await k.end(); pronto=!!(t.rows[0].a&&t.rows[0].b&&t.rows[0].c); }catch(e){} }
  await espera(1500); srv.kill(); await espera(800);
  ok(pronto,'banco novo com as tabelas criadas pelo servidor');
  const rs=spawnSync(process.execPath,[path.join(RAIZ,'ferramentas','restaurar-backup.js'),local,'--confirmar='+dest],{env:Object.assign({},process.env,{RESTAURAR_DATABASE_URL:`postgres://${u.username}:${u.password}@${u.hostname}:${u.port||5432}/${dest}`}),encoding:'utf8'});
  console.log('   '+(rs.stdout||'').trim().split('\n').join('\n   ')+((rs.stderr||'').trim()?'\n   '+rs.stderr.trim():''));
  ok(rs.status===0&&/contagens conferem/.test(rs.stdout),'restaurado e contagens conferem');
  const k=dc(); await k.connect();
  const nm=(await k.query(`SELECT name FROM users WHERE email='backup.teste@x.com'`)).rows[0];
  ok(nm&&nm.name==='Ção Ácentos "aspas"','acentos e aspas voltam iguais',nm);
  const orig=(await sql(`SELECT COUNT(*) FROM licencas`)), copia=(await k.query('SELECT COUNT(*)::text AS n FROM licencas')).rows[0].n;
  ok(orig===copia,'licenças iguais ao original',[orig,copia]);
  let novo=true; try{ await k.query(`INSERT INTO users (email,name,password_hash,role) VALUES ('depois.restaura@x.com','Novo','x','aluno')`); }catch(e){ novo=false; }
  ok(novo,'depois de restaurar, cadastro novo funciona (contadores certos)');
  await k.end();
  const rn=spawnSync(process.execPath,[path.join(RAIZ,'ferramentas','restaurar-backup.js'),local,'--confirmar=errado'],{env:Object.assign({},process.env,{RESTAURAR_DATABASE_URL:`postgres://${u.username}:${u.password}@${u.hostname}:${u.port||5432}/${dest}`}),input:'nao\n',encoding:'utf8'});
  ok(rn.status!==0,'sem confirmar o nome do banco: não restaura');
  const a2=new Client({host:u.hostname,port:+u.port||5432,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)}); await a2.connect(); await a2.query(`DROP DATABASE IF EXISTS ${dest}`); await a2.end();
  await sql(`DELETE FROM users WHERE email='backup.teste@x.com'`); fs.unlinkSync(local);
  await pool.end();
  console.log(f?`\n${f} FALHA(S)`:'\nbackup: tudo OK'); process.exit(f?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
