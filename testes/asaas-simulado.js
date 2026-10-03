const http=require('http'); const st={cus:{},subs:{},pays:{},log:[],emails:[]}; let n=0;
const mm=(iso)=>{const [y,m,d]=iso.split('-').map(Number);const t=new Date(Date.UTC(y,m,1));const u=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();t.setUTCDate(Math.min(d,u));return t.toISOString().slice(0,10);};
http.createServer((q,r)=>{ let b=''; q.on('data',c=>b+=c); q.on('end',()=>{ const u=q.url, j=b?JSON.parse(b):{}; let o={}, code=200;
  const send=()=>{ r.writeHead(code,{'Content-Type':'application/json'}); r.end(JSON.stringify(o)); };
  if(u.startsWith('/_state')){ o=st; return send(); }
  if(u==='/emails'&&q.method==='POST'){ st.emails.push(j); o={id:'em_'+st.emails.length}; return send(); }   // Resend simulado
  if(u==='/_emails'){ o=st.emails; return send(); }
  if(u.startsWith('/_reset')){ st.cus={};st.subs={};st.pays={};st.log=[];st.emails=[]; return send(); }
  if(q.method==='POST'&&u==='/_add'){ const pid='pay_'+(++n); st.pays[pid]={id:pid,status:'PENDING',billingType:'CREDIT_CARD',invoiceUrl:'https://www.asaas.com/i/'+pid,...j}; o=st.pays[pid]; return send(); }
  if(q.method==='POST'&&u.startsWith('/_pay/')){ const p=st.pays[u.split('/')[2]]; Object.assign(p,j); o=p; return send(); }
  if(q.headers.access_token!=='chave-teste'){ code=401; o={errors:[{description:'chave inválida'}]}; return send(); }
  st.log.push(q.method+' '+u+' '+b);
  let m;
  if(q.method==='POST'&&u==='/customers'){ if(!j.cpfCnpj){code=400;o={errors:[{description:'CPF/CNPJ obrigatório'}]};} else { const id='cus_'+(++n); st.cus[id]=j; o={id}; } }
  else if(q.method==='POST'&&u==='/subscriptions'){ const id='sub_'+(++n); const pid='pay_'+(++n);
    st.pays[pid]={id:pid,subscription:id,customer:j.customer,value:j.value,status:'PENDING',dueDate:j.nextDueDate,billingType:j.billingType,externalReference:j.externalReference,invoiceUrl:'https://www.asaas.com/i/'+pid};
    st.subs[id]={...j,id,nextDueDate:mm(j.nextDueDate)}; o={id}; }
  else if((m=u.match(/^\/subscriptions\/(\w+)$/))){ const s=st.subs[m[1]]||(st.subs[m[1]]={id:m[1]}); if(q.method==='DELETE'){ s.deleted=true; o={deleted:true,id:m[1]}; } else { Object.assign(s,j); if(j.updatePendingPayments&&j.value) Object.values(st.pays).filter(p=>p.subscription===m[1]&&p.status==='PENDING').forEach(p=>p.value=j.value); o=s; } }
  else if(q.method==='POST'&&u==='/payments'){ const pid='pay_'+(++n); st.pays[pid]={id:pid,status:'PENDING',invoiceUrl:'https://www.asaas.com/i/'+pid,...j}; o=st.pays[pid]; }
  else if((m=u.match(/^\/payments\/(\w+)$/))&&q.method==='PUT'){ const p=st.pays[m[1]]; Object.assign(p,{value:j.value,dueDate:j.dueDate}); o=p; }
  else if(u.startsWith('/payments')){ const qs=new URLSearchParams(u.split('?')[1]); o={data:Object.values(st.pays).filter(p=>(qs.get('subscription')?p.subscription===qs.get('subscription'):true)&&(qs.get('externalReference')?p.externalReference===qs.get('externalReference'):true)).reverse()}; }
  send(); }); }).listen(3014);
