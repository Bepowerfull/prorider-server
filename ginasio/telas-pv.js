/* ════════════════════════════════════════════════════════════════════
   telas-pv.js — 30/09e — TELAS DE PREPARAR A AULA NO VISUAL DO PORTAL
   --------------------------------------------------------------------
   Aprovadas pelo Mario (imagens u1, u1b, u2, fc, u4 + ajuste dos QRs):
     1. Início ............ 3 opções: Aulas do sistema · Minhas aulas · Sessão livre
     2. Minhas aulas ...... "De onde vem a aula?": da minha conta (QR já no card) ou do pendrive
     3. Aulas do sistema .. 5 objetivos em grade 3 colunas, com o perfil de cada tipo
     4. Lista de aulas .... lista + painel de detalhe + "Usar esta aula"
     5. Configurar aula ... música (MP3 / Spotify / sem), vídeo (pendrive / YouTube /
                            câmera / sem), cenário, resumo e prévia
     6. QR code ........... dois QRs GRANDES (entrar na aula e baixar o app),
                            bikes da sala ao vivo, perfil da aula, Iniciar aula
   Mais: YouTube de fundo sincronizado com a aula e a contagem 3·2·1 com o
   aviso do play do Spotify.

   Este arquivo é carregado DEPOIS do script.js e substitui as funções de
   mesmo nome de lá (mostrarEscolha, _renderSistCats, abrirBgPicker,
   mostrarPreAula, ...). Tudo em px do desenho 1920x1080 (o body tem zoom).
   Logo: sempre o ORIGINAL (logo-prorider.png). Nome escrito: "ProRider".
   ════════════════════════════════════════════════════════════════════ */

// ── utilidades ──────────────────────────────────────────────────────
var PV_ZC={z1:'#a1a1a1',z2:'#295fe8',z3:'#5db13d',z4:'#d7c414',z5:'#ea860c',z6:'#d62d2d',z7:'#9b30ff'};
var PV_ZH={z1:22,z2:36,z3:50,z4:66,z5:82,z6:95,z7:100};
function _pvEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function _pvZ(b){ try{ return toZKey(b.intensity||b.z)||'z1'; }catch(e){ return 'z1'; } }
function _pvSec(b){ try{ return _prSec(b)||0; }catch(e){ return (b.duration||0)*60; } }
function _pvTot(wo){ var t=0; (wo||[]).forEach(function(b){ t+=_pvSec(b); }); return t; }
function _pvLogo(h){ return '<img class="pv-logo" src="logo-prorider.png" alt="ProRider"'+(h?' style="height:'+h+'px"':'')+'>'; }
function _pvSteps(n){
  var nomes=['Aula','Música e vídeo','QR code','Sala ao vivo'], h='';
  nomes.forEach(function(nm,i){ var k=i+1, cl=k<n?' ok':(k===n?' on':'');
    h+=(i?'<div class="pv-ln"></div>':'')+'<div class="pv-step'+cl+'"><i>'+(k<n?'✓':k)+'</i>'+nm+'</div>'; });
  return '<div class="pv-steps">'+h+'</div>';
}
function _pvTopo(sub,titulo,passo,extra){
  return '<div class="pv-top">'+_pvLogo()+'<div class="pv-tt"><small>'+sub+'</small><b>'+titulo+'</b></div>'+_pvSteps(passo)+(extra||'')+'</div>';
}
function _pvRodape(itens){ return '<div class="pv-foot">'+itens.map(function(x){ return '<span><b>'+x[0]+'</b>'+x[1]+'</span>'; }).join('')+'</div>'; }
// barras do perfil: largura = tempo do bloco (exata, em %), altura = zona.
// 01/10e: posição absoluta pelo tempo — antes era flex com 2 px de vão por bloco, e aula com muitos
// blocos curtos (pendrive) ficava esticada/desalinhada do eixo de tempo.
function _pvBarras(wo,raio){
  var tot=_pvTot(wo)||1, acc=0;
  return (wo||[]).map(function(b){ var z=_pvZ(b), s=_pvSec(b), l=acc/tot*100, w=s/tot*100; acc+=s;
    return '<i style="left:'+l.toFixed(3)+'%;width:max(1.5px,calc('+w.toFixed(3)+'% - 2px));height:'+(PV_ZH[z]||22)+'%;background:'+(PV_ZC[z]||'#888')+(raio?';border-radius:'+raio:'')+'"></i>'; }).join('');
}
// partes da aula: aquecimento / bloco principal / volta à calma
function _pvPartes(wo){
  var tipo={}; try{ (segments||[]).forEach(function(sg){ tipo[sg.id]=sg.type; }); }catch(e){}
  var p={w:0,m:0,c:0};
  (wo||[]).forEach(function(b){ var id=String(b.segmentId||'main'), t=tipo[id]||'';
    var s=_pvSec(b);
    if(t==='warmup'||/warm|aquec/i.test(id)) p.w+=s; else if(t==='cooldown'||/cool|calma|volta/i.test(id)) p.c+=s; else p.m+=s; });
  return p;
}
function _pvFaixa(wo,curto){
  var p=_pvPartes(wo), h='';
  [[curto?'AQUEC.':'AQUECIMENTO',p.w,'#5db13d'],[curto?'PRINCIPAL':'BLOCO PRINCIPAL',p.m,'#ea860c'],[curto?'CALMA':'VOLTA',p.c,'#7fa3ff']].forEach(function(x){
    if(x[1]>0) h+='<span style="flex:'+x[1]+';color:'+x[2]+';border-color:'+x[2]+'">'+x[0]+'</span>'; });
  return h;
}
function _pvEixo(sec){ var m=Math.round((sec||0)/60), h=''; for(var k=0;k<=4;k++) h+='<span>'+Math.round(m*k/4)+'′</span>'; return h; }
function _pvAcad(){ var n=''; try{ n=localStorage.getItem('pr_display_academia')||''; }catch(e){} return n||window._gymLicNome||''; }
function _pvBikes(){ var n=parseInt(window.licencaMaxBikes,10)||0; if(!n){ try{ n=parNumBikes||0; }catch(e){} } return Math.max(1,Math.min(40,n||15)); }
function _pvProf(){ try{ return (_nuv&&_nuv.prof&&_nuv.prof.nome)||''; }catch(e){ return ''; } }
function _pvDesafios(wo){ return (wo||[]).filter(function(b){ return b&&b.desafio&&b.desafio.tipo; }).length; }
function _pvMMSS(sec){ try{ return _saDur(sec); }catch(e){ sec=Math.round(sec||0); return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); } }

// ═══ 1. INÍCIO ═════════════════════════════════════════════════════
function mostrarEscolha(){
  boxMode='escolha'; _escolhaReady=false;
  // 01/10e: START funciona direto (antes só depois de mexer no direcional — parecia que o controle não respondia)
  setTimeout(function(){ if(boxMode==='escolha') _escolhaReady=true; },450);
  if(escolhaIdx>_escMax()) escolhaIdx=0;
  usbList=[];
  try{ window._usbOrigem=null; }catch(e){}
  _fecharTodasTelas('boxEscolha');
  var el=document.getElementById('boxEscolha');
  if(!el){ el=document.createElement('div'); el.id='boxEscolha'; document.body.appendChild(el); }
  _escolhaCreated=true;
  el.className='pv-scr'; el.style.cssText='display:flex;';
  var ops=[
    {ic:'📚',bg:'rgba(234,134,12,.15)',t:'Aulas do sistema',d:'Aulas prontas da ProRider por objetivo: resistência, limiar, VO2, sprint e testes de FTP',fn:abrirSistema},
    {ic:'☁',bg:'rgba(41,95,232,.16)',t:'Minhas aulas',d:'As aulas que você montou no Construtor · da sua conta (QR com o app) ou do pendrive',fn:_origemAulaEscolher},
    {ic:'▶',bg:'rgba(155,48,255,.16)',t:'Sessão livre',d:'Sem aula montada: QR direto, bike do professor como referência, fundo livre ou câmera',fn:abrirSessaoLivre}
  ];
  if(APP_MODE==='builder') ops.push({ic:'🛠',bg:'rgba(93,177,61,.16)',t:'Montar aula',d:'Construtor completo: blocos, zonas, RPM e mídia',fn:abrirConstrutor});
  // 02/10e: aula ao vivo em rede de outra academia → primeira opção
  var rd=(typeof _rd!=='undefined')&&_rd.info;
  if(rd&&!rd.mae) ops.unshift({ic:'⚔',bg:'rgba(255,138,92,.2)',t:'Aula ao vivo em rede',rede:true,fn:function(){ _rdEntrar(); },
    d:rd.tem_aula?'Com '+rd.academia_mae+' · '+(rd.nome_aula||'aula')+' · começa junto com o START de lá':'Com '+rd.academia_mae+' · aguardando a '+rd.academia_mae+' abrir a aula'});
  window._escOps=ops;
  var cfg='<div id="escCfg" class="pv-cfg" onclick="abrirSettings()" title="Configurações">⚙</div>';
  el.innerHTML=_pvTopo('Bem-vindo, professor','Como deseja iniciar sua aula?',1,cfg)
    +'<div style="max-width:1300px;width:100%;margin:'+(ops.length>3?40:110)+'px auto 0;">'
    + ops.map(function(o,i){ return '<div class="pv-card pv-opt'+(o.rede?' pv-rede':'')+'" id="eOpt'+i+'" onclick="escolhaIdx='+i+';escolhaFocus();escolhaConfirmar();"><div class="ic" style="background:'+o.bg+'">'+o.ic+'</div><div><h3>'+o.t+'</h3><p>'+o.d+'</p></div><kbd>START ›</kbd></div>'; }).join('')
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:30px;">'
    +  '<div class="pv-card pv-info"><span class="e">📅</span><div><b id="escGrade">Grade de hoje</b><small id="escGradeSub">—</small></div></div>'
    +  '<div class="pv-card pv-info"><span class="e">📺</span><div><b id="escAcad">'+_pvEsc(_pvAcad()||'ProRider')+'</b><small id="escAcadSub">licença ativa · '+_pvBikes()+' bikes</small></div></div>'
    +  '<div class="pv-card pv-info"><span class="dot" id="escDot"></span><div style="flex:1;min-width:0;"><b id="escOnline" style="color:#8fe06a">Sistema online</b><small><span id="escAlunos">0 alunos conectados</span> · '+_pvEsc(String(PR_BUILD||'').split(' ')[0]+' '+(String(PR_BUILD||'').split(' ')[1]||''))+'</small></div><div class="pv-clk"><b id="escClock">--:--</b><small id="escDate">--/--/----</small></div></div>'
    +'</div></div>'
    +_pvRodape([['↑↓','escolher'],['START','abrir'],['L1+R1 2s','configurações']]);
  escolhaFocus(); _escAtualizarInfo(); _escGradeInfo();
  if(_escClockInt)clearInterval(_escClockInt);
  _escClockInt=setInterval(function(){ if(boxMode!=='escolha'){clearInterval(_escClockInt);_escClockInt=null;return;} _escAtualizarInfo(); },1000);
}
function _escGradeInfo(){
  var g=window._gymGradeHoje||[], t=document.getElementById('escGrade'), s=document.getElementById('escGradeSub');
  if(!t||!s) return;
  if(!g.length){ t.textContent='Sem aulas na grade hoje'; s.textContent='a grade vem do Portal'; return; }
  var d=new Date(), agora=d.getHours()*60+d.getMinutes(), prox=null;
  g.forEach(function(a){ var h=String(a.hora||'00:00').split(':'), ini=parseInt(h[0],10)*60+parseInt(h[1]||0,10); if(ini>=agora-5 && (!prox||ini<prox.ini)) prox={ini:ini,a:a,hh:(h[0]||'00')+':'+(h[1]||'00')}; });
  t.textContent=g.length+(g.length===1?' aula hoje na grade':' aulas hoje na grade');
  if(prox){ var r=parseInt(prox.a.reservas_hoje!=null?prox.a.reservas_hoje:prox.a.reservas,10)||0; s.textContent='próxima às '+prox.hh+(r?' · '+r+(r===1?' reserva':' reservas'):''); }
  else s.textContent='as aulas de hoje já terminaram';
}
var _escAtualizarInfoOrig=_escAtualizarInfo;
_escAtualizarInfo=function(){
  try{ _escAtualizarInfoOrig(); }catch(e){}
  var on=navigator.onLine!==false, o=document.getElementById('escOnline'), dt=document.getElementById('escDot');
  if(o){ o.textContent=on?'Sistema online':'Sem internet'; o.style.color=on?'#8fe06a':'#ff6b6b'; }
  if(dt){ dt.style.background=on?'#5db13d':'#d62d2d'; dt.style.boxShadow='0 0 10px '+(on?'#5db13d':'#d62d2d'); }
};
function escolhaFocus(){
  for(var i=0;i<6;i++){ var o=document.getElementById('eOpt'+i); if(o) o.classList.toggle('pv-sel',i===escolhaIdx); }
}
function _escMax(){ return Math.max(0,((window._escOps&&window._escOps.length)||(APP_MODE==='builder'?4:3))-1); }
function escolhaSel(i){ escolhaIdx=i; escolhaFocus(); }
function escolhaConfirmar(){
  var el=document.getElementById('boxEscolha'); if(el) el.style.display='none';
  if(_escClockInt){ clearInterval(_escClockInt); _escClockInt=null; }
  var o=(window._escOps||[])[Math.max(0,Math.min(_escMax(),escolhaIdx))]; if(o&&o.fn) o.fn(); else abrirSistema();
}

// ═══ 2. MINHAS AULAS — de onde vem a aula ══════════════════════════
// O QR já aparece dentro do card "Da minha conta": o professor lê com o app
// (já com login) e as aulas dele chegam. Vale em QUALQUER academia (30/09e).
function _nuvEl(){
  var o=document.getElementById('nuvOv');
  if(!o){ o=document.createElement('div'); o.id='nuvOv'; document.body.appendChild(o); }
  o.className='pv-scr'; o.style.cssText='display:flex;z-index:10050;';
  return o;
}
function _origemAulaEscolher(){
  try{ _fecharTodasTelas('nuvOv'); }catch(e){}
  var o=_nuvEl(); _nuv.sel=0; _nuv.acao401=false;
  o.innerHTML=_pvTopo('Minhas aulas','De onde vem a aula?',1)
    +'<div class="nv-g">'
    +  '<div class="pv-card nv-c" id="nuvOp0" onclick="_nuv.sel=0;_nuvOrigemFoco();_nuvOrigemConfirmar(0);">'
    +    '<h3 style="color:#7fa3ff">☁ Da minha conta</h3>'
    +    '<p>Abra o app ProRider no celular e leia o QR.<br>Suas aulas do Construtor aparecem aqui.</p>'
    +    '<div id="nvArea"><div class="nv-qr" id="nuvQR">gerando o código…</div><div style="margin-top:16px;font-size:16px;color:rgba(255,255,255,.5)">No app: <b style="color:#fff">lupinha → ler QR</b> · o código vale 2 minutos</div></div>'
    +    '<div class="nv-st" id="nvSt" style="color:#ffb45a"><i style="background:#ffb45a;box-shadow:0 0 10px #ffb45a"></i><span id="nuvCont">preparando…</span></div>'
    +  '</div>'
    +  '<div class="pv-card nv-c" id="nuvOp1" onclick="_nuv.sel=1;_nuvOrigemFoco();_nuvOrigemConfirmar(1);">'
    +    '<h3 style="color:#8fe06a">💾 Do pendrive</h3>'
    +    '<p>Aulas baixadas do Construtor, na pasta <b>ProRider</b><br>(com o vídeo e a música do pendrive)</p>'
    +    '<div style="font-size:120px;margin-top:70px;line-height:1">💾</div>'
    +    '<div class="nv-st" id="nvPen" style="color:rgba(255,255,255,.55)"><i style="background:rgba(255,255,255,.3)"></i><span>procurando o pendrive…</span></div>'
    +  '</div>'
    +'</div>'
    +_pvRodape([['←→','escolher'],['START','abrir'],['B','voltar']]);
  _nuvOrigemFoco();
  window._nuvemGp=function(g){
    if(g.left){ _nuv.sel=0; _nuvOrigemFoco(); }
    if(g.right){ _nuv.sel=1; _nuvOrigemFoco(); }
    if(g.a) _nuvOrigemConfirmar(_nuv.sel);
    if(g.b) _nuvVoltar();
  };
  document.removeEventListener('keydown',_nuvTecla,true);
  document.addEventListener('keydown',_nuvTecla,true);
  _nuvParear();
  // quantas aulas tem no pendrive (servidor local); sem ele, só avisa que abre a pasta
  (async function(){
    var p=null; try{ p=await _prBuscarPendriveNativo(); }catch(e){}
    var el=document.getElementById('nvPen'); if(!el) return;
    if(p&&p.aulas){ el.style.color='#8fe06a'; el.innerHTML='<i style="background:#5db13d;box-shadow:0 0 10px #5db13d"></i><span>pendrive conectado · '+p.aulas.length+(p.aulas.length===1?' aula':' aulas')+'</span>'; }
    else el.innerHTML='<i style="background:rgba(255,255,255,.3)"></i><span>START para abrir a pasta ProRider do pendrive</span>';
  })();
}
function _nuvOrigemFoco(){
  for(var i=0;i<2;i++){ var c=document.getElementById('nuvOp'+i); if(c) c.classList.toggle('pv-sel',i===_nuv.sel); }
}
function _nuvOrigemConfirmar(i){
  if(i===1){ _nuvFechar(); abrirPicker(); return; }
  if(_nuv.acao401){ _nuvFechar(); try{ _gymLicencaPerdida('token_invalido'); }catch(e){} return; }
  if(!_nuv.timer) _nuvParear();   // expirou, deu erro ou foi negado: gera outro código
}
// mensagem DENTRO do card "Da minha conta" (a tela continua a mesma)
function _nuvMsg(titulo,texto,cor){
  var a=document.getElementById('nvArea');
  if(!a){ _origemAulaEscolher(); a=document.getElementById('nvArea'); if(!a) return; }
  a.innerHTML='<div class="nv-msg"><b class="t" style="color:'+(cor||'#fff')+'">'+titulo+'</b>'+texto+'</div>';
  _nuvStatus(cor||'#ffb45a', (cor==='#43A047'||cor==='#8fe06a')?'conectado':'START para tentar de novo');
}
function _nuvStatus(cor,txt){
  var s=document.getElementById('nvSt'); if(!s) return;
  s.style.color=cor; s.innerHTML='<i style="background:'+cor+';box-shadow:0 0 10px '+cor+'"></i><span id="nuvCont">'+txt+'</span>';
}
async function _nuvParear(){
  if(_nuv.timer){ clearInterval(_nuv.timer); _nuv.timer=null; }
  _nuv.acao401=false;
  var a=document.getElementById('nvArea');
  if(a) a.innerHTML='<div class="nv-qr" id="nuvQR">gerando o código…</div><div style="margin-top:16px;font-size:16px;color:rgba(255,255,255,.5)">No app: <b style="color:#fff">lupinha → ler QR</b> · o código vale 2 minutos</div>';
  _nuvStatus('#ffb45a','pedindo um código ao servidor…');
  var r,d;
  try{
    r=await fetch(SERVER_HTTP+'/ginasio/pareamento',{method:'POST',headers:{'Authorization':'Bearer '+_nuvToken()}});
    if(r.status===401){
      console.warn('[ProRider] MINHAS AULAS: 401 no pareamento — token do display recusado pelo servidor.');
      _nuvMsg('Ginásio não autenticado','O servidor não reconhece mais este Ginásio.<br>Aperte START para reativar com o código da licença (uma vez só).<br>As aulas do pendrive continuam funcionando.','#ffb02e');
      _nuv.acao401=true; _nuvStatus('#ffb02e','START para reativar');
      return;
    }
    if(!r.ok) throw new Error('O servidor respondeu '+r.status+'.');
    d=await r.json();
  }catch(e){
    console.warn('[ProRider] MINHAS AULAS: pareamento nao iniciou —', e&&e.message);
    _nuvMsg('Sem conexão',(e&&e.message?e.message:'Não consegui falar com o servidor.')+'<br>As aulas do pendrive continuam funcionando.','#ff6b6b');
    return;
  }
  _nuv.codigo=d.codigo||d.code||d.pareamento||null;
  if(!_nuv.codigo){ _nuvMsg('Resposta inesperada','O servidor não devolveu o código do pareamento.','#ff6b6b'); return; }
  var ttl=d.expira_em_seg||d.expires_in||d.ttl||120;
  _nuv.expira=Date.now()+ttl*1000; _nuv.token=null; _nuv.prof=null;
  var base=(typeof _BROWSER_ALUNO_URL!=='undefined'&&_BROWSER_ALUNO_URL)?_BROWSER_ALUNO_URL:(SERVER_HTTP+'/aluno');
  var url=base+(base.indexOf('?')>=0?'&':'?')+'parear='+encodeURIComponent(_nuv.codigo);
  var q=document.getElementById('nuvQR');
  if(q){ q.innerHTML=''; try{ new QRCode(q,{text:url,width:330,height:330,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M}); q.removeAttribute('title'); }catch(e){ q.textContent=url; } }
  _nuvStatus('#ffb45a','esperando o celular do professor…');
  _nuv.timer=setInterval(_nuvVerificar,2000);
}
async function _nuvVerificar(){
  var falta=Math.max(0,Math.round((_nuv.expira-Date.now())/1000));
  var c=document.getElementById('nuvCont'); if(c) c.textContent='esperando o celular do professor… · vale mais '+falta+' s';
  if(!document.getElementById('nvArea')){ clearInterval(_nuv.timer); _nuv.timer=null; return; }
  if(falta<=0){ clearInterval(_nuv.timer); _nuv.timer=null; _nuvMsg('O código expirou','Por segurança ele vale só 2 minutos.<br>Aperte <b>START</b> para gerar outro.','#FFB300'); return; }
  try{
    var r=await fetch(SERVER_HTTP+'/ginasio/pareamento/'+encodeURIComponent(_nuv.codigo),{headers:{'Authorization':'Bearer '+_nuvToken()}});
    if(!r.ok) return;
    var d=await r.json(), st=String(d.status||'').toLowerCase();
    if(st==='negado'||st==='denied'||st==='recusado'){
      clearInterval(_nuv.timer); _nuv.timer=null;
      _nuvMsg('Acesso negado',_pvEsc(d.motivo||'Este login não é de professor.')+'<br>O login precisa ser de professor ou da equipe de uma academia ProRider.','#ff6b6b');
      return;
    }
    var tk=d.token||d.prof_session||d.prof_session_token||null;
    if(!tk) return;
    clearInterval(_nuv.timer); _nuv.timer=null;
    _nuv.token=tk; _nuv.prof=d.professor||d.prof||{};
    _nuvCarregar();
  }catch(e){}
}
async function _nuvCarregar(){
  var nome=(_nuv.prof&&_nuv.prof.nome)?_nuv.prof.nome:'professor';
  _nuvMsg('Olá, '+_pvEsc(String(nome).split(' ')[0])+'!','Trazendo as suas aulas…','#8fe06a');
  var h={'Authorization':'Bearer '+_nuv.token};
  try{
    var r=await fetch(SERVER_HTTP+'/ginasio/treinos',{headers:h});
    if(!r.ok) throw new Error('O servidor respondeu '+r.status+'.');
    var rl=await r.json(), lista=rl.treinos||rl.aulas||(Array.isArray(rl)?rl:[]);
    if(!lista.length){ _nuvMsg('Nenhuma aula ainda','Monte uma aula no <b>Construtor de aulas</b> (no Portal ou no app) e salve na sua conta.<br>Ela aparece aqui na próxima vez.','#FFB300'); return; }
    var aulas=[];
    for(var i=0;i<lista.length;i++){
      try{
        var rr=await fetch(SERVER_HTTP+'/ginasio/treinos/'+encodeURIComponent(lista[i].id),{headers:h});
        if(!rr.ok) continue;
        var t=await rr.json(), bruto=(t.dados!=null?t.dados:(t.json!=null?t.json:t.treino));
        var dados=(typeof bruto==='string')?JSON.parse(bruto):bruto;
        if(dados && !dados.workout && dados.Structure){ var tp=_prDeTrainingPeaks(dados,t.nome); if(tp) dados=tp; }
        if(!dados||!dados.workout||!dados.workout.length) continue;
        dados.nome=dados.nome||t.nome||lista[i].nome;
        aulas.push({name:(t.nome||lista[i].nome||'Aula')+'.json',data:dados,_nuvem:true});
      }catch(e){ console.warn('[ProRider] MINHAS AULAS: aula ignorada —', e&&e.message); }
    }
    if(!aulas.length){ _nuvMsg('Não consegui abrir','As aulas vieram, mas nenhuma estava num formato válido.','#ff6b6b'); return; }
    console.log('[ProRider] MINHAS AULAS: '+aulas.length+' aula(s) de '+nome+'.');
    _nuvFechar();
    usbList=aulas; usbIdx=0; _sistEmCateg=true; window._usbOrigem='minhas';
    var t2=document.getElementById('usbTitle'); if(t2) t2.textContent='Minhas aulas';
    mostrarUSB(nome+' · '+aulas.length+(aulas.length===1?' aula da conta':' aulas da conta'));
  }catch(e){ _nuvMsg('Sem conexão',_pvEsc(e&&e.message?e.message:'Não consegui trazer as aulas.'),'#ff6b6b'); }
}

// ═══ 3. AULAS DO SISTEMA — objetivos em grade ══════════════════════
// Perfil típico de cada objetivo: aquecimento progressivo → miolo → volta à calma
var _PV_AQ=[['z1',3],['z2',2],['z3',1.5]], _PV_VC=[['z2',1.5],['z1',3]];
function _pvRep(n,a){ var o=[]; for(var i=0;i<n;i++) o=o.concat(a); return o; }
var _PV_FORMAS={
  'Endurance Builder':   _PV_AQ.concat([['z2',6],['z3',5],['z4',3],['z2',3],['z3',5],['z4',3],['z2',3]]).concat(_PV_VC),
  'HIIT Threshold':      _PV_AQ.concat(_pvRep(3,[['z4',6],['z2',2.5]])).concat(_PV_VC),
  'VO2 Max Intervals':   _PV_AQ.concat(_pvRep(5,[['z5',2],['z2',2]])).concat(_PV_VC),
  'Sprint Neuromuscular':_PV_AQ.concat([['z4',2]]).concat(_pvRep(6,[['z7',.6],['z1',1.8]])).concat(_PV_VC),
  'FTP':                 _PV_AQ.concat([['z5',1],['z2',2],['z4',12],['z2',2]]).concat(_PV_VC)
};
var _PV_CATTXT={
  'Endurance Builder':'Base aeróbica · Z2–Z4 · 45–60 min','HIIT Threshold':'Limiar · Z4–Z5 · 30–45 min',
  'VO2 Max Intervals':'Máximo aeróbico · Z5–Z6 · 30–50 min','Sprint Neuromuscular':'Potência máxima · Z6–Z7 · 20–35 min','FTP':'Avaliação · 20–40 min'
};
function _pvNomeBonito(s){ return String(s||'').toLowerCase().replace(/(^|\s)\S/g,function(c){return c.toUpperCase();}).replace(/\bFtp\b/,'FTP').replace(/\bHiit\b/,'HIIT').replace(/\bVo2\b/,'VO2'); }
function abrirSistema(){ _sistEmCateg=false; _sistCatIdx=0; window._usbOrigem='sistema'; _renderSistCats(); }
function _renderSistCats(){
  _fecharTodasTelas('boxUSB');
  boxMode='usb'; _sistEmCateg=false;
  var el=document.getElementById('boxUSB'); if(el) el.style.display='flex';
  var t=document.getElementById('usbTitle'); if(t) t.textContent='Aulas do sistema';
  var sub=document.getElementById('usbSubtitle'); if(sub) sub.textContent='Escolha um objetivo · '+SISTEMA.length+' aulas';
  var ft=document.getElementById('usbFoot'); if(ft) ft.innerHTML='<span><b>←→↑↓</b>escolher</span><span><b>START</b>abrir</span><span><b>B</b>voltar</span>';
  var list=document.getElementById('usbFileList'); if(!list) return;
  list.innerHTML='<div class="pv-cats" style="margin-top:6px;">'+_sistCats.map(function(c,i){
    var n=SISTEMA.filter(function(a){ return a.nome.indexOf(c.key)===0; }).length, sem=!n;
    var forma=(_PV_FORMAS[c.key]||[]).map(function(x){ return {intensity:x[0],durationSec:x[1]*60}; });
    return '<div class="pv-card pv-cat'+(i===_sistCatIdx?' pv-sel':'')+'" onclick="_sistCatIdx='+i+';_abrirSistCat(_sistCats['+i+']);" style="'+(sem?'opacity:.45;border-style:dashed':'')+'">'
      +'<div style="display:flex;align-items:center;gap:14px;"><div class="ico" style="background:'+c.cor+'22">'+c.svg+'</div><div style="min-width:0"><h3 style="color:'+c.cor+'">'+_pvNomeBonito(c.label)+'</h3><div class="d">'+(_PV_CATTXT[c.key]||c.sub)+'</div></div></div>'
      +'<div class="pv-seg" style="margin-top:22px;">'+_pvFaixaForma(forma,c.cor)+'</div>'
      +'<div class="pv-bars" style="height:150px;margin-top:8px;">'+_pvBarras(forma)+'</div>'
      +'<div style="margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;"><span style="color:rgba(255,255,255,.5);font-size:15px">'+(sem?'em breve':'START para ver as aulas')+'</span><div style="text-align:right"><b class="pv-h" style="font-size:44px;color:'+c.cor+'">'+(sem?'—':n)+'</b><div class="pv-lbl">aulas</div></div></div>'
      +'</div>';
  }).join('')+'</div>';
}
function _pvFaixaForma(forma,cor){
  var w=0,m=0,c=0,n=forma.length;
  forma.forEach(function(b,i){ var s=b.durationSec; if(i<3) w+=s; else if(i>=n-2) c+=s; else m+=s; });
  return '<span style="flex:'+w+';color:#5db13d;border-color:#5db13d">AQUEC.</span><span style="flex:'+m+';color:'+cor+';border-color:'+cor+'">PRINCIPAL</span><span style="flex:'+c+';color:#7fa3ff;border-color:#7fa3ff">CALMA</span>';
}
function _sistCatMover(dx,dy){
  var n=_sistCats.length, i=_sistCatIdx;
  if(dx) i=Math.max(0,Math.min(n-1,i+dx));
  if(dy){ var j=i+dy*3; if(j>=0&&j<n) i=j; else if(dy>0 && Math.floor(i/3)<Math.floor((n-1)/3)) i=n-1; }
  _sistCatIdx=i; _renderSistCats();
}
function _abrirSistCat(cat){
  _sistEmCateg=true; window._usbOrigem='sistema';
  var t=document.getElementById('usbTitle'); if(t) t.textContent=_pvNomeBonito(cat.label);
  usbList=SISTEMA.filter(function(a){ return a.nome.indexOf(cat.key)===0; }).map(function(a){
    var d=JSON.parse(JSON.stringify(a)); d._dir=null; d._subs={}; return {name:a.nome+'.json',data:d}; });
  usbIdx=0; mostrarUSB('Aulas do sistema · '+usbList.length+(usbList.length===1?' aula':' aulas'));
}
function _usbVoltar(){
  var o=window._usbOrigem;
  if(o==='sistema' && _sistEmCateg){ _sistEmCateg=false; _renderSistCats(); return; }
  if(o==='minhas'){ usbList=[]; _origemAulaEscolher(); return; }
  mostrarEscolha();
}

// ═══ 4. LISTA DE AULAS + DETALHE ═══════════════════════════════════
function _pvMidiaPills(d){
  var m=(d&&d.musica)||{}, v=(d&&d.video)||{}, p=function(t,bg,c){ return '<span class="pv-pill" style="background:'+bg+';color:'+c+'">'+t+'</span>'; }, h='';
  if(v.fonte==='youtube') h+=p('▶ YouTube','rgba(255,0,51,.14)','#ff6b81');
  else if(v.fonte==='local') h+=p('📹 Vídeo do pendrive','rgba(41,95,232,.16)','#7fa3ff');
  else if(v.fonte==='camera') h+=p('📷 Câmera','rgba(41,95,232,.16)','#7fa3ff');
  else h+=p('Sem vídeo','rgba(255,255,255,.06)','rgba(255,255,255,.45)');
  if(m.fonte==='spotify'||m.fonte==='deezer'||m.fonte==='link') h+=p('🟢 '+_bgNomeFonte(m.fonte==='link'?'spotify':m.fonte),'rgba(30,215,96,.12)','#1ed760');
  else if(m.fonte==='mp3') h+=p('🎵 MP3','rgba(234,134,12,.14)','#ffb45a');
  else h+=p('Sem música','rgba(255,255,255,.06)','rgba(255,255,255,.45)');
  if(_pvDesafios(d&&d.workout)) h+=p('🏆 '+_pvDesafios(d.workout)+(_pvDesafios(d.workout)===1?' desafio':' desafios'),'rgba(215,196,20,.14)','#e6d33a');
  return h;
}
function mostrarUSB(sub){
  boxMode='usb';
  _fecharTodasTelas('boxUSB');
  var el=document.getElementById('boxUSB'); if(el) el.style.display='flex';
  var s=document.getElementById('usbSubtitle');
  if(s) s.textContent=sub||(usbList.length?(usbList.length+(usbList.length>1?' aulas encontradas':' aula encontrada')):'Nenhuma aula encontrada');
  var ft=document.getElementById('usbFoot'); if(ft) ft.innerHTML='<span><b>↑↓</b>escolher</span><span><b>START</b>usar esta aula</span><span><b>B</b>voltar</span>';
  _renderAulasList();
}
function renderUSB(){
  var list=document.getElementById('usbFileList'); if(!list) return;
  list.innerHTML='<div class="pv-card" style="max-width:900px;margin:80px auto 0;text-align:center;padding:40px;">'
    +'<div style="font-size:64px">📂</div><div class="pv-h" style="font-size:34px;margin-top:10px">Nenhuma aula encontrada</div>'
    +'<div style="font-size:18px;color:rgba(255,255,255,.65);margin-top:12px;line-height:1.6">Monte a aula no <b>Construtor de aulas</b> (Portal ou app).<br>Pendrive: coloque o arquivo da aula na pasta <b>ProRider</b> — vídeo e música na mesma pasta.</div>'
    +'<div style="margin-top:18px;color:rgba(255,255,255,.4)">B para voltar</div></div>';
}
function _renderAulasList(){ _renderSistAulas(); }
function _renderSistAulas(){
  var list=document.getElementById('usbFileList'); if(!list) return;
  if(!usbList.length){ renderUSB(); return; }
  if(usbIdx<0) usbIdx=0; if(usbIdx>usbList.length-1) usbIdx=usbList.length-1;
  var rows=usbList.map(function(f,i){
    var d=f.data, st=_saStats(d), bg=_saBadge(d.badge), sel=i===usbIdx;
    return '<div class="pv-card pv-li'+(sel?' pv-sel':'')+'" id="saRow'+i+'" onclick="if(usbIdx==='+i+'){abrirAula();}else{usbIdx='+i+';_renderSistAulas();}">'
      +'<div class="th">'+_saThumb(d,i)+'</div>'
      +'<div style="flex:0 0 290px;min-width:0"><div style="font-size:21px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_pvEsc(d.nome)+'</div>'
      +'<div style="color:rgba(255,255,255,.5);font-size:15px">'+_saDur(st.sec)+' · '+st.blocos+' blocos'+(_pvDesafios(d.workout)?' · 🏆 '+_pvDesafios(d.workout):'')+'</div>'
      +'<div style="margin-top:6px;display:flex;gap:6px"><span class="pv-pill" style="background:'+_saRgba(bg.c,.18)+';color:'+bg.c+'">'+bg.t+'</span><span class="pv-pill" style="color:#8fe06a">'+_saZoneRange(st.zs)+'</span></div></div>'
      +'<div class="pv-bars" style="flex:1;height:66px;min-width:0">'+_pvBarras(d.workout)+'</div>'
      +'<div style="text-align:right;flex-shrink:0;width:70px"><div class="pv-lbl">TSS</div><b class="pv-h" style="font-size:34px;color:#ffb45a">'+_aulaTSS(d)+'</b></div>'
      +'</div>';
  }).join('');
  var d=usbList[usbIdx].data, st=_saStats(d), wo=d.workout||[], tot=_pvTot(wo);
  var zr=''; ['z1','z2','z3','z4','z5','z6'].forEach(function(z,k){ var p=st.tot?Math.round((st.zs[z]||0)/st.tot*100):0, c=PV_ZC[z];
    zr+='<div style="background:'+_saRgba(c,.14)+';border-radius:8px;padding:7px 4px;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:900;color:'+c+'"><div style="font-size:15px">Z'+(k+1)+'</div><div style="font-size:14px">'+p+'%</div></div>'; });
  var kp=function(l,v){ return '<div style="background:#22222a;border-radius:12px;padding:9px 12px"><div class="pv-lbl">'+l+'</div><b class="pv-h" style="font-size:28px;display:block;margin-top:2px">'+v+'</b></div>'; };
  var det='<div class="pv-card" style="display:flex;flex-direction:column;min-height:0;overflow:hidden;border-color:rgba(234,134,12,.45)">'
    +'<div class="pv-h" style="font-size:36px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_pvEsc(d.nome)+'</div>'
    +'<div style="color:rgba(255,255,255,.55);font-size:16px;margin-top:4px">'+_saDur(st.sec)+' · '+st.blocos+' blocos · '+_saZoneRange(st.zs)+'</div>'
    +'<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">'+_pvMidiaPills(d)+'</div>'
    +'<div class="pv-lbl" style="margin-top:16px">Perfil da aula</div>'
    +'<div class="pv-seg" style="margin-top:8px">'+_pvFaixa(wo)+'</div>'
    +'<div class="pv-bars" style="height:220px;margin-top:6px">'+_pvBarras(wo,'5px 5px 1px 1px')+'</div>'
    +'<div class="pa2-eixo">'+_pvEixo(tot)+'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px">'+kp('Duração',_saDur(st.sec))+kp('TSS',_aulaTSS(d))+kp('FTP médio',st.ftp+'%')+kp('Desafios',_pvDesafios(wo))+'</div>'
    +'<div class="pv-lbl" style="margin-top:14px">Tempo em cada zona</div>'
    +'<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:8px">'+zr+'</div>'
    +(d.desc?'<div style="font-size:15px;color:rgba(255,255,255,.6);line-height:1.45;margin-top:12px;overflow:hidden;max-height:66px">'+_pvEsc(d.desc)+'</div>':'')
    +'<div class="pv-go" style="margin-top:auto" onclick="abrirAula()"><b>▶ Usar esta aula</b><span>depois: música, vídeo e cenário</span><kbd>START</kbd></div>'
    +'</div>';
  list.innerHTML='<div style="display:grid;grid-template-columns:minmax(0,1fr) 620px;gap:18px;height:100%;min-height:0"><div id="saLista" style="overflow-y:auto;min-height:0;padding:2px 6px 2px 2px">'+rows+'</div>'+det+'</div>';
  var r=document.getElementById('saRow'+usbIdx); if(r&&r.scrollIntoView) r.scrollIntoView({block:'nearest'});
}

// ═══ 5. CONFIGURAR AULA ════════════════════════════════════════════
var _bgMusFonte='none', _bgVidFonte='none', _bgCamOn=false, _bgCamQtd=null, _bgSumTimer=null;
// 02/10j: a câmera só vai para o FUNDO em "No fundo", ou em Gravar/Transmitir sem vídeo.
// Com vídeo escolhido, o fundo é o vídeo e a câmera só grava/transmite (o professor está na sala).
function _bgCamFundo(){ return _bgCamModo==='on' || ((_bgCamModo==='rec'||_bgCamModo==='live') && _bgVidFonte==='none'); }
function _bgLinkDaAula(d){
  var m=(d&&d.musica)||{};
  if(m.fonte!=='spotify'&&m.fonte!=='deezer'&&m.fonte!=='link') return null;
  var link=m.link||'';
  if(!link && m.spotifyUri){ var p=String(m.spotifyUri).split(':'); if(p.length>=3) link='https://open.spotify.com/'+p[1]+'/'+p[2]; }
  if(!link) return null;
  var fonte=m.fonte==='link'?(/spotify/i.test(link)?'spotify':(/deezer/i.test(link)?'deezer':'link')):m.fonte;
  return {link:link, fonte:fonte, nome:m.playlist||m.titulo||m.nome||'Playlist da aula'};
}
function _bgYTDaAula(d){
  var v=(d&&d.video)||{};
  if(v.fonte!=='youtube'||!v.youtubeId) return null;
  var off=Number(v.syncOffset)||0; if(off>36000) off=off/1000;
  var fim=0; try{ fim=_prFimPrincipalSec(); }catch(e){}
  return {id:v.youtubeId, titulo:v.titulo||'Vídeo do YouTube', dur:Number(v.duracao)||0, start:Math.max(0,off>0?off-fim:0), url:v.url||('https://youtu.be/'+v.youtubeId)};
}
function _bgNomeFonte(f){ return f==='deezer'?'Deezer':(f==='link'?'Playlist':'Spotify'); }
function _bgOpcoesMus(){
  var lk=_bgLinkDaAula(_bgPickerData&&_bgPickerData.d);
  return [{k:'mp3',em:'💾',t:'MP3 do pendrive'},{k:'link',em:lk&&lk.fonte==='deezer'?'🎧':'🟢',t:_bgNomeFonte(lk&&lk.fonte),cl:'sp',off:!lk},{k:'none',em:'🔇',t:'Sem música'}];
}
function _bgOpcoesVid(){
  var yt=_bgYTDaAula(_bgPickerData&&_bgPickerData.d);
  return [{k:'pendrive',em:'💾',t:'Vídeo do pendrive'},{k:'youtube',em:'▶',t:'YouTube',cl:'yt',off:!yt},{k:'none',em:'🚫',t:'Sem vídeo'}];
}
function _bgTrocaFonte(qual,dir){
  var ops=qual==='musica'?_bgOpcoesMus():_bgOpcoesVid(), atual=qual==='musica'?_bgMusFonte:_bgVidFonte;
  var i=ops.findIndex(function(o){return o.k===atual;}), n=ops.length;
  for(var t=0;t<n;t++){ i=(i+dir+n)%n; if(!ops[i].off) break; }
  if(qual==='musica') _bgMusFonte=ops[i].k; else _bgVidFonte=ops[i].k;
  _bgRenderAll();
}
function _bgEscolherFonte(qual,k){
  if(qual==='camera'){ _bgCamModo=k; _bgCamOn=(k!=='off'); _bgFoco='camera'; _bgRenderAll(); return; }
  if(qual==='musica') _bgMusFonte=k; else _bgVidFonte=k;
  _bgFoco=qual; _bgRenderAll();
  if(k==='mp3') bgSelecionarMV('music'); else if(k==='pendrive') bgSelecionarMV('video');
}
function _bgFocar(q){ _bgFoco=q; _bgRenderAll(); }

async function abrirBgPicker(d,vc,mc){
  _fecharTodasTelas('bgPickerScreen');
  _bgPickerData={d:d,vc:vc,mc:mc};
  _bgSection=0; _bgMusicIdx=0; _bgFoco='musica';
  _bgSelMusicItem=null; _bgSelVideoItem=null; _bgMVSel=0;
  _bgFundoItems=[{key:'none',name:'SEM FUNDO',icon:'—',color:'rgba(255,255,255,.3)'}];
  BG_MODES.forEach(function(bg){ if(bg.key!=='camera') _bgFundoItems.push({key:bg.key,name:bg.name,icon:bg.icon,color:bg.color}); });
  _bgFundoIdx=Math.max(0,_bgFundoItems.findIndex(function(x){return x.key==='cosmos';}));
  await _bgScanPendrive();
  if(vc&&vc.ok&&typeof videoObjectUrl!=='undefined'&&videoObjectUrl) _bgSelVideoItem={key:'video_preload',name:(vc.msg||'Vídeo').split('/').pop()};
  if(mc&&mc.ok&&typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl) _bgSelMusicItem={key:'music_preload',name:(mc.msg||'Música').split('/').pop()};
  // o que a aula trouxe gravado decide a opção inicial
  var lk=_bgLinkDaAula(d), yt=_bgYTDaAula(d), m=d&&d.musica||{}, v=d&&d.video||{};
  _bgMusFonte = lk ? 'link' : ((_bgSelMusicItem||m.fonte==='mp3'||_bgMusicFiles.length)?'mp3':'none');
  _bgVidFonte = yt ? 'youtube' : ((_bgSelVideoItem||v.fonte==='local')?'pendrive':'none');
  _bgCamOn = (v.fonte==='camera'); _bgCamModo=_bgCamOn?'on':'off';
  try{ _gvCarregarCfg(); }catch(e){}   // 02/10b: chave do YouTube, limite do app, servidor local
  // quantas câmeras o computador enxerga (notebook ou USB no mini PC)
  _bgCamQtd=null;
  try{ navigator.mediaDevices.enumerateDevices().then(function(l){ _bgCamQtd=l.filter(function(x){return x.kind==='videoinput';}).length; try{ _bgRenderAll(); }catch(e){} }).catch(function(){ _bgCamQtd=0; }); }catch(e){ _bgCamQtd=0; }
  if(boxMode==='livre'||(d&&d.nome==='Sessão Livre')){ if(!_bgSelMusicItem) _bgMusFonte=_bgMusicFiles.length?'mp3':'none'; }
  bgActiveMode='cosmos'; bgZC='#295fe8'; bgZoneSpeed=0.85; _bgT=0; _bgBolts=[];
  if(uA){cancelAnimationFrame(uA);uA=null;}
  if(!uC) universeInit();
  if(uC){ uC.style.display='none'; }
  var s=document.getElementById('bgPickerScreen'); if(s) s.style.display='flex';
  boxMode='bgPicker';
  _bgRenderAll();
  _bgPrevStart();
  if(_bgSumTimer) clearInterval(_bgSumTimer);
  _bgSumTimer=setInterval(function(){ if(boxMode!=='bgPicker'){ clearInterval(_bgSumTimer); _bgSumTimer=null; return; } _bgResumoAlunos(); },1000);
  // YouTube: já pede a API para o player estar pronto quando a aula começar
  if(yt) _prYTCarregarApi();
}
function _bgResumoAlunos(){
  var n=0; try{ n=Object.keys(alunosMap||{}).length; }catch(e){}
  var a=document.getElementById('bgSumAlunos'); if(a) a.textContent='● '+n+(n===1?' aluno conectado':' alunos conectados');
}
function _bgRenderAll(){
  var P=_bgPickerData||{d:{}}, d=P.d||{}, wo=(typeof workout!=='undefined'&&workout)?workout:[];
  var foco=_bgFoco, set=function(id,h){ var e=document.getElementById(id); if(e) e.innerHTML=h; };
  ['bgMusicCard','bgVideoCard','bgCamCard','bgFundoCard'].forEach(function(id,i){ var e=document.getElementById(id); if(e) e.classList.toggle('pv-sel',foco===['musica','video','camera','fundo'][i]); });
  var go=document.getElementById('bgIniciarBtn'); if(go) go.classList.toggle('pv-sel',foco==='iniciar');
  // opções
  var opH=function(qual,ops,atual){ return ops.map(function(o){ return '<div class="bgc-op'+(o.k===atual?' on':'')+(o.cl?' '+o.cl:'')+(o.off?' off':'')+'" onclick="event.stopPropagation();'+(o.off?'':'_bgEscolherFonte(\''+qual+'\',\''+o.k+'\')')+'"><em>'+o.em+'</em>'+o.t+'</div>'; }).join(''); };
  set('bgMusOpts',opH('musica',_bgOpcoesMus(),_bgMusFonte));
  set('bgVidOpts',opH('video',_bgOpcoesVid(),_bgVidFonte));
  var m=d.musica||{}, v=d.video||{};
  set('bgMusOrig', m.fonte?'veio gravada na aula':'←→ troca a opção');
  set('bgVidOrig', v.fonte?'veio gravado na aula':'←→ troca a opção');
  // corpo da música
  var aulaS=_pvTot(wo), lk=_bgLinkDaAula(d), mh='';
  if(_bgMusFonte==='mp3'){
    var mi=_bgSelMusicItem, sub;
    if(mi){ var md=(typeof mp3Duration!=='undefined'&&mp3Duration>0)?Math.round(mp3Duration):0;
      sub='<span class="bgc-ok">✓ pronta</span>'+(md?' · '+_pvMMSS(md)+' de música / aula '+_pvMMSS(aulaS)+(md<aulaS-2?' <span class="bgc-av">· faltam '+_pvMMSS(aulaS-md)+'</span>':''):'')+' · START para trocar'; }
    else sub=_bgMusicFiles.length?('START para escolher no pendrive ('+_bgMusicFiles.length+(_bgMusicFiles.length===1?' música)':' músicas)')):'nenhum MP3 no pendrive · START para procurar';
    mh='<div class="bgc-box"><span style="font-size:30px">🎵</span><div style="min-width:0;flex:1"><div class="t">'+_pvEsc(mi?mi.name:'Nenhum MP3 escolhido')+'</div><div class="s">'+sub+'</div></div></div>';
  } else if(_bgMusFonte==='link' && lk){
    mh='<div class="bgc-sp"><div class="qr" id="bgSpQR"></div><div><div style="font-size:13px;letter-spacing:2px;font-weight:700;color:#1ed760">PLAYLIST DA AULA</div><div class="pl">'+_pvEsc(lk.nome)+'</div>'
      +'<div class="bgc-stp"><div><b class="k">1</b>Leia o QR com o celular ligado na caixa de som: abre no <b>'+_bgNomeFonte(lk.fonte)+' do professor</b>.</div><div><b class="k">2</b>Deixe na primeira música, sem dar play.</div><div><b class="k">3</b>No <b>Iniciar aula</b> vem a contagem 3·2·1. No <b style="color:#1ed760">JÁ</b>, dê play.</div></div></div></div>';
  } else {
    mh='<div class="bgc-box"><span style="font-size:30px">🔇</span><div><div class="t">Aula sem música</div><div class="s">o som fica por conta da sala</div></div></div>';
  }
  var mb=document.getElementById('bgMusBody');
  if(mb && mb.getAttribute('data-k')!==(_bgMusFonte+'|'+(lk&&lk.link)+'|'+(_bgSelMusicItem&&_bgSelMusicItem.name)+'|'+(typeof mp3Duration!=='undefined'?Math.round(mp3Duration):0))){
    mb.innerHTML=mh; mb.setAttribute('data-k',_bgMusFonte+'|'+(lk&&lk.link)+'|'+(_bgSelMusicItem&&_bgSelMusicItem.name)+'|'+(typeof mp3Duration!=='undefined'?Math.round(mp3Duration):0));
    var q=document.getElementById('bgSpQR');
    if(q&&lk){ try{ new QRCode(q,{text:lk.link,width:170,height:170,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M}); q.removeAttribute('title'); }catch(e){ q.textContent=lk.link; } }
  }
  // corpo do vídeo
  var yt=_bgYTDaAula(d), vh='';
  if(_bgVidFonte==='pendrive'){
    var vi=_bgSelVideoItem, vs;
    if(vi){ vs='<span class="bgc-ok">✓ pronto</span>';
      try{ if(typeof videoEndPoint!=='undefined'&&videoEndPoint>0){ var ini=videoEndPoint-_prFimPrincipalSec(); vs+=ini>=0?' · começa em '+_pvMMSS(ini)+' para chegar junto com o fim do principal':' <span class="bgc-av">· vídeo curto para a chegada</span>'; } }catch(e){}
      vs+=' · START para trocar'; }
    else vs=_bgVideoFiles.length?('START para escolher no pendrive ('+_bgVideoFiles.length+(_bgVideoFiles.length===1?' vídeo)':' vídeos)')):'nenhum vídeo no pendrive · START para procurar';
    vh='<div class="bgc-box"><span style="font-size:30px">📹</span><div style="min-width:0;flex:1"><div class="t">'+_pvEsc(vi?vi.name:'Nenhum vídeo escolhido')+'</div><div class="s">'+vs+'</div></div></div>';
  } else if(_bgVidFonte==='youtube' && yt){
    var net=navigator.onLine!==false;
    vh='<div class="bgc-box" style="padding:10px"><div class="bgc-th yt" style="background-image:url(https://img.youtube.com/vi/'+encodeURIComponent(yt.id)+'/mqdefault.jpg)"></div><div style="flex:1;min-width:0"><div class="t">'+_pvEsc(yt.titulo)+'</div>'
      +'<div class="s">'+(yt.dur?_pvMMSS(yt.dur)+' · ':'')+'começa em '+_pvMMSS(yt.start)+' para chegar junto com o fim do principal</div>'
      +'<div style="margin-top:6px;font-size:14px">'+(net?'<span class="bgc-ok">✓ pronto</span> <span style="color:rgba(255,255,255,.5)">· toca sem som · sem anúncio se o navegador da TV estiver com YouTube Premium</span>':'<span class="bgc-av">⚠ sem internet: o YouTube não vai tocar</span>')+'</div></div></div>';
  } else {
    vh='<div class="bgc-box"><span style="font-size:30px">✦</span><div><div class="t">Sem vídeo</div><div class="s">vale o cenário animado aqui embaixo</div></div></div>';
  }
  set('bgVidBody',vh);
  var vcard=document.getElementById('bgVideoCard'); if(vcard) vcard.style.opacity=_bgCamFundo()?'.45':'1';
  // câmera ao vivo (cartão próprio)
  if(!_bgCamOn) _bgCamModo='off'; else if(_bgCamModo==='off') _bgCamModo='on';
  set('bgCamOpts',opH('camera',[{k:'off',em:'⏻',t:'Desligada'},{k:'on',em:'📷',t:'No fundo'},{k:'rec',em:'⏺',t:'Gravar'},{k:'live',em:'📡',t:'Gravar e transmitir'}],_bgCamModo));
  var cq=_bgCamQtd;
  set('bgCamBody','<div class="bgc-cam"><span>'+(cq==null?'procurando câmeras…':(cq?('<b class="bgc-ok">'+cq+(cq===1?' câmera encontrada':' câmeras encontradas')+'</b>'):'<b class="bgc-av">nenhuma câmera encontrada</b> · ligue uma câmera USB no mini PC'))
    +(_bgCamFundo()?' · o professor aparece atrás do gráfico, no lugar do vídeo e do cenário':(_bgCamOn?' · o fundo é o vídeo: a câmera só grava e transmite':''))+'</span>'+_gvCartaoTxt()+'</div>');
  // cenário
  var semVid=(_bgVidFonte==='none')&&!_bgCamFundo();
  var cg=document.getElementById('bgCardGrid');
  if(cg){ cg.classList.toggle('desl',!semVid);
    cg.innerHTML=_bgFundoItems.map(function(f,i){ return '<div class="'+(i===_bgFundoIdx?'on':'')+'" onclick="event.stopPropagation();_bgFundoIdx='+i+';_bgFoco=\'fundo\';_bgRenderAll();"><span>'+f.icon+'</span>'+f.name+'</div>'; }).join(''); }
  set('bgFunOrig', semVid?'quando não tem vídeo':(_bgCamFundo()?'desligado: a câmera está no fundo':'desligado: a aula tem vídeo'));
  // resumo
  var st=_saStats({workout:wo});
  set('bgSumNome',_pvEsc(d.nome||'Aula'));
  var sub=[_pvProf(),_pvAcad(),_pvBikes()+' bikes'].filter(Boolean).join(' · ');
  set('bgSumSub',_pvEsc(sub));
  set('bgKDur',_saDur(st.sec)); set('bgKBlocos',wo.length); set('bgKTss',_aulaTSS({workout:wo,tss:d.tss})); set('bgKDes',(_pvDesafios(wo)?'🏆 ':'')+_pvDesafios(wo));
  _bgResumoAlunos();
  // prévia
  var chips='';
  if(_bgMusFonte==='link'&&lk) chips+='<span class="bgc-chip">🟢 '+_bgNomeFonte(lk.fonte)+'</span>';
  else if(_bgMusFonte==='mp3'&&_bgSelMusicItem) chips+='<span class="bgc-chip">🎵 MP3</span>';
  if(_bgCamOn) chips+='<span class="bgc-chip">📷 Câmera ao vivo</span>';
  else if(_bgVidFonte==='youtube'&&yt) chips+='<span class="bgc-chip"><span style="background:#ff0033;border-radius:4px;padding:0 4px;font-size:10px">▶</span> YouTube</span>';
  else if(_bgVidFonte==='pendrive'&&_bgSelVideoItem) chips+='<span class="bgc-chip">📹 Vídeo</span>';
  else chips+='<span class="bgc-chip">'+(_bgFundoItems[_bgFundoIdx]||{}).icon+' '+_pvEsc((_bgFundoItems[_bgFundoIdx]||{}).name||'')+'</span>';
  set('bgPrevMidia',chips);
  set('bgPrevSegs',_pvFaixa(wo));
  set('bgPrevBars',_pvBarras(wo));
  var pb=document.getElementById('bgPrevBox');
  if(pb) pb.style.backgroundImage=(!_bgCamFundo()&&_bgVidFonte==='youtube'&&yt)?'url(https://img.youtube.com/vi/'+encodeURIComponent(yt.id)+'/hqdefault.jpg)':'none';
  set('bgGoSub',(_bgMusFonte==='link'&&lk)?'depois o QR para os alunos · na largada, contagem 3·2·1 para o play do '+_bgNomeFonte(lk.fonte):'próximo passo: QR code para os alunos');
  // o preview animado segue o cenário escolhido
  var fi=_bgFundoItems[_bgFundoIdx]||{key:'none'};
  if(fi.key!=='none'){ bgActiveMode=fi.key; bgZC=fi.color||'#295fe8'; }
}
function _bgPreviewRefresh(){}
function _bgPrevLoop(){
  var ps=document.getElementById('bgPickerScreen');
  if(!_bgPrevC||!_bgPrevX||!ps||ps.style.display==='none'){ _bgPrevRAF=null; return; }
  if(_bgPrevC.clientWidth && _bgPrevC.width!==_bgPrevC.clientWidth){ _bgPrevC.width=_bgPrevC.clientWidth; _bgPrevC.height=_bgPrevC.clientHeight; }
  var W=_bgPrevC.width,H=_bgPrevC.height, X=_bgPrevX;
  // 01/10e: desenho parado (YouTube, pendrive, câmera, sem fundo) só é refeito quando muda;
  // cenário animado a ~30 quadros/s (antes 60/s o tempo todo — pesava no notebook)
  var _fk=(_bgFundoItems[_bgFundoIdx]||{key:'none'}).key, _parado=(!_bgCamFundo()&&_bgVidFonte==='youtube')||_bgCamFundo()||_bgVidFonte==='pendrive'||_fk==='none';
  var _sig=W+'x'+H+'|'+_bgCamOn+'|'+_bgVidFonte+'|'+_fk, _ag=performance.now();
  if((_parado&&_bgPrevLoop._sig===_sig)||(!_parado&&_ag-(_bgPrevLoop._t||0)<32)){ _bgPrevRAF=requestAnimationFrame(_bgPrevLoop); return; }
  _bgPrevLoop._sig=_sig; _bgPrevLoop._t=_ag;
  try{
    if(!_bgCamFundo()&&_bgVidFonte==='youtube'){ X.clearRect(0,0,W,H); }
    else if(_bgCamFundo()||_bgVidFonte==='pendrive'){
      X.clearRect(0,0,W,H); var g=X.createLinearGradient(0,0,W,H); g.addColorStop(0,'#10141f'); g.addColorStop(1,'#1a1012'); X.fillStyle=g; X.fillRect(0,0,W,H);
      X.fillStyle='rgba(255,255,255,.22)'; X.textAlign='center'; X.font='700 22px "Barlow Condensed",sans-serif';
      X.fillText(_bgCamFundo()?'CÂMERA AO VIVO':'VÍDEO DO PENDRIVE NA TELA',W/2,H*0.32);
    } else {
      var key=(_bgFundoItems[_bgFundoIdx]||{key:'none'}).key;
      if(key==='nebula') _bgDrawNebula(X,W,H);
      else if(key==='none'){ X.clearRect(0,0,W,H); X.fillStyle='#0a0c14'; X.fillRect(0,0,W,H); }
      else _bgDrawCosmos(X,W,H);
    }
  }catch(e){}
  _bgPrevRAF=requestAnimationFrame(_bgPrevLoop);
}
if(typeof _bgPrevStart==='function'){ var _bgPrevStartOrig=_bgPrevStart; _bgPrevStart=function(){ _bgPrevLoop._sig=null; _bgPrevLoop._t=0; return _bgPrevStartOrig.apply(this,arguments); }; }
// 02/10b: o que o cartão da câmera explica em cada modo
function _gvCartaoTxt(){
  var loc=_gv.local, yt=_gv.cfg&&_gv.cfg.yt_chave, mx=(_gv.cfg&&_gv.cfg.tx_max)||15;
  if(_bgCamModo==='rec') return '<span class="bgc-gv">⏺ grava a câmera e o roteiro da aula (para a aula gravada no app) '+(loc?'em <b>'+_pvEsc(loc.pasta)+'</b>':'<span class="bgc-av">· servidor local fora do ar: o arquivo é baixado no fim</span>')+'</span>';
  if(_bgCamModo==='live') return '<span class="bgc-gv">📡 grava e transmite: <b>app</b> (até '+mx+' pessoas)'
    +(yt?(loc&&loc.ffmpeg?' + <b>YouTube Live</b>':' · <span class="bgc-av">YouTube: falta o ffmpeg neste computador</span>'):' · <span style="color:rgba(255,255,255,.5)">YouTube: cole a chave no Portal → Gravar e transmitir</span>')+'</span>';
  return '<span class="bgc-breve">← → também grava a aula ou grava e transmite (app e YouTube)</span>';
}
var _BG_ORDEM=['musica','video','camera','fundo','iniciar'];
function _bgMover(dir){
  if(dir==='left'||dir==='right'){
    var s=dir==='right'?1:-1;
    if(_bgFoco==='musica'){ _bgTrocaFonte('musica',s); return; }
    if(_bgFoco==='video'){ _bgTrocaFonte('video',s); return; }
    if(_bgFoco==='camera'){ var _cm=['off','on','rec','live'], _ci=(_cm.indexOf(_bgCamModo)+s+4)%4; _bgCamModo=_cm[_ci]; _bgCamOn=_bgCamModo!=='off'; _bgRenderAll(); return; }
    if(_bgFoco==='fundo'){ _bgFundoIdx=(_bgFundoIdx+s+_bgFundoItems.length)%_bgFundoItems.length; _bgRenderAll(); return; }
    return;
  }
  var i=_BG_ORDEM.indexOf(_bgFoco); i=Math.max(0,Math.min(_BG_ORDEM.length-1,i+(dir==='down'?1:-1)));
  if(_BG_ORDEM[i]==='fundo' && (_bgVidFonte!=='none'||_bgCamFundo())) i=Math.max(0,Math.min(_BG_ORDEM.length-1,i+(dir==='down'?1:-1)));
  _bgFoco=_BG_ORDEM[i]; _bgRenderAll();
}
function _bgStart(){
  if(_bgFoco==='musica'){ if(_bgMusFonte==='mp3'){ bgSelecionarMV('music'); return; } _bgFoco='video'; _bgRenderAll(); return; }
  if(_bgFoco==='video'){ if(_bgVidFonte==='pendrive'&&!_bgCamFundo()){ bgSelecionarMV('video'); return; } _bgFoco='camera'; _bgRenderAll(); return; }
  if(_bgFoco==='camera'){ _bgFoco=(_bgVidFonte==='none'&&!_bgCamFundo())?'fundo':'iniciar'; _bgRenderAll(); return; }
  if(_bgFoco==='fundo'){ _bgFoco='iniciar'; _bgRenderAll(); return; }
  if(_bgFoco==='iniciar'){ _bgSection=1; bgConfirmar(); }
}
// a escolha na sub-lista do pendrive volta para cá: segue o fluxo novo
var _bgSubListaSelecionarOrig=_bgSubListaSelecionar;
_bgSubListaSelecionar=async function(idx){
  var tipo=_bgSubListaTipo;
  await _bgSubListaSelecionarOrig(idx);
  if(tipo==='video'){ _bgVidFonte='pendrive'; _bgFoco='camera'; }
  else { _bgMusFonte='mp3'; _bgFoco='video'; }
  _bgRenderAll();
};
async function bgConfirmar(){
  var d=(_bgPickerData&&_bgPickerData.d)||{};
  if(_bgSumTimer){ clearInterval(_bgSumTimer); _bgSumTimer=null; }
  var s=document.getElementById('bgPickerScreen'); if(s) s.style.display='none';
  // ── MÚSICA
  window._prSpotifyAula=null;
  var mi=(_bgMusFonte==='mp3')?_bgSelMusicItem:null, mcReal={ok:false,msg:'--'};
  if(mi){
    if(mi.handle){
      try{ var mf=await mi.handle.getFile();
        if(mp3ObjectUrl&&String(mp3ObjectUrl).indexOf('blob:')===0) URL.revokeObjectURL(mp3ObjectUrl);
        mp3ObjectUrl=URL.createObjectURL(mf);
        var tmp=new Audio(mp3ObjectUrl); await new Promise(function(r){ tmp.onloadedmetadata=r; tmp.onerror=r; setTimeout(r,8000); });
        mp3Duration=tmp.duration||0; mp3EndPoint=tmp.duration||0;
      }catch(ex){}
    }
    mcReal={ok:true,msg:mi.name||'Música'};
  } else {
    try{ if(mp3ObjectUrl&&String(mp3ObjectUrl).indexOf('blob:')===0) URL.revokeObjectURL(mp3ObjectUrl); }catch(e){}
    mp3ObjectUrl=''; mp3Duration=0; mp3EndPoint=0;
    var lk=(_bgMusFonte==='link')?_bgLinkDaAula(d):null;
    if(lk){ window._prSpotifyAula=lk; mcReal={ok:true,msg:_bgNomeFonte(lk.fonte)+' · '+lk.nome,link:true}; }
  }
  // ── VÍDEO
  try{ _prYTParar(); }catch(e){}
  window._prYT=null;
  var vi=(_bgVidFonte==='pendrive'&&!_bgCamFundo())?_bgSelVideoItem:null, vcReal={ok:false,msg:'--'};
  if(vi){
    if(vi.handle){
      try{ var vf=await vi.handle.getFile();
        if(videoObjectUrl&&String(videoObjectUrl).indexOf('blob:')===0) URL.revokeObjectURL(videoObjectUrl);
        videoObjectUrl=URL.createObjectURL(vf); videoSource='video'; _preloadVideo(videoObjectUrl);
        var off=0; try{ if(d.video&&d.video.syncOffset){ off=Number(d.video.syncOffset)||0; if(off>36000) off/=1000; } }catch(e){}
        await _prAplicarSyncVideo(videoObjectUrl,off);
      }catch(ex){}
    } else {
      videoSource='video';
      if(typeof videoEndPoint==='undefined'||!videoEndPoint){
        var off2=0; try{ if(d.video&&d.video.syncOffset){ off2=Number(d.video.syncOffset)||0; if(off2>36000) off2/=1000; } }catch(e){}
        try{ await _prAplicarSyncVideo(videoObjectUrl,off2); }catch(e){}
      }
    }
    bgActiveMode='none'; vcReal={ok:true,msg:vi.name||'Vídeo'};
  } else {
    try{ if(videoObjectUrl&&String(videoObjectUrl).indexOf('blob:')===0) URL.revokeObjectURL(videoObjectUrl); }catch(e){}
    videoObjectUrl=''; videoSource='none'; try{ videoEndPoint=0; }catch(e){}
    var yt=(_bgVidFonte==='youtube'&&!_bgCamFundo())?_bgYTDaAula(d):null;
    if(_bgCamFundo()){ _bgIniciarCamera(); return; }   // a câmera vai para o fundo; ela mesma abre a tela do QR
    if(yt){ window._prYT=yt; bgActiveMode='none'; vcReal={ok:true,msg:'YouTube · '+yt.titulo,yt:true}; _prYTPreparar(); }
    else { var fi=_bgFundoItems[_bgFundoIdx]||{key:'none'}; bgActiveMode=(fi.key!=='none')?fi.key:'none'; }
  }
  if(_bgCamOn&&!_bgCamFundo()){   // câmera só para gravar e transmitir: não aparece na TV
    try{ cameraStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false}); }catch(e){ console.warn('[ProRider] câmera não abriu: '+(e&&e.message)); }
  }
  mostrarPreAula(d,vcReal,mcReal);
}

// ═══ 6. QR CODE / ENTRAR NA AULA ═══════════════════════════════════
function mostrarPreAula(d,vc,mc){
  d=d||{}; boxMode='preAula';
  _fecharTodasTelas('boxPreAula');
  var el=document.getElementById('boxPreAula'); if(el) el.style.display='flex';
  window._preAulaD=d; window._preAulaVC=vc; window._preAulaMC=mc;
  var wo=(typeof workout!=='undefined'&&workout)?workout:[], tot=_pvTot(wo);
  var set=function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; };
  var setH=function(id,v){ var e=document.getElementById(id); if(e) e.innerHTML=v; };
  set('preAulaNome',d.nome||'ProRider'); set('preAulaCardNome',d.nome||'ProRider');
  set('preAulaTopo',[d.nome||'Aula',_saDur(tot),_pvProf()].filter(Boolean).join(' · '));
  set('preAulaMeta',_saDur(tot)+' · '+wo.length+(wo.length===1?' bloco':' blocos')+' · TSS '+_aulaTSS({workout:wo,tss:d.tss}));
  var ok=function(x){ return x&&x.ok&&x.msg&&x.msg!=='--'; };
  set('preAulaVid',ok(vc)?vc.msg:'—'); set('preAulaMus',ok(mc)?mc.msg:'—');
  var chip=function(h){ return '<span class="pv-pill" style="background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15)">'+h+'</span>'; }, ch='';
  if(window._prSpotifyAula) ch+=chip('🟢 '+_bgNomeFonte(window._prSpotifyAula.fonte));
  else if(ok(mc)) ch+=chip('🎵 MP3');
  if(window._prYT) ch+=chip('<span style="background:#ff0033;border-radius:4px;padding:0 4px;font-size:10px">▶</span> YouTube');
  else if(ok(vc)) ch+=chip('📹 Vídeo');
  else if(bgActiveMode==='camera') ch+=chip('📷 Câmera');
  setH('preAulaMidia',ch);
  setH('preAulaSegLbl',_pvFaixa(wo));
  setH('preAulaEixo',_pvEixo(tot));
  set('preAulaGoSub',window._prSpotifyAula?'contagem 3·2·1: no JÁ, dê play no '+_bgNomeFonte(window._prSpotifyAula.fonte)+' · quem chegar depois entra pela lupinha':'contagem 3·2·1 · quem chegar depois entra pela lupinha');
  // perfil com a agulha do progresso (a mesma de antes: preAulaAgulha)
  var graf=document.getElementById('preAulaGrafico');
  if(graf){
    var x=0, T=tot||1;
    graf.innerHTML=wo.map(function(b){ var z=_pvZ(b), s=_pvSec(b), l=x/T*100, w=s/T*100; x+=s;
        return '<div style="position:absolute;bottom:0;left:'+l.toFixed(3)+'%;width:'+w.toFixed(3)+'%;height:'+(PV_ZH[z]||22)+'%;padding:0 1.5px;box-sizing:border-box;"><div style="height:100%;border-radius:5px 5px 1px 1px;background:'+(PV_ZC[z]||'#888')+';"></div></div>'; }).join('')
      +'<div id="preAulaAgulhaFeito" style="position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(8,6,14,.55);pointer-events:none;z-index:2;"></div>'
      +'<div id="preAulaAgulha" style="position:absolute;top:0;bottom:0;width:0;left:0;display:none;pointer-events:none;z-index:3;"><div style="position:absolute;top:-2px;bottom:-2px;left:-1px;width:2px;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.7);"></div><div style="position:absolute;top:-5px;left:-5px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(255,255,255,.9);"></div></div>';
  }
  iniciarWS(); startWPP();
  var qd=document.getElementById('preAulaQR');
  if(qd){ qd.innerHTML=''; try{ new QRCode(qd,{text:salaCode,width:300,height:300,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H}); }catch(e){ qd.textContent=salaCode; } qd.removeAttribute('title'); }
  set('preAulaCodigo',salaCode);
  var bq=document.getElementById('preAulaBrowserQR');
  if(bq){ bq.innerHTML=''; try{ new QRCode(bq,{text:_BROWSER_ALUNO_URL,width:300,height:300,colorDark:'#111',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H}); }catch(e){ bq.textContent=_BROWSER_ALUNO_URL; } bq.removeAttribute('title'); }
  set('preAulaBrowserUrl',String(_BROWSER_ALUNO_URL||'').replace(/^https?:\/\//,''));
  _renderPreAlunos();
  if(preAulaTimer) clearInterval(preAulaTimer);
  preAulaTimer=setInterval(function(){ if(boxMode!=='preAula'){ clearInterval(preAulaTimer); return; } _renderPreAlunos(); },1000);
}
// Grade das bikes da sala: pedalando = borda verde com W e ♥; parado; livre; DEMO
// 01/10b: RESERVAS — quem reservou pelo app aparece na bike reservada já na
// tela do QR, mesmo antes de pedalar (cartão amarelo "reservou"). Pedalando
// na bike reservada (mesmo sem abrir o app) o cartão fica verde com o nome.
window._prResv=window._prResv||{aula:null,lista:[]};
var _resvTimer=null;
function _resvNorm(n){ return String(n||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
async function _resvBuscar(){
  var tk=_campToken(); if(!tk) return;
  try{
    var r=await fetch(SERVER_HTTP+'/display/reservas/agora',{headers:{'Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD}});
    if(!r.ok) return;
    var d=await r.json();
    var ant=JSON.stringify(window._prResv);
    window._prResv={aula:d.aula||null,lista:(d.reservas||[]).filter(function(x){ return x&&x.nome; })};
    try{ _resvPresentes(); }catch(e){}
    if(JSON.stringify(window._prResv)!==ant){
      console.log('[ProRider] reservas de '+(d.aula?d.aula.nome+' '+d.aula.hora:'—')+': '+window._prResv.lista.length);
      try{ _renderPreAlunos(); }catch(e){} try{ _wsEnviarSalaInfo(); }catch(e){}
    }
  }catch(e){}
}
// 02/10c: quem está na bike reservada (pedalando, com ou sem app) é marcado presente —
// assim o servidor não libera a bike dele 5 min depois do começo
var _resvJaPres={};
function _resvPresentes(){
  var tk=_campToken(); if(!tk) return;
  var ids=[], al=(typeof alunosMap!=='undefined')?alunosMap:{};
  (window._prResv.lista||[]).forEach(function(r){
    if(!r||!r.id||r.status==='presente'||_resvJaPres[r.id]) return;
    var ok=Object.keys(al).some(function(n){ var a=al[n]; if(!a||a._demo) return false;
      if(!a._virtual&&_resvNorm(n)===_resvNorm(r.nome)) return true;
      return parseInt(a.bike,10)===parseInt(r.bike,10)&&((a.watts||0)>0||(a.rpm||0)>0); });
    if(ok) ids.push(r.id);
  });
  if(!ids.length) return;
  ids.forEach(function(i){ _resvJaPres[i]=1; });
  fetch(SERVER_HTTP+'/display/reservas/presentes',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD},body:JSON.stringify({ids:ids})}).catch(function(){ ids.forEach(function(i){ delete _resvJaPres[i]; }); });
}
function _resvIniciar(){
  _resvBuscar();
  if(_resvTimer) return;
  _resvTimer=setInterval(function(){ if(boxMode!=='preAula'&&boxMode!=='live'){ clearInterval(_resvTimer); _resvTimer=null; return; } _resvBuscar(); },20000);
}
// reservas com bike, sem quem já entrou pelo app (pelo nome) → {bike: reserva}
function _resvPorBike(N){
  var out={}, conectados={};
  try{ Object.keys(alunosMap).forEach(function(n){ var a=alunosMap[n]; if(a&&!a._virtual) conectados[_resvNorm(n)]=1; }); }catch(e){}
  (window._prResv.lista||[]).forEach(function(r){ var b=parseInt(r.bike,10); if(!b||b<1||(N&&b>N)||out[b]) return; if(conectados[_resvNorm(r.nome)]) return; out[b]=r; });
  return out;
}
function _renderPreAlunos(){
  var grid=document.getElementById('preAulaAlunos'); if(!grid) return;
  var al=(typeof alunosMap!=='undefined')?alunosMap:{}, nomes=Object.keys(al);
  var N=_pvBikes(), slots={}, semBike=[];
  nomes.forEach(function(n){ var a=al[n]||{}, b=parseInt(a.bike,10); if(b>0 && !slots[b]){ slots[b]={n:n,a:a}; if(b>N) N=Math.min(40,b); } else semBike.push({n:n,a:a}); });
  var rv=_resvPorBike(N);
  // demo e quem ainda não escolheu bike ocupam as livres do fim para o começo (nunca uma reservada)
  var livres=[]; for(var k=N;k>=1&&livres.length<semBike.length;k--){ if(!slots[k]&&!rv[k]) livres.unshift(k); }
  livres.forEach(function(k,j){ slots[k]=semBike[j]; });
  var cols=N<=15?5:(N<=24?6:8), rows=Math.ceil(N/cols);
  grid.style.gridTemplateColumns='repeat('+cols+',minmax(0,1fr))';
  grid.style.gridTemplateRows='repeat('+rows+',minmax(0,1fr))';
  grid.classList.toggle('cmp',rows>=5||cols>=8);
  var naBike=0, ped=0, demo=0, nRes=0, h='';
  var avDe=function(nm,foto,roxo){ var ini=String(nm).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    return foto?'<span class="av" style="background-image:url(\''+_pvEsc(_campFoto(foto))+'\')"></span>':'<span class="av"'+(roxo?' style="background:linear-gradient(135deg,#b05cff,#6b2bd1)"':'')+'>'+_pvEsc(ini)+'</span>'; };
  for(var i=1;i<=N;i++){
    var s=slots[i], r=rv[i];
    if(!s&&r){ // reservou e ainda não chegou / não pedala
      nRes++;
      h+='<div class="rs"><div class="top"><span class="bn">'+i+'</span>'+avDe(r.nome,r.foto)+'<span class="nm">'+_pvEsc(r.nome)+'</span>'+_campCamisaHtml(r.nome,22)+'</div>'
        +'<div class="rs-st">reservou · aguardando</div></div>';
      continue;
    }
    if(!s){ h+='<div class="v"><div class="top"><span class="bn">'+i+'</span><span style="color:rgba(255,255,255,.5)">livre</span></div></div>'; continue; }
    var a=s.a, w=Math.round(a.watts||0), rpm=a.rpm||0, stale=false;
    try{ stale=a._bledSrc && ((Date.now()-(a._lastSeen||0))>GYM_BIKE_STALE_MS); }catch(e){}
    var pedala=(w>0||rpm>0)&&!stale, fc=0; try{ fc=_hrDe(a); }catch(e){}
    naBike++; if(pedala) ped++; if(a._demo) demo++;
    // bike sem login (só o sinal da bike) numa bike reservada: mostra quem reservou
    var nm=a._virtual?(r?r.nome:('Bike '+i)):s.n, foto=a._virtual?(r?r.foto:null):a.foto;
    if(a._virtual&&r) nRes++;
    h+='<div class="'+(pedala?'ped':(a._virtual&&r?'rs':''))+'"><div class="top"><span class="bn">'+i+'</span>'+avDe(nm,foto,a._demo)+'<span class="nm">'+_pvEsc(nm)+'</span>'+((a._virtual&&!r)?'':_campCamisaHtml(nm,22))+(a._demo?'<span class="demo">DEMO</span>':'')+'</div>'
      +(pedala?'<div class="dt"><span class="w">'+w+'<small> W</small></span>'+(fc?'<span class="hr">♥ '+fc+'</span>':'')+'</div>'
              :'<div style="color:rgba(255,255,255,.5);font-size:14px">'+(a._demo?'aluno de demonstração':(a._virtual&&r?'reservou · na bike':'na bike · parado'))+'</div>')+'</div>';
  }
  grid.innerHTML=h;
  var c=document.getElementById('preAulaConect'); if(c) c.textContent='● '+naBike+' de '+N+' na bike · '+ped+' pedalando'+(nRes?' · '+nRes+(nRes===1?' reserva':' reservas'):'');
  var c2=document.getElementById('preAulaConect2'); if(c2) c2.textContent=nomes.length;
  var dm=document.getElementById('preAulaDemo'); if(dm){ dm.style.display=demo?'inline-flex':'none'; dm.textContent='🤖 '+demo+(demo===1?' aluno demo':' alunos demo'); }
}
function _fitAlunosGrid(){}

// ═══ 7. YOUTUBE DE FUNDO, SINCRONIZADO COM A AULA ══════════════════
// Toca sem som (a música vem do MP3 ou da playlist). Começa em
// syncOffset − (aquecimento + principal), como o vídeo do pendrive, e segue
// o relógio da aula: pausa junto, pula junto quando o professor avança bloco.
var _prYTP=null, _prYTPronto=false, _prYTApiP=null, _prYTUlt=0;
function _prYTCarregarApi(){
  if(window.YT&&window.YT.Player) return Promise.resolve();
  if(_prYTApiP) return _prYTApiP;
  _prYTApiP=new Promise(function(res){
    var ant=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=function(){ try{ if(ant) ant(); }catch(e){} res(); };
    var s=document.createElement('script'); s.src='https://www.youtube.com/iframe_api'; s.onerror=function(){ console.error('[ProRider] YouTube: não consegui carregar a API (sem internet?).'); res(); };
    document.head.appendChild(s);
  });
  return _prYTApiP;
}
function _prYTWrap(){
  var w=document.getElementById('prYTWrap');
  if(!w){
    var lc=document.getElementById('liveClass'); if(!lc) return null;
    w=document.createElement('div'); w.id='prYTWrap';
    var bv=document.getElementById('backgroundVideo');
    if(bv&&bv.parentNode===lc) lc.insertBefore(w,bv.nextSibling); else lc.insertBefore(w,lc.firstChild);
    var b=document.createElement('div'); b.id='prYTBadge'; b.innerHTML='<i>▶</i> YouTube · sincronizado'; lc.appendChild(b);
  }
  return w;
}
async function _prYTPreparar(){
  var y=window._prYT; if(!y) return;
  await _prYTCarregarApi();
  if(!(window.YT&&window.YT.Player)){ _prYTFalhou('sem a API do YouTube'); return; }
  var w=_prYTWrap(); if(!w) return;
  try{ if(_prYTP&&_prYTP.destroy) _prYTP.destroy(); }catch(e){}
  _prYTP=null; _prYTPronto=false;
  w.innerHTML='<div id="prYTPlayer"></div>';
  _prYTP=new YT.Player('prYTPlayer',{
    videoId:y.id, width:'100%', height:'100%',
    playerVars:{autoplay:0,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,rel:0,playsinline:1,mute:1,start:Math.floor(y.start||0),origin:location.origin},
    events:{
      onReady:function(){ _prYTPronto=true; try{ _prYTP.mute(); }catch(e){} console.log('[ProRider] YouTube pronto: '+y.titulo+' (começa em '+Math.round(y.start)+' s).');
        try{ if(typeof isPlaying!=='undefined'&&isPlaying){ var pr=Math.min(1,(pausedElapsed/1000)/(_prSec(workout[currentBlockIndex])||1)); _prYTSync(calcDoneSec(pr),0); } }catch(e){} },
      onError:function(e){ _prYTFalhou('erro '+(e&&e.data)); }
    }
  });
}
function _prYTSync(doneSec,tol){
  var y=window._prYT; if(!y||!_prYTP||!_prYTPronto) return;
  var agora=Date.now(); if(tol>=1 && agora-_prYTUlt<1000) return; _prYTUlt=agora;
  var w=_prYTWrap(); if(w) w.style.display='block';
  var b=document.getElementById('prYTBadge'); if(b) b.style.display='flex';
  try{
    var alvo=(y.start||0)+Math.max(0,doneSec), t=_prYTP.getCurrentTime()||0, est=_prYTP.getPlayerState();
    if(y.dur && alvo>=y.dur-1){ if(est===1) _prYTP.pauseVideo(); return; }
    if(Math.abs(t-alvo)>Math.max(2.5,tol||0)) _prYTP.seekTo(alvo,true);
    if(typeof isPlaying!=='undefined'&&isPlaying && est!==1 && est!==3) _prYTP.playVideo();
  }catch(e){}
}
function _prYTPausar(){ try{ if(_prYTP&&_prYTPronto) _prYTP.pauseVideo(); }catch(e){} }
function _prYTParar(){
  try{ if(_prYTP&&_prYTP.destroy) _prYTP.destroy(); }catch(e){}
  _prYTP=null; _prYTPronto=false;
  var w=document.getElementById('prYTWrap'); if(w){ w.style.display='none'; w.innerHTML=''; }
  var b=document.getElementById('prYTBadge'); if(b) b.style.display='none';
}
function _prYTFalhou(motivo){
  console.error('[ProRider] YouTube não tocou ('+motivo+'). A aula segue com o cenário animado.');
  _prYTParar(); window._prYT=null;
  try{ bgActiveMode='cosmos'; if(typeof isPlaying!=='undefined'&&isPlaying) universeStartForce(); }catch(e){}
  try{ if(typeof _parToast==='function') _parToast('YouTube não tocou — seguindo com o cenário'); prErroTv('Vídeo do YouTube não tocou na aula (seguiu com o cenário)','aviso'); }catch(e){}
}
// a mídia da aula já é ancorada no relógio por estas duas funções: o YouTube entra junto
var _prMidiaSyncOrig=_prMidiaSync, _prMidiaPausarOrig=_prMidiaPausar;
_prMidiaSync=function(doneSec,tol){ _prMidiaSyncOrig(doneSec,tol); if(window._prYT) _prYTSync(doneSec,tol==null?1:tol); };
_prMidiaPausar=function(){ _prMidiaPausarOrig(); _prYTPausar(); };
if(typeof stopEverything==='function'){ var _stopEverythingOrig=stopEverything; stopEverything=function(){ try{ _prYTParar(); }catch(e){} return _stopEverythingOrig.apply(this,arguments); }; }
if(typeof _prLimparMidiaDaAula==='function'){ var _prLimparOrig=_prLimparMidiaDaAula; _prLimparMidiaDaAula=function(){ try{ _prYTParar(); }catch(e){} window._prYT=null; window._prSpotifyAula=null; return _prLimparOrig.apply(this,arguments); }; }

// ═══ 8. CONTAGEM 3·2·1 COM O PLAY DO SPOTIFY ═══════════════════════
// Aula e vídeo começam juntos no fim da contagem. Com playlist, a contagem
// avisa o professor e mostra "JÁ!" no instante de dar play no celular.
var _startCountdownOrig=startCountdown;
startCountdown=function(blockIndex,onComplete){
  var sp=window._prSpotifyAula, ov=document.getElementById('countdownOverlay');
  if(window._prYT){ var w=_prYTWrap(); if(w) w.style.display='block'; }
  var box=document.getElementById('cdSpotify');
  if(ov && !box){ box=document.createElement('div'); box.id='cdSpotify'; ov.appendChild(box); }
  if(box){ if(sp&&blockIndex===0){ box.innerHTML='<span style="font-size:34px">🟢</span><span>No <b>JÁ</b>, dê play no '+_bgNomeFonte(sp.fonte)+'</span>'; box.style.display='flex'; } else box.style.display='none'; }
  return _startCountdownOrig(blockIndex,function(){
    if(box) box.style.display='none';
    if(sp&&blockIndex===0){
      var lc=document.getElementById('liveClass'), ja=document.getElementById('cdJa');
      if(lc&&!ja){ ja=document.createElement('div'); ja.id='cdJa'; lc.appendChild(ja); }
      if(ja){ ja.innerHTML='<b>JÁ!</b><span>▶ play no '+_bgNomeFonte(sp.fonte)+'</span>'; ja.style.display='flex'; setTimeout(function(){ ja.style.display='none'; },1400); }
    }
    if(onComplete) onComplete();
  });
};

// ═══ 9. CAMPEONATO (01/10a) ════════════════════════════════════════
// Tour de France (amarela), Giro d'Italia (rosa), La Vuelta (vermelha) e
// Mundial (arco-íris do campeão). O Portal marca aulas da grade como
// ETAPAS; a TV descobre sozinha se a aula de agora é etapa, soma os pontos
// de sprint e de montanha bloco a bloco e, no fim, manda o resultado. A
// classificação volta do servidor e vira a 3ª tela do fim da aula (depois de
// AULA CONCLUÍDA e do RANKING). A camisa aparece ao lado do nome.
function prCamisaSVG(cor,w){
  var id='cj'+Math.random().toString(36).slice(2,8), defs='', fill=cor||'#888';
  if(cor==='bol-vermelha'||cor==='bol-azul'){ var dc=cor==='bol-azul'?'#2f6bff':'#d62d2d'; defs='<pattern id="'+id+'" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#fff"/><circle cx="4.5" cy="4.5" r="2.4" fill="'+dc+'"/></pattern>'; fill='url(#'+id+')'; }
  else if(cor==='arcoiris'){ var f=[[0,'#fff'],[.36,'#fff'],[.36,'#2f6bff'],[.44,'#2f6bff'],[.44,'#d62d2d'],[.52,'#d62d2d'],[.52,'#111'],[.6,'#111'],[.6,'#ffd400'],[.68,'#ffd400'],[.68,'#1fb34a'],[.76,'#1fb34a'],[.76,'#fff'],[1,'#fff']];
    defs='<linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1">'+f.map(function(x){return '<stop offset="'+x[0]+'" stop-color="'+x[1]+'"/>';}).join('')+'</linearGradient>'; fill='url(#'+id+')'; }
  return '<svg class="pr-camisa" width="'+w+'" height="'+Math.round(w*.875)+'" viewBox="0 0 64 56" style="flex-shrink:0;vertical-align:middle"><defs>'+defs+'</defs><path d="M20 4 L8 10 L2 24 L12 28 L14 22 L14 52 L50 52 L50 22 L52 28 L62 24 L56 10 L44 4 Q32 14 20 4 Z" fill="'+fill+'" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/></svg>';
}
var _camp={hoje:null,res:null,mostrado:false,enviado:false,blocos:{},timer:null};
function _campToken(){ try{ return (typeof _gymDisplayToken!=='undefined'&&_gymDisplayToken&&_gymDisplayToken!=='dev-bypass')?_gymDisplayToken:(localStorage.getItem('pr_display_token')||''); }catch(e){ return ''; } }
function _campFoto(u){ if(!u) return null; u=String(u); return (u.charAt(0)==='/')?(SERVER_HTTP+u):u; }
async function _campBuscarHoje(){
  _camp.hoje=null; var tk=_campToken(); if(!tk) return null;
  try{
    var r=await fetch(SERVER_HTTP+'/display/campeonato/hoje',{headers:{'Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD}});
    if(!r.ok) return null;
    var d=await r.json(); if(!d||!d.etapa) return null;
    _camp.hoje=d; console.log('[ProRider] esta aula é a etapa '+d.etapa.n+' de '+d.total_etapas+' do campeonato "'+d.campeonato.nome+'" ('+d.campeonato.tipo_nome+').');
    return d;
  }catch(e){ return null; }
}
// quem veste o quê: primeiro a classificação do campeonato de hoje, senão a camisa que veio do app
function _campCamisaDe(nome){
  var fonte=_camp.res||_camp.hoje;
  if(fonte&&fonte.classificacao){ for(var i=0;i<fonte.classificacao.length;i++){ var a=fonte.classificacao[i]; if(a.nome===nome&&a.camisa) return a.camisa; } }
  try{ var al=alunosMap[nome]; if(al&&al.camisa) return al.camisa; }catch(e){}
  return null;
}
function _campCamisaHtml(nome,w){ var c=_campCamisaDe(nome); return c?(' '+prCamisaSVG(c.cor,w||22)):''; }
// ── sprint e montanha, bloco a bloco ──
function _campTipoBloco(b){
  if(!b) return null;
  if(b.marca==='sprint'||b.marca==='montanha') return b.marca;
  var z=_pvZ(b), s=_pvSec(b), zi=['z1','z2','z3','z4','z5','z6','z7'].indexOf(z), pe=/p[eé]/i.test(String(b.position||''));
  var te=_camp.hoje&&_camp.hoje.etapa?_camp.hoje.etapa.tipo_etapa:'';
  if(zi>=5 && s<=90) return 'sprint';
  if(te==='sprint' && zi>=4 && s<=120) return 'sprint';
  if(zi>=3 && s>=120 && (pe || te==='montanha')) return 'montanha';
  return null;
}
function _campAmostrar(){
  try{
    if(!_camp.hoje||typeof isPlaying==='undefined'||!isPlaying||!workout||!workout.length) return;
    var i=currentBlockIndex, b=workout[i], t=_campTipoBloco(b); if(!t) return;
    var ac=_camp.blocos[i]||(_camp.blocos[i]={tipo:t,seg:_pvSec(b),n:0,al:{}}); ac.n++;
    Object.keys(alunosMap).forEach(function(n){ var a=alunosMap[n]; if(!a||a._virtual) return; var p=Number(a.ftp)||0; if(p<=0) return;
      var x=ac.al[n]||(ac.al[n]={s:0,k:0}); x.s+=p; x.k++; });
  }catch(e){}
}
function _campPontosBlocos(){
  var tot={};
  Object.keys(_camp.blocos).forEach(function(i){
    var ac=_camp.blocos[i]; if(!ac.n) return;
    var tab=ac.tipo==='sprint'?[10,7,5,3,2,1]:[10,8,6,4,2,1], mult=(ac.tipo==='montanha'&&ac.seg>=300)?2:1;
    Object.keys(ac.al).map(function(n){ var x=ac.al[n]; return {n:n,m:x.s/x.k,k:x.k}; })
      .filter(function(x){ return x.k>=ac.n*0.5; })            // precisa ter pedalado pelo menos metade do bloco
      .sort(function(a,b){ return b.m-a.m; })
      .forEach(function(x,pos){ if(pos>=tab.length) return; var o=tot[x.n]||(tot[x.n]={sprint:0,montanha:0}); o[ac.tipo]+=tab[pos]*mult; });
  });
  return tot;
}
async function _campEnviar(){
  if(!_camp.hoje||_camp.enviado) return null;
  _camp.enviado=true;
  var pb=_campPontosBlocos(), sc=(typeof wppScores!=='undefined')?wppScores:{};
  var lista=Object.keys(sc).filter(function(n){ var a=alunosMap[n]||{}; return !a._demo && !a._virtual && !/^Bike \d+$/.test(n); })
    .map(function(n){ var p=pb[n]||{}; return {nome:n,wpp:Math.round((sc[n]||0)*100)/100,sprint:p.sprint||0,montanha:p.montanha||0}; });
  if(!lista.length){ console.warn('[ProRider] campeonato: ninguém pedalou — etapa não enviada.'); return null; }
  // 03/10f: sem internet, o resultado fica guardado na TV e vai sozinho depois (o servidor não duplica a etapa)
  var r=await _prFilaPost('/display/campeonato/resultado',{etapa_id:_camp.hoje.etapa.id,sala:salaCode,resultados:lista},'resultado do campeonato (etapa '+_camp.hoje.etapa.n+')');
  if(!r.ok){ if(!r.guardado) _camp.enviado=false; return null; }
  _camp.res=r.d; _camp.mostrado=false;
  console.log('[ProRider] campeonato: resultado da etapa gravado ('+lista.length+' alunos).');
  return _camp.res;
}
// a TV procura a etapa quando abre a tela do QR e começa a somar os blocos
var _mostrarPreAulaSemCamp=mostrarPreAula;
mostrarPreAula=function(d,vc,mc){
  _mostrarPreAulaSemCamp(d,vc,mc);
  try{ _resvIniciar(); }catch(e){}
  _camp={hoje:null,res:null,mostrado:false,enviado:false,blocos:{},timer:_camp.timer};
  _campBuscarHoje().then(function(h){
    if(!h) return;
    var t=document.getElementById('preAulaTopo'); if(t) t.innerHTML=_pvEsc(t.textContent)+' · <span style="color:#ffe033">🏁 Etapa '+h.etapa.n+' de '+h.total_etapas+' · '+_pvEsc(h.campeonato.nome)+(h.etapa.tipo_etapa==='rainha'?' · 👑 pontos x2':'')+'</span>';
    try{ _renderPreAlunos(); }catch(e){}
  });
  if(!_camp.timer) _camp.timer=setInterval(_campAmostrar,500);
};
// fim da aula: manda o resultado assim que a tela AULA CONCLUÍDA aparece
if(typeof _fimNovoMostrar==='function'){
  var _fimNovoMostrarSemCamp=_fimNovoMostrar;
  _fimNovoMostrar=function(){ var r=_fimNovoMostrarSemCamp.apply(this,arguments);
    // resultado enviado → a tela é redesenhada uma vez, já com as camisas novas no pódio e no ranking
    if(_camp.hoje&&!_camp.enviado) _campEnviar().then(function(res){ try{ if(res&&document.getElementById('fimNovo')&&boxMode!=='endRanking') _fimNovoMostrarSemCamp(); }catch(e){} });
    return r; };
}
// camisa ao lado do nome no pódio e no ranking do fim da aula
if(typeof _fimLinha==='function'){
  var _fimLinhaSemCamp=_fimLinha;
  _fimLinha=function(a){ var h=_fimLinhaSemCamp.apply(this,arguments); if(!a) return h; var c=_campCamisaHtml(a.nome,30); return c?h.replace('</div><i class="dsx-barra">',c+'</div><i class="dsx-barra">'):h; };
}
if(typeof _fimPodioCol==='function'){
  var _fimPodioColSemCamp=_fimPodioCol;
  _fimPodioCol=function(al){ var h=_fimPodioColSemCamp.apply(this,arguments);
    (al||[]).slice(0,3).forEach(function(a){ if(!a) return; var c=_campCamisaHtml(a.nome,34); if(!c) return;
      var pr=String(a.nome).trim().split(/\s+/), curto=pr[0]+(pr[1]?' '+pr[1][0]+'.':''), alvo='<div class="dsx-pd-nome">'+_desEsc(curto)+'</div>';
      h=h.replace(alvo,'<div class="dsx-pd-nome">'+_desEsc(curto)+c+'</div>'); });
    return h; };
}
// 3ª tela: depois do RANKING (ou de INÍCIO), antes de voltar ao começo
var _resetCompletoSemCamp=resetCompleto;
resetCompleto=function(){
  if(_camp.res && !_camp.mostrado && document.getElementById('fimNovo')){ _camp.mostrado=true; _campMostrarTela(_camp.res); return; }
  var t=document.getElementById('campTela'); if(t) t.remove();
  _camp.res=null; _camp.hoje=null; _camp.blocos={}; _camp.enviado=false;
  return _resetCompletoSemCamp.apply(this,arguments);
};
function _campMostrarTela(d){
  boxMode='endRanking'; _endUnlockedAt=Date.now()+900;
  var el=document.getElementById('campTela');
  if(!el){ el=document.createElement('div'); el.id='campTela'; document.body.appendChild(el); }
  var tp=d.tipo_def||{}, cam=d.camisas||{}, c=d.campeonato||{}, mundial=c.tipo==='mundial';
  var cor=(tp.lider&&tp.lider.cor&&tp.lider.cor.charAt(0)==='#')?tp.lider.cor:'#ffe033';
  var foto=function(url,w,brd){ return url?'<img src="'+_pvEsc(_campFoto(url))+'" style="width:'+w+'px;height:'+w+'px;border-radius:50%;object-fit:cover;flex-shrink:0;border:3px solid '+brd+'">':''; };
  var cats=mundial?['lider']:['lider','pontos','montanha','jovem'];
  var cards=cats.map(function(k){ var def=tp[k]; if(!def) return ''; var h=cam[k], brd=(def.cor.charAt(0)==='#'?def.cor:(def.cor==='bol-azul'?'#2f6bff':(def.cor==='arcoiris'?'#ffd400':'#d62d2d')));
    var sub=!h?(mundial?'o campeão leva no fim':'ainda sem dono'):(k==='lider'?h.pontos+' pts · geral':k==='pontos'?h.pontos+' pts de sprint':k==='montanha'?h.pontos+' pts de montanha':'estreante · '+h.pontos+' pts');
    return '<div class="cp-lid">'+prCamisaSVG(def.cor,80)+'<div style="min-width:0;flex:1"><div class="cp-lbl">'+_pvEsc(def.rotulo)+'</div><div class="cp-nm">'+_pvEsc(h?h.nome:'—')+'</div><div class="cp-sub">'+sub+'</div></div>'+(h?foto(h.foto,92,brd):'')+'</div>'; }).join('');
  var cl=(d.classificacao||[]).slice(0,16);
  var linha=function(a){ if(!a) return '<div class="cp-rk cp-vz"></div>';
    var ini=String(a.nome).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    var dl=a.delta==null?'<span class="cp-dl">—</span>':(a.delta>0?'<span class="cp-dl cp-up">▲'+a.delta+'</span>':(a.delta<0?'<span class="cp-dl cp-dn">▼'+(-a.delta)+'</span>':'<span class="cp-dl">—</span>'));
    return '<div class="cp-rk'+(a.pos===1?' cp-1':'')+'"><span class="cp-p">'+a.pos+'º</span>'+(a.foto?foto(a.foto,46,'#ea860c'):'<span class="cp-av">'+_pvEsc(ini)+'</span>')
      +'<b class="cp-n">'+_pvEsc(a.nome)+(a.camisa?' '+prCamisaSVG(a.camisa.cor,34):'')+'</b>'+dl+'<span class="cp-et">'+a.etapas+(a.etapas===1?' etapa':' etapas')+'</span><b class="cp-pt">'+a.pontos+'<small> pts</small></b></div>'; };
  var col=function(i0){ var h=''; for(var i=i0;i<i0+8;i++) h+=linha(cl[i]); return '<div>'+h+'</div>'; };
  var enc=c.status==='encerrado';
  el.innerHTML='<div class="cp">'
    +'<div class="cp-top"><img src="logo-prorider.png" alt="ProRider" style="height:58px"><div class="cp-tt"><b>🏁 '+_pvEsc(String(c.nome||'').toUpperCase())+'</b><i>'+(enc?(mundial?'CAMPEÃO MUNDIAL':'CLASSIFICAÇÃO FINAL · CAMPEONATO ENCERRADO'):'CLASSIFICAÇÃO DEPOIS DA ETAPA '+d.feitas+' DE '+d.total_etapas)+' · '+_pvEsc(String(c.tipo_nome||'').toUpperCase())+'</i></div><div style="width:260px"></div></div>'
    +'<div class="cp-lids" style="grid-template-columns:repeat('+(mundial?1:4)+',1fr)">'+cards+'</div>'
    +'<div class="cp-cols">'+col(0)+col(8)+'</div>'
    +'<div class="cp-hint">qualquer botão para voltar ao início</div></div>';
  var st=document.getElementById('campTelaCss');
  if(!st){ st=document.createElement('style'); st.id='campTelaCss'; document.head.appendChild(st);
    st.textContent="#campTela{position:fixed;inset:0;z-index:30500;background:radial-gradient(ellipse at 50% -10%,rgba(255,224,51,.10),transparent 55%),#06050c;color:#fff;font-family:'Barlow',sans-serif}"
    +"#campTela .cp{position:absolute;inset:0;padding:26px 34px;display:flex;flex-direction:column}"
    +"#campTela .cp-top{display:flex;justify-content:space-between;align-items:flex-start}"
    +"#campTela .cp-tt{text-align:center}#campTela .cp-tt b{display:block;font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:60px;letter-spacing:2px;line-height:1}#campTela .cp-tt i{display:block;font-style:normal;letter-spacing:5px;color:rgba(255,255,255,.55);font-size:16px;margin-top:6px}"
    +"#campTela .cp-lids{display:grid;gap:16px;margin-top:20px}#campTela .cp-lid{border-radius:18px;padding:18px;display:flex;gap:16px;align-items:center;background:#1b1b21;border:1px solid rgba(255,255,255,.08);min-width:0}"
    +"#campTela .cp-lbl{font-size:13px;letter-spacing:1.6px;color:rgba(255,255,255,.5);font-weight:700;text-transform:uppercase}#campTela .cp-nm{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:34px;text-transform:uppercase;line-height:1;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#campTela .cp-sub{color:rgba(255,255,255,.5);font-size:15px;margin-top:4px}"
    +"#campTela .cp-cols{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:22px;flex:1;min-height:0}"
    +"#campTela .cp-rk{display:grid;grid-template-columns:60px 50px minmax(0,1fr) 70px 110px 110px;align-items:center;gap:14px;padding:0 18px;height:60px;border-radius:12px;background:rgba(255,255,255,.035);margin-bottom:7px}"
    +"#campTela .cp-vz{background:none}#campTela .cp-1{background:linear-gradient(90deg,rgba(255,212,0,.18),rgba(255,255,255,.03))}"
    +"#campTela .cp-p{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:32px;color:rgba(255,255,255,.55)}"
    +"#campTela .cp-av{width:46px;height:46px;border-radius:50%;border:2px solid #ea860c;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:900;color:#ea860c}"
    +"#campTela .cp-n{font-size:26px;display:flex;align-items:center;gap:10px;min-width:0;white-space:nowrap;overflow:hidden}"
    +"#campTela .cp-dl{text-align:center;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:rgba(255,255,255,.4)}#campTela .cp-up{color:#8fe06a}#campTela .cp-dn{color:#ff6b6b}"
    +"#campTela .cp-et{color:rgba(255,255,255,.5);font-size:15px;text-align:right}#campTela .cp-pt{font-family:'Barlow Condensed',sans-serif;font-size:36px;color:#ffe033;text-align:right}#campTela .cp-pt small{font-size:14px;color:rgba(255,255,255,.5)}"
    +"#campTela .cp-hint{text-align:center;color:rgba(255,255,255,.4);font-size:15px;letter-spacing:1px}";
  }
  el.style.display='block';
  try{ _prFade(el); }catch(e){}
}


// ═══ 10. TELA DE ESPERA ORIGINAL + AULAS CORRENDO EMBAIXO (01/10d) ═══
// Opção 2 aprovada pelo Mario: o ProRider fica SEMPRE no centro (a tela de
// espera original, fundo quadriculado). Com aula no dia: academia e data no
// canto de cima, relógio à direita, e as aulas de hoje passando numa faixa
// embaixo, uma atrás da outra (ao vivo em verde, próxima em laranja com a
// contagem). Sem aula: só o logo no centro.
var _idleTickAssin='';
function _gymGradeRender(grade){
  var side=document.getElementById('idleGrade'); if(side) side.style.display='none';
  var sc=document.getElementById('idleScreen');
  var el=_gymIdleAulasEl(); if(!el) return;
  window._gymGradeHoje=grade||[];
  if(!grade||!grade.length){ el.style.display='none'; el.className=''; el.innerHTML=''; _idleTickAssin=''; if(sc) sc.classList.remove('com-grade'); return; }
  if(!document.getElementById('idleTickCss')){
    var st=document.createElement('style'); st.id='idleTickCss';
    st.textContent="#idleAulas.tick{inset:0;padding:0;background:none!important;display:block;pointer-events:none}"
      +"#idleAulas .tk-ac{position:absolute;left:70px;top:60px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:28px;color:rgba(255,255,255,.55);letter-spacing:1px}"
      +"#idleAulas .tk-ac small{display:block;font-size:20px;color:rgba(255,255,255,.35);font-weight:600}"
      +"#idleAulas .tk-clk{position:absolute;right:70px;top:50px;font-family:'Bebas Neue',sans-serif;font-size:92px;line-height:.85;color:rgba(255,255,255,.9)}"
      +"#idleAulas .tk-lbl{position:absolute;left:0;right:0;bottom:190px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;letter-spacing:7px;color:rgba(255,255,255,.4);text-transform:uppercase}"
      +"#idleAulas .tk{position:absolute;left:0;right:0;bottom:56px;height:120px;overflow:hidden;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}"
      +"#idleAulas .tk-run{display:flex;height:100%;align-items:center;width:max-content;animation:idleTick linear infinite}"
      +"@keyframes idleTick{from{transform:translateX(0)}to{transform:translateX(-50%)}}"
      +"#idleAulas .tk-it{display:flex;align-items:center;gap:18px;padding:0 44px;white-space:nowrap;border-right:1px solid rgba(255,255,255,.08)}"
      +"#idleAulas .tk-it .h{font-family:'Bebas Neue',sans-serif;font-size:58px;line-height:1}"
      +"#idleAulas .tk-it .n{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:34px;text-transform:uppercase;line-height:1.05}"
      +"#idleAulas .tk-it .m{font-size:18px;color:rgba(255,255,255,.5)}"
      +"#idleAulas .tk-it .t{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:18px;letter-spacing:.5px;padding:3px 10px;border-radius:7px;background:#ea860c;color:#1b1b21}"
      +"#idleAulas .tk-it.v .t{background:#5db13d;color:#08130a}#idleAulas .tk-it.x{opacity:.35}"
      +"#idleAulas .tk-wake{position:absolute;left:0;right:0;bottom:16px;text-align:center;font-size:15px;letter-spacing:3px;color:rgba(255,255,255,.35);text-transform:uppercase}"
      +"#idleAulas .tk-wake b{border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:2px 8px;color:#fff;letter-spacing:1px;margin:0 6px}";
    document.head.appendChild(st);
  }
  var d=new Date(), agora=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
  var lista=grade.map(function(a){ var h=String(a.hora||'00:00').split(':'), ini=parseInt(h[0],10)*60+parseInt(h[1]||0,10), dur=parseInt(a.duracao_min,10)||50;
    return {a:a,ini:ini,fim:ini+dur,hhmm:(h[0]||'00')+':'+(h[1]||'00'),dur:dur}; }).sort(function(x,y){ return x.ini-y.ini; });
  var prox=lista.filter(function(x){ return x.ini>agora; })[0]||null;
  var fut=lista.filter(function(x){ return x.fim>agora; });
  var itens=lista.map(function(x){
    var a=x.a, vivo=agora>=x.ini&&agora<x.fim, dest=!vivo&&prox===x, feita=x.fim<=agora;
    var vagas=parseInt(a.vagas_max,10)||0, res=parseInt(a.reservas_hoje!=null?a.reservas_hoje:a.reservas,10)||0, prof=a.professor_nome||'';
    var tag=vivo?'AO VIVO AGORA':(dest?((x.ini-agora)<=90?'COMEÇA EM '+Math.max(1,Math.round(x.ini-agora))+' MIN':'PRÓXIMA'):'');
    return '<div class="tk-it'+(vivo?' v':feita?' x':'')+'"><span class="h">'+x.hhmm+'</span><div><div class="n">'+_gymEsc(a.nome||'Aula')+'</div><div class="m">'+(prof?_gymEsc(prof)+' · ':'')+x.dur+' min'+(vagas?' · 🚲 '+res+'/'+vagas:'')+(feita?' · concluída':'')+'</div></div>'+(tag?'<span class="t">'+tag+'</span>':'')+'</div>';
  });
  // repete a lista até encher bem mais que a tela, e duplica para a volta ficar contínua
  var bloco=itens.join(''), n=itens.length, rep=Math.max(1,Math.ceil(6/n)), meia=''; for(var i=0;i<rep;i++) meia+=bloco;
  var nomeAcad=''; try{ nomeAcad=localStorage.getItem('pr_display_academia')||''; }catch(e){}
  var dia=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}); dia=dia.charAt(0).toUpperCase()+dia.slice(1);
  var hr=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  var assin=meia+'|'+nomeAcad+'|'+dia;
  el.className='tick'; el.style.display='block'; if(sc) sc.classList.add('com-grade');
  if(assin===_idleTickAssin){ var c=document.getElementById('iaRelogio'); if(c) c.textContent=hr; return; }   // só o relógio: a faixa continua correndo sem pular
  _idleTickAssin=assin;
  el.innerHTML='<div class="tk-ac">'+_gymEsc(nomeAcad||'')+'<small>'+dia+'</small></div>'
    +'<div class="tk-clk" id="iaRelogio">'+hr+'</div>'
    +'<div class="tk-lbl">Aulas de hoje'+(fut.length?'':' · encerradas')+'</div>'
    +'<div class="tk"><div class="tk-run" style="animation-duration:'+Math.max(20,n*rep*9)+'s">'+meia+meia+'</div></div>'
    +'<div class="tk-wake">Pressione <b>START</b> ou <b>A</b> para começar</div>';
}

// ═══ 11. DESAFIO ENTRE ACADEMIAS (02/10a) ══════════════════════════
// Toda aula que termina manda um resumo ao servidor (vale para os desafios por
// período). Se a academia tem um desafio AO VIVO neste horário, a TV entra no
// "duelo" pelo WebSocket, manda a média da sala a cada 3 s e mostra a faixa
// com todas as academias no canto de cima. No fim, mostra o placar.
var _da={uid:null,ini:null,desafio:null,minha:null,lic:null,timer:null,ws:null,estado:null,enviado:false};
async function _daBuscar(){
  _da.desafio=null; var tk=_campToken(); if(!tk) return null;
  try{
    var r=await fetch(SERVER_HTTP+'/display/desafio-academias/agora',{headers:{'Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD}});
    if(!r.ok) return null; var d=await r.json(); if(!d||!d.desafio) return null;
    _da.desafio=d.desafio; _da.minha=d.minha_academia; _da.lic=d.license_id;
    console.log('[ProRider] desafio ao vivo entre academias: "'+d.desafio.nome+'" ('+d.desafio.ranking.map(function(x){return x.nome;}).join(' x ')+')');
    return d.desafio;
  }catch(e){ return null; }
}
function _daAcademiasTxt(){ return (_da.desafio&&_da.desafio.ranking||[]).map(function(x){ return x.nome; }).join(' x '); }
if(typeof iniciarAula==='function'){
  var _iniciarAulaSemDA=iniciarAula;
  iniciarAula=function(){
    _da.uid='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); _da.ini=new Date().toISOString(); _da.enviado=false; _da.estado=null; _da.sala=salaCode;   // 03/10s: no fim a sala já foi fechada
    var r=_iniciarAulaSemDA.apply(this,arguments);
    try{ _daPlacarIniciar(); }catch(e){}
    return r;
  };
}
// média da sala agora, na métrica do desafio (WPP, kcal, km ou alunos por bike), de quem pedala (sem demo)
function _daValorSala(){
  var sc=(typeof wppScores!=='undefined')?wppScores:{}, met=(_da.desafio&&_da.desafio.metrica)||'wpp', soma=0, n=0, kcal=0;
  Object.keys(alunosMap||{}).forEach(function(nm){ var a=alunosMap[nm]; if(!a||a._demo) return;
    var w=Number(sc[nm])||0, k=Math.round(a._kcalF!=null?a._kcalF:(a.kcal||0)); if(w<=0&&!(a.watts>0)&&k<=0) return;
    n++; kcal+=k; soma+=(met==='kcal'?k:met==='km'?(Number(a.dist)||0):w); });
  var v=n?soma/n:0; if(met==='presenca') v=n/Math.max(1,_pvBikes());
  return {valor:Math.round(v*100)/100,n:n,kcal:kcal};
}
function _daFmt(v){ var met=(_da.desafio&&_da.desafio.metrica)||'wpp'; v=Number(v)||0; return met==='kcal'?String(Math.round(v)):met==='km'?v.toFixed(1):v.toFixed(2); }
function _daMsg(e){
  var d; try{ d=JSON.parse(e.data); }catch(x){ return; }
  if(!d||d.tipo!=='duelo_estado'||!_da.desafio||d.desafio_id!==_da.desafio.id) return;
  _da.estado=d; _daRender();
}
function _daPlacarIniciar(){
  if(_da.timer){ clearInterval(_da.timer); _da.timer=null; }
  if(!_da.desafio) return;
  var tick=function(){
    if(boxMode!=='live'){ return; }
    try{
      if(typeof wsProf!=='undefined'&&wsProf&&wsProf.readyState===1){
        if(_da.ws!==wsProf){ _da.ws=wsProf; wsProf.addEventListener('message',_daMsg);
          wsProf.send(JSON.stringify({tipo:'duelo_entrar',desafio_id:_da.desafio.id,display_token:_campToken()})); }
        var v=_daValorSala(); wsProf.send(JSON.stringify({tipo:'duelo_placar',valor:v.valor,n:v.n,kcal:v.kcal}));
      }
    }catch(e){}
    _daRender();
  };
  tick(); _da.timer=setInterval(tick,3000);
}
function _daRender(){
  var el=document.getElementById('daBand');
  if(boxMode!=='live'||!_da.desafio){ if(el) el.style.display='none'; return; }
  if(!el){ el=document.createElement('div'); el.id='daBand'; document.body.appendChild(el); }
  var lista=(_da.estado&&_da.estado.academias)||[];
  if(!lista.some(function(x){ return x.license_id===_da.lic; })){ var v=_daValorSala(); lista=lista.concat([{license_id:_da.lic,nome:_da.minha||'Nós',valor:v.valor,n:v.n}]); }
  lista=lista.slice().sort(function(a,b){ return b.valor-a.valor; });
  (_da.desafio.ranking||[]).forEach(function(x){ if(!lista.some(function(y){ return y.license_id===x.license_id; })) lista.push({license_id:x.license_id,nome:x.nome,valor:0,n:0,fora:true}); });
  var mx=Math.max.apply(null,lista.map(function(x){ return x.valor; }).concat([0.01]));
  el.style.display='block';
  el.innerHTML='<div class="da-h">⚔ DESAFIO ENTRE ACADEMIAS <small>'+_pvEsc(_da.desafio.metrica_nome||'WPP médio')+'</small></div>'
    +lista.slice(0,6).map(function(x,i){ var eu=x.license_id===_da.lic;
      return '<div class="da-r'+(eu?' eu':'')+'"><b>'+(i+1)+'º</b><span class="nm">'+_pvEsc(x.nome)+'</span>'
        +'<span class="br"><i style="width:'+(x.valor/mx*100).toFixed(1)+'%"></i></span><span class="v">'+(x.fora?'aguardando':(_daFmt(x.valor)+' <small>· '+x.n+'</small>'))+'</span></div>'; }).join('');
}
async function _daEnviarResumo(){
  if(_da.enviado) return null; _da.enviado=true;
  if(_da.timer){ clearInterval(_da.timer); _da.timer=null; }
  var el=document.getElementById('daBand'); if(el) el.style.display='none';
  var tk=_campToken(); if(!tk) return null;
  var d={al:[]}; try{ d=_fimDados(); }catch(e){}
  var tot=0; try{ (workout||[]).forEach(function(b){ tot+=_prSec(b)||0; }); }catch(e){}
  var alunos=(d.al||[]).filter(function(a){ var m=alunosMap[a.nome]||{}; return !m._demo; }).map(function(a){ var m=alunosMap[a.nome]||{};
    return {nome:a.nome,wpp:Math.round((a.wpp||0)*100)/100,kcal:Math.round(a.kcal||0),km:Math.round((Number(m.dist)||0)*100)/100,w:a.w||0}; });
  // 03/10f: sem internet, o resumo fica guardado na TV e vai sozinho depois (mesmo uid = o servidor não duplica)
  var nomeA=d.cn||((document.getElementById('className')||{}).value)||'Aula';
  var _rel=null; try{ _rel=(typeof _prRelFechar==='function')?_prRelFechar():null; }catch(e){}   // 07/10c: relatório da aula
  var r=await _prFilaPost('/display/aula/resumo',{uid:_da.uid||('a'+Date.now().toString(36)),sala:_da.sala||salaCode,nome_aula:nomeA,inicio:_da.ini,dur_seg:tot,alunos:alunos,relatorio:_rel},'resumo da aula "'+nomeA+'"');
  if(!r.ok){ if(!r.guardado) _da.enviado=false; return null; }
  var res=r.d||{}; console.log('[ProRider] resumo da aula gravado ('+res.n_alunos+' pedalaram) — vale para os desafios entre academias.');
  if(res.desafios&&res.desafios.length) _daMostrarFim(res.desafios[0]);
  return res;
}
function _daMostrarFim(dz){
  var el=document.getElementById('daFim'); if(!el){ el=document.createElement('div'); el.id='daFim'; document.body.appendChild(el); }
  var rk=(dz.ranking||[]).slice(0,5);
  el.innerHTML='<div class="da-h">⚔ '+_pvEsc(dz.nome)+' <small>'+_pvEsc(dz.metrica_nome)+' · parcial, até todas terminarem</small></div>'
    +'<div class="da-f">'+rk.map(function(x){ return '<div class="'+(x.license_id===_da.lic?'eu':'')+'"><b>'+x.pos+'º</b> '+_pvEsc(x.nome)+' <span>'+(x.participacoes?_daFmt(x.valor):'—')+'</span></div>'; }).join('')+'</div>';
  el.style.display='block'; clearTimeout(_daMostrarFim._t); _daMostrarFim._t=setTimeout(function(){ el.style.display='none'; },25000);
}
// busca o desafio ao vivo junto com a tela do QR; manda o resumo no fim
var _mostrarPreAulaSemDA=mostrarPreAula;
mostrarPreAula=function(d,vc,mc){
  _mostrarPreAulaSemDA(d,vc,mc);
  _daBuscar().then(function(dz){ if(!dz) return;
    var t=document.getElementById('preAulaTopo'); if(t) t.innerHTML=t.innerHTML+' · <span style="color:#ff8a5c">⚔ Desafio ao vivo: '+_pvEsc(_daAcademiasTxt())+'</span>'; });
};
if(typeof _fimNovoMostrar==='function'){
  var _fimNovoMostrarSemDA=_fimNovoMostrar;
  _fimNovoMostrar=function(){ var r=_fimNovoMostrarSemDA.apply(this,arguments); try{ _daEnviarResumo(); }catch(e){} return r; };
}

// ═══ 12. GRAVAR E TRANSMITIR A AULA (02/10b) ═══════════════════════
// Câmera da TV + faixa com a aula (zona, tempo do bloco, FTP, RPM, perfil e
// o nome do professor) desenhadas num quadro 1280x720 a 30 quadros/s.
//  - GRAVAR: MediaRecorder → servidor-local.js → C:\ProRider\Gravacoes\*.webm
//    (sem o servidor local, o arquivo é baixado no fim da aula).
//  - APP: WebRTC direto da TV para cada celular (até tx_max, padrão 15).
//    O servidor só passa os recados. Usa o STUN público do Google, sem custo.
//  - YOUTUBE LIVE: os mesmos pedaços vão para o ffmpeg do computador da TV,
//    com a chave que o gestor colou no Portal.
// Modos no cartão da câmera: off / on (no fundo) / rec (gravar) / live (gravar e transmitir).
var _bgCamModo='off';
var _gv={cfg:null,canvas:null,ctx:null,timer:null,stream:null,mic:null,rec:null,mime:'',base:'',gravId:null,ytId:null,fila:Promise.resolve(),
  memoria:null,bytes:0,ini:0,pcs:{},ws:null,ativo:false,yt:false,erroYt:'',perfil:null,logo:null,estadoTx:null};
function _gvBase(){ return location.protocol==='file:'?'http://localhost:3000':''; }
async function _gvCarregarCfg(){
  var tk=_campToken(); if(!tk) return null;
  try{ var r=await fetch(SERVER_HTTP+'/display/transmissao',{headers:{'Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD}}); if(r.ok) _gv.cfg=await r.json(); }catch(e){}
  try{ var r2=await fetch(_gvBase()+'/gravacao/status',{cache:'no-store'}); _gv.local=r2.ok?await r2.json():null; }catch(e){ _gv.local=null; }
  try{ _bgRenderAll(); }catch(e){}
  return _gv.cfg;
}
function _gvTxt(id){ var e=document.getElementById(id); return e?String(e.textContent||'').trim():''; }
function _gvSec(t){ var p=String(t||'').split(':').map(function(x){ return parseInt(x,10)||0; }); return p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:0; }
var _GV_ZN={z1:'RECOVERY',z2:'ENDURANCE',z3:'TEMPO',z4:'THRESHOLD',z5:'VO2 MAX',z6:'ANAERÓBICO',z7:'NEUROMUSCULAR'};
function _gvPerfil(){
  var wo=(typeof workout!=='undefined'&&workout)||[], tot=0; wo.forEach(function(b){ tot+=_pvSec(b); });
  var c=document.createElement('canvas'); c.width=420; c.height=46; var x=c.getContext('2d'), acc=0;
  wo.forEach(function(b){ var z=_pvZ(b), w=_pvSec(b)/(tot||1)*420, h=(PV_ZH[z]||22)/100*46; x.fillStyle=PV_ZC[z]||'#888'; x.fillRect(acc+0.5,46-h,Math.max(1,w-1),h); acc+=w; });
  _gv.perfil={c:c,tot:tot};
}
function _gvDesenhar(){
  var X=_gv.ctx, W=1280, H=720, v=(typeof cameraLive!=='undefined')?cameraLive:null;
  X.fillStyle='#05070f'; X.fillRect(0,0,W,H);
  if(v&&v.videoWidth){ var r=Math.max(W/v.videoWidth,H/v.videoHeight), vw=v.videoWidth*r, vh=v.videoHeight*r; try{ X.drawImage(v,(W-vw)/2,(H-vh)/2,vw,vh); }catch(e){} }
  var g=X.createLinearGradient(0,500,0,H); g.addColorStop(0,'rgba(5,7,15,0)'); g.addColorStop(1,'rgba(5,7,15,.92)'); X.fillStyle=g; X.fillRect(0,500,W,220);
  // topo: REC / AO VIVO e a academia
  X.font='700 20px "Barlow Condensed",Arial'; X.textBaseline='middle';
  var tag=_gv.ativo?'● AO VIVO':'● REC'; X.fillStyle='rgba(0,0,0,.55)'; X.fillRect(20,18,X.measureText(tag).width+28,36); X.fillStyle=_gv.ativo?'#ff3355':'#ff5d5d'; X.fillText(tag,34,37);
  var ac=_pvAcad(); if(ac){ X.textAlign='right'; X.fillStyle='rgba(255,255,255,.85)'; X.fillText(ac.toUpperCase(),W-24,37); X.textAlign='left'; }
  // esquerda: logo, aula e professor
  if(_gv.logo&&_gv.logo.complete&&_gv.logo.naturalWidth){ var lh=44, lw=_gv.logo.naturalWidth*lh/_gv.logo.naturalHeight; X.drawImage(_gv.logo,26,600,lw,lh); }
  var inf={}; try{ inf=_gymAulaAtualInfo()||{}; }catch(e){}
  X.fillStyle='#fff'; X.font='800 26px "Barlow Condensed",Arial'; X.fillText(String(inf.nome||'Aula').toUpperCase().slice(0,28),26,668);
  X.fillStyle='rgba(255,255,255,.65)'; X.font='600 18px Barlow,Arial'; X.fillText(inf.professor?('Prof. '+inf.professor):'ProRider',26,694);
  // centro: zona e tempo do bloco
  var wo=(typeof workout!=='undefined'&&workout)||[], bi=(typeof currentBlockIndex!=='undefined')?currentBlockIndex:0, b=wo[bi]||null, z=b?_pvZ(b):'z1', cor=PV_ZC[z]||'#888';
  X.fillStyle=cor; X.beginPath(); if(X.roundRect) X.roundRect(430,586,240,40,10); else X.rect(430,586,240,40); X.fill();
  X.fillStyle=(z==='z4'||z==='z3')?'#111':'#fff'; X.font='900 24px "Barlow Condensed",Arial'; X.textAlign='center'; X.fillText(z.toUpperCase()+' · '+(_GV_ZN[z]||''),550,607);
  X.fillStyle='#fff'; X.font='900 64px "Barlow Condensed",Arial'; X.fillText(_gvTxt('timerText')||'--:--',550,668);
  X.textAlign='left'; X.font='700 20px Barlow,Arial'; X.fillStyle='rgba(255,255,255,.9)';
  X.fillText('FTP '+(_gvTxt('ftpCircleText')||'—'),700,602); X.fillText('RPM '+(_gvTxt('rpmText')||'—'),700,632); X.fillText(_gvTxt('currentPositionText')||'',700,662);
  // direita: perfil com o progresso e o tempo total
  if(!_gv.perfil) _gvPerfil();
  var pf=_gv.perfil, px=W-446, py=600;
  X.globalAlpha=.85; X.drawImage(pf.c,px,py); X.globalAlpha=1;
  var feito=0; for(var i=0;i<bi&&i<wo.length;i++) feito+=_pvSec(wo[i]); if(b) feito+=Math.max(0,_pvSec(b)-_gvSec(_gvTxt('timerText')));
  var fx=px+Math.min(1,feito/(pf.tot||1))*420; X.fillStyle='rgba(5,7,15,.55)'; X.fillRect(px,py,fx-px,46); X.fillStyle='#fff'; X.fillRect(fx-1,py-6,3,58);
  X.fillStyle='rgba(255,255,255,.7)'; X.font='600 16px Barlow,Arial'; X.fillText('falta '+(_gvTxt('pg2iTot')||'—'),px,py+70);
}
async function _gvPost(caminho,corpo){
  var r=await fetch(_gvBase()+caminho,{method:'POST',body:corpo||'',headers:corpo&&typeof corpo==='string'?{'Content-Type':'application/json'}:{}});
  var d={}; try{ d=await r.json(); }catch(e){} if(!r.ok) throw new Error(d.erro||('erro '+r.status)); return d;
}
// 02/10b2: a GRAVAÇÃO é a câmera limpa (vídeo + voz) e um ROTEIRO com o que
// acontecia na TV a cada segundo (bloco, segundo do bloco, tela, pausa,
// desafio). No celular, o app toca o vídeo e monta o gráfico, as bolas e as
// telas com os números do PRÓPRIO aluno, pelo relógio do vídeo. O quadro com
// a faixa da aula só é montado para a transmissão (app e YouTube).
function _gvFila(caminho,buf){
  _gv.fila=_gv.fila.then(function(){
    if(!caminho()) return;
    return fetch(_gvBase()+caminho(),{method:'POST',body:buf}).then(function(r){
      if(r.status===410&&/\/yt\//.test(caminho())) return r.json().then(function(d){ _gv.erroYt=d.erro||'o YouTube parou'; _gv.ytId=null; console.error('[ProRider] YouTube: '+_gv.erroYt); });
    }).catch(function(){});
  });
}
function _gvBlocosApp(){
  var wo=(typeof workout!=='undefined'&&workout)||[];
  return wo.map(function(b){ var z=_pvZ(b);
    return {z:z,dur:Math.round(_pvSec(b))/60,ftp:[b.ftpMin||0,b.ftpMax||b.ftpMin||0],rpm:[b.rpmMin||0,b.rpmMax||b.rpmMin||0],
      pos:/em\s*p|stand/i.test(String(b.position||''))?'Standing':'Seated',label:b.label||b.nome||'',seg:b.segmentId||''}; });
}
var _GV_DTIPO={kcal:1,dist:2,potMedia:3,potMax:4,cabo:5};
function _gvAmostra(){
  if(!_gv.rot) return;
  var t=Math.round((Date.now()-_gv.ini)/1000);
  var wo=(typeof workout!=='undefined'&&workout)||[], bi=(typeof currentBlockIndex!=='undefined')?currentBlockIndex:0;
  var feito=window._prDoneSecAgora>0?window._prDoneSecAgora:0, ant=0; for(var i=0;i<bi&&i<wo.length;i++) ant+=_pvSec(wo[i]);
  var e=Math.max(0,Math.round(feito-ant));
  var tela=(typeof ctrlScreen!=='undefined')?ctrlScreen:0, pausa=(typeof isPlaying!=='undefined'&&!isPlaying)?1:0;
  var d=(typeof desafio!=='undefined'&&desafio.ativo)?(_GV_DTIPO[desafio.tipo]||1):0, ds=d?Math.floor(desafio._seg||0):0;
  _gv.rot.a.push([t,bi,e,tela,pausa,d,ds]);
}
async function _gvIniciar(){
  if(_gv.rec||_bgCamModo==='off'||_bgCamModo==='on') return;
  if(typeof cameraStream==='undefined'||!cameraStream){ console.warn('[ProRider] gravação: câmera não abriu — nada para gravar.'); try{ prErroTv('Gravação não começou: a câmera não abriu','erro'); }catch(_e){} try{ if(typeof _parToast==='function') _parToast('GRAVAÇÃO NÃO COMEÇOU: a câmera não abriu (confira o cabo e a permissão da câmera)'); }catch(_t){} return; }
  var inf={}; try{ inf=_gymAulaAtualInfo()||{}; }catch(e){}
  _gv.ini=Date.now(); _gv.bytes=0; _gv.memoria=null; _gv.gravId=null; _gv.ytId=null; _gv.erroYt=''; _gv.yt=false; _gv.perfil=null;
  try{ _gv.mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:true,autoGainControl:true},video:false}); }
  catch(e){ _gv.mic=null; console.warn('[ProRider] gravação: sem microfone — vai sem som.'); }
  var audio=_gv.mic?_gv.mic.getAudioTracks():[];
  var mimeDe=function(c){ return c.find(function(m){ try{ return MediaRecorder.isTypeSupported(m); }catch(e){ return false; } })||''; };
  // 1) arquivo: câmera limpa + voz
  var limpo=new MediaStream(cameraStream.getVideoTracks().concat(audio));
  _gv.mime=mimeDe(['video/webm;codecs=vp8,opus','video/webm']);
  _gv.rot={v:1,aula:inf.nome||'Aula',professor:inf.professor||'',academia:_pvAcad(),inicio:new Date(_gv.ini).toISOString(),uid:(typeof _da!=='undefined'&&_da.uid)||null,
    blocos:_gvBlocosApp(),campos:['t','bloco','seg_no_bloco','tela','pausa','desafio','desafio_seg'],a:[]};
  try{ var g=await _gvPost('/gravacao/inicio?aula='+encodeURIComponent(inf.nome||'Aula')+'&prof='+encodeURIComponent(inf.professor||'')); _gv.gravId=g.id; _gv.arquivo=g.arquivo; console.log('[ProRider] gravando (câmera + roteiro) em '+g.arquivo); }
  catch(e){ _gv.memoria=[]; console.warn('[ProRider] gravação: servidor local fora do ar ('+(e&&e.message)+') — o arquivo vai ser baixado no fim da aula.'); try{ prErroTv('Gravando sem o servidor local do Ginásio (vídeo vai para Downloads)','aviso'); }catch(_e){} try{ if(typeof _parToast==='function') _parToast('Gravando sem o servidor local: o vídeo será BAIXADO no fim da aula (pasta Downloads)'); }catch(_t){} }
  try{ _gv.rec=new MediaRecorder(limpo,_gv.mime?{mimeType:_gv.mime,videoBitsPerSecond:1500000,audioBitsPerSecond:96000}:{}); }
  catch(e){ console.error('[ProRider] gravação: o navegador não grava este formato — '+e.message); _gv.rec=null; return; }
  _gv.rec.ondataavailable=function(ev){ if(!ev.data||!ev.data.size) return; _gv.bytes+=ev.data.size; if(_gv.memoria) _gv.memoria.push(ev.data);
    ev.data.arrayBuffer().then(function(b){ _gvFila(function(){ return _gv.gravId?'/gravacao/'+_gv.gravId+'/parte':null; },b); }); };
  _gv.rec.start(1000);
  _gvAmostra(); _gv.rotT=setInterval(_gvAmostra,1000);
  // 2) transmissão: quadro com a faixa da aula (só no modo "gravar e transmitir")
  if(_bgCamModo==='live'){
    _gv.logo=new Image(); _gv.logo.src='logo-prorider.png';
    _gv.canvas=document.createElement('canvas'); _gv.canvas.width=1280; _gv.canvas.height=720; _gv.ctx=_gv.canvas.getContext('2d');
    _gvDesenhar(); _gv.timer=setInterval(function(){ try{ _gvDesenhar(); }catch(e){} },33);
    _gv.stream=new MediaStream(_gv.canvas.captureStream(30).getVideoTracks().concat(audio));
    var ch=_gv.cfg&&_gv.cfg.yt_chave;
    if(ch){
      var m2=mimeDe(['video/webm;codecs=h264,opus','video/webm;codecs=vp8,opus','video/webm']);
      try{ var y=await _gvPost('/yt/inicio',JSON.stringify({chave:ch,codec:m2})); _gv.ytId=y.id; _gv.yt=true;
        _gv.recYt=new MediaRecorder(_gv.stream,m2?{mimeType:m2,videoBitsPerSecond:2500000,audioBitsPerSecond:128000}:{});
        _gv.recYt.ondataavailable=function(ev){ if(ev.data&&ev.data.size) ev.data.arrayBuffer().then(function(b){ _gvFila(function(){ return _gv.ytId?'/yt/'+_gv.ytId+'/parte':null; },b); }); };
        _gv.recYt.start(1000); console.log('[ProRider] YouTube Live: transmitindo.'); }
      catch(e){ _gv.erroYt=e.message; console.error('[ProRider] YouTube Live não começou: '+e.message); }
    }
    _gvTxLigar(true);
  }
  _gvBadge();
}
function _gvPararRec(rec){ return new Promise(function(ok){ if(!rec||rec.state==='inactive') return ok(); rec.onstop=function(){ ok(); }; try{ rec.stop(); }catch(e){ ok(); } setTimeout(ok,3000); }); }
async function _gvParar(){
  if(!_gv.timer&&!_gv.rec&&!_gv.rotT) return;
  var rec=_gv.rec, recYt=_gv.recYt; _gv.rec=null; _gv.recYt=null;
  _gvTxLigar(false);   // avisa já quem assiste (antes de a sala fechar)
  clearInterval(_gv.rotT); _gv.rotT=null; try{ _gvAmostra(); }catch(e){}
  await Promise.all([_gvPararRec(rec),_gvPararRec(recYt)]);
  clearInterval(_gv.timer); _gv.timer=null;
  try{ (_gv.mic&&_gv.mic.getTracks()||[]).forEach(function(t){ t.stop(); }); }catch(e){} _gv.mic=null;
  await _gv.fila;
  var inf={}; try{ inf=_gymAulaAtualInfo()||{}; }catch(e){}
  var dur=Math.round((Date.now()-_gv.ini)/1000), res=null, rot=_gv.rot; _gv.rot=null;
  if(_gv.ytId){ try{ await _gvPost('/yt/'+_gv.ytId+'/fim'); }catch(e){} _gv.ytId=null; }
  if(_gv.gravId){
    try{ await _gvPost('/gravacao/'+_gv.gravId+'/roteiro',JSON.stringify(rot)); }catch(e){}
    try{ res=await _gvPost('/gravacao/'+_gv.gravId+'/fim'); }catch(e){} _gv.gravId=null;
  } else if(_gv.memoria&&_gv.memoria.length&&!_gv.descartar){
    var nm='ProRider_'+String(inf.nome||'aula').replace(/[^\w-]+/g,'_');
    var baixar=function(blob,arq){ var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=arq; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); },2000); };
    var vb=new Blob(_gv.memoria,{type:'video/webm'}); baixar(vb,nm+'.webm'); baixar(new Blob([JSON.stringify(rot)],{type:'application/json'}),nm+'.json');
    res={arquivo:nm+'.webm',bytes:vb.size,local:true}; _gv.memoria=null;
  }
  _gvBadge(); _gv.stream=null;
  if(_gv.descartar){ _gv.descartar=false; console.log('[ProRider] gravação da largada descartada (aula recomeçada).'); return; }
  if(!res) return;
  console.log('[ProRider] gravação salva: '+res.arquivo+' ('+Math.round((res.bytes||0)/1048576)+' MB) + roteiro ('+(rot&&rot.a.length)+' segundos)');
  try{ if(typeof _parToast==='function') _parToast('Gravação salva: '+String(res.arquivo).split(/[\\/]/).pop()+' ('+Math.round((res.bytes||0)/1048576)+' MB)'); }catch(_t){}
  var tk=_campToken(); if(!tk) return;
  // 03/10f: a ficha vai pela caixa de saída — sem internet, fica guardada e, quando volta, segue o envio para o app
  var r=await _prFilaPost('/display/gravacao',{nome_aula:inf.nome||'Aula',professor:inf.professor||'',dur_seg:dur,arquivo:res.arquivo,bytes:res.bytes||0,transmitida:_bgCamModo==='live',youtube:_gv.yt,uid:rot&&rot.uid,roteiro:rot},
    'ficha da gravação "'+(inf.nome||'Aula')+'"',{tipo:'gravacao',arquivo:res.arquivo,bytes:res.bytes||0,local:!!res.local});
  var d=r.d||{};
  if(!r.ok&&!r.guardado) try{ if(typeof _parToast==='function') _parToast('Gravação ficou só no computador: o servidor recusou a ficha ('+(d.error||r.status)+')'); }catch(_t){}
  if(r.ok&&d.teste&&!res.local) _gvEnviarTeste(d.id,res.arquivo,res.bytes||0);
  else if(r.ok&&res.local) try{ if(typeof _parToast==='function') _parToast('Gravação baixada no computador. Para ir ao app, o servidor local precisa estar ligado.'); }catch(_t){}
}
// envia a gravação para o servidor de TESTE (fica 72 h; dá para assistir no app
// antes de contratar a nuvem de vídeo). Pedaços de 8 MB, em segundo plano.
async function _gvEnviarTeste(id,arquivo,bytes){
  var tk=_campToken(), PED=8*1048576, nome=String(arquivo).split(/[\\/]/).pop();
  console.log('[ProRider] enviando a gravação para testar no app ('+Math.round(bytes/1048576)+' MB)…');
  for(var ofs=0;ofs<bytes;ofs+=PED){
    var fim=Math.min(bytes,ofs+PED)-1, ok=false;
    for(var k=0;k<3&&!ok;k++){
      try{
        var r=await fetch(_gvBase()+'/gravacao/arquivo?n='+encodeURIComponent(nome),{headers:{Range:'bytes='+ofs+'-'+fim}});
        var buf=await r.arrayBuffer();
        var u=await fetch(SERVER_HTTP+'/display/gravacao/'+id+'/parte?ofs='+ofs,{method:'POST',headers:{'Content-Type':'application/octet-stream','Authorization':'Bearer '+tk},body:buf});
        ok=u.ok;
      }catch(e){}
    }
    if(!ok){ console.error('[ProRider] envio da gravação parou em '+Math.round(ofs/1048576)+' MB.'); try{ prErroTv('Envio da gravação para o app parou (o vídeo continua no computador)','aviso'); }catch(_e){} try{ if(typeof _parToast==='function') _parToast('Envio da gravação para o app parou em '+Math.round(ofs/1048576)+' MB (o arquivo continua no computador)'); }catch(_t){} return; }
  }
  try{ await fetch(SERVER_HTTP+'/display/gravacao/'+id+'/pronta',{method:'POST',headers:{'Authorization':'Bearer '+tk}}); console.log('[ProRider] gravação pronta para testar no app (Loja → Aulas gravadas).'); try{ if(typeof _parToast==='function') _parToast('Gravação no app ✓ (Loja → Aulas gravadas)'); }catch(_t){} }catch(e){}
}
// selo pequeno no canto da TV enquanto grava / transmite
function _gvBadge(){
  var el=document.getElementById('gvBadge');
  if(!_gv.rec){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement('div'); el.id='gvBadge'; document.body.appendChild(el); }
  var nv=Object.keys(_gv.pcs).length;
  el.innerHTML='<i></i>'+(_gv.ativo?'AO VIVO':'GRAVANDO')+(_gv.ativo?' · 📱 '+nv+(_gv.yt?' · ▶ YouTube':''):'')+(_gv.erroYt?' · <span style="color:#ffb45a">YouTube: '+_pvEsc(String(_gv.erroYt).slice(0,60))+'</span>':'');
}
// ── WebRTC: a TV manda o vídeo para cada celular que pede ───────────
var _GV_ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
function _gvWsSend(o){ try{ if(typeof wsProf!=='undefined'&&wsProf&&wsProf.readyState===1) wsProf.send(JSON.stringify(o)); }catch(e){} }
function _gvTxLigar(on){
  _gv.ativo=!!on;
  if(on){ _gvTxBind(); _gvWsSend({tipo:'tx_estado',ativo:true,max:(_gv.cfg&&_gv.cfg.tx_max)||15});
    if(!_gv.txT) _gv.txT=setInterval(function(){ if(!_gv.ativo) return; if(_gv.ws!==wsProf){ _gvTxBind(); _gvWsSend({tipo:'tx_estado',ativo:true,max:(_gv.cfg&&_gv.cfg.tx_max)||15}); } _gvBadge(); },3000); }
  else { _gvWsSend({tipo:'tx_estado',ativo:false}); clearInterval(_gv.txT); _gv.txT=null;
    Object.keys(_gv.pcs).forEach(function(k){ try{ _gv.pcs[k].close(); }catch(e){} }); _gv.pcs={}; }
}
function _gvTxBind(){ if(typeof wsProf==='undefined'||!wsProf||_gv.ws===wsProf) return; _gv.ws=wsProf; wsProf.addEventListener('message',_gvTxMsg); }
function _gvTxMsg(e){
  var d; try{ d=JSON.parse(e.data); }catch(x){ return; }
  if(!d||!_gv.ativo) return;
  if(d.tipo==='tx_novo'&&d.vid){
    if(!_gv.stream) return;
    var pc=new RTCPeerConnection({iceServers:_GV_ICE}); _gv.pcs[d.vid]=pc;
    // 02/10j: TV de outra academia (aula em rede) recebe a câmera LIMPA + a voz (a faixa da aula ela já tem);
    // o celular recebe o quadro com a faixa
    var st=_gv.stream;
    if(d.tv&&typeof cameraStream!=='undefined'&&cameraStream){ st=new MediaStream(cameraStream.getVideoTracks().concat(_gv.mic?_gv.mic.getAudioTracks():[])); }
    st.getTracks().forEach(function(t){ pc.addTrack(t,st); });
    pc.onicecandidate=function(ev){ if(ev.candidate) _gvWsSend({tipo:'tx_sinal',vid:d.vid,dado:{ice:ev.candidate}}); };
    pc.onconnectionstatechange=function(){ if(pc.connectionState==='failed'||pc.connectionState==='closed'){ delete _gv.pcs[d.vid]; _gvBadge(); } };
    pc.createOffer().then(function(o){ return pc.setLocalDescription(o); }).then(function(){ _gvWsSend({tipo:'tx_sinal',vid:d.vid,dado:{sdp:pc.localDescription}}); }).catch(function(err){ console.error('[ProRider] transmissão: '+err); });
    console.log('[ProRider] transmissão: '+(d.nome||'alguém')+' começou a assistir ('+Object.keys(_gv.pcs).length+')'); _gvBadge();
  } else if(d.tipo==='tx_sinal'&&d.vid&&_gv.pcs[d.vid]){
    var p=_gv.pcs[d.vid], dd=d.dado||{};
    if(dd.sdp) p.setRemoteDescription(dd.sdp).catch(function(){});
    else if(dd.ice) p.addIceCandidate(dd.ice).catch(function(){});
  } else if(d.tipo==='tx_saiu'&&d.vid&&_gv.pcs[d.vid]){ try{ _gv.pcs[d.vid].close(); }catch(x){} delete _gv.pcs[d.vid]; _gvBadge(); }
}
// liga junto com a aula e para no fim (ou se a aula for interrompida)
if(typeof iniciarAula==='function'){
  var _iniciarAulaSemGV=iniciarAula;
  iniciarAula=function(){ var r=_iniciarAulaSemGV.apply(this,arguments); try{ if(_bgCamModo==='rec'||_bgCamModo==='live') _gvIniciar(); }catch(e){} return r; };
}
if(typeof _fimNovoMostrar==='function'){
  var _fimNovoMostrarSemGV=_fimNovoMostrar;
  _fimNovoMostrar=function(){ var r=_fimNovoMostrarSemGV.apply(this,arguments); try{ _gvParar(); }catch(e){} return r; };
}
if(typeof stopEverything==='function'){ var _stopEverythingSemGV=stopEverything; stopEverything=function(){ try{ _gvParar(); }catch(e){} return _stopEverythingSemGV.apply(this,arguments); }; }

// ════════════════════════════════════════════════════════════════════
// 13. 02/10c — TRILHA DO CONSTRUTOR: várias músicas, cada uma no seu trecho
//     musica.trilha=[{arquivo,ini,fim,dur}] tocada em sequência, ancorada no
//     mesmo relógio da aula (doneSec). Música que falta no pendrive vira
//     silêncio no trecho dela — as seguintes continuam no tempo certo.
// ════════════════════════════════════════════════════════════════════
var _prTrilha=null;   // {itens:[{url,ini,fim,de}], cur, on}
function _prNomeChave(n){ return String(n||'').split(/[\\/]/).pop().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\.[^.]+$/,'').trim(); }
async function _prTrilhaMontar(d){
  _prTrilha=null;
  var m=d&&d.musica, tr=m&&m.fonte==='mp3'&&m.trilha;
  if(d&&d._rede&&m&&m.fonte==='mp3'&&!(tr&&tr.length)&&m.arquivo) tr=[{arquivo:m.arquivo,ini:0}];   // aula em rede: a música vem pelo nome
  if(!tr||!tr.length) return;
  var t0=tr[0]; if(!d._rede&&tr.length===1&&!t0.link&&!(t0.ini>0.5)&&!(t0.fim&&t0.dur&&t0.fim<t0.dur-0.5)) return;  // uma música inteira do pendrive: caminho antigo
  var nat=null; try{ nat=await _prBuscarPendriveNativo(); }catch(e){}
  var mapa={}; ((nat&&nat.musicas)||[]).forEach(function(x){ mapa[_prNomeChave(x.nome)]=x.url; });
  var de=0, itens=tr.map(function(t,i){
    var ini=Math.max(0,+t.ini||0), fim=+t.fim||+t.dur||(ini+36000); if(fim<=ini) fim=+t.dur||(ini+36000);
    // 02/10f: link (Dropbox, Google Drive…) primeiro; sem link ou se o link falhar, o pendrive pelo nome
    var pen=mapa[_prNomeChave(t.arquivo)]||(i===0&&typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl)||null, lk=_prLinkDireto(t.link);
    var it={url:pen||lk,pen:pen,link:t.link||'',lkd:lk,ini:ini,fim:fim,de:de,nome:t.arquivo}; de+=fim-ini; return it;
  });
  // 02/10j: pendrive primeiro; senão o arquivo já baixado (cache); senão o link pela internet
  await Promise.all(itens.map(async function(it){
    if(!it.pen&&it.link){ var c=await _prCache(it.link,true); if(c) it.url=c; }
    it.alt=(it.url!==it.lkd)?it.lkd:null; it.lk=!!it.url&&it.url===it.lkd;
    if(!it.url) console.warn('[ProRider] trilha: "'+it.nome+'" sem link e fora do pendrive — esse trecho fica sem som.');
  }));
  _prTrilha={itens:itens,cur:-2,on:false,links:itens.filter(function(x){ return x.lk; }).length};
  console.log('[ProRider] trilha da aula: '+itens.length+' música(s), '+Math.round(de)+'s'+(_prTrilha.links?' · '+_prTrilha.links+' pelo link':''));
}
function _prTrilhaSync(s,tol){
  var T=_prTrilha, a=(typeof backgroundAudio!=='undefined')?backgroundAudio:null; if(!a) return;
  var i=-1; for(var j=0;j<T.itens.length;j++){ var x=T.itens[j]; if(s>=x.de&&s<x.de+(x.fim-x.ini)){ i=j; break; } }
  var it=i>=0?T.itens[i]:null;
  if(!it||!it.url){ T.cur=i; if(!a.paused) a.pause(); return; }
  if(T.cur!==i){ T.cur=i; var abs=new URL(it.url,location.href).href; if(a.src!==abs){ a.src=it.url; try{ a.load(); }catch(e){} }
    a.onerror=function(){ if(it.alt&&it.url!==it.alt){ console.warn('[ProRider] trilha: "'+it.nome+'" não abriu — tentando pelo link.'); it.url=it.alt; T.cur=-2; }
      else console.error('[ProRider] trilha: "'+it.nome+'" não abriu (link e pendrive).'); }; }
  if(a.readyState<1) return;   // ainda abrindo o arquivo: o próximo quadro acerta
  var alvo=it.ini+(s-it.de);
  if(Math.abs(a.currentTime-alvo)>tol) a.currentTime=alvo;
  if(isPlaying&&a.paused){ var p=a.play(); if(p&&p.catch) p.catch(function(){}); }
}
var _abrirBgPickerSemTr=abrirBgPicker;
abrirBgPicker=async function(d,vc,mc){
  try{ await _prTrilhaMontar(d); }catch(e){}
  try{ var nv=await _prVideoDaAula(d,vc); if(nv) arguments[1]=nv; }catch(e){}
  var r=await _abrirBgPickerSemTr.apply(this,arguments);
  // a trilha (link ou pendrive) vale como a música da aula na tela de configurar
  if(_prTrilha&&!_bgSelMusicItem){ var n=_prTrilha.itens.length; _bgSelMusicItem={key:'music_preload',name:(n>1?n+' músicas da aula':(_prTrilha.itens[0].nome||'Música da aula'))+(_prTrilha.links?' · pela internet':' · do pendrive ou já baixadas')}; _bgMusFonte='mp3'; try{ _bgRenderAll(); }catch(e){} }
  return r;
};
// 02/10j: vídeo de fundo da aula — pendrive pelo nome; senão o arquivo já baixado; senão o link
async function _prVideoDaAula(d,vc){
  var v=d&&d.video; if(!v||v.fonte!=='local'||!v.arquivo||(vc&&vc.ok)) return null;
  if(typeof videoObjectUrl!=='undefined'&&videoObjectUrl) return null;
  var url=null, nat=null; try{ nat=await _prBuscarPendriveNativo(); }catch(e){}
  ((nat&&nat.videos)||[]).forEach(function(x){ if(!url&&_prNomeChave(x.nome)===_prNomeChave(v.arquivo)) url=x.url; });
  var dePen=!!url;
  if(!url&&v.link) url=(await _prCache(v.link,true))||_prLinkDireto(v.link);
  if(!url) return null;
  videoObjectUrl=url; videoSource='video'; window._prVideoHandle=null; try{ _preloadVideo(url); }catch(e){}
  var off=Number(v.syncOffset)||0; if(off>36000) off/=1000;
  try{ await _prAplicarSyncVideo(url,off); }catch(e){}
  console.log('[ProRider] vídeo da aula: '+v.arquivo+(dePen?' (pendrive)':/\/cache\//.test(url)?' (já baixado)':' (pela internet)'));
  return {ok:true,msg:(dePen?'':'🔗 ')+v.arquivo};
}
// 02/10j: CACHE — o servidor local baixa a música e o vídeo por link antes da aula
// (pasta ProRider\Cache, apagada depois de 2 dias). Devolve o endereço local se já baixou.
async function _prCache(link,baixar){
  var dl=_prLinkDireto(link); if(!dl) return null;
  try{ var r=await fetch(_gvBase()+'/cache/'+(baixar?'baixar':'status')+'?u='+encodeURIComponent(dl),{cache:'no-store'});
    if(!r.ok) return null; var j=await r.json(); return j.pronto?(_gvBase()+j.url):null; }catch(e){ return null; }
}
function _prCachePedir(aula){
  var m=aula&&aula.musica, ls=[]; ((m&&m.trilha)||[]).forEach(function(t){ if(t&&t.link) ls.push(t.link); });
  if(aula&&aula.video&&aula.video.link) ls.push(aula.video.link);
  ls.forEach(function(l){ _prCache(l,true); });
  if(ls.length) console.log('[ProRider] baixando '+ls.length+' arquivo(s) da aula para tocar do disco.');
}
// link de compartilhamento → endereço que toca direto (Dropbox: raw=1; Google Drive: uc?export=download)
function _prLinkDireto(u){
  u=String(u||'').trim(); if(!/^https?:\/\//i.test(u)) return null;
  try{ var x=new URL(u);
    if(/(^|\.)dropbox\.com$/i.test(x.hostname)){ x.searchParams.delete('dl'); x.searchParams.delete('raw'); x.hostname='dl.dropboxusercontent.com'; return x.href; }   // 03/10q: endereço direto do arquivo
    var g=/drive\.google\.com\/file\/d\/([^/]+)/.exec(u); if(g) return 'https://drive.google.com/uc?export=download&id='+g[1];
    return x.href; }catch(e){ return null; }
}
var _bgConfirmarSemTr=bgConfirmar;
bgConfirmar=async function(){
  // só vale se o professor manteve a música da aula (não trocou por outra do pendrive)
  if(_prTrilha) _prTrilha.on=(_bgMusFonte==='mp3'&&(!_bgSelMusicItem||_bgSelMusicItem.key==='music_preload'));
  return _bgConfirmarSemTr.apply(this,arguments);
};
var _prMidiaSyncSemTr=_prMidiaSync;
_prMidiaSync=function(doneSec,tol){
  if(!_prTrilha||!_prTrilha.on) return _prMidiaSyncSemTr(doneSec,tol);
  var k=mp3ObjectUrl; mp3ObjectUrl=null;            // o sincronismo de MP3 único fica de fora
  try{ _prMidiaSyncSemTr(doneSec,tol); }finally{ mp3ObjectUrl=k; }
  try{ _prTrilhaSync(doneSec,tol==null?1:tol); }catch(e){}
};
if(typeof _prLimparMidiaDaAula==='function'){ var _prLimparSemTr=_prLimparMidiaDaAula; _prLimparMidiaDaAula=function(){ _prTrilha=null; return _prLimparSemTr.apply(this,arguments); }; }

// ════════════════════════════════════════════════════════════════════
// 14. 02/10e — AULA AO VIVO EM REDE (desafio ao vivo entre academias)
//   Mãe = a academia que criou o desafio. Na tela do QR, a TV da mãe publica
//   a aula no servidor e, a cada segundo, onde a aula está (contagem, tocando,
//   pausa, fim e se está transmitindo).
//   As outras TVs: "Aula ao vivo em rede" no início → mesma aula, a mídia
//   delas (MP3 do próprio pendrive, pelo nome) → tela do QR esperando. Começam
//   sozinhas com o START da mãe e seguem o relógio dela. Se uma não começou,
//   o START de lá entra no ponto em que a aula está. Se a mãe transmite, o
//   vídeo e a voz do professor aparecem num quadro.
// ════════════════════════════════════════════════════════════════════
var _rd={info:null,mae:false,seg:false,id:null,timer:null,auto:false,ult:0,vws:null,pc:null,fim:false,hora:null,reinicio:0,reinicioVisto:null};
var _RD_FOLGA=5*60000;   // START da mãe: a partir de 5 min antes do horário · as outras sozinhas: 5 min depois
function _rdHora(){ var h=_rd.info&&_rd.info.data_hora; return h?new Date(h).getTime():null; }
function _rdHH(t){ var d=new Date(t); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
async function _rdBuscar(comAula){
  var tk=_campToken(); if(!tk) return null;
  try{ var r=await fetch(SERVER_HTTP+'/display/rede/agora'+(comAula?'?aula=1':''),{headers:{'Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD},cache:'no-store'});
    if(!r.ok) return null; var d=await r.json(); _rd.info=d.rede||null; return _rd.info; }catch(e){ return null; }
}
// 02/10j: assim que a aula em rede aparece (até 1 h antes), baixa a música e o vídeo por link — em qualquer tela fora da aula
setInterval(async function(){
  try{
    if(boxMode==='live'||_rd.mae||!_campToken()) return;
    var r=await _rdBuscar(false); if(!r||r.mae||!r.tem_aula) return;
    _rd.baixou=_rd.baixou||{}; if(_rd.baixou[r.desafio_id]) return;
    var c=await _rdBuscar(true); if(c&&c.aula){ _rd.baixou[r.desafio_id]=1; _prCachePedir(c.aula); }
  }catch(e){}
},60000);
function _rdDone(){ try{ return _prSecTotal(workout.slice(0,currentBlockIndex))+(pausedElapsed||0)/1000; }catch(e){ return 0; } }
function _rdContando(){ try{ return countdownOverlay.classList.contains('show'); }catch(e){ return false; } }
function _rdAviso(t){ try{ _parToast(t); }catch(e){ console.log('[ProRider] '+t); } }
// o início mostra a opção quando há aula em rede de outra academia (confere a cada 15 s)
var _mostrarEscolhaSemRD=mostrarEscolha;
mostrarEscolha=function(){
  _rd.seg=false; _rd.mae=false; _rdParar();   // voltou ao início: a próxima aula é nova
  var r=_mostrarEscolhaSemRD.apply(this,arguments);
  var antes=JSON.stringify(_rd.info&&[_rd.info.desafio_id,_rd.info.tem_aula,_rd.info.mae]);
  clearInterval(_rd.escT);
  var olhar=function(){ if(boxMode!=='escolha'){ clearInterval(_rd.escT); return; }
    _rdBuscar(false).then(function(){ var agora=JSON.stringify(_rd.info&&[_rd.info.desafio_id,_rd.info.tem_aula,_rd.info.mae]);
      if(agora!==antes&&boxMode==='escolha'){ antes=agora; escolhaIdx=(_rd.info&&!_rd.info.mae)?0:escolhaIdx; _mostrarEscolhaSemRD(); } }); };
  olhar(); _rd.escT=setInterval(olhar,15000);
  return r;
};
// ── outra academia entra na aula da mãe ──────────────────────────────
async function _rdEntrar(){
  var r=await _rdBuscar(true);
  if(!r||!r.aula){ _rdAviso('A '+((r&&r.academia_mae)||'academia que criou o desafio')+' ainda não abriu a aula — a opção fica aqui e entra assim que ela abrir.'); mostrarEscolha(); return; }
  try{ _prLimparMidiaDaAula(); }catch(e){}
  var a=r.aula;
  workout=_prNormWorkout(JSON.parse(JSON.stringify(a.workout)));
  segments=(a.segments&&a.segments.length)?a.segments:[{id:'warmup',name:'Aquecimento',type:'warmup'},{id:'main_1',name:'Principal',type:'main'},{id:'cooldown',name:'Cooldown',type:'cooldown'}];
  try{ var cn=document.getElementById('className'); if(cn) cn.value=a.nome||'Aula'; }catch(e){}
  _rd.seg=true; _rd.mae=false; _rd.id=r.desafio_id; _rd.auto=false; _rd.fim=false; _rd.reinicioVisto=r.estado?(r.estado.reinicio||0):null;
  var m=a.musica||null, temMp3=!!(m&&m.fonte==='mp3'&&(m.arquivo||(m.trilha&&m.trilha.length)));
  var nmMus=temMp3?(m.trilha&&m.trilha.length>1?m.trilha.length+' músicas da aula (do pendrive daqui)':(m.arquivo||'Música')):'--';
  await abrirBgPicker({nome:a.nome||'Aula',workout:a.workout,segments:segments,musica:m,video:a.video||{},_rede:true},{ok:false,msg:'--'},{ok:temMp3,msg:nmMus});
  _bgCamModo='off'; _bgCamOn=false; try{ _bgRenderAll(); }catch(e){}   // nas outras academias a câmera de lá é a do professor principal
}
// ── mãe e seguidoras na tela do QR ───────────────────────────────────
var _mostrarPreAulaSemRD=mostrarPreAula;
mostrarPreAula=function(d,vc,mc){
  var r=_mostrarPreAulaSemRD.apply(this,arguments);
  _rdParar();
  if(_rd.seg){
    var nm=(_rd.info&&_rd.info.academia_mae)||'academia do desafio';
    var g=document.getElementById('preAulaGoSub'); if(g) g.textContent='aula em rede: começa sozinha com o START da '+nm+(_rdHora()?' · se ela não começar até '+_rdHH(_rdHora()+_RD_FOLGA)+', o START daqui libera':'');
    var t=document.getElementById('preAulaTopo'); if(t) t.innerHTML=_pvEsc(t.textContent)+' · <span style="color:#8fe06a">📡 em rede com '+_pvEsc(nm)+'</span>';
    _rd.timer=setInterval(_rdSeguir,1000);
  } else {
    _daBuscar().then(function(dz){ if(!dz||!dz.criador||boxMode!=='preAula') return; _rd.hora=new Date(dz.data_hora).getTime()||null; _rdPublicar(d); });
  }
  return r;
};
async function _rdPublicar(d){
  var tk=_campToken(); if(!tk) return;
  var aula={nome:(d&&d.nome)||((document.getElementById('className')||{}).value)||'Aula',professor:_pvProf(),workout:workout,segments:(typeof segments!=='undefined')?segments:null,musica:(d&&d.musica)||null,video:(d&&d.video&&d.video.fonte!=='camera')?d.video:null};
  try{ var r=await fetch(SERVER_HTTP+'/display/rede/aula',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD},body:JSON.stringify({aula:aula,sala:salaCode})});
    var j=await r.json(); if(!r.ok){ console.warn('[ProRider] aula em rede: '+(j.error||r.status)); return; }
    _rd.mae=true; _rd.seg=false; _rd.id=j.desafio_id; _rd.fim=false;
    console.log('[ProRider] aula em rede publicada: as outras academias do desafio seguem o START desta TV.');
    var t=document.getElementById('preAulaTopo'); if(t) t.innerHTML=t.innerHTML+' · <span style="color:#8fe06a">📡 você dá a aula em rede</span>';
    var g=document.getElementById('preAulaGoSub'); if(g&&_rd.hora&&Date.now()<_rd.hora-_RD_FOLGA) g.textContent='aula em rede: o START libera às '+_rdHH(_rd.hora-_RD_FOLGA)+' (5 min antes do horário do desafio) e começa todas as academias';
    _rdParar(); _rd.timer=setInterval(_rdMaeEstado,1000);
  }catch(e){ console.warn('[ProRider] aula em rede: sem conexão.'); }
}
function _rdMaeEstado(){
  var tk=_campToken(); if(!tk||!_rd.mae) return;
  var vivo=boxMode==='live', fim=_rd.fim||(!vivo&&boxMode!=='preAula');
  var e={desafio_id:_rd.id,done:vivo?_rdDone():0,play:vivo&&!!isPlaying,contando:vivo&&_rdContando(),fim:fim,tx:!!(_gv&&_gv.ativo),sala:salaCode,reinicio:_rd.reinicio||0};
  fetch(SERVER_HTTP+'/display/rede/estado',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD},body:JSON.stringify(e)}).catch(function(){});
  if(fim) _rdParar();
}
function _rdParar(){ if(_rd.timer){ clearInterval(_rd.timer); _rd.timer=null; } }
// ── seguidora: começa, pausa e anda junto com a mãe ─────────────────
function _rdIrPara(D){
  var acc=0,i=0; for(;i<workout.length-1;i++){ var s=_prSec(workout[i]); if(acc+s>D) break; acc+=s; }
  if(i!==currentBlockIndex) _qbSaltarBloco(i);
  pausedElapsed=Math.max(0,D-acc)*1000; blockStartTime=performance.now()-pausedElapsed;
  try{ _prMidiaSync(D,0.15); }catch(e){}
}
var _rdSeguindo=false;
async function _rdSeguir(){
  if(!_rd.seg||_rdSeguindo) return;
  if(boxMode!=='preAula'&&boxMode!=='live'){ _rdParar(); _rdVerFechar(); return; }
  _rdSeguindo=true;
  try{
    var r=await _rdBuscar(false), e=r&&r.estado; if(!e) return;
    _rd.ult=Date.now();
    if(e.idade>15000) return;                       // mãe sem sinal: segue sozinha
    if(_rd.reinicioVisto==null) _rd.reinicioVisto=e.reinicio||0;
    if((e.reinicio||0)!==_rd.reinicioVisto){ _rd.reinicioVisto=e.reinicio||0;     // a mãe recomeçou: volta ao QR com os mesmos alunos
      if(boxMode==='live'){ _rdRecomecarLocal(); _rdAviso('A '+r.academia_mae+' recomeçou a aula: tudo zerado, aguardando o novo START'); } return; }
    if(r.tx&&!_rd.vws) _rdVerConectar(r.sala); else if(!r.tx&&_rd.vws) _rdVerFechar();
    if(boxMode==='preAula'){
      if(e.fim){ if(!_rd.avisouFim){ _rd.avisouFim=true; _rdAviso('A aula em rede da '+r.academia_mae+' já terminou — o START daqui dá a aula sozinha.'); _rd.seg=false; _rdParar(); } return; }
      if(e.contando||e.play){ _rd.auto=true; iniciarAula(); } return; }
    if(e.fim||_rdContando()) return;
    if(isPlaying&&!e.play&&!e.contando){ qbPause(); _rdAviso('Pausa na '+r.academia_mae); return; }
    if(isPlaying) _rd.tocou=true;
    if(!isPlaying&&e.play){ if(_rd.tocou) qbPause(); else return; }
    // no primeiro segundo tocando acerta fino (a contagem daqui começou até 1 s depois); depois, só se passar de 1 s
    var dif=Math.abs(e.done-_rdDone());
    if(e.play&&isPlaying&&(dif>1||(!_rd.fino&&dif>0.25))){ _rdIrPara(e.done); }
    if(e.play&&isPlaying) _rd.fino=true;
  } finally { _rdSeguindo=false; }
}
var _iniciarAulaSemRD=iniciarAula;
iniciarAula=function(){
  var nmM=(_rd.info&&_rd.info.academia_mae)||'academia do desafio';
  if(_rd.mae&&_rd.hora&&Date.now()<_rd.hora-_RD_FOLGA){ _rdAviso('Aula em rede: o START libera às '+_rdHH(_rd.hora-_RD_FOLGA)+' (5 min antes do horário do desafio)'); return; }
  if(_rd.seg&&!_rd.auto){
    var e=_rd.info&&_rd.info.estado, h=_rdHora();
    if(e&&(e.play||e.contando)&&e.idade<15000) _rd.auto=true;                 // a mãe já começou: entra no ponto em que a aula está
    else if(h&&Date.now()>h+_RD_FOLGA){ _rd.seg=false; _rdParar(); _rdAviso('A '+nmM+' não começou: esta academia segue sozinha, com a mesma aula'); }
    else { _rdAviso('Aula em rede: aguardando o START da '+nmM+(h?' · se ela não começar até '+_rdHH(h+_RD_FOLGA)+', o START daqui libera':'')); return; }
  }
  _rd.tocou=false; _rd.fino=false; _rd.avisouFim=false;
  return _iniciarAulaSemRD.apply(this,arguments);
};
// a mãe avisa o fim; a seguidora larga a rede no fim (ou se a aula for interrompida)
if(typeof _fimNovoMostrar==='function'){ var _fimNovoMostrarSemRD=_fimNovoMostrar; _fimNovoMostrar=function(){ if(_rd.mae){ _rd.fim=true; _rdMaeEstado(); } _rdVerFechar(); return _fimNovoMostrarSemRD.apply(this,arguments); }; }
if(typeof stopEverything==='function'){ var _stopEverythingSemRD=stopEverything; stopEverything=function(){ if(_rd.mae&&!_rd.fim){ _rd.fim=true; _rdMaeEstado(); } _rdParar(); _rdVerFechar(); _rd.seg=false; _rd.mae=false; return _stopEverythingSemRD.apply(this,arguments); }; }
// ── vídeo e voz do professor da mãe (WebRTC, como o "Assistir" do app) ─
function _rdVerConectar(sala){
  if(!sala) return; _rdVerFechar();
  var ws=new WebSocket(SERVER_URL); _rd.vws=ws;
  ws.onopen=function(){ ws.send(JSON.stringify({tipo:'tx_ver',codigo:sala,nome:'TV '+(_pvAcad()||'academia'),tv:true})); };   // tv: recebe a câmera limpa
  ws.onmessage=function(ev){
    var d; try{ d=JSON.parse(ev.data); }catch(x){ return; }
    if(d.tipo==='tx_erro'){ console.warn('[ProRider] aula em rede: vídeo do professor — '+d.msg); return; }
    if(d.tipo!=='tx_sinal') return;
    var dd=d.dado||{};
    if(dd.sdp&&dd.sdp.type==='offer'){
      try{ if(_rd.pc) _rd.pc.close(); }catch(x){}
      var pc=new RTCPeerConnection({iceServers:_GV_ICE}); _rd.pc=pc;
      pc.ontrack=function(t){ _rdMostrarProfessor(t.streams[0]); };
      pc.onicecandidate=function(t){ if(t.candidate&&ws.readyState===1) ws.send(JSON.stringify({tipo:'tx_sinal',dado:{ice:t.candidate}})); };
      pc.setRemoteDescription(dd.sdp).then(function(){ return pc.createAnswer(); }).then(function(a){ return pc.setLocalDescription(a); })
        .then(function(){ ws.send(JSON.stringify({tipo:'tx_sinal',dado:{sdp:pc.localDescription}})); }).catch(function(err){ console.warn('[ProRider] aula em rede: '+err); });
    } else if(dd.ice&&_rd.pc){ _rd.pc.addIceCandidate(dd.ice).catch(function(){}); }
  };
  ws.onclose=function(){ if(_rd.vws===ws) _rdVerFechar(); };   // o próximo segundo reconecta se a mãe ainda transmite
}
// 02/10j: com vídeo na aula → o rosto do professor num quadrinho no canto; sem vídeo → o professor é o fundo
function _rdMostrarProfessor(st){
  var temVideo=!!((typeof videoSource!=='undefined'&&videoSource==='video'&&videoObjectUrl)||window._prYT);
  var v;
  if(temVideo){ v=_rdQuadro(); }
  else {
    v=cameraLive; if(v.srcObject===st) return;
    try{ universeStop(); }catch(e){} bgActiveMode='camera'; _rd.fundo=true;
    v.style.transform='none'; v.style.display='block';
  }
  if(v.srcObject===st) return;
  v.srcObject=st; v.muted=false; v.play().catch(function(){ v.muted=true; v.play().catch(function(){}); });
}
function _rdQuadro(){
  var b=document.getElementById('rdCam');
  if(!b){ b=document.createElement('div'); b.id='rdCam'; b.innerHTML='<video autoplay playsinline></video><span>📡 '+_pvEsc((_rd.info&&_rd.info.academia_mae)||'Ao vivo')+'</span>'; document.body.appendChild(b); }
  return b.querySelector('video');
}
function _rdVerFechar(){
  var ws=_rd.vws; _rd.vws=null; try{ if(ws) ws.close(); }catch(e){}
  try{ if(_rd.pc) _rd.pc.close(); }catch(e){} _rd.pc=null;
  var b=document.getElementById('rdCam'); if(b) b.remove();
  if(_rd.fundo){ _rd.fundo=false; try{ cameraLive.srcObject=null; cameraLive.style.display='none'; cameraLive.style.transform=''; cameraLive.muted=true; }catch(e){} bgActiveMode='cosmos'; try{ if(boxMode==='live') universeStart(); }catch(e){} }
}

// ── RECOMEÇAR (até 5 min de aula): a mãe volta todas as academias ao QR ─
// Os alunos continuam conectados na mesma sala; os números da largada são
// zerados (TV e celular), a gravação dela é descartada e nada vai ao placar.
function _rdRecomecarLocal(){
  isPlaying=false; if(animationId){ cancelAnimationFrame(animationId); animationId=null; }
  try{ stopWPP(); }catch(e){}
  try{ _prMidiaPausar(); }catch(e){}
  try{ countdownOverlay.classList.remove('show'); }catch(e){}
  try{ if(qbAberta) fecharQB(); }catch(e){}
  try{ ctrlSetScreen(0); }catch(e){}
  ['overlayFTP','overlayRPM','overlayQR','overlayRank','overlayFC','modalEncerrar'].forEach(function(id){ var x=document.getElementById(id); if(x) x.classList.remove('active'); });
  currentBlockIndex=0; pausedElapsed=0; wppScores={}; alunoStats={};
  Object.keys(alunosMap||{}).forEach(function(n){ var a=alunosMap[n]; if(!a) return; a._kcalF=0; a.kcal=0; a._distF=0; a.dist=0; a.potMax=0; });
  try{ if(_da.timer){ clearInterval(_da.timer); _da.timer=null; } var b=document.getElementById('daBand'); if(b) b.style.display='none'; }catch(e){}
  try{ if(_gv.rec||_gv.rotT){ _gv.descartar=true; _gvParar(); } }catch(e){}
  _rdVerFechar();
  try{ if(wsProf&&wsProf.readyState===1) wsProf.send(JSON.stringify({tipo:'aula_reiniciada'})); }catch(e){}
  try{ var lc=document.getElementById('liveClass'); if(lc) lc.style.display='none'; }catch(e){}
  mostrarPreAula(window._preAulaD||{},window._preAulaVC,window._preAulaMC);
}
function _rdRecomecar(){
  _rd.reinicio=(_rd.reinicio||0)+1;
  _rdRecomecarLocal();          // a tela do QR volta a publicar; o próximo estado leva o reinício às outras
  _rdAviso('Aula recomeçada em todas as academias: tudo zerado, os alunos continuam conectados');
}
// SELECT na mãe nos primeiros 5 min: o aviso de encerrar vira "Recomeçar em todas"
var _ctrlAskConfirmSemRD=ctrlAskConfirm;
ctrlAskConfirm=function(){
  var r=_ctrlAskConfirmSemRD.apply(this,arguments), m=document.getElementById('modalEncerrar'); if(!m) return r;
  var ti=m.querySelector('.ctrl-modal-title'), su=m.querySelector('.ctrl-modal-sub'), bt=m.querySelector('.ctrl-modal-btn-confirm');
  if(!m._orig) m._orig=[ti&&ti.innerHTML,su&&su.innerHTML,bt&&bt.innerHTML];
  _rd.modoRecomecar=!!(m.classList.contains('active')&&_rd.mae&&boxMode==='live'&&_rdDone()<300);
  if(_rd.modoRecomecar){ if(ti) ti.innerHTML='Recomeçar a aula em rede?'; if(su) su.innerHTML='Nos primeiros 5 minutos: todas as academias voltam para a tela do QR,<br>os alunos continuam conectados e tudo é zerado.'; if(bt) bt.innerHTML='↺ Recomeçar <span class="ctrl-modal-kbd">→</span>'; }
  else if(m._orig){ if(ti) ti.innerHTML=m._orig[0]; if(su) su.innerHTML=m._orig[1]; if(bt) bt.innerHTML=m._orig[2]; }
  return r;
};
var _ctrlConfirmYesSemRD=ctrlConfirmYes;
ctrlConfirmYes=function(){
  if(_rd.modoRecomecar&&_rd.mae&&boxMode==='live'){ _rd.modoRecomecar=false; var m=document.getElementById('modalEncerrar'); if(m) m.classList.remove('active'); _rdRecomecar(); return; }
  return _ctrlConfirmYesSemRD.apply(this,arguments);
};
