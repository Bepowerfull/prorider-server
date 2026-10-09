// Versao visivel na tela inicial (canto inferior direito) — 24/09b.
// Trocar AQUI e na linha do BUILD no fim do arquivo a cada versao.
var PR_BUILD='BUILD 07/10d';
// ═══ 03/10f — A TV NÃO PERDE NADA SEM INTERNET + ERROS CHEGAM SOZINHOS NA SAÚDE ═══
// _prFilaPost(caminho, corpo, rotulo, extra): manda agora; se a internet ou o servidor
// falharem, guarda no computador (localStorage 'pr_fila', até 7 dias) e tenta de novo a
// cada 30 s e assim que a internet volta. Só para envios que o servidor aceita repetidos
// sem duplicar (resumo da aula, resultado do campeonato, ficha da gravação).
// prErroTv(msg, nivel): manda para a "Saúde do sistema" do admin (também guarda se offline).
var _PRF_KEY='pr_fila', _PRE_KEY='pr_err_fila', _PRF_MAXD=7*86400000, _prfRodando=false, _preVistos={}, _preHora={h:0,n:0};
function _prLs(k){ try{ var a=JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function _prLsSalvar(k,a,max){ try{ localStorage.setItem(k,JSON.stringify(a.slice(-max))); }catch(e){} }
function _prTk(){ try{ return (typeof _gymDisplayToken!=='undefined'&&_gymDisplayToken&&_gymDisplayToken!=='dev-bypass')?_gymDisplayToken:(localStorage.getItem('pr_display_token')||''); }catch(e){ return ''; } }
function prErroTv(msg,nivel,stack,onde){
  try{
    msg=String(msg||'').replace(/\s+/g,' ').trim().slice(0,400);
    if(!msg||/^Script error\.?$/i.test(msg)||/ResizeObserver loop/i.test(msg)) return;
    var ag=Date.now(), k=(nivel||'erro')+'|'+msg;
    if(_preVistos[k]&&ag-_preVistos[k]<600000) return; _preVistos[k]=ag;      // o mesmo erro no máximo a cada 10 min
    var h=Math.floor(ag/3600000); if(_preHora.h!==h) _preHora={h:h,n:0}; if(++_preHora.n>40) return;   // teto por hora
    var cod=''; if(nivel!=='aviso'){ var al='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; cod='E-'; for(var i=0;i<4;i++) cod+=al[Math.floor(Math.random()*al.length)]; _prCodigoTv(cod); }
    var a=_prLs(_PRE_KEY); a.push({codigo:cod,nivel:nivel==='aviso'?'aviso':'erro',msg:msg,stack:String(stack||'').slice(0,1500),onde:onde||'',
      tela:(document.querySelector('.screen.active,[id].ativa')||{}).id||(typeof APP_MODE!=='undefined'?APP_MODE:''),versao:PR_BUILD,quando:new Date().toISOString()});
    _prLsSalvar(_PRE_KEY,a,60);
    clearTimeout(prErroTv._t); prErroTv._t=setTimeout(_preEnviar,3000);
  }catch(e){}
}
// 03/10h: código do erro, bem pequeno no canto da TV por 10 s (o professor passa para a ProRider)
function _prCodigoTv(cod){ try{
  if(!document.body) return; var el=document.getElementById('prCodTv');
  if(!el){ el=document.createElement('div'); el.id='prCodTv'; el.style.cssText='position:fixed;left:10px;bottom:8px;z-index:2147483000;font:600 12px Arial,sans-serif;color:rgba(255,255,255,.55);background:rgba(0,0,0,.35);padding:3px 8px;border-radius:6px;pointer-events:none;letter-spacing:.5px'; document.body.appendChild(el); }
  el.textContent='⚠ '+cod; el.style.display='block'; clearTimeout(_prCodigoTv._t); _prCodigoTv._t=setTimeout(function(){ el.style.display='none'; },10000);
  try{ var h=JSON.parse(localStorage.getItem('pr_cod_hist')||'[]'); h.push({c:cod,t:Date.now()}); localStorage.setItem('pr_cod_hist',JSON.stringify(h.slice(-10))); }catch(e){}
}catch(e){} }
async function _preEnviar(){
  var a=_prLs(_PRE_KEY); if(!a.length||typeof SERVER_HTTP==='undefined') return;
  if(window._PR_OFFLINE) return;
  var lote=a.slice(0,20), h={'Content-Type':'application/json'}, tk=_prTk(); if(tk) h.Authorization='Bearer '+tk;
  try{
    var r=await fetch(SERVER_HTTP+'/suporte/erro',{method:'POST',headers:h,body:JSON.stringify({origem:'tv',versao:PR_BUILD,aparelho:navigator.userAgent,erros:lote})});
    if(r.ok||r.status===400){ var b=_prLs(_PRE_KEY); _prLsSalvar(_PRE_KEY,b.slice(lote.length),60); if(b.length>lote.length) setTimeout(_preEnviar,2000); }
  }catch(e){}
}
window.addEventListener('error',function(e){ if(!e||!e.message) return; if(/^(chrome|moz)-extension:/.test(e.filename||'')) return;
  prErroTv(e.message,'erro',e.error&&e.error.stack,String(e.filename||'').split('/').pop()+':'+(e.lineno||'')); });
window.addEventListener('unhandledrejection',function(e){ var m=e&&e.reason?(e.reason.message||String(e.reason)):'promessa rejeitada';
  if(/Failed to fetch|NetworkError|Load failed|AbortError|network/i.test(m)) return;     // queda de internet não é bug
  prErroTv(m,'erro',e.reason&&e.reason.stack,'promise'); });
async function _prfMandar(it){
  var tk=_prTk(); if(!tk||typeof SERVER_HTTP==='undefined') return {ok:false,tentar:true};
  try{
    var r=await fetch(SERVER_HTTP+it.url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk,'X-PR-Build':PR_BUILD},body:JSON.stringify(it.corpo)});
    var d=null; try{ d=await r.json(); }catch(e){}
    if(r.ok) return {ok:true,d:d};
    return {ok:false,tentar:r.status>=500||r.status===401||r.status===408||r.status===429,status:r.status,d:d};
  }catch(e){ return {ok:false,tentar:true}; }
}
function _prfDepois(it,d){   // o que fazer quando um envio guardado finalmente chega
  try{
    if(it.extra&&it.extra.tipo==='gravacao'&&d&&d.teste&&!it.extra.local&&typeof _gvEnviarTeste==='function') _gvEnviarTeste(d.id,it.extra.arquivo,it.extra.bytes||0);
  }catch(e){}
}
async function _prFilaPost(url,corpo,rotulo,extra){
  var it={id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),url:url,corpo:corpo,rotulo:rotulo||url,em:Date.now(),n:0,extra:extra||null};
  var r=await _prfMandar(it);
  if(r.ok) return r;
  if(!r.tentar){ prErroTv('O servidor recusou: '+it.rotulo+' ('+(r.status||'?')+(r.d&&r.d.error?' — '+r.d.error:'')+')','erro'); return r; }
  var a=_prLs(_PRF_KEY); a.push(it); _prLsSalvar(_PRF_KEY,a,200);
  console.warn('[ProRider] sem internet/servidor — '+it.rotulo+' guardado na TV; envio automático quando a conexão voltar.');
  try{ if(typeof _parToast==='function') _parToast('Sem internet — '+it.rotulo+': guardado na TV, vai sozinho quando a conexão voltar'); }catch(e){}
  return {ok:false,guardado:true};
}
async function _prfDrenar(){
  if(_prfRodando||window._PR_OFFLINE) return; _prfRodando=true;
  try{
    var a=_prLs(_PRF_KEY); if(!a.length) return;
    var feitos={}, ag=Date.now();
    for(var i=0;i<a.length;i++){
      var it=a[i];
      if(ag-it.em>_PRF_MAXD){ feitos[it.id]=1; prErroTv('Descartado depois de 7 dias sem conseguir enviar: '+it.rotulo,'erro'); continue; }
      var r=await _prfMandar(it);
      if(r.ok){ feitos[it.id]=1; _prfDepois(it,r.d);
        var min=Math.max(1,Math.round((Date.now()-it.em)/60000));
        console.log('[ProRider] '+it.rotulo+' enviado agora ('+min+' min depois, a internet tinha caído).');
        prErroTv('TV ficou sem internet — '+it.rotulo+': guardado na TV e enviado depois (nada perdido)','aviso');
        try{ if(typeof _parToast==='function') _parToast('Internet de volta: '+it.rotulo+' enviado ✓'); }catch(e){}
        continue; }
      if(!r.tentar){ feitos[it.id]=1; prErroTv('O servidor recusou: '+it.rotulo+' ('+(r.status||'?')+(r.d&&r.d.error?' — '+r.d.error:'')+')','erro'); continue; }
      break;   // ainda sem conexão: tenta tudo de novo na próxima rodada
    }
    _prLsSalvar(_PRF_KEY,_prLs(_PRF_KEY).filter(function(x){ return !feitos[x.id]; }),200);   // relê: pode ter entrado coisa nova enquanto enviava
  }finally{ _prfRodando=false; }
}
function prFilaPendentes(){ return _prLs(_PRF_KEY).length; }
setInterval(function(){ _prfDrenar(); _preEnviar(); },30000);
window.addEventListener('online',function(){ setTimeout(function(){ _prfDrenar(); _preEnviar(); },1500); });
setTimeout(function(){ _prfDrenar(); _preEnviar(); },8000);

'use strict';
// ============================================================
// PRORIDER script.js — reescrita limpa v4
// Gym:     3 opcoes (Carregar / Sistema / Livre)
// Builder: 4 opcoes (+ Montar Aula) — sem overlays Xbox
// ============================================================

// ── Modo detectado pela URL ─────────────────────────────────
var APP_MODE = (function(){
  try{
    // Prioridade 1: variável definida antes do script (ex: construtor.html define APP_MODE='builder')
    if(typeof window._APP_MODE_OVERRIDE !== 'undefined') return window._APP_MODE_OVERRIDE;
    // Prioridade 2: parâmetro na URL (?mode=builder ou ?mode=gym)
    var p=new URLSearchParams(window.location.search).get('mode');
    if(p==='builder'||p==='construtor') return 'builder';
    if(p==='gym'||p==='ginasio')        return 'gym';
    // Prioridade 3: nome do arquivo
    var fn=window.location.pathname.split('/').pop().toLowerCase();
    if(fn.indexOf('builder')!==-1||fn.indexOf('construtor')!==-1||fn.indexOf('studio')!==-1) return 'builder';
    return 'gym';
  }catch(e){ return 'gym'; }
})();

// ══════════════════════════════════════════════════════════════════
// DURACAO — FONTE UNICA DA VERDADE (formato v1.1)
// ------------------------------------------------------------------
// `duration` esta em MINUTOS e quase todo bloco vira dizima periodica
// (22s = 0,3666...). Somar isso acumulava erro e ja causou: total 49:26 em vez
// de 49:27, "52.81660000000002 min" na tela do DRIVE e duracao errada no PDF.
//
// A partir do v1.1 quem manda e `durationSec`: SEGUNDOS INTEIROS.
// `duration` continua sendo gravado, derivado, so para arquivos antigos e para
// codigo legado — mas nenhum calculo de tempo deve mais sair dele.
//
// REGRA: todo tempo de bloco vem de _prSec(b). Nunca de b.duration*60.
// ══════════════════════════════════════════════════════════════════
function _prSec(b){
  if(!b) return 0;
  if(b.durationSec!=null) return Math.max(0,Math.round(b.durationSec));
  return Math.max(0,Math.round((b.duration||0)*60));   // arquivo antigo (v1.0)
}
function _prSecTotal(arr){
  if(!arr||!arr.length) return 0;
  var t=0; for(var i=0;i<arr.length;i++) t+=_prSec(arr[i]);
  return t;
}
// Normaliza um workout recem-carregado: preenche durationSec e re-deriva
// duration a partir dele. Chamar em TODO ponto de entrada de aula.
// ── TREINO DO TRAININGPEAKS NO PENDRIVE (25/09) ─────────────────────
// O app do aluno ja importava o .json do TrainingPeaks; o Ginasio so aceitava
// o formato proprio ({workout:[...]}) e ignorava o arquivo em silencio. Esta e a
// mesma traducao do app: o que o TrainingPeaks nao guarda (posicao em pe /
// sentado) vira "Sentado", e cadencia ausente fica no padrao 80-90.
function _prDeTrainingPeaks(j, arquivo){
  if(!j || !Array.isArray(j.Structure)) return null;
  var tipo=String(j.Type||'').toLowerCase();
  if(tipo && tipo!=='bike' && tipo!=='mtb' && tipo!=='virtualbike'){
    console.warn('[ProRider] '+(arquivo||'arquivo')+': treino de '+(j.Type||'outro esporte')+', nao de ciclismo — ignorado.');
    return null;
  }
  var SEG={WarmUp:'warmup', CoolDown:'cooldown'};
  var zona=function(p){ if(p<=55)return'z1'; if(p<=75)return'z2'; if(p<=90)return'z3'; if(p<=105)return'z4'; if(p<=120)return'z5'; if(p<=150)return'z6'; return'z7'; };
  var wo=[], ign=0;
  function passo(p){
    var L=p.Length||{}, un=String(L.Unit||'').toLowerCase(), v=Number(L.Value)||0, seg=0;
    if(un==='second') seg=v; else if(un==='minute') seg=v*60; else if(un==='hour') seg=v*3600;
    if(!(seg>0)){ ign++; return; }
    var a=p.IntensityTarget||{}, u=String(a.Unit||'').toLowerCase(), lo=null, hi=null;
    if(u==='percentofftp'){ lo=a.MinValue; hi=a.MaxValue; }
    else if(u==='watts' && j.Ftp){ lo=a.MinValue/j.Ftp*100; hi=a.MaxValue/j.Ftp*100; }
    else if(u.indexOf('hr')<0 && u.indexOf('heart')<0){ lo=a.MinValue; hi=a.MaxValue; }
    if(lo==null && a.Value!=null){ lo=hi=a.Value; }
    if(lo!=null && hi==null) hi=lo; if(hi!=null && lo==null) lo=hi;
    var c=p.CadenceTarget;
    wo.push({
      durationSec:Math.round(seg), duration:seg/60,
      intensity:(lo!=null?zona((lo+hi)/2):'z1'),
      ftpMin:(lo!=null?Math.round(lo):0), ftpMax:(hi!=null?Math.round(hi):55),
      rpmMin:(c&&c.MinValue)?Math.round(c.MinValue):null, rpmMax:(c&&c.MaxValue)?Math.round(c.MaxValue):null,
      position:'Sentado', notes:(p.Notes?String(p.Notes).trim():''),
      segmentId:SEG[p.IntensityClass]||'main_1'
    });
  }
  j.Structure.forEach(function(it){
    if(String(it.Type).toLowerCase()==='repetition' && Array.isArray(it.Steps)){
      var n=Number(it.Length&&it.Length.Value)||1;
      for(var r=0;r<n;r++) it.Steps.forEach(passo);
    } else if(Array.isArray(it.Steps) && !it.Length){ it.Steps.forEach(passo); }
    else passo(it);
  });
  if(!wo.length){ console.warn('[ProRider] '+(arquivo||'arquivo')+': TrainingPeaks lido, mas nenhum bloco convertivel.'); return null; }
  var usados={}; wo.forEach(function(b){ usados[b.segmentId]=1; });
  var segs=[{id:'warmup',name:'Aquecimento',type:'warmup'},{id:'main_1',name:'Principal',type:'main'},{id:'cooldown',name:'Volta à Calma',type:'cooldown'}]
    .filter(function(sg){ return usados[sg.id]; });
  // aquecimento primeiro, volta a calma por ultimo (a ordem das telas segue os segmentos)
  console.log('[ProRider] '+(arquivo||'arquivo')+': treino do TrainingPeaks convertido — '+wo.length+' blocos'+(ign?(', '+ign+' passo(s) ignorado(s) por duracao que nao e tempo'):'')+'.');
  return { nome:j.Title||(arquivo||'Treino').replace(/\.json$/i,''), workout:wo, segments:segs, _origem:'TrainingPeaks' };
}

function _prNormWorkout(arr){
  if(!arr||!arr.length) return arr||[];
  var conv=0;
  for(var i=0;i<arr.length;i++){
    var b=arr[i]; if(!b) continue;
    var sec=_prSec(b);
    if(b.durationSec==null) conv++;
    b.durationSec=sec;
    b.duration=sec/60;
  }
  if(conv) console.log('[ProRider] '+conv+' bloco(s) convertidos de minutos para durationSec (arquivo v1.0).');
  return arr;
}

// ── REDE DE SEGURANÇA: garante elementos do construtor que o script.js compartilhado exige (evita "Cannot read ... addEventListener of null") ──
(function _gymEnsureEls(){
  try{
    var M={"addBlock":"button","addSegmentBtn":"button","applySegName":"button","audioPreview":"audio","backgroundAudio":"audio","backgroundVideo":"video","bgCardGrid":"div","bgPickerScreen":"div","bgPreviewLabel":"div","bgSecFundoLabel":"div","boxBuilder":"div","boxHeader":"div","boxPreAula":"div","boxUSB":"div","cameraLive":"video","cameraPreviewBuilder":"video","className":"input","classNameHeader":"span","clearWorkout":"button","closeLive":"button","countdownNumber":"div","countdownOverlay":"div","countdownZoneName":"div","ctrlDebug":"div","currentPositionText":"span","currentZoneBanner":"div","currentZoneFTP":"span","currentZoneLabel":"span","deleteSegBtn":"button","durDisplay":"div","duration":"input","editSegName":"input","endActions":"div","endBtn_inicio":"button","endBtn_ranking":"button","endBtn_repetir":"button","endClassName":"div","endContent":"div","endFullGraph":"div","endGraphLegend":"div","endHint":"div","endPointDisplay":"span","endPointFinal":"div","endPointSlider":"input","endScreen":"div","endSegStats":"div","endStats":"div","endZoneDistribution":"div","exportPDF":"button","ftpCircleText":"span","ftpGrid":"div","graphTimes":"div","idleBolt":"div","idleLogo":"div","idleScreen":"div","idleWake":"div","idleZoneBar":"div","intensity":"select","libraryList":"div","liveBadge":"div","liveBottomGradient":"div","liveClass":"div","liveSegmentLabel":"div","liveTimeline":"div","loadFileInput":"input","loadWorkout":"button","modalEncerrar":"div","mp3DurDisplay":"div","mp3DurationLabel":"span","mp3EndDisplay":"div","mp3EndPointDisplay":"span","mp3EndPointSlider":"input","mp3InputBuilder":"input","mp3PreviewBox":"div","mp3PreviewBtn":"button","mp3StartDisplay":"div","mp3SyncInfo":"div","nextBlock":"div","nextDuration":"div","nextFTP":"div","nextFTPText":"div","nextPosition":"div","nextRPM":"div","nextZone":"div","notes":"textarea","panelCamera":"div","panelVideo":"div","position":"select","preAulaAlunos":"div","preAulaConect":"div","preAulaGrafico":"div","preAulaNome":"div","preAulaQR":"div","previewSyncBtn":"button","qbFTPBtn":"button","qbFTPSub":"div","qbPauseIcon":"span","qbPauseLabel":"span","qrAlunosList":"div","qrAlunosNum":"span","qrBigDiv":"div","qrBigList":"div","qrProfPanel":"div","quickBar":"div","rankList":"div","removeMp3Btn":"button","removeVideoBuilder":"button","rpmCircle":"div","rpmGrid":"div","rpmMax":"input","rpmMin":"input","rpmText":"span","saveWorkout":"button","segTabs":"div","segmentTimelineContainer":"div","segmentTransitionOverlay":"div","spotifyConnected":"div","spotifyLoginBtn":"button","spotifyLogoutBtn":"button","spotifyNotConnected":"div","spotifyPlaylistSelect":"select","spotifySelectedInfo":"div","spotifyStatus":"span","spotifyUserName":"span","srcCameraBtn":"button","srcVideoBtn":"button","stBlockTimer":"div","stGraph":"div","stGraphTimes":"div","stSegmentName":"div","startLive":"button","startPointDisplay":"div","stopCameraBtn":"button","summaryBlocks":"span","summaryTotal":"span","syncInfo":"div","testCameraBtn":"button","timerCircle":"div","timerText":"span","toggleLibrary":"button","totalProgressFill":"div","totalProgressText":"span","transitionOverlay":"div","transitionSub":"div","transitionZone":"div","universeBg":"canvas","usbFileList":"div","usbSubtitle":"div","videoDurationLabel":"span","videoInputBuilder":"input","videoPreview":"video","videoPreviewBox":"div","workoutDurDisplay":"div","workoutSummary":"div"};
    var host=document.getElementById('__gymSafetyStubs');
    if(!host){ host=document.createElement('div'); host.id='__gymSafetyStubs'; host.style.display='none'; host.setAttribute('aria-hidden','true'); (document.body||document.documentElement).appendChild(host); }
    Object.keys(M).forEach(function(id){
      if(!document.getElementById(id)){
        var e=document.createElement(M[id]); e.id=id;
        if(M[id]==='select'){ var o=document.createElement('option'); o.value=''; e.appendChild(o); }
        host.appendChild(e);
      }
    });
  }catch(e){ try{console.error('[ProRider] rede de seguranca:',e);}catch(_){ } }
})();


// ── Cores das zonas ─────────────────────────────────────────
var ZC = {
  z1:'#a1a1a1',z2:'#295fe8',z3:'#5db13d',
  z4:'#d7c414',z5:'#ea860c',z6:'#d62d2d',z7:'#9b30ff',
  zone1:'#a1a1a1',zone2:'#295fe8',zone3:'#5db13d',
  zone4:'#d7c414',zone5:'#ea860c',zone6:'#d62d2d',zone7:'#9b30ff'
};

// Normaliza zone1→z1
function toZKey(v){
  if(!v) return 'z1';
  var m=String(v).match(/^zone(\d)$/i);
  return m?'z'+m[1]:(/^z\d$/.test(v)?v:'z1');
}

// ── Estado global ────────────────────────────────────────────
var boxMode      = 'idle';
var escolhaIdx   = 0;
var _escolhaReady = false; // requer navegação D-pad antes de confirmar
var usbList      = [];
var usbIdx       = 0;
var usbDir       = null;
var usbSubs      = {};   // sub-pastas do pendrive: {videos, musicas}
var usbAllDirs   = [];   // raiz + TODAS as subpastas do pendrive (varredura de midia)
var pendrive     = false;
var preAulaTimer = null;
var ctrlScreen   = 0;
var modalEncFoco = 1;
var qbAberta     = false;
var qbFtpAberta  = false;
var qbFtpMin     = 10;
var wppScores    = {};
// Acumuladores de estatísticas por aluno (médias, watts, calorias)
var alunoStats   = {};
// kcal ciclismo — MESMA conta do app do aluno, senao os dois numeros brigam.
// Trabalho mecanico medido: kJ = W x s / 1000; eficiencia bruta do ciclismo
// ~24% (Ettema & Loras, 2009) -> kcal = kJ / 4,184 / 0,24 ~= kJ.
// A conta antiga (0,14 x watts x horas) dava 28 kcal para 200 W em 1 h, quando
// o valor real fica perto de 717. Estava 25x abaixo no ranking e no desafio.
function calcKcal(watts, segundos){ if(!watts||!segundos) return 0; return Math.round((watts*segundos/1000)/4.184/0.24); }
var wppInterval  = null;
var demoOn       = false;
var demoWanted   = false; // INTENÇÃO do professor (liga/desliga). Só aparece demo se true.
var demoInterval = null;
var idleOn       = false;
var idleTimeout  = null;
var IDLE_MS      = 10*60*1000;
var ffDir=0, ffInt=null;

// ══════════════════════════════════════════════════════════════
// BIBLIOTECA UNIFICADA DE AULAS — mesma base do app do aluno
// ══════════════════════════════════════════════════════════════
var PR_AULAS = [
  // ── ENDURANCE BUILDER ────────────────────────────────────────
  {nome:"Endurance Builder #1",icon:"🚴",dur:45,badge:"Easy",badgeColor:"#295fe8",
   desc:"Zona 2 aeróbica — base de condicionamento. Blocos longos em intensidade moderada com breve subida à Z3. Desenvolve eficiência cardiovascular e capacidade de usar gordura como combustível.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:5,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:10,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"75-80",dur:3,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:10,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:8,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:6,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:3,pos:"Seated"}]},
  {nome:"Endurance Builder #2",icon:"🚴",dur:50,badge:"Easy",badgeColor:"#295fe8",
   desc:"Sweetspot — zona entre Tempo e Limiar, a mais eficiente para ganhos aeróbicos. Blocos longos em Z3/Z4, exigindo esforço real com menor acúmulo de lactato.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"70-80",dur:4,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:1,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:10,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:5,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"70-78",dur:5,pos:"Standing"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:5,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"60-80",dur:5,pos:"Seated"}]},
  {nome:"Endurance Builder #3",icon:"🚴",dur:50,badge:"Easy",badgeColor:"#295fe8",
   desc:"Simula subida aeróbica longa — alterna sentado em cadência alta com em pé em cadência mais baixa. Recruta grupos musculares diferentes e desenvolve força para subidas.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"70-80",dur:4,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:1,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"82-88",dur:8,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"70-78",dur:5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"82-88",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"88-92",dur:8,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"70-78",dur:5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:4,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"60-80",dur:5,pos:"Seated"}]},
  {nome:"Endurance Builder #4",icon:"🚴",dur:55,badge:"Easy",badgeColor:"#295fe8",
   desc:"Força e cadência: alterna blocos de baixa rotação (55-62 rpm, força muscular) com blocos de alta rotação (95-105 rpm, eficiência neuromuscular) na Z2-Z3. Treina as duas qualidades do pedal eficiente.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:5,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"55-62",dur:8,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"82-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"95-105",dur:8,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"82-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"55-62",dur:8,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"82-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"95-100",dur:7,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  // ── HIIT THRESHOLD ───────────────────────────────────────────
  {nome:"HIIT Threshold #1",icon:"🔥",dur:50,badge:"Medium",badgeColor:"#d7c414",
   desc:"Threshold clássico: 3 blocos de 10 min no Limiar (Z4) com recuperação ativa Z2. O protocolo mais validado pela ciência do ciclismo para elevar o FTP ao longo do tempo.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:5,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:10,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:4,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:10,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:4,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:9,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  {nome:"HIIT Threshold #2",icon:"🔥",dur:50,badge:"Medium",badgeColor:"#d7c414",
   desc:"Alta intensidade progressiva: Z4 → Z5 → Z6. Intervalos sobem em intensidade ao longo da aula, forçando o organismo a trabalhar cada vez mais próximo e acima do limiar de lactato.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:5,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"88-93",dur:5,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"88-93",dur:5,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:5,pos:"Standing"},{z:"z6",ftp:"121-150",rpm:"92-98",dur:5,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  {nome:"HIIT Threshold #3",icon:"🔥",dur:50,badge:"Medium",badgeColor:"#d7c414",
   desc:"Over-Under — alterna Z3 (abaixo do limiar) e Z4 (no limiar/acima) em dois blocos principais. Ensina o corpo a tolerar e limpar o lactato, aumentando a potência sustentável.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"70-80",dur:3,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:1,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:1,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"87-92",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"87-92",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"87-92",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"87-92",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:2,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"60-80",dur:5,pos:"Seated"}]},
  {nome:"HIIT Threshold #4",icon:"🔥",dur:50,badge:"Medium",badgeColor:"#d7c414",
   desc:"Pirâmide de intervalos no Limiar: 4 → 6 → 8 → 6 min na Z4, com recuperação entre blocos. Progressão crescente e decrescente impede ritmo pré-calculado.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"70-80",dur:3,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:1,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:1,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:4,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"82-88",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:6,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:8,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"85-90",dur:6,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:2,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"60-80",dur:5,pos:"Seated"}]},
  // ── VO2 MAX INTERVALS ────────────────────────────────────────
  {nome:"VO2 Max Intervals #1",icon:"💪",dur:40,badge:"Hard",badgeColor:"#d62d2d",
   desc:"Intervalos repetidos na Z6 intercalados com recuperação ativa na Z2. Treina o sistema anaeróbico e aumenta o VO2 Máximo — o teto de potência aeróbica.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:5,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3,pos:"Seated"},{z:"z6",ftp:"121-150",rpm:"92-98",dur:4,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3,pos:"Seated"},{z:"z6",ftp:"121-150",rpm:"92-98",dur:4,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3,pos:"Seated"},{z:"z6",ftp:"121-150",rpm:"92-98",dur:4,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  {nome:"VO2 Max Intervals #2",icon:"💪",dur:50,badge:"Hard",badgeColor:"#d62d2d",
   desc:"8 repetições de VO2 Máximo na Z5, combinando esforços sentados e em pé. Alternar posição distribui o esforço e permite acumular mais volume de alta intensidade.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"70-80",dur:2,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:2,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"68-74",dur:4,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:3,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"60-80",dur:5,pos:"Seated"}]},
  {nome:"VO2 Max Intervals #3",icon:"💪",dur:50,badge:"Hard",badgeColor:"#d62d2d",
   desc:"Pirâmide de VO2 com ativador de 30s em pé antes de cada intervalo longo. Intervalos progressivamente mais longos impedem adaptação ao ritmo.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"70-80",dur:2,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:2,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:3,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:2.5,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"85-90",dur:0.5,pos:"Standing"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:3.5,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"85-90",dur:0.5,pos:"Standing"},{z:"z5",ftp:"106-120",rpm:"68-74",dur:5,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4.5,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"85-90",dur:0.5,pos:"Standing"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:2.5,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"85-90",dur:0.5,pos:"Standing"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"60-80",dur:5,pos:"Seated"}]},
  {nome:"VO2 Max Intervals #4",icon:"💪",dur:45,badge:"Hard",badgeColor:"#d62d2d",
   desc:"Escada ascendente de VO2 Máx: intervalos em Z5 que crescem de 2 para 5 min. Dificulta o ritmo pré-calculado e força adaptação contínua ao esforço máximo aeróbico.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:3,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:1,pos:"Standing"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:2,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:3,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"88-94",dur:5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:2,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:4,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-85",dur:3,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:7,pos:"Seated"}]},
  // ── SPRINT NEUROMUSCULAR ─────────────────────────────────────
  {nome:"Sprint Neuromuscular #1",icon:"⚡",dur:35,badge:"Advanced",badgeColor:"#9b30ff",
   desc:"4 sprints explosivos na Z7 com recuperação completa. Foco em recrutamento de fibras musculares rápidas e capacidade de produzir força instantânea.",
   blocos:[{z:"z2",ftp:"56-75",rpm:"80-85",dur:5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:1,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:1,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:1,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:1,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  {nome:"Sprint Neuromuscular #2",icon:"⚡",dur:50,badge:"Advanced",badgeColor:"#9b30ff",
   desc:"4 sprints de 30s + acelerações anaeróbicas em pé. Treina tanto a potência neuromuscular quanto a capacidade de repetir esforços máximos.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"70-78",dur:2,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:2,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Standing"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:1,pos:"Standing"},{z:"z6",ftp:"121-150",rpm:"85-95",dur:1,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"82-88",dur:4,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:5.5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:5.5,pos:"Seated"},{z:"z6",ftp:"121-150",rpm:"68-74",dur:0.5,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:4,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:3,pos:"Seated"},{z:"z6",ftp:"121-150",rpm:"85-95",dur:0.5,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:5,pos:"Seated"}]},
  {nome:"Sprint Neuromuscular #3",icon:"⚡",dur:40,badge:"Advanced",badgeColor:"#9b30ff",
   desc:"Sprints precedidos de rampa progressiva Z4→Z5→Z7. O pré-ativador muscular maximiza a potência atingida em cada sprint e treina a aceleração explosiva.",
   blocos:[{z:"z2",ftp:"56-75",rpm:"80-85",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:1,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:0.5,pos:"Standing"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3.5,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:1,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:0.5,pos:"Standing"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3.5,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:1,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:0.5,pos:"Standing"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3.5,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:1,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-95",dur:0.5,pos:"Standing"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"78-83",dur:3.5,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  {nome:"Sprint Neuromuscular #4",icon:"⚡",dur:45,badge:"Advanced",badgeColor:"#9b30ff",
   desc:"6 sprints absolutos de 30s com recuperação completa de 4,5 min. Treina exclusivamente a potência máxima de pico — desenvolvendo as fibras de contração rápida ao limite.",
   blocos:[{z:"z2",ftp:"56-75",rpm:"80-85",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-92",dur:2,pos:"Standing"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"76-82",dur:4.5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"76-82",dur:4.5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"76-82",dur:4.5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"76-82",dur:4.5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"76-82",dur:4.5,pos:"Seated"},{z:"z7",ftp:"Max",rpm:"100-120",dur:0.5,pos:"Standing"},{z:"z2",ftp:"56-75",rpm:"76-82",dur:4.5,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  // ── FTP TEST ─────────────────────────────────────────────────
  {nome:"FTP Test 3 min",icon:"🏁",dur:20,badge:"Teste",badgeColor:"#ea860c",
   desc:"Esforço máximo de 3 min após aquecimento curto. 85% da potência média = FTP estimado. Ideal para iniciantes conhecerem o conceito de teste sem grande desgaste.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:3,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"88-93",dur:1,pos:"Standing"},{z:"z5",ftp:"Max 3min",rpm:"92-100",dur:3,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:8,pos:"Seated"}]},
  {nome:"FTP Test 5 min",icon:"🏁",dur:25,badge:"Teste",badgeColor:"#ea860c",
   desc:"Esforço máximo de 5 min após aquecimento progressivo. 87% da potência média = FTP estimado. Bom equilíbrio entre duração e precisão para atletas em início de treino com potência.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:4,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"88-93",dur:1,pos:"Standing"},{z:"z5",ftp:"Max 5min",rpm:"92-100",dur:5,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:10,pos:"Seated"}]},
  {nome:"FTP Test 10 min",icon:"🏁",dur:30,badge:"Teste",badgeColor:"#ea860c",
   desc:"Esforço máximo de 10 min após aquecimento progressivo. 90% da potência média = FTP estimado. Protocolo intermediário — mais preciso que 5 min e menos desgastante que 20 min.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:4,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-88",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-92",dur:2,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"88-93",dur:1,pos:"Standing"},{z:"z5",ftp:"Max 10min",rpm:"92-100",dur:10,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:10,pos:"Seated"}]},
  {nome:"FTP Test 20 min",icon:"🏁",dur:45,badge:"Teste",badgeColor:"#ea860c",
   desc:"Após aquecimento progressivo, 20min de esforço máximo sustentável. 95% da média de potência desse bloco é o seu FTP. Zonas recalibradas automaticamente.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"80-85",dur:5,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"85-90",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"88-93",dur:3,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"90-95",dur:3,pos:"Standing"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:3,pos:"Seated"},{z:"z5",ftp:"Max 20min",rpm:"92-100",dur:20,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:8,pos:"Seated"}]},
  {nome:"FTP Ramp Test",icon:"🏁",dur:30,badge:"Teste",badgeColor:"#ea860c",
   desc:"Rampa progressiva: intensidade sobe ~5% FTP a cada minuto até a falha muscular. 75% da potência média do último minuto completo = FTP estimado. Mais curto e menos desgastante que o teste de 20 min.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"75-80",dur:3,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"80-86",dur:5,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"85-90",dur:5,pos:"Seated"},{z:"z4",ftp:"91-105",rpm:"87-93",dur:4,pos:"Seated"},{z:"z5",ftp:"106-120",rpm:"90-96",dur:3,pos:"Seated"},{z:"z6",ftp:"121-150",rpm:"92-98",dur:3,pos:"Standing"},{z:"z7",ftp:"Max",rpm:"95-120",dur:2,pos:"Standing"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:5,pos:"Seated"}]},
  {nome:"FTP Test 2x8 min",icon:"🏁",dur:40,badge:"Teste",badgeColor:"#ea860c",
   desc:"2 esforços máximos de 8 min com 10 min de recuperação entre eles. A média das duas médias de potência × 90% estima o FTP com menor risco de falha por excesso de motivação inicial.",
   blocos:[{z:"z1",ftp:"0-55",rpm:"80-85",dur:5,pos:"Seated"},{z:"z2",ftp:"56-75",rpm:"85-90",dur:3,pos:"Seated"},{z:"z3",ftp:"76-90",rpm:"88-93",dur:2,pos:"Seated"},{z:"z5",ftp:"Max 8min",rpm:"92-100",dur:8,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-78",dur:10,pos:"Seated"},{z:"z5",ftp:"Max 8min",rpm:"92-100",dur:8,pos:"Seated"},{z:"z1",ftp:"0-55",rpm:"70-75",dur:4,pos:"Seated"}]},
];

// ── Converter PR_AULAS → formato interno do mini PC ──────────
var SISTEMA = (function(){
  var zCores={z1:'#a1a1a1',z2:'#295fe8',z3:'#5db13d',z4:'#d7c414',z5:'#ea860c',z6:'#d62d2d',z7:'#9b30ff'};
  function parseRange(s,defaultLo,defaultHi){
    if(!s||s==='Max') return {lo:150,hi:200};
    var p=String(s).replace('Max ','').split('-');
    return {lo:parseInt(p[0])||defaultLo, hi:parseInt(p[1])||defaultHi};
  }
  return PR_AULAS.map(function(a){
    var bl=a.blocos;
    // Detectar primeiro bloco ≥ z4 para separar aquecimento
    var firstMain=-1;
    for(var j=0;j<bl.length;j++){if(parseInt(bl[j].z[1])>=4){firstMain=j;break;}}
    var workout=bl.map(function(b,i){
      var rpm=parseRange(b.rpm,75,85);
      var ftp=parseRange(b.ftp,40,135);
      var segId;
      if(i===bl.length-1&&b.z==='z1') segId='cooldown';
      else if(firstMain>=0&&i<firstMain) segId='warmup';
      else segId='main_1';
      return {
        duration:b.dur,
        rpmMin:rpm.lo,rpmMax:rpm.hi,
        intensity:b.z,
        ftpMin:ftp.lo,ftpMax:ftp.hi,
        position:b.pos==='Standing'?'Em Pe':'Sentado',
        notes:'',segmentId:segId,
        _color:zCores[b.z]||'#888'
      };
    });
    return {
      nome:a.nome,icon:a.icon||'🚴',dur:a.dur,badge:a.badge,badgeColor:a.badgeColor,desc:a.desc,img:a.img||null,
      workout:workout,
      segments:[
        {id:'warmup',name:'Aquecimento',type:'warmup'},
        {id:'main_1',name:'Principal',type:'main'},
        {id:'cooldown',name:'Cooldown',type:'cooldown'}
      ]
    };
  });
})();

// ============================================================
// IDLE
// ============================================================
function resetIdleTimer(){
  if(idleOn) return;
  clearTimeout(idleTimeout);
  idleTimeout=setTimeout(function(){
    if(!_podeIdle()){resetIdleTimer();return;}
    ativarIdle();
  },IDLE_MS);
}
// 03/10n: so volta para a tela de espera quando NAO tem aula acontecendo:
// nunca com a aula rodando, pausada no meio, na contagem 3-2-1, gravando,
// na sessao livre, nem na tela do QR (o professor deixa a aula preparada
// 20-30 min antes e sai; os alunos vao chegando e entrando). Fim de aula pode.
function _podeIdle(){
  try{
    if(typeof isPlaying!=='undefined'&&isPlaying) return false;
    if(['countdown','live','preAula','livre','sessao'].indexOf(boxMode)>=0) return false;
    if(typeof workout!=='undefined'&&workout&&workout.length&&typeof currentBlockIndex!=='undefined'&&currentBlockIndex>0&&boxMode!=='end'&&boxMode!=='endRanking') return false;
    if(typeof _gv!=='undefined'&&_gv&&((_gv.rec&&_gv.rec.state==='recording')||(_gv.recYt&&_gv.recYt.state==='recording'))) return false;   // gravando/transmitindo
  }catch(e){}
  return true;
}
function ativarIdle(){
  idleOn=true;
  // Garante que nenhuma tela de seleção/setup fique por baixo do idle
  if(typeof _fecharTodasTelas==='function') _fecharTodasTelas();
  resetSessao();
  var el=document.getElementById('idleScreen'); if(!el) return;
  el.classList.add('active');
  // Ao entrar no idle, atualizar a grade (se ativado)
  if(_gymDisplayToken) _gymGradeAtualizar();
  // Mostrar nome da academia salvo
  var nomeAcad = localStorage.getItem('pr_display_academia')||'';
  var wakeEl = document.getElementById('idleWake');
  if(wakeEl && nomeAcad) wakeEl.innerHTML = nomeAcad + '<br><span style="font-size:13px;opacity:.5">Pressione <kbd>START</kbd> ou <kbd>A</kbd> para continuar</span>';
  // Mostrar/ocultar painel de grade conforme ativação
  var gp = document.getElementById('idleGrade');
  if(gp) gp.style.display = 'none';   // 03/10n: painel antigo da direita nunca mais (sem internet ficava "carregando" por cima do relógio); as aulas de hoje passam embaixo
  // Reset animações
  ['idleBolt','idleLogo','idleWake'].forEach(function(id){
    var e=document.getElementById(id);
    if(e){e.style.animation='none';void e.offsetHeight;e.style.animation='';e.classList.remove('show');}
  });
  var bar=document.getElementById('idleZoneBar');
  if(bar){bar.classList.remove('animate');void bar.offsetWidth;}
  // Sequência de aparição
  setTimeout(function(){var e=document.getElementById('idleBolt'); if(e)e.classList.add('show');},200);
  setTimeout(function(){var e=document.getElementById('idleLogo'); if(e)e.classList.add('show');},600);
  setTimeout(function(){if(bar)bar.classList.add('animate');},400);
  setTimeout(function(){var e=document.getElementById('idleWake');if(e)e.classList.add('show');},2800);
}
function sairIdle(){
  if(!idleOn) return;
  if(boxMode==='countdown') return; // countdown automático em andamento, não sair
  idleOn=false;
  var el=document.getElementById('idleScreen');if(el)el.classList.remove('active');
  mostrarEscolha();
  resetIdleTimer();
}

// ============================================================
// GRADE DO DIA + COUNTDOWN AUTOMÁTICO
// ============================================================
var _gymDisplayToken = (new URLSearchParams(window.location.search).get('dev')==='1')
  ? 'dev-bypass'
  : (localStorage.getItem('pr_display_token') || null);
var _gymGradeData    = null;
var _gymCountdownSec = 0;
var _gymCountdownInt = null;
var _gymProxAula     = null;
var _gymSessao       = null;
var _gymPollInt      = null;

// ── Ativação do mini PC (primeira vez) ──
function verificarAtivacao(){
  if(!_gymDisplayToken){
    mostrarTelaAtivacao(false);
    setTimeout(function(){
      var inp=document.getElementById('ativacaoInput');if(inp)inp.focus();
    },300);
    return false;
  }
  return true;
}

// ── BIKES DA LICENCA (24/09) ─────────────────────────────────────
// A licenca e vendida por quantidade de bikes e e ela que manda: a grade da
// sala (e o que o app mostra para escolher bike) nunca passa desse numero.
// O servidor informa o teto na ativacao, na renovacao e em /display/licenca.
function _gymAplicarTeto(n){
  n=parseInt(n,10)||0; if(n<=0) return;
  window.licencaMaxBikes=n;
  try{ localStorage.setItem('pr_lic_teto', String(n)); }catch(e){}
  try{
    if(typeof parNumBikes!=='undefined' && parNumBikes>n){
      console.log('[ProRider] licenca com '+n+' bikes — grade reduzida de '+parNumBikes+' para '+n+'.');
      parNumBikes=n;
      if(typeof _parSalvar==='function') _parSalvar();
      if(typeof _parBuildGrid==='function') _parBuildGrid();
      if(typeof _wsEnviarSalaInfo==='function') _wsEnviarSalaInfo();
    }
  }catch(e){}
}
async function _gymBuscarTeto(){
  if(!_gymDisplayToken || _gymDisplayToken==='dev-bypass') return;
  try{
    var r=await fetch(SERVER_HTTP+'/display/licenca',{headers:{'Authorization':'Bearer '+_gymDisplayToken,'X-PR-Build':PR_BUILD}});
    if(!r.ok) return;           // 404 = servidor ainda sem a rota: segue como esta
    var d=await r.json();
    if(d && d.teto) _gymAplicarTeto(d.teto);
    if(d && d.ranking_cfg) _rkAplicarCfg(d.ranking_cfg);  // 26/09e
    if(d && d.numeros){ window._gymNumeros=d.numeros; try{ if(idleOn && window._gymGradeHoje) _gymGradeRender(window._gymGradeHoje); }catch(e){} }  // 29/09a
  }catch(e){}
}
try{ var _tSalvo=parseInt(localStorage.getItem('pr_lic_teto'),10); if(_tSalvo>0) window.licencaMaxBikes=_tSalvo; }catch(e){}
setTimeout(_gymBuscarTeto, 6000);
setInterval(_gymBuscarTeto, 15*60*1000);  // 26/09e: 15 min (tambem traz o ranking do Portal e avisa a versao)

async function ativarMiniPC(){
  var inp = document.getElementById('ativacaoInput');
  var err = document.getElementById('ativacaoErro');
  var codigo = (inp?inp.value:'').trim();
  if(!codigo){ if(err){err.style.display='block';err.textContent='Digite o código da TV (Admin → Licenças).';} return; }
  if(err) err.style.display='none';
  if(codigo.toUpperCase()==='DEV'){
    _gymDisplayToken='dev-bypass';
    window.licencaMaxBikes=40;
    var box=document.getElementById('boxAtivacao');if(box)box.style.display='none';
    _gpBlockUntil=Date.now()+1500;
    ativarIdle();
    return;
  }
  try{
    var r = await fetch(SERVER_HTTP+'/display/ativar', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      // device_id: identidade DESTE computador. A licenca vendida roda em um
      // so — ativando noutro, o servidor desliga o anterior.
      body: JSON.stringify({codigo, device_id:_gymDeviceId(), nome_computador:_gymNomeComputador(), build:PR_BUILD})
    });
    var d = await r.json();
    if(!r.ok){ if(err){err.style.display='block';err.textContent=d.error||'Código inválido.';} return; }
    _gymDisplayToken = d.token;
    localStorage.setItem('pr_display_token', d.token);
    localStorage.setItem('pr_display_academia', d.nome_academia||'');
    if(d.teto) _gymAplicarTeto(d.teto);
    if(d.ranking_cfg) _rkAplicarCfg(d.ranking_cfg);  // 26/09e
    // Fechar tela de ativação e entrar no idle
    var box=document.getElementById('boxAtivacao');if(box)box.style.display='none';
    _gymGradeAtualizar();
  }catch(e){
    if(err){err.style.display='block';err.textContent='Erro de conexão. Verifique a internet.';}
  }
}

// Troca / reset de licença — acessível via 5 cliques no logo ou botão cancelar
var _idleLogoClicks=0, _idleLogoTimer=null;
function idleLogoClick(){
  _idleLogoClicks++;
  if(_idleLogoTimer) clearTimeout(_idleLogoTimer);
  _idleLogoTimer=setTimeout(function(){ _idleLogoClicks=0; },2000);
  if(_idleLogoClicks>=5){ _idleLogoClicks=0; mostrarTelaAtivacao(true); }
}
function mostrarTelaAtivacao(podeVoltar){
  var box=document.getElementById('boxAtivacao');
  var inp=document.getElementById('ativacaoInput');
  var wrap=document.getElementById('ativacaoTrocarWrap');
  if(inp) inp.value='';
  if(wrap) wrap.style.display=podeVoltar?'block':'none';
  if(box) box.style.display='flex';
}
function trocarLicenca(){
  // Fecha tela de ativação sem limpar o token (apenas cancela)
  var box=document.getElementById('boxAtivacao');
  if(box) box.style.display='none';
}

// ═══ AULAS DO DIA NA TELA DE ESPERA (29/09a) ═══════════════════════
// Pedido do Mario: o painel lateral era pequeno demais para a TV. Agora a
// tela de espera mostra as aulas do dia em cartões grandes (horário, tipo,
// professor, duração, reservas), com a aula de agora/próxima em destaque e
// contagem regressiva; no rodapé, as aulas já feitas e os números do clube.
// Sem aula hoje, volta a tela do logo de sempre. 5 toques no nome PRORIDER
// (no canto) continuam abrindo a reativação da licença.
function _gymEsc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _gymIni(n){ return String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w.charAt(0);}).join('').toUpperCase()||'?'; }
function _gymFmtN(n){ n=Number(n)||0; if(n>=1e6) return (n/1e6).toFixed(1).replace('.',',')+' mi'; if(n>=1e5) return Math.round(n/1e3).toLocaleString('pt-BR')+' mil'; return Math.round(n).toLocaleString('pt-BR'); }
function _gymIdleAulasEl(){
  var el=document.getElementById('idleAulas');
  if(!el){
    var sc=document.getElementById('idleScreen'); if(!sc) return null;
    el=document.createElement('div'); el.id='idleAulas';
    sc.appendChild(el);
    if(!document.getElementById('idleAulasCss')){
      var st=document.createElement('style'); st.id='idleAulasCss';
      st.textContent=''
        +'#idleAulas{position:absolute;inset:0;z-index:50;display:none;flex-direction:column;padding:60px 70px 44px;background:radial-gradient(ellipse at 20% 0%,rgba(234,134,12,.16),transparent 55%),#07070a;font-family:Barlow,sans-serif;color:#fff}'
        +'#idleAulas .ia-h{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:38px}'
        +'#idleAulas .ia-brand{font-family:"Bebas Neue",sans-serif;font-size:70px;letter-spacing:5px;line-height:.95;background:linear-gradient(135deg,#ffe033,#ea860c,#d62d2d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;cursor:default}'
        +'#idleAulas .ia-sub{font-family:"Barlow Condensed",sans-serif;font-size:32px;color:rgba(255,255,255,.62);font-weight:600;margin-top:2px}'
        +'#idleAulas .ia-hr{font-family:"Bebas Neue",sans-serif;font-size:118px;line-height:.85;text-align:right}'
        +'#idleAulas .ia-cards{display:grid;gap:28px;flex:1;min-height:0}'
        +'#idleAulas .ia-c{background:#1b1b21;border:1px solid rgba(255,255,255,.08);border-radius:26px;padding:34px;display:flex;flex-direction:column;position:relative;overflow:hidden;min-width:0}'
        +'#idleAulas .ia-c.dest{background:linear-gradient(140deg,rgba(234,134,12,.28),rgba(214,45,45,.16) 60%,#1b1b21);border:2px solid rgba(234,134,12,.75);box-shadow:0 0 60px rgba(234,134,12,.25)}'
        +'#idleAulas .ia-c.vivo{background:linear-gradient(140deg,rgba(93,177,61,.30),rgba(93,177,61,.10) 60%,#1b1b21);border:2px solid rgba(93,177,61,.85);box-shadow:0 0 60px rgba(93,177,61,.25)}'
        +'#idleAulas .ia-t{font-family:"Bebas Neue",sans-serif;font-size:124px;line-height:.9}'
        +'#idleAulas .ia-c.pq .ia-t{font-size:98px}'
        +'#idleAulas .ia-n{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:60px;text-transform:uppercase;line-height:1;margin-top:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        +'#idleAulas .ia-c.pq .ia-n{font-size:46px}'
        +'#idleAulas .ia-m{display:flex;gap:28px;margin-top:22px;font-size:28px;color:rgba(255,255,255,.66);font-weight:600;flex-wrap:wrap}'
        +'#idleAulas .ia-c.pq .ia-m{font-size:23px;gap:20px}'
        +'#idleAulas .ia-bar{height:14px;border-radius:7px;background:rgba(255,255,255,.08);margin-top:24px;overflow:hidden}'
        +'#idleAulas .ia-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffe033,#ea860c,#d62d2d);border-radius:7px}'
        +'#idleAulas .ia-p{display:flex;align-items:center;gap:18px;margin-top:auto;padding-top:24px;border-top:1px solid rgba(255,255,255,.08)}'
        +'#idleAulas .ia-av{width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#ffe033,#ea860c,#d62d2d);display:flex;align-items:center;justify-content:center;font-weight:800;color:#1b1b21;font-size:28px;flex-shrink:0}'
        +'#idleAulas .ia-c.pq .ia-av{width:60px;height:60px;font-size:22px}'
        +'#idleAulas .ia-p b{display:block;font-size:34px}#idleAulas .ia-c.pq .ia-p b{font-size:27px}'
        +'#idleAulas .ia-p small{font-size:21px;color:rgba(255,255,255,.55)}'
        +'#idleAulas .ia-tag{position:absolute;top:30px;right:30px;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:28px;letter-spacing:1px;padding:8px 18px;border-radius:12px;background:#ea860c;color:#1b1b21}'
        +'#idleAulas .ia-c.vivo .ia-tag{background:#5db13d;color:#08130a}'
        +'#idleAulas .ia-dica{margin-left:auto;text-align:right;font-family:"Barlow Condensed",sans-serif;font-size:23px;color:rgba(255,255,255,.62);line-height:1.3}'
        +'#idleAulas .ia-s{display:flex;gap:18px;margin-top:26px}'
        +'#idleAulas .ia-s>div{flex:1;background:#1b1b21;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px 22px;display:flex;align-items:center;gap:18px;min-width:0}'
        +'#idleAulas .ia-s b{font-family:"Bebas Neue",sans-serif;font-size:48px;color:rgba(255,255,255,.55);white-space:nowrap}'
        +'#idleAulas .ia-s span{font-size:23px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#idleAulas .ia-s small{display:block;color:rgba(255,255,255,.55);font-size:18px}'
        +'#idleAulas .ia-f{text-align:center;margin-top:18px;font-size:18px;color:rgba(255,255,255,.35);letter-spacing:1px}';
      document.head.appendChild(st);
    }
  }
  return el;
}
function _gymGradeRender(grade){
  var side=document.getElementById('idleGrade'); if(side) side.style.display='none';   // painel antigo
  var el=_gymIdleAulasEl(); if(!el) return;
  window._gymGradeHoje = grade||[];
  if(!grade||!grade.length){ el.style.display='none'; return; }
  var d=new Date(), agoraMin=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
  var lista=grade.map(function(a){
    var h=String(a.hora||'00:00').split(':'), ini=parseInt(h[0],10)*60+parseInt(h[1]||0,10), dur=parseInt(a.duracao_min,10)||50;
    return {a:a, ini:ini, fim:ini+dur, hhmm:(h[0]||'00')+':'+(h[1]||'00'), dur:dur};
  }).sort(function(x,y){ return x.ini-y.ini; });
  var futuras=lista.filter(function(x){ return x.fim>agoraMin; }), passadas=lista.filter(function(x){ return x.fim<=agoraMin; });
  var mostrar=futuras.slice(0,3), encerradas=!futuras.length;
  if(encerradas) mostrar=lista.slice(-3);
  var nomeAcad=''; try{ nomeAcad=localStorage.getItem('pr_display_academia')||''; }catch(e){}
  var dia=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}); dia=dia.charAt(0).toUpperCase()+dia.slice(1);
  var cols = mostrar.length===1 ? '1fr' : mostrar.length===2 ? '1.3fr 1fr' : '1.35fr 1fr 1fr';
  function card(x,i){
    var a=x.a, vivo=!encerradas && agoraMin>=x.ini && agoraMin<x.fim, dest=!encerradas && i===0;
    var vagas=parseInt(a.vagas_max,10)||0, res=parseInt(a.reservas_hoje!=null?a.reservas_hoje:a.reservas,10)||0;
    var pct=vagas?Math.min(100,Math.round(res/vagas*100)):0;
    var tag='';
    if(vivo) tag='<span class="ia-tag">AO VIVO AGORA</span>';
    else if(dest){ var falta=Math.round(x.ini-agoraMin); tag='<span class="ia-tag">'+(falta<=90?'PRÓXIMA · COMEÇA EM '+Math.max(1,falta)+' MIN':'PRÓXIMA AULA')+'</span>'; }
    else if(encerradas) tag='<span class="ia-tag" style="background:rgba(255,255,255,.12);color:#fff">CONCLUÍDA</span>';
    var prof=a.professor_nome||'';
    return '<div class="ia-c'+(vivo?' vivo':dest?' dest':'')+(i>0?' pq':'')+'"'+(a.cor&&!dest&&!vivo?' style="border-top:4px solid '+_gymEsc(a.cor)+'"':'')+'>'+tag
      +'<div class="ia-t">'+x.hhmm+'</div>'
      +'<div class="ia-n">'+_gymEsc(a.nome||'Aula')+'</div>'
      +'<div class="ia-m"><span>⏱ '+x.dur+' min</span>'+(vagas?'<span>🚲 '+res+' de '+vagas+' reservadas</span>':'')+(a.sala?'<span>📍 '+_gymEsc(a.sala)+'</span>':'')+'</div>'
      +(vagas?'<div class="ia-bar"><i style="width:'+pct+'%"></i></div>':'')
      +'<div class="ia-p">'+(prof?'<div class="ia-av">'+_gymIni(prof)+'</div><div style="min-width:0"><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_gymEsc(prof)+'</b><small>professor</small></div>':'<div><small>professor a definir</small></div>')
      +(i===0&&!encerradas?'<div class="ia-dica">Escaneie o QR da bike<br>ou use o totem na porta</div>':'')+'</div>'
      +'</div>';
  }
  var faixa=passadas.slice(-2).map(function(x){ return '<div><b>'+x.hhmm+'</b><span>'+_gymEsc(x.a.nome||'Aula')+'<small>concluída</small></span></div>'; });
  var nm=window._gymNumeros||null;
  if(nm && nm.km) faixa.push('<div style="border-color:rgba(93,177,61,.4)"><b style="color:#5db13d">'+_gymFmtN(nm.km)+'</b><span>km pedalados no clube<small>desde o início</small></span></div>');
  if(nm && nm.kcal) faixa.push('<div><b style="color:#ea860c">'+_gymFmtN(nm.kcal)+'</b><span>kcal gastas<small>desde o início</small></span></div>');
  el.innerHTML='<div class="ia-h"><div><div class="ia-brand" onclick="idleLogoClick()"><img src="logo-prorider.png" alt="ProRider" style="height:74px;display:block;"></div><div class="ia-sub">'+_gymEsc(nomeAcad)+(nomeAcad?' · ':'')+dia+'</div></div>'
    +'<div><div class="ia-hr" id="iaRelogio">'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+'</div><div class="ia-sub" style="text-align:right">'+(encerradas?'aulas de hoje encerradas':lista.length+' aula'+(lista.length==1?'':'s')+' hoje')+'</div></div></div>'
    +'<div class="ia-cards" style="grid-template-columns:'+cols+'">'+mostrar.map(card).join('')+'</div>'
    +(faixa.length?'<div class="ia-s">'+faixa.slice(0,4).join('')+'</div>':'')
    +'<div class="ia-f">Pressione START ou A para começar</div>';
  el.style.display='flex';
}
// relógio e contagem regressiva andam sozinhos enquanto a tela de espera estiver aberta
setInterval(function(){ try{ if(typeof idleOn!=='undefined' && idleOn && window._gymGradeHoje && window._gymGradeHoje.length) _gymGradeRender(window._gymGradeHoje); }catch(e){} }, 20000);

// ═══ LICENCA: UM COMPUTADOR + RENOVACAO A CADA 15 DIAS (20/09) ══════
// Decisoes do Mario:
//  - uma licenca vendida roda em UM computador; ativar noutro desliga o
//    anterior (o ultimo ganha). A demo pode rodar em 3, para os testes.
//  - a cada 15 dias o servidor confere se a licenca esta ativa e paga; se
//    nao estiver, o Ginasio bloqueia.
// Identidade: um codigo aleatorio criado na primeira execucao e guardado
// neste computador. NAO e o IP — o IP muda sozinho (roteador, troca de
// Wi-Fi) e derrubaria a academia a toa.
function _gymDeviceId(){
  var id=null;
  try{ id=localStorage.getItem('pr_device_id'); }catch(e){}
  if(!id){
    try{ id=(crypto&&crypto.randomUUID)?crypto.randomUUID():null; }catch(e){}
    if(!id) id='pr-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
    try{ localStorage.setItem('pr_device_id',id); }catch(e){}
  }
  return id;
}
// Nome legivel, so para o gestor reconhecer no portal qual computador e qual.
function _gymNomeComputador(){
  try{ var ua=navigator.userAgent||''; var so=/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':'Computador';
       return so+' · '+(screen.width+'x'+screen.height); }catch(e){ return 'Computador'; }
}
// Le a data de validade gravada dentro do token (sem conferir assinatura —
// isso quem faz e o servidor). Tokens antigos, sem validade, devolvem null.
function _gymTokenExpira(tok){
  try{
    var p=String(tok||'').split('.')[1]; if(!p) return null;
    p=p.replace(/-/g,'+').replace(/_/g,'/'); while(p.length%4) p+='=';
    var d=JSON.parse(atob(p)); return d.exp? d.exp*1000 : null;
  }catch(e){ return null; }
}
// Renova o token antes de vencer. Sem ninguem digitar nada.
async function _gymRenovarLicenca(){
  if(!_gymDisplayToken || _gymDisplayToken==='dev-bypass') return;
  var exp=_gymTokenExpira(_gymDisplayToken);
  // renova quando faltarem menos de 3 dias, ou se o token for do tipo antigo
  // (permanente) — assim os Ginasios ja instalados migram sozinhos
  if(exp && (exp-Date.now()) > 3*24*3600*1000) return;
  try{
    var r=await fetch(SERVER_HTTP+'/display/renovar',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_gymDisplayToken},
      // manda o token tambem no corpo: a rota do servidor le do cabecalho,
      // mas o documento de 22/09 menciona o token no corpo
      body:JSON.stringify({device_id:_gymDeviceId(), token:_gymDisplayToken})});
    var d={}; try{ d=await r.json(); }catch(e){}
    if(r.ok && d.token){
      _gymDisplayToken=d.token;
      try{ localStorage.setItem('pr_display_token',d.token); }catch(e){}
      if(d.teto) _gymAplicarTeto(d.teto);
      console.log('[ProRider] licenca renovada — valida ate '+new Date(_gymTokenExpira(d.token)||0).toLocaleDateString('pt-BR')+'.');
      return;
    }
    if(r.status===403){ _gymBloquear(d.motivo||'Licença suspensa.'); return; }
    if(r.status===401){ _gymLicencaPerdida(d.motivo); return; }
    // 404: servidor ainda sem esta rota — segue com o token atual, sem alarde
  }catch(e){ /* sem rede: tenta de novo mais tarde */ }
}
// Outro computador ativou esta licenca, ou o token deixou de valer.
function _gymLicencaPerdida(motivo){
  if(typeof boxMode!=='undefined' && boxMode==='live'){
    console.error('[ProRider] licenca deixou de valer neste computador ('+(motivo||'sem motivo')+'). A aula continua; a reativacao e pedida no fim.');
    window._gymPendenteAtivar=true; return;
  }
  try{ localStorage.removeItem('pr_display_token'); }catch(e){}
  _gymDisplayToken=null;
  try{ mostrarTelaAtivacao(false); }catch(e){}
  var msg = (motivo==='outro_computador')
    ? 'Esta licença foi ativada em outro computador. Para usar aqui, digite o código de novo — o outro será desligado.'
    : 'A TV precisa ser ativada de novo. Digite o código da TV (Admin → Licenças).';
  try{ var b=document.getElementById('boxAtivacao'); var n=document.getElementById('gymAtivAviso');
       if(b && !n){ n=document.createElement('div'); n.id='gymAtivAviso';
         n.style.cssText='margin:0 auto 14px;max-width:520px;padding:10px 14px;border-radius:10px;background:rgba(255,179,0,.14);border:1px solid rgba(255,179,0,.4);color:#FFB300;font-size:13px;text-align:center;';
         b.insertBefore(n,b.firstChild); }
       if(n) n.textContent=msg; }catch(e){}
}
// Pagamento em atraso ou licenca cancelada: bloqueia com mensagem clara.
function _gymBloquear(motivo){
  if(typeof boxMode!=='undefined' && boxMode==='live'){
    console.error('[ProRider] licenca bloqueada ('+motivo+'). A aula em curso termina normalmente.');
    window._gymPendenteBloqueio=motivo; return;
  }
  var o=document.getElementById('gymBloqueio');
  if(!o){ o=document.createElement('div'); o.id='gymBloqueio';
    o.style.cssText='position:fixed;inset:0;z-index:20000;background:#080610;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6vh 6vw;text-align:center;font-family:Barlow,sans-serif;color:#fff;';
    document.body.appendChild(o); }
  o.innerHTML='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:8vh;letter-spacing:.4vh;color:#e53935;">LICENÇA SUSPENSA</div>'
    +'<div style="font-size:2.8vh;color:rgba(255,255,255,.7);margin-top:2.5vh;max-width:70vw;line-height:1.5;">'+String(motivo).replace(/[<>&]/g,'')+'</div>'
    +'<div style="font-size:2.2vh;color:rgba(255,255,255,.4);margin-top:4vh;">Fale com o responsável financeiro da academia ou com o suporte ProRider.</div>';
  o.style.display='flex';
}
// Ao terminar uma aula, aplica o que ficou pendente durante ela.
function _gymAplicarPendentes(){
  if(window._gymPendenteBloqueio){ var m=window._gymPendenteBloqueio; window._gymPendenteBloqueio=null; _gymBloquear(m); }
  else if(window._gymPendenteAtivar){ window._gymPendenteAtivar=false; _gymLicencaPerdida(); }
}
setTimeout(_gymRenovarLicenca, 8000);            // ao abrir
setInterval(_gymRenovarLicenca, 6*3600*1000);    // e a cada 6 horas
setInterval(function(){ if(typeof boxMode==='undefined'||boxMode!=='live') _gymAplicarPendentes(); }, 30000);

// Move a agulha do perfil na tela do QR. Usa o mesmo calculo do mini grafico
// do topo (calcDoneSec), entao os dois andam juntos — era esta a queixa de
// 23/09: na tela do QR o perfil ficava parado.
function _preAulaAgulhaMover(){
  ['preAulaAgulha','qrAulaAgulha'].forEach(function(id){ _prAgulhaMoverId(id); });
}
function _prAgulhaMoverId(id){
  var ag=document.getElementById(id); if(!ag) return;
  var _vf0=document.getElementById(id+'Feito'); if(_vf0 && ag.style.display==='none') _vf0.style.width='0';
  try{
    if(typeof workout==='undefined' || !workout.length){ ag.style.display='none'; return; }
    var tot=0; for(var i=0;i<workout.length;i++) tot+=_prSec(workout[i])||0;
    if(tot<=0){ ag.style.display='none'; return; }
    var feito=0;
    if(typeof boxMode!=='undefined' && boxMode==='live' && window._prDoneSecAgora>0){
      feito=window._prDoneSecAgora;   // tempo real da aula, atualizado pelo loop principal
    } else {
      var p=0;
      if(typeof pausedElapsed!=='undefined' && workout[currentBlockIndex])
        p=Math.min(1,(pausedElapsed/1000)/(_prSec(workout[currentBlockIndex])||1));
      feito=(typeof calcDoneSec==='function')?calcDoneSec(p):0;
    }
    if(!(feito>0)){ ag.style.display='none'; return; }
    ag.style.display='block';
    var _pc=(Math.max(0,Math.min(1,feito/tot))*100).toFixed(2)+'%';
    ag.style.left=_pc;
    // parte ja pedalada escurece: a barra "anda" junto com a agulha
    var vf=document.getElementById(id+'Feito'); if(vf) vf.style.width=_pc;
  }catch(e){ ag.style.display='none'; }
}
// 26/09b: antes so rodava com o overlayQR aberto, mas a agulha morava no
// lobby (boxPreAula) — por isso nunca aparecia. Agora cada tela tem a sua
// agulha e as duas andam, uma vez por segundo, enquanto a aula corre.
setInterval(function(){
  if(typeof boxMode!=='undefined' && boxMode!=='live' && boxMode!=='preAula') return;
  _preAulaAgulhaMover();
}, 200); // 26/09c: 5x/s (antes 1x/s, a agulha andava aos saltos)

// Consulta a API e atualiza grade + verifica countdown
async function _gymGradeAtualizar(){
  if(!_gymDisplayToken) return;
  try{
    var headers = {Authorization:'Bearer '+_gymDisplayToken, 'X-PR-Build':PR_BUILD};  // 26/09e: versao para o Portal
    // ── 401 = TOKEN DO DISPLAY MORTO ─────────────────────────────────
    // Pendente desde 14/09: /display/agenda e /display/proxima-aula devolviam
    // 401 e o Ginasio IGNORAVA — guardava o token morto para sempre, e a
    // grade do dia, o countdown automatico e agora MINHAS AULAS paravam em
    // silencio.
    // O token nao expira. Se da 401, a chave secreta do servidor mudou
    // depois de o Ginasio ser ativado (ver documento de 20/09). Nao ha como
    // recuperar este token: a unica saida e reativar com o codigo da licenca.
    // Agora o Ginasio descarta o token e pede o codigo — mas NUNCA no meio
    // de uma aula; nesse caso so avisa no Console e espera.
    var _st401=false;
    var [gradeResp, proximaResp] = await Promise.all([
      fetch(SERVER_HTTP+'/display/agenda',{headers}).then(function(r){ if(r.status===401)_st401=true; return r.ok?r.json():null;}),
      fetch(SERVER_HTTP+'/display/proxima-aula',{headers}).then(function(r){ if(r.status===401)_st401=true; return r.ok?r.json():null;})
    ]);
    if(_st401 && _gymDisplayToken!=='dev-bypass'){
      console.error('[ProRider] TOKEN DO DISPLAY INVALIDO (401). O servidor nao reconhece mais este Ginasio — '
        + 'provavelmente a chave JWT_SECRET do servidor mudou depois da ativacao. '
        + 'Solucao: reativar com o codigo da licenca (tocar 5x no logo da tela de espera).');
      _gymLicencaPerdida();
      return;
    }
    // Grade do dia atual
    if(gradeResp && Array.isArray(gradeResp)){
      var hoje = new Date().getDay();
      _gymGradeData = gradeResp.filter(function(a){ return a.dia_semana===hoje; });
      _gymGradeRender(_gymGradeData);
    }
    // Próxima aula automática
    if(proximaResp && proximaResp.proxima_aula){
      var pa = proximaResp.proxima_aula;
      _gymSessao = proximaResp.sessao || null;
      // Só ativa countdown automático se: dentro de 10 min, modo automático, e idle
      if(!proximaResp.bloqueada && pa.mostrar_qr && pa.modo_inicio==='automatico'){
        _gymProxAula = pa;
        var segs = Math.round(pa.segundos_ate_aula||0);
        if(segs>=0 && !_gymCountdownInt) _gymIniciarCountdown(pa, segs);
      }
    }
  }catch(e){ /* silencioso */ }
}

// Inicia a tela de countdown automático
function _gymIniciarCountdown(aula, segsInicial){
  if(_gymCountdownInt) return; // já rodando
  _gymCountdownSec = segsInicial;
  // Mostrar tela countdown
  var box = document.getElementById('boxCountdown');
  if(box){
    box.style.display='flex';
    document.getElementById('cdNome').textContent = aula.nome||'—';
    document.getElementById('cdProf').textContent = '👨‍🏫 '+(aula.professor_nome||'—')+'   ·   ⏱ '+(aula.duracao_min||'—')+' min';
    document.getElementById('cdBadge').textContent = '▶ INÍCIO AUTOMÁTICO';
  }
  boxMode = 'countdown';
  _gymTickCountdown();
  _gymCountdownInt = setInterval(_gymTickCountdown, 1000);
}

function _gymTickCountdown(){
  var el = document.getElementById('cdTimer');
  if(!el) return;
  var s = _gymCountdownSec;
  var m = Math.floor(Math.max(0,s)/60);
  var ss = Math.max(0,s)%60;
  el.textContent = String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');
  el.style.color = s<=60?'#d62d2d':s<=180?'#ea860c':'#fff';
  if(s<=0){
    // Chegou a zero — iniciar QR automático
    clearInterval(_gymCountdownInt); _gymCountdownInt=null;
    var box=document.getElementById('boxCountdown');if(box)box.style.display='none';
    _gymLancarQRAuto();
    return;
  }
  _gymCountdownSec--;
}

// Lança a tela de QR para aula automática
function _gymLancarQRAuto(){
  if(!_gymProxAula) return;
  // Carregar aula livre (sem blocos) com dados da aula do sistema
  if(typeof workout!=='undefined') workout=[{
    duration:(_gymProxAula.duracao_min||60), rpmMin:60, rpmMax:120,
    intensity:'z1', ftpMin:40, ftpMax:135, position:'Livre', notes:'', segmentId:'main_1'
  }];
  mostrarPreAula(_gymProxAula, false, false);
  // Sobrescrever nome na pré-aula
  var n=document.getElementById('preAulaNome');if(n)n.textContent=_gymProxAula.nome||'—';
}

// Startup: verificar ativação e iniciar polling
window.addEventListener('load', function(){
  setTimeout(function(){
    if(!verificarAtivacao()) return; // mostra tela de ativação se necessário
    _gymGradeAtualizar();
    _gymPollInt = setInterval(function(){
      if(idleOn || boxMode==='countdown') _gymGradeAtualizar();
    }, 60000);
  }, 2000);

  // Auto-arranque BLED112: tenta reconectar sempre (porta já autorizada).
  // A M3i só transmite (broadcast), nunca conecta — o scan tem de correr SEMPRE.
  setTimeout(function(){
    try{
      if(typeof parBLED112Init==='undefined'||typeof BLED112==='undefined') return;
      parBLED112Init(function(){
        _parIniciarLiveBLED112(); // scan permanente desde o boot
      }, null); // falha silenciosa se porta não autorizada (utilizador não ligou o dongle)
    }catch(e){}
  }, 3500);
  // 07/10b: bikes ANT+ pareadas → liga o pendrive ANT+ (separado do BLED112: um não segura o outro)
  setTimeout(function(){
    try{ _parIniciarLiveANT(); }catch(e){ console.warn('[ANT+] '+e.message); }
  }, 3500);

  // Tick sempre-ativo da grade de Potência (não depende do dongle nem de isPlaying)
  if(APP_MODE!=='builder') _gymIniciarLiveTick();
});

// START na tela de countdown: antecipa início
document.addEventListener('keydown', function(e){
  if((e.key==='Enter'||e.code==='Gamepad0'||e.key===' ')&&boxMode==='countdown'){
    clearInterval(_gymCountdownInt); _gymCountdownInt=null;
    var box=document.getElementById('boxCountdown');if(box)box.style.display='none';
    _gymLancarQRAuto();
  }
});

// ============================================================
// TELA DE ESCOLHA
// ============================================================
var _escolhaCreated=false;
var _escClockInt=null;
function _escAtualizarInfo(){
  var now=new Date();
  var p=function(n){return (n<10?'0':'')+n;};
  var set=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  set('escClock',p(now.getHours())+':'+p(now.getMinutes()));
  set('escDate',p(now.getDate())+'/'+p(now.getMonth()+1)+'/'+now.getFullYear());
  var na=(typeof alunosMap!=='undefined')?Object.keys(alunosMap).length:0;
  set('escAlunos',na+(na===1?' aluno conectado':' alunos conectados'));
}
var _secretArmed=false,_secretHoldStart=0,_secretDisarmTimer=null;
function _secretBlink(on){ var b=document.getElementById('escCfg'); if(b){ if(on)b.classList.add('armed'); else b.classList.remove('armed'); } }
function _secretArm(){ _secretArmed=true; _secretBlink(true); if(_secretDisarmTimer)clearTimeout(_secretDisarmTimer); _secretDisarmTimer=setTimeout(_secretDisarm,6000); }
function _secretDisarm(){ _secretArmed=false; _secretBlink(false); if(_secretDisarmTimer){clearTimeout(_secretDisarmTimer);_secretDisarmTimer=null;} }
function _secretCheckHold(sel,sta){ if(sel&&sta){ if(!_secretHoldStart)_secretHoldStart=Date.now(); if(!_secretArmed && Date.now()-_secretHoldStart>=700){ _secretArm(); } } else { _secretHoldStart=0; } }
function _secretAbrir(){ _secretDisarm(); abrirMenuSecreto(); }  // abre o MENU SECRETO (hub: pareamento + alunos demo)
// ============================================================
// MENU SECRETO (acesso restrito) — pareamento + alunos demo
// ============================================================
var _msCreated=false,_msFoco=0,_msClockInt=null;
function abrirMenuSecreto(){
  var el=document.getElementById('menuSecretoScreen');
  if(!el||!_msCreated){
    if(el) el.remove();
    _msCreated=true;
    el=document.createElement('div');
    el.id='menuSecretoScreen';
    el.style.cssText='display:flex;position:fixed;inset:0;z-index:20500;background:radial-gradient(1200px 800px at 50% -10%,#0a0f1e 0%,#04060c 62%);flex-direction:column;padding:24px 48px 16px;font-family:Barlow,sans-serif;color:#f3f4f8;';
    var bikeI='<svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="#2f6bff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 L10 9 L14 15 H7 M14 15 L18.5 17.5 M11 9 H8.5 M14 6 L15.5 9 H12.5"/><circle cx="15" cy="5" r="1"/></svg>';
    var ppl='<svg width="56" height="56" viewBox="0 0 24 24" fill="#ea860c"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 3-5.4 6.5-5.4s6.5 1.8 6.5 5.4z"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16 14.5c3 .2 5.5 1.7 5.5 4.6"/></svg>';
    el.innerHTML=
      '<div class="ms-top">'
      +'<div class="ms-logo"><img src="logo-prorider.png" alt="ProRider" style="height:46px;display:block;"></div>'
      +'<div class="ms-title"><div class="ms-rest"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> ACESSO RESTRITO</div><div class="ms-h1"><b>MENU</b> <span>SECRETO</span></div><div class="ms-hsub">Configura\u00e7\u00f5es avan\u00e7adas do sistema</div></div>'
      +'<div class="ms-prot"><span class="ms-pi"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg></span><div><div class="ms-pl">SISTEMA PROTEGIDO</div><div class="ms-ps">Acesso autorizado</div></div></div>'
      +'</div>'
      +'<div class="ms-cards">'
      +'<div class="ms-card ms-c1" id="msCardPar"><div class="ms-ico">'+bikeI+'</div>'
        +'<div><div class="ms-ti">PAREAMENTO DE BIKES</div><div class="ms-de" style="color:#85a9ff">Conectar bikes por Bluetooth ou ANT+</div>'
        +'<div class="ms-chips"><span class="ms-chip" style="color:#6b9eff">Bluetooth</span><span class="ms-chip">ANT+</span><span class="ms-chip">Posi\u00e7\u00f5es</span></div></div>'
        +'<div class="ms-chev"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg></div></div>'
      +'<div class="ms-card ms-c2" id="msCardDemo"><div class="ms-ico">'+ppl+'</div>'
        +'<div><div class="ms-ti">ALUNOS DEMO</div><div class="ms-de" style="color:#f5b94e">Simular alunos para testes em bike real</div><div class="ms-stepL">N\u00famero de alunos</div></div>'
        +'<div class="ms-demoR"><div class="ms-toggle" id="msToggle"><span class="ms-knob"></span></div>'
        +'<div class="ms-stepper"><div class="ms-sbtn">\u2212</div><div class="ms-snum" id="msCount">15</div><div class="ms-sbtn">+</div></div></div></div>'
      +'</div>'
      +'<div class="ms-note"><div class="ms-ni"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/></svg></div><div><b>Este menu \u00e9 destinado apenas para uso interno.</b><span>Altere as configura\u00e7\u00f5es com responsabilidade.</span></div></div>'
      +'<div class="ms-closewrap"><div class="ms-closebtn"><span class="ms-cx"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg></span><span class="ms-ct">FECHAR</span></div></div>'
      +'<div class="ms-hintc"><span class="b">B</span> para voltar &nbsp;\u2022&nbsp; <span class="s">START</span> para confirmar</div>'
      +'<div class="ms-foot"><div class="ms-fbox"><span id="msClock">--:--</span><span class="ms-sep"></span><span id="msDate">--/--/----</span></div><div class="ms-vbox">VER. 2.1.0 <span class="ms-dot"></span></div></div>';
    var s=document.createElement('style');
    s.textContent="#menuSecretoScreen .ms-top{display:flex;align-items:flex-start}#menuSecretoScreen .ms-logo{display:flex;align-items:center;gap:12px}#menuSecretoScreen .ms-nm{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:1px;line-height:.9}#menuSecretoScreen .ms-nm b{color:#fff}#menuSecretoScreen .ms-nm span{color:#ea860c}#menuSecretoScreen .ms-gym{font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:6px;color:rgba(255,255,255,.45);margin-top:1px}#menuSecretoScreen .ms-title{flex:1;text-align:center;margin-top:-2px}#menuSecretoScreen .ms-rest{display:inline-flex;align-items:center;gap:7px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:4px;color:#6b9eff;text-transform:uppercase}#menuSecretoScreen .ms-h1{font-family:'Bebas Neue',sans-serif;font-size:54px;letter-spacing:3px;line-height:.95;margin-top:2px}#menuSecretoScreen .ms-h1 b{color:#fff;font-weight:400}#menuSecretoScreen .ms-h1 span{color:#ea860c}#menuSecretoScreen .ms-hsub{font-size:14px;color:rgba(255,255,255,.45);margin-top:3px}#menuSecretoScreen .ms-prot{display:flex;align-items:center;gap:10px;background:#0b0e18;border:1px solid rgba(93,177,61,.3);border-radius:13px;padding:12px 16px}#menuSecretoScreen .ms-pi{color:#5db13d}#menuSecretoScreen .ms-pl{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:1.5px;color:#fff;line-height:1.1}#menuSecretoScreen .ms-ps{font-size:11px;color:rgba(255,255,255,.45)}#menuSecretoScreen .ms-cards{max-width:1180px;width:100%;margin:22px auto 0;display:flex;flex-direction:column;gap:16px}#menuSecretoScreen .ms-card{border-radius:20px;padding:22px 28px;display:grid;align-items:center;transition:all .15s}#menuSecretoScreen .ms-c1{grid-template-columns:108px 1fr 56px;gap:26px;background:linear-gradient(180deg,rgba(47,107,255,.08),rgba(47,107,255,.02));border:1.5px solid rgba(47,107,255,.32)}#menuSecretoScreen .ms-c2{grid-template-columns:108px 1fr auto;gap:26px;background:linear-gradient(180deg,rgba(234,134,12,.08),rgba(234,134,12,.02));border:1.5px solid rgba(234,134,12,.32)}#menuSecretoScreen .ms-c1.foco{border-color:#2f6bff;box-shadow:0 0 44px rgba(47,107,255,.22)}#menuSecretoScreen .ms-c2.foco{border-color:#ea860c;box-shadow:0 0 44px rgba(234,134,12,.20)}#menuSecretoScreen .ms-ico{width:96px;height:96px;border-radius:20px;display:flex;align-items:center;justify-content:center}#menuSecretoScreen .ms-c1 .ms-ico{border:1px solid rgba(47,107,255,.5);background:radial-gradient(circle at 50% 30%,rgba(47,107,255,.22),transparent)}#menuSecretoScreen .ms-c2 .ms-ico{border:1px solid rgba(234,134,12,.5);background:radial-gradient(circle at 50% 30%,rgba(234,134,12,.22),transparent)}#menuSecretoScreen .ms-ti{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:2px;color:#fff;line-height:1}#menuSecretoScreen .ms-de{font-size:16px;font-weight:600;margin-top:5px}#menuSecretoScreen .ms-chips{display:flex;align-items:center;gap:22px;margin-top:13px}#menuSecretoScreen .ms-chip{font-size:14px;color:rgba(255,255,255,.45)}#menuSecretoScreen .ms-chev{width:54px;height:54px;border-radius:50%;border:1.5px solid rgba(47,107,255,.55);display:flex;align-items:center;justify-content:center;color:#6b9eff;justify-self:end}#menuSecretoScreen .ms-stepL{font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase;margin-top:16px}#menuSecretoScreen .ms-demoR{display:flex;flex-direction:column;align-items:flex-end;gap:16px}#menuSecretoScreen .ms-toggle{width:62px;height:32px;border-radius:20px;background:rgba(255,255,255,.12);position:relative;transition:all .2s}#menuSecretoScreen .ms-toggle.on{background:#5db13d;box-shadow:0 0 16px rgba(93,177,61,.45)}#menuSecretoScreen .ms-knob{position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;transition:all .2s}#menuSecretoScreen .ms-toggle.on .ms-knob{left:33px}#menuSecretoScreen .ms-stepper{display:flex;align-items:center;gap:16px}#menuSecretoScreen .ms-sbtn{width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);display:flex;align-items:center;justify-content:center;font-size:24px;color:rgba(255,255,255,.45);font-family:'Barlow Condensed',sans-serif;font-weight:700}#menuSecretoScreen .ms-snum{font-family:'Barlow Condensed',sans-serif;font-size:44px;font-weight:900;color:#fff;min-width:66px;text-align:center;line-height:1}#menuSecretoScreen .ms-note{max-width:1180px;width:100%;margin:14px auto 0;display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 20px}#menuSecretoScreen .ms-ni{width:32px;height:32px;flex-shrink:0;color:#5db13d;display:flex;align-items:center;justify-content:center}#menuSecretoScreen .ms-note b{font-size:14px;color:#fff;font-weight:700;display:block}#menuSecretoScreen .ms-note span{font-size:13px;color:rgba(255,255,255,.45)}#menuSecretoScreen .ms-closewrap{display:flex;justify-content:center;margin-top:18px}#menuSecretoScreen .ms-closebtn{display:flex;align-items:center;gap:12px;border:1.5px solid rgba(214,45,45,.55);border-radius:16px;padding:14px 50px;background:rgba(214,45,45,.06)}#menuSecretoScreen .ms-cx{width:28px;height:28px;border-radius:50%;border:2px solid #d62d2d;display:flex;align-items:center;justify-content:center;color:#d62d2d}#menuSecretoScreen .ms-ct{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:#fff}#menuSecretoScreen .ms-hintc{text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:1px;color:rgba(255,255,255,.45);margin-top:9px}#menuSecretoScreen .ms-hintc .b{color:#ff6b6b;font-weight:700}#menuSecretoScreen .ms-hintc .s{color:#5db13d;font-weight:700}#menuSecretoScreen .ms-foot{margin-top:auto;display:flex;align-items:center;padding-top:8px}#menuSecretoScreen .ms-fbox{display:flex;align-items:center;gap:12px;background:#0b0e18;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 16px;font-family:'Barlow Condensed',sans-serif;font-weight:700}#menuSecretoScreen .ms-sep{width:1px;height:16px;background:rgba(255,255,255,.08)}#menuSecretoScreen .ms-vbox{margin-left:auto;display:flex;align-items:center;gap:10px;background:#0b0e18;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 16px;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:1px}#menuSecretoScreen .ms-dot{width:9px;height:9px;border-radius:50%;background:#5db13d;box-shadow:0 0 10px #5db13d}";
    document.head.appendChild(s);
    document.body.appendChild(el);
  } else {
    el.style.display='flex';
  }
  _msFoco=0; _msFocar(); _msRender();
  _msAtualizarRelogio();
  if(_msClockInt)clearInterval(_msClockInt);
  _msClockInt=setInterval(function(){var e=document.getElementById('menuSecretoScreen'); if(!e||e.style.display!=='flex'){clearInterval(_msClockInt);_msClockInt=null;return;} _msAtualizarRelogio();},1000);
}
function fecharMenuSecreto(){ var el=document.getElementById('menuSecretoScreen'); if(el)el.style.display='none'; if(_msClockInt){clearInterval(_msClockInt);_msClockInt=null;} }
function _msFocar(){
  var c0=document.getElementById('msCardPar'),c1=document.getElementById('msCardDemo');
  if(c0)c0.classList.toggle('foco',_msFoco===0);
  if(c1)c1.classList.toggle('foco',_msFoco===1);
}
function _msRender(){
  var t=document.getElementById('msToggle'); if(t)t.classList.toggle('on',!!demoOn);
  var c=document.getElementById('msCount'); if(c)c.textContent=settingsNumDemo_val;
}
function _msToggleDemo(){ if(demoOn){ demoWanted=false; pararDemo(); } else { demoWanted=true; simularAlunos(); } settingsDemo=demoWanted; _demoSalvar(); _msRender(); }
// 09/10: o aluno demo fica como o professor deixou (ligado continua ligado ao voltar para o início e ao reabrir a TV)
function _demoSalvar(){ try{ localStorage.setItem('pr_demo', JSON.stringify({on:!!demoWanted, n:(typeof settingsNumDemo_val!=='undefined'?settingsNumDemo_val:null)})); }catch(e){} }
function _demoReligar(){ try{ if(demoWanted&&!demoOn&&typeof boxMode!=='undefined'&&boxMode==='preAula'&&typeof simularAlunos==='function') simularAlunos(); }catch(e){ console.warn('[ProRider] demo:',e&&e.message); } }
function _msAtualizarRelogio(){
  var now=new Date(),p=function(n){return(n<10?'0':'')+n;};
  var ce=document.getElementById('msClock'); if(ce)ce.textContent=p(now.getHours())+':'+p(now.getMinutes());
  var de=document.getElementById('msDate'); if(de)de.textContent=p(now.getDate())+'/'+p(now.getMonth()+1)+'/'+now.getFullYear();
}

// Fecha TODAS as telas de seleção/setup, exceto a indicada — evita sobreposição
// de telas (nova por cima de antiga, ou resíduos). Use no início de cada tela.
function _fecharTodasTelas(exceto){
  ['boxEscolha','boxUSB','bgPickerScreen','boxPreAula','menuSecretoScreen','pareamentoScreen','settingsScreen','boxNoUSB']
    .forEach(function(_id){ if(_id===exceto) return; var _e=document.getElementById(_id); if(_e) _e.style.display='none'; });
}
function mostrarEscolha(){
  boxMode='escolha'; escolhaIdx=0; _escolhaReady=false;
  usbList=[]; // limpar lista sempre que volta para a tela de escolha
  _fecharTodasTelas('boxEscolha');
  var el=document.getElementById('boxEscolha');
  if(!el||!_escolhaCreated){
    if(el) el.remove();
    _escolhaCreated=true;
    el=document.createElement('div');
    el.id='boxEscolha';
    el.style.cssText='display:flex;position:fixed;inset:0;z-index:10000;background:radial-gradient(1200px 800px at 50% -15%,#0a0f1e 0%,#04060c 60%);flex-direction:column;padding:26px 40px 18px;font-family:Barlow,sans-serif;color:#f3f4f8;';
    var isB=APP_MODE==='builder';
    var opts=[
      {id:'eOpt0',cor:'#2f6bff',deC:'#85a9ff',ti:'CARREGAR AULA',de:'Abra a aula do pen drive automaticamente',su:'Conecte seu pen drive para carregar o arquivo',icon:'<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2f6bff" stroke-width="1.7"><path d="M4 5h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>',sicon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v14M8 12l4 4 4-4"/><rect x="8" y="18" width="8" height="4" rx="1"/></svg>'},
      {id:'eOpt1',cor:'#5db13d',deC:'#7ed95c',ti:'AULA DO SISTEMA',de:'Escolha entre as aulas pr\u00e9-instaladas',su:'Navegue, selecione e personalize sua aula',icon:'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5db13d" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',sicon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/></svg>'},
      {id:'eOpt2',cor:'#ea860c',deC:'#f5b94e',ti:'SESS\u00c3O LIVRE',de:'QR direto \u00b7 Bike do professor como refer\u00eancia \u00b7 Fundo livre ou c\u00e2mera',su:'Configure sua sess\u00e3o do jeito que preferir',icon:'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ea860c" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z" fill="#ea860c" stroke="none"/></svg>',sicon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'}
    ];
    if(isB) opts.push({id:'eOpt3',cor:'#9b30ff',deC:'#c47dff',ti:'MONTAR AULA',de:'Construtor completo: blocos, zonas, RPM, m\u00eddia',su:'Crie sua aula do zero',icon:'<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9b30ff" stroke-width="1.7"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94z"/></svg>',sicon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'});
    var optsHtml=opts.map(function(o,i){
      return '<div id="'+o.id+'" class="ec-opt" style="--ec:'+o.cor+'" onclick="escolhaSel('+i+',\''+o.cor+'\')">'
        +'<div class="ec-icon">'+o.icon+'</div>'
        +'<div class="ec-body"><div class="ec-title">'+o.ti+'</div><div class="ec-desc" style="color:'+o.deC+'">'+o.de+'</div><div class="ec-sub">'+o.sicon+' '+o.su+'</div></div>'
        +'<div class="ec-divi"></div><div class="ec-start">START \u203a</div></div>';
    }).join('');
    var cfgSvg='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    el.innerHTML=
      '<div class="ec-top"><div class="ec-logo"><svg width="44" height="54" viewBox="0 0 44 56" fill="none"><defs><linearGradient id="ecB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe033"/><stop offset=".5" stop-color="#ea860c"/><stop offset="1" stop-color="#d62d2d"/></linearGradient></defs><path d="M30 4 L10 30 L20 30 L14 52 L34 26 L24 26 Z" fill="url(#ecB)"/></svg><div><div class="ec-nm"><b>PRO</b><span>RIDER</span></div><div class="ec-gym">'+(isB?'BUILDER':'GYM')+'</div></div></div>'
      +'<div class="ec-cfg" id="escCfg" onclick="abrirSettings()">'+cfgSvg+'<span class="t">CONFIGURA\u00c7\u00d5ES</span></div></div>'
      +'<div class="ec-hero"><div class="ec-hello">Bem-vindo, professor!</div><div class="ec-h1"><b>COMO DESEJA</b> <span>INICIAR SUA AULA?</span></div><div class="ec-hsub">Escolha o modo que melhor se adapta ao seu treino de hoje.</div></div>'
      +'<div class="ec-cards">'+optsHtml+'</div>'
      +'<div class="ec-quick"><span class="ec-qt">Acesso r\u00e1pido</span>'
      +'<div class="ec-qi"><span class="ec-qc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5 7-5s7 1.5 7 5"/><circle cx="18" cy="9" r="2.5"/><path d="M16 15c3 .3 5 1.6 5 4.5"/></svg></span><div><div class="ec-ql" id="escAlunos">0 alunos conectados</div><div class="ec-qs">Aguardando in\u00edcio da aula</div></div></div>'
      +'<div class="ec-qsep"></div><div class="ec-qi"><span class="ec-qc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span><div><div class="ec-ql">TV conectada</div><div class="ec-qs">ProRider TV 4K</div></div></div>'
      +'<div class="ec-qsep"></div><div class="ec-qi"><span class="ec-qc" style="color:#5db13d"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg></span><div><div class="ec-ql" style="color:#5db13d">Sistema online</div><div class="ec-qs">Tudo funcionando</div></div></div></div>'
      +'<div class="ec-foot"><div class="ec-help"><div class="ec-hi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg></div><div><div class="ec-hl">AJUDA</div><div class="ec-hs">Suporte r\u00e1pido</div></div></div>'
      +'<div class="ec-nav"><div class="ec-it"><span class="ec-key"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 5h-6zM12 22l-3-5h6zM2 12l5-3v6zM22 12l-5 3v-6z"/></svg></span> NAVEGAR</div><div class="ec-it"><span class="ec-key">START</span> CONFIRMAR</div><div class="ec-it"><span class="ec-key b">B</span> VOLTAR</div></div>'
      +'<div class="ec-sys"><span class="ec-dot"></span><div><div class="ec-sl">SISTEMA PRONTO</div><div class="ec-sv">'+PR_BUILD+'</div></div><div><div class="ec-clk" id="escClock">--:--</div><div class="ec-dt" id="escDate">--/--/----</div></div></div></div>';
    var s=document.createElement('style');
    s.textContent="#boxEscolha .ec-top{display:flex;align-items:center;}#boxEscolha .ec-logo{display:flex;align-items:center;gap:14px;}#boxEscolha .ec-nm{font-family:'Bebas Neue',sans-serif;font-size:38px;letter-spacing:1px;line-height:.9;}#boxEscolha .ec-nm b{color:#fff;}#boxEscolha .ec-nm span{color:#ea860c;}#boxEscolha .ec-gym{font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:6px;color:rgba(255,255,255,.45);margin-top:1px;}#boxEscolha .ec-cfg{margin-left:auto;display:flex;align-items:center;gap:10px;background:#0b0e18;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:13px 20px;color:rgba(255,255,255,.45);cursor:pointer;}#boxEscolha .ec-cfg .t{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:2px;}#boxEscolha .ec-cfg.armed{animation:ecArmed 1s infinite;border-color:#ea860c;color:#ea860c;}@keyframes ecArmed{0%,100%{box-shadow:0 0 0 0 rgba(234,134,12,0);background:#0b0e18;}50%{box-shadow:0 0 26px rgba(234,134,12,.5);background:rgba(234,134,12,.12);}}#boxEscolha .ec-hero{text-align:center;margin:26px 0 22px;}#boxEscolha .ec-hello{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;letter-spacing:4px;color:rgba(255,255,255,.45);text-transform:uppercase;}#boxEscolha .ec-h1{font-family:'Bebas Neue',sans-serif;font-size:52px;letter-spacing:2px;margin-top:4px;line-height:1;}#boxEscolha .ec-h1 b{color:#fff;font-weight:400;}#boxEscolha .ec-h1 span{color:#ea860c;}#boxEscolha .ec-hsub{font-size:16px;color:rgba(255,255,255,.45);margin-top:8px;}#boxEscolha .ec-cards{display:flex;flex-direction:column;gap:14px;max-width:1380px;width:100%;margin:0 auto;}#boxEscolha .ec-opt{display:grid;grid-template-columns:90px 1fr 1px 190px;align-items:center;gap:24px;background:#0b0e18;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px 26px;cursor:pointer;transition:all .15s;}#boxEscolha .ec-opt.on{box-shadow:0 0 0 1px var(--ec),0 0 34px rgba(255,255,255,.05);border-color:var(--ec);}#boxEscolha .ec-icon{width:80px;height:80px;border-radius:18px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ec);background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.05),transparent);}#boxEscolha .ec-body .ec-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1.5px;color:#fff;line-height:1;}#boxEscolha .ec-body .ec-desc{font-size:15px;font-weight:600;margin-top:5px;}#boxEscolha .ec-body .ec-sub{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.45);margin-top:8px;}#boxEscolha .ec-divi{width:1px;height:60px;background:rgba(255,255,255,.08);}#boxEscolha .ec-start{display:flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;padding:14px;font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;letter-spacing:3px;border:1px solid var(--ec);color:var(--ec);background:rgba(255,255,255,.02);}#boxEscolha .ec-quick{max-width:1380px;width:100%;margin:16px auto 0;display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;align-items:center;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:15px 10px;position:relative;}#boxEscolha .ec-qt{position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,.28);text-transform:uppercase;background:#070a12;padding:0 12px;}#boxEscolha .ec-qi{display:flex;align-items:center;gap:13px;justify-content:center;}#boxEscolha .ec-qc{color:rgba(255,255,255,.45);}#boxEscolha .ec-ql{font-size:15px;font-weight:700;color:#fff;line-height:1.1;}#boxEscolha .ec-qs{font-size:12px;color:rgba(255,255,255,.45);}#boxEscolha .ec-qsep{width:1px;height:38px;background:rgba(255,255,255,.08);justify-self:center;}#boxEscolha .ec-foot{margin-top:auto;display:flex;align-items:center;padding-top:14px;}#boxEscolha .ec-help{display:flex;align-items:center;gap:11px;background:#0b0e18;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 18px;}#boxEscolha .ec-hi{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.45);}#boxEscolha .ec-hl{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,.45);}#boxEscolha .ec-hs{font-size:11px;color:rgba(255,255,255,.28);}#boxEscolha .ec-nav{margin:0 auto;display:flex;align-items:center;gap:24px;}#boxEscolha .ec-it{display:flex;align-items:center;gap:9px;font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:1px;color:rgba(255,255,255,.45);}#boxEscolha .ec-key{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;padding:4px 11px;border-radius:6px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:#f3f4f8;}#boxEscolha .ec-key.b{border-color:rgba(214,45,45,.5);color:#ff6b6b;}#boxEscolha .ec-sys{display:flex;align-items:center;gap:16px;background:#0b0e18;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 20px;}#boxEscolha .ec-dot{width:9px;height:9px;border-radius:50%;background:#5db13d;box-shadow:0 0 10px #5db13d;}#boxEscolha .ec-sl{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:1px;color:#fff;line-height:1;}#boxEscolha .ec-sv{font-size:11px;color:rgba(255,255,255,.28);}#boxEscolha .ec-clk{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:#fff;line-height:1;text-align:right;}#boxEscolha .ec-dt{font-size:11px;color:rgba(255,255,255,.28);text-align:right;}";
    document.head.appendChild(s);
    document.body.appendChild(el);
  } else {
    el.style.display='flex';
  }
  escolhaFocus();
  _escAtualizarInfo();
  if(_escClockInt)clearInterval(_escClockInt);
  _escClockInt=setInterval(function(){ if(boxMode!=='escolha'){clearInterval(_escClockInt);_escClockInt=null;return;} _escAtualizarInfo(); },1000);
}
function escolhaSel(i,cor){ escolhaIdx=i; escolhaFocus(); }
function escolhaFocus(){
  var cors=['#2f6bff','#5db13d','#ea860c','#9b30ff'];
  for(var i=0;i<4;i++){
    var o=document.getElementById('eOpt'+i); if(!o) continue;
    if(i===escolhaIdx){o.classList.add('on');o.style.setProperty('--ec',cors[i]);}
    else o.classList.remove('on');
  }
}
function escolhaConfirmar(){
  var el=document.getElementById('boxEscolha');if(el)el.style.display='none';
  if(escolhaIdx>3)escolhaIdx=3;
  var opt3=APP_MODE==='builder'?abrirConstrutor:abrirSessaoLivre;
  [_origemAulaEscolher,abrirSistema,abrirSessaoLivre,opt3][escolhaIdx]();
}
// ═══════════════════════════════════════════════════════════════════
// MINHAS AULAS — aulas do professor guardadas na nuvem (20/09)
// -------------------------------------------------------------------
// Desenho do Mario: em CARREGAR AULA aparecem duas origens.
//   DO PENDRIVE    — como sempre foi.
//   MINHAS AULAS   — o Ginasio mostra um QR; o professor escaneia com o
//                    celular ja logado; o servidor confere que ele e
//                    professor DESTA unidade e devolve as aulas dele.
// A identificacao tem de vir ANTES de escolher a aula. O QR da sala so
// aparece na pre-aula, com a aula ja escolhida — tarde demais.
// Da nuvem vem so o arquivo da aula (leve). Video e musica continuam no
// pendrive, pasta ProRider, e sao achados PELO NOME gravado no arquivo —
// o mesmo caminho das aulas do pendrive, via servidor local.
// As aulas entram na usbList, entao abrirAula() carrega tudo sem mudanca.
// Contrato das rotas: ver ProRider_MINHAS_AULAS_20-09.docx.
// ═══════════════════════════════════════════════════════════════════
var _nuv={codigo:null,token:null,timer:null,expira:0,prof:null,sel:0};

function _nuvToken(){ try{ return localStorage.getItem('pr_display_token')||''; }catch(e){ return ''; } }
function _nuvEl(){
  var o=document.getElementById('nuvOv');
  if(!o){
    o=document.createElement('div'); o.id='nuvOv';
    o.style.cssText='position:fixed;inset:0;z-index:10050;background:#080610;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4vh 4vw;font-family:Barlow,sans-serif;color:#fff;';
    document.body.appendChild(o);
  }
  o.style.display='flex'; return o;
}
function _nuvFechar(){
  if(_nuv.timer){ clearInterval(_nuv.timer); _nuv.timer=null; }
  var o=document.getElementById('nuvOv'); if(o) o.style.display='none';
  window._nuvemGp=null;
  document.removeEventListener('keydown',_nuvTecla,true);
}
function _nuvVoltar(){ _nuvFechar(); try{ mostrarEscolha(); }catch(e){} }
function _nuvTecla(e){
  if(typeof window._nuvemGp!=='function') return;
  var k=e.key, g={};
  if(k==='ArrowLeft') g.left=true; else if(k==='ArrowRight') g.right=true;
  else if(k==='ArrowUp') g.up=true; else if(k==='ArrowDown') g.down=true;
  else if(k==='Enter') g.a=true; else if(k==='Escape'||k==='Backspace') g.b=true;
  else return;
  e.preventDefault(); e.stopPropagation(); window._nuvemGp(g);
}

// ── 1. ESCOLHER A ORIGEM ─────────────────────────────────────────────
function _origemAulaEscolher(){
  try{ _fecharTodasTelas('nuvOv'); }catch(e){}
  var o=_nuvEl(); _nuv.sel=0;
  function card(i,cor,ti,de,icone){
    return '<div id="nuvOp'+i+'" onclick="_nuvOrigemConfirmar('+i+')" style="flex:1;max-width:520px;min-height:30vh;cursor:pointer;border-radius:22px;padding:4vh 3vw;display:flex;flex-direction:column;justify-content:center;gap:1.4vh;background:rgba(255,255,255,.035);border:2px solid rgba(255,255,255,.08);transition:all .15s;" data-cor="'+cor+'">'
      +'<div style="font-size:6vh;line-height:1;">'+icone+'</div>'
      +'<div style="font-family:\'Bebas Neue\',sans-serif;font-size:5.4vh;letter-spacing:.2vh;color:'+cor+';">'+ti+'</div>'
      +'<div style="font-size:2.3vh;color:rgba(255,255,255,.62);line-height:1.4;">'+de+'</div></div>';
  }
  o.innerHTML='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:3vh;letter-spacing:.6vh;color:rgba(255,255,255,.4);margin-bottom:.6vh;">CARREGAR AULA</div>'
    +'<div style="font-family:\'Bebas Neue\',sans-serif;font-size:6.4vh;letter-spacing:.3vh;margin-bottom:5vh;">DE ONDE VEM A AULA?</div>'
    +'<div style="display:flex;gap:3vw;width:100%;justify-content:center;">'
      +card(0,'#2f6bff','DO PENDRIVE','A pasta ProRider no pendrive, como sempre.','&#128190;')
      +card(1,'#ea860c','MINHAS AULAS','As aulas que você montou no celular. Escaneie o QR com o app para entrar.','&#9729;&#65039;')
    +'</div>'
    +'<div style="margin-top:5vh;font-size:2vh;color:rgba(255,255,255,.35);letter-spacing:.2vh;">&#8592; &#8594; ESCOLHER &nbsp;&middot;&nbsp; A CONFIRMAR &nbsp;&middot;&nbsp; B VOLTAR</div>';
  _nuvOrigemFoco();
  window._nuvemGp=function(g){
    if(g.left){ _nuv.sel=0; _nuvOrigemFoco(); }
    if(g.right){ _nuv.sel=1; _nuvOrigemFoco(); }
    if(g.a) _nuvOrigemConfirmar(_nuv.sel);
    if(g.b) _nuvVoltar();
  };
  document.addEventListener('keydown',_nuvTecla,true);
}
function _nuvOrigemFoco(){
  for(var i=0;i<2;i++){
    var c=document.getElementById('nuvOp'+i); if(!c) continue;
    var on=(i===_nuv.sel), cor=c.getAttribute('data-cor');
    c.style.borderColor=on?cor:'rgba(255,255,255,.08)';
    c.style.background=on?'rgba(255,255,255,.07)':'rgba(255,255,255,.035)';
    c.style.transform=on?'scale(1.03)':'scale(1)';
    c.style.boxShadow=on?('0 0 5vh '+cor+'33'):'none';
  }
}
function _nuvOrigemConfirmar(i){
  _nuvFechar();
  if(i===0){ abrirPicker(); return; }
  _nuvParear();
}

// ── 2. PAREAR COM O CELULAR DO PROFESSOR ──────────────────────────────
function _nuvMsg(titulo, texto, cor){
  var o=_nuvEl();
  o.innerHTML='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:6vh;letter-spacing:.3vh;color:'+(cor||'#fff')+';">'+titulo+'</div>'
    +'<div style="font-size:2.6vh;color:rgba(255,255,255,.62);margin-top:2vh;max-width:70vw;text-align:center;line-height:1.5;">'+texto+'</div>'
    +'<div style="margin-top:5vh;font-size:2vh;color:rgba(255,255,255,.35);letter-spacing:.2vh;">B VOLTAR</div>';
  window._nuvemGp=function(g){ if(g.b||g.a) _nuvVoltar(); };
  document.addEventListener('keydown',_nuvTecla,true);
}
async function _nuvParear(){
  _nuvMsg('A PREPARAR…','A pedir um código ao servidor.');
  var r, d;
  try{
    r=await fetch(SERVER_HTTP+'/ginasio/pareamento',{method:'POST',headers:{'Authorization':'Bearer '+_nuvToken()}});
    // 23/09b: 401 aqui nao e falta de rede — e o token do display que o
    // servidor ja nao reconhece (JWT_SECRET mudou). Antes saia "SEM LIGACAO"
    // e so dava para voltar; agora diz o que e e oferece reativar ali mesmo.
    if(r.status===401){
      console.warn('[ProRider] MINHAS AULAS: 401 no pareamento — token do display recusado pelo servidor.');
      _nuvMsg('GINÁSIO NÃO AUTENTICADO',
        'O servidor não reconhece mais este Ginásio (token do display inválido).<br>'
        +'Reative com o código da TV (Admin → Licenças) — é uma vez só.<br>As aulas do pendrive continuam a funcionar normalmente.'
        +'<div style="margin-top:3vh;font-size:2vh;color:#ffb02e;letter-spacing:.2vh;">A REATIVAR</div>','#ffb02e');
      window._nuvemGp=function(g){
        if(g.a){ _nuvFechar(); try{ _gymLicencaPerdida('token_invalido'); }catch(e){} }
        else if(g.b) _nuvVoltar();
      };
      return;
    }
    if(!r.ok) throw new Error('O servidor respondeu '+r.status+'.');
    d=await r.json();
  }catch(e){
    console.warn('[ProRider] MINHAS AULAS: pareamento nao iniciou —', e&&e.message);
    _nuvMsg('SEM LIGAÇÃO', (e&&e.message?e.message:'Não consegui falar com o servidor.')+'<br>As aulas do pendrive continuam a funcionar normalmente.','#e53935');
    return;
  }
  // o codigo pode vir como codigo | code | pareamento; a validade em
  // expira_em_seg | expires_in | ttl. Sem nada disso, 120 s.
  _nuv.codigo = d.codigo || d.code || d.pareamento || null;
  if(!_nuv.codigo){
    console.warn('[ProRider] MINHAS AULAS: o servidor nao devolveu o codigo —', JSON.stringify(d).slice(0,200));
    _nuvMsg('RESPOSTA INESPERADA','O servidor não devolveu o código do pareamento. Veja o Console (F12).','#e53935');
    return;
  }
  var _ttl = d.expira_em_seg || d.expires_in || d.ttl || 120;
  _nuv.expira=Date.now()+(_ttl*1000); _nuv.token=null; _nuv.prof=null;
  var base=(typeof _BROWSER_ALUNO_URL!=='undefined'&&_BROWSER_ALUNO_URL)?_BROWSER_ALUNO_URL:(SERVER_HTTP+'/aluno');
  var url=base+(base.indexOf('?')>=0?'&':'?')+'parear='+encodeURIComponent(d.codigo);
  var o=_nuvEl();
  o.innerHTML='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:3vh;letter-spacing:.6vh;color:rgba(255,255,255,.4);">MINHAS AULAS</div>'
    +'<div style="font-family:\'Bebas Neue\',sans-serif;font-size:6vh;letter-spacing:.3vh;margin:.6vh 0 3.4vh;">ESCANEIE COM O APP PRORIDER</div>'
    +'<div style="display:flex;align-items:center;gap:5vw;">'
      +'<div id="nuvQR" style="background:#fff;padding:2vh;border-radius:2vh;"></div>'
      +'<div style="max-width:34vw;font-size:2.5vh;line-height:1.7;color:rgba(255,255,255,.72);">'
        +'1. Abra o app ProRider no seu celular, <b>já com login feito</b>.<br>'
        +'2. Aponte a câmara para este código.<br>'
        +'3. As suas aulas aparecem aqui.'
        +'<div style="margin-top:3vh;font-family:\'Bebas Neue\',sans-serif;font-size:3.4vh;letter-spacing:.5vh;color:#ea860c;">'+d.codigo+'</div>'
        +'<div id="nuvCont" style="font-size:2vh;color:rgba(255,255,255,.4);margin-top:.6vh;"></div>'
      +'</div></div>'
    +'<div style="margin-top:4.5vh;font-size:2vh;color:rgba(255,255,255,.35);letter-spacing:.2vh;">B VOLTAR</div>';
  try{ new QRCode(document.getElementById('nuvQR'),{text:url,width:340,height:340,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M}); }
  catch(e){ var q=document.getElementById('nuvQR'); if(q) q.textContent=url; }
  window._nuvemGp=function(g){ if(g.b) _nuvVoltar(); };
  document.addEventListener('keydown',_nuvTecla,true);
  if(_nuv.timer) clearInterval(_nuv.timer);
  _nuv.timer=setInterval(_nuvVerificar,2000);
}
async function _nuvVerificar(){
  var falta=Math.max(0,Math.round((_nuv.expira-Date.now())/1000));
  var c=document.getElementById('nuvCont'); if(c) c.textContent='válido por mais '+falta+' s';
  if(falta<=0){
    clearInterval(_nuv.timer); _nuv.timer=null;
    _nuvMsg('CÓDIGO EXPIROU','Por segurança o código só vale alguns minutos.<br>Volte e escolha MINHAS AULAS de novo para gerar outro.','#FFB300');
    return;
  }
  try{
    var r=await fetch(SERVER_HTTP+'/ginasio/pareamento/'+encodeURIComponent(_nuv.codigo),{headers:{'Authorization':'Bearer '+_nuvToken()}});
    if(!r.ok) return;
    var d=await r.json();
    var _st=String(d.status||'').toLowerCase();
    if(_st==='negado'||_st==='denied'||_st==='recusado'){
      clearInterval(_nuv.timer); _nuv.timer=null;
      _nuvMsg('ACESSO NEGADO',(d.motivo||'Este professor não está autorizado nesta unidade.')+'<br>Peça ao gestor da unidade para o adicionar como professor.','#e53935');
      return;
    }
    // o token do pareamento chega como 'token' ou 'prof_session'
    var _tk = d.token || d.prof_session || d.prof_session_token || null;
    // Basta o token chegar: alguns servidores devolvem 'confirmed' ou 'ok'.
    if(!_tk) return;
    if(_st && ['confirmado','confirmed','ok','aceite','aceito'].indexOf(_st)<0){
      console.warn('[ProRider] MINHAS AULAS: token recebido com status "'+_st+'" — a seguir mesmo assim.');
    }
    clearInterval(_nuv.timer); _nuv.timer=null;
    _nuv.token=_tk; _nuv.prof=d.professor||d.prof||{};
    _nuvCarregar();
  }catch(e){}
}

// ── 3. TRAZER AS AULAS E ENTREGAR A LISTA DE SEMPRE ─────────────────────
async function _nuvCarregar(){
  var nome=(_nuv.prof&&_nuv.prof.nome)?_nuv.prof.nome:'professor';
  _nuvMsg('OLÁ, '+String(nome).toUpperCase(),'A trazer as suas aulas…','#43A047');
  var h={'Authorization':'Bearer '+_nuv.token};
  try{
    var r=await fetch(SERVER_HTTP+'/ginasio/treinos',{headers:h});
    if(!r.ok) throw new Error('O servidor respondeu '+r.status+'.');
    var _rl=await r.json();
    var lista=_rl.treinos||_rl.aulas||(Array.isArray(_rl)?_rl:[]);
    if(!lista.length){
      _nuvMsg('NENHUMA AULA AINDA','Monte uma aula no construtor do app e salve na sua conta.<br>Ela aparece aqui na próxima vez.','#FFB300');
      return;
    }
    var aulas=[];
    for(var i=0;i<lista.length;i++){
      try{
        var rr=await fetch(SERVER_HTTP+'/ginasio/treinos/'+encodeURIComponent(lista[i].id),{headers:h});
        if(!rr.ok) continue;
        var t=await rr.json();
        // O servidor grava o treino em 'dados' (documento do dev de 22/09);
        // 'json' e 'treino' ficam aceites por compatibilidade.
        var bruto=(t.dados!=null?t.dados:(t.json!=null?t.json:t.treino));
        var dados=(typeof bruto==='string')?JSON.parse(bruto):bruto;
        if(dados && !dados.workout && dados.Structure){ var _tp2=_prDeTrainingPeaks(dados, t.nome); if(_tp2) dados=_tp2; }
        if(!dados||!dados.workout||!dados.workout.length) continue;
        dados.nome=dados.nome||t.nome||lista[i].nome;
        aulas.push({name:(t.nome||lista[i].nome||'Aula')+'.json', data:dados, _nuvem:true});
      }catch(e){ console.warn('[ProRider] MINHAS AULAS: aula ignorada —', e&&e.message); }
    }
    if(!aulas.length){ _nuvMsg('NÃO CONSEGUI ABRIR','As aulas vieram, mas nenhuma estava num formato válido.','#e53935'); return; }
    console.log('[ProRider] MINHAS AULAS: '+aulas.length+' aula(s) do professor '+nome+'. Video e musica serao procurados no pendrive pelo nome.');
    _nuvFechar();
    usbList=aulas; usbIdx=0;
    var t2=document.getElementById('usbTitle'); if(t2) t2.textContent='MINHAS AULAS · '+String(nome).toUpperCase();
    mostrarUSB();
  }catch(e){
    _nuvMsg('SEM LIGAÇÃO',(e&&e.message?e.message:'Não consegui trazer as aulas.'),'#e53935');
  }
}

function abrirConstrutor(){
  boxMode='construtor';
  var h=document.getElementById('boxHeader'),b=document.getElementById('boxBuilder');
  if(h)h.style.display='';if(b)b.style.display='';
  var cl=document.getElementById('closeLive'); if(cl) cl.style.display='';
}

// ============================================================
// PENDRIVE — persistência via IndexedDB
// ============================================================
var _idbDb=null;
function _idbOpen(){
  return new Promise(function(res,rej){
    if(_idbDb){res(_idbDb);return;}
    var req=indexedDB.open('prorider_fs',1);
    req.onupgradeneeded=function(e){e.target.result.createObjectStore('handles');};
    req.onsuccess=function(e){_idbDb=e.target.result;res(_idbDb);};
    req.onerror=function(){rej();};
  });
}
async function _idbSave(handle){
  try{var db=await _idbOpen();var tx=db.transaction('handles','readwrite');tx.objectStore('handles').put(handle,'usbDir');}catch(e){}
}
async function _idbLoad(){
  try{var db=await _idbOpen();return await new Promise(function(res){var tx=db.transaction('handles','readonly');var r=tx.objectStore('handles').get('usbDir');r.onsuccess=function(){res(r.result||null);};r.onerror=function(){res(null);};});}catch(e){return null;}
}
async function _idbClear(){
  try{var db=await _idbOpen();var tx=db.transaction('handles','readwrite');tx.objectStore('handles').delete('usbDir');}catch(e){}
}

// Tenta auto-conectar ao pendrive guardado; se falhar mostra o picker
async function abrirPicker(){
  var saved=await _idbLoad();
  if(saved){
    try{
      // queryPermission não abre nenhum diálogo — só verifica
      var state=await saved.queryPermission({mode:'read'});
      if(state==='granted'){
        usbDir=saved; pendrive=true;
        await lerPendrive(saved);
        return;
      }
      // permissão precisa de confirmação — mostrar botão ao utilizador
      _mostrarPickerUI(saved);
      return;
    }catch(e){}
  }
  _mostrarPickerUI(null);
}

function _mostrarPickerUI(savedHandle){
  var old=document.getElementById('pickerBD');if(old)old.remove();
  var bd=document.createElement('div');
  bd.id='pickerBD';
  bd.style.cssText='position:fixed;inset:0;z-index:10001;background:#080610;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
  var btnLabel=savedHandle?'PERMITIR ACESSO AO PENDRIVE':'SELECIONAR PASTA ProRider';
  var btnSub=savedHandle?'Clique para reconectar ao pendrive já configurado':'Selecione a pasta ProRider no pendrive — só é necessário uma vez';
  bd.innerHTML='<div style="font-family:Bebas Neue,sans-serif;font-size:15px;letter-spacing:3px;color:rgba(255,255,255,.28);">PRORIDER '+(APP_MODE==='builder'?'BUILDER':'GYM')+'</div>'
    +'<button id="btnPicker" style="padding:15px 42px;border-radius:12px;background:linear-gradient(135deg,#295fe8,#5b3de8);border:none;color:#fff;font-family:Bebas Neue,sans-serif;font-size:22px;letter-spacing:3px;cursor:pointer;box-shadow:0 0 30px rgba(41,95,232,.35);">'+btnLabel+'</button>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.2);">'+btnSub+'</div>'
    +(savedHandle?'<button id="btnPickerNovo" style="padding:8px 20px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.4);font-size:12px;font-family:Barlow Condensed,sans-serif;letter-spacing:1px;cursor:pointer;">Selecionar outra pasta</button>':'')
    +'<button onclick="document.getElementById(\'pickerBD\').remove();mostrarEscolha();" style="margin-top:6px;padding:6px 16px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.28);font-size:12px;cursor:pointer;">Continuar sem pendrive</button>';
  document.body.appendChild(bd);
  boxMode='picker';

  async function _conectarDir(dir){
    await _idbSave(dir);
    bd.remove(); usbDir=dir; pendrive=true;
    await lerPendrive(dir);
  }

  document.getElementById('btnPicker').addEventListener('click',async function(){
    if(savedHandle){
      try{
        var perm=await savedHandle.requestPermission({mode:'read'});
        if(perm==='granted'){ await _conectarDir(savedHandle); return; }
      }catch(e){}
      // fallback: picker novo
    }
    try{
      var root=await window.showDirectoryPicker({mode:'read'});
      var dir=root;
      try{dir=await root.getDirectoryHandle('ProRider',{create:false});}catch(e){}
      await _conectarDir(dir);
    }catch(e){bd.remove();mostrarEscolha();}
  });

  var btnNovo=document.getElementById('btnPickerNovo');
  if(btnNovo) btnNovo.addEventListener('click',async function(){
    try{
      var root=await window.showDirectoryPicker({mode:'read'});
      var dir=root;
      try{dir=await root.getDirectoryHandle('ProRider',{create:false});}catch(e){}
      await _idbClear();
      await _conectarDir(dir);
    }catch(e){}
  });
}
// Normaliza nome para comparar: sem acento, minusculo, sem espaco nas pontas.
// "Musicas", "musicas", "MUSICAS" e "Músicas" passam a ser a mesma coisa.
function _prNorm(s){
  try{ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
  catch(e){ return String(s||'').toLowerCase().trim(); }
}
// Pastas que nunca devem ser varridas (perfil do navegador, sistema, lixeira)
function _prPastaIgnorada(nome){
  var n=_prNorm(nome);
  return n.charAt(0)==='.' || n==='node_modules' || n==='system volume information' ||
         n==='$recycle.bin' || n==='found.000';
}
// Devolve [raiz, ...todas as subpastas ate 2 niveis]. Nao depende de a pasta
// se chamar "musicas": qualquer nome serve, inclusive com acento.
async function _prTodasAsPastas(dir, prof){
  var out=[dir];
  if((prof||0)>=2) return out;
  try{
    for await(var e of dir.values()){
      if(e.kind!=='directory' || _prPastaIgnorada(e.name)) continue;
      var filhas=await _prTodasAsPastas(e,(prof||0)+1);
      for(var i=0;i<filhas.length;i++) out.push(filhas[i]);
    }
  }catch(ex){}
  return out;
}
// Procura um arquivo pelo nome em todas as pastas, ignorando acento e caixa.
async function _prAcharArquivo(dirs, nome){
  if(!nome||!dirs||!dirs.length) return null;
  for(var i=0;i<dirs.length;i++){                       // 1) nome exato (rapido)
    try{ return await(await dirs[i].getFileHandle(nome)).getFile(); }catch(e){}
  }
  var alvo=_prNorm(nome);
  for(var j=0;j<dirs.length;j++){                       // 2) sem acento/caixa
    try{
      for await(var e of dirs[j].values()){
        if(e.kind==='file' && _prNorm(e.name)===alvo) return await e.getFile();
      }
    }catch(ex){}
  }
  return null;
}
// Igual a _prAcharArquivo, mas devolve a REFERENCIA (handle) em vez do arquivo.
// O endereco temporario (blob:) criado a partir do arquivo morre quando o
// Windows re-enumera o pendrive; com a referencia guardada, o endereco pode ser
// refeito no instante de usar.
async function _prAcharHandle(dirs, nome){
  if(!nome||!dirs||!dirs.length) return null;
  for(var i=0;i<dirs.length;i++){
    try{ return await dirs[i].getFileHandle(nome); }catch(e){}
  }
  var alvo=_prNorm(nome);
  for(var j=0;j<dirs.length;j++){
    try{
      for await(var e of dirs[j].values()){
        if(e.kind==='file' && _prNorm(e.name)===alvo) return e;
      }
    }catch(ex){}
  }
  return null;
}

async function lerPendrive(dir){
  usbList=[]; var subs={}; usbSubs={};
  for await(var e of dir.values()){
    if(e.kind==='directory'){
      var n=_prNorm(e.name);
      if(n==='videos'||n==='video'){subs.videos=e;usbSubs.videos=e;}
      if(n==='musicas'||n==='musica'||n==='mp3'||n==='audio'){subs.musicas=e;usbSubs.musicas=e;}
    }
  }
  usbAllDirs = await _prTodasAsPastas(dir,0);
  subs.todas = usbAllDirs;
  console.log('[ProRider] pendrive: '+usbAllDirs.length+' pasta(s) na varredura de midia.');
  for await(var e of dir.values()){
    if(e.kind==='file'&&e.name.toLowerCase().endsWith('.json')){
      try{
        var data=JSON.parse(await(await e.getFile()).text());
        if(!(data.workout||data.blocks||data.blocos) && data.Structure){ var _tp=_prDeTrainingPeaks(data, e.name); if(_tp) data=_tp; }
        var bl=data.workout||data.blocks||data.blocos;
        if(bl&&bl.length){
          data.workout=_prNormWorkout(bl);
          data.nome=data.nome||data.name||e.name.replace(/\.json$/i,'').replace(/_/g,' ');
          data._dir=dir;data._subs=subs;data._dirs=usbAllDirs;
          usbList.push({name:e.name,data:data});
        } else console.warn('[ProRider] pendrive: '+e.name+' ignorado — nao tem blocos de aula (nem formato ProRider, nem TrainingPeaks).');
      }catch(err){ console.warn('[ProRider] pendrive: '+e.name+' nao abriu como JSON — '+(err&&err.message)); }
    }
  }
  usbList.sort(function(a,b){return a.name.localeCompare(b.name);});
  await _bgScanPendrive();
  var t=document.getElementById('usbTitle');if(t)t.textContent='Minhas aulas · do pendrive';
  _sistEmCateg=true; // pendrive = lista directa, sem ecrã de categorias
  window._usbOrigem='minhas'; // 30/09e: B volta para MINHAS AULAS
  usbIdx=0; mostrarUSB();
}
function mostrarUSB(){
  boxMode='usb';
  _fecharTodasTelas('boxUSB');
  var el=document.getElementById('boxUSB');if(el)el.style.display='flex';
  // Título já foi definido por quem chamou (abrirSistema ou pendrive)
  var sub=document.getElementById('usbSubtitle');
  if(sub)sub.textContent=usbList.length?(usbList.length+' aula'+(usbList.length>1?'s':'')+' encontrada'+(usbList.length>1?'s':'')):'Nenhuma aula encontrada';
  _renderAulasList();
}
// ── Badges de mídia da aula (vídeo/música) com FONTE clara — lista do pendrive ──
function _midiaTag(txt,bg,cor,bd){
  return '<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:'+bg+';color:'+cor+';border:1px solid '+bd+';text-transform:uppercase;letter-spacing:.5px;margin-right:4px;">'+txt+'</span>';
}
function _usbMidiaBadges(d){
  var out='';
  // Vídeo: MP4(pendrive) / Câmera / YouTube(futuro) / Sem vídeo
  if(d.video&&d.video.fonte){
    var vf=d.video.fonte;
    if(vf==='local')       out+=_midiaTag('Vídeo MP4','rgba(255,60,60,.10)','#ff6b6b','rgba(255,60,60,.25)');
    else if(vf==='camera') out+=_midiaTag('Câmera','rgba(41,95,232,.12)','#6aa0ff','rgba(41,95,232,.3)');
    else if(vf==='youtube')out+=_midiaTag('YouTube','rgba(255,60,60,.12)','#ff6b6b','rgba(255,60,60,.3)');
    else                   out+=_midiaTag('Vídeo','rgba(255,255,255,.06)','rgba(255,255,255,.5)','rgba(255,255,255,.12)');
  } else {
    out+=_midiaTag('Sem vídeo','rgba(255,255,255,.04)','rgba(255,255,255,.28)','rgba(255,255,255,.08)');
  }
  // Música: MP3(pendrive) / Spotify / Sem música
  if(d.musica&&d.musica.fonte){
    var mf=d.musica.fonte;
    if(mf==='spotify')   out+=_midiaTag('Spotify','rgba(30,215,96,.10)','#1ed760','rgba(30,215,96,.25)');
    else if(mf==='mp3')  out+=_midiaTag('MP3','rgba(234,134,12,.12)','#ea860c','rgba(234,134,12,.3)');
    else                 out+=_midiaTag('Música','rgba(255,255,255,.06)','rgba(255,255,255,.5)','rgba(255,255,255,.12)');
  } else {
    out+=_midiaTag('Sem música','rgba(255,255,255,.04)','rgba(255,255,255,.28)','rgba(255,255,255,.08)');
  }
  return out;
}
function _fmtDurAula(min){ min=Math.round(min||0); if(min>=60){ var h=Math.floor(min/60), m=min%60; return h+'h'+(m?' '+m+'min':''); } return min+' min'; }
function _fmMMSS(min){ var s=Math.round((min||0)*60); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
function renderUSB(){
  var list=document.getElementById('usbFileList');if(!list)return;
  list.innerHTML='';
  if(!usbList.length){
    list.innerHTML='<div style="padding:40px;text-align:center;color:rgba(255,255,255,.3);">'
      +'<div style="font-size:32px;margin-bottom:12px;">&#128193;</div>'
      +'<div style="font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:8px;">Nenhuma aula encontrada</div>'
      +'<div style="font-size:12px;line-height:1.8;">Coloque arquivos .json na pasta ProRider/<br>'
      +'ProRider/MinhaAula.json | ProRider/videos/video.mp4 | ProRider/musicas/musica.mp3</div>'
      +'<div style="margin-top:14px;font-size:11px;color:rgba(255,255,255,.18);">Pressione B ou Esc para voltar</div></div>';
    return;
  }
  var hMap={z1:14,z2:28,z3:42,z4:56,z5:70,z6:84,z7:100};
  usbList.forEach(function(f,i){
    var d=f.data,dur=(d.workout||[]).reduce(function(a,b){return a+(b.duration||0);},0),tot=dur||1;
    var badges=_usbMidiaBadges(d);
    var bars=(d.workout||[]).map(function(b){var zk=toZKey(b.intensity),c=ZC[zk]||'#888',h=hMap[zk]||14,fl=Math.max(1,Math.round(((b.duration||1)/tot)*100));return'<div style="flex:'+fl+';height:'+h+'%;border-radius:2px 2px 0 0;background:'+c+';min-width:4px;"></div>';}).join('');
    var sel=i===usbIdx;
    var row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:1fr 96px;align-items:center;gap:12px;padding:13px 16px;border-radius:10px;margin-bottom:7px;cursor:pointer;'
      +(sel?'background:rgba(41,95,232,.1);border:1px solid rgba(41,95,232,.4);box-shadow:inset 3px 0 0 #295fe8;':'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);');
    row.innerHTML='<div><div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">'+d.nome+'</div>'
      +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><span style="font-size:11px;color:rgba(255,255,255,.3);">'+_fmtDurAula(dur)+' &middot; '+(d.workout||[]).length+' blocos</span>'+badges+'</div></div>'
      +'<div style="display:flex;align-items:flex-end;gap:2px;height:34px;">'+bars+'</div>';
    row.onclick=function(){usbIdx=i;renderUSB();};
    list.appendChild(row);
  });
}
// ── Categorias do Sistema ─────────────────────────────────────
var _sistCats=[
  {key:'Endurance Builder',   label:'ENDURANCE BUILDER',   sub:'Base aeróbica · Z2–Z4',   tag:'RESISTÊNCIA',     dur:'45–60', inten:'Média',      cor:'#4f86ff', zonas:['z2','z2','z3','z4','z2'], svg:'<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f86ff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 L10 9 L14 15 H7 M14 15 L18.5 17.5 M11 9 H8.5 M14 6 L15.5 9 H12.5"/><circle cx="15" cy="5" r="1"/></svg>'},
  {key:'HIIT Threshold',      label:'HIIT THRESHOLD',      sub:'Limiar · Z4–Z5',          tag:'ALTA INTENSIDADE', dur:'30–45', inten:'Alta',       cor:'#ff5a3c', zonas:['z4','z4','z5','z6','z6'], svg:'<svg width="36" height="36" viewBox="0 0 24 24" fill="#d6402d" stroke="#ff7a4d" stroke-width="1"><path d="M12 2c1 3-2 4-2 7 0 1 .5 2 1.5 2.5C12 10 13 8 13 6c2 2 5 5 5 9a6 6 0 11-12 0c0-3 2-5 3-7 .5 2 2 3 3 3-.5-3 0-6 0-9z"/></svg>'},
  {key:'VO2 Max Intervals',   label:'VO2 MAX INTERVALS',   sub:'Máximo aeróbico · Z5–Z6', tag:'PERFORMANCE',     dur:'30–50', inten:'Muito alta', cor:'#f5a623', zonas:['z5','z6','z5','z6','z5'], svg:'<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h3l2-5 3 9 2.5-7 1.5 4h6"/></svg>'},
  {key:'Sprint Neuromuscular',label:'SPRINT NEUROMUSCULAR',sub:'Potência máxima · Z6–Z7',  tag:'POTÊNCIA',        dur:'20–35', inten:'Máxima',     cor:'#b366ff', zonas:['z6','z7','z6','z7','z6'], svg:'<svg width="34" height="34" viewBox="0 0 24 24" fill="#9b30ff" stroke="#c47dff" stroke-width="1"><path d="M13 2 L4 14 H11 L9 22 L20 9 H13 Z"/></svg>'},
  {key:'FTP',                 label:'TESTES FTP',          sub:'Avaliação de potência',   tag:'AVALIAÇÃO',       dur:'20–40', inten:'Variável',   cor:'#5db13d', zonas:['z2','z4','z5','z6','z3'], svg:'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5db13d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><rect x="5" y="5" width="3" height="2" fill="#5db13d" stroke="none"/><rect x="11" y="5" width="3" height="2" fill="#5db13d" stroke="none"/><rect x="8" y="7" width="3" height="2" fill="#5db13d" stroke="none"/></svg>'}
];
var _sistCatIdx=0;
var _sistEmCateg=false; // false=categorias, true=lista de aulas da categoria

function abrirSistema(){
  _sistEmCateg=false; _sistCatIdx=0;
  _renderSistCats();
}
function _ring(frac,color,size){
  size=size||34; var sw=3.2, r=(size-sw)/2, cx=size/2, C=2*Math.PI*r;
  frac=Math.max(0,Math.min(1,frac)); var off=C*(1-frac);
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="transform:rotate(-90deg);flex-shrink:0;">'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r.toFixed(2)+'" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="'+sw+'"/>'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r.toFixed(2)+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+C.toFixed(2)+'" stroke-dashoffset="'+off.toFixed(2)+'"/>'
    +'</svg>';
}
function _renderSistCats(){
  var t=document.getElementById('usbTitle'); if(t)t.textContent='AULAS DO SISTEMA';
  var sub=document.getElementById('usbSubtitle'); if(sub)sub.textContent='Escolha uma categoria \u00b7 '+SISTEMA.length+' aulas no total';
  var list=document.getElementById('usbFileList'); if(!list)return;
  var hMap={z1:14,z2:28,z3:42,z4:56,z5:70,z6:84,z7:100};
  var html='';
  _sistCats.forEach(function(cat,i){
    var n=SISTEMA.filter(function(a){return a.nome.indexOf(cat.key)===0;}).length;
    var sel=i===_sistCatIdx;
    var rgb=(typeof _bgHexRgb==='function')?_bgHexRgb(cat.cor):'255,255,255';
    var zb=''; cat.zonas.forEach(function(zk){var c=ZC[zk]||'#888',h=hMap[zk]||14;zb+='<i style="width:11px;border-radius:2px 2px 0 0;height:'+h+'%;background:'+c+';"></i>';});
    var _dn=String(cat.dur||'').split(/[^0-9]+/).filter(Boolean).map(Number);
    var _dmid=_dn.length?((_dn[0]+(_dn[1]||_dn[0]))/2):30;
    var durF=Math.max(.08,Math.min(1,_dmid/60));
    var _im={'M\u00e9dia':.5,'Alta':.7,'Muito alta':.85,'M\u00e1xima':1,'Vari\u00e1vel':.6};
    var intF=_im[cat.inten]||.6;
    var durRing=_ring(durF,cat.cor), intRing=_ring(intF,cat.cor);
    html+='<div onclick="_sistCatIdx='+i+';_abrirSistCat(_sistCats['+i+']);" style="display:grid;grid-template-columns:88px minmax(0,1.3fr) 132px 150px minmax(0,1fr) 110px 28px;align-items:center;gap:18px;padding:15px 22px;border-radius:16px;margin-bottom:10px;cursor:pointer;transition:all .15s;'
      +'background:'+(sel?'rgba('+rgb+',.10)':'rgba(255,255,255,.03)')+';border:1px solid '+(sel?cat.cor:'rgba(255,255,255,.07)')+';'+(sel?'box-shadow:0 0 0 1px '+cat.cor+',0 0 26px rgba('+rgb+',.18);':'')+'">'
      +'<div style="width:70px;height:70px;border-radius:16px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at 50% 30%,rgba('+rgb+',.22),rgba('+rgb+',.05));">'+cat.svg+'</div>'
      +'<div style="min-width:0;"><div style="font-family:Bebas Neue,sans-serif;font-size:24px;letter-spacing:1.5px;color:'+cat.cor+';line-height:1;">'+cat.label+'</div>'
        +'<div style="font-size:13px;color:rgba(255,255,255,.45);margin-top:3px;">'+cat.sub+'</div>'
        +'<span style="display:inline-block;font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:4px 10px;border-radius:6px;margin-top:8px;background:rgba('+rgb+',.16);color:'+cat.cor+';">'+cat.tag+'</span></div>'
      +'<div style="display:flex;align-items:center;gap:11px;">'+durRing+'<div><div style="font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:900;color:#fff;line-height:1;">'+cat.dur+' <span style="font-size:60%;color:rgba(255,255,255,.45);">min</span></div><div style="font-family:Barlow Condensed,sans-serif;font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,.28);text-transform:uppercase;margin-top:2px;">Dura\u00e7\u00e3o</div></div></div>'
      +'<div style="display:flex;align-items:center;gap:11px;">'+intRing+'<div><div style="font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:900;color:#fff;line-height:1;">'+cat.inten+'</div><div style="font-family:Barlow Condensed,sans-serif;font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,.28);text-transform:uppercase;margin-top:2px;">Intensidade</div></div></div>'
      +'<div><div style="font-family:Barlow Condensed,sans-serif;font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,.28);text-transform:uppercase;margin-bottom:7px;">Zonas principais</div><div style="display:flex;align-items:flex-end;gap:4px;height:30px;">'+zb+'</div></div>'
      +'<div style="text-align:right;"><div style="font-family:Barlow Condensed,sans-serif;font-size:30px;font-weight:900;line-height:1;color:'+cat.cor+';">'+n+'</div><div style="font-family:Barlow Condensed,sans-serif;font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.28);text-transform:uppercase;">aulas criadas</div></div>'
      +'<div style="color:rgba(255,255,255,.28);justify-self:end;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg></div>'
      +'</div>';
  });
  html+='<div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:13px 22px;margin-top:2px;">'
    +'<div style="width:34px;height:34px;border-radius:9px;background:rgba(234,134,12,.13);display:flex;align-items:center;justify-content:center;color:#ea860c;flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8z"/></svg></div>'
    +'<div><b style="font-family:Barlow Condensed,sans-serif;font-size:12px;letter-spacing:2px;color:#ea860c;display:block;">DICA PRO</b><span style="font-size:11.5px;color:rgba(255,255,255,.45);">Cada categoria segue nossas zonas de pot\u00eancia (Z1\u2013Z7) e o FTP do aluno.</span></div>'
    +'</div>';
  list.innerHTML=html;
  boxMode='usb';
  var el=document.getElementById('boxUSB'); if(el)el.style.display='flex';
}
function _abrirSistCat(cat){
  _sistEmCateg=true;
  var t=document.getElementById('usbTitle'); if(t)t.textContent=cat.label;
  usbList=SISTEMA.filter(function(a){return a.nome.indexOf(cat.key)===0;}).map(function(a){
    var d=JSON.parse(JSON.stringify(a)); d._dir=null; d._subs={};
    return{name:a.nome+'.json',data:d};
  });
  usbIdx=0; mostrarUSB();
}

// ===== AULAS DA CATEGORIA (lista + detalhe, dados reais) =====
function _saRgba(hex,a){ if(typeof _bgHexRgb==='function'){return 'rgba('+_bgHexRgb(hex)+','+a+')';} return hex; }
function _saZcol(z){ return (typeof ZC!=='undefined'&&ZC[z])?ZC[z]:'#6a7080'; }
function _saStats(d){
  var w=(d&&d.workout)||[]; var tot=0,fw=0,zs={},sec=0;
  w.forEach(function(b){var sb=_prSec(b);var dr=sb/60;tot+=dr;sec+=sb;var mid=(((b.ftpMin||0)+(b.ftpMax||0))/2);fw+=mid*dr;zs[b.intensity]=(zs[b.intensity]||0)+dr;});
  // sec = soma bloco a bloco ja arredondada. NAO usar tot para exibir: duration
  // esta em minutos e quase sempre e dizima (22s = 0,3666...), entao tot vira
  // 52.81660000000002 na tela.
  return {tot:tot,sec:sec,blocos:w.length,ftp:tot?Math.round(fw/tot):0,zs:zs};
}
// Formata segundos para exibicao: 52:49 · 1h05:30. Unico ponto de formatacao
// de duracao de aula nas telas do PRORIDER DRIVE.
function _saDur(sec){
  sec=Math.max(0,Math.round(sec||0));
  var h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), ss=sec%60;
  return (h>0? h+'h'+String(m).padStart(2,'0') : String(m))+':'+String(ss).padStart(2,'0');
}
function _saFtpCol(p){ if(p<56)return '#a1a1a1'; if(p<76)return '#2f6bff'; if(p<91)return '#5db13d'; if(p<106)return '#d7c414'; if(p<121)return '#ea860c'; return '#d62d2d'; }
function _saZoneRange(zs){ var lo=null,hi=null; for(var n=2;n<=7;n++){if(zs['z'+n]){if(lo===null)lo=n;hi=n;}} if(lo===null)return zs.z1?'Z1':'\u2014'; return 'Z'+lo+(hi>lo?'\u2013Z'+hi:''); }
function _saBadge(b){ var m={Easy:{t:'F\u00c1CIL',c:'#5db13d'},Medium:{t:'M\u00c9DIA',c:'#2f6bff'},Hard:{t:'DESAFIO',c:'#ea860c'}}; return m[b]||{t:(b||'AULA').toUpperCase(),c:'#6a7080'}; }
function _saThumb(d,i){ if(d&&d.img) return '<img src="'+d.img+'" style="width:100%;height:100%;object-fit:cover;display:block;">'; return _saSceneSVG(i); }
function _saSceneSVG(i){
  var sc=[
    '<svg viewBox="0 0 120 76" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block;"><defs><linearGradient id="GID" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a90d9"/><stop offset="1" stop-color="#bfe0f5"/></linearGradient></defs><rect width="120" height="76" fill="url(#GID)"/><path d="M0 50 L40 38 L70 44 L120 30 V76 H0Z" fill="#3f7a4a"/><path d="M0 60 L50 50 L120 44 V76 H0Z" fill="#2e5e38"/><path d="M52 76 L57 52 H63 L68 76Z" fill="#3a3a3a"/></svg>',
    '<svg viewBox="0 0 120 76" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block;"><defs><linearGradient id="GID" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a8db5"/><stop offset="1" stop-color="#cfe2f0"/></linearGradient></defs><rect width="120" height="76" fill="url(#GID)"/><path d="M0 46 L30 22 L48 40 L72 18 L96 42 L120 26 V76 H0Z" fill="#7a8694"/><path d="M22 30 L30 22 L38 32 Z" fill="#fff"/><path d="M64 28 L72 18 L80 30 Z" fill="#fff"/></svg>',
    '<svg viewBox="0 0 120 76" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block;"><defs><linearGradient id="GID" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a24a"/><stop offset=".5" stop-color="#e0633a"/><stop offset="1" stop-color="#7a3a4a"/></linearGradient></defs><rect width="120" height="76" fill="url(#GID)"/><circle cx="60" cy="40" r="14" fill="#ffe39a" opacity=".9"/><path d="M0 56 L40 50 L80 54 L120 48 V76 H0Z" fill="#3a2535"/></svg>',
    '<svg viewBox="0 0 120 76" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block;"><defs><linearGradient id="GID" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4a8a"/><stop offset="1" stop-color="#b58fb0"/></linearGradient></defs><rect width="120" height="76" fill="url(#GID)"/><path d="M0 50 L30 44 L60 48 L90 42 L120 46 V76H0Z" fill="#2a3a3a"/><path d="M14 50 L18 30 L22 50Z M30 52 L34 34 L38 52Z M92 50 L96 32 L100 50Z" fill="#16241c"/></svg>'
  ];
  return sc[i%sc.length].replace(/GID/g,'sa'+i+'g');
}
function _saBars(w){ return w.map(function(b){var mid=(((b.ftpMin||0)+(b.ftpMax||0))/2);var ht=Math.max(12,Math.min(100,mid/1.5));return '<i style="flex:1;min-width:0;height:'+ht+'%;background:'+_saZcol(b.intensity)+';border-radius:2px 2px 0 0;"></i>';}).join(''); }
function _saStatBox(l,v){ return '<div style="background:#10131e;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:9px 11px;"><div style="font-family:Barlow Condensed,sans-serif;font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.28);text-transform:uppercase;">'+l+'</div><div style="font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:900;color:#fff;margin-top:2px;">'+v+'</div></div>'; }
function _renderAulasList(){ _renderSistAulas(); } // pendrive e sistema usam o MESMO card rico
// TSS da aula: usa o campo salvo (construtor novo) ou calcula na hora (aulas antigas)
function _aulaTSS(d){
  if(d && d.tss!=null) return d.tss;
  if(typeof calcularTSS==='function') return calcularTSS((d&&d.workout)||[]).tss;
  return 0;
}
function _renderSistAulas(){
  var list=document.getElementById('usbFileList'); if(!list)return;
  if(!usbList.length){ renderUSB(); return; }
  if(usbIdx<0)usbIdx=0; if(usbIdx>usbList.length-1)usbIdx=usbList.length-1;
  var rows='';
  usbList.forEach(function(f,i){
    var d=f.data, st=_saStats(d), bg=_saBadge(d.badge), sel=i===usbIdx;
    rows+='<div id="saRow'+i+'" onclick="usbIdx='+i+';_renderSistAulas();" style="display:grid;grid-template-columns:28px 118px minmax(0,1.1fr) minmax(0,.85fr) 84px 22px;align-items:center;gap:15px;background:'+(sel?'rgba(47,107,255,.08)':'rgba(255,255,255,.03)')+';border:1px solid '+(sel?'#2f6bff':'rgba(255,255,255,.07)')+';'+(sel?'box-shadow:0 0 0 1px #2f6bff,0 0 22px rgba(47,107,255,.16);':'')+'border-radius:14px;padding:11px 15px;margin-bottom:9px;cursor:pointer;">'
      +'<div style="width:25px;height:25px;border-radius:7px;border:2px solid '+(sel?'#2f6bff':'rgba(255,255,255,.2)')+';background:'+(sel?'#2f6bff':'transparent')+';display:flex;align-items:center;justify-content:center;">'+(sel?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>':'')+'</div>'
      +'<div style="width:118px;height:72px;border-radius:11px;overflow:hidden;border:1px solid rgba(255,255,255,.08);">'+_saThumb(d,i)+'</div>'
      +'<div style="min-width:0;"><div style="font-size:18px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+d.nome+'</div>'
        +'<div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:2px;">'+_saDur(st.sec)+' \u00b7 '+st.blocos+' blocos</div>'
        +'<div style="margin-top:6px;display:flex;align-items:center;gap:8px;"><span style="font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:3px 9px;border-radius:5px;background:'+_saRgba(bg.c,.16)+';color:'+bg.c+';">'+bg.t+'</span><span style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;color:#5db13d;">'+_saZoneRange(st.zs)+'</span></div></div>'
      +'<div style="display:flex;align-items:flex-end;gap:3px;height:40px;">'+_saBars(d.workout)+'</div>'
      +'<div style="text-align:right;"><div style="font-size:10px;color:rgba(255,255,255,.28);">TSS</div><div style="font-family:Barlow Condensed,sans-serif;font-size:24px;font-weight:900;line-height:1;color:#ea860c;">'+_aulaTSS(d)+'</div></div>'
      +'<div style="color:rgba(255,255,255,.25);justify-self:end;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg></div>'
      +'</div>';
  });
  var d=usbList[usbIdx].data, st=_saStats(d), bg=_saBadge(d.badge);
  var perfil=d.workout.map(function(b){var mid=(((b.ftpMin||0)+(b.ftpMax||0))/2);var ht=Math.max(12,Math.min(100,mid/1.5));return '<i style="flex:1;min-width:0;height:'+ht+'%;background:'+_saZcol(b.intensity)+';border-radius:3px 3px 0 0;"></i>';}).join('');
  var zrow=''; ['z1','z2','z3','z4','z5','z6'].forEach(function(z,idx){var pct=st.tot?Math.round((st.zs[z]||0)/st.tot*100):0;var c=_saZcol(z);zrow+='<div style="background:'+_saRgba(c,.14)+';border-radius:8px;padding:8px 4px;text-align:center;"><div style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:900;color:'+c+';">Z'+(idx+1)+'</div><div style="font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;color:'+c+';margin-top:1px;">'+pct+'%</div></div>';});
  var det='<div style="background:linear-gradient(180deg,#0c1020,#0a0d16);border:1px solid rgba(47,107,255,.25);border-radius:18px;padding:17px;display:flex;flex-direction:column;height:100%;overflow:hidden;">'
    +'<div style="display:flex;align-items:center;gap:7px;background:rgba(47,107,255,.18);border:1px solid rgba(47,107,255,.4);border-radius:8px;padding:5px 11px;align-self:flex-start;font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#85a9ff;margin-bottom:12px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#85a9ff" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg> SELECIONADA</div>'
    +'<div style="position:relative;border-radius:13px;overflow:hidden;border:1px solid rgba(255,255,255,.08);height:132px;margin-bottom:12px;">'+_saThumb(d,usbIdx)+'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><div style="width:50px;height:50px;border-radius:50%;background:rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center;"><svg width="19" height="19" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div></div></div>'
    +'<div style="font-family:Bebas Neue,sans-serif;font-size:27px;letter-spacing:1px;color:#fff;line-height:1;">'+d.nome+'</div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.45);margin-top:3px;">'+_saDur(st.sec)+' \u00b7 '+st.blocos+' blocos</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-top:5px;"><span style="font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:3px 9px;border-radius:5px;background:'+_saRgba(bg.c,.16)+';color:'+bg.c+';">'+bg.t+'</span><span style="font-size:13px;color:#85a9ff;font-weight:600;">'+_saZoneRange(st.zs)+'</span></div>'
    +'<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.28);text-transform:uppercase;margin:13px 0 8px;">Perfil da aula</div>'
    +'<div style="display:flex;align-items:flex-end;gap:3px;height:56px;">'+perfil+'</div>'
    +'<div style="display:flex;justify-content:space-between;font-family:Barlow Condensed,sans-serif;font-size:10px;color:rgba(255,255,255,.28);margin-top:5px;letter-spacing:1px;"><span>00:00</span><span>'+_saDur(st.sec/2)+'</span><span>'+_saDur(st.sec)+'</span></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:12px;">'+_saStatBox('Dura\u00e7\u00e3o',_saDur(st.sec))+_saStatBox('TSS',_aulaTSS(d))+_saStatBox('FTP m\u00e9dio',st.ftp+'%')+_saStatBox('Zonas',_saZoneRange(st.zs))+'</div>'
    +'<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.28);text-transform:uppercase;margin:14px 0 8px;">Zonas utilizadas</div>'
    +'<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;">'+zrow+'</div>'
    +'<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.28);text-transform:uppercase;margin:14px 0 6px;">Descri\u00e7\u00e3o</div>'
    +'<div style="font-size:12.5px;color:rgba(255,255,255,.5);line-height:1.45;overflow:hidden;">'+(d.desc||'\u2014')+'</div>'
    +'<button onclick="abrirAula();" style="margin-top:auto;border:none;border-radius:13px;background:linear-gradient(180deg,#3f86ff,#1f5be0);color:#fff;font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:900;letter-spacing:2px;padding:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 6px 24px rgba(47,107,255,.3);">USAR ESTA AULA <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></button>'
    +'</div>';
  list.innerHTML='<div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;height:100%;align-items:stretch;"><div style="overflow-y:auto;padding-right:4px;">'+rows+'</div>'+det+'</div>';
  var r=document.getElementById('saRow'+usbIdx); if(r&&r.scrollIntoView)r.scrollIntoView({block:'nearest'});
}
function abrirSessaoLivre(){
  usbList=[]; // garantir que fecharPreAula() não volta para lista USB
  boxMode='livre';
  if(typeof workout!=='undefined') workout=[{
    duration:60, durationSec:3600, rpmMin:60, rpmMax:120,
    intensity:'z1', ftpMin:40, ftpMax:135,
    position:'Livre', notes:'', segmentId:'main_1'
  }];
  if(typeof segments!=='undefined') segments=[{id:'main_1',name:'Sessão Livre',type:'main'}];
  abrirBgPicker({nome:'Sessão Livre'},{ok:false,msg:'--'},{ok:false,msg:'--'});
}
async function abrirAula(){
  var f=usbList[usbIdx];if(!f)return;
  // limpa a midia da aula anterior antes de carregar a desta
  try{ _prLimparMidiaDaAula(); }catch(e){}
  var d=f.data,el=document.getElementById('boxUSB');if(el)el.style.display='none';
  if(typeof workout!=='undefined')workout=_prNormWorkout((d.workout||[]).map(function(b){return{
    duration:b.duration||1,durationSec:(b.durationSec!=null?b.durationSec:null),
    rpmMin:Number(b.rpmMin)||80,rpmMax:Number(b.rpmMax)||90,
    intensity:toZKey(b.intensity||b.z),ftpMin:(b.ftpMin!=null?b.ftpMin:60),ftpMax:(b.ftpMax!=null?b.ftpMax:89),
    position:b.position||'Sentado',notes:b.notes||'',segmentId:b.segmentId||'main_1',
    desafio:b.desafio||undefined   // 30/09e: o desafio montado no Construtor chega na TV
  };}));
  if(typeof segments!=='undefined')segments=d.segments||[{id:'warmup',name:'Aquecimento',type:'warmup'},{id:'main_1',name:'Principal',type:'main'},{id:'cooldown',name:'Cooldown',type:'cooldown'}];
  var dir=d._dir,subs=d._subs||{};
  // Procura em TODAS as pastas do pendrive (raiz + subpastas ate 2 niveis),
  // ignorando acento e caixa. Antes so olhava a raiz e as subpastas chamadas
  // exatamente "videos"/"musicas" — uma pasta "Musicas" com acento ficava invisivel.
  var _dirsBusca = (d._dirs && d._dirs.length) ? d._dirs
                 : (usbAllDirs && usbAllDirs.length) ? usbAllDirs
                 : [dir, subs.videos, subs.musicas].filter(Boolean);
  async function buscar(nome){
    if(!nome) return null;
    var f = await _prAcharArquivo(_dirsBusca, nome);
    if(!f) console.warn('[ProRider] arquivo declarado no JSON nao encontrado no pendrive:', nome);
    return f;
  }
  // Mesma busca, devolvendo a REFERENCIA do arquivo para poder refazer o
  // endereco temporario no instante de iniciar a aula.
  async function buscarH(nome){
    try{ return await _prAcharHandle(_dirsBusca, nome); }catch(e){ return null; }
  }
  // ── ENDERECO FIXO PARA O ARQUIVO DECLARADO NA AULA ─────────────
  // A aula do pendrive declara o video e a musica PELO NOME. Este caminho
  // continuava criando endereco temporario a partir do arquivo — e era ele que
  // dava 0 bytes. Agora, se o servidor local ja achou o pendrive, procuramos o
  // nome na lista dele e usamos o endereco fixo.
  var _nat = await _prBuscarPendriveNativo();
  function _acharNoNativo(lista, nome){
    if(!_nat || !nome) return null;
    var alvo = String(nome).split(/[\\/]/).pop().toLowerCase();
    for(var i=0;i<lista.length;i++){
      if(String(lista[i].nome).toLowerCase() === alvo) return lista[i];
    }
    // tolerante: sem acento e sem extensao
    var semExt = alvo.replace(/\.[^.]+$/,'');
    for(var j=0;j<lista.length;j++){
      if(String(lista[j].nome).toLowerCase().replace(/\.[^.]+$/,'') === semExt) return lista[j];
    }
    return null;
  }

  var vc={ok:false,msg:'--'},mc={ok:false,msg:'--'};
  if(d.video&&d.video.fonte==='local'&&d.video.arquivo){
    var _vn = _acharNoNativo((_nat&&_nat.videos)||[], d.video.arquivo);
    if(_vn){
      try{ if(typeof videoObjectUrl!=='undefined' && videoObjectUrl && videoObjectUrl.indexOf('blob:')===0) URL.revokeObjectURL(videoObjectUrl); }catch(e){}
      if(typeof videoObjectUrl!=='undefined') videoObjectUrl=_vn.url;
      if(typeof videoSource!=='undefined') videoSource='video';
      window._prVideoHandle=null;
      _preloadVideo(videoObjectUrl);
      var _offN=d.video.syncOffset||0; if(_offN>36000) _offN=_offN/1000;
      try{ await _prAplicarSyncVideo(videoObjectUrl, _offN); }catch(e){}
      vc={ok:true,msg:d.video.arquivo};
      console.log('[ProRider] video da aula por endereco fixo: '+_vn.nome);
    } else {
    var vf=await buscar(d.video.arquivo);
    if(vf){
      if(typeof videoObjectUrl!=='undefined'&&videoObjectUrl)URL.revokeObjectURL(videoObjectUrl);
      if(typeof videoObjectUrl!=='undefined')videoObjectUrl=URL.createObjectURL(vf);
      if(typeof videoSource!=='undefined')videoSource='video';
      try{ window._prVideoHandle = await buscarH(d.video.arquivo); }catch(e){}
      _preloadVideo(videoObjectUrl);
      // syncOffset = PONTO FINAL do video em SEGUNDOS (onde a linha de chegada
      // deve coincidir com o fim de aquecimento+principal).
      // A conversao ms->s so vale acima de 10 HORAS: um video de 50min em segundos
      // e 3017, e o limite antigo (>1000) transformava isso em 3,017s e matava a sincronia.
      var off=d.video.syncOffset||0; if(off>36000) off=off/1000;
      await _prAplicarSyncVideo(videoObjectUrl, off);
      vc={ok:true,msg:d.video.arquivo};
    }else{vc={ok:false,msg:d.video.arquivo+' -- nao encontrado'};}
    }
  }
  if(d.musica&&d.musica.fonte==='mp3'&&d.musica.arquivo){
    var _mn = _acharNoNativo((_nat&&_nat.musicas)||[], d.musica.arquivo);
    if(_mn){
      try{ if(typeof mp3ObjectUrl!=='undefined' && mp3ObjectUrl && mp3ObjectUrl.indexOf('blob:')===0) URL.revokeObjectURL(mp3ObjectUrl); }catch(e){}
      if(typeof mp3ObjectUrl!=='undefined') mp3ObjectUrl=_mn.url;
      window._prMusicaHandle=null;
      mc={ok:true,msg:d.musica.arquivo};
      console.log('[ProRider] musica da aula por endereco fixo: '+_mn.nome);
      try{
        var _am=new Audio(_mn.url);
        _am.onloadedmetadata=function(){
          if(typeof mp3Duration!=='undefined') mp3Duration=_am.duration||0;
          if(typeof mp3EndPoint!=='undefined') mp3EndPoint=_am.duration||0;
        };
      }catch(e){}
    } else {
    var mf=await buscar(d.musica.arquivo);
    if(mf){
      if(typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl)URL.revokeObjectURL(mp3ObjectUrl);
      if(typeof mp3ObjectUrl!=='undefined')mp3ObjectUrl=URL.createObjectURL(mf);
      try{ window._prMusicaHandle = await buscarH(d.musica.arquivo); }catch(e){}
      var tmp=new Audio(typeof mp3ObjectUrl!=='undefined'?mp3ObjectUrl:'');
      await new Promise(function(r){tmp.onloadedmetadata=r;tmp.onerror=r;});
      if(typeof mp3Duration!=='undefined')mp3Duration=tmp.duration||0;
      if(typeof mp3EndPoint!=='undefined')mp3EndPoint=tmp.duration||0;
      mc={ok:true,msg:d.musica.arquivo};
    }else{mc={ok:false,msg:d.musica.arquivo+' -- nao encontrado'};}
    }
  }
  if(d.musica&&d.musica.fonte==='spotify'&&d.musica.spotifyUri){
    if(typeof spotifyPlaylistUri!=='undefined')spotifyPlaylistUri=d.musica.spotifyUri;
    mc={ok:true,msg:'Spotify'};
  }
  abrirBgPicker(d,vc,mc);
}

// ============================================================
// MULTI-BACKGROUND SYSTEM (canvas nativo, sem iframe)
// ============================================================
var BG_MODES=[
  {key:'camera',   name:'AO VIVO',    color:'#ff3b3b', icon:'📷'},
  {key:'cosmos',   name:'COSMOS',     color:'#295fe8', icon:'✦'},
  {key:'nebula',   name:'NEBLINA',    color:'#9b30ff', icon:'☁'},
];
var bgPickerIdx=0;
var bgActiveMode='cosmos';   // modo confirmado para a aula
var _bgPickerData=null;
var bgZC='#295fe8';          // cor da zona atual para o fundo
var bgZoneSpeed=1.0;         // velocidade baseada na zona

// Estado interno dos modos
var _bgT=0, _bgBolts=[], _bgVLines=[];

function _bgRgba(hex,a){
  hex=hex.replace('#','');var n=parseInt(hex,16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}
function _bgHexRgb(hex){
  hex=hex.replace('#','');var n=parseInt(hex,16);
  return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);
}

// ── DRAW FUNCTIONS ────────────────────────────────────────────
function _bgDrawCosmos(ctx,W,H){
  ctx.fillStyle='rgba(2,1,8,.18)';ctx.fillRect(0,0,W,H);
  uP.forEach(function(p){
    p.x+=p.vx*bgZoneSpeed;p.y+=p.vy*bgZoneSpeed;
    p.a+=p.da;if(p.a>.8)p.da=-Math.abs(p.da);if(p.a<.1)p.da=Math.abs(p.da);
    if(p.x<-5)p.x=W+5;if(p.x>W+5)p.x=-5;if(p.y<-5)p.y=H+5;if(p.y>H+5)p.y=-5;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle=bgZC;ctx.globalAlpha=p.a;ctx.fill();ctx.globalAlpha=1;
  });
  for(var i=0;i<uP.length;i++)for(var j=i+1;j<uP.length;j++){
    var dx=uP[i].x-uP[j].x,dy=uP[i].y-uP[j].y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<110){ctx.beginPath();ctx.moveTo(uP[i].x,uP[i].y);ctx.lineTo(uP[j].x,uP[j].y);
      ctx.strokeStyle=bgZC;ctx.globalAlpha=(1-d/110)*.18;ctx.lineWidth=.7;ctx.stroke();ctx.globalAlpha=1;}
  }
}

function _bgDrawStorm(ctx,W,H){
  ctx.fillStyle='rgba(6,9,18,.18)';ctx.fillRect(0,0,W,H);
  for(var i=0;i<50;i++){ctx.fillStyle=_bgRgba(bgZC,Math.random()*.04);ctx.fillRect(Math.random()*W,Math.random()*H,Math.random()*200,1);}
  if(Math.random()<.022*bgZoneSpeed){
    var x=Math.random()*W,y=0,pts=[[x,y]];
    while(y<H){x+=(Math.random()-.5)*80;y+=20+Math.random()*40;pts.push([x,y]);}
    _bgBolts.push({pts:pts,life:1});
  }
  _bgBolts.forEach(function(b){
    ctx.shadowBlur=18;ctx.shadowColor=bgZC;ctx.strokeStyle=_bgRgba(bgZC,b.life);ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(b.pts[0][0],b.pts[0][1]);
    b.pts.forEach(function(p){ctx.lineTo(p[0],p[1]);});
    ctx.stroke();ctx.shadowBlur=0;b.life-=.06;
  });
  _bgBolts=_bgBolts.filter(function(b){return b.life>0;});
}

function _bgDrawVelocity(ctx,W,H){
  ctx.fillStyle='rgba(0,0,0,.30)';ctx.fillRect(0,0,W,H);ctx.lineCap='round';
  _bgVLines.forEach(function(p){
    ctx.strokeStyle=_bgRgba(bgZC,Math.min(.75,p.v/12));ctx.lineWidth=1+Math.random()*1.5;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.l,p.y);ctx.stroke();
    p.x+=p.v*bgZoneSpeed;
    if(p.x-p.l>W){p.x=-10;p.y=Math.random()*H;p.l=40+Math.random()*200;p.v=3+Math.random()*10;}
  });
}

function _bgDrawPulse(ctx,W,H){
  _bgT+=.03*bgZoneSpeed;ctx.fillStyle='rgba(6,9,18,.22)';ctx.fillRect(0,0,W,H);
  var cx=W/2,cy=H/2,maxR=Math.max(W,H);
  for(var i=0;i<12;i++){var r=((_bgT*80+i*80)%maxR);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle=_bgRgba(bgZC,Math.max(0,.5-r/maxR));ctx.lineWidth=2;ctx.stroke();}
}

function _bgDrawAurora(ctx,W,H){
  _bgT+=.008*bgZoneSpeed;ctx.fillStyle='rgba(6,9,18,.16)';ctx.fillRect(0,0,W,H);
  for(var band=0;band<5;band++){
    ctx.beginPath();
    for(var x=0;x<=W;x+=16){var y=H*.42+Math.sin(x*.005+_bgT+band)*65+band*35;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.lineWidth=38;ctx.shadowBlur=28;ctx.shadowColor=bgZC;ctx.strokeStyle=_bgRgba(bgZC,.09+band*.035);ctx.stroke();ctx.shadowBlur=0;
  }
}

function _bgDrawTunnel(ctx,W,H){
  _bgT+=.025*bgZoneSpeed;ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,W,H);
  var cx=W/2,cy=H/2;
  for(var i=0;i<28;i++){var r=((i*28+_bgT*100)%700)+15;ctx.beginPath();ctx.ellipse(cx,cy,r*1.4,r*.65,0,0,Math.PI*2);ctx.strokeStyle=_bgRgba(bgZC,.45-i/50);ctx.lineWidth=1.5;ctx.stroke();}
}

function _bgDrawNebula(ctx,W,H){
  _bgT+=.004*bgZoneSpeed;
  ctx.fillStyle='rgba(2,1,10,.14)'; ctx.fillRect(0,0,W,H);
  // Três nuvens de gás se movendo lentamente
  var clouds=[
    {ox:Math.sin(_bgT*.7)*W*.3,    oy:Math.cos(_bgT*.5)*H*.2,    r:W*.45},
    {ox:Math.cos(_bgT*.6+1)*W*.25, oy:Math.sin(_bgT*.8+2)*H*.25, r:W*.35},
    {ox:Math.sin(_bgT*.5+3)*W*.2,  oy:Math.cos(_bgT*.7+1)*H*.3,  r:W*.3},
  ];
  clouds.forEach(function(cl){
    var gx=W/2+cl.ox, gy=H/2+cl.oy;
    var g=ctx.createRadialGradient(gx,gy,0,gx,gy,cl.r);
    g.addColorStop(0,_bgRgba(bgZC,.18));
    g.addColorStop(.5,_bgRgba(bgZC,.07));
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  });
  // Estrelas fixas por cima
  uP.forEach(function(p){
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*.6,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+p.a*.6+')'; ctx.fill();
  });
}

function _bgDrawFire(ctx,W,H){
  _bgT+=.03*bgZoneSpeed;
  // Fundo escuro avermelhado
  ctx.fillStyle='rgba(4,2,2,.35)'; ctx.fillRect(0,0,W,H);
  // Labaredas: colunas de partículas ascendentes
  var cols=Math.floor(W/18);
  for(var i=0;i<cols;i++){
    var px=(i+.5)*(W/cols);
    var phase=i*1.3+_bgT*1.2;
    var flameH=H*(.35+Math.sin(phase)*.18+Math.cos(phase*.7)*.1);
    var cx2=px+Math.sin(_bgT*.8+i*.5)*22;
    var g=ctx.createLinearGradient(cx2,H,cx2,H-flameH);
    g.addColorStop(0,'rgba(255,60,0,.85)');
    g.addColorStop(.3,'rgba(255,140,0,.55)');
    g.addColorStop(.65,'rgba(200,30,0,.2)');
    g.addColorStop(1,'rgba(100,0,0,0)');
    ctx.beginPath();
    var fw=W/cols*.9;
    ctx.ellipse(cx2,H-flameH*.1,fw*.5,flameH*.55,0,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
  }
  // Brilho central de brasas
  var gb=ctx.createRadialGradient(W/2,H,0,W/2,H,W*.6);
  gb.addColorStop(0,'rgba(255,80,0,.12)');
  gb.addColorStop(.5,'rgba(180,30,0,.06)');
  gb.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gb; ctx.fillRect(0,0,W,H);
  // Faíscas
  uP.forEach(function(p){
    p.y-=(1+p.z*2)*bgZoneSpeed;
    p.x+=Math.sin(_bgT+p.a*10)*.8;
    if(p.y<0){p.y=H; p.x=Math.random()*W;}
    var alpha=Math.max(0,(p.y/H)*.8);
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*.5,0,Math.PI*2);
    ctx.fillStyle='rgba(255,'+(100+Math.floor(p.a*100))+',0,'+alpha+')'; ctx.fill();
  });
}
function _bgDrawWarp(ctx,W,H){
  _bgT+=.02*bgZoneSpeed;
  ctx.fillStyle='rgba(0,0,6,.25)'; ctx.fillRect(0,0,W,H);
  var cx=W/2, cy=H/2;
  // Estrelas em hiper-velocidade saindo do centro
  uP.forEach(function(p){
    var dx=p.x-cx, dy=p.y-cy;
    var dist=Math.sqrt(dx*dx+dy*dy)||1;
    var spd=(.0008+dist/W*.004)*bgZoneSpeed;
    p.x+=dx*spd*p.z; p.y+=dy*spd*p.z;
    var tail=Math.min(60, dist*.3*bgZoneSpeed);
    var nx=p.x-dx/dist*tail, ny=p.y-dy/dist*tail;
    ctx.beginPath(); ctx.moveTo(nx,ny); ctx.lineTo(p.x,p.y);
    ctx.strokeStyle=_bgRgba(bgZC,Math.min(.9,p.z*.6));
    ctx.lineWidth=p.r*.8; ctx.stroke();
    if(p.x<0||p.x>W||p.y<0||p.y>H){
      var ang=Math.random()*Math.PI*2, d=Math.random()*30+5;
      p.x=cx+Math.cos(ang)*d; p.y=cy+Math.sin(ang)*d;
      p.z=Math.random()*1.5+.2;
    }
  });
}

function _bgDrawGrid(ctx,W,H){
  _bgT+=3*bgZoneSpeed;
  ctx.fillStyle='rgba(4,8,12,.26)'; ctx.fillRect(0,0,W,H);
  var horizon=H*.42, vp={x:W/2,y:horizon};
  ctx.strokeStyle=_bgRgba(bgZC,.55); ctx.lineWidth=1;
  // Linhas verticais em perspectiva
  for(var i=-20;i<=20;i++){
    ctx.beginPath(); ctx.moveTo(vp.x,vp.y);
    ctx.lineTo(vp.x+i*60,H); ctx.stroke();
  }
  // Linhas horizontais animadas
  for(var j=0;j<16;j++){
    var yy=horizon+((j*55+_bgT)%(H-horizon));
    var sc=(yy-horizon)/(H-horizon);
    if(yy>horizon){
      ctx.globalAlpha=sc*.7;
      ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(W,yy); ctx.stroke();
      ctx.globalAlpha=1;
    }
  }
  // Brilho no horizonte
  var hg=ctx.createLinearGradient(0,horizon-30,0,horizon+30);
  hg.addColorStop(0,'rgba(0,0,0,0)');
  hg.addColorStop(.5,_bgRgba(bgZC,.25));
  hg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=hg; ctx.fillRect(0,horizon-30,W,60);
}

function _bgDrawHelix(ctx,W,H){
  _bgT+=.025*bgZoneSpeed;
  ctx.fillStyle='rgba(2,1,8,.20)'; ctx.fillRect(0,0,W,H);
  var cx=W/2, r=Math.min(W,H)*.22, steps=120;
  // Duas hélices opostas
  for(var strand=0;strand<2;strand++){
    var offset=strand*Math.PI;
    ctx.beginPath();
    for(var s=0;s<=steps;s++){
      var t=s/steps;
      var angle=t*Math.PI*6+_bgT+offset;
      var y=t*H;
      var x=cx+Math.cos(angle)*r*(1-t*.3);
      if(s===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=_bgRgba(bgZC, strand===0?.75:.45);
    ctx.lineWidth=strand===0?2.5:1.5;
    ctx.shadowBlur=strand===0?18:8;
    ctx.shadowColor=bgZC;
    ctx.stroke(); ctx.shadowBlur=0;
  }
  // Pontos de conexão entre as hélices
  for(var n=0;n<12;n++){
    var tt=n/12;
    var ang=tt*Math.PI*6+_bgT;
    var yy=tt*H;
    var x1=cx+Math.cos(ang)*r*(1-tt*.3);
    var x2=cx+Math.cos(ang+Math.PI)*r*(1-tt*.3);
    ctx.beginPath(); ctx.moveTo(x1,yy); ctx.lineTo(x2,yy);
    ctx.strokeStyle=_bgRgba(bgZC,.3); ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.arc(x1,yy,3,0,Math.PI*2);
    ctx.fillStyle=bgZC; ctx.globalAlpha=.8; ctx.fill(); ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(x2,yy,3,0,Math.PI*2);
    ctx.fillStyle=bgZC; ctx.globalAlpha=.8; ctx.fill(); ctx.globalAlpha=1;
  }
}

// ── PICKER — sistema de duas linhas navegáveis por controlo ──
var _bgSection      = 0;    // 0=linha música/vídeo, 1=linha fundo/cenário
var _bgMVSel        = 0;    // 0=card música activo, 1=card vídeo activo (dentro de section 0)
var _bgFundoIdx     = 0;    // card seleccionado na linha FUNDO
var _bgFundoItems   = [];   // [{key,name,icon,color}]
var _bgSelMusicItem = null; // {key,name,handle} ou null = sem música
var _bgSelVideoItem = null; // {key,name,handle} ou null = sem vídeo
var _bgFoco = 'musica';     // foco atual do fluxo: 'musica' | 'video' | 'fundo' | 'iniciar'
// legacy — mantidos para _bgRenderRow de itens de fundo
var _bgMusicIdx   = 0;
var _bgMusicItems = [];

// Scan async do pendrive para listar ficheiros vídeo e música
var _bgVideoFiles=[];  // ficheiros de vídeo do pendrive (carregados sob demanda)
var _bgMusicFiles=[];  // ficheiros de música do pendrive (carregados sob demanda)

// Liga ao pendrive (se disponível) e abre a sub-lista de vídeo ou música
async function _bgLigarPendriveEAbrir(tipo){
  // 1. Se usbDir já está ligado, só re-escanear
  if(usbDir){
    await _bgScanPendrive();
    var files = tipo==='video' ? _bgVideoFiles : _bgMusicFiles;
    if(files.length>0){ _bgAbrirSubLista(tipo); return; }
    _bgMostrarAviso('Nenhum '+(tipo==='video'?'vídeo':'música')+' encontrado na pasta do pendrive.');
    return;
  }
  // 2. Tentar handle guardado no IndexedDB
  var saved=await _idbLoad();
  if(saved){
    try{
      var state=await saved.queryPermission({mode:'read'});
      var perm = state==='granted' ? 'granted' : await saved.requestPermission({mode:'read'});
      if(perm==='granted'){
        usbDir=saved; pendrive=true;
        usbSubs={};
        try{usbSubs.videos=await saved.getDirectoryHandle('videos',{create:false});}catch(e){}
        try{usbSubs.musicas=await saved.getDirectoryHandle('musicas',{create:false});}catch(e){}
        try{if(!usbSubs.videos)usbSubs.videos=await saved.getDirectoryHandle('video',{create:false});}catch(e){}
        usbAllDirs = await _prTodasAsPastas(saved,0);   // varre tudo, nao so 'videos'/'musicas'
        await _bgScanPendrive();
        var files2 = tipo==='video' ? _bgVideoFiles : _bgMusicFiles;
        if(files2.length>0){ _bgAbrirSubLista(tipo); return; }
        _bgMostrarAviso('Nenhum '+(tipo==='video'?'vídeo':'música')+' encontrado no pendrive.');
        return;
      }
    }catch(e){}
  }
  // 3. Sem handle — mostrar aviso com botão para conectar
  _bgMostrarAvisoConectar(tipo);
}

function _bgMostrarAvisoConectar(tipo){
  var old=document.getElementById('bgAviso');if(old)old.remove();
  var av=document.createElement('div');
  av.id='bgAviso';
  av.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:30000;'
    +'background:#1a1a2e;border:1px solid rgba(255,255,255,.15);border-radius:16px;'
    +'padding:32px 40px;text-align:center;color:#fff;font-family:Barlow Condensed,sans-serif;min-width:320px;';
  av.innerHTML='<div style="font-size:28px;margin-bottom:12px;">💾</div>'
    +'<div style="font-size:16px;font-weight:700;letter-spacing:1px;margin-bottom:8px;">PENDRIVE NÃO LIGADO</div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:24px;">Ligue o pendrive e clique em Conectar</div>'
    +'<button id="bgAvisoBtnConectar" style="padding:12px 28px;border-radius:10px;background:linear-gradient(135deg,#295fe8,#5b3de8);border:none;color:#fff;font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px;cursor:pointer;margin-bottom:10px;display:block;width:100%;">CONECTAR PENDRIVE</button>'
    +'<button onclick="document.getElementById(\'bgAviso\').remove();" style="padding:8px 20px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.4);font-size:12px;cursor:pointer;width:100%;">Fechar</button>';
  document.body.appendChild(av);
  document.getElementById('bgAvisoBtnConectar').addEventListener('click',async function(){
    av.remove();
    try{
      var root=await window.showDirectoryPicker({mode:'read'});
      var dir=root;
      try{dir=await root.getDirectoryHandle('ProRider',{create:false});}catch(e){}
      await _idbSave(dir);
      usbDir=dir; pendrive=true;
      usbSubs={};
      try{usbSubs.videos=await dir.getDirectoryHandle('videos',{create:false});}catch(e){}
      try{usbSubs.musicas=await dir.getDirectoryHandle('musicas',{create:false});}catch(e){}
      try{if(!usbSubs.videos)usbSubs.videos=await dir.getDirectoryHandle('video',{create:false});}catch(e){}
      await _bgScanPendrive();
      var files = tipo==='video' ? _bgVideoFiles : _bgMusicFiles;
      if(files.length>0){ _bgAbrirSubLista(tipo); return; }
      _bgMostrarAviso('Nenhum '+(tipo==='video'?'vídeo':'música')+' encontrado no pendrive.');
    }catch(e){}
  });
}

// ── PENDRIVE PELO SERVIDOR LOCAL ───────────────────────────────────
// O servidor local (Node) varre as unidades do Windows e acha a pasta ProRider
// sozinho. Com isso os arquivos ganham um endereco FIXO (/midia?p=...) em vez
// do endereco temporario blob:, que morre quando a unidade e re-enumerada — a
// causa dos arquivos de 0 bytes e do ERR_REQUEST_RANGE_NOT_SATISFIABLE.
// Se o servidor nao responder (modo navegador puro), tudo segue como antes.
var _prPendriveNativo = null;   // {ok, raiz, videos[], musicas[], aulas[]}
async function _prBuscarPendriveNativo(){
  try{
    var r = await fetch('/pendrive', { cache:'no-store' });
    if(!r.ok) return null;
    var d = await r.json();
    if(!d || !d.ok) { console.log('[ProRider] servidor local nao achou pasta ProRider nas unidades.'); return null; }
    console.log('[ProRider] pendrive achado pelo servidor local: '+d.raiz
      +' ('+d.videos.length+' video(s), '+d.musicas.length+' musica(s), '+d.aulas.length+' aula(s)). '
      +'Sem escolha de pasta e sem endereco temporario.');
    return d;
  }catch(e){ return null; }
}

async function _bgScanPendrive(){
  // caminho nativo primeiro: se o servidor local achou o pendrive, usa-o
  _prPendriveNativo = await _prBuscarPendriveNativo();
  if(_prPendriveNativo){
    _bgVideoFiles = _prPendriveNativo.videos.map(function(v){
      return {key:'video',name:v.nome,icon:'\ud83d\udcf9',color:'#6b9eff',url:v.url};
    });
    _bgMusicFiles = _prPendriveNativo.musicas.map(function(m){
      return {key:'music',name:m.nome,icon:'\ud83c\udfb5',color:'#5db13d',url:m.url};
    });
    console.log('[ProRider] midia no pendrive: '+_bgVideoFiles.length+' video(s), '+_bgMusicFiles.length+' musica(s). (nativo)');
    return;
  }

  var VID=['.mp4','.mov','.avi','.webm','.mkv'];
  var MUS=['.mp3','.wav','.ogg','.aac','.m4a'];
  var vidSeen=new Set(), musSeen=new Set();
  _bgVideoFiles=[]; _bgMusicFiles=[];
  var dirs=(usbAllDirs&&usbAllDirs.length)?usbAllDirs
           :[usbDir,usbSubs&&usbSubs.videos,usbSubs&&usbSubs.musicas];
  for(var di=0;di<dirs.length;di++){
    var d=dirs[di]; if(!d) continue;
    try{
      for await(var e of d.values()){
        if(e.kind!=='file') continue;
        var nl=e.name.toLowerCase();
        if(!vidSeen.has(e.name)&&VID.some(function(x){return nl.endsWith(x);})){
          vidSeen.add(e.name);
          _bgVideoFiles.push({key:'video',name:e.name,icon:'📹',color:'#6b9eff',handle:e});
        }
        if(!musSeen.has(e.name)&&MUS.some(function(x){return nl.endsWith(x);})){
          musSeen.add(e.name);
          _bgMusicFiles.push({key:'music',name:e.name,icon:'🎵',color:'#5db13d',handle:e});
        }
      }
    }catch(ex){}
  }
  console.log('[ProRider] midia no pendrive: '+_bgVideoFiles.length+' video(s), '+_bgMusicFiles.length+' musica(s).');
  // Conferir cedo se os arquivos sao legiveis — mas NUNCA dentro do caminho
  // critico. Na 17/09r esta checagem era esperada com await: com a referencia
  // morta, a leitura fica pendurada sem responder e o CARREGAMENTO INTEIRO PARA.
  // Foi isso que travou o sistema. Agora ela roda solta, com limite de 3s, e o
  // resultado so vira aviso.
  (function(){
    try{
      var _amostra = (_bgVideoFiles[0] && _bgVideoFiles[0].handle) || (_bgMusicFiles[0] && _bgMusicFiles[0].handle) || null;
      if(!_amostra || !_amostra.getFile) return;
      var _resolvido = false;
      var _limite = setTimeout(function(){
        if(_resolvido) return; _resolvido = true;
        console.error('[ProRider] a leitura do pendrive nao respondeu em 3s. A autorizacao da pasta '
          + 'provavelmente esta velha — escolher a pasta do pendrive de novo.');
      }, 3000);
      _amostra.getFile().then(function(_af){
        if(_resolvido) return; _resolvido = true; clearTimeout(_limite);
        if(!_af || _af.size === 0){
          console.error('[ProRider] ATENCAO: os arquivos do pendrive estao vindo com 0 bytes. '
            + 'A autorizacao da pasta esta velha. Escolher a pasta do pendrive de novo ANTES de iniciar a aula.');
          try{ if(typeof _parToast==='function') _parToast('Pendrive ilegivel — escolher a pasta de novo'); }catch(e){}
        }
      }).catch(function(e){
        if(_resolvido) return; _resolvido = true; clearTimeout(_limite);
        console.warn('[ProRider] nao consegui conferir a leitura do pendrive:', e);
      });
    }catch(e){}
  })();
  if(!_bgMusicFiles.length) console.warn('[ProRider] nenhum MP3 encontrado. Pastas varridas:', dirs.length);
  // Ficheiros NÃO são adicionados ao carrossel — aparecem na sub-lista ao confirmar VÍDEO/MÚSICA
}

// Renderiza uma linha de cards num grid div
function _bgRenderRow(gridId, items, selIdx, active){
  var grid=document.getElementById(gridId);if(!grid)return;
  grid.innerHTML='';
  items.forEach(function(item,i){
    var sel=(i===selIdx);
    var card=document.createElement('div');
    var col=item.color||'rgba(255,255,255,.3)';
    card.style.cssText='flex-shrink:0;min-width:105px;max-width:145px;border-radius:12px;padding:13px 10px;'
      +'text-align:center;transition:all .18s;cursor:pointer;'
      +'border:2px solid '+(sel?col:'rgba(255,255,255,.1)')+';'
      +'background:'+(sel?'rgba('+_bgHexRgb(col)+',.22)':'rgba(255,255,255,.04)')+';'
      +'transform:'+(sel&&active?'scale(1.07)':'scale(1)')+';'
      +'box-shadow:'+(sel&&active?'0 0 16px '+col+', 0 0 32px '+col+'44':'none')+';'
      +'opacity:'+(active?'1':'.48')+';';
    var shortName=item.name.length>14?item.name.substring(0,12)+'…':item.name;
    card.innerHTML='<div style="font-size:20px;margin-bottom:6px;">'+item.icon+'</div>'
      +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;color:#fff;line-height:1.2;">'+shortName+'</div>'
      +'<div style="width:100%;height:2px;border-radius:1px;background:'+col+';margin-top:7px;opacity:'+(sel?'.9':'.4')+';"></div>';
    (function(idx,gid){card.onclick=function(){
      if(gid==='bgCardGrid'){_bgFundoIdx=idx;_bgSection=0;}
      else{_bgMusicIdx=idx;_bgSection=1;}
      _bgRenderAll();
    };})(i,gridId);
    grid.appendChild(card);
  });
  // scroll para o card seleccionado
  if(grid.children[selIdx]) grid.children[selIdx].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
}

// ── PREVIEW VIVO da nova tela CONFIGURAR AULA ──
var _bgPrevRAF=null,_bgPrevC=null,_bgPrevX=null;
function _bgFmt(s){s=Math.max(0,Math.round(s));var m=Math.floor(s/60),x=s%60;return (m<10?'0':'')+m+':'+(x<10?'0':'')+x;}
function _bgPrevStart(){
  _bgPrevC=document.getElementById('bgPrevCanvas'); if(!_bgPrevC) return;
  _bgPrevX=_bgPrevC.getContext('2d');
  _bgPrevC.width=_bgPrevC.clientWidth||640; _bgPrevC.height=_bgPrevC.clientHeight||360;
  if(_bgPrevRAF) cancelAnimationFrame(_bgPrevRAF);
  _bgPrevLoop();
}
function _bgVoltar(){ var bs=document.getElementById('bgPickerScreen'); if(bs)bs.style.display='none'; if(typeof universeStop==='function')universeStop(); if(usbList.length>0)mostrarUSB(); else mostrarEscolha(); }
function _bgPrevLoop(){
  var ps=document.getElementById('bgPickerScreen');
  if(!_bgPrevC||!_bgPrevX||!ps||ps.style.display==='none'){ _bgPrevRAF=null; return; }
  if(_bgPrevC.clientWidth && _bgPrevC.width!==_bgPrevC.clientWidth){ _bgPrevC.width=_bgPrevC.clientWidth; _bgPrevC.height=_bgPrevC.clientHeight; }
  var W=_bgPrevC.width,H=_bgPrevC.height;
  var fi=_bgFundoItems[_bgFundoIdx]||{key:'cosmos'};
  var key=fi.key;
  if(_bgFoco!=='fundo' && _bgSelVideoItem) key='video';
  try{
    if(key==='nebula') _bgDrawNebula(_bgPrevX,W,H);
    else if(key==='fire') _bgDrawFire(_bgPrevX,W,H);
    else if(key==='none'){ _bgPrevX.clearRect(0,0,W,H); _bgPrevX.fillStyle='#0a0c14'; _bgPrevX.fillRect(0,0,W,H); }
    else if(key==='camera'||key==='video'){
      _bgPrevX.clearRect(0,0,W,H);
      var g=_bgPrevX.createLinearGradient(0,0,W,H); g.addColorStop(0,'#10141f'); g.addColorStop(1,'#1a1012');
      _bgPrevX.fillStyle=g; _bgPrevX.fillRect(0,0,W,H);
      _bgPrevX.fillStyle='rgba(255,255,255,.22)'; _bgPrevX.textAlign='center';
      _bgPrevX.font='600 14px "Barlow Condensed",sans-serif';
      _bgPrevX.fillText(key==='camera'?'CÂMERA AO VIVO':'VÍDEO NA TELA',W/2,H/2);
    }
    else _bgDrawCosmos(_bgPrevX,W,H);
  }catch(e){}
  _bgPrevRAF=requestAnimationFrame(_bgPrevLoop);
}
function _bgPreviewRefresh(){
  var dim='rgba(255,255,255,.28)';
  var cm=document.getElementById('bgChipMus'); if(cm){ cm.textContent=_bgSelMusicItem?'OK':'—'; cm.style.color=_bgSelMusicItem?'#5db13d':dim; }
  var cv=document.getElementById('bgChipVid'); if(cv){ cv.textContent=_bgSelVideoItem?'OK':'—'; cv.style.color=_bgSelVideoItem?'#6b9eff':dim; }
  var fundoChosen=(_bgFundoIdx>0);
  var cc=document.getElementById('bgChipCen'); if(cc){ cc.textContent=fundoChosen?'OK':'—'; cc.style.color=fundoChosen?'#ea860c':dim; }
  var ZCp={z1:'#a1a1a1',z2:'#295fe8',z3:'#5db13d',z4:'#d7c414',z5:'#ea860c',z6:'#d62d2d',z7:'#9b30ff'};
  var Hp={z1:18,z2:34,z3:50,z4:66,z5:82,z6:96,z7:100};
  var zn={z1:'Recovery',z2:'Endurance',z3:'Tempo',z4:'Threshold',z5:'VO2 Max',z6:'Anaerobic',z7:'Neuromuscular'};
  var wo=(typeof workout!=='undefined'&&workout&&workout.length)?workout:null;
  var bars=document.getElementById('bgPrevBars'), head=document.getElementById('bgPrevBloco');
  var seg=document.getElementById('bgPrevSeg'), tt=document.getElementById('bgPrevTot');
  if(wo){
    var tot=wo.reduce(function(a,b){return a+(b.duration||0);},0)||1, h='';
    wo.forEach(function(b){var zk=(typeof toZKey==='function'?toZKey(b.intensity):b.intensity)||'z1';var c=ZCp[zk]||'#888';var hh=Hp[zk]||14;var fl=Math.max(3,Math.round(((b.duration||1)/tot)*200));h+='<div style="flex:'+fl+';height:'+hh+'%;border-radius:3px 3px 0 0;background:'+c+';opacity:.9;"></div>';});
    if(bars) bars.innerHTML=h;
    var b0=wo[0], zk0=(typeof toZKey==='function'?toZKey(b0.intensity):b0.intensity)||'z1', c0=ZCp[zk0]||'#ea860c';
    if(head) head.innerHTML='<div><div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.28);text-transform:uppercase;">Bloco atual</div><div style="font-weight:900;font-size:20px;line-height:1;color:'+c0+';">'+(zn[zk0]||zk0)+'</div></div>'
      +'<div style="text-align:right;"><div style="font-weight:900;font-size:20px;line-height:1;color:'+c0+';">'+(b0.ftpMin||60)+'–'+(b0.ftpMax||89)+'<span style="font-size:60%;color:rgba(255,255,255,.45);">%</span></div><div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.28);">'+(b0.rpmMin||80)+'–'+(b0.rpmMax||90)+' rpm</div></div>';
    if(seg) seg.textContent=_bgFmt(_prSec(wo[0]));
    if(tt) tt.textContent=_bgFmt(tot*60);
  } else {
    if(bars) bars.innerHTML=''; if(head) head.innerHTML='';
    if(seg) seg.textContent='--:--'; if(tt) tt.textContent='--:--';
  }
}

function _bgRenderAll(){
  var videoChosen=!!_bgSelVideoItem;
  var fundoChosen=(_bgFundoIdx>0); // idx 0 = SEM FUNDO
  // ── Card MÚSICA ──
  var mc=document.getElementById('bgMusicCard');
  var mn=document.getElementById('bgMusicSelName');
  var ms=document.getElementById('bgMusicSelSub');
  var activeMus=(_bgFoco==='musica');
  if(mn) mn.textContent=_bgSelMusicItem?_bgSelMusicItem.name:'SEM MÚSICA';
  if(ms) ms.textContent=_bgSelMusicItem?'✓ selecionada · START para trocar':'START para escolher (ou pule)';
  if(mc){
    mc.style.borderColor=activeMus?'#5db13d':'rgba(93,177,61,.25)';
    mc.style.background=activeMus?'rgba(93,177,61,.18)':'rgba(93,177,61,.06)';
    mc.style.boxShadow=activeMus?'0 0 16px rgba(93,177,61,.25)':'none';
    mc.style.transform=activeMus?'scale(1.02)':'scale(1)';
    mc.style.opacity='1';
  }
  // ── Card VÍDEO ── (apaga se houver fundo escolhido)
  var vc=document.getElementById('bgVideoCard');
  var vn=document.getElementById('bgVideoSelName');
  var vs=document.getElementById('bgVideoSelSub');
  var activeVid=(_bgFoco==='video');
  if(vn) vn.textContent=_bgSelVideoItem?_bgSelVideoItem.name:'SEM VÍDEO';
  if(vs) vs.textContent=fundoChosen?'desativado — você escolheu fundo':(_bgSelVideoItem?'✓ selecionado · START para trocar':'START para escolher (ou pule)');
  if(vc){
    vc.style.borderColor=activeVid?'#6b9eff':'rgba(107,158,255,.25)';
    vc.style.background=activeVid?'rgba(107,158,255,.18)':'rgba(107,158,255,.06)';
    vc.style.boxShadow=activeVid?'0 0 16px rgba(107,158,255,.25)':'none';
    vc.style.transform=activeVid?'scale(1.02)':'scale(1)';
    vc.style.opacity=fundoChosen?'.32':'1';
  }
  // ── Linha FUNDO/CENÁRIO ── (apaga se houver vídeo escolhido)
  _bgRenderRow('bgCardGrid', _bgFundoItems, _bgFundoIdx, _bgFoco==='fundo');
  var grid=document.getElementById('bgCardGrid');
  if(grid) grid.style.opacity=videoChosen?'.32':'1';
  // Labels
  var lmv=document.getElementById('bgSecMVLabel');
  var lf=document.getElementById('bgSecFundoLabel');
  if(lmv) lmv.style.color=(_bgFoco==='musica'||_bgFoco==='video')?'#ea860c':'rgba(255,255,255,.35)';
  if(lf)  lf.style.color=_bgFoco==='fundo'?'#ea860c':(videoChosen?'#d05a3a':'rgba(255,255,255,.35)');
  if(lf){
    lf.innerHTML='<span style="opacity:.5;">🎬 FUNDO / CENÁRIO</span>'+(videoChosen?' <span style="color:#d05a3a;">· desativado: você escolheu vídeo</span>':' <span style="opacity:.5;">· ←→ navegar · START escolher</span>');
  }
  // ── Botão INICIAR (destaque quando em foco) ──
  var ib=document.getElementById('bgIniciarBtn');
  if(ib){
    var act=(_bgFoco==='iniciar');
    ib.style.background=act?'linear-gradient(180deg,#f5c542,#d97708)':'rgba(234,134,12,.10)';
    ib.style.color=act?'#1a1206':'#ea860c';
    ib.style.borderColor=act?'#e8a020':'rgba(234,134,12,.28)';
    ib.style.transform=act?'scale(1.01)':'scale(1)';
  }
  // ── Resumo "VAI APARECER" ──
  var fi2=_bgFundoItems[_bgFundoIdx]||{key:'none',name:'SEM FUNDO'};
  var rMus=document.getElementById('bgResMus');
  var rVid=document.getElementById('bgResVid');
  var rFun=document.getElementById('bgResFun');
  if(rMus){ rMus.innerHTML='🎵 '+(_bgSelMusicItem?'Música ✓':'Sem música'); rMus.style.color=_bgSelMusicItem?'#7ed95c':'#55555f'; }
  if(rVid){ rVid.innerHTML='📹 '+(_bgSelVideoItem?'Vídeo ✓':'Sem vídeo'); rVid.style.color=_bgSelVideoItem?'#9cc0ff':'#55555f'; }
  if(rFun){ rFun.innerHTML='🎬 '+(fundoChosen?(fi2.name):'Sem fundo'); rFun.style.color=fundoChosen?'#e0c060':'#55555f'; }
  // Preview label (cabeçalho)
  var pl=document.getElementById('bgPreviewLabel');
  if(pl){
    var parts=[];
    if(_bgSelMusicItem) parts.push('🎵 '+_bgSelMusicItem.name);
    if(_bgSelVideoItem) parts.push('📹 '+_bgSelVideoItem.name);
    else if(fundoChosen) parts.push('🎬 '+fi2.name);
    pl.textContent=parts.join('  ·  ')||'NADA SELECIONADO AINDA';
  }
  // Canvas de preview do fundo: ao navegar os cenários, o fundo muda pra mostrar o selecionado
  var _previewFundo=(_bgFoco==='fundo')||!videoChosen;
  if(_previewFundo && fi2.key!=='none' && fi2.key!=='video' && fi2.key!=='camera'){
    bgActiveMode=fi2.key; bgZC=fi2.color||'#295fe8';
  } else {
    bgActiveMode='cosmos'; bgZC='#295fe8';
  }
  _bgT=0; _bgBolts=[]; bgZoneSpeed=0.85;
  _bgPreviewRefresh();
}

function _bgToggleSection(){
  _bgSection=_bgSection===0?1:0;
  _bgRenderAll();
}

// ── NOVO FLUXO (tecla única START): foco em música → vídeo → fundo → iniciar ──
var _BG_ORDEM=['musica','video','fundo','iniciar'];
function _bgMover(dir){
  // No fundo, ←→ navega entre os cenários; nos outros, ←→ anda no fluxo
  if(_bgFoco==='fundo' && (dir==='left'||dir==='right')){
    var d=(dir==='right')?1:-1;
    _bgFundoIdx=(_bgFundoIdx+d+_bgFundoItems.length)%_bgFundoItems.length;
    _bgRenderAll(); return;
  }
  var avancar=(dir==='down'||dir==='right');
  var i=_BG_ORDEM.indexOf(_bgFoco);
  i=Math.max(0,Math.min(_BG_ORDEM.length-1,i+(avancar?1:-1)));
  _bgFoco=_BG_ORDEM[i];
  _bgRenderAll();
}
// START faz tudo: escolher / confirmar / avançar — conforme o foco
function _bgStart(){
  if(_bgFoco==='musica'){ bgSelecionarMV('music'); return; }   // abre pendrive; ao escolher avança p/ vídeo
  if(_bgFoco==='video'){  bgSelecionarMV('video'); return; }   // abre pendrive; ao escolher corta fundo e vai p/ iniciar
  if(_bgFoco==='fundo'){
    // confirma o cenário em foco; se for um fundo real, corta o vídeo
    var fi=_bgFundoItems[_bgFundoIdx]||{key:'none'};
    if(fi.key!=='none'){ _bgSelVideoItem=null; } // exclusividade: fundo escolhido apaga vídeo
    _bgFoco='iniciar'; _bgRenderAll(); return;
  }
  if(_bgFoco==='iniciar'){ _bgSection=1; bgConfirmar(); return; } // aplica tudo e vai pra tela de QR
}

function bgNavegar(d){
  // compat: mantém ←→ via novo modelo
  _bgMover(d>0?'right':'left');
}

// Abre o picker de pendrive para música ou vídeo (chamado pelo click no card ou pelo A no gamepad)
async function bgSelecionarMV(tipo){
  if(tipo==='music'){
    if(_bgMusicFiles.length>0){ _bgAbrirSubLista('music'); return; }
    await _bgLigarPendriveEAbrir('music');
  } else {
    if(_bgVideoFiles.length>0){ _bgAbrirSubLista('video'); return; }
    await _bgLigarPendriveEAbrir('video');
  }
}

async function abrirBgPicker(d,vc,mc){
  _fecharTodasTelas('bgPickerScreen');
  _bgPickerData={d:d,vc:vc,mc:mc};
  _bgSection=0; _bgFundoIdx=0; _bgMusicIdx=0;
  _bgFoco='musica'; // novo fluxo: começa na música

  // Inicializar selecções de música e vídeo
  _bgSelMusicItem=null; _bgSelVideoItem=null; _bgMVSel=0;

  // Construir items de FUNDO (cenários animados + câmera; SEM vídeo — vídeo é card próprio)
  _bgFundoItems=[{key:'none',name:'SEM FUNDO',icon:'—',color:'rgba(255,255,255,.3)'}];
  BG_MODES.forEach(function(bg){ _bgFundoItems.push({key:bg.key,name:bg.name,icon:bg.icon,color:bg.color}); });

  // Scan pendrive para listar ficheiros de música e vídeo
  await _bgScanPendrive();

  // Se vídeo já foi pré-carregado do .prorider (vc.ok), pré-selecciona o card de vídeo
  if(vc&&vc.ok&&typeof videoObjectUrl!=='undefined'&&videoObjectUrl){
    _bgSelVideoItem={key:'video_preload',name:(vc.msg||'Vídeo').split('/').pop()};
  }
  // Se música já foi pré-carregada (mc.ok), pré-selecciona o card de música
  if(mc&&mc.ok&&typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl){
    _bgSelMusicItem={key:'music_preload',name:(mc.msg||'Música').split('/').pop()};
  }

  bgActiveMode='cosmos'; bgZC='#295fe8'; bgZoneSpeed=0.85;
  _bgT=0; _bgBolts=[];
  if(uA){cancelAnimationFrame(uA);uA=null;}
  if(!uC) universeInit();
  if(uC){ uC.style.display='block'; universeResize(); universeMakeP(); }
  var s=document.getElementById('bgPickerScreen');if(s)s.style.display='flex';
  boxMode='bgPicker';
  _bgPrevStart();
  _bgRenderAll();
}

async function bgConfirmar(){
  var fi=_bgFundoItems[_bgFundoIdx]||{key:'none'};
  // Se cursor está na linha música/vídeo (section 0): A abre o picker do card activo
  if(_bgSection===0){
    bgSelecionarMV(_bgMVSel===0?'music':'video');
    return;
  }

  // ── Section 1: confirmar fundo ─────────────────
  var s=document.getElementById('bgPickerScreen');if(s)s.style.display='none';

  // Aplicar MÚSICA (se escolhida via picker)
  var mi=_bgSelMusicItem;
  if(!mi){
    // sem música
    if(typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl){URL.revokeObjectURL(mp3ObjectUrl);mp3ObjectUrl='';}
    if(typeof mp3Duration!=='undefined')mp3Duration=0;
    if(typeof mp3EndPoint!=='undefined')mp3EndPoint=0;
  } else if(mi.handle){
    try{
      var mf=await mi.handle.getFile();
      if(typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl)URL.revokeObjectURL(mp3ObjectUrl);
      if(typeof mp3ObjectUrl!=='undefined')mp3ObjectUrl=URL.createObjectURL(mf);
      var tmp2=new Audio(typeof mp3ObjectUrl!=='undefined'?mp3ObjectUrl:'');
      await new Promise(function(r){tmp2.onloadedmetadata=r;tmp2.onerror=r;});
      if(typeof mp3Duration!=='undefined')mp3Duration=tmp2.duration||0;
      if(typeof mp3EndPoint!=='undefined')mp3EndPoint=tmp2.duration||0;
    }catch(ex){}
  }
  // music_preload / music_pick_loaded → já está em mp3ObjectUrl, não faz nada

  // Aplicar VÍDEO (se escolhido via picker)
  var vi=_bgSelVideoItem;
  if(vi&&vi.handle){
    try{
      var vfx=await vi.handle.getFile();
      if(typeof videoObjectUrl!=='undefined'&&videoObjectUrl)URL.revokeObjectURL(videoObjectUrl);
      if(typeof videoObjectUrl!=='undefined')videoObjectUrl=URL.createObjectURL(vfx);
      if(typeof videoSource!=='undefined')videoSource='video';
      _preloadVideo(videoObjectUrl);
      // O ponto de chegada marcado no construtor vale mesmo quando o vídeo é
      // escolhido a mão aqui (o nome do arquivo no JSON pode não bater).
      var _offJ=0;
      try{ var _dj=_bgPickerData&&_bgPickerData.d; if(_dj&&_dj.video&&_dj.video.syncOffset){
             _offJ=Number(_dj.video.syncOffset)||0; if(_offJ>36000)_offJ=_offJ/1000; } }catch(e0){}
      await _prAplicarSyncVideo(videoObjectUrl, _offJ);
    }catch(ex){}
  } else if(vi&&vi.key==='video_preload'){
    if(typeof videoSource!=='undefined')videoSource='video';
    // revalida: se videoEndPoint ficou 0 (arquivo do JSON não foi achado antes), recalcula
    if(typeof videoEndPoint==='undefined' || !videoEndPoint){
      var _offP=0;
      try{ var _dp=_bgPickerData&&_bgPickerData.d; if(_dp&&_dp.video&&_dp.video.syncOffset){
             _offP=Number(_dp.video.syncOffset)||0; if(_offP>36000)_offP=_offP/1000; } }catch(e1){}
      await _prAplicarSyncVideo(videoObjectUrl, _offP);
    }
  }

  // Montar vc/mc reais para mostrarPreAula
  var vcReal={ok:false,msg:'--'};
  var mcReal={ok:false,msg:'--'};
  if(vi){ vcReal={ok:true,msg:vi.name||'Vídeo'}; }
  if(mi){ mcReal={ok:true,msg:mi.name||'Música'}; }

  // Aplicar FUNDO — vídeo tem prioridade: se há vídeo, canvas de fundo desliga-se
  if(fi.key==='camera'&&!vi){
    _bgIniciarCamera();
  } else {
    if(vi){
      // Vídeo selecionado: fundo animado desliga (canvas não pinta por cima do vídeo)
      bgActiveMode='none';
    } else if(fi.key!=='none'){
      // Fundo animado selecionado sem vídeo: video desligado
      bgActiveMode=fi.key;
      if(typeof videoSource!=='undefined')videoSource='none';
      if(typeof videoObjectUrl!=='undefined'&&videoObjectUrl){URL.revokeObjectURL(videoObjectUrl);videoObjectUrl='';}
      if(typeof videoEndPoint!=='undefined')videoEndPoint=0;
    } else {
      // Sem fundo e sem vídeo
      bgActiveMode='none';
      if(typeof videoSource!=='undefined')videoSource='none';
    }
    mostrarPreAula(_bgPickerData.d,vcReal,mcReal);
  }
}

function _bgMostrarAviso(msg){
  var old=document.getElementById('bgAviso');if(old)old.remove();
  var el=document.createElement('div');
  el.id='bgAviso';
  el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
    +'background:rgba(12,18,30,.97);border:1px solid rgba(255,255,255,.2);border-radius:12px;'
    +'padding:24px 32px;z-index:30000;text-align:center;color:rgba(255,255,255,.7);font-size:14px;line-height:1.6;'
    +'box-shadow:0 8px 40px rgba(0,0,0,.8);';
  el.innerHTML='<div style="font-size:28px;margin-bottom:12px;">⚠️</div>'
    +'<div>'+msg.replace('\n','<br>')+'</div>'
    +'<div style="margin-top:16px;font-size:11px;color:rgba(255,255,255,.3);">[A] ou [B] para fechar</div>';
  el.onclick=function(){el.remove();};
  document.body.appendChild(el);
  setTimeout(function(){if(document.getElementById('bgAviso'))el.remove();},2500);
}

// Sub-lista de vídeos/músicas do pendrive
var _bgSubListaTipo=null;
var _bgSubListaIdx=0;

function _bgAbrirSubLista(tipo){
  _bgSubListaTipo=tipo;
  _bgSubListaIdx=0;
  var files=tipo==='video'?_bgVideoFiles:_bgMusicFiles;
  var cor=tipo==='video'?'#6b9eff':'#5db13d';
  var titulo=tipo==='video'?'VÍDEOS':'MÚSICAS';

  var old=document.getElementById('bgSubLista');if(old)old.remove();
  // A janela e fixa na tela inteira. Se o utilizador mudar de tela com ela
  // aberta, ela ficava flutuando por cima da tela nova — era a "tela bugada".
  clearInterval(window._bgSubVigia);
  window._bgSubVigia=setInterval(function(){
    var j=document.getElementById('bgSubLista'); if(!j){ clearInterval(window._bgSubVigia); return; }
    // o cartao de musica so existe na tela de configurar a aula; se ele sumiu,
    // e porque saimos dessa tela e a janela nao tem mais onde ficar
    var dono=document.getElementById('bgMusicCard');
    var visivel = dono && dono.offsetParent !== null;
    if(!visivel){ j.remove(); clearInterval(window._bgSubVigia); }
  },400);
  var el=document.createElement('div');
  el.id='bgSubLista';
  el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
    +'background:rgba(8,6,16,.97);border:1px solid '+cor+';border-radius:14px;'
    +'padding:20px 24px;z-index:30000;min-width:340px;max-width:520px;max-height:75vh;overflow-y:auto;'
    +'box-shadow:0 8px 40px rgba(0,0,0,.8);';

  var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    +'<span style="color:#fff;font-weight:700;font-size:15px;letter-spacing:2px;">'+titulo+'</span>'
    +'<span style="color:rgba(255,255,255,.3);font-size:10px;">[A] Selecionar &nbsp; [B] Voltar</span>'
    +'</div>';

  if(files.length===0){
    html+='<div style="color:rgba(255,255,255,.4);font-size:13px;text-align:center;padding:20px 0;">Nenhum ficheiro encontrado no pendrive.</div>';
  } else {
    files.forEach(function(f,i){
      html+='<div class="bgSubItem" style="padding:11px 14px;margin-bottom:6px;border-radius:8px;cursor:pointer;'
        +'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);transition:background .15s;"'
        +' onclick="_bgSubListaSelecionar('+i+')">'
        +'<div style="color:#fff;font-size:13px;font-weight:600;">'+f.name+'</div>'
        +'</div>';
    });
  }

  el.innerHTML=html;
  document.body.appendChild(el);
  _bgSubListaFocar();
}

function _bgSubListaFocar(){
  var items=document.querySelectorAll('.bgSubItem');
  var cor=_bgSubListaTipo==='video'?'rgba(107,158,255,.4)':'rgba(93,177,61,.4)';
  var corBorder=_bgSubListaTipo==='video'?'#6b9eff':'#5db13d';
  items.forEach(function(el,i){
    el.style.background=i===_bgSubListaIdx?cor:'rgba(255,255,255,.05)';
    el.style.borderColor=i===_bgSubListaIdx?corBorder:'rgba(255,255,255,.1)';
  });
}

async function _bgSubListaSelecionar(idx){
  var files=_bgSubListaTipo==='video'?_bgVideoFiles:_bgMusicFiles;
  var f=files[idx]; if(!f) return;
  var old=document.getElementById('bgSubLista');if(old)old.remove();

  // ── ARQUIVO SERVIDO PELO SERVIDOR LOCAL ────────────────────────
  // Endereco FIXO (/midia?p=...), nao blob. Nao expira, nao depende de
  // permissao de pasta e aceita Range — acaba a classe de problema que deu
  // 0 bytes e ERR_REQUEST_RANGE_NOT_SATISFIABLE.
  if(f.url){
    if(_bgSubListaTipo==='video'){
      try{ if(typeof videoObjectUrl!=='undefined' && videoObjectUrl && videoObjectUrl.indexOf('blob:')===0) URL.revokeObjectURL(videoObjectUrl); }catch(e){}
      if(typeof videoObjectUrl!=='undefined') videoObjectUrl=f.url;
      if(typeof videoSource!=='undefined') videoSource='video';
      window._prVideoHandle=null;
      _bgSelVideoItem={key:'video_nativo',name:f.name,url:f.url};
      bgActiveMode='cosmos'; _bgFundoIdx=0; _bgFoco='iniciar';
      try{ _preloadVideo(videoObjectUrl); }catch(e){}
      console.log('[ProRider] video escolhido por endereco fixo: '+f.name);
    } else {
      try{ if(typeof mp3ObjectUrl!=='undefined' && mp3ObjectUrl && mp3ObjectUrl.indexOf('blob:')===0) URL.revokeObjectURL(mp3ObjectUrl); }catch(e){}
      if(typeof mp3ObjectUrl!=='undefined') mp3ObjectUrl=f.url;
      window._prMusicaHandle=null;
      _bgSelMusicItem={key:'music_nativo',name:f.name,url:f.url};
      _bgFoco='video';
      console.log('[ProRider] musica escolhida por endereco fixo: '+f.name);
      // duracao em segundo plano, sem travar a tela
      try{
        var _a=new Audio(f.url);
        _a.onloadedmetadata=function(){
          if(typeof mp3Duration!=='undefined') mp3Duration=_a.duration||0;
          if(typeof mp3EndPoint!=='undefined') mp3EndPoint=_a.duration||0;
          try{ _bgRenderAll(); }catch(e){}
        };
      }catch(e){}
    }
    _bgRenderAll();
    return;
  }

  if(_bgSubListaTipo==='video'){
    _bgSelVideoItem={key:'video_pick_loaded',name:f.name,handle:f.handle};
    bgActiveMode='cosmos';
    _bgFundoIdx=0;          // exclusividade: vídeo escolhido apaga o fundo
    _bgFoco='iniciar';      // avança automático pro botão INICIAR
    _bgRenderAll();
  } else {
    // ── A ESCOLHA VALE NA HORA ─────────────────────────────────
    // Antes, a escolha so era registrada DEPOIS de ler os metadados do mp3.
    // A janela fechava na hora e a tela seguia dizendo "SEM MUSICA" ate o
    // arquivo terminar de carregar do pendrive — e, se o evento de metadados
    // nao disparasse, nunca se fixava. Agora marca-se a escolha primeiro e a
    // duracao entra depois, quando chegar.
    _bgSelMusicItem={key:'music_pick_loaded',name:f.name,handle:f.handle};
    _bgFoco='video';        // avanca automatico pro video
    _bgRenderAll();

    (async function(){
      try{
        var mf=await f.handle.getFile();
        if(typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl)URL.revokeObjectURL(mp3ObjectUrl);
        if(typeof mp3ObjectUrl!=='undefined')mp3ObjectUrl=URL.createObjectURL(mf);
        var tmp=new Audio(mp3ObjectUrl||'');
        // com limite: metadado que nao chega em 8s nao trava mais a tela
        var okMeta=await new Promise(function(r){
          var fim=false;
          tmp.onloadedmetadata=function(){ if(!fim){fim=true;r(true);} };
          tmp.onerror        =function(){ if(!fim){fim=true;r(false);} };
          setTimeout(function(){ if(!fim){fim=true;r(false);} },8000);
        });
        if(okMeta){
          if(typeof mp3Duration!=='undefined')mp3Duration=tmp.duration||0;
          if(typeof mp3EndPoint!=='undefined')mp3EndPoint=tmp.duration||0;
        } else {
          console.warn('[ProRider] nao consegui ler a duracao de "'+f.name+'" — a musica toca, mas sem sincronia de fim.');
        }
        _bgRenderAll();
      }catch(ex){ console.warn('[ProRider] erro ao carregar a musica:', ex); }
    })();
  }
}

// (funções antigas substituídas pelo novo sistema acima)
function _bgIniciarCamera(){
  bgActiveMode='camera';
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    console.warn('[ProRider] Câmera não disponível');
    bgActiveMode='cosmos';
    mostrarPreAula(_bgPickerData.d,_bgPickerData.vc,_bgPickerData.mc);
    return;
  }
  // Tenta câmera traseira primeiro (conectada ao Mini PC), fallback para qualquer câmera
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
    .catch(function(){ return navigator.mediaDevices.getUserMedia({video:true,audio:false}); })
    .then(function(stream){
      cameraStream=stream;
      if(typeof cameraLive!=='undefined'&&cameraLive){
        cameraLive.srcObject=stream;
        cameraLive.style.display='block'; // CSS já define: absolute, inset:0, cover, z-index:0
        cameraLive.play().catch(function(){});
      }
      mostrarPreAula(_bgPickerData.d,_bgPickerData.vc,_bgPickerData.mc);
    })
    .catch(function(err){
      console.error('[ProRider] Câmera erro:',err);
      bgActiveMode='cosmos';
      mostrarPreAula(_bgPickerData.d,_bgPickerData.vc,_bgPickerData.mc);
    });
}

function bgPularPicker(){
  // Pular = sem fundo (cosmos), sem música
  bgActiveMode='cosmos';
  if(typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl){URL.revokeObjectURL(mp3ObjectUrl);mp3ObjectUrl='';}
  if(typeof mp3Duration!=='undefined')mp3Duration=0;
  if(typeof mp3EndPoint!=='undefined')mp3EndPoint=0;
  var s=document.getElementById('bgPickerScreen');if(s)s.style.display='none';
  mostrarPreAula(_bgPickerData.d,_bgPickerData.vc,_bgPickerData.mc);
}

function atualizarDurDisplay(){
  var el=document.getElementById('duration');
  var v=Math.max(1,parseInt(el.value)||1);
  el.value=v;
  var disp=document.getElementById('durDisplay');
  if(disp){var m=Math.floor(v/60),s=v%60;disp.textContent=m+':'+(s<10?'0':'')+s;}
}
function adjRpm(id,d){
  var el=document.getElementById(id);
  var v=parseInt(el.value)||0;
  el.value=Math.max(1,v+d);
}
function adjDur(d){
  var el=document.getElementById('duration');
  var v=parseInt(el.value)||0;
  el.value=Math.max(1,v+d);
  atualizarDurDisplay();
}

function bgEscolherVideo(input){} // legacy — mantido para compatibilidade

function bgParar(){ universeStop(); }

// ============================================================
// PRE-AULA
// ============================================================
function _renderPreAlunos(){
  var list=document.getElementById('preAulaAlunos'); if(!list)return;
  list.style.overflowY='auto';list.style.overflowX='hidden';
  var al=(typeof alunosMap!=='undefined')?alunosMap:{};
  var ns=Object.keys(al);
  var c1=document.getElementById('preAulaConect'); if(c1)c1.textContent=ns.length+(ns.length===1?' aluno':' alunos');
  var c2=document.getElementById('preAulaConect2'); if(c2)c2.textContent=ns.length;
  if(!ns.length){ list.innerHTML='<div style="text-align:center;padding:30px;color:rgba(255,255,255,.25);font-size:14px;">Aguardando alunos\u2026</div>'; return; }
  var pal=['#ea860c','#2fb0d8','#9b30ff','#e6c020','#d62d2d','#5db13d','#e0559e','#2f6bff'];
  // TODOS OS CONECTADOS TEM DE CABER — 16 conectados, 16 na tela.
  // Em vez de aceitar o numero de colunas que o CSS escolher e rolar o resto,
  // aqui se calcula quantas linhas cabem na altura disponivel e, a partir
  // disso, quantas colunas sao necessarias para nao sobrar ninguem.
  var _grid=document.getElementById('preAulaAlunos');
  var _colsCss=1;
  try{
    var _cs=getComputedStyle(_grid).gridTemplateColumns;
    if(_cs) _colsCss=Math.max(1,_cs.split(' ').filter(function(x){return x&&x!=='none';}).length);
  }catch(e){}

  // altura de uma linha em cada nivel de densidade: padY x2 + altura do avatar
  // Alturas reais de linha em cada nivel (padY*2 + avatar + folga), agora que a
  // foto e o nome sao maiores. Sem isto o calculo achava que cabiam mais linhas
  // do que cabem e a lista transbordava sem aviso.
  var _niveis=[{d:0,h:12*2+58+10},{d:1,h:9*2+50+8},{d:2,h:7*2+42+8}];
  var _alt=0; try{ _alt=_grid.clientHeight||0; }catch(e){}

  // Se a altura ainda nao existe (o painel nao foi desenhado quando esta funcao
  // roda), NAO da para calcular nada: forcar uma coluna aqui era o que deixava
  // a lista em coluna unica com metade dos alunos escondidos — e, sem barra de
  // rolagem, o corte fica invisivel. Nesse caso deixa o CSS decidir e repete a
  // montagem no proximo quadro, quando a altura ja existe.
  if(_alt<=0){
    try{ _grid.style.gridTemplateColumns=''; }catch(e){}
    if(!_preAulaRemedida){
      _preAulaRemedida=true;
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ _preAulaRemedida=false; try{ preAulaRenderAlunos(); }catch(e){} });
      });
    }
  }

  var dense=0, _cols=_colsCss;
  if(_alt>0){
    for(var _i=0;_i<_niveis.length;_i++){
      var _linhas=Math.max(1,Math.floor(_alt/_niveis[_i].h));
      var _prec=Math.ceil(ns.length/_linhas);      // colunas necessarias
      dense=_niveis[_i].d;
      if(_prec<=_colsCss){ _cols=Math.max(1,_prec); break; }
      _cols=_colsCss;                               // ainda nao coube: aperta mais
    }
    try{ _grid.style.gridTemplateColumns='repeat('+_cols+',minmax(0,1fr))'; }catch(e){}
  }
  // A foto e o nome sao o que o professor precisa reconhecer de longe, entao
  // eles mandam no tamanho. Os numeros ficam abaixo do nome, nao ao lado —
  // assim somem o vao morto entre o nome e os watts, e sobra largura.
  var padY = dense===2?7:(dense===1?9:12);
  var fs   = dense===2?15:(dense===1?16:18);
  var av   = dense===2?42:(dense===1?50:58);
  list.innerHTML=ns.map(function(n,i){
    var a=al[n]||{}; var rpm=a.rpm||0, w=a.watts||0;
    var stale=a._bledSrc && ((Date.now()-(a._lastSeen||0))>GYM_BIKE_STALE_MS);
    var on=rpm>0 && !stale;
    var dot=stale?'#6a7080':(on?'#5db13d':'#7ea6ff');
    var ini=String(n).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    var col=pal[i%pal.length];
    var avStyle=a.foto?('background-image:url(\''+a.foto+'\');background-size:cover;'):('color:'+col+';border:2px solid '+col+'66;background:'+col+'1e;');
    var avtxt=a.foto?'':ini;
    var fc=_hrDe(a);   // 26/09d: bike ou celular
    var wkg=(a.peso&&w)?((w/a.peso).toFixed(1)+' W/kg'):(w+' W');
    return '<div style="display:flex;align-items:center;gap:13px;min-width:0;padding:'+padY+'px 12px;border-bottom:1px solid rgba(255,255,255,.07);">'
      +'<div style="width:'+av+'px;height:'+av+'px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:'+(fs-1)+'px;position:relative;'+avStyle+'">'+avtxt
        +'<span style="position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;border:2px solid #05070d;background:'+dot+';"></span></div>'
      // min-width:0 e obrigatorio: sem ele um item flex NAO encolhe abaixo do
      // proprio conteudo (min-width:auto e o padrao). Nomes longos empurravam a
      // coluna de watts para fora do painel e ela sumia na borda direita.
      +'<div style="flex:1 1 auto;min-width:0;">'
        +'<div style="font-size:'+fs+'px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;">'+n
          +(a._demo?' <span style="font-size:9px;font-weight:700;letter-spacing:1.5px;color:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.18);border-radius:4px;padding:1px 4px;vertical-align:middle;">DEMO</span>':'')
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:9px;margin-top:3px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:'+(fs-3)+'px;">'
          +(fc?('<span style="color:#d62d2d;">&#9829; '+fc+'</span>'):'')
          +'<span style="color:'+(on?'rgba(255,255,255,.75)':'rgba(255,255,255,.3)')+';">'+wkg+'</span>'
        +'</div>'
      +'</div>'
      +'</div>';
  }).join('');
}
function _fitAlunosGrid(){
  var grid=document.getElementById('preAulaAlunos'); if(!grid) return;
  var cards=grid.querySelectorAll('.pa-st'); var n=cards.length;
  if(!n){ grid.classList.remove('pa-tight','pa-tight2'); return; }
  var cols=2, gap=6, rows=Math.ceil(n/cols);
  var h=grid.clientHeight||0; if(h<40) return; // layout ainda nao pronto (timer reaplica)
  var rowH=Math.floor((h-(rows-1)*gap)/rows); rowH=Math.max(28,rowH);
  grid.classList.toggle('pa-tight', rowH<48);
  grid.classList.toggle('pa-tight2', rowH<37);
  for(var i=0;i<cards.length;i++){ cards[i].style.height=rowH+'px'; }
}
// 23/09b: na coluna 3 do lobby o cartao AULA SELECIONADA encolhia abaixo do
// proprio conteudo e as linhas de Musica e Status da sala saiam por baixo,
// por cima do PERFIL DA AULA. Quem cede altura agora e o QR do browser: ele
// diminui ate o cartao caber (piso de 110px, ainda legivel a 2 m).
// 26/09b: substituido por CSS em ginasio.html (.pb-sel / .pb-brw). Mantido vazio
// para nao quebrar chamadas antigas.
function _fitPreAulaCol3(){}
// ── 07/10d: DIAGNÓSTICO DA SALA (secreto) — na tela do QR, LB+RB 2 s abre; B fecha ──
var _diag={on:false,t:null,ped:0,hold:0};
function _diagHold(lb,rb){ if(lb&&rb){ if(!_diag.hold)_diag.hold=Date.now(); if(!_diag.on&&Date.now()-_diag.hold>=2000){ _diag.hold=0; diagAbrir(); } return true; } _diag.hold=0; return false; }
function diagAbrir(){
  if(_diag.on) return; _diag.on=true; window._diagCel=null;
  var el=document.getElementById('diagSala'); if(!el){ el=document.createElement('div'); el.id='diagSala'; document.body.appendChild(el); }
  el.style.display='flex'; _diag.ped=0; _diagTick(); _diag.t=setInterval(_diagTick,1000);
}
function diagFechar(){ _diag.on=false; clearInterval(_diag.t); _diag.t=null; var el=document.getElementById('diagSala'); if(el) el.style.display='none'; }
function _diagEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _diagTick(){
  if(!_diag.on) return;
  if(typeof boxMode!=='undefined' && boxMode!=='preAula'){ diagFechar(); return; }
  var agora=Date.now(), ws=(typeof wsProf!=='undefined')?wsProf:null;
  if(ws && ws.readyState===1 && agora-_diag.ped>=3000){ _diag.ped=agora; try{ ws.send(JSON.stringify({tipo:'diag_pedir'})); }catch(e){} }
  // bikes
  var bk=[], ok=0;
  Object.keys(parBikeMap||{}).forEach(function(n){ var b=parBikeMap[n]; if(!b||!b.mac) return;
    var dt=b._diagT0?(agora-b._diagT0)/1000:0, pps=dt>0?((b._diagN||0)-(b._diagN0||0))/dt:0; b._diagT0=agora; b._diagN0=b._diagN||0;
    var vis=b._lastSeen?agora-b._lastSeen:Infinity, r=b.rssi||0, cl, tx, nv;
    if(vis>10000){ cl='x'; nv=0; tx=b._lastSeen?'sem sinal há '+(vis<120000?Math.round(vis/1000)+' s':Math.round(vis/60000)+' min'):'sem sinal'; }
    else { nv=r>=-60?4:r>=-70?3:r>=-80?2:1; cl=nv<=1?'f':''; tx=(r?r+' dBm':'—')+' · '+(cl?'fraco':(pps>0?Math.round(pps)+'/s':'ok')); if(!cl) ok++; }
    var sig=''; for(var i=1;i<=4;i++) sig+='<i class="'+(i<=nv?'on':'')+'" style="height:'+(1+i*5)+'px"></i>';
    bk.push({n:+n,h:'<div class="dg-b '+cl+'"><div class="dg-num">'+(+n===99?'P':n)+'</div><div class="dg-sig">'+sig+'</div><div class="dg-t'+(cl==='x'?' er':'')+'">'+tx+'</div></div>'});
  });
  bk.sort(function(a,b){return a.n-b.n;});
  // celulares
  var cel=window._diagCel, ch='', soma=0, nms=0;
  if(!cel) ch='<div class="dg-vazio">'+(ws&&ws.readyState===1?'medindo…':'sem conexão com o servidor')+'</div>';
  else if(!cel.length) ch='<div class="dg-vazio">nenhum celular conectado</div>';
  else {
    var ls=cel.map(function(c){ var ms=(c.aberto&&typeof c.ms==='number')?c.ms:null; if(ms!=null){soma+=ms;nms++;} return {c:c,ms:ms,p:ms==null?9e9:ms}; }).sort(function(a,b){return b.p-a.p;});
    var mostra=ls.length>9?ls.filter(function(x,i){return i<8;}):ls, resto=ls.slice(mostra.length);
    ch=mostra.map(function(x){ var k=x.ms==null?'er':x.ms<400?'ok':x.ms<1000?'wa':'er';
      return '<div class="dg-c"><span>'+_diagEsc(x.c.nome)+'</span><span class="dg-bk">'+(x.c.bike?'bike '+x.c.bike:'')+'</span><span class="dg-ms '+k+'">'+(x.ms==null?'sem resposta':x.ms+' ms')+'</span></div>'; }).join('');
    if(resto.length){ var mx=Math.max.apply(null,resto.map(function(x){return x.ms||0;})); ch+='<div class="dg-c"><span>+ '+resto.length+' celulares</span><span class="dg-bk"></span><span class="dg-ms">até '+mx+' ms</span></div>'; }
  }
  var med=nms?Math.round(soma/nms):null, net=ws&&ws.readyState===1&&(agora-(window._wsUltMsg||0))<30000;
  var el=document.getElementById('diagSala'); if(!el) return;
  el.innerHTML='<div class="dg-p"><div class="dg-top"><div><div class="dg-tit">DIAGNÓSTICO <b>DA SALA</b></div><div class="dg-sub">SÓ PARA MANUTENÇÃO · NÃO APARECE NA AULA</div></div>'+
    '<div class="dg-res"><div class="dg-chip"><div class="dg-n '+(bk.length&&ok===bk.length?'ok':'wa')+'">'+ok+'/'+bk.length+'</div><div class="dg-l">BIKES OK</div></div>'+
    '<div class="dg-chip"><div class="dg-n">'+(cel?cel.length:'–')+'</div><div class="dg-l">CELULARES</div></div>'+
    '<div class="dg-chip"><div class="dg-n '+(med==null?'':med<400?'ok':med<1000?'wa':'er')+'">'+(med==null?'–':med+' ms')+'</div><div class="dg-l">ATRASO MÉDIO</div></div>'+
    '<div class="dg-chip"><div class="dg-n '+(net?'ok':'er')+'">'+(net?'OK':'SEM')+'</div><div class="dg-l">INTERNET</div></div></div></div>'+
    '<div class="dg-cols"><div><div class="dg-h">BIKES · SINAL DO RECEPTOR</div><div class="dg-bikes">'+(bk.length?bk.map(function(x){return x.h;}).join(''):'<div class="dg-vazio">nenhuma bike pareada</div>')+'</div></div>'+
    '<div><div class="dg-h">CELULARES · ATRASO ATÉ O SERVIDOR</div><div class="dg-cel">'+ch+'</div></div></div>'+
    '<div class="dg-rod"><span>VERDE <b>OK</b> · AMARELO <b>FRACO</b> · VERMELHO <b>SEM SINAL</b></span><span>BOTÃO <b>B</b> FECHA</span></div></div>';
}
window.addEventListener('resize',function(){ if(typeof boxMode!=='undefined'&&boxMode==='preAula') _fitPreAulaCol3(); });
function mostrarPreAula(d,vc,mc){
  boxMode='preAula';
  _fecharTodasTelas('boxPreAula');
  var el=document.getElementById('boxPreAula');if(el)el.style.display='flex';
  var wo=typeof workout!=='undefined'?workout:[];
  var set=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  var st=(typeof _saStats==='function')?_saStats({workout:wo}):{tot:wo.reduce(function(a,b){return a+(b.duration||0);},0),blocos:wo.length,ftp:0,zs:{}};
  var zr=(typeof _saZoneRange==='function')?_saZoneRange(st.zs):'\u2014';
  set('preAulaNome',d.nome||'ProRider'); set('preAulaDur',_saDur(st.sec)); set('preAulaBlocos',wo.length+' blocos');
  set('preAulaZona',zr);
  var _fLo=999,_fHi=0,_rLo=999,_rHi=0;
  wo.forEach(function(b){ if(b.ftpMin!=null){_fLo=Math.min(_fLo,b.ftpMin);_fHi=Math.max(_fHi,b.ftpMax||b.ftpMin);} if(b.rpmMin!=null){_rLo=Math.min(_rLo,b.rpmMin);_rHi=Math.max(_rHi,b.rpmMax||b.rpmMin);} });
  set('preAulaMetaFTP',(_fHi>0)?(_fLo+'\u2013'+_fHi+'%'):'\u2014');
  set('preAulaMetaRPM',(_rHi>0)?(_rLo+'\u2013'+_rHi):'\u2014');
  var _pfd=document.getElementById('preAulaPfDot'); if(_pfd){ var _zk=(wo[0]&&toZKey(wo[0].intensity))||'z1'; _pfd.style.background=(ZC[_zk]||'#a1a1a1'); }
  set('preAulaCardNome',d.nome||'ProRider'); set('preAulaSub',zr); set('preAulaMeta',_saDur(st.sec)+' \u00b7 '+wo.length+' bloco'+(wo.length===1?'':'s')+' \u00b7 TSS '+_aulaTSS(d));
  var th=document.getElementById('preAulaThumb');
  if(th) th.innerHTML=(d.img?'<img src="'+d.img+'">':(typeof _saSceneSVG==='function'?_saSceneSVG(0):''));
  var tg=document.getElementById('preAulaTag');
  if(tg){ if(d.badge&&typeof _saBadge==='function'){var bg=_saBadge(d.badge); tg.textContent=bg.t; tg.style.color=bg.c; tg.style.display='inline-block'; } else { tg.style.display='none'; } }
  var _msg=function(x){return (x&&x.msg&&x.msg!=='--'&&x.msg!=='\u2014')?x.msg:'\u2014';};
  var _vTxt=_msg(vc);
  try{
    if(vc&&vc.ok&&typeof videoEndPoint!=='undefined'&&videoEndPoint>0&&typeof videoSource!=='undefined'&&videoSource==='video'){
      var _alvo=_prFimPrincipalSec(), _ini=videoEndPoint-_alvo;
      _vTxt += (_ini>=0)
        ? '  \u00b7  come\u00e7a '+formatTimeFull(_ini)+' \u2192 chegada '+formatTimeFull(videoEndPoint)
        : '  \u00b7  \u26a0 v\u00eddeo curto para a chegada';
    }
  }catch(e){}
  // Música: avisa quando o MP3 é mais curto (ou mais longo) que a aula.
  // Sem isso, uma aula de 52:48 com um MP3 de 49:27 simplesmente ficava muda
  // nos ultimos 3:21 e parecia bug de sincronia.
  var _mTxt=_msg(mc);
  try{
    if(mc&&mc.ok&&typeof mp3Duration!=='undefined'&&mp3Duration>0){
      var _aulaS=_prSecTotal(wo), _mp3S=Math.round(mp3Duration), _dif=_mp3S-_aulaS;
      _mTxt += '  \u00b7  '+formatTime(_mp3S)+' / aula '+formatTime(_aulaS);
      if(_dif<-2)      _mTxt += '  \u26a0 faltam '+formatTime(-_dif)+' de m\u00fasica';
      else if(_dif>2)  _mTxt += '  \u00b7 sobra '+formatTime(_dif);
      console.log('[ProRider] m\u00fasica '+formatTime(_mp3S)+' / aula '+formatTime(_aulaS)+
        (_dif<-2?' \u2014 MP3 MAIS CURTO: vai acabar '+formatTime(-_dif)+' antes do fim da aula.':' \u2014 ok.'));
    }
  }catch(e){}
  set('preAulaVid',_vTxt); set('preAulaMus',_mTxt);
  var hMap={z1:14,z2:28,z3:42,z4:56,z5:70,z6:84,z7:100};
  var graf=document.getElementById('preAulaGrafico');
  if(graf){
    graf.style.height='100px'; graf.style.alignItems='flex-end';
    graf.style.position='relative';
    var _vals=wo.map(function(b){var mid=((b.ftpMin||0)+(b.ftpMax||0))/2; if(!mid){var zi2=['z1','z2','z3','z4','z5','z6','z7'].indexOf(toZKey(b.intensity));mid=40+Math.max(0,zi2)*12;} return mid;});
    var _mn=Math.min.apply(null,_vals),_mx=Math.max.apply(null,_vals),_sp=_mx-_mn;
    var _alt=function(i){ return (_sp<5)?60:(24+((_vals[i]-_mn)/_sp)*76); };

    // ── LINHA CONTINUA SOBRE AS BARRAS ───────────────────────────
    // Pedido de Mario (19/09): o perfil da tela de QR tambem com a linha
    // continua, como no grafico da aula. A linha e desenhada em SVG por cima
    // das barras, ligando o topo de cada bloco, com a largura de cada ponto
    // proporcional a DURACAO do bloco — entao o desenho respeita o tempo,
    // nao so a quantidade de blocos.
    // 23/09b: barras e linha no MESMO eixo de tempo. Antes as barras eram
    // itens flex com gap:4px e min-width:2px, e a linha em SVG usava a
    // proporcao pura da duracao — com 69 blocos os 68 vaos somavam ~270px e a
    // linha ia ficando para tras das barras. Agora cada barra e posicionada em
    // left/width % calculados pela mesma conta da linha (e da agulha: _prSec).
    var _seg=function(b){ return (typeof _prSec==='function'?_prSec(b):0) || ((b.duration||0)*60) || 1; };
    var _durTot=0; wo.forEach(function(b){ _durTot += _seg(b); });
    if(_durTot<=0) _durTot=wo.length||1;
    var _acum=0, _pts=[], _xs=[];
    wo.forEach(function(b,i){
      var d=_seg(b);
      var x0=(_acum/_durTot)*100; _acum+=d; var x1=(_acum/_durTot)*100;
      _xs.push([x0,x1]);
      var y=100-_alt(i);                 // topo da barra, em % do alto
      _pts.push([x0,y]); _pts.push([x1,y]);
    });
    var _linha=_pts.map(function(p,k){ return (k?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2); }).join(' ');

    graf.innerHTML=wo.map(function(b,i){
        var zk=toZKey(b.intensity),c=ZC[zk]||'#888';
        var x=_xs[i];
        return '<div style="position:absolute;bottom:0;left:'+x[0].toFixed(3)+'%;width:'+(x[1]-x[0]).toFixed(3)+'%;'
          +'height:'+_alt(i)+'%;padding:0 1px;box-sizing:border-box;background:'+c+';background-clip:content-box;'
          +'opacity:.9;border-radius:3px 3px 0 0;z-index:1;"></div>';
      }).join('')
      // 26/09b: a linha continua saiu de vez (pedido do Mario, foto da TV):
      // mesmo atras das barras ela aparecia como um contorno branco.
      // Agulha do progresso: durante a aula, a tela do QR fica aberta na
      // parede e ate agora o perfil era so um desenho parado. Agora tem um
      // risco e um ponto a andar, para quem chega ver em que altura da aula
      // a turma esta.
      + '<div id="preAulaAgulhaFeito" style="position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(8,6,14,.55);pointer-events:none;z-index:2;"></div>'
      + '<div id="preAulaAgulha" style="position:absolute;top:0;bottom:0;width:0;left:0;display:none;pointer-events:none;z-index:3;">'
      +   '<div style="position:absolute;top:-2px;bottom:-2px;left:-1px;width:2px;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.7);"></div>'
      +   '<div style="position:absolute;top:-5px;left:-5px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(255,255,255,.9);"></div>'
      + '</div>';
  }
  var zg=document.getElementById('preAulaZonaGraf');
  if(zg) zg.innerHTML=wo.slice(0,9).map(function(b){var zk=toZKey(b.intensity),c=ZC[zk]||'#888',h=hMap[zk]||14;return '<i style="height:'+h+'%;background:'+c+';"></i>';}).join('');
  var segD={w:0,m:0,c:0};
  wo.forEach(function(b){var s=b.segmentId||'main_1'; if(s==='warmup')segD.w+=b.duration||0; else if(s==='cooldown')segD.c+=b.duration||0; else segD.m+=b.duration||0;});
  var parts=[]; if(segD.w>0)parts.push({k:'Aquecimento',c:'#2f6bff',f:segD.w}); parts.push({k:'Principal',c:'#5db13d',f:segD.m||1}); if(segD.c>0)parts.push({k:'Final',c:'#6a7080',f:segD.c});
  var sb=document.getElementById('preAulaSegBar'), sl=document.getElementById('preAulaSegLbl');
  if(sb)sb.innerHTML=parts.map(function(p){return '<div class="pa-seg" style="flex:'+p.f+';background:'+p.c+';"></div>';}).join('');
  if(sl)sl.innerHTML=parts.map(function(p,i){var j=i===0?'flex-start':(i===parts.length-1?'flex-end':'center');return '<span style="flex:'+p.f+';justify-content:'+j+';"><span class="pa-dotc" style="background:'+p.c+';"></span>'+p.k+'</span>';}).join('');
  iniciarWS();startWPP();
  var qd=document.getElementById('preAulaQR');
  if(qd){qd.innerHTML='';try{new QRCode(qd,{text:salaCode,width:420,height:420,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H});}catch(e){qd.textContent=salaCode;} qd.removeAttribute('title');}
  set('preAulaCodigo',salaCode);
  var bq=document.getElementById('preAulaBrowserQR');
  if(bq){bq.innerHTML='';try{new QRCode(bq,{text:_BROWSER_ALUNO_URL,width:420,height:420,colorDark:'#111',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H});}catch(e){bq.textContent=_BROWSER_ALUNO_URL;} bq.removeAttribute('title');}
  set('preAulaBrowserUrl',_BROWSER_ALUNO_URL.replace('https://',''));
  _renderPreAlunos();
  requestAnimationFrame(_fitAlunosGrid);
  requestAnimationFrame(_fitPreAulaCol3); setTimeout(_fitPreAulaCol3,300);
  if(preAulaTimer)clearInterval(preAulaTimer);
  preAulaTimer=setInterval(function(){ if(boxMode!=='preAula'){clearInterval(preAulaTimer);return;} _renderPreAlunos(); },1000);
}
function fecharPreAula(){
  clearInterval(preAulaTimer);
  var el=document.getElementById('boxPreAula');if(el)el.style.display='none';
  // Se usbList veio de pendrive/sistema E a escolha foi via USB (não aula livre),
  // volta para a lista. Caso contrário volta para a tela de escolha.
  if(usbList.length>0 && boxMode!=='livre')mostrarUSB();else{usbList=[];mostrarEscolha();}
}
async function iniciarAula(){
  clearInterval(preAulaTimer);
  ['boxUSB','boxPreAula','bgPickerScreen','boxEscolha'].forEach(function(_id){var _e=document.getElementById(_id);if(_e)_e.style.display='none';});
  boxMode='live';
  var btn=document.getElementById('startLive');if(btn)btn.click();
}

// ============================================================
// WEBSOCKET + SALA
// ============================================================
var salaCode='',alunosMap={},wsProf=null;
var SERVER_URL='wss://app.prorider.app.br';   // 03/10r: domínio próprio
var SERVER_HTTP='https://app.prorider.app.br';
var wsKeepAlive=null;   // ping a cada 4 min para não dormir
var wsReconTimer=null;  // reconexão automática
var wsReconDelay=3000;  // começa com 3s, dobra até 30s
var _wsQuedas=0;        // quantas vezes o servidor caiu nesta sessão

// HTTP ping independente — mantém Railway ativo mesmo sem WS aberto
var _httpPingTimer=null;
function _serverHttpPing(){
  fetch(SERVER_HTTP+'/ping',{method:'GET',cache:'no-store'}).catch(function(){});
}
function _startHttpPing(){
  _serverHttpPing(); // imediato
  if(_httpPingTimer) clearInterval(_httpPingTimer);
  _httpPingTimer=setInterval(_serverHttpPing, 30*1000); // 30s — mantém Railway ativo
}
// Inicia assim que o app carrega
window.addEventListener('load',function(){ _startHttpPing(); });

function gerarCodigo(){var c='0123456789ABCDEF',a='',b='';for(var i=0;i<4;i++)a+=c[Math.floor(Math.random()*c.length)];for(var i=0;i<4;i++)b+=c[Math.floor(Math.random()*c.length)];return'PR-'+a+'-'+b;}

// ============================================================
// INDICADOR DE CONEXÃO / BLUETOOTH (canto inferior esquerdo)
// Aparece só quando há problema; pisca em vermelho.
// ============================================================
function _statusIndicatorInit(){
  if(document.getElementById('prStatusInd')) return;
  try{
    var css='@keyframes prBlink{0%,100%{opacity:1}50%{opacity:.3}}'
      +'#prStatusInd{position:fixed;left:20px;bottom:20px;z-index:25000;display:flex;flex-direction:column;gap:10px;pointer-events:none;font-family:sans-serif;}'
      +'#prStatusInd .pr-si{display:none;align-items:center;gap:9px;background:rgba(28,6,6,.9);border:1px solid rgba(214,45,45,.65);border-radius:11px;padding:9px 14px;color:#ff6a6a;font-size:15px;font-weight:700;letter-spacing:.4px;animation:prBlink 1s infinite;box-shadow:0 4px 18px rgba(0,0,0,.4);}'
      +'#prStatusInd .pr-si.show{display:flex;}'
      +'#prStatusInd .pr-si svg{width:22px;height:22px;flex-shrink:0;}';
    var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    var wrap=document.createElement('div');wrap.id='prStatusInd';
    wrap.innerHTML=
      '<div class="pr-si" id="prSiNet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1.1" fill="currentColor" stroke="none"/><line x1="3" y1="3" x2="21" y2="21"/></svg><span>Sem conexão com o servidor</span></div>'
      +'<div class="pr-si" id="prSiBt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10-5 4V3l5 4L7 17"/><line x1="3" y1="3" x2="21" y2="21"/></svg><span>Sem sinal Bluetooth</span></div>';
    document.body.appendChild(wrap);
  }catch(e){}
}
function _statusWatchdogBLE(){
  try{
    var el=document.getElementById('prSiBt'); if(!el) return;
    var ld=window._bleLastData||0;
    var init=(typeof _bled112Initialized!=='undefined') && _bled112Initialized;
    var dt=Date.now()-ld;
    // mostra só se: dongle conectado, já recebeu dados alguma vez, e parou de receber (6s a 5min)
    var bad = init && ld>0 && dt>6000 && dt<300000;
    el.classList.toggle('show', !!bad);
  }catch(e){}
}
window.addEventListener('load',function(){
  _statusIndicatorInit();
  setInterval(_statusWatchdogBLE, 2000);
});

function wsSetStatus(status){
  // Indicador de canto (net): mostra quando offline/reconectando
  try{ _statusIndicatorInit(); var _n=document.getElementById('prSiNet'); if(_n) _n.classList.toggle('show', status==='offline'); }catch(e){}
  // Atualiza indicador visual de conexão se existir
  var el=document.getElementById('wsStatus');
  if(!el) return;
  var map={ok:'🟢',connecting:'🟡',offline:'🔴'};
  el.textContent=map[status]||'';
  el.title=status==='ok'?'Servidor conectado':status==='connecting'?'Conectando...':'Sem conexão';
}

function iniciarWS(){
  // Pacote standalone do construtor: nao abre sala no servidor nem precisa de
  // internet. O construtor.html do pacote define window._PR_OFFLINE=true.
  if(typeof window!=='undefined' && window._PR_OFFLINE){
    try{ console.log('[ProRider] modo offline: sem conexao com o servidor.'); }catch(e){}
    return;
  }
  if(wsProf&&wsProf.readyState<=1) return;
  if(wsReconTimer){clearTimeout(wsReconTimer);wsReconTimer=null;}
  salaCode=salaCode||gerarCodigo();
  wsSetStatus('connecting');
  try{
    wsProf=new WebSocket(SERVER_URL);
    var _wsProfThis=wsProf;
    // 03/10y: conexão que não abre em 10 s (internet sumida, Wi-Fi com portal) conta como falha e entra no religar
    setTimeout(function(){ if(wsProf===_wsProfThis && _wsProfThis.readyState===0){ try{ _wsProfThis.onclose&&_wsProfThis.onclose(); }catch(e){} try{ _wsProfThis.close(); }catch(e){} } },10000);
    wsProf.onopen=function(){
      if(!wsProf||wsProf!==_wsProfThis) return; // conexao obsoleta/fechada — nao envia (evita crash null.send)
      wsReconDelay=3000; // reset delay
      if(_wsQuedas) try{ console.log('[ProRider] servidor reconectado (sala '+salaCode+').'); prErroTv('A TV perdeu a conexão com o servidor e religou sozinha','aviso'); }catch(e){}
      wsSetStatus('ok');
      // 26/09e: token do display -> a sala sabe a academia e o aluno fica ligado a ela
      wsProf.send(JSON.stringify({tipo:'criar_sala',codigo:salaCode,display_token:(_gymDisplayToken&&_gymDisplayToken!=='dev-bypass')?_gymDisplayToken:undefined}));
      if(window._fimAulaPendente && (!window._fimAulaSala || window._fimAulaSala===salaCode)){ try{ wsProf.send(JSON.stringify({tipo:'fim_aula'})); window._fimEnviadoEm=Date.now(); console.log('[ProRider] fim de aula pendente enviado ao reconectar.'); }catch(e){} }
      // Keepalive de 25s. Eram 4 MINUTOS: proxies (o do Railway inclusive)
      // derrubam WebSocket ocioso por volta de 60s, e fora da aula nao existe
      // trafego nenhum — a conexao caia sozinha e parecia "servidor caindo".
      if(wsKeepAlive) clearInterval(wsKeepAlive);
      // 03/10y: batimento de 5 em 5 s. Se a internet da academia some SEM AVISO, a conexão fica
      // "aberta" e muda por minutos. Sem resposta do servidor em 15 s, a TV desiste dela e
      // religa sozinha (de 5 em 5 s em aula) — a aula continua na TV o tempo todo.
      window._wsUltMsg=Date.now();
      try{ wsProf.send(JSON.stringify({tipo:'ping',v:2})); window._pingEnviadoEm=Date.now(); }catch(e){}   // já avisa o servidor do batimento rápido
      wsKeepAlive=setInterval(function(){
        if(!wsProf||wsProf!==_wsProfThis) return;
        if(wsProf.readyState===1){
          try{ wsProf.send(JSON.stringify({tipo:'ping',v:2})); window._pingEnviadoEm=Date.now(); }catch(e){}
          if(Date.now()-(window._wsUltMsg||0)>15000){
            try{ console.warn('[ProRider] servidor mudo há '+Math.round((Date.now()-window._wsUltMsg)/1000)+' s — sem internet? religando.'); }catch(e){}
            var _morto=wsProf; try{ _morto.onclose&&_morto.onclose(); }catch(e){} try{ _morto.close(); }catch(e){}
          }
        }
      }, 5*1000);
      // Relay de dados das bikes (ginásio → celular do aluno): ~4 Hz
      if(_wsRelayInt) clearInterval(_wsRelayInt);
      _wsRelayInt=setInterval(_wsEnviarBikesLive, 250);
      setTimeout(_wsEnviarSalaInfo, 600); // config da sala assim que abre
    };
    wsProf.onmessage=function(e){
      window._wsUltMsg=Date.now();   // 03/10y: o servidor está falando
      var d;try{d=JSON.parse(e.data);}catch(err){return;}
      if(d.tipo==='diag'){ window._diagCel=d.alunos||[]; return; }   // 07/10d: diagnóstico da sala
      if(d.tipo==='pong'){ if(window._fimAulaPendente&&window._fimEnviadoEm&&(window._pingEnviadoEm||0)>window._fimEnviadoEm){ window._fimAulaPendente=false; } return; } // resposta do keepalive (03/10y: confirma o fim da aula)
      if(d.tipo==='set_ftp'&&d.nome){
        // Aluno trocou o FTP ao vivo pelo app. Atualiza o ftpBase → %FTP recalcula na próxima leitura.
        // Sem recálculo retroativo (médias e histórico ficam como estão).
        var _alFtp=alunosMap[d.nome];
        if(!_alFtp){
          // tenta achar pela bike (virtual sem nome ainda)
          Object.keys(alunosMap).forEach(function(k){ if(String(alunosMap[k].bike)===String(d.bike)) _alFtp=alunosMap[k]; });
        }
        if(_alFtp){
          var _nf=Math.max(1,Math.min(500, parseInt(d.ftp||d.ftpBase,10)||150));
          _alFtp.ftpBase=_nf;
          // recalcula %FTP e zona imediatamente com os watts atuais
          var _w=_alFtp.watts||0;
          _alFtp.ftp=Math.round(_w/_nf*100);
          if(typeof _zonaFromPct==='function') _alFtp.zona=_zonaFromPct(_alFtp.ftp);
          if(typeof renderAlunos==='function') renderAlunos();
          if(typeof atualizaRanking==='function') atualizaRanking();
          try{ console.log('[ProRider] set_ftp recebido:',d.nome,'->',_nf,'W'); }catch(e){}
        }
      }
      // 01/10a: camisa de campeonato do aluno (a que veste agora ou a que conquistou)
      if(d.tipo==='aluno_camisa' && d.nome){ if(!alunosMap[d.nome]) alunosMap[d.nome]={nome:d.nome}; alunosMap[d.nome].camisa=d.camisa||null; try{ if(typeof _renderPreAlunos==='function' && boxMode==='preAula') _renderPreAlunos(); }catch(e){} }
      if(d.tipo==='aluno_conectou'||d.tipo==='dados_aluno'){
        if(d.nome){
          var _prev=alunosMap[d.nome]||{};
          // 03/10o: bike/rolo ligado no CELULAR do aluno (outras marcas, FTMS/potência). Se o dongle da TV
          // já lê a bike dele (Keiser), o dongle manda; o celular só vale quando o dongle não tem dado fresco.
          var _cel=null; if(d.fonte==='celular'){ _cel={w:+d.watts||0,r:+d.rpm||0}; delete d.watts; delete d.rpm; delete d.fonte; }
          // MERGE (não substitui): só sobrescreve os campos que vierem preenchidos.
          // Assim uma mensagem leve (ex.: só ftpBase) NÃO zera watts/rpm/kcal/distância acumulados.
          Object.keys(d).forEach(function(k){ if(d[k]!=null) _prev[k]=d[k]; });
          if(d.fc!=null && d.fc>0) _prev._fcTs=Date.now();   // 26/09d: FC da cinta do celular
          // FTP base novo (troca ao vivo pelo app) → recalcula %FTP com os watts atuais, sem retroativo
          if(d.ftpBase!=null){
            var _nfb=Math.max(1,Math.min(500, parseInt(d.ftpBase,10)||150));
            _prev.ftpBase=_nfb;
            var _wm=_prev.watts||0;
            if(_wm>0){ _prev.ftp=Math.round(_wm/_nfb*100); if(typeof _zonaFromPct==='function') _prev.zona=_zonaFromPct(_prev.ftp); }
          }
          _prev._semSala=null; try{ _prRelAluno(d.nome,false); }catch(e){}   // 26/09b: voltou a sala; 07/10c: relatório
          if(_cel && !(_prev._bledSrc && Date.now()-(_prev._lastSeen||0)<GYM_BIKE_STALE_MS)){
            var _ag=Date.now(), _b=_prev.ftpBase||150;
            _prev.watts=_cel.w; _prev.rpm=_cel.r; _prev.ftp=Math.round(_cel.w/_b*100); _prev.zona=_zonaFromPct(_prev.ftp);
            if(_cel.w>(_prev.potMax||0)) _prev.potMax=_cel.w;
            var _dt=(_ag-(_prev._accLast||_ag))/1000;
            if(_dt>0&&_dt<10){ _prev._kcalF=(_prev._kcalF||0)+_cel.w*_dt/3600*3.6; _prev._distF=(_prev._distF||0)+Math.round(_cel.r)*0.007*_dt/60; _prev.kcal=Math.round(_prev._kcalF); _prev.dist=parseFloat(_prev._distF.toFixed(2)); }
            _prev._accLast=_ag; _prev._celSrc=true; _prev._celTs=_ag;
          }
          alunosMap[d.nome]=_prev;
        }
        if(typeof renderAlunos==='function')renderAlunos();
        if(typeof _renderPreAlunos==='function')_renderPreAlunos();
        if(d.tipo==='aluno_conectou'){
          if(typeof atualizaQR==='function')atualizaQR();
          if(typeof atualizaRanking==='function')atualizaRanking();
          _wsEnviarSalaInfo(); // manda config da sala (bikes válidas + ocupadas) ao novo aluno
          // Envia estado atual da aula para o novo aluno
          if(typeof isPlaying!=='undefined'&&isPlaying&&typeof workout!=='undefined'&&workout.length){
            var cb3=workout[currentBlockIndex||0];
            var ts3=_prSecTotal(workout);
            var ds3=typeof calcDoneSec==='function'?calcDoneSec(0):0;
            var totR3=Math.max(0,ts3-ds3);
            var segR3=(typeof calcSegRemaining==='function')?calcSegRemaining(cb3.segmentId,(typeof progress!=='undefined'?progress:0)):totR3;
            setTimeout(function(){ wsBroadcast(cb3,segR3,ds3,workout[(currentBlockIndex||0)+1]||null,totR3); },500);
          }
        }
      }
      // 26/09b: o servidor responde ao criar_sala com a lista de quem esta na
      // sala. Aluno "real" que o Ginasio mostra mas o servidor nao conhece
      // (servidor reiniciou, conexao dele morreu) fica marcado; se nao voltar em
      // 90 s, sai da tela e libera a bike. Se voltar, continua com os numeros.
      if(d.tipo==='sala_criada' && Array.isArray(d.alunos)){
        try{
          var _no={}; d.alunos.forEach(function(x){ if(x&&x.nome) _no[x.nome]=1; });
          var _agora=Date.now(), _mud=false;
          Object.keys(alunosMap).forEach(function(n){
            var a=alunosMap[n]; if(!a||a._virtual||a._demo) return;
            if(_no[n]){ if(a._semSala){ a._semSala=null; _mud=true; } }
            else if(!a._semSala){ a._semSala=_agora; _mud=true; }
          });
          if(_mud) _wsEnviarSalaInfo();
          clearTimeout(window._semSalaT);
          window._semSalaT=setTimeout(function(){
            var saiu=false;
            if(typeof isPlaying!=='undefined'&&isPlaying&&boxMode==='live') return;   // 03/10y: em aula, quem caiu continua na bike (ver aluno_saiu)
            Object.keys(alunosMap).forEach(function(n){ var a=alunosMap[n]; if(a && a._semSala && Date.now()-a._semSala>=85000){ delete alunosMap[n]; saiu=true; try{ console.log('[ProRider] '+n+' nao voltou para a sala — removido da tela.'); }catch(e){} } });
            if(saiu){ try{ renderAlunos(); _renderPreAlunos(); atualizaQR(); atualizaRanking(); }catch(e){} _wsEnviarSalaInfo(); }
          },90000);
        }catch(e){}
      }
      // 03/10y: CELULAR CAIU NO MEIO DA AULA (internet do aluno). Antes a TV tirava o aluno e a bike dele
      // (que continua sendo pedalada) virava "Aluno 03": aparecia um aluno a mais no ranking e no resumo,
      // e as calorias/distância do aluno de verdade recomeçavam do zero quando ele voltava.
      // Agora, com a aula rodando, ele fica na bike (o dongle continua somando para ELE); se não voltar até
      // o fim, sai da tela no fim da aula, mas os números entram no resumo.
      if(d.tipo==='aluno_saiu'&&d.nome&&alunosMap[d.nome]&&!alunosMap[d.nome]._virtual&&typeof isPlaying!=='undefined'&&isPlaying&&boxMode==='live'){
        alunosMap[d.nome]._semSala=Date.now(); try{ _prRelAluno(d.nome,true); }catch(e){}
        try{ console.log('[ProRider] '+d.nome+' perdeu a conexão — continua na bike '+alunosMap[d.nome].bike+' até voltar.'); }catch(e){}
        return;
      }
      if(d.tipo==='aluno_saiu'&&d.nome){
        delete alunosMap[d.nome];
        if(typeof renderAlunos==='function')renderAlunos();
        if(typeof _renderPreAlunos==='function')_renderPreAlunos();
        if(typeof atualizaQR==='function')atualizaQR();
        if(typeof atualizaRanking==='function')atualizaRanking();
        _wsEnviarSalaInfo(); // ocupação mudou
      }
      if(d.tipo==='pedir_sala_info'){
        _wsEnviarSalaInfo(); // observador (QR da porta) assinou e ainda não havia cache no servidor
      }
    };
    wsProf.onclose=function(){
      // 03/10s: conexão fechada DE PROPÓSITO (fim de aula, voltar ao início) não é queda.
      // Antes, cada fim de aula contava como "servidor caiu", mandava o aviso
      // "A TV perdeu a conexão com o servidor" para a Saúde e podia apagar a conexão nova.
      if(wsProf!==_wsProfThis) return;
      wsProf=null;
      _wsQuedas=(_wsQuedas||0)+1;
      try{ console.warn('[ProRider] servidor caiu ('+_wsQuedas+'x) — religando em '+Math.round(Math.min(wsReconDelay*2,30000)/1000)+'s'); }catch(e){}
      wsSetStatus('offline');
      if(wsKeepAlive){clearInterval(wsKeepAlive);wsKeepAlive=null;}
      if(_wsRelayInt){clearInterval(_wsRelayInt);_wsRelayInt=null;}
      // Reconexão automática com backoff exponencial (3s → 6s → 12s → 30s)
      wsReconDelay=Math.min(wsReconDelay*2,(typeof isPlaying!=='undefined'&&isPlaying)?5000:30000);   // 03/10x: em aula, tenta de 5 em 5 s
      wsReconTimer=setTimeout(function(){
        if(!wsProf) iniciarWS();
      }, wsReconDelay);
    };
    wsProf.onerror=function(){
      // onclose vai disparar depois — deixa ele tratar
      wsSetStatus('offline');
    };
  }catch(e){wsProf=null;wsSetStatus('offline');}
}

// 03/10y: FIM DE AULA QUE NÃO CHEGOU (TV sem internet na hora de encerrar e depois saiu da tela da aula).
// Abre uma conexão curta só para isso, de 10 em 10 s por até 30 min: retoma a sala, manda o fim e fecha.
// Sem isso os celulares ficavam "em aula" até o servidor desistir da sala.
function _prFimPendenteLoop(codigo){
  if(!codigo||window._PR_OFFLINE) return; var ini=Date.now(), tm=null;
  function tentar(){
    if(!window._fimAulaPendente||window._fimAulaSala!==codigo||Date.now()-ini>30*60000){ return; }
    var w; try{ w=new WebSocket(SERVER_URL); }catch(e){ tm=setTimeout(tentar,10000); return; }
    var ok=false, to=setTimeout(function(){ try{ w.close(); }catch(e){} },8000);
    w.onopen=function(){ try{
      w.send(JSON.stringify({tipo:'criar_sala',codigo:codigo,display_token:(_gymDisplayToken&&_gymDisplayToken!=='dev-bypass')?_gymDisplayToken:undefined}));
      w.send(JSON.stringify({tipo:'fim_aula'})); w.send(JSON.stringify({tipo:'ping',v:2})); }catch(e){} };
    w.onmessage=function(e){ try{ var d=JSON.parse(e.data); if(d.tipo==='pong'){ ok=true; window._fimAulaPendente=false; console.log('[ProRider] fim da aula entregue aos celulares (a internet tinha caído).'); clearTimeout(to); try{ w.close(); }catch(er){} } }catch(er){} };
    w.onclose=function(){ clearTimeout(to); if(!ok) tm=setTimeout(tentar,10000); };
  }
  tentar();
}
function encerrarWS(){
  // Avisa os alunos que a aula acabou ANTES de fechar o socket.
  // Todo caminho de encerramento (Encerrar, Voltar ao início, fim de sessão) passa por aqui,
  // então o app sempre recebe o fim — não depende só do "Encerrar" com confirmação.
  try{ if(wsProf && wsProf.readyState===WebSocket.OPEN && salaCode){ wsProf.send(JSON.stringify({tipo:'fim_aula'})); } }catch(e){}
  try{ if(window._fimAulaPendente && window._fimAulaSala && window._fimAulaSala===salaCode) setTimeout(function(c){ return function(){ _prFimPendenteLoop(c); }; }(salaCode),1500); }catch(e){}
  if(wsKeepAlive){clearInterval(wsKeepAlive);wsKeepAlive=null;}
  if(wsReconTimer){clearTimeout(wsReconTimer);wsReconTimer=null;}
  if(wsProf){wsProf.close();wsProf=null;}
  alunosMap={};salaCode='';
  wsSetStatus('offline');
}
function resetSessao(){
  encerrarWS();wppScores={};alunoStats={};stopWPP();
  if(typeof workout!=='undefined')workout=[];
  if(typeof currentBlockIndex!=='undefined')currentBlockIndex=0;
  if(typeof isPlaying!=='undefined')isPlaying=false;
  if(typeof pausedElapsed!=='undefined')pausedElapsed=0; window._prDoneSecAgora=0; _desAutoFeito={};
  usbList=[];usbIdx=0;usbDir=null;ctrlScreen=0;
  ['overlayFTP','overlayRPM','overlayQR','overlayRank','overlayFC','modalEncerrar'].forEach(function(id){var e=document.getElementById(id);if(e)e.classList.remove('active');});
  if(qbAberta)fecharQB();
  if(typeof endScreen!=='undefined'&&endScreen)endScreen.classList.remove('show');
  if(typeof universeStop==='function')universeStop();
  if(demoOn)pararDemo();
  setTimeout(function(){iniciarWS();},1500);
}
function resetCompleto(){
  pendrive=false;
  bgActiveMode='cosmos'; bgParar();
  // Para audio/video explicitamente
  try{ if(typeof backgroundAudio!=='undefined'&&backgroundAudio){ backgroundAudio.pause(); backgroundAudio.removeAttribute('src'); backgroundAudio.load(); } }catch(e){}
  try{ if(typeof backgroundVideo!=='undefined'&&backgroundVideo){ backgroundVideo.pause(); backgroundVideo.removeAttribute('src'); backgroundVideo.style.display='none'; } }catch(e){}
  if(typeof videoObjectUrl!=='undefined'&&videoObjectUrl){ URL.revokeObjectURL(videoObjectUrl); videoObjectUrl=''; }
  if(typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl){ URL.revokeObjectURL(mp3ObjectUrl); mp3ObjectUrl=''; }
  // Esconde tela de live e resultados
  var lc=document.getElementById('liveClass');
  if(lc) lc.style.display='none';
  var es=document.getElementById('endScreen');
  if(es){ es.classList.remove('show'); es.style.display=''; }
  _endFoco=0;
  var _acRc=document.getElementById('endActions'); if(_acRc) _acRc.style.display='none';
  var _hiRc=document.getElementById('endHint'); if(_hiRc) _hiRc.textContent='';
  boxMode='idle';
  // Fecha QUALQUER tela de seleção/setup que possa ter ficado aberta (evita tela "pendurada")
  if(typeof _fecharTodasTelas==='function') _fecharTodasTelas();
  // Esconde modais
  var mv=document.getElementById('modalVoltar');
  if(mv) mv.classList.remove('active');
  // Cancela timer da aula
  if(typeof animationId!=='undefined'&&animationId){ cancelAnimationFrame(animationId); animationId=null; }
  resetSessao();
  setTimeout(function(){ ativarIdle(); },300);
}

// ============================================================
// OVERLAYS (apenas no Gym — Builder nao usa Xbox)
// ============================================================
var _ctrlUltimaTroca = 0;
var _ctrlUltimoN     = -1;

// ── BLINDAGEM DAS FUNCOES DE DESENHO ───────────────────────────────
// Um erro dentro de atualizaCards() abortava o ciclo INTEIRO — inclusive o que
// vinha depois — e se repetia 10x por segundo. Com o F12 aberto, o navegador
// guarda a pilha de cada erro e a tela congela.
// Aqui cada chamada e isolada: o erro e registrado UMA vez (e nao a cada
// quadro) e o resto do ciclo continua rodando.
var _prErrosVistos = {};
function _prSeguro(nome, fn){
  try{ fn(); }
  catch(e){
    var k = nome + '|' + (e && e.message ? e.message : e);
    if(!_prErrosVistos[k]){
      _prErrosVistos[k] = 1;
      console.error('[ProRider] erro em '+nome+' (registrado uma vez, o ciclo continua):', e);
    } else {
      _prErrosVistos[k]++;
    }
  }
}
// Quantas vezes cada erro ja aconteceu — util no diagnostico.
window.prErros = function(){ return Object.assign({}, _prErrosVistos); };



// ══ 26/09c — FLUIDEZ EM TODO O SISTEMA ══════════════════════════════
// Regra: nada de refazer a tela inteira a cada atualizacao. Monta-se o HTML
// novo fora da tela e so o que mudou e aplicado no lugar (_desMorph) — assim
// as transicoes (barras, aneis) deslizam e nada pisca. Coisas que dependem do
// TEMPO (aneis de contagem, agulhas) andam a cada quadro (requestAnimationFrame).
function _prMorphFilhos(dst,src){
  var a=dst.childNodes, b=src.childNodes;
  if(a.length!==b.length){ dst.innerHTML=src.innerHTML; return; }
  var mud=[]; for(var i=0;i<b.length;i++) _desMorph(a[i],b[i],mud);
}
function _prMorphHTML(dst,html){ var t=document.createElement('div'); t.innerHTML=html; _prMorphFilhos(dst,t); }
var _prAnimFns={}, _prAnimOn=false;
function _prAnimLoop(){
  var tem=false;
  for(var k in _prAnimFns){ tem=true; try{ if(_prAnimFns[k]()===false) delete _prAnimFns[k]; }catch(e){ delete _prAnimFns[k]; } }
  if(tem) requestAnimationFrame(_prAnimLoop); else _prAnimOn=false;
}
function _prAnimar(nome,fn){ _prAnimFns[nome]=fn; if(!_prAnimOn){ _prAnimOn=true; requestAnimationFrame(_prAnimLoop); } }
// ══ 26/09c — ESMAECIMENTO RAPIDO NAS TROCAS DE TELA ═══════════════
function _prFade(el){
  if(!el) return;
  el.classList.remove('pr-fade'); void el.offsetWidth; el.classList.add('pr-fade');
}
function _prFadeOut(el){
  if(!el) return;
  clearTimeout(el._fadeT);
  el.style.zIndex='99998'; el.style.pointerEvents='none';
  el.classList.remove('pr-fade'); void el.offsetWidth; el.classList.add('pr-fade-out');
  el._fadeT=setTimeout(function(){ el.classList.remove('pr-fade-out'); if(!el.classList.contains('active')) el.style.cssText='display:none'; },190);
}

// ══ 26/09d — MODO ESPACO (tela escura) ════════════════════════════════
// Pedido do Mario: segurando LB + RB por 5 s, a TV escurece e mostra so um
// ceu de estrelas passando de lado, com um planeta ao fundo. A VELOCIDADE das
// estrelas acompanha a sala: media de %FTP de quem esta pedalando (sala
// parada = estrelas quase paradas; sala forte = hiperespaco). Segurando LB+RB
// de novo (ou B), volta para a aula. A aula continua correndo por baixo.
var _espaco={on:false,cv:null,ctx:null,st:[],vel:0.2,raf:0,t0:0,holdIni:0,holdArmado:false};
function _espacoVelAlvo(){
  try{
    var s=0,n=0; Object.keys(alunosMap).forEach(function(k){ var a=alunosMap[k]; if(!a||!(a.watts>0)) return; var f=parseInt(a.ftpBase,10)||150; s+=a.watts/f; n++; });
    if(!n) return 0.08;
    var m=s/n;                     // 1.0 = turma no FTP
    return Math.max(0.15, Math.min(4, m*m*1.6));
  }catch(e){ return 0.3; }
}
function espacoLigar(){
  if(_espaco.on) return;
  _espaco.on=true;
  var cv=document.createElement('canvas'); cv.id='prEspaco';
  cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:40000;background:#000;opacity:0;transition:opacity .6s ease;';
  // 30/09a: vai no <html>, FORA do <body>. O body recebe zoom (_scaleApp) para
  // encaixar o desenho 1920x1080 na TV; dentro dele, 100vw/100vh sao reduzidos
  // de novo pelo zoom e a tela escura ficava num canto (TV com escala do Windows).
  (document.documentElement||document.body).appendChild(cv); _espaco.cv=cv; _espaco.ctx=cv.getContext('2d');
  var W=cv.width=window.innerWidth*Math.min(2,window.devicePixelRatio||1), H=cv.height=window.innerHeight*Math.min(2,window.devicePixelRatio||1);
  // 26/09d: estrelas vindo EM DIRECAO a quem olha (sem planeta) — pedido do Mario
  var _novaEstrela=function(longe){ return {x:(Math.random()*2-1)*1.6, y:(Math.random()*2-1)*1.0, z:longe?(0.6+Math.random()*0.4):(0.05+Math.random()*0.95), pz:0}; };
  _espaco.st=[]; for(var i=0;i<700;i++){ var e0=_novaEstrela(false); e0.pz=e0.z; _espaco.st.push(e0); }
  _espaco.vel=_espacoVelAlvo(); _espaco.t0=performance.now();
  requestAnimationFrame(function(){ cv.style.opacity='1'; });
  var ult=performance.now();
  (function quadro(agora){
    if(!_espaco.on) return;
    var dt=Math.min(0.05,(agora-ult)/1000); ult=agora;
    _espaco.vel += (_espacoVelAlvo()-_espaco.vel)*Math.min(1,dt*0.8);   // acelera/desacelera suave
    var c=_espaco.ctx, W=cv.width, H=cv.height, v=_espaco.vel, cx=W/2, cy=H/2, F=Math.min(W,H)*0.55;
    c.fillStyle='rgba(0,0,0,'+(v>1.5?0.45:0.75)+')'; c.fillRect(0,0,W,H);   // rastro leve
    var dz=(0.03+0.55*v)*dt;
    for(var i=0;i<_espaco.st.length;i++){
      var e=_espaco.st[i];
      e.pz=e.z; e.z-=dz;
      if(e.z<=0.02){ var n=_novaEstrela(true); e.x=n.x; e.y=n.y; e.z=n.z; e.pz=e.z; continue; }
      var sx=cx+e.x/e.z*F, sy=cy+e.y/e.z*F, px=cx+e.x/e.pz*F, py=cy+e.y/e.pz*F;
      if(sx<-50||sx>W+50||sy<-50||sy>H+50){ var n2=_novaEstrela(true); e.x=n2.x; e.y=n2.y; e.z=n2.z; e.pz=e.z; continue; }
      var perto=1-e.z, a=Math.min(1,0.15+perto*1.1);
      c.strokeStyle='rgba(225,232,255,'+a.toFixed(2)+')'; c.lineWidth=Math.max(0.8,perto*3.2*(W/1920));
      c.beginPath(); c.moveTo(px,py); c.lineTo(sx+(sx===px?0.8:0),sy); c.stroke();
    }
    _espaco.raf=requestAnimationFrame(quadro);
  })(ult);
  try{ console.log('[ProRider] modo espaco ligado (LB+RB 5 s).'); }catch(e){}
}
function espacoDesligar(){
  if(!_espaco.on) return;
  _espaco.on=false; cancelAnimationFrame(_espaco.raf);
  var cv=_espaco.cv; if(cv){ cv.style.opacity='0'; setTimeout(function(){ if(cv.parentNode) cv.parentNode.removeChild(cv); },600); }
  try{ console.log('[ProRider] modo espaco desligado.'); }catch(e){}
}
function espacoAlternar(){ if(_espaco.on) espacoDesligar(); else espacoLigar(); }
// segurar LB+RB 1 s alterna (so dispara uma vez por aperto)
function _espacoHold(lb,rb){
  if(lb&&rb){
    if(!_espaco.holdIni){ _espaco.holdIni=Date.now(); _espaco.holdArmado=true; }
    else if(_espaco.holdArmado && Date.now()-_espaco.holdIni>=5000){ _espaco.holdArmado=false; espacoAlternar(); }   // 5 s (Mario)
    return true;
  }
  _espaco.holdIni=0; _espaco.holdArmado=false;
  return false;
}
window.addEventListener('keydown',function(ev){ if((ev.key==='e'||ev.key==='E')&&ev.shiftKey&&(boxMode==='live'||boxMode==='livre'||boxMode==='sessao')) espacoAlternar(); });
function ctrlSetScreen(n){
  if(APP_MODE==='builder')return;

  // ── TRAVA CONTRA DISPARO DUPLICADO ─────────────────────────────
  // O mesmo botao ALTERNA a tela: chamar duas vezes seguidas com o mesmo n
  // abre e fecha na hora — o painel "pisca" e nao aparece. Isso acontece quando
  // o mesmo apertar chega por dois caminhos (leitura do controle no quadro
  // seguinte, ou controle e teclado juntos).
  // Chamadas repetidas com o MESMO n dentro de 300ms sao ignoradas. Trocar de
  // painel (n diferente) ou fechar de proposito (n=0) passa sempre.
  var _agora = Date.now();
  if (n !== 0 && n === _ctrlUltimoN && (_agora - _ctrlUltimaTroca) < 300) {
    console.warn('[ProRider] ignorando 2o disparo da tela '+n+' em '+(_agora-_ctrlUltimaTroca)+'ms (o painel piscava por causa disto).');
    return;
  }
  _ctrlUltimaTroca = _agora;
  _ctrlUltimoN     = n;

  // voltar para a tela do grafico devolve as caixas do topo
  try{ if(n===0) _prTopoReset(); }catch(e){}
  try{
    _prMiniGrafRender(false);
    if(typeof isPlaying!=='undefined'&&typeof currentBlockIndex!=='undefined'&&typeof workout!=='undefined'&&workout.length){
      var _p=(typeof pausedElapsed!=='undefined'&&workout[currentBlockIndex])
             ? Math.min(1,(pausedElapsed/1000)/(_prSec(workout[currentBlockIndex])||1)) : 0;
      _prMiniGrafUpdate((boxMode==='live'&&window._prDoneSecAgora>0)?window._prDoneSecAgora:calcDoneSec(_p));
    }
  }catch(e){}
  // 26/09c: TROCA DE TELA COM ESMAECIMENTO RAPIDO (pedido do Mario). A tela
  // que sai some em 0,18 s por baixo da que entra (que aparece em 0,22 s);
  // voltando ao grafico, a tela sai esmaecendo por cima dele.
  ['overlayFTP','overlayRPM','overlayQR','overlayRank','overlayFC'].forEach(function(id){
    var e=document.getElementById(id);
    if(!e) return;
    var visivel=e.classList.contains('active') && e.style.display!=='none';
    e.classList.remove('active');
    if(visivel) _prFadeOut(e); else { clearTimeout(e._fadeT); e.style.cssText='display:none'; }
  });
  // Em Aula Livre/Sessão, X (screen 1) mostra painel do professor (bike 99)
  if((boxMode==='livre'||boxMode==='sessao')&&n===1){
    _mostrarPainelBike99(); return;
  }
  var _prevCtrl=ctrlScreen;
  fecharPainelBike99();
  ctrlScreen = (_prevCtrl===n) ? 0 : n;
  if(ctrlScreen>0){
    var m={1:'overlayFTP',2:'overlayRPM',3:'overlayQR',4:'overlayRank',5:'overlayFC'};
    var e=document.getElementById(m[ctrlScreen]);
    if(e){
      clearTimeout(e._fadeT);
      e.classList.add('active');
      e.style.cssText='display:flex;position:fixed;inset:0;z-index:99999;background:#080610;flex-direction:column;overflow:hidden;';
      _prFade(e);
    }
    if(ctrlScreen===1||ctrlScreen===2||ctrlScreen===5)atualizaCards();
    if(ctrlScreen===3)atualizaQR();
    if(ctrlScreen===4)atualizaRanking();
    atualizaLiveBar();
  }
}
function _mostrarPainelBike99(){
  var prof=parBikeMap&&parBikeMap[99]?parBikeMap[99]:null;
  var watts=prof?prof.watts:0, rpm=prof?prof.rpm:0;
  var nome=prof&&prof.nome?prof.nome:'Bike 99 (Professor)';
  var el=document.getElementById('overlayBike99Prof');
  if(!el){
    el=document.createElement('div');el.id='overlayBike99Prof';
    el.className='ctrl-overlay';
    el.style.cssText='display:none;z-index:9000;';
    el.innerHTML='<div class="ctrl-bar-hdr"><div class="ctrl-bar-title">PROFESSOR — REFERÊNCIA AO VIVO</div><div class="ctrl-bar-close" onclick="fecharPainelBike99()">✕</div></div>'
      +'<div id="bike99Body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:32px;"></div>';
    document.body.appendChild(el);
  }
  var body=document.getElementById('bike99Body');
  if(body){
    body.innerHTML='<div style="text-align:center;"><div style="font-family:Bebas Neue,sans-serif;font-size:14px;letter-spacing:3px;color:rgba(255,255,255,.4);">'+nome+'</div>'
      +'<div style="font-family:Bebas Neue,sans-serif;font-size:80px;letter-spacing:2px;color:#fff;line-height:1;">'+rpm+'</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,.4);">RPM</div></div>'
      +'<div style="text-align:center;">'
      +'<div style="font-family:Bebas Neue,sans-serif;font-size:80px;letter-spacing:2px;color:#ea860c;line-height:1;">'+watts+'</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,.4);">WATTS</div></div>';
    if(!prof) body.innerHTML='<div style="text-align:center;color:rgba(255,255,255,.3);font-size:14px;">Bike 99 não conectada</div>';
  }
  el.classList.add('active');
}
function fecharPainelBike99(){
  var el=document.getElementById('overlayBike99Prof');if(el)el.classList.remove('active');
  ctrlScreen=0;
}
// ══════════════════════════════════════════════════════════════════
// MINI GRÁFICO DA AULA — topo das telas POTÊNCIA / ROTAÇÃO / RANKING
// (a tela do QR nao usa: ja tem o grafico grande embaixo)
// Barras proporcionais ao tempo de cada bloco, separador por segmento, e um
// veu escuro que avanca LINEARMENTE com o tempo decorrido, com a agulha no
// ponto atual. Assim o professor pode ficar so nos dados e a turma continua
// vendo onde a aula esta.
// ══════════════════════════════════════════════════════════════════
var _PR_MINI_IDS=['miniGrafFTP','miniGrafRPM','miniGrafRank','miniGrafFC'];
var _prMiniAssinatura='';

function _prMiniGrafRender(forcar){
  var wo=(typeof workout!=='undefined'&&workout)?workout:[];
  var totS=_prSecTotal(wo);
  // so redesenha se a aula mudou (evita repintar 10x por segundo)
  var assin=wo.length+':'+totS;
  if(!forcar && assin===_prMiniAssinatura) return;
  _prMiniAssinatura=assin;

  // Mesma escala de altura do grafico da tela do QR
  var alturas={z1:14,z2:28,z3:42,z4:56,z5:70,z6:84,z7:100};
  // LARGURA DO TRILHO: 100% para uma aula de referencia de 50 min. Aula mais
  // curta ocupa a fracao correspondente e fica CENTRADA — antes uma aula de
  // 20 min esticava as barras de ponta a ponta e ficava esparramada.
  // Aula mais longa que a referencia fica em 100% e comprime, como deve ser.
  var REF_SEG=50*60;
  var larg=Math.max(40, Math.min(100, (totS/REF_SEG)*100));
  var html='';
  if(wo.length && totS>0){
    // 26/09b: barras posicionadas em % do TEMPO (left/width), no mesmo eixo do
    // veu. Antes eram itens flex com vao de 2px + separadores: os vaos
    // somados empurravam as barras e o veu (que e % puro do tempo) ficava
    // alguns pixels fora do lugar — uns 5 s de diferenca em relacao ao
    // grafico da aula, que foi o que o Mario viu nas telas de cartoes.
    var barras='', segAnterior=null, acum=0;
    for(var i=0;i<wo.length;i++){
      var b=wo[i];
      var x0=acum/totS*100; acum+=_prSec(b); var x1=acum/totS*100;
      if(segAnterior!==null && b.segmentId!==segAnterior) barras+='<div class="cm-sep" style="position:absolute;top:0;bottom:0;left:'+x0.toFixed(3)+'%;"></div>';
      segAnterior=b.segmentId;
      var zk=(typeof toZKey==='function')?toZKey(b.intensity):(b.intensity||'z1');
      var cor=(typeof ZC!=='undefined'&&ZC[zk])?ZC[zk]:'#888';
      var alt=alturas[zk]||14;
      barras+='<div class="cm-bar" style="position:absolute;bottom:0;left:'+x0.toFixed(3)+'%;width:'+(x1-x0).toFixed(3)+'%;height:'+alt+'%;padding:0 1px;box-sizing:border-box;background:'+cor+';background-clip:content-box;min-width:0;"></div>';
    }
    html='<div class="cm-track" style="width:'+larg.toFixed(1)+'%;">'+barras+'<div class="cm-veu"></div></div>'
       + '<div class="cm-tempo"></div>';
  }
  for(var k=0;k<_PR_MINI_IDS.length;k++){
    var el=document.getElementById(_PR_MINI_IDS[k]);
    if(!el) continue;
    el.innerHTML=html;
    if(html) el.classList.remove('empty'); else el.classList.add('empty');
  }
}

function _prMiniGrafUpdate(doneSec){
  var wo=(typeof workout!=='undefined'&&workout)?workout:[];
  var totS=_prSecTotal(wo);
  if(!wo.length||!totS) return;
  _prMiniGrafRender(false);
  var d=Math.max(0,Math.min(totS,doneSec||0));
  var pct=(d/totS)*100;
  var txt=formatTime(d)+' / '+formatTime(totS);
  for(var k=0;k<_PR_MINI_IDS.length;k++){
    var el=document.getElementById(_PR_MINI_IDS[k]); if(!el) continue;
    var veu=el.querySelector('.cm-veu'); if(veu) veu.style.width=pct.toFixed(3)+'%';
    var t=el.querySelector('.cm-tempo'); if(t) t.textContent=txt;
  }
  // o campo "Tempo" da barra ao vivo nunca era preenchido — passa a mostrar decorrido/total
  ['lbTempoFTP','lbTempoRPM','lbTempoQR','lbTempoRank','lbTempoFC'].forEach(function(id){
    var e=document.getElementById(id); if(e) e.textContent=txt;
  });
}

// ══════════════════════════════════════════════════════════════════
// TOPO LIMPO — botao RT (R2, indice 7) esconde/mostra as caixas do topo
// (PROXIMO BLOCO + relogio de Segmento/Aula Total). Serve para deixar a tela
// limpa quando o video tem informacao propria.
// Volta SEMPRE visivel ao iniciar a aula e ao voltar para a tela do grafico.
// ══════════════════════════════════════════════════════════════════
var _prTopoVisivel = true;
function _prTopoAplicar(){
  // No gráfico 2 a informação mora ABAIXO do gráfico: o RT esconde a faixa de lá.
  // 26/09c: esconder as caixas faz o grafico DESCER para o lugar delas e
  // crescer 30% na altura (pedido do Mario). Mostrar volta ao normal.
  var faixa=document.getElementById('pg2Info');
  if(faixa){
    faixa.style.opacity = '';
    faixa.style.visibility = '';
    faixa.style.display = _prTopoVisivel ? '' : 'none';
  }
  var _pg=document.getElementById('pg2'); if(_pg) _pg.classList.toggle('pg2-grande', !_prTopoVisivel);
  try{ if(typeof PG2_ON!=='undefined' && PG2_ON){ _pg2Encaixar(); _pg2Pin((typeof progress!=='undefined')?progress:0); } }catch(e){}
  ['nextBlock','dualClock'].forEach(function(id){
    var e=document.getElementById(id);
    if(!e) return;
    e.style.transition='opacity .22s ease';
    var mostrar = _prTopoVisivel && !PG2_ON;   // gráfico 2 leva a informação para baixo
    e.style.opacity     = mostrar ? '1' : '0';
    e.style.pointerEvents = mostrar ? '' : 'none';
    // visibility em vez de display: nao recalcula o layout do grafico
    e.style.visibility  = mostrar ? '' : 'hidden';
  });
}
function _prTopoToggle(){
  _prTopoVisivel = !_prTopoVisivel;
  _prTopoAplicar();
  try{ console.log('[ProRider] topo '+(_prTopoVisivel?'visivel':'oculto')+' (RT)'); }catch(e){}
}
function _prTopoReset(){ _prTopoVisivel=true; _prTopoAplicar(); }

// Reduz a fonte ate o texto caber na caixa (as caixas do topo tinham
// white-space:nowrap + overflow:hidden, entao "Zone 7 - Neuromuscular" e
// "106-120%" eram simplesmente cortados na borda).
function _prCabeTexto(el, basePx, minPx){
  if(!el) return;
  try{
    // 01/10e: só reajusta quando o texto ou a largura mudam (antes refazia a cada atualização
    // da tela ao vivo, forçando o navegador a recalcular a página várias vezes por segundo)
    var _sig=el.textContent+'|'+basePx+'|'+el.clientWidth;
    if(el._prFit===_sig) return;
    var fs=basePx, min=minPx||14, guarda=0;
    el.style.fontSize=fs+'px';
    // el.clientWidth ja e a largura INTERNA (sem o padding do pai). A versao
    // antiga comparava com par.clientWidth-32, mas o padding e 24 de cada lado
    // (48), entao sobravam 16px de folga e o texto era cortado na borda.
    while(el.scrollWidth>el.clientWidth && fs>min && guarda++<60){
      fs-=1; el.style.fontSize=fs+'px';
    }
    el._prFit=_sig;
  }catch(e){}
}
function _prAjustaCaixasTopo(){
  document.querySelectorAll('.next-info h3').forEach(function(el){ _prCabeTexto(el,38,17); });
  document.querySelectorAll('.next-info small').forEach(function(el){ _prCabeTexto(el,14,10); });
}

function atualizaLiveBar(){
  var cb=(typeof workout!=='undefined'&&workout&&typeof currentBlockIndex!=='undefined')?workout[currentBlockIndex]:null;
  var zN={z1:'Recovery',z2:'Endurance',z3:'Tempo',z4:'Threshold',z5:'VO2 Max',z6:'Anaerobic',z7:'Neuromuscular'};
  var zona=cb?zN[cb.intensity]||'--':'--';
  // 23/09b: bloco sem piso (Recovery, ftpMin 0) saia "--–55%". Agora "< 55%",
  // como no circulo da aula; sem teto, "> X%".
  var ftp='--';
  if(cb){
    if(cb.ftpMin&&cb.ftpMax) ftp=cb.ftpMin+'–'+cb.ftpMax+'%';
    else if(cb.ftpMax)       ftp='< '+cb.ftpMax+'%';
    else if(cb.ftpMin)       ftp='> '+cb.ftpMin+'%';
  }
  var rpm=cb?(cb.rpmMin||'--')+'–'+(cb.rpmMax||'--'):'--';
  var con=typeof alunosMap!=='undefined'?Object.keys(alunosMap).length:0;
  var conStr=con+(con===1?' aluno':' alunos');
  // Posicao do bloco atual — mesmo teste usado nos cartoes do grafico.
  var emPe=cb?/em\s*p|standing/i.test(String(cb.position||'')):false;
  var posStr=cb?(emPe?'De pé':'Sentado'):'—';
  var set=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  var setPos=function(id){
    var e=document.getElementById(id); if(!e) return;
    e.textContent=posStr;
    e.classList.toggle('pe',emPe);
  };
  // FTP overlay (lbMetaFTP — sem sufixo duplo)
  set('lbZonaFTP',zona); set('lbMetaFTP',ftp); set('lbMetaRPMFTP',rpm); set('lbConectFTP',conStr); setPos('lbPosFTP');
  set('lbZonaFC',zona); set('lbMetaFC',ftp); set('lbMetaRPMFC',rpm); set('lbConectFC',conStr); setPos('lbPosFC');
  // RPM overlay
  set('lbZonaRPM',zona); set('lbMetaFTPRPM',ftp); set('lbMetaRPMRPM',rpm); set('lbConectRPM',conStr); setPos('lbPosRPM');
  // QR overlay
  set('lbZonaQR',zona); set('lbMetaFTPQR',ftp); set('lbMetaRPMQR',rpm); set('lbConectQR',conStr); setPos('lbPosQR');
  // Ranking overlay
  set('lbZonaRank',zona); set('lbMetaFTPRank',ftp); set('lbMetaRPMRank',rpm); set('lbConectRank',conStr); setPos('lbPosRank');
}

// Ajusta o grid de acordo com o número de alunos
function ajustarGrid(n){
  n=Math.max(1,n|0);
  var cols, rows;
  // Regra do Mario: SEMPRE 4 por fileira até 16 (5º cai na 2ª fileira, 9º na 3ª, 13º na 4ª).
  // Só a partir de 17 passa a 5 por fileira.
  if(n<=16)      { cols=4; rows=Math.ceil(n/4); }   // 1..4=1 fileira, 5..8=2, 9..12=3, 13..16=4
  else if(n<=20) { cols=5; rows=4; }                 // 17..20 = 5x4
  else if(n<=25) { cols=5; rows=5; }
  else if(n<=30) { cols=6; rows=5; }
  else           { cols=Math.ceil(Math.sqrt(n)); rows=Math.ceil(n/cols); }
  // Escala do conteúdo do card conforme a quantidade (poucos alunos = números BEM maiores)
  var V;
  if(n<=2)       V=180;
  else if(n<=4)  V=150;
  else if(n<=6)  V=128;
  else if(n<=9)  V=108;
  else if(n<=12) V=94;
  else if(n<=16) V=82;
  else if(n<=20) V=72;
  else if(n<=25) V=64;
  else           V=56;
  var maxW = n<=4?860:(n<=6?720:(n<=9?640:600));
  var maxH = n<=2?420:(n<=4?340:(n<=6?300:(n<=9?260:230)));
  document.querySelectorAll('.ctrl-grid').forEach(function(g){
    // 03/10s: o número tem que CABER no cartão. Com 4 por fileira o cartão tem
    // ~460 px, e com 1 a 4 alunos o "100%" e o nome da zona saíam cortados.
    // O tamanho agora é o menor entre a tabela acima e o que cabe no cartão.
    var cs=getComputedStyle(g), gx=parseFloat(cs.columnGap)||0, gy=parseFloat(cs.rowGap)||0;
    var W=g.clientWidth||window.innerWidth*0.96, H=g.clientHeight||window.innerHeight*0.7;
    var cw=Math.min(maxW,(W-gx*(cols-1))/cols), ch=Math.min(maxH,(H-gy*(rows-1))/rows);
    _ajustarGridVars(g, Math.max(28, Math.floor(Math.min(V, cw*0.27, ch*0.42))), cols, rows, maxW, maxH);
  });
}
function _ajustarGridVars(g, V, cols, rows, maxW, maxH){
  // demais informações derivadas do número (aproveitando o espaço do card)
  var E={ val:V,
          name:Math.round(V*0.42),   // nome grande no topo
          av:  Math.round(V*1.05),   // foto grande
          zone:Math.round(V*0.26),
          bike:Math.round(V*0.20),   // número da bike no canto
          foot:Math.round(V*0.22) }; // rodapé (WPP + watts)
    // setProperty com 'important' para vencer o !important do CSS (que trava em 5x3).
    // minmax(0,MAXpx): com poucos alunos a célula NÃO estica a tela toda; com muitos, encolhe pra caber.
    g.style.setProperty('grid-template-columns','repeat('+cols+',minmax(0,'+maxW+'px))','important');
    g.style.setProperty('grid-template-rows','repeat('+rows+',minmax(0,'+maxH+'px))','important');
    g.style.setProperty('justify-content','center','important');
    g.style.setProperty('align-content','center','important');
    g.style.setProperty('--pcVal', E.val+'px');
    g.style.setProperty('--pcName',E.name+'px');
    g.style.setProperty('--pcAv',  E.av+'px');
    g.style.setProperty('--pcZone',E.zone+'px');
    g.style.setProperty('--pcBike',E.bike+'px');
    g.style.setProperty('--pcFoot',E.foot+'px');
}


// ══ 26/09d — FREQUENCIA CARDIACA: UMA FONTE SO ═════════════════════════
// A FC pode vir da bike (Keiser: bpm) ou da cinta/relogio ligado no celular do
// aluno (app -> dados_aluno.fc). A do celular tem prioridade quando fresca.
function _hrDe(a){
  if(!a) return 0;
  if(a.fc>0 && a._fcTs && Date.now()-a._fcTs<5000) return Math.round(a.fc);
  var v=parseInt(a.bpm||a.hr,10)||0;
  if(v>0) return v;
  return (a.fc>0 && !a._fcTs) ? Math.round(a.fc) : 0;
}
// FC maxima: a do aluno, senao 220 - idade, senao 190
function _fcMaxDe(a){ var m=parseInt(a&&a.fcMax,10)||0; if(m>100) return m; var i=parseInt(a&&a.idade,10)||0; return i>10?220-i:190; }
var FC_ZONAS=[{l:60,n:'Z1 · leve',c:'#a1a1a1'},{l:70,n:'Z2 · aeróbico',c:'#295fe8'},{l:80,n:'Z3 · tempo',c:'#5db13d'},{l:90,n:'Z4 · limiar',c:'#d7c414'},{l:999,n:'Z5 · máximo',c:'#d62d2d'}];
function _fcZona(pct){ for(var i=0;i<FC_ZONAS.length;i++) if(pct<FC_ZONAS[i].l) return FC_ZONAS[i]; return FC_ZONAS[4]; }
function atualizaCards(){
  var fg=document.getElementById('ftpGrid'),rg=document.getElementById('rpmGrid'),hg=document.getElementById('fcGrid');
  var al=typeof alunosMap!=='undefined'?alunosMap:{};
  ajustarGrid(Object.keys(al).length||15);if(!fg&&!rg&&!hg)return;
  // 26/09d: so atualiza a grade da tela aberta (as outras ficam escondidas)
  if(typeof ctrlScreen!=='undefined'){ if(ctrlScreen!==1) fg=null; if(ctrlScreen!==2) rg=null; if(ctrlScreen!==5) hg=null; }
  var cb=(typeof workout!=='undefined'&&workout&&typeof currentBlockIndex!=='undefined')?workout[currentBlockIndex]:null;
  var rMin=cb?(cb.rpmMin||80):80,rMax=cb?(cb.rpmMax||90):90;
  var al=typeof alunosMap!=='undefined'?alunosMap:{},ns=Object.keys(al);
  var zN={z1:'Recovery',z2:'Endurance',z3:'Tempo',z4:'Threshold',z5:'VO2 Max',z6:'Anaerobic',z7:'Neuromuscular'};
  var empty='<div style="color:rgba(255,255,255,.3);font-size:15px;text-align:center;margin-top:40px;grid-column:1/-1;">Nenhum aluno conectado</div>';
  function _pcInjectCSS(){
    if(document.getElementById('pcCardCSS')) return;
    var s=document.createElement('style'); s.id='pcCardCSS';
    s.textContent=''
      +'.ctrl-card{position:relative !important;flex-direction:column !important;align-items:stretch !important;justify-content:space-between !important;gap:0 !important;padding:2% 2.6% !important;overflow:hidden !important;}'
      // NOME — grande no topo, largura total, SEM borda (aproveita espaço)
      +'.ctrl-card .pc-name{width:100% !important;font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:var(--pcName,26px);line-height:1.0;letter-spacing:.3px;color:#fff;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;padding-right:16%;}'
      // número da BIKE no canto superior direito
      // 03/10s: o nome não passa por baixo do "BIKE 12" no canto
      +'.ctrl-card .pc-name{padding-right:calc(var(--pcBike,15px) * 3.9) !important;box-sizing:border-box !important;}'
      +'.ctrl-card .pc-bike{position:absolute;top:6%;right:5%;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:var(--pcBike,15px);letter-spacing:1px;color:rgba(255,255,255,.35);line-height:1;}'
      // CORPO — avatar grande à esquerda, número grande à direita, sem vazio no meio
      +'.ctrl-card .pc-body{display:flex !important;align-items:center !important;justify-content:space-between !important;gap:2% !important;flex:1 1 auto !important;min-height:0 !important;width:100% !important;}'
      +'.ctrl-card .pc-av-wrap{flex-shrink:0;display:flex;align-items:center;}'
      +'.ctrl-card .ctrl-card-av{width:var(--pcAv,90px) !important;height:var(--pcAv,90px) !important;}'
      +'.ctrl-card .ctrl-card-av-ph{font-size:calc(var(--pcAv,90px) * .5) !important;}'
      +'.ctrl-card .pc-val{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;text-align:right;gap:0;}'
      +'.ctrl-card .pc-val .ctrl-card-main{margin:0 !important;display:flex;align-items:baseline;line-height:.85 !important;}'
      // NÚMERO (%FTP / rpm) — protagonista, bem grande
      +'.ctrl-card .pc-val .ctrl-card-value{font-size:var(--pcVal,84px) !important;line-height:.85 !important;font-weight:900 !important;}'
      +'.ctrl-card .pc-val .ctrl-card-unit{font-size:calc(var(--pcVal,84px) * .28) !important;}'
      +'.ctrl-card .pc-val .ctrl-card-zone{margin:0 !important;font-size:var(--pcZone,20px) !important;letter-spacing:1.2px !important;font-weight:800 !important;white-space:nowrap;}'
      +'.ctrl-card .pc-val .ctrl-bar-wrap{width:calc(var(--pcVal,84px) * 1.1) !important;}'
      // RODAPÉ — pequeno mas legível: WPP atual + watts absoluto
      +'.ctrl-card .pc-foot{width:100% !important;display:flex !important;align-items:baseline !important;gap:8px;font-family:"Barlow Condensed",sans-serif;padding-top:.4%;border-top:1px solid rgba(255,255,255,.08);}'
      +'.ctrl-card .pc-foot .pcf-wpp{font-size:var(--pcFoot,16px);font-weight:800;color:rgba(255,255,255,.9);white-space:nowrap;}'
      // 23/09c: marcha e FC no rodape. Ja eram lidas da Keiser (b.gear / b.bpm)
      // e guardadas no aluno, mas nenhum cartao as mostrava.
      +'.ctrl-card .pc-foot .pcf-x{font-size:var(--pcFoot,16px);font-weight:800;white-space:nowrap;}'
      +'.ctrl-card .pc-foot .pcf-hr{color:#ff5b6b;}'
      +'.ctrl-card .pc-foot .pcf-g{color:rgba(255,255,255,.75);}'
      +'.ctrl-card .pc-foot .pcf-w{font-size:var(--pcFoot,16px);font-weight:700;color:rgba(255,255,255,.5);white-space:nowrap;margin-left:auto;}';
    document.head.appendChild(s);
  }
  _pcInjectCSS();
  function mk(nome,valH,subH,cor){
    var c=document.createElement('div');c.className='ctrl-card';c.style.setProperty('--zc',cor);
    var a=(typeof alunosMap!=='undefined'&&alunosMap[nome])?alunosMap[nome]:{};
    var av;
    if(a.foto){
      av='<img class="ctrl-card-av" src="'+a.foto+'" alt="">';
    } else {
      var ph=a._virtual?(''+(a.bike||'')):((nome||'?').charAt(0).toUpperCase());
      av='<div class="ctrl-card-av ctrl-card-av-ph">'+ph+'</div>';
    }
    var wpp=(wppScores[nome]||0).toFixed(1);
    var wtxt=(a.watts!=null&&a.watts!=='')?(a.watts+' W'):'';
    var bikeTxt=(a.bike?('BIKE '+a.bike):'');
    var _fc=_hrDe(a), _mar=parseInt(a.gear,10)||0;
    c.innerHTML='<div class="pc-name">'+nome+'</div>'
      +(bikeTxt?'<div class="pc-bike">'+bikeTxt+'</div>':'')
      // Marca do aluno simulado. Demo e real podem conviver — nao disputam
      // bike nem dado —, mas na tela ficavam identicos. Numa demonstracao com
      // alguem entrando ao vivo, e preciso enxergar qual e o real.
      // (a variavel do aluno nesta funcao e "a"; usar "al[n]" aqui quebrava a
      //  montagem inteira do cartao — ReferenceError a cada atualizacao.)
      +((a&&a._demo)?'<div class="pc-demo">DEMO</div>':'')
      +'<div class="pc-body">'
        +'<div class="pc-av-wrap">'+av+'</div>'
        +'<div class="pc-val">'+valH+'</div>'
      +'</div>'
      +'<div class="pc-foot">'
        +'<span class="pcf-wpp">WPP '+wpp+'</span>'
        +(_fc>0?'<span class="pcf-x pcf-hr">\u2665 '+_fc+'</span>':'')
        +(_mar>0?'<span class="pcf-x pcf-g">M '+_mar+'</span>':'')
        +(wtxt?'<span class="pcf-w">'+wtxt+'</span>':'')
      +'</div>';
    return c;
  }
  if(fg){if(!ns.length)fg.innerHTML=empty;else{var _fgT=document.createElement('div');ns.forEach(function(n){var a=al[n],zk=a.zona||'z1',cor=ZC[zk]||'#888';_fgT.appendChild(mk(n,'<div class="ctrl-card-main"><span class="ctrl-card-value">'+(a.ftp||0)+'</span><span class="ctrl-card-unit">%</span></div><div class="ctrl-card-zone">'+(zN[zk]||zk)+'</div>',a.watts?'<div class="ctrl-card-sub">'+a.watts+' W absoluto</div>':'',cor));});_prMorphFilhos(fg,_fgT);}}
  if(rg){if(!ns.length)rg.innerHTML=empty;else{var _rgT=document.createElement('div');ns.forEach(function(n){var a=al[n],rpm=a.rpm||0,zk=a.zona||'z1',dentro=rpm>=rMin&&rpm<=rMax,cor=dentro?(ZC[zk]||'#888'):rpm>rMax?'#d7c414':'#d62d2d',st=dentro?''+rMin+'--'+rMax+' ok':rpm>rMax?''+rMin+'--'+rMax+' acima':''+rMin+'--'+rMax+' abaixo',pct=Math.min(100,Math.round((rpm/150)*100));_rgT.appendChild(mk(n,'<div class="ctrl-card-main"><span class="ctrl-card-value">'+rpm+'</span><span class="ctrl-card-unit">rpm</span></div><div class="ctrl-bar-wrap"><div class="ctrl-bar" style="width:'+pct+'%"></div></div>','<div class="ctrl-card-sub">Meta '+st+'</div>',cor));});_prMorphFilhos(rg,_rgT);}}
  if(hg){if(!ns.length)hg.innerHTML=empty;else{var _hgT=document.createElement('div');ns.forEach(function(n){var a=al[n],hr=_hrDe(a),mx=_fcMaxDe(a),pct=hr>0?Math.round(hr/mx*100):0,zf=_fcZona(pct),cor=hr>0?zf.c:'rgba(255,255,255,.25)';
    _hgT.appendChild(mk(n,'<div class="ctrl-card-main"><span class="ctrl-card-value">'+(hr>0?hr:'—')+'</span><span class="ctrl-card-unit">bpm</span></div><div class="ctrl-card-zone">'+(hr>0?zf.n:'sem cinta')+'</div>',hr>0?'<div class="ctrl-card-sub">'+pct+'% da FC máx ('+mx+')</div>':'',cor));});_prMorphFilhos(hg,_hgT);}}
}
var _IOS_APP_URL     = 'https://apps.apple.com/app/prorider/id000000000';   // TODO: substituir pelo link real
var _ANDROID_APK_URL = 'https://app.prorider.app.br/prorider.apk';
var _BROWSER_ALUNO_URL = 'https://app.prorider.app.br/aluno';


// 26/09d — LISTA DE ALUNOS DA TELA DO QR, SEM ROLAGEM (pedido do Mario).
// As linhas crescem para ocupar a altura livre (nome e foto grandes). Se nem
// com a linha minima couber todo mundo, mostra uma parte por 10 s e depois o
// resto, em rodizio. Atualizada no lugar (morph), sem piscar.
var QR_LIN_MIN=58, QR_LIN_MAX=96, QR_TROCA_MS=10000;
function _qrListaRender(){
  var list=document.getElementById('qrBigList'); if(!list||typeof alunosMap==='undefined') return;
  var _pal=['#2f6bff','#5db13d','#ea860c','#9b30ff','#d62d2d','#0fb5b5','#e0633a','#4f86ff'];
  var ks=Object.keys(alunosMap).filter(function(k){ return alunosMap[k]; });
  list.style.overflow='hidden'; list.style.position='relative';
  var H=list.clientHeight||600, nT=ks.length;
  var porPag=Math.max(1,Math.floor(H/QR_LIN_MIN));
  var pags=Math.max(1,Math.ceil(nT/porPag));
  var ini=0, vis=ks;
  if(pags>1){ var pg=Math.floor(Date.now()/QR_TROCA_MS)%pags; ini=Math.max(0,Math.min(pg*porPag,nT-porPag)); vis=ks.slice(ini,ini+porPag); }
  var rowH=Math.max(QR_LIN_MIN,Math.min(QR_LIN_MAX,Math.floor(H/Math.max(1,vis.length))));
  var fs=Math.round(rowH*0.40), av=Math.round(rowH*0.70), fs2=Math.round(rowH*0.36);
  var h=vis.map(function(n,i){
    var a=alunosMap[n]||{}, w=a.watts||0, hr=_hrDe(a);
    var peso=a.peso||a.weight||0, wkg=peso>0?((w/peso).toFixed(1)+' W/kg'):(w+' W');
    var ini2=String(n).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    var c=_pal[(ini+i)%_pal.length];
    var avH=a.foto
      ? '<div style="width:'+av+'px;height:'+av+'px;border-radius:50%;overflow:hidden;border:2px solid '+c+'88;flex-shrink:0;"><img src="'+a.foto+'" style="width:100%;height:100%;object-fit:cover;" alt=""></div>'
      : '<div style="width:'+av+'px;height:'+av+'px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:'+Math.round(av*0.4)+'px;color:'+c+';border:2px solid '+c+'88;background:'+c+'1e;flex-shrink:0;">'+ini2+'</div>';
    var fc=hr>0?('<span style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.65);font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:'+fs2+'px;flex-shrink:0;"><svg width="'+Math.round(fs2*0.8)+'" height="'+Math.round(fs2*0.8)+'" viewBox="0 0 24 24" fill="#d62d2d"><path d="M12 21s-7-4.4-9.3-8.6C1 9.2 2.6 5 6.6 5c2.2 0 3.6 1.3 4.4 2.5C11.8 6.3 13.2 5 15.4 5c4 0 5.6 4.2 3.9 7.4C19 16.6 12 21 12 21z"/></svg>'+hr+'</span>'):'';
    return '<div style="display:flex;align-items:center;gap:14px;height:'+rowH+'px;box-sizing:border-box;padding:0 6px;border-bottom:1px solid rgba(255,255,255,.06);">'
      +avH
      +'<div style="flex:1 1 auto;min-width:0;font-size:'+fs+'px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_desEsc(n)+'</div>'
      +fc
      +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:'+fs2+'px;min-width:'+Math.round(fs2*3.2)+'px;text-align:right;flex-shrink:0;">'+wkg+'</div>'
      +'</div>';
  }).join('');
  try{ var _qc=document.getElementById('qrBigCount'); if(_qc) _qc.textContent=nT+(pags>1?' · '+(ini+1)+'–'+(ini+vis.length):''); }catch(e){}
  if(!nT) h='<div style="color:rgba(255,255,255,.3);font-size:18px;text-align:center;padding-top:40px;">Aguardando alunos…</div>';
  _prMorphHTML(list,h);
}
function atualizaQR(){
  var code=salaCode||'--';
  var set=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  set('qrBigCode',code);set('qrBigCount',typeof alunosMap!=='undefined'?Object.keys(alunosMap).length:0);
  var qd=document.getElementById('qrBigDiv');if(qd&&qd.innerHTML===''){try{new QRCode(qd,{text:code,width:320,height:320,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});}catch(e){qd.textContent=code;} qd.removeAttribute('title');}
  var list=document.getElementById('qrBigList');
  _qrListaRender();
  // Gráfico do perfil da aula (mesma fonte da aula em execução)
  var gEl=document.getElementById('qrAulaGraf');
  if(gEl){
    var gWO=(typeof workout!=='undefined'&&workout)?workout:[];
    var gTot=gWO.reduce(function(a,b){return a+(b.duration||b.dur||1);},0)||1;
    var gH={z1:14,z2:28,z3:42,z4:56,z5:70,z6:84,z7:100};
    // 26/09b: barras no mesmo eixo de tempo da agulha (_prSec), posicionadas
    // em %, e a agulha do progresso por cima — e esta a tela que fica aberta
    // na parede durante a aula.
    var _gs=function(b){ return (typeof _prSec==='function'?_prSec(b):0) || ((b.duration||b.dur||1)*60) || 1; };
    var _gT=0; gWO.forEach(function(b){ _gT+=_gs(b); }); if(_gT<=0) _gT=1;
    var _gA=0;
    gEl.style.position='relative';
    gEl.innerHTML=gWO.map(function(b){var zk=toZKey(b.intensity!=null?b.intensity:b.z),c=ZC[zk]||'#888',h=gH[zk]||14;
        var x0=_gA/_gT*100; _gA+=_gs(b); var x1=_gA/_gT*100;
        return '<div style="position:absolute;bottom:0;left:'+x0.toFixed(3)+'%;width:'+(x1-x0).toFixed(3)+'%;height:'+h+'%;padding:0 1px;box-sizing:border-box;background:'+c+';background-clip:content-box;border-radius:3px 3px 0 0;"></div>';}).join('')
      + '<div id="qrAulaAgulhaFeito" style="position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(8,6,14,.55);pointer-events:none;z-index:2;"></div>'
      + '<div id="qrAulaAgulha" style="position:absolute;top:0;bottom:0;width:0;left:0;display:none;pointer-events:none;z-index:3;">'
      +   '<div style="position:absolute;top:-2px;bottom:-2px;left:-1px;width:2px;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.7);"></div>'
      +   '<div style="position:absolute;top:-5px;left:-5px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(255,255,255,.9);"></div>'
      + '</div>';
    _preAulaAgulhaMover();
  }
  // QR browser + links app — usa IP real da rede local
  var li=document.getElementById('linkIOS'); if(li) li.href=_IOS_APP_URL;
  var la=document.getElementById('linkAndroid'); if(la) la.href=_ANDROID_APK_URL;
  var bd=document.getElementById('qrBrowserDiv');
  var bu=document.getElementById('qrBrowserUrl');
  function _buildBrowserQR(browserUrl){
    if(bu) bu.textContent = browserUrl;
    if(bd && bd.innerHTML===''){try{new QRCode(bd,{text:browserUrl,width:240,height:240,colorDark:'#111',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});}catch(e){bd.textContent=browserUrl;} bd.removeAttribute('title');}
  }
  _buildBrowserQR(_BROWSER_ALUNO_URL);
}
// 26/09e — CAMPOS DO RANKING POR LICENCA. O gestor escolhe no Portal
// (Ranking na TV) quais colunas aparecem e por qual o ranking ordena. O
// Ginasio recebe na ativacao e em /display/licenca (a cada 15 min) e guarda
// no aparelho; sem configuracao, fica o ranking de sempre.
var RK_CAMPOS_OK=['zona','rpm','ftp','watts','kcal','fc','wpp'];
function _rkCfg(){
  var c=window._rankCfg;
  if(!c){ try{ c=JSON.parse(localStorage.getItem('pr_rank_cfg')||'null'); }catch(e){ c=null; } }
  var campos=(c&&Array.isArray(c.campos))?c.campos.filter(function(x){return RK_CAMPOS_OK.indexOf(x)>=0;}):[];
  if(!campos.length) campos=['zona','rpm','ftp','watts','kcal','wpp'];
  var ordem=(c&&['wpp','kcal','watts','ftp'].indexOf(c.ordem)>=0)?c.ordem:'wpp';
  return {campos:campos, ordem:ordem};
}
function _rkAplicarCfg(c){
  if(!c||!Array.isArray(c.campos)) return;
  var novo=JSON.stringify({campos:c.campos,ordem:c.ordem||'wpp'});
  var velho=null; try{ velho=localStorage.getItem('pr_rank_cfg'); }catch(e){}
  window._rankCfg={campos:c.campos,ordem:c.ordem||'wpp'};
  try{ localStorage.setItem('pr_rank_cfg', novo); }catch(e){}
  if(novo!==velho){
    console.log('[ProRider] ranking da TV: '+c.campos.join(', ')+' — ordem por '+(c.ordem||'wpp')+'.');
    try{ var l=document.getElementById('rankList'); if(l) l.innerHTML=''; }catch(e){}
  }
}
// 29/09a: brasão do aluno ao lado do nome (vem do app ao entrar na sala)
function _rkBrasao(nome){
  try{
    var n=(typeof alunosMap!=='undefined'&&alunosMap[nome])?alunosMap[nome].nivel:null;
    if(!n || !window.prBrasaoSVG || n==='iniciante'||n==='aquecimento') return '';
    return prBrasaoSVG(n, 40, true).replace('<svg ','<svg style="height:1.05em;width:auto;vertical-align:-.16em;margin-right:.22em" ');
  }catch(e){ return ''; }
}
function atualizaRanking(){
  // Injeta a legenda de zonas no rodapé do overlayRank (não depende do ginasio.html)
  try{
    var _ov=document.getElementById('overlayRank');
    if(_ov && !_ov.querySelector('.ctrl-rank-zonas')){
      var _z=document.createElement('div');
      _z.className='ctrl-rank-zonas';
      _z.innerHTML='<span class="crz-lbl">Zonas</span>'
        +'<div class="crz-item"><span class="crz-badge" style="color:#a1a1a1;border-color:#a1a1a155;background:#a1a1a11a;">Z1</span><div class="crz-txt"><b>Recovery</b><span>&lt; 55% FTP</span></div></div>'
        +'<div class="crz-item"><span class="crz-badge" style="color:#295fe8;border-color:#295fe855;background:#295fe81a;">Z2</span><div class="crz-txt"><b>Endurance</b><span>56–75% FTP</span></div></div>'
        +'<div class="crz-item"><span class="crz-badge" style="color:#5db13d;border-color:#5db13d55;background:#5db13d1a;">Z3</span><div class="crz-txt"><b>Tempo</b><span>76–90% FTP</span></div></div>'
        +'<div class="crz-item"><span class="crz-badge" style="color:#d7c414;border-color:#d7c41455;background:#d7c4141a;">Z4</span><div class="crz-txt"><b>Threshold</b><span>91–105% FTP</span></div></div>'
        +'<div class="crz-item"><span class="crz-badge" style="color:#ea860c;border-color:#ea860c55;background:#ea860c1a;">Z5</span><div class="crz-txt"><b>VO2 Max</b><span>106–120% FTP</span></div></div>'
        +'<div class="crz-item"><span class="crz-badge" style="color:#d62d2d;border-color:#d62d2d55;background:#d62d2d1a;">Z6</span><div class="crz-txt"><b>Anaerobic</b><span>&gt; 120% FTP</span></div></div>';
      var _nav=_ov.querySelector('.ctrl-nav-hint');
      if(_nav) _ov.insertBefore(_z,_nav); else _ov.appendChild(_z);
    }
  }catch(e){}
  var list=document.getElementById('rankList');
  if(!list) return;
  // (26/09c) sem limpar a lista: o morph abaixo atualiza no lugar

  var al  = typeof alunosMap!=='undefined' ? alunosMap : {};
  var zN  = {z1:'Recovery',z2:'Endurance',z3:'Tempo',z4:'Threshold',z5:'VO2 Max',z6:'Anaerobic',z7:'Neuromuscular'};

  // 26/09e: campos e ordem escolhidos pelo gestor no Portal (Ranking na TV)
  var _cfg=_rkCfg(), _campos=_cfg.campos;
  try{ var _sub=document.querySelector('#overlayRank .ctrl-subtitle');
    if(_sub) _sub.textContent={wpp:'Workout Performance Points',kcal:'Ordenado por calorias',watts:'Ordenado por potência média',ftp:'Ordenado por % do FTP'}[_cfg.ordem]; }catch(e){}
  // Build sorted array with accumulated stats
  var arr = Object.keys(wppScores).filter(function(n){ return al[n]; }).map(function(n){
    var st = alunoStats[n]||{rpmSum:0,ftpSum:0,wattsSum:0,ticks:1};
    var t  = Math.max(1, st.ticks);
    var _fcM = st.hrTicks ? Math.round(st.hrSum/st.hrTicks) : 0;
    var _fcA = (typeof _hrDe==='function') ? (_hrDe(al[n]||{})||0) : 0;
    return {
      nome:n, wpp:wppScores[n],
      zona:(al[n]||{}).zona||'z1',
      rpmMed  : Math.round(st.rpmSum/t),
      ftpMed  : Math.round(st.ftpSum/t),
      wattsMed: Math.round(st.wattsSum/t),
      kcal    : calcKcal(Math.round(st.wattsSum/t), t*0.1),
      fc      : _fcA || _fcM
    };
  });
  var _ordK={wpp:'wpp',kcal:'kcal',watts:'wattsMed',ftp:'ftpMed'}[_cfg.ordem]||'wpp';
  arr.sort(function(a,b){ return (b[_ordK]-a[_ordK]) || (b.wpp-a.wpp); });

  if(!arr.length){
    list.innerHTML='<div style="color:rgba(255,255,255,.3);font-size:18px;text-align:center;padding-top:80px;">Nenhum aluno conectado</div>';
    return;
  }

  // Header HTML
  var _HDR={zona:['rh-zona','ZONA'],rpm:['rh-stat','RPM MÉD'],ftp:['rh-stat','FTP MÉD'],watts:['rh-stat','WATTS'],kcal:['rh-stat','KCAL'],fc:['rh-stat','FC'],wpp:['rh-wpp','WPP']};
  function mkHeader(){
    return '<div class="ctrl-rank-header">'
      +'<div class="ctrl-rank-hcell rh-pos">POS</div>'
      +'<div class="ctrl-rank-hcell rh-nome">ALUNO</div>'
      +_campos.map(function(c){ var h=_HDR[c]; return '<div class="ctrl-rank-hcell '+h[0]+'">'+h[1]+'</div>'; }).join('')
      +'</div>';
  }

  // Row HTML
  function mkRow(a,i){
    var cor = ZC[a.zona]||'#888';
    var pc  = i===0?'top1':i===1?'top2':i===2?'top3':'';
    var dim = i>2?'opacity:.65':'';
    var ini = String(a.nome||'').split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w.charAt(0);}).join('').toUpperCase()||'?';
    var zlbl = String(a.zona||'z1').toUpperCase();
    var _rav = (al[a.nome]||{}).foto
      ? '<div class="ctrl-rank-av" style="border-color:'+cor+';overflow:hidden;padding:0;"><img src="'+(al[a.nome].foto)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>'
      : '<div class="ctrl-rank-av" style="border-color:'+cor+';">'+ini+'</div>';
    var _cel={
      zona:function(){ return '<div class="ctrl-rank-zcell"><span class="ctrl-rank-zbadge" style="color:'+cor+';border-color:'+cor+'55;background:'+cor+'1a;">'+zlbl+'</span></div>'; },
      rpm:function(){ return '<div class="ctrl-rank-cell" style="'+dim+'">'+a.rpmMed+'<span class="ctrl-rank-unit">rpm</span></div>'; },
      ftp:function(){ return '<div class="ctrl-rank-cell" style="'+dim+'">'+a.ftpMed+'<span class="ctrl-rank-unit">%</span></div>'; },
      watts:function(){ return '<div class="ctrl-rank-cell" style="'+dim+'">'+a.wattsMed+'<span class="ctrl-rank-unit">w</span></div>'; },
      kcal:function(){ return '<div class="ctrl-rank-cell" style="color:#ea860c;">'+a.kcal+'<span class="ctrl-rank-unit" style="color:rgba(234,134,12,.5);">kcal</span></div>'; },
      fc:function(){ return '<div class="ctrl-rank-cell" style="color:#ff5a6e;">'+(a.fc>0?a.fc:'—')+'<span class="ctrl-rank-unit" style="color:rgba(255,90,110,.5);">bpm</span></div>'; },
      wpp:function(){ return '<div class="ctrl-rank-wpp-wrap">'
        +'<div class="ctrl-rank-wpp"'+(i>2?' style="color:rgba(255,255,255,.4)"':'')+'>'+a.wpp.toFixed(1)+'</div>'
        +'<div class="ctrl-rank-wpp-lbl">pts</div>'
      +'</div>'; }
    };
    return '<div class="ctrl-rank-row'+(pc?' '+pc:'')+'">'
      +'<div class="ctrl-rank-pos">'+(i+1)+'</div>'
      +'<div class="ctrl-rank-nome-wrap">'
        +_rav
        +'<div style="min-width:0;">'
          +'<div class="ctrl-rank-name">'+_rkBrasao(a.nome)+a.nome+'</div>'
          +'<div class="ctrl-rank-detail" style="color:'+cor+';">'+(zN[a.zona]||a.zona)+'</div>'
        +'</div>'
      +'</div>'
      +_campos.map(function(c){ return _cel[c](); }).join('')
      +'</div>';
  }

  // Build column: header + rows wrapper with grid-template-rows
  function mkCol(rows, startIdx){
    var n = rows.length;
    // Com muitas linhas, o conteudo de cada uma precisa ENCOLHER — senao ele
    // transborda por cima da linha seguinte (sobreposicao vista em 18/09).
    // A classe define o tamanho da letra conforme quantas linhas ha na coluna.
    var _densi = (n>=14) ? ' rk-apertado' : ((n>=10) ? ' rk-medio' : '');
    var rowsDiv = '<div class="ctrl-rank-rows'+_densi+'" style="grid-template-rows:repeat('+n+',1fr);max-height:calc('+n+' * var(--rkRowH,132px));">';
    rows.forEach(function(a,i){ rowsDiv += mkRow(a, startIdx+i); });
    rowsDiv += '</div>';
    return '<div class="ctrl-rank-col">'+mkHeader()+rowsDiv+'</div>';
  }

  // ── Largura e tamanhos do ranking escalam pelo nº de alunos ──
  (function(){
    if(!document.getElementById('rkScaleCSS')){
      var st=document.createElement('style'); st.id='rkScaleCSS';
      st.textContent=''
        +'.ctrl-rank-list:not(.two-col) > .ctrl-rank-col{max-width:var(--rkMaxW,1050px) !important;}'
        +'.ctrl-rank-row,.ctrl-rank-header{grid-template-columns:var(--rkPosW,56px) minmax(0,var(--rkNomeFr,2.3fr)) var(--rkCols,minmax(0,.95fr) repeat(4,minmax(0,1fr)) minmax(0,1.25fr)) !important;padding:0 var(--rkPad,25px) !important;gap:var(--rkColGap,14px) !important;}'
        +'.ctrl-rank-nome-wrap{min-width:0 !important;overflow:hidden !important;}'
        +'.ctrl-rank-nome-wrap > div{min-width:0 !important;}'
        +'.ctrl-rank-name{min-width:0 !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;font-size:var(--rkName,37px) !important;}'
        +'.ctrl-rank-detail{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;}'
        +'.ctrl-rank-cell{font-size:var(--rkCell,50px) !important;}'
        +'.ctrl-rank-unit{font-size:var(--rkUnit,18px) !important;}'
        +'.ctrl-rank-detail{font-size:var(--rkDet,22px) !important;}'
        +'.ctrl-rank-wpp{font-size:var(--rkWpp,67px) !important;}'
        +'.ctrl-rank-wpp-lbl{font-size:var(--rkWppL,16px) !important;}'
        +'.ctrl-rank-pos{font-size:var(--rkPos,71px) !important;}'
        +'.ctrl-rank-av{width:var(--rkAv,56px) !important;height:var(--rkAv,56px) !important;font-size:calc(var(--rkAv,56px)*.46) !important;}'
        +'.ctrl-rank-zbadge{font-size:var(--rkZ,28px) !important;min-width:calc(var(--rkZ,28px)*2.3) !important;}'
        +'.ctrl-rank-hcell{font-size:var(--rkHead,16px) !important;}';
      (document.head||document.documentElement).appendChild(st);
    }
    // 26/09e: colunas conforme os campos escolhidos (menos campos = nome mais largo)
    list.style.setProperty('--rkCols', _campos.map(function(c){ return c==='zona'?'minmax(0,.95fr)':(c==='wpp'?'minmax(0,1.25fr)':'minmax(0,1fr)'); }).join(' '));
    var _nR=arr.length;
    var K = _nR<=4?1.62 : _nR<=6?1.44 : _nR<=8?1.28 : _nR<=10?1.14 : 1.0;
    window._rkAplicarK=function(K){
    var r=function(x){return Math.round(x*K);};
    var rb=function(x){return Math.round(x*(K>=1?(1+(K-1)*0.55):K));}; // pos/wpp: crescem menos, mas encolhem junto (26/09b)
    if(list){
      list.style.setProperty('--rkMaxW', _nR<=10 ? 'min(1780px,95vw)' : '100%');
      list.style.setProperty('--rkCell', r(50)+'px');
      list.style.setProperty('--rkUnit', r(18)+'px');
      list.style.setProperty('--rkName', r(37)+'px');
      list.style.setProperty('--rkDet',  r(22)+'px');
      list.style.setProperty('--rkWpp',  rb(67)+'px');
      list.style.setProperty('--rkWppL', r(16)+'px');
      list.style.setProperty('--rkPos',  rb(71)+'px');
      list.style.setProperty('--rkAv',   r(56)+'px');
      list.style.setProperty('--rkZ',    r(28)+'px');
      list.style.setProperty('--rkHead', r(16)+'px');
      list.style.setProperty('--rkPosW', r(56)+'px');
      list.style.setProperty('--rkZW',   r(82)+'px');
      list.style.setProperty('--rkCW',   r(100)+'px');
      list.style.setProperty('--rkKW',   r(92)+'px');
      list.style.setProperty('--rkWW',   r(118)+'px');
      list.style.setProperty('--rkPad',  r(25)+'px');
      list.style.setProperty('--rkRowH', r(132)+'px');
    }
    };
    window._rkK0=K; window._rkAplicarK(K);
  })();

  // 26/09d: mais de 20 alunos -> 20 por vez (10 por coluna), trocando a cada
  // 10 s; a ultima tela mostra os 20 ultimos. Assim as linhas nunca passam de
  // 10 por coluna e nome e foto ficam grandes.
  var _rkIni=0;
  if(arr.length>20){
    var _rkPags=Math.ceil(arr.length/20), _rkPg=Math.floor(Date.now()/10000)%_rkPags;
    _rkIni=Math.max(0,Math.min(_rkPg*20,arr.length-20));
    var _rkTot=arr.length; arr=arr.slice(_rkIni,_rkIni+20);
    try{ var _ov=document.getElementById('overlayRank'), _pgEl=_ov&&_ov.querySelector('#rkPagInfo');
      if(_ov&&!_pgEl){ _pgEl=document.createElement('div'); _pgEl.id='rkPagInfo'; _pgEl.style.cssText='position:absolute;top:34px;left:50%;transform:translateX(-50%);padding:4px 14px;border-radius:14px;background:rgba(255,255,255,.06);font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,.5);z-index:5;'; _ov.appendChild(_pgEl); }
      if(_pgEl) _pgEl.textContent=(_rkIni+1)+'º ao '+(_rkIni+arr.length)+'º de '+_rkTot; }catch(e){}
  } else { try{ var _pe=document.getElementById('rkPagInfo'); if(_pe) _pe.textContent=''; }catch(e){} }
  // 26/09c: aplica so o que mudou (antes: refazia a lista inteira 4x/s)
  if(arr.length <= 10 && _rkIni===0){
    list.classList.remove('two-col');
    _prMorphHTML(list, mkCol(arr, 0));
  } else {
    list.classList.add('two-col');
    var metade = Math.ceil(arr.length/2);
    _prMorphHTML(list, '<div class="ctrl-rank-twocol">'+mkCol(arr.slice(0,metade), _rkIni)+mkCol(arr.slice(metade), _rkIni+metade)+'</div>');
  }
  // 26/09b — ENCAIXE DAS LINHAS (foto da TV com 21 alunos): com 11 linhas por
  // coluna cada linha tinha ~58 px e o conteudo pedia ~86 — nomes, numeros e
  // a posicao saiam cortados. Em duas colunas saem o nome da zona sob o nome
  // (o selo Z1..Z7 ja diz) e as unidades sob os numeros (o cabecalho ja diz);
  // e, se ainda nao couber, a escala encolhe ate caber.
  try{
    list.classList.toggle('rk-enxuto', arr.length>10 || _rkIni>0);
    var _K=window._rkK0||1;
    for(var _t=0;_t<6;_t++){
      var _r0=list.querySelector('.ctrl-rank-row'); if(!_r0) break;
      var _h=_r0.clientHeight, _need=_r0.scrollHeight;
      if(!(_h>0) || _need<=_h+1) break;
      _K=Math.max(0.4,_K*(_h/_need)*0.97);
      window._rkAplicarK(_K);
      list.style.setProperty('--rkRowH', Math.round(132*(window._rkK0||1))+'px'); // a ALTURA da linha nao encolhe junto
    }
  }catch(e){}
}

var ftpModalFoco=1;
function ftpPedirConfirmacao(){
  var m=document.getElementById('modalEncerrarFTP');
  if(m){m.classList.add('active');ftpModalFoco=1;focusModalFTP();}
}
function ftpModalNao(){var m=document.getElementById('modalEncerrarFTP');if(m)m.classList.remove('active');}
function ftpModalSim(){
  var m=document.getElementById('modalEncerrarFTP');
  if(m)m.classList.remove('active');
  _mostrarResultadosFinalFTP();
}
function focusModalFTP(){document.querySelectorAll('#modalEncerrarFTP .ctrl-modal-btn').forEach(function(b,i){b.style.opacity=i===ftpModalFoco?'1':'0.45';});}

function _mostrarResultadosFinalFTP(){
  try{ _ftpAmostrar(); }catch(e){}
  clearInterval(_ftpAmostraInt); _ftpAmostraInt=null; // media congelada no fim do teste
  _ftpDecidirJa();
  var factor=_ftpCalcFactor[qbFtpMin]||0.95;
  // Fora do teste (parou de pedalar no arranque) nao entra no resultado e,
  // principalmente, NAO tem o FTP alterado.
  var _foraDoTeste=Object.values(alunosMap).filter(function(a){return a.nome && a._ftpParticipa===false;});
  var todos=Object.values(alunosMap).filter(function(a){return a.nome && a._ftpParticipa!==false;});
  if(_foraDoTeste.length) console.log('[ProRider] fora do teste (FTP intacto): '+_foraDoTeste.map(function(a){return a.nome;}).join(', '));
  // ── LIGA AS PONTAS: o FTP atingido vira o FTP do aluno (a partir de agora) ──
  // Aplica no próprio ginásio E manda pro app de cada aluno (que salva local + na conta).
  try{
    todos.forEach(function(a){
      var nf=_calcNovoFtp(a,factor);
      if(nf>0){
        a._ftpAntTeste=(a.ftpBase||150); // guarda o FTP antigo ANTES de trocar (pro "antes" e "+XW")
        a.ftpBase=nf; // ginásio passa a usar o novo FTP já
        var _w=a.watts||0; if(_w>0){ a.ftp=Math.round(_w/nf*100); if(typeof _zonaFromPct==='function') a.zona=_zonaFromPct(a.ftp); }
        if(wsProf&&wsProf.readyState===WebSocket.OPEN){
          wsProf.send(JSON.stringify({tipo:'ftp_resultado',nome:a.nome,ftp:nf,ant:a._ftpAntTeste,protocolo:qbFtpMin}));
        }
      }
    });
    try{ console.log('[ProRider] ftp_resultado enviado para',todos.length,'alunos'); }catch(e){}
    _ftpResultadosEnviados=true; // já enviei aqui → evita reenvio no encerrarTesteFTP
  }catch(e){ try{console.error('[ProRider] envio ftp_resultado:',e);}catch(_){} }
  // 26/09c: resultado no padrao das telas de desafio (podio por evolucao)
  window._ftpFinalSnap=null; window._ftpFinalSnap=_ftpLista(true); // congela quem participou e os numeros
  var _old=document.getElementById('ftpResultadosFinais'); if(_old) _old.remove();
  var _el=document.createElement('div'); _el.id='ftpResultadosFinais';
  _el.style.cssText='position:fixed;inset:0;z-index:21000;background:#06050c;overflow:hidden;';
  _el.innerHTML=_ftpTelaHTML(true);
  document.body.appendChild(_el); _desAjustar(_el); _prFade(_el);
  // lista com mais de 20: troca de pagina a cada 5 s (o numero nao muda: media congelada)
  clearInterval(window._ftpResPagInt);
  window._ftpResPagInt=setInterval(function(){
    var e=document.getElementById('ftpResultadosFinais'); if(!e){ clearInterval(window._ftpResPagInt); return; }
    var t=document.getElementById('ftpResTimer'), tv=t?t.textContent:null;
    _desPintarHTML(e,_ftpTelaHTML(true));
    var t2=document.getElementById('ftpResTimer'); if(t2&&tv) t2.textContent=tv;
  },1000);

  // Timer regressivo no canto
  var _t=60; // 1 minuto congelado mostrando o resultado
  var _tEl=document.getElementById('ftpResTimer');
  if(_tEl) _tEl.textContent=(Math.floor(_t/60))+':'+((_t%60)<10?'0':'')+(_t%60);
  window._ftpResInt=setInterval(function(){
    _t--;
    var tEl2=document.getElementById('ftpResTimer');
    if(tEl2) tEl2.textContent=(Math.floor(_t/60))+':'+((_t%60)<10?'0':'')+(_t%60);
    if(_t<=0){clearInterval(window._ftpResInt);fecharResultadosFinalFTP();}
  },1000);

  encerrarTesteFTPManual();
}

// 26/09c — FTP PELA MEDIA DO TESTE, como no app do aluno: FTP = potencia
// MEDIA do teste x fator do protocolo (20 min x 0,95; 10 min x 0,90 ...).
// Antes: potencia do INSTANTE dividida pelo fator — pegava so o ultimo
// segundo e ainda inflava (250 W / 0,95 = 263 W; o certo, com media de 250 W,
// e 238 W).
function _ftpWattsAgora(a){ return (_demoFtpMode && demoState[a.nome]) ? (demoState[a.nome].watts||0) : (a.watts||0); }
function _ftpMediaW(a){ return (a && a._ftpSeg>0) ? a._ftpSomaW/a._ftpSeg : _ftpWattsAgora(a||{}); }
function _calcNovoFtp(a, factor){
  var m=_ftpMediaW(a);
  return m>0 ? Math.round(m*factor) : 0;
}
var _ftpAmostraInt=null, _ftpAmostraT=0;
// 26/09d — QUEM PARTICIPA (regra do Mario): so quem mandou dados (pedal
// rodando) em algum momento dos 10 PRIMEIROS SEGUNDOS do teste. Quem ficou
// parado do inicio ate os 10 s, ou chegou depois, fica fora — e quem nao quer
// fazer o teste naquela hora nao precisa. A media conta desde o inicio.
var FTP_JANELA_S=10;
function _ftpAmostrar(){
  var agora=performance.now(), dt=Math.min(1,(agora-(_ftpAmostraT||agora))/1000); _ftpAmostraT=agora;
  var t=window._ftpT0?(Date.now()-window._ftpT0)/1000:0, dentroJanela=t<FTP_JANELA_S;
  Object.keys(alunosMap).forEach(function(n){
    var a=alunosMap[n]; if(!a||!a.nome) return;
    if(!dentroJanela && !a._ftpDecidido){
      a._ftpDecidido=true; a._ftpParticipa=!!a._ftpViu;
      if(!a._ftpParticipa) try{ console.log('[ProRider] teste FTP: '+n+' fora (sem dados nos 10 primeiros segundos).'); }catch(e){}
    }
    if(a._ftpParticipa===false) return;
    var w=_ftpWattsAgora(a);
    if(dentroJanela && w>=5) a._ftpViu=true;
    a._ftpSomaW=(a._ftpSomaW||0)+w*dt; a._ftpSeg=(a._ftpSeg||0)+dt;
  });
}
// encerrado antes dos 10 s: decide com o que houve ate ali
function _ftpDecidirJa(){
  Object.keys(alunosMap).forEach(function(n){ var a=alunosMap[n]; if(a&&a.nome&&!a._ftpDecidido){ a._ftpDecidido=true; a._ftpParticipa=!!a._ftpViu; } });
}

function fecharResultadosFinalFTP(){
  clearTimeout(window._ftpResultTimeout);
  clearInterval(window._ftpResInt); clearInterval(window._ftpResPagInt);
  var el=document.getElementById('ftpResultadosFinais');
  if(el) el.remove();
}

var _ftpResultadosEnviados=false;
function _enviarResultadosFTP(){
  if(_ftpResultadosEnviados) return; // trava: envia só uma vez por teste
  try{ _ftpDecidirJa(); }catch(e){}
  // Envia, por aluno, o FTP atingido no teste. O servidor entrega no socket do aluno (por nome).
  if(!(wsProf&&wsProf.readyState===WebSocket.OPEN)) return;
  _ftpResultadosEnviados=true;
  var factor=_ftpCalcFactor[qbFtpMin]||0.95;
  var _envc=0;
  Object.values(alunosMap).forEach(function(a){
    if(!a||!a.nome||a._ftpParticipa===false) return; // 26/09d: so quem participou
    var nf=_calcNovoFtp(a,factor);
    if(nf>0){
      wsProf.send(JSON.stringify({tipo:'ftp_resultado',nome:a.nome,ftp:nf,ant:(a.ftpBase||150),protocolo:qbFtpMin}));
      _envc++;
    }
  });
  try{ console.log('[ProRider] ftp_resultado enviado para',_envc,'aluno(s)'); }catch(e){}
}
function encerrarTesteFTPManual(){
  _fecharFtpPanel();
  encerrarTesteFTP(); // envia resultados (antes de limpar o demo) e para tudo
  // Notifica alunos para encerrar o teste
  if(wsProf&&wsProf.readyState===WebSocket.OPEN){
    wsProf.send(JSON.stringify({tipo:'fim_ftp'}));
  }
}

function ctrlAskConfirm(){
  // Se desafio ativo → modal encerrar desafio
  if(window._desafioAtivo){
    desafioPedirFim();
    return;
  }
  // Se teste FTP em curso → modal encerrar teste
  if(window._profFtpInt){
    ftpPedirConfirmacao();
    return;
  }
  // Se tela de resultados já está visível — SELECT não faz nada (navegação é com ←→ + START)
  var es=document.getElementById('endScreen');
  if(es&&es.classList.contains('show')) return;
  // Se em modo ranking pós-aula → vai para home
  if(boxMode==='endRanking'){ if(Date.now()>=_endUnlockedAt) resetCompleto(); return; }
  var m=document.getElementById('modalEncerrar');if(m){m.classList.add('active');modalEncFoco=1;focusModalEnc();}
}

var modalVoltarFoco=1;
function mostrarModalVoltar(){
  var m=document.getElementById('modalVoltar');
  if(!m){
    m=document.createElement('div');
    m.id='modalVoltar';
    m.className='ctrl-modal-wrap';
    m.innerHTML='<div class="ctrl-modal">'
      +'<div class="ctrl-modal-emoji">🏠</div>'
      +'<div class="ctrl-modal-title">Voltar ao início?</div>'
      +'<div class="ctrl-modal-sub">A sessão será encerrada e o programa voltará ao logo inicial.</div>'
      +'<div class="ctrl-modal-btns">'
      +'<button class="ctrl-modal-btn ctrl-modal-btn-cancel" onclick="fecharModalVoltar()"><span class="ctrl-modal-kbd">←</span> Cancelar</button>'
      +'<button class="ctrl-modal-btn ctrl-modal-btn-confirm" onclick="confirmarVoltar()">Voltar <span class="ctrl-modal-kbd">→</span></button>'
      +'</div>'
      +'<div class="ctrl-modal-hint">DIRECIONAL ← → navega · E confirma</div>'
      +'</div>';
    document.body.appendChild(m);
  }
  m.classList.add('active');
  modalVoltarFoco=1;
  focusModalVoltar();
}
function fecharModalVoltar(){ var m=document.getElementById('modalVoltar');if(m)m.classList.remove('active'); }
function confirmarVoltar(){ fecharModalVoltar(); resetCompleto(); }
function focusModalVoltar(){
  var btns=document.querySelectorAll('#modalVoltar .ctrl-modal-btn');
  btns.forEach(function(b,i){b.style.opacity=i===modalVoltarFoco?'1':'0.45';});
}
function ctrlConfirmNo(){var m=document.getElementById('modalEncerrar');if(m)m.classList.remove('active');}
function focusModalEnc(){document.querySelectorAll('#modalEncerrar .ctrl-modal-btn').forEach(function(b,i){b.style.opacity=i===modalEncFoco?'1':'0.45';});}
function ctrlConfirmYes(){
  var m=document.getElementById('modalEncerrar');if(m)m.classList.remove('active');
  // 26/09d: se o servidor estiver fora nesta hora, o aviso fica guardado e sai
  // assim que a conexao voltar (antes se perdia e os celulares seguiam em aula)
  // 03/10y: a conexão pode estar "aberta" e morta (internet sumiu sem aviso): o fim fica pendente até
  // um batimento DEPOIS dele voltar do servidor (prova de que chegou). Senão vai de novo ao religar.
  window._fimAulaPendente=true; window._fimAulaSala=salaCode; window._fimEnviadoEm=0;
  if(wsProf&&wsProf.readyState===WebSocket.OPEN){ try{ wsProf.send(JSON.stringify({tipo:'fim_aula'})); window._fimEnviadoEm=Date.now(); }catch(e){} }
  ctrlSetScreen(0);if(qbAberta)fecharQB();
  try{ if(typeof stopEverything==='function')stopEverything(); }catch(e){ console.error('[ProRider] stopEverything error:',e); }
  var lc=document.getElementById('liveClass');if(lc)lc.style.display='flex';
  if(typeof showEndScreen==='function') showEndScreen();
}

// ============================================================
// QUICK BAR
// ============================================================
// ══════════════════════════════════════════════════════════════
// SISTEMA DE DESAFIOS
// ══════════════════════════════════════════════════════════════
var desafio={
  ativo:false, tipo:'kcal', modo:'geral',
  timer:0, timerInt:null, panelInt:null,
  baseline:{}, potSum:{}, potCnt:{},
  equipes:{laranja:[],azul:[]},
  modalFoco:1
};

var _desafioNomes={kcal:'Gasto Calórico',dist:'Distância',potMedia:'Potência Média',potMax:'Potência Máxima',cabo:'Cabo de Guerra'};
var _desafioIcons={kcal:'🔥',dist:'📏',potMedia:'⚡',potMax:'💥',cabo:'🪢'};
// 26/09b — DESAFIOS EQUILIBRADOS (decisao do Mario): cada um compete contra o
// proprio FTP, para o forte e o iniciante terem a mesma chance.
//   Gasto calorico  -> PONTOS = kcal x 200 / FTP (as kcal que a pessoa gastaria
//                      com FTP 200). Premia o esforco, nao o tamanho do motor.
//   Potencia media  -> % DO FTP medio enquanto pedala.
//   Distancia       -> ja e equilibrada: vem da cadencia, nao da forca.
//   Potencia maxima -> BRUTA, em watts: e o sprint, quem gera mais pico vence.
var DES_FTP_REF=200;
var _desafioUnits={kcal:'pts',dist:'km',potMedia:'%FTP',potMax:'W',cabo:'%FTP'};
var _desafioRegra={kcal:'pontos = kcal ajustadas ao FTP de cada um',dist:'distância pela cadência',potMedia:'% do FTP de cada um',potMax:'pico de potência bruto',cabo:'a corda vai para o lado com mais esforço agora (% do FTP de cada um)'};
function _desFtpDe(nome){ var a=alunosMap[nome]||{}; var f=parseInt(a.ftpBase,10)||0; return f>0?f:150; }
var _desafioAberto=false;

// Navegação interna do submenu desafio
var _desafioSubRow=0; // 0=tipo, 1=modo
var _desafioSubTipoIdx=0; // 0=kcal,1=dist,2=potMedia,3=potMax
var _desafioSubModoIdx=0; // 0=geral,1=mvsf,2=equipes
var _desafioTipos=['kcal','dist','potMedia','potMax','cabo'];
var _desafioModos=['geral','mvsf','equipes'];

function qbDesafioAbrir(){
  _desafioAberto=!_desafioAberto;
  var sub=document.getElementById('qbDesafioSub');
  var btn=document.getElementById('qbDesafioBtn');
  var ftpSub=document.getElementById('qbFTPSub');
  if(ftpSub) ftpSub.style.display='none';
  if(sub) sub.style.display=_desafioAberto?'flex':'none';
  if(btn) btn.classList.toggle('active',_desafioAberto);
  if(_desafioAberto){ _desafioSubRow=0; _desafioSubTipoIdx=0; _desafioSubModoIdx=0; _desafioSubAtualizarFoco(); var el=document.getElementById('quickBar');if(el){clearTimeout(el._ac);el._ac=setTimeout(function(){if(qbAberta)fecharQB();},30000);} }
}

function _desafioSubAtualizarFoco(){
  // Tipo buttons
  document.querySelectorAll('.des-tipo').forEach(function(b,i){
    b.style.outline=(_desafioSubRow===0&&i===_desafioSubTipoIdx)?'2px solid #ea860c':'none';
    b.style.background=b.classList.contains('sel')?'rgba(234,134,12,.15)':(_desafioSubRow===0&&i===_desafioSubTipoIdx)?'rgba(255,255,255,.1)':'';
  });
  // Modo buttons
  document.querySelectorAll('.des-modo').forEach(function(b,i){
    b.style.outline=(_desafioSubRow===1&&i===_desafioSubModoIdx)?'2px solid #ea860c':'none';
    b.style.background=b.classList.contains('sel')?'rgba(234,134,12,.15)':(_desafioSubRow===1&&i===_desafioSubModoIdx)?'rgba(255,255,255,.1)':'';
  });
  // Botão Iniciar destaque quando em linha 1 e além dos modos
  var ini=document.querySelector('#qbDesafioSub .qb-ftp-confirm');
  if(ini) ini.style.outline=(_desafioSubRow===1&&_desafioSubModoIdx>=_desafioModos.length)?'2px solid #d7c414':'none';
}

function _desafioSubNavLeft(){
  if(_desafioSubRow===0) _desafioSubTipoIdx=Math.max(0,_desafioSubTipoIdx-1);
  else _desafioSubModoIdx=Math.max(0,_desafioSubModoIdx-1);
  _desafioSubAtualizarFoco();
}
function _desafioSubNavRight(){
  if(_desafioSubRow===0) _desafioSubTipoIdx=Math.min(_desafioTipos.length-1,_desafioSubTipoIdx+1);
  else _desafioSubModoIdx=Math.min(_desafioModos.length,_desafioSubModoIdx+1); // +1 para Iniciar
  _desafioSubAtualizarFoco();
}
function _desafioSubNavUp(){ _desafioSubRow=Math.max(0,_desafioSubRow-1); _desafioSubAtualizarFoco(); }
function _desafioSubNavDown(){ _desafioSubRow=Math.min(1,_desafioSubRow+1); _desafioSubAtualizarFoco(); }
function _desafioSubConfirmar(){
  if(_desafioSubRow===0){
    // Selecionar tipo
    var tipo=_desafioTipos[_desafioSubTipoIdx];
    var btn=document.querySelectorAll('.des-tipo')[_desafioSubTipoIdx];
    desafioSelTipo(tipo,btn);
    // Avançar para linha de modo
    _desafioSubRow=1; _desafioSubAtualizarFoco();
  } else {
    if(_desafioSubModoIdx>=_desafioModos.length){
      // Botão Iniciar
      desafioIniciar();
    } else {
      var modo=_desafioModos[_desafioSubModoIdx];
      var btn2=document.querySelectorAll('.des-modo')[_desafioSubModoIdx];
      desafioSelModo(modo,btn2);
      _desafioSubAtualizarFoco();
    }
  }
}

function desafioSelTipo(tipo,btn){
  desafio.tipo=tipo;
  document.querySelectorAll('.des-tipo').forEach(function(b){b.classList.remove('sel');});
  if(btn) btn.classList.add('sel');
}
function desafioSelModo(modo,btn){
  desafio.modo=modo;
  document.querySelectorAll('.des-modo').forEach(function(b){b.classList.remove('sel');});
  if(btn) btn.classList.add('sel');
}

function desafioIniciar(){
  fecharQB();
  try{ desafioFecharResultado(); }catch(e){}   // 07/10c: o resultado do desafio anterior não cobre o novo
  // Alunos demo no desafio APENAS se o demo estiver ligado na config (settingsDemo)
  if(demoWanted&&!demoOn&&typeof alunosMap!=='undefined'&&Object.keys(alunosMap).length===0&&typeof simularAlunos==='function') simularAlunos();
  // Snapshot baseline
  desafio.baseline={}; desafio.potSum={}; desafio.potCnt={}; desafio.potPico={}; desafio._seg=0; desafio._ultWs=0; desafio.congelado=null; desafio.congAula=null; desafio.congZona=null;
  Object.values(alunosMap).forEach(function(a){
    desafio.baseline[a.nome]={kcal:(a._kcalF!=null?a._kcalF:(a.kcal||0)),dist:a.dist||0,potMax:a.potMax||0};
    desafio.potSum[a.nome]=0; desafio.potCnt[a.nome]=0;
  });
  // Cabo de guerra precisa de dois lados: em Todos x Todos vira Equipes
  if(desafio.tipo==='cabo' && desafio.modo==='geral') desafio.modo='equipes';
  desafio.corda=0; desafio.caboA=0; desafio.caboB=0; desafio.caboDir=0; desafio._caboFim=false;
  // Formar equipes se necessário
  if(desafio.modo==='equipes') _desafioFormarEquipes();
  // Configurar painel
  desafio.ativo=true; desafio.timer=0;
  var icon=_desafioIcons[desafio.tipo]||'🏆';
  var titulo=_desafioNomes[desafio.tipo]||'Desafio';
  var sub={geral:'Todos vs Todos',mvsf:'Homens vs Mulheres',equipes:'🟠 Laranja vs 🔵 Azul'};
  var el=document.getElementById('desafioIcon'); if(el) el.textContent=icon;
  var el2=document.getElementById('desafioTitulo'); if(el2) el2.textContent=titulo;
  var el3=document.getElementById('desafioSubtitulo'); if(el3) el3.textContent=sub[desafio.modo]||'';
  var p=document.getElementById('desafioPanel');
  if(p){p.style.display='block';p.style.pointerEvents='auto'; _prFade(p);}
  // 26/09b: Homens x Mulheres tem tela propria, de ponta a ponta (sem a barra)
  var _bar=document.getElementById('desafioPanelBar'), _ct=document.getElementById('desafioConteudo');
  if(_bar) _bar.style.display='none';
  if(_ct) _ct.style.height='100%';
  // Timer
  clearInterval(desafio.timerInt);
  // 26/09c: o relogio do desafio roda a 4x por segundo, medido pelo tempo
  // real (antes: 1x por segundo, e a tela inteira era redesenhada — os
  // segundos e os numeros andavam aos trancos).
  desafio._ultTick=performance.now();
  desafio.timerInt=setInterval(function(){
    var agora=performance.now(), dt=Math.min(1,(agora-(desafio._ultTick||agora))/1000); desafio._ultTick=agora;
    if(desafio._autoBloco!=null && typeof isPlaying!=='undefined' && !isPlaying) return; // aula pausada: desafio do bloco pausa junto
    desafio._seg=(desafio._seg||0)+dt;
    desafio.timer=Math.floor(desafio._seg);
    try{ _caboPasso(dt); }catch(e){}
    var el=document.getElementById('desafioTimer');
    if(el) el.textContent=fmtMin(desafio.timer);
    // Acumular potência média (amostra ponderada pelo tempo) e o pico do desafio
    Object.values(alunosMap).forEach(function(a){
      if(a.watts>0){desafio.potSum[a.nome]=(desafio.potSum[a.nome]||0)+a.watts*dt;desafio.potCnt[a.nome]=(desafio.potCnt[a.nome]||0)+dt;}
      if((a.watts||0)>((desafio.potPico[a.nome])||0)) desafio.potPico[a.nome]=a.watts;
    });
  },100);
  // Painel update
  clearInterval(desafio.panelInt);
  desafio.panelInt=setInterval(_desafioRenderPanel,100); // 26/09c: 10x/s
  _desafioRenderPanel();
  // Notificar alunos
  if(wsProf&&wsProf.readyState===WebSocket.OPEN){
    wsProf.send(JSON.stringify({tipo:'iniciar_desafio',desafioTipo:desafio.tipo,desafioModo:desafio.modo,equipes:desafio.equipes}));
  }
  window._desafioAtivo=true;
}

function _desafioFormarEquipes(){
  var todos=Object.values(alunosMap).filter(function(a){return a.nome;});
  todos.sort(function(a,b){return (b.ftpBase||0)-(a.ftpBase||0);});
  desafio.equipes={laranja:[],azul:[]};
  todos.forEach(function(a,i){
    var eq=i%2===0?'laranja':'azul';
    desafio.equipes[eq].push(a.nome);
    alunosMap[a.nome].equipe=eq;
  });
}

function _desafioGetMetrica(nome){
  // 26/09c: desafio encerrado = numeros CONGELADOS no instante do fim.
  if(desafio.congelado) return desafio.congelado[nome]||0;
  var a=alunosMap[nome]; if(!a) return 0;
  var base=desafio.baseline[nome]||{};
  // 26/09c: kcal fracionaria (_kcalF) — o numero sobe aos poucos, sem degraus
  if(desafio.tipo==='kcal') return Math.max(0,(((a._kcalF!=null?a._kcalF:a.kcal)||0)-(base.kcal||0)))*DES_FTP_REF/_desFtpDe(nome);
  if(desafio.tipo==='dist') return Math.max(0,((a.dist||0)-(base.dist||0)));
  if(desafio.tipo==='potMax') return (desafio.potPico&&desafio.potPico[nome])||0; // 26/09c: pico DENTRO do desafio (antes era o da aula toda)
  if(desafio.tipo==='potMedia'||desafio.tipo==='cabo'){
    var cnt=desafio.potCnt[nome]||0;
    return cnt>0?Math.round((desafio.potSum[nome]/cnt)/_desFtpDe(nome)*100):0;
  }
  return 0;
}

function _desafioRenderPanel(){
  var cont=document.getElementById('desafioConteudo');
  if(!cont) return;
  var todos=Object.keys(alunosMap).filter(function(n){return alunosMap[n].nome;});
  todos.sort(function(a,b){return _desafioGetMetrica(b)-_desafioGetMetrica(a);});
  // 26/09b: os tres modos (geral, homens x mulheres, equipes) usam a tela nova
  // 26/09c: atualiza NO LUGAR (so muda o texto e as larguras que mudaram) em
  // vez de refazer a tela toda: as barras e a corda deslizam, sem piscar.
  _desPintar(cont,false);
  // Enviar update ranking para alunos (1x por segundo basta)
  if(Date.now()-(desafio._ultWs||0)<950) return;
  desafio._ultWs=Date.now();
  if(wsProf&&wsProf.readyState===WebSocket.OPEN){
    var ranking=todos.map(function(n,i){return {nome:n,pos:i+1,val:_desafioGetMetrica(n),equipe:alunosMap[n].equipe||null};});
    wsProf.send(JSON.stringify({tipo:'desafio_update',ranking:ranking,timer:desafio.timer}));
  }
}

function _desAvatar(nome,cor,esc){
  var S=esc||1, D=Math.round(56*S), F=Math.round(22*S);
  var a=(typeof alunosMap!=='undefined'&&alunosMap[nome])?alunosMap[nome]:{};
  if(a.foto) return '<div style="width:'+D+'px;height:'+D+'px;border-radius:50%;flex-shrink:0;overflow:hidden;border:2px solid '+cor+'66;"><img src="'+a.foto+'" style="width:100%;height:100%;object-fit:cover;" alt=""></div>';
  var ini=String(nome).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
  return '<div style="width:'+D+'px;height:'+D+'px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:'+F+'px;color:'+cor+';border:2px solid '+cor+'66;background:'+cor+'1e;">'+ini+'</div>';
}
function _desMedal(pos,esc){
  var S=esc||1, W=Math.round(52*S), MW=Math.round(44*S), MH=Math.round(48*S);
  if(pos>3) return '<div style="width:'+W+'px;text-align:center;font-family:Barlow Condensed,sans-serif;font-size:'+Math.round(36*S)+'px;font-weight:900;color:rgba(255,255,255,.5);flex-shrink:0;">'+pos+'</div>';
  var c=pos===1?'#ffcb45':pos===2?'#cfd3da':'#e0833a';
  return '<div style="width:'+W+'px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><div style="position:relative;width:'+MW+'px;height:'+MH+'px;"><svg viewBox="0 0 44 48" style="width:'+MW+'px;height:'+MH+'px;"><path d="M13 3h6l2 13h-9z" fill="'+c+'"/><path d="M31 3h-6l-2 13h9z" fill="'+c+'"/><circle cx="22" cy="30" r="16" fill="'+c+'"/><circle cx="22" cy="30" r="16" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2"/></svg><span style="position:absolute;top:'+Math.round(20*S)+'px;left:0;width:'+MW+'px;text-align:center;font-family:Barlow Condensed,sans-serif;font-weight:900;font-size:'+Math.round(20*S)+'px;color:#3a2600;">'+pos+'</span></div></div>';
}
function _desafioBuildTabela(nomes,unit,fmt,corDestaque,startPos,esc){
  if(!nomes.length) return '<div style="color:rgba(255,255,255,.25);font-size:16px;padding:20px;">Nenhum aluno</div>';
  var S=esc||1; var R=function(x){return Math.round(x*S);};
  var pal=['#ea860c','#2fb0d8','#9b30ff','#e6c020','#d62d2d','#5db13d','#e0559e','#2f6bff'];
  var base=startPos||0;
  var html='';
  nomes.forEach(function(nome,i){
    var a=alunosMap[nome]; if(!a) return;
    var val=_desafioGetMetrica(nome);
    var pos=base+i+1;
    var avc=corDestaque||pal[i%pal.length];
    var hi=pos<=3;
    html+='<div style="display:flex;align-items:center;gap:'+R(16)+'px;padding:'+R(17)+'px '+R(16)+'px;background:rgba(255,255,255,'+(hi?'.06':'.03')+');border:1px solid '+(hi?(corDestaque||'rgba(255,203,69,.3)'):'transparent')+';border-radius:13px;margin-bottom:'+R(8)+'px;">';
    html+=_desMedal(pos,S);
    html+=_desAvatar(nome,avc,S);
    html+='<div style="flex:1;font-size:'+R(34)+'px;font-weight:800;color:#fff;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.3px;">'+nome+'</div>';
    html+='<div style="font-family:Barlow Condensed,sans-serif;font-size:'+R(46)+'px;font-weight:900;color:'+(corDestaque||'#fff')+';white-space:nowrap;">'+fmt(val)+'<span style="font-size:'+R(22)+'px;color:rgba(255,255,255,.4);margin-left:4px;">'+unit+'</span></div>';
    html+='</div>';
  });
  return html;
}

// ══════════════════════════════════════════════════════════════
// 26/09b — DESAFIO HOMENS × MULHERES, TELA NOVA (modelo enviado pelo Mario)
// Tres colunas: HOMENS (azul) | centro (titulo, relogio, placar) | MULHERES
// (rosa). SEM ROLAGEM: cada lado mostra 10 por vez; com mais de 10, a lista
// troca sozinha para os proximos a cada 5 s (so ha um controle, ninguem rola).
// A mesma tela serve para o desafio ao vivo e para o RESULTADO FINAL.
// O vencedor e decidido pela MEDIA POR PESSOA de cada grupo — a soma
// favoreceria o grupo com mais gente na sala.
// ══════════════════════════════════════════════════════════════
var DES_POR_PAG=10, DES_TROCA_MS=5000;
// 26/09b — PROPOSTA (aguardando o Mario): ao vivo, 1-2-3 sem destaque (as
// posicoes mudam o tempo todo); no RESULTADO FINAL, um podio em cada coluna.
// true = proposta ligada; false = como esta hoje (1-2-3 dourado/prata/bronze).
var DES_PODIO_FINAL=true; // aprovado pelo Mario em 26/09
var DES_AZUL='#2f8bff', DES_ROSA='#ff4fb8';

function _desGrupos(){
  var todos=Object.keys(alunosMap).filter(function(n){return alunosMap[n]&&alunosMap[n].nome&&(!desafio.congelado||(n in desafio.congelado));});
  var ord=function(a,b){return _desafioGetMetrica(b)-_desafioGetMetrica(a);};
  var h=todos.filter(function(n){return (alunosMap[n].genero||'M')!=='F';}).sort(ord);
  var f=todos.filter(function(n){return (alunosMap[n].genero||'M')==='F';}).sort(ord);
  var soma=function(l){return l.reduce(function(s,n){return s+_desafioGetMetrica(n);},0);};
  var sh=soma(h), sf=soma(f);
  return {h:h,f:f,somaH:sh,somaF:sf,mediaH:h.length?sh/h.length:0,mediaF:f.length?sf/f.length:0};
}
function _desFmt(v){ return desafio.tipo==='dist'?(Math.round(v*100)/100).toFixed(2).replace('.',','):String(Math.round(v)); }
function _desEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

// Uma coluna (homens ou mulheres), ja paginada. Sempre 10 linhas de altura
// fixa: com menos alunos sobram linhas vazias, e a tela nunca "pula".
// Uma coluna da tela do desafio. lista = nomes JA ordenados; base = posicao
// do primeiro (para a coluna 11-20 do modo geral); quando pag=true a propria
// coluna pagina de 10 em 10 a cada 5 s.
function _desPodioHTML(lista,cor,op){
  var unit=_desafioUnits[desafio.tipo]||'';
  var pos=[1,0,2], cls=['dsx-pd2','dsx-pd1','dsx-pd3'];
  var h='<div class="dsx-podio3">';
  pos.forEach(function(i,k){
    var nome=lista[i];
    if(!nome){ h+='<div class="dsx-pd '+cls[k]+' dsx-pdv"></div>'; return; }
    var a=alunosMap[nome]||{}, corL=op.corPorAluno?op.corPorAluno(a):cor;
    var ini2=String(nome).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    var av=a.foto?'<img src="'+a.foto+'" alt="">':_desEsc(ini2);
    var prim=String(nome).trim().split(/\s+/); var curto=prim[0]+(prim[1]?' '+prim[1][0]+'.':'');
    h+='<div class="dsx-pd '+cls[k]+'">'
      +'<div class="dsx-pd-av" style="border-color:'+corL+';color:'+corL+';">'+av+'</div>'
      +'<div class="dsx-pd-nome">'+_desEsc(curto)+'</div>'
      +'<div class="dsx-pd-val" style="color:'+corL+';">'+_desFmt(_desafioGetMetrica(nome))+'<small>'+unit+'</small></div>'
      +'<div class="dsx-pd-bloco"><b>'+(i+1)+'</b></div></div>';
  });
  return h+'</div>';
}
function _desLinhas(vis,base,cor,op,nLin,destaque){
  var unit=_desafioUnits[desafio.tipo]||'';
  var linhas='';
  for(var i=0;i<nLin;i++){
    var nome=vis[i];
    if(!nome){ linhas+='<div class="dsx-row dsx-vazia"></div>'; continue; }
    var a=alunosMap[nome]||{}, pos=base+i+1;
    var med=!destaque?'':pos===1?'dsx-p1':pos===2?'dsx-p2':pos===3?'dsx-p3':'';
    var corL=op.corPorAluno?op.corPorAluno(a):cor;
    var ini2=String(nome).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    var av=a.foto?'<img src="'+a.foto+'" alt="">':_desEsc(ini2);
    linhas+='<div class="dsx-row'+(destaque&&pos<=3?' dsx-podio':'')+(!destaque&&pos===1?' dsx-lider1':'')+'">'
      +'<div class="dsx-pos '+med+'">'+pos+'</div>'
      +'<div class="dsx-av" style="border-color:'+corL+';color:'+corL+';">'+av+'</div>'
      +'<div class="dsx-nm"><div class="dsx-nome">'+_desEsc(nome)+'</div>'
      +'<i class="dsx-barra"><s style="width:'+(op.max>0?Math.max(2,Math.min(100,_desafioGetMetrica(nome)/op.max*100)):0).toFixed(1)+'%;background:'+corL+';"></s></i></div>'
      +'<div class="dsx-val" style="color:'+corL+';">'+_desFmt(_desafioGetMetrica(nome))+'<small>'+unit+'</small></div>'
      +'</div>';
  }
  return '<div class="dsx-lista" style="grid-template-rows:repeat('+nLin+', minmax(0,1fr));">'+linhas+'</div>';
}
function _desColuna(lista,cor,titulo,simbolo,op){
  op=op||{};
  // barra de cada aluno: proporcional ao lider da coluna (ideia das imagens
  // de referencia do Mario, 26/09)
  if(op.max==null){ op.max=0; lista.forEach(function(n){ var v=_desafioGetMetrica(n); if(v>op.max) op.max=v; }); }
  // PODIO no resultado final (proposta): os 3 primeiros no podio e a lista
  // segue do 4o em diante, 7 por pagina.
  if(op.podio && op.pag!==false){
    var resto=lista.slice(3), porPag=7;
    if(op.restoFixo) resto=resto.slice(0,porPag);
    var pags=Math.max(1,Math.ceil(resto.length/porPag));
    var pg=Math.floor(Date.now()/DES_TROCA_MS)%pags;
    var b0=Math.max(0,Math.min(pg*porPag, resto.length-porPag));
    var rod=lista.length+' '+(lista.length===1?'participante':'participantes');
    return '<div class="dsx-col" style="--dsxc:'+cor+';">'
      +'<div class="dsx-colhead"><span class="dsx-sim">'+simbolo+'</span><span class="dsx-tit">'+titulo+'</span><span class="dsx-pag">'+rod+'</span></div>'
      +_desPodioHTML(lista,cor,op)
      +_desLinhas(resto.slice(b0,b0+porPag),3+b0,cor,op,porPag,false)
      +'</div>';
  }
  var base=op.base||0, vis=lista, rodape;
  if(op.pag!==false){
    var pags=Math.max(1,Math.ceil(lista.length/DES_POR_PAG));
    var pg=Math.floor(Date.now()/DES_TROCA_MS)%pags;
    // ultima pagina incompleta mostra os 10 ULTIMOS (repete alguns da
    // anterior): a coluna fica sempre cheia, nunca com 1 nome sozinho
    base=Math.max(0,Math.min(pg*DES_POR_PAG, lista.length-DES_POR_PAG)); vis=lista.slice(base,base+DES_POR_PAG);
    if(op.offset){ base+=op.offset; }
    rodape=op.offset?((base+1)+'º ao '+(base+vis.length)+'º')
          :(pags>1?(base+1)+'–'+Math.min(lista.length,base+DES_POR_PAG)+' de '+lista.length
                 :lista.length+' '+(lista.length===1?'participante':'participantes'));
  } else rodape=op.rodape||'';
  var linhas=_desLinhas(vis,base,cor,op,DES_POR_PAG,!(DES_PODIO_FINAL&&!op.final));
  return '<div class="dsx-col" style="--dsxc:'+cor+';">'
    +'<div class="dsx-colhead"><span class="dsx-sim">'+simbolo+'</span><span class="dsx-tit">'+titulo+'</span><span class="dsx-pag">'+rodape+'</span></div>'
    +linhas+'</div>';
}

// 26/09b — EQUILIBRIO: em todo desafio de GRUPO (Homens x Mulheres e Equipes)
// vence a maior MEDIA POR PESSOA. Com grupos do mesmo tamanho da o mesmo que a
// soma; com tamanhos diferentes, nao premia quem tem mais gente.
function _desLados(){
  var ord=function(a,b){return _desafioGetMetrica(b)-_desafioGetMetrica(a);};
  var soma=function(l){return l.reduce(function(s,n){return s+_desafioGetMetrica(n);},0);};
  var med=function(l){return l.length?soma(l)/l.length:0;};
  if(desafio.modo==='equipes'){
    var L=(desafio.equipes.laranja||[]).filter(function(n){return alunosMap[n];}).slice().sort(ord);
    var A=(desafio.equipes.azul||[]).filter(function(n){return alunosMap[n];}).slice().sort(ord);
    return {a:L,b:A,mA:med(L),mB:med(A),corA:'#ea860c',corB:DES_AZUL,titA:'LARANJA',titB:'AZUL',simA:'●',simB:'●',
            grupoA:'EQUIPE LARANJA',grupoB:'EQUIPE AZUL',vA:'LARANJA VENCE!',vB:'AZUL VENCE!',sub:'LARANJA vs AZUL',chaveA:'laranja',chaveB:'azul'};
  }
  var g=_desGrupos();
  return {a:g.h,b:g.f,mA:g.mediaH,mB:g.mediaF,corA:DES_AZUL,corB:DES_ROSA,titA:'HOMENS',titB:'MULHERES',simA:'♂',simB:'♀',
          grupoA:'HOMENS',grupoB:'MULHERES',vA:'HOMENS VENCEM!',vB:'MULHERES VENCEM!',sub:'HOMENS vs MULHERES',chaveA:'M',chaveB:'F'};
}
// quem venceu (ou lidera): chave do grupo, 'empate' ou null sem dados
function _desVencedor(){
  if(desafio.modo==='geral') return null;
  var l=_desLados();
  if(desafio.tipo==='cabo'){
    var c=desafio.corda||0;
    if(Math.abs(c)<0.5) return (desafio.timer>0?'empate':null);
    return c<0?l.chaveA:l.chaveB;
  }
  var t=l.mA+l.mB;
  if(t<=0) return null;
  if(Math.abs(l.mA-l.mB)<1e-9) return 'empate';
  return l.mA>l.mB?l.chaveA:l.chaveB;
}


// ══ 26/09b — CABO DE GUERRA ════════════════════════════════════════
// Dois lados (Equipes ou Homens x Mulheres). A cada segundo a corda anda
// para o lado cuja MEDIA DE ESFORCO AGORA (% do FTP de cada um, quem nao
// pedala conta 0) esta maior; quanto maior a diferenca, mais rapido anda.
// corda vai de -100 (lado A puxou tudo) a +100 (lado B). Chegou na ponta,
// acaba sozinho; se o professor encerrar antes, vence quem esta com a corda.
// Tempo: o do proprio desafio — o professor para quando quiser.
var CABO_K=0.17;          // 10 %FTP de diferenca sustentada ~ 60 s ate a ponta
var CABO_MAX_PASSO=5;     // no maximo 5% da corda por segundo
function _caboEsforcoAgora(lista){
  if(!lista.length) return 0;
  var s=0; lista.forEach(function(n){ var a=alunosMap[n]||{}; s+=Math.max(0,(a.watts||0))/_desFtpDe(n)*100; });
  return s/lista.length;
}
function _caboPasso(dt){
  if(desafio.tipo!=='cabo' || !desafio.ativo) return;
  dt=(dt>0)?dt:1;
  var l=_desLados();
  var eA=_caboEsforcoAgora(l.a), eB=_caboEsforcoAgora(l.b);
  desafio.caboA=eA; desafio.caboB=eB;
  var d=Math.max(-CABO_MAX_PASSO,Math.min(CABO_MAX_PASSO,(eB-eA)*CABO_K))*dt;
  desafio.corda=Math.max(-100,Math.min(100,(desafio.corda||0)+d));
  desafio.caboDir=d<-0.05*dt?-1:(d>0.05*dt?1:0);
  if(Math.abs(desafio.corda)>=100 && !desafio._caboFim){
    desafio._caboFim=true;
    setTimeout(function(){ if(desafio.ativo) _desafioMostrarResultadoFinais(); },1200);
  }
}
function _caboHTML(l){
  var c=desafio.corda||0, wA=50-c/2;           // parte de A = dominio de A
  var dir=desafio.caboDir||0;
  // a area de cada cor = dominio daquele lado; as setas empurram o no para
  // dentro do lado que esta perdendo (como na imagem de referencia)
  var setas=dir<0?'<span class="dsx-cb-setas" style="left:'+Math.max(2,wA-13).toFixed(1)+'%;">▶▶▶</span>'
           :dir>0?'<span class="dsx-cb-setas" style="left:'+Math.min(86,wA+2).toFixed(1)+'%;">◀◀◀</span>':'';
  return '<div class="dsx-cabo">'
    +'<div class="dsx-cb-barra">'
      +'<div class="dsx-cb-a" style="width:'+wA.toFixed(2)+'%;background:linear-gradient(90deg,'+l.corA+','+l.corA+'cc);"></div>'
      +'<div class="dsx-cb-b" style="background:linear-gradient(90deg,'+l.corB+'cc,'+l.corB+');"></div>'
      +'<div class="dsx-cb-no" style="left:'+wA.toFixed(2)+'%;"></div>'+setas
    +'</div>'
    +'<div class="dsx-cb-leg"><b style="color:'+l.corA+'">'+Math.round(desafio.caboA||0)+'%</b><i>ESFORÇO AGORA</i><b style="color:'+l.corB+'">'+Math.round(desafio.caboB||0)+'%</b></div>'
    +'</div>';
}
function _desTelaHTML(final){
  var nomeD=(_desafioNomes[desafio.tipo]||'Desafio').toUpperCase();
  var icon=_desafioIcons[desafio.tipo]||'🏆';
  var unit=_desafioUnits[desafio.tipo]||'';
  var aulaTxt='—', zonaTxt='—';
  try{ aulaTxt=(final&&desafio.congAula)?desafio.congAula:formatTime(window._prDoneSecAgora||0); }catch(e){}
  try{ var bl=workout[currentBlockIndex]; if(bl){ zonaTxt=(bl.ftpMin>0?bl.ftpMin+'–':'< ')+(bl.ftpMax||bl.ftpMin)+'%'; } }catch(e){}
  if(final && desafio.congZona) zonaTxt=desafio.congZona;
  var R=46, C=2*Math.PI*R;
  var colA, colB, sub, faixa, corL, anel, st1, st2;
  if(desafio.modo==='geral'){
    // Todos contra todos: coluna da esquerda 1-10, da direita 11-20; com mais
    // de 20, as duas trocam juntas a cada 5 s (21-30 | 31-40 ...).
    var todos=Object.keys(alunosMap).filter(function(n){return alunosMap[n]&&alunosMap[n].nome&&(!desafio.congelado||(n in desafio.congelado));})
      .sort(function(a,b){return _desafioGetMetrica(b)-_desafioGetMetrica(a);});
    var porTela=DES_POR_PAG*2, pags=Math.max(1,Math.ceil(todos.length/porTela));
    var pg=Math.floor(Date.now()/DES_TROCA_MS)%pags, ini=Math.max(0,Math.min(pg*porTela, todos.length-porTela));
    var esq=todos.slice(ini,ini+DES_POR_PAG), dir=todos.slice(ini+DES_POR_PAG,ini+porTela);
    var faixaTxt=function(l,b){ return l.length?(b+1)+'º ao '+(b+l.length)+'º':''; };
    var corG=function(a){ return a.genero==='F'?DES_ROSA:DES_AZUL; };
    var maxG=todos.length?_desafioGetMetrica(todos[0]):0;
    if(final && DES_PODIO_FINAL){
      // resultado final: podio + 4o ao 10o na esquerda; 11o em diante na direita
      colA=_desColuna(todos,'#ea860c','PÓDIO','🏆',{podio:true,restoFixo:true,final:true,max:maxG,corPorAluno:corG});
      colB=todos.length>10?_desColuna(todos.slice(10),'#e6c020','CLASSIFICAÇÃO','🏁',{final:true,offset:10,max:maxG,corPorAluno:corG})
                          :_desColuna([],'#e6c020','CLASSIFICAÇÃO','🏁',{pag:false,final:true,max:maxG,rodape:''});
    } else {
    colA=_desColuna(esq,'#ea860c','CLASSIFICAÇÃO','🏆',{pag:false,final:final,max:maxG,base:ini,rodape:faixaTxt(esq,ini)+(pags>1?' · de '+todos.length:''),corPorAluno:corG});
    colB=_desColuna(dir,'#e6c020','CLASSIFICAÇÃO','🏁',{pag:false,final:final,max:maxG,base:ini+DES_POR_PAG,rodape:faixaTxt(dir,ini+DES_POR_PAG),corPorAluno:corG});
    }
    sub='TODOS vs TODOS';
    var lider=todos[0], soma=todos.reduce(function(s,n){return s+_desafioGetMetrica(n);},0);
    faixa=lider?((final?'VENCEDOR: ':'LÍDER: ')+_desEsc(String(lider).split(/\s+/)[0].toUpperCase())):'VALENDO!';
    corL='#ffd23f';
    anel='<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="#ea860c" stroke-width="5" opacity=".95"/>';
    st1='<div><i>🏆</i><b style="color:#ffd23f">'+(lider?_desFmt(_desafioGetMetrica(lider)):'—')+'<small>'+unit+'</small></b><span>'+(final?'VENCEDOR':'LÍDER')+'</span></div>';
    st2='<div><i>👥</i><b>'+_desFmt(todos.length?soma/todos.length:0)+'<small>'+unit+'</small></b><span>MÉDIA DA TURMA</span></div>';
  } else {
    var l=_desLados(), v=_desVencedor();
    var _po={final:final,podio:final&&DES_PODIO_FINAL};
    colA=_desColuna(l.a,l.corA,l.titA,l.simA,_po);
    colB=_desColuna(l.b,l.corB,l.titB,l.simB,_po);
    sub=l.sub;
    var tot=l.mA+l.mB, pA=tot>0?l.mA/tot:0.5;
    if(desafio.tipo==='cabo') pA=0.5-(desafio.corda||0)/200;   // o anel acompanha a corda
    anel='<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+l.corB+'" stroke-width="5" opacity=".9"/>'
        +'<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+l.corA+'" stroke-width="5" stroke-dasharray="'+(C*pA).toFixed(2)+' '+C.toFixed(2)+'" transform="rotate(-90 50 50)"/>';
    if(!v){ faixa='VALENDO!'; corL='#e6c020'; }
    else if(v==='empate'){ faixa=final?'EMPATE!':'EMPATADO'; corL='#e6c020'; }
    else { var ehA=(v===l.chaveA); corL=ehA?l.corA:l.corB; faixa=final?(ehA?l.vA:l.vB):((ehA?l.grupoA:l.grupoB)+' NA FRENTE'); }
    st1='<div><i style="color:'+l.corA+'">'+l.simA+'</i><b style="color:'+l.corA+'">'+_desFmt(l.mA)+'<small>'+unit+'</small></b><span>MÉDIA '+l.titA+'</span></div>';
    st2='<div><i style="color:'+l.corB+'">'+l.simB+'</i><b style="color:'+l.corB+'">'+_desFmt(l.mB)+'<small>'+unit+'</small></b><span>MÉDIA '+l.titB+'</span></div>';
  }
  return '<div class="dsx">'
    +'<div class="dsx-bg'+(desafio.modo==='equipes'?' dsx-bg-eq':desafio.modo==='geral'?' dsx-bg-ge':'')+'"></div>'
    +'<div class="dsx-top"><div class="dsx-logo"><img src="logo-prorider.png" alt="ProRider" style="height:58px;display:block;"></div>'
    +'<div class="dsx-tipo"><b>'+_desEsc(nomeD)+'</b><i>'+sub+(desafio.tipo==='potMax'?' · BRUTO':' · EQUILIBRADO')+'</i></div></div>'
    +'<div class="dsx-grid">'+colA
    +'<div class="dsx-centro'+(desafio.tipo==='cabo'?' dsx-centro-cabo':'')+'">'
      +'<div class="dsx-fogo">'+icon+'</div>'
      +'<div class="dsx-h1">'+(final?'RESULTADO <b>FINAL</b>':'DESAFIO <b>AO VIVO</b>')+'</div>'
      +'<div class="dsx-h2">'+_desEsc(nomeD)+'</div>'
      +'<div class="dsx-lider" style="color:'+corL+';">'+faixa+'</div>'
      +'<div class="dsx-anel"><svg viewBox="0 0 100 100">'+anel
        +'<circle cx="50" cy="50" r="39" fill="rgba(6,8,16,.92)" stroke="rgba(255,255,255,.08)"/></svg>'
        +'<div class="dsx-anel-in"><span>'+icon+'</span><b>'+((!final&&desafio._autoBloco!=null)?fmtMin(Math.max(0,Math.ceil(desafio._autoRest||0))):fmtMin(desafio.timer||0))+'</b><i>'+(final?'DURAÇÃO':(desafio._autoBloco!=null?'FALTA NO DESAFIO':'TEMPO DE DESAFIO'))+'</i></div></div>'
      +(desafio.tipo==='cabo'&&desafio.modo!=='geral'?_caboHTML(_desLados()):'')
      +'<div class="dsx-stats">'+st1+st2
        +'<div><i>⚡</i><b style="color:#9be15d">'+zonaTxt+'</b><span>ZONA ATUAL</span></div>'
        +'<div><i>⏱</i><b>'+aulaTxt+'</b><span>TEMPO DE AULA</span></div>'
      +'</div>'
      +'<div class="dsx-nota">'+(_desafioRegra[desafio.tipo]||'')+(desafio.modo==='geral'||desafio.tipo==='cabo'?'':' · vence a maior média por pessoa')+(final?' · START fecha':'')+'</div>'
    +'</div>'+colB
    +'</div><div class="dsx-linha"></div></div>';
}
// nomes antigos, mantidos para quem ainda chama
function _desMvsfHTML(final){ return _desTelaHTML(final); }

// Encolhe a letra de quem nao couber na largura (a fonte da TV pode ser a de
// reserva, mais larga, quando o Bebas Neue nao carrega sem internet).

// 26/09c — ATUALIZACAO SUAVE DA TELA DO DESAFIO
var DES_FIT_SEL='.dsx-h1,.dsx-h2,.dsx-stats b,.dsx-stats span,.dsx-tit,.dsx-pag,.dsx-lider,.dsx-anel-in i,.dsx-tipo b,.dsx-anel-in b';
function _desMorph(a,b,mud){
  if(a.nodeType!==b.nodeType || a.nodeName!==b.nodeName){ var c=b.cloneNode(true); a.parentNode.replaceChild(c,a); mud.push(c); return; }
  if(a.nodeType===3){ if(a.nodeValue!==b.nodeValue){ a.nodeValue=b.nodeValue; mud.push(a.parentNode); } return; }
  if(a.nodeType!==1) return;
  var fit=a.matches && a.matches(DES_FIT_SEL);
  var i, at;
  for(i=0;i<b.attributes.length;i++){ at=b.attributes[i];
    if(fit && at.name==='style') continue;
    if(a.getAttribute(at.name)!==at.value) a.setAttribute(at.name,at.value); }
  for(i=a.attributes.length-1;i>=0;i--){ at=a.attributes[i];
    if(fit && at.name==='style') continue;
    if(!b.hasAttribute(at.name)) a.removeAttribute(at.name); }
  var ca=a.childNodes, cb=b.childNodes;
  if(ca.length!==cb.length){ a.innerHTML=b.innerHTML; mud.push(a); return; }
  for(i=0;i<cb.length;i++) _desMorph(ca[i],cb[i],mud);
}
function _desPintar(cont,final){ _desPintarHTML(cont,_desTelaHTML(final)); }
function _desPintarHTML(cont,html){
  var tmp=document.createElement('div'); tmp.innerHTML=html;
  var novo=tmp.firstElementChild, cur=cont.firstElementChild;
  if(!cur || !novo || cur.className!==novo.className){ cont.innerHTML=''; if(novo) cont.appendChild(novo); _desAjustar(cont); return; }
  var mud=[]; _desMorph(cur,novo,mud);
  // so reajusta a letra de quem mudou de texto (medir tudo 4x/s pesaria)
  var alvos=[];
  mud.forEach(function(el){
    if(!el || el.nodeType!==1) return;
    if(el.matches(DES_FIT_SEL)) alvos.push(el);
    else if(el.closest){ var f=el.closest(DES_FIT_SEL); if(f) alvos.push(f); else el.querySelectorAll && el.querySelectorAll(DES_FIT_SEL).forEach(function(x){ alvos.push(x); }); }
  });
  if(alvos.length) _desAjustarEls(alvos);
}
function _desAjustarEls(alvos){
  try{
    alvos.forEach(function(el){
      el.style.fontSize='';
      var fs=parseFloat(getComputedStyle(el).fontSize)||16, n=0;
      var cabe=function(){
        if(el.classList.contains('dsx-tit')||el.classList.contains('dsx-pag')){ var h=el.parentNode; return h.scrollWidth<=h.clientWidth+1; }
        return el.scrollWidth<=el.clientWidth+1;
      };
      while(!cabe() && n<30){ fs*=0.94; el.style.fontSize=fs.toFixed(1)+'px'; n++; }
    });
  }catch(e){}
}
function _desAjustar(raiz){
  try{
    var alvos=raiz.querySelectorAll('.dsx-h1,.dsx-h2,.dsx-stats b,.dsx-stats span,.dsx-tit,.dsx-pag,.dsx-lider,.dsx-anel-in i,.dsx-tipo b,.dsx-anel-in b');
    alvos.forEach(function(el){
      el.style.fontSize='';
      var fs=parseFloat(getComputedStyle(el).fontSize)||16, n=0;
      var cabe=function(){
        if(el.classList.contains('dsx-tit')||el.classList.contains('dsx-pag')){ var h=el.parentNode; return h.scrollWidth<=h.clientWidth+1; }
        return el.scrollWidth<=el.clientWidth+1;
      };
      while(!cabe() && n<30){ fs*=0.94; el.style.fontSize=fs.toFixed(1)+'px'; n++; }
    });
  }catch(e){}
}
function _desMvsfPaginas(){
  if(desafio.modo==='geral'){ var n=Object.keys(alunosMap).filter(function(k){return alunosMap[k]&&alunosMap[k].nome;}).length; return Math.max(1,Math.ceil(n/(DES_POR_PAG*2))); }
  var l=_desLados();
  return Math.max(Math.ceil(l.a.length/DES_POR_PAG),Math.ceil(l.b.length/DES_POR_PAG),1);
}
// Resultado final HxM: ocupa a tela toda; troca de pagina a cada 5 s se preciso.
function _desMvsfResultadoTela(){
  var el=document.createElement('div');
  el.id='desafioResultadoFinal';
  el.style.cssText='position:fixed;inset:0;z-index:21000;background:#06050c;overflow:hidden;';
  el.innerHTML=_desTelaHTML(true);
  el.addEventListener('click',function(ev){ if(ev.target.closest('.dsx-lista')) return; desafioFecharResultado(); });
  document.body.appendChild(el); _desAjustar(el); _prFade(el);
  clearInterval(window._desResPagInt);
  if(_desMvsfPaginas()>1){
    window._desResPagInt=setInterval(function(){
      var e=document.getElementById('desafioResultadoFinal');
      if(!e){ clearInterval(window._desResPagInt); return; }
      _desPintar(e,true);
    },1000);
  }
  // com lista paginada o professor precisa de mais tempo para ver todos
  window._desafioResTimeout=setTimeout(desafioFecharResultado, _desMvsfPaginas()>1?60000:30000);
}

// Encerrar desafio
var _desafioEncModalFoco=1;
function desafioPedirFim(){
  var m=document.getElementById('modalEncerrarDesafio');
  if(m){m.classList.add('active');_desafioEncModalFoco=1;_desafioFocusModal();}
}
function _desafioFocusModal(){
  document.querySelectorAll('#modalEncerrarDesafio .ctrl-modal-btn').forEach(function(b,i){b.style.opacity=i===_desafioEncModalFoco?'1':'0.45';});
}
function desafioModalNao(){var m=document.getElementById('modalEncerrarDesafio');if(m)m.classList.remove('active');}
function desafioModalSim(){
  var m=document.getElementById('modalEncerrarDesafio');if(m)m.classList.remove('active');
  _desafioMostrarResultadoFinais();
}

function _desafioMostrarResultadoFinais(){
  clearInterval(desafio.timerInt); clearInterval(desafio.panelInt);
  // 26/09c: congela os numeros do resultado (antes continuavam mudando com
  // a turma pedalando, na TV, enquanto o resultado estava aberto)
  try{
    var _cg={}; Object.keys(alunosMap).forEach(function(n){ if(alunosMap[n]&&alunosMap[n].nome) _cg[n]=_desafioGetMetrica(n); });
    desafio.congelado=_cg;
    desafio.congAula=(function(){ try{ return formatTime(window._prDoneSecAgora||0); }catch(e){ return '—'; } })();
    desafio.congZona=(function(){ try{ var b=workout[currentBlockIndex]; return b?((b.ftpMin>0?b.ftpMin+'–':'< ')+(b.ftpMax||b.ftpMin)+'%'):'—'; }catch(e){ return '—'; } })();
  }catch(e){}
  desafio.ativo=false; window._desafioAtivo=false;
  // Fechar painel
  var p=document.getElementById('desafioPanel');
  if(p){p.style.display='none';p.style.pointerEvents='none';}
  // Notificar alunos
  if(wsProf&&wsProf.readyState===WebSocket.OPEN){
    var todos=Object.keys(alunosMap).filter(function(n){return alunosMap[n].nome;});
    todos.sort(function(a,b){return _desafioGetMetrica(b)-_desafioGetMetrica(a);});
    // 26/09b: cada aluno recebe tambem a posicao DENTRO do grupo dele
    // (homens/mulheres ou equipe), o tamanho do grupo e quem venceu — o app
    // mostra isso no celular por 10 s.
    var _g=_desGrupos(), _venc=_desVencedor();
    var ranking=todos.map(function(n,i){
      var a=alunosMap[n]||{}, gen=(a.genero==='F')?'F':'M', grupo=null;
      if(desafio.modo==='mvsf') grupo=(gen==='F')?_g.f:_g.h;
      if(desafio.modo==='equipes'){ grupo=(desafio.equipes[a.equipe]||[]).slice().sort(function(x,y){return _desafioGetMetrica(y)-_desafioGetMetrica(x);}); }
      return {nome:n,pos:i+1,de:todos.length,val:_desafioGetMetrica(n),equipe:a.equipe||null,genero:gen,
              posGrupo:grupo?(grupo.indexOf(n)+1):null, deGrupo:grupo?grupo.length:null};
    });
    wsProf.send(JSON.stringify({tipo:'fim_desafio',ranking:ranking,desafioTipo:desafio.tipo,desafioModo:desafio.modo,
      nomeDesafio:_desafioNomes[desafio.tipo]||'Desafio',unidade:_desafioUnits[desafio.tipo]||'',regra:_desafioRegra[desafio.tipo]||'',vencedor:_venc,duracao:desafio.timer||0}));
  }
  // Resultado final professor
  _desafioResultadoTela();
}

// Ajusta o conteúdo pra caber SEMPRE numa tela só (sem rolagem): encolhe se passar
function _fitNoScroll(midId,innerId){
  try{
    var mid=document.getElementById(midId), inner=document.getElementById(innerId);
    if(!mid||!inner) return;
    inner.style.transform='none';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var avail=mid.clientHeight, availW=mid.clientWidth;
        var need=inner.scrollHeight, needW=inner.scrollWidth;
        var sc=1;
        if(need>avail && need>0) sc=Math.min(sc, avail/need);
        if(needW>availW && needW>0) sc=Math.min(sc, availW/needW);
        if(sc<1) inner.style.transform='scale('+Math.max(0.35,sc)+')';
      });
    });
  }catch(e){}
}

function _desafioResultadoTela(){
  _desMvsfResultadoTela(); return;
  var unit=_desafioUnits[desafio.tipo]||'';
  var fmt=function(v){return desafio.tipo==='dist'?v.toFixed(2):Math.round(v);};
  var todos=Object.keys(alunosMap).filter(function(n){return alunosMap[n].nome;});
  todos.sort(function(a,b){return _desafioGetMetrica(b)-_desafioGetMetrica(a);});
  // ESCALA: com poucos participantes, tudo fica bem maior (o _fitNoScroll encolhe se a turma for grande)
  var _nP=todos.length;
  var S = _nP<=4?2.05 : _nP<=6?1.85 : _nP<=8?1.65 : _nP<=10?1.45 : _nP<=14?1.22 : 1.0;
  var R=function(x){return Math.round(x*S);};
  var html='<div id="desafioResultadoFinal" style="position:fixed;inset:0;z-index:21000;background:rgba(4,6,14,.97);display:flex;flex-direction:column;align-items:center;padding:24px 24px 18px;overflow:hidden;box-sizing:border-box;">';
  html+='<div style="font-size:'+R(40)+'px;margin-bottom:8px;">'+(_desafioIcons[desafio.tipo]||'🏆')+'</div>';
  html+='<div style="font-family:Bebas Neue,sans-serif;font-size:'+R(36)+'px;letter-spacing:4px;color:#fff;margin-bottom:4px;">Resultado Final</div>';
  html+='<div style="font-size:'+R(13)+'px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.35);text-transform:uppercase;margin-bottom:'+R(24)+'px;">'+(_desafioNomes[desafio.tipo]||'')+(desafio.modo==='mvsf'?' · Homens vs Mulheres':desafio.modo==='equipes'?' · Equipes':'')+'</div>';
  // ── Área central que CABE numa tela só (encolhe se precisar, sem rolagem) ──
  html+='<div id="desafioResMid" style="flex:1;min-height:0;width:100%;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;">';
  html+='<div id="desafioResInner" style="width:100%;display:flex;flex-direction:column;align-items:center;transform-origin:center center;">';

  if(desafio.modo==='geral'){
    var podio=todos.slice(0,3);
    var resto=todos.slice(3);
    // Pódio visual: 2º | 1º | 3º
    var podColors=['#ffd700','#c0c0c0','#cd7f32'];
    var podBg=['rgba(255,215,0,.12)','rgba(192,192,192,.1)','rgba(205,127,50,.1)'];
    var podBorder=['rgba(255,215,0,.45)','rgba(192,192,192,.3)','rgba(205,127,50,.3)'];
    var podPad=[R(36)+'px '+R(16)+'px',R(24)+'px '+R(16)+'px',R(18)+'px '+R(16)+'px'];
    var podMedal=['🥇','🥈','🥉'];
    var podOrder=[1,0,2]; // índices: 2º esq, 1º centro, 3º dir
    html+='<div style="display:flex;align-items:flex-end;justify-content:center;gap:'+R(12)+'px;width:100%;max-width:'+R(760)+'px;margin-bottom:'+R(28)+'px;">';
    podOrder.forEach(function(idx){
      if(idx>=podio.length) return;
      var nome=podio[idx];
      var a=alunosMap[nome]; if(!a) return;
      var val=_desafioGetMetrica(nome);
      var cor=(a.genero==='F'?'#ff69b4':'#295fe8');
      html+='<div style="flex:1;text-align:center;padding:'+podPad[idx]+';background:'+podBg[idx]+';border-radius:18px;border:1px solid '+podBorder[idx]+';min-width:0;">';
      html+='<div style="font-size:'+(idx===0?R(52):R(38))+'px;line-height:1.1;margin-bottom:8px;">'+podMedal[idx]+'</div>';
      html+='<div style="font-size:'+(idx===0?R(26):R(20))+'px;font-weight:800;color:#fff;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+nome+'</div>';
      html+='<div style="font-family:Barlow Condensed,sans-serif;font-size:'+(idx===0?R(48):R(36))+'px;font-weight:900;color:'+podColors[idx]+';line-height:1;">'+fmt(val)+'<span style="font-size:'+(idx===0?R(20):R(15))+'px;color:rgba(255,255,255,.4);margin-left:3px;">'+unit+'</span></div>';
      html+='</div>';
    });
    html+='</div>';
    // Restantes abaixo
    if(resto.length){
      var _meio=Math.ceil(resto.length/2);
      html+='<div style="width:100%;max-width:'+R(1120)+'px;display:grid;grid-template-columns:1fr 1fr;gap:0 '+R(20)+'px;">';
      html+='<div>'+_desafioBuildTabela(resto.slice(0,_meio),unit,fmt,'',3,S)+'</div>';
      html+='<div>'+_desafioBuildTabela(resto.slice(_meio),unit,fmt,'',3+_meio,S)+'</div>';
      html+='</div>';
    }
  } else if(desafio.modo==='mvsf'){
    var h=todos.filter(function(n){return (alunosMap[n].genero||'M')==='M';});
    var f=todos.filter(function(n){return (alunosMap[n].genero||'M')==='F';});
    html+='<div style="width:100%;max-width:900px;display:flex;gap:20px;">';
    html+='<div style="flex:1;"><div style="font-family:Bebas Neue,sans-serif;font-size:20px;color:#295fe8;margin-bottom:8px;">♂ HOMENS</div>'+_desafioBuildTabela(h,unit,fmt,'#295fe8')+'</div>';
    html+='<div style="flex:1;"><div style="font-family:Bebas Neue,sans-serif;font-size:20px;color:#ff69b4;margin-bottom:8px;">♀ MULHERES</div>'+_desafioBuildTabela(f,unit,fmt,'#ff69b4')+'</div>';
    html+='</div>';
  } else if(desafio.modo==='equipes'){
    var lar=desafio.equipes.laranja||[];
    var azl=desafio.equipes.azul||[];
    var totL=lar.reduce(function(s,n){return s+_desafioGetMetrica(n);},0);
    var totA=azl.reduce(function(s,n){return s+_desafioGetMetrica(n);},0);
    var vencedor=totL>=totA?'🟠 LARANJA':'🔵 AZUL';
    html+='<div style="font-family:Bebas Neue,sans-serif;font-size:28px;letter-spacing:3px;color:#d7c414;margin-bottom:20px;">🏆 Vencedor: '+vencedor+'</div>';
    html+='<div style="width:100%;max-width:900px;display:flex;gap:20px;">';
    html+='<div style="flex:1;"><div style="font-family:Bebas Neue,sans-serif;font-size:20px;color:#ea860c;margin-bottom:4px;">🟠 LARANJA</div><div style="font-size:24px;font-weight:900;color:#ea860c;margin-bottom:8px;">'+fmt(totL)+' '+unit+'</div>'+_desafioBuildTabela(lar,unit,fmt,'#ea860c')+'</div>';
    html+='<div style="flex:1;"><div style="font-family:Bebas Neue,sans-serif;font-size:20px;color:#295fe8;margin-bottom:4px;">🔵 AZUL</div><div style="font-size:24px;font-weight:900;color:#295fe8;margin-bottom:8px;">'+fmt(totA)+' '+unit+'</div>'+_desafioBuildTabela(azl,unit,fmt,'#295fe8')+'</div>';
    html+='</div>';
  }
  html+='</div></div>'; // fecha inner + mid
  html+='<button onclick="desafioFecharResultado()" style="margin-top:16px;flex-shrink:0;padding:14px 48px;border-radius:30px;border:none;background:linear-gradient(135deg,#ea860c,#d62d2d);font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:900;letter-spacing:3px;color:#fff;cursor:pointer;">FECHAR</button>';
  html+='</div>';
  var el=document.createElement('div'); el.innerHTML=html;
  document.body.appendChild(el.firstChild);
  _fitNoScroll('desafioResMid','desafioResInner');
  window._desafioResTimeout=setTimeout(desafioFecharResultado,30000);
}

function desafioFecharResultado(){
  clearTimeout(window._desafioResTimeout); clearInterval(window._desResPagInt);
  var el=document.getElementById('desafioResultadoFinal'); if(el) el.remove();
}

// ══════════════════════════════════════════════════════════════
// PAREAMENTO DE BIKES
// ══════════════════════════════════════════════════════════════
var parTipo='bt'; // 'bt' ou 'ant'
var parBikeMap={}; // {1:{tipo,nome,id,watts,rpm}, 2:{...}, ...}
var parBikeFoco=1; // bike focada (1-N)
var parNumBikes=20; // total de posições na sala (padrão 20)
var parScanningBike=null; // bike sendo escaneada

// Encerra o scan de uma bike: limpa o estado E REDESENHA o cartao.
// Antes, varios pontos do codigo faziam apenas "parScanningBike=null". A
// variavel ficava certa, mas o cartao continuava escrito PROCURANDO ate algo
// forcar um redesenho — e, indo para a bike seguinte, ficavam DUAS marcadas ao
// mesmo tempo.
function _parPararScanDe(num){
  if(num==null) num=parScanningBike;
  parScanningBike=null;
  try{ if(_bled112ScanTimer){ clearTimeout(_bled112ScanTimer); _bled112ScanTimer=null; } }catch(e){}
  try{ if(window._parEscapeTimer){ clearTimeout(window._parEscapeTimer); window._parEscapeTimer=null; } }catch(e){}
  try{
    if(num!=null){
      var c=document.getElementById('bikeCard'+num);
      if(c) _parAtualizarCard(c, num, parBikeMap[num]);
    }
  }catch(e){}
}
var parLiveInts={}; // intervalos de dados ao vivo por bike
var bikeOpMenuFoco=0; // 0=Trocar, 1=Remover, 2=Fechar

function _parCarregarSalvo(){
  try{
    var s=localStorage.getItem('prorider_bike_map');
    if(s) parBikeMap=JSON.parse(s);
    var n=parseInt(localStorage.getItem('prorider_num_bikes'));
    if(n>=4&&n<=40) parNumBikes=n;
    var _tl=window.licencaMaxBikes||0; if(_tl>0 && parNumBikes>_tl) parNumBikes=_tl;   // 24/09: teto da licenca
  }catch(e){}
}
function _parSalvar(){
  try{
    localStorage.setItem('prorider_bike_map',JSON.stringify(parBikeMap));
    localStorage.setItem('prorider_num_bikes',String(parNumBikes));
  }catch(e){}
}

function abrirPareamento(){
  // O vigia do dongle nao pode reiniciar a porta enquanto esta tela estiver
  // aberta. A tentativa anterior marcava isto apenas durante o SCAN — mas a
  // tela continua aberta depois dele, e era ai que o vigia disparava e comecava
  // a tempestade de reconexao. E a TELA que segura, nao o scan.
  window.PR_PAREANDO = true;
  _parCarregarSalvo();
  var s=document.getElementById('pareamentoScreen');
  if(s){ s.style.display='flex'; }
  parBikeFoco=1;
  _parBuildGrid();
  _parAtualizarFoco();
  if(_parSinalInt)clearInterval(_parSinalInt);
  _parSinalInt=setInterval(_parRefreshSinais,1000);
}
function fecharPareamento(){
  window.PR_PAREANDO = false;
  if(_parSinalInt){clearInterval(_parSinalInt);_parSinalInt=null;}
  _parSalvar(); // guardar tudo ao sair
  Object.keys(parLiveInts).forEach(function(k){clearInterval(parLiveInts[k]);});
  parLiveInts={};
  var s=document.getElementById('pareamentoScreen');
  if(s) s.style.display='none';
}

// Auto-reconhecimento: dado o nome de um dispositivo, retorna a posição guardada
function parEncontrarPosicao(deviceName){
  if(!deviceName) return null;
  for(var num in parBikeMap){
    var b=parBikeMap[num];
    if(b&&b.nome&&deviceName.toLowerCase().indexOf(b.nome.toLowerCase().split(' #')[0].toLowerCase())>=0){
      return parseInt(num);
    }
  }
  return null;
}

// Chamado quando uma bike BT conecta durante a aula
function parOnBikeConectada(deviceName){
  _parCarregarSalvo();
  var pos=parEncontrarPosicao(deviceName);
  if(pos){
    console.log('[ProRider] Bike reconhecida: '+deviceName+' → Posição '+pos);
    return pos;
  }
  return null;
}

function parGuardarTudo(){
  _parSalvar();
  fecharPareamento();
}

function parSetTipo(tipo){
  parTipo=tipo;
  var bt=document.getElementById('parBTBtn');
  var ant=document.getElementById('parANTBtn');
  if(bt){bt.style.background=tipo==='bt'?'rgba(41,95,232,.4)':'transparent';bt.style.color=tipo==='bt'?'#fff':'rgba(255,255,255,.35)';}
  if(ant){ant.style.background=tipo==='ant'?'rgba(93,177,61,.4)':'transparent';ant.style.color=tipo==='ant'?'#fff':'rgba(255,255,255,.35)';}
  // Ao activar BT, inicializar BLED112 se ainda não estiver conectado
  if(tipo==='bt' && typeof BLED112!=='undefined' && !_bled112Initialized){
    parBLED112Init(null, null); // tenta conectar silenciosamente; erros são mostrados em #parInstrucao
  }
}

function parAjustarNumBikes(delta){
  var maxL=window.licencaMaxBikes||40;
  parNumBikes=Math.max(4,Math.min(maxL,parNumBikes+delta));
  _parSalvar();
  _parBuildGrid();
  if(parBikeFoco>parNumBikes) parBikeFoco=parNumBikes;
  _parAtualizarFoco();
  var el=document.getElementById('parNumBikesLabel');
  if(el) el.textContent=parNumBikes+' bikes';
}

var _parSinalInt=null;
// Tempos de avaliacao do sinal (SO EXIBICAO — nao mexe na logica/remocao da bike):
var PAR_SINAL_FRESCO_MS = 1500; // recebeu nos ultimos 1,5s -> sinal normal
var PAR_SINAL_SEM_MS    = 3500; // +3,5s sem dado -> "sem sinal" (a bike continua no grid)
function _parSinal(b){
  var idade=Date.now()-((b&&b._lastSeen)||0);
  if(!b || idade>PAR_SINAL_SEM_MS)  return {st:'sem',   lvl:0, txt:'sem sinal'};
  if(idade>PAR_SINAL_FRESCO_MS)     return {st:'fraco', lvl:1, txt:'sinal inst\u00e1vel'};
  var rssi=b.rssi;
  var lvl=(rssi==null)?3:(rssi>-55?4:rssi>-65?3:rssi>-78?2:1);
  if(lvl>=3) return {st:'forte', lvl:lvl, txt:'recebendo sinal'};
  return {st:'fraco', lvl:Math.max(1,lvl), txt:'sinal fraco'};
}
function _parAntena(b){
  var s=_parSinal(b), hs=[7,11,15,19],ys=[13,9,5,1],r='';
  for(var i=0;i<4;i++){var op=i<s.lvl?1:.22; r+='<rect x="'+(1+i*6)+'" y="'+ys[i]+'" width="4" height="'+hs[i]+'" rx="1" opacity="'+op+'"/>';}
  return '<svg width="30" height="24" viewBox="0 0 24 20" fill="currentColor">'+r+'</svg>';
}
function _parRefreshSinais(){
  var el=document.getElementById('pareamentoScreen'); if(!el||el.style.display!=='flex') return;
  if(typeof parNumBikes==='undefined') return;
  for(var i=1;i<=parNumBikes;i++){
    var b=parBikeMap[i]; if(!b||!b.nome) continue;
    var s=_parSinal(b);
    var a=document.getElementById('parAnt'+i); if(a){ a.className='par-ant '+s.st; a.innerHTML=_parAntena(b); }
    var t=document.getElementById('parStt'+i);
    if(t){
      if(b._sim){ t.className='par-stt sim'; t.textContent='SIMULADO'; }
      else { t.className='par-stt '+s.st; t.textContent=s.txt; }
    }

    // ── SEM SINAL NAO MOSTRA NUMERO ────────────────────────────
    // O cartao dizia "sem sinal" e continuava exibindo o ultimo watt e a ultima
    // rotacao recebidos. Bike parada seguia marcando 128 W na tela enquanto o
    // painel dela mostrava 12 W. Numero velho e pior que numero nenhum: o
    // professor decide em cima dele.
    var _semSinal = (s.st==='sem') && !b._sim;
    var _w=document.getElementById('parW'+i);
    var _r=document.getElementById('parR'+i);
    if(_w) _w.innerHTML = _semSinal ? '&mdash;' : ((b.watts||0)+'<small>W</small>');
    if(_r) _r.innerHTML = _semSinal ? '&mdash;' : ((b.rpm||0)+'<small>rpm</small>');
    var _c=document.getElementById('bikeCard'+i);
    if(_c) _c.style.opacity = _semSinal ? '.55' : '1';
  }
  var pb=parBikeMap[99];
  if(pb&&pb.nome){ var ps=_parSinal(pb); var pa=document.querySelector('#bikeCard99 .ant'); if(pa){ pa.className='ant '+ps.st; pa.innerHTML=_parAntena(pb); } }
  _parAtualizarResumo();
}
function _parHeartFull(v){return '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3 1.2 4 2.5 1-1.3 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z"/></svg>';}
function _parHeartOut(){return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3 1.2 4 2.5 1-1.3 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z"/></svg>';}

function _parPintarProf(card, b){
  if(!card) card=document.getElementById('bikeCard99'); if(!card) return;
  var ico='<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ea860c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 L10 9 L14 15 H7 M14 15 L18.5 17.5 M11 9 H8.5 M14 6 L15.5 9 H12.5"/><circle cx="15" cy="5" r="1"/></svg>';
  if(b&&b.nome){
    var sp=_parSinal(b);
    card.innerHTML='<div class="pico">'+ico+'</div><div><div class="pname">PROF #99</div><div class="psub">Bike do professor</div></div><div class="spacer"></div>'
      +'<div class="pstat"><span class="pv" id="parW99">'+(sp.st==='sem'?'&mdash;':((b.watts||0)+'<small>W</small>'))+'</span><span class="pl">Watts</span></div>'
      +'<div class="pstat"><span class="pv" id="parR99">'+(b.rpm||0)+'<small>rpm</small></span><span class="pl">Rota\u00e7\u00e3o</span></div>'
      +'<div class="pstat"><span class="pv"><span class="ant '+sp.st+'">'+_parAntena(b)+'</span></span><span class="pl">Sinal</span></div>';
  } else {
    card.innerHTML='<div class="pico">'+ico+'</div><div><div class="pname" style="color:rgba(255,165,0,.5)">PROF #99</div><div class="psub">Bike do professor</div></div><div class="spacer"></div><div class="pidle">aguardando bike do professor\u2026</div>';
  }
}

function _parAtualizarResumo(){
  var tot=parNumBikes,con=0,rs=0,rn=0;
  for(var i=1;i<=parNumBikes;i++){var b=parBikeMap[i]; if(b&&b.nome){con++; if(b.rssi!=null){rs+=b.rssi;rn++;}}}
  var set=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  set('parResConect',con+' / '+tot); set('parResLivres',(tot-con));
  if(rn){var avg=rs/rn;var pct=Math.max(0,Math.min(100,Math.round((avg+100)/0.6)));set('parResSinal',pct+'%');}
  else set('parResSinal','\u2014');
  var lic=document.getElementById('parResLic'); if(lic) lic.innerHTML=tot+' <small style="font-size:11px;color:rgba(255,255,255,.42);">(prof incluso)</small>';
}

function _parBuildGrid(){
  var grid=document.getElementById('bikeGrid'); if(!grid) return;
  grid.className='par-grid'; grid.innerHTML='';
  var lbl=document.getElementById('parNumBikesLabel'); if(lbl) lbl.textContent=parNumBikes+' bikes';
  (function(){
    var card=document.createElement('div'); card.id='bikeCard99'; card.className='par-prof';
    card.setAttribute('data-bike',99); card.onclick=function(){parSelecionarBike(99);};
    _parPintarProf(card, parBikeMap[99]); grid.appendChild(card);
  })();
  for(var i=1;i<=parNumBikes;i++){
    var b=parBikeMap[i];
    var card=document.createElement('div'); card.id='bikeCard'+i; card.className='par-cell';
    card.setAttribute('data-bike',i);
    card.onclick=(function(n){return function(){parSelecionarBike(n);};})(i);
    _parAtualizarCard(card, i, b); grid.appendChild(card);
  }
  _parAtualizarResumo(); _parAtualizarFoco();
}

function _parAtualizarCard(card, num, dados){
  if(num===99){ _parPintarProf(card||document.getElementById('bikeCard99'), dados||parBikeMap[99]); _parAtualizarResumo(); return; }
  if(!card) card=document.getElementById('bikeCard'+num); if(!card) return;
  var conectada=dados&&dados.nome, scanning=parScanningBike===num;
  var id=(num<10?'0':'')+num;
  card.className='par-cell'+((conectada&&!scanning)?' con':'');
  if(scanning){
    card.innerHTML='<div class="par-chead"><div class="par-num">'+id+'</div></div><div class="par-scan">procurando\u2026</div>';
  } else if(conectada){
    var s=_parSinal(dados);
    card.innerHTML='<div class="par-chead"><div class="par-lbl">BIKE '+id+'</div><div class="par-ant '+s.st+'" id="parAnt'+num+'">'+_parAntena(dados)+'</div></div>'
      +'<div class="par-stt '+s.st+'" id="parStt'+num+'">'+s.txt+'</div>'
      +'<div class="par-stats"><div class="par-stat"><div class="sv" id="parW'+num+'">'+(dados.watts||0)+'</div><div class="su">Watts</div></div>'
      +'<div class="par-stat"><div class="sv" id="parR'+num+'">'+(dados.rpm||0)+'</div><div class="su">RPM</div></div></div>';
  } else {
    card.innerHTML='<div class="par-chead"><div class="par-num">'+id+'</div></div><div class="par-livre">Livre</div><div class="par-plus">+</div>';
  }
  _parAtualizarResumo();
}

function _parAtualizarFoco(){
  // Normalizar bike 99
  var card99=document.getElementById('bikeCard99');
  if(card99) card99.style.outline=parBikeFoco===99?'2px solid #2f6bff':'none';
  for(var i=1;i<=parNumBikes;i++){
    var card=document.getElementById('bikeCard'+i);
    if(card) card.style.outline=i===parBikeFoco?'2px solid #2f6bff':'none';
  }
  // Scroll para o card focado
  var focado=document.getElementById('bikeCard'+parBikeFoco);
  if(focado) focado.scrollIntoView({behavior:'smooth',block:'nearest'});
}

var _parOpBikeNum=null;

function parSelecionarBike(num){
  parBikeFoco=num;
  _parAtualizarFoco();
  if(parBikeMap[num]){
    // Bike já pareada → mostrar menu de opções
    _parAbrirOpMenu(num);
  } else {
    // Bike livre → iniciar scan directamente
    _parScanBike(num);
  }
}

function _parAbrirOpMenu(num){
  _parOpBikeNum=num;
  bikeOpMenuFoco=0;
  var menu=document.getElementById('bikeOpMenu');
  var title=document.getElementById('bikeOpTitle');
  var sub=document.getElementById('bikeOpSub');
  var remBtn=document.getElementById('bikeOpRemover');
  if(!menu) return;
  var dados=parBikeMap[num];
  if(title) title.textContent='BIKE '+num;
  if(sub) sub.textContent=dados?(dados.tipo==='bt'?'Bluetooth':'ANT+')+' · '+dados.nome:'Posição livre';
  if(remBtn) remBtn.style.display=dados?'flex':'none';
  menu.style.display='flex';
  _bikeOpFocar();
}

function _bikeOpFocar(){
  var btns=document.querySelectorAll('#bikeOpMenu button');
  // Visible buttons only
  var vis=[];
  for(var i=0;i<btns.length;i++) if(btns[i].style.display!=='none') vis.push(btns[i]);
  vis.forEach(function(b,i){
    b.style.outline=i===bikeOpMenuFoco?'2px solid #ea860c':'none';
    b.style.boxShadow=i===bikeOpMenuFoco?'0 0 8px rgba(234,134,12,.5)':'';
  });
}

function _bikeOpNavegar(delta){
  var btns=document.querySelectorAll('#bikeOpMenu button');
  var vis=[];
  for(var i=0;i<btns.length;i++) if(btns[i].style.display!=='none') vis.push(btns[i]);
  bikeOpMenuFoco=(bikeOpMenuFoco+delta+vis.length)%vis.length;
  _bikeOpFocar();
}

function _bikeOpConfirmar(){
  var btns=document.querySelectorAll('#bikeOpMenu button');
  var vis=[];
  for(var i=0;i<btns.length;i++) if(btns[i].style.display!=='none') vis.push(btns[i]);
  if(vis[bikeOpMenuFoco]) vis[bikeOpMenuFoco].click();
}

function parFecharOpMenu(){
  var menu=document.getElementById('bikeOpMenu');
  if(menu) menu.style.display='none';
  _parOpBikeNum=null;
}

function parOpTrocar(){
  var num=_parOpBikeNum;
  parFecharOpMenu();
  if(!num) return;
  // Limpar bike atual e re-escanear
  if(parLiveInts[num]){clearInterval(parLiveInts[num]);delete parLiveInts[num];}
  delete parBikeMap[num];
  _parAtualizarCard(null,num,null);
  _parScanBike(num);
}

function parOpRemover(){
  var num=_parOpBikeNum;
  parFecharOpMenu();
  if(!num) return;
  if(parLiveInts[num]){clearInterval(parLiveInts[num]);delete parLiveInts[num];}
  delete parBikeMap[num];
  _parSalvar();
  _parAtualizarCard(null,num,null);
  var instr=document.getElementById('parInstrucao');
  if(instr) instr.textContent='Bike '+num+' removida.';
}

// ── BLED112 state ────────────────────────────────────────────
var _bled112Initialized = false;
var _bled112ScanResults = {}; // mac → device info, para evitar duplicados
var _bled112ScanTimer = null;

/**
 * Verifica Web Serial e conecta ao BLED112.
 * Chamada pelo botão BLUETOOTH se o dongle não estiver inicializado.
 */
function parBLED112Init(onSuccess, onError){
  var instr=document.getElementById('parInstrucao');
  if(!('serial' in navigator)){
    var msg='Web Serial não suportado. Usa Chrome ou Edge.';
    if(instr) instr.textContent=msg;
    console.warn('[ProRider]',msg);
    if(onError) onError(msg);
    return;
  }
  if(location.protocol==='file:'){
    console.warn('[ProRider] Web Serial pode não funcionar em file:// — recomendado usar localhost.');
  }
  if(instr) instr.textContent='A conectar ao BLED112...';
  try{
    BLED112.onQueda=function(){
      _bled112Initialized=false;
      var el=document.getElementById('parInstrucao');
      if(el) el.textContent='Dongle caiu — religando sozinho...';
      try{ _settingsDot&&_settingsDot('btDot','#d7c414',true); }catch(e){}
    };
    BLED112.onVoltou=function(){
      _bled112Initialized=true;
      var el=document.getElementById('parInstrucao');
      if(el) el.textContent='BLED112 reconectado.';
      try{ _settingsDot&&_settingsDot('btDot','#5db13d',true); }catch(e){}
    };
  }catch(e){}
  BLED112.connect().then(function(){
    _bled112Initialized=true;
    if(instr) instr.textContent='BLED112 conectado! Seleciona uma bike para parear.';
    if(onSuccess) onSuccess();
  }).catch(function(e){
    if(instr) instr.textContent='Erro BLED112: '+(e.message||e);
    console.error('[ProRider] BLED112 connect error:',e);
    if(onError) onError(e);
  });
}

function _parScanBike(num){
  // Encerra qualquer scan anterior antes de comecar outro: sem isto ficavam
  // duas bikes marcadas como PROCURANDO ao mesmo tempo.
  if(parScanningBike!=null && parScanningBike!==num){ _parPararScanDe(parScanningBike); }
  parScanningBike=num;
  _parAtualizarCard(null,num,null);
  var instr=document.getElementById('parInstrucao');
  if(instr) instr.textContent='Bike '+num+': aguarda seleção do dispositivo...';

  if(parTipo==='bt'){
    // ── Tentar BLED112 primeiro ──────────────────────────────
    if(typeof BLED112 !== 'undefined' && 'serial' in navigator){
      _parScanBikeBLED112(num);
      return;
    }
    // ── Fallback: Web Bluetooth (requer HTTPS) ───────────────
    if(!navigator.bluetooth){
      _parScanFallback(num);return;
    }
    if(location.protocol==='file:'){
      _parScanFallback(num);return;
    }
    navigator.bluetooth.requestDevice({
      acceptAllDevices:true,
      optionalServices:['00001818-0000-1000-8000-00805f9b34fb','00001826-0000-1000-8000-00805f9b34fb','0bf669f0-45f2-11e7-9598-0800200c9a66']
    }).then(function(device){
      parBikeMap[num]={tipo:'bt',nome:device.name||'BT Device',id:device.id||'',watts:0,rpm:0,device:device};
      _parPararScanDe();
      _parIniciarLiveSimulado(num);
      _parAtualizarCard(null,num,parBikeMap[num]);
      if(instr) instr.textContent='Bike '+num+' conectada! Confirma com START para guardar.';
    }).catch(function(){
      _parPararScanDe();
      _parAtualizarCard(null,num,parBikeMap[num]||null);
      if(instr) instr.textContent='Scan cancelado.';
    });
  } else {
    // 07/10b: ANT+ de verdade, pelo pendrive ANT+ (Web Serial ou WebUSB)
    if(typeof ANTPLUS!=='undefined' && (('serial' in navigator) || ('usb' in navigator) || ANTPLUS._transporteTeste)){ _parScanBikeANT(num); return; }
    _parScanFallback(num);
  }
}

// ══ 07/10b — PAREAMENTO E LEITURA PELO PENDRIVE ANT+ ══════════════════════
// Mesma tela e mesma lista do BLED112. A bike pareada fica no parBikeMap com mac 'ANT:<nº>:<tipo>'
// e bled112:true (= "lida por dongle na TV"): cartões, %FTP, relay para os celulares e resumo
// funcionam igual à Keiser.
var _antLiveAtivo=false;
function _parScanBikeANT(num){
  var instr=document.getElementById('parInstrucao');
  function iniciar(){
    _bled112ScanResults={};
    if(instr) instr.textContent='Bike '+num+': procurando bikes ANT+ (gire o pedal da bike '+num+')…';
    _parMostrarListaBLED112(num, {}, 'ANT+');
    ANTPLUS.startScan(function(device){
      if(device.antTipo===0x78) return;            // cinta de FC não é bike
      try{ _prProcessDevice(device); }catch(e){}   // bikes já pareadas continuam vivas durante a procura
      var key=device.mac, novo=!_bled112ScanResults[key];
      _bled112ScanResults[key]=device;
      if(novo){ console.log('[ANT+] Encontrado:',device.name,'RSSI:'+device.rssi); _parMostrarListaBLED112(num, _bled112ScanResults, 'ANT+'); }
    }).catch(function(e){ if(instr) instr.textContent='Erro no ANT+: '+(e.message||e); _parPararScanDe(num); });
    if(_bled112ScanTimer) clearTimeout(_bled112ScanTimer);
    _bled112ScanTimer=setTimeout(function(){
      var q=Object.keys(_bled112ScanResults).length;
      if(instr && parScanningBike===num) instr.textContent='Procura concluída. '+q+' bike(s) ANT+ encontrada(s).';
      if(q===0){ try{ _parFecharListaBLED112(); }catch(e){} _parPararScanDe(num); try{ _parToast&&_parToast('Nenhuma bike ANT+ encontrada. Gire o pedal (a bike só transmite pedalando) e tente de novo.'); }catch(e){} _parIniciarLiveANT(); }
    },12000);
  }
  if(!ANTPLUS.connected){
    if(instr) instr.textContent='Conectando ao pendrive ANT+…';
    ANTPLUS.connect(true).then(iniciar).catch(function(e){
      if(instr) instr.textContent='Pendrive ANT+: '+(e.message||e);
      try{ _parToast&&_parToast('Pendrive ANT+ não encontrado. Ligue o pendrive e tente de novo.'); }catch(x){}
      _parPararScanDe(num);
    });
  } else iniciar();
}
function _parIniciarLiveANT(){
  if(typeof ANTPLUS==='undefined') return;
  var temAnt=Object.keys(parBikeMap||{}).some(function(n){ var b=parBikeMap[n]; return b&&b.ant; });
  if(!temAnt) return;
  var ligar=function(){ ANTPLUS.startScan(function(device){ try{ _prProcessDevice(device); }catch(e){} }).catch(function(){}); _antLiveAtivo=true; };
  if(ANTPLUS.connected) return ligar();
  ANTPLUS.connect(false).then(ligar).catch(function(e){ console.warn('[ANT+] '+(e.message||e)+' — tento de novo em 30 s'); setTimeout(_parIniciarLiveANT,30000); });
}
try{ if(typeof ANTPLUS!=='undefined'){ ANTPLUS.onQueda=function(){ _antLiveAtivo=false; console.warn('[ANT+] pendrive desconectou — religando…'); setTimeout(_parIniciarLiveANT,3000); }; } }catch(e){}

/**
 * Scan via BLED112 para a bike `num`.
 * Mostra lista de bikes encontradas e aguarda seleção do utilizador.
 */
function _parScanBikeBLED112(num){
  var instr=document.getElementById('parInstrucao');

  function _iniciarScan(){
    // Pausa o scan ao vivo enquanto o pareamento usa o dongle (evita o watchdog
    // do live derrubar o scan de pareamento). É retomado após a seleção da bike.
    _bled112LiveActive = false;
    _bled112ScanResults={};
    if(instr) instr.textContent='Bike '+num+': a procurar dispositivos BLE via BLED112...';
    _parMostrarListaBLED112(num, {});

    BLED112.startScan(function(device){
      // Deduplicar por NOME (telefones usam MAC aleatório que muda)
      var key = device.name || device.mac;
      if(_bled112ScanResults[key]){
        // Atualizar RSSI e MAC mais recente, mas não re-renderizar
        _bled112ScanResults[key].rssi = device.rssi;
        _bled112ScanResults[key].mac = device.mac;
        return;
      }
      _bled112ScanResults[key]=device;
      console.log('[BLED112] Encontrado:',device.name,'('+device.mac+') RSSI:'+device.rssi);
      _parMostrarListaBLED112(num, _bled112ScanResults);
    }).catch(function(e){
      if(instr) instr.textContent='Erro ao iniciar scan: '+(e.message||e);
      _parPararScanDe(num);
    });

    // Auto-parar scan após 10 segundos
    if(_bled112ScanTimer) clearTimeout(_bled112ScanTimer);
    _bled112ScanTimer=setTimeout(function(){
      BLED112.stopScan();
      var _qtd = Object.keys(_bled112ScanResults).length;
      if(instr && parScanningBike===num) instr.textContent='Scan concluído. '+_qtd+' dispositivo(s) encontrado(s).';
      // Achando ou nao, o scan acabou: o cartao nao pode seguir em PROCURANDO.
      // (com dispositivos, a janela de escolha continua aberta — so o estado
      //  do cartao e limpo.)
      if(_qtd > 0){
        var _cardFim=document.getElementById('bikeCard'+num);
        _parPararScanDe();
        try{ if(_cardFim) _parAtualizarCard(_cardFim, num, parBikeMap[num]); }catch(e){}
      }

      // ── SAIDA GARANTIDA ────────────────────────────────────────
      // Se o scan terminou sem achar nada, a janela ficava aberta dizendo
      // "A procurar dispositivos BLE..." para sempre, e a tela parecia travada.
      // Agora ela se fecha sozinha, explica o motivo e devolve o controle.
      if(_qtd === 0){
        try{ _parFecharListaBLED112(); }catch(e){}
        _parPararScanDe(num);
        try{
          if(typeof _parToast==='function')
            _parToast('Nenhuma bike encontrada. As Keiser so transmitem com o pedal girando — gire o pedal e tente de novo.');
        }catch(e){}
        console.warn('[ProRider] scan terminou sem dispositivos. Bike parada nao transmite: girar o pedal e repetir.');
      }
    }, 10000);

    // Rede de seguranca: se por qualquer motivo o scan nao terminar em 20s,
    // a janela nao pode prender o utilizador na tela.
    if(window._parEscapeTimer) clearTimeout(window._parEscapeTimer);
    window._parEscapeTimer=setTimeout(function(){
      if(parScanningBike===num){
        console.error('[ProRider] scan nao terminou em 20s — fechando a janela para nao prender a tela.');
        try{ BLED112.stopScan(); }catch(e){}
        try{ _parFecharListaBLED112(); }catch(e){}
        _parPararScanDe(num);
        try{ if(typeof _parToast==='function') _parToast('O scan nao respondeu. Tente de novo.'); }catch(e){}
      }
    }, 20000);
  }

  if(!_bled112Initialized || !BLED112.connected){
    parBLED112Init(function(){ _iniciarScan(); }, function(e){
      // Fallback se BLED112 falhar
      console.error('[ProRider] ATENCAO: BLED112 indisponivel. Qualquer numero que '
        + 'aparecer a partir daqui pode NAO vir da bike. Erro:', e);
      try{ if(typeof _parToast==='function') _parToast('Dongle BLE indisponivel — dados podem nao ser reais'); }catch(_){}
      _parScanFallback(num);
    });
  } else {
    _iniciarScan();
  }
}

/**
 * Mostra lista de dispositivos encontrados no scan BLED112.
 * O utilizador clica num device para parear com a bike `num`.
 */
var _bled112ListNum=null;   // bike que está a ser pareada
var _bled112ListKeys=[];   // keys dos devices na lista
var _bled112ListFoco=0;    // índice focado

function _bled112ListFocar(){
  var items=document.querySelectorAll('.bled112Item');
  items.forEach(function(el,i){
    el.style.background=i===_bled112ListFoco?'rgba(41,95,232,.5)':'rgba(41,95,232,.15)';
    el.style.border=i===_bled112ListFoco?'1px solid #295fe8':'1px solid rgba(41,95,232,.3)';
  });
}

function _parMostrarListaBLED112(num, devices, rotulo){
  var instr=document.getElementById('parInstrucao');
  var keys=Object.keys(devices);
  _bled112ListNum=num;
  _bled112ListKeys=keys;
  if(_bled112ListFoco>=keys.length) _bled112ListFoco=0;

  // Criar ou reutilizar o painel de lista
  var listEl=document.getElementById('bled112DevList');
  if(!listEl){
    listEl=document.createElement('div');
    listEl.id='bled112DevList';
    listEl.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
      +'background:rgba(12,18,30,.97);border:1px solid rgba(41,95,232,.5);border-radius:12px;'
      +'padding:18px 22px;z-index:25000;min-width:320px;max-width:480px;max-height:70vh;overflow-y:auto;'
      +'box-shadow:0 8px 40px rgba(0,0,0,.7);';
    document.body.appendChild(listEl);
  }

  var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
    +'<span style="color:#fff;font-weight:700;font-size:14px;letter-spacing:1px;">'+(rotulo||'BLED112')+' — Bike '+num+'</span>'
    +'<span style="color:rgba(255,255,255,.3);font-size:10px;">[A] Confirmar &nbsp; [B] Cancelar</span>'
    +'</div>';

  if(keys.length===0){
    html+='<div style="color:rgba(255,255,255,.4);font-size:12px;text-align:center;padding:20px 0;">'
      +'<div style="margin-bottom:8px;">'+(rotulo==='ANT+'?'Procurando bikes ANT+… gire o pedal':'A procurar dispositivos BLE...')+'</div>'
      +'<div style="width:24px;height:24px;border:2px solid rgba(41,95,232,.4);border-top-color:#295fe8;'
      +'border-radius:50%;animation:spin .8s linear infinite;margin:0 auto;"></div>'
      +'</div>';
  } else {
    html+='<div style="color:rgba(255,255,255,.4);font-size:11px;margin-bottom:8px;">'+keys.length+' dispositivo(s) — ↑↓ navegar · [A] confirmar</div>';
    keys.forEach(function(key, i){
      var d=devices[key];
      html+='<div class="bled112Item" onclick="_parSelecionarBLED112('+num+',\''+key+'\')" '
        +'style="padding:10px 14px;margin-bottom:6px;border-radius:8px;cursor:pointer;'
        +'background:rgba(41,95,232,.15);border:1px solid rgba(41,95,232,.3);transition:background .15s;">'
        +'<div style="color:#fff;font-weight:600;font-size:13px;">'+d.name+'</div>'
        +'<div style="color:rgba(255,255,255,.4);font-size:11px;margin-top:3px;">'+(d.ant?(d.watts||0)+' W · '+(d.cadence||0)+' rpm · ':'')+'RSSI: '+d.rssi+' dBm</div>'
        +'</div>';
    });
  }

  // Adicionar keyframe spin se não existir
  if(!document.getElementById('bled112Style')){
    var st=document.createElement('style');
    st.id='bled112Style';
    st.textContent='@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  listEl.innerHTML=html;
  setTimeout(_bled112ListFocar, 0);
}

/** Utilizador selecionou um dispositivo da lista BLED112 */
function _parSelecionarBLED112(num, key){
  var device=_bled112ScanResults[key];
  if(!device) return;

  // Parar scan e fechar lista
  if(device.ant){ try{ ANTPLUS.stopScan(); }catch(e){} } else BLED112.stopScan();
  if(_bled112ScanTimer){ clearTimeout(_bled112ScanTimer); _bled112ScanTimer=null; }
  var listEl=document.getElementById('bled112DevList');
  if(listEl) listEl.remove();

  // Registar bike no mapa (sem conectar GATT agora — isso é feito na aula)
  parBikeMap[num]={
    tipo:'bt',
    nome:device.name,
    id:device.mac,
    watts:0,
    rpm:0,
    mac:device.mac,
    addrType:device.addrType,
    rssi:device.rssi||null,
    bled112:true,
    ant:!!device.ant   // 07/10b
  };
  if(device.ant){ _parPararScanDe(); _parSalvar(); _parAtualizarCard(null, num, parBikeMap[num]); _parIniciarLiveANT();
    setTimeout(function(){ var l=document.getElementById('bled112DevList'); if(l) l.remove(); },800); return; }
  _parPararScanDe();
  _parSalvar();
  _parAtualizarCard(null, num, parBikeMap[num]);

  // Reiniciar scan contínuo para receber dados reais das bikes.
  // IMPORTANTE: o BLED112.stopScan() acima matou o scan ao vivo, mas a flag
  // _bled112LiveActive continuava 'true' (desde o boot). Sem resetá-la, o
  // _parIniciarLiveBLED112() abaixo cairia no guard 'if(_bled112LiveActive) return;'
  // e viraria no-op — o scan nunca retomava e as bikes pareadas não apareciam nos cards.
  _bled112LiveActive = false;
  _parIniciarLiveBLED112();

  // Auto-fechar painel de seleção após 1.2s (feedback visual antes de fechar)
  setTimeout(function(){
    var listEl=document.getElementById('bled112DevList');
    if(listEl) listEl.remove();
    // Mostrar flash verde no card e instrução
    var card=document.getElementById('bikeCard'+num);
    if(card){ card.style.borderColor='#5db13d'; setTimeout(function(){if(parBikeMap[num])card.style.borderColor='#ea860c';},1200); }
  }, 800);

  // Atualizar instrução e voltar ao grid para parear próxima bike
  var instr=document.getElementById('parInstrucao');
  if(instr) instr.textContent='✓ Bike '+num+' ('+device.name+') guardada. Seleciona a próxima bike.';
}

/** Gera ícone de barras de sinal (tipo WiFi) baseado no RSSI em dBm */
function _parRssiIcon(rssi){
  // RSSI: >-50 excelente, -50 a -65 bom, -65 a -80 médio, <-80 fraco
  var bars = rssi > -50 ? 4 : rssi > -65 ? 3 : rssi > -80 ? 2 : 1;
  var html='';
  var heights=[4,7,10,14];
  for(var b=0;b<4;b++){
    var active=b<bars;
    html+='<div style="width:3px;height:'+heights[b]+'px;border-radius:1px;background:'+(active?'#5db13d':'rgba(255,255,255,.15)')+';"></div>';
  }
  return html;
}

// Helpers — alunos virtuais (bikes BLE sem ninguém logado)
var GYM_BIKE_STALE_MS = 4000; // bike sem broadcast há +4s = saiu/desligou → some da grade
function _zonaFromPct(pct){
  return pct<56?'z1':pct<76?'z2':pct<91?'z3':pct<106?'z4':pct<121?'z5':pct<151?'z6':'z7';
}
// 23/09e: a bike 99 e a do professor — sem ninguem logado nela, o cartao chama-se
// 'Professor' em vez de 'Aluno 99'.
function _nomeVirtual(bikeN){ return (parseInt(bikeN,10)===99) ? 'Professor' : ('Aluno '+String(bikeN).padStart(2,'0')); }

// Scan contínuo BLED112 — atualiza watts/rpm de todas as bikes pareadas
var _bled112LiveActive = false;
var _bled112LastTick  = 0; // timestamp do último ciclo bem-sucedido
var _bled112Falhas    = 0; // reinicios seguidos sem receber byte nenhum
var _preAulaRemedida  = false; // evita repetir a montagem da lista em laco
var _bled112Watchdog  = null;

// ══ 07/10c — RELATÓRIO DA AULA ══════════════════════════════════════════════
// Durante a aula a TV anota, por bike: quantos pacotes chegaram, os intervalos SEM SINAL de mais de
// 2 s (quantos, o maior, o total), o sinal médio (RSSI); por aluno: quantas vezes o celular caiu e por
// quanto tempo; e da TV: quedas do servidor, memória e fluidez. Vai junto com o resumo da aula e
// aparece em Admin → Saúde → (academia) → Aulas. Serve para saber, depois do dia 17, o que falhou e onde.
var _prRel=null;
function _prRelAtivo(){ try{ return typeof isPlaying!=='undefined'&&isPlaying&&typeof boxMode!=='undefined'&&boxMode==='live'; }catch(e){ return false; } }
function _prRelGarantir(){
  if(!_prRel || _prRel.sala!==salaCode || _prRel.fechado){
    _prRel={ sala:salaCode, ini:Date.now(), bikes:{}, alunos:{}, tv:{ quedas0:(typeof _wsQuedas!=='undefined'?_wsQuedas:0), fpsMin:null, memMax:null, amostras:0 } };
  }
  return _prRel;
}
function _prRelPacote(device, agora){
  if(!_prRelAtivo()) return;
  var num=null; Object.keys(parBikeMap||{}).forEach(function(n){ var b=parBikeMap[n]; if(b&&b.mac&&b.mac===device.mac) num=n; });
  if(num==null) return;
  var R=_prRelGarantir(), r=R.bikes[num]||(R.bikes[num]={ pk:0, falhas:0, maior:0, total:0, rssiS:0, rssiN:0, ult:0, tipo:device.ant?'ANT+':'BLE' });
  if(r.ult && agora-r.ult>2000){ var g=agora-r.ult; r.falhas++; r.total+=g; if(g>r.maior) r.maior=g; }
  r.pk++; r.ult=agora; if(typeof device.rssi==='number' && device.rssi<0){ r.rssiS+=device.rssi; r.rssiN++; }
}
function _prRelAluno(nome, caiu){
  if(!_prRelAtivo()||!nome) return;
  var R=_prRelGarantir(), a=R.alunos[nome]||(R.alunos[nome]={ quedas:0, foraMs:0, desde:0 });
  if(caiu){ if(!a.desde){ a.quedas++; a.desde=Date.now(); } }
  else if(a.desde){ a.foraMs+=Date.now()-a.desde; a.desde=0; }
}
function _prRelAmostra(fps, mem){
  if(!_prRelAtivo()) return; var t=_prRelGarantir().tv; t.amostras++;
  if(fps!=null) t.fpsMin=(t.fpsMin==null?fps:Math.min(t.fpsMin,fps)); if(mem!=null) t.memMax=(t.memMax==null?mem:Math.max(t.memMax,mem));
}
// fecha o relatório (chamado ao mandar o resumo): devolve um objeto pequeno e limpa
function _prRelFechar(){
  var R=_prRel; if(!R) return null; R.fechado=true; var fim=Date.now();
  var bikes={}; Object.keys(R.bikes).forEach(function(n){ var b=R.bikes[n];
    bikes[n]={ tipo:b.tipo, pacotes:b.pk, falhas:b.falhas, maior_s:Math.round(b.maior/100)/10, total_s:Math.round(b.total/1000), rssi:b.rssiN?Math.round(b.rssiS/b.rssiN):null,
      sumiu_no_fim_s:(b.ult&&fim-b.ult>5000)?Math.round((fim-b.ult)/1000):0 }; });
  var alunos={}; Object.keys(R.alunos).forEach(function(n){ var a=R.alunos[n]; var fora=a.foraMs+(a.desde?fim-a.desde:0); alunos[n]={ quedas:a.quedas, fora_s:Math.round(fora/1000), voltou:!a.desde }; });
  return { dur_s:Math.round((fim-R.ini)/1000), bikes:bikes, alunos:alunos,
    tv:{ quedas_servidor:Math.max(0,(typeof _wsQuedas!=='undefined'?_wsQuedas:0)-R.tv.quedas0), fps_min:R.tv.fpsMin, mem_max_mb:R.tv.memMax, build:PR_BUILD } };
}

// 07/10b: dados de UMA bike lida por dongle (BLED112/Keiser ou pendrive ANT+) entram aqui.
function _prProcessDevice(device){
  var agora = Date.now();
  if(device && device.review) return;   // 07/10a: Keiser mostrando o resumo (aluno parou): não é número ao vivo
  try{ _prRelPacote(device, agora); }catch(e){}   // 07/10c: relatório da aula (sinal de cada bike)
  Object.keys(parBikeMap).forEach(function(num){
    var b = parBikeMap[num];
    if(!b || !b.bled112 || !b.mac || b.mac !== device.mac) return;
    b.watts    = device.watts     || 0;
    b.rpm      = device.cadence   || 0;
    b.gear     = device.gear      || 0;
    b.bpm      = device.heartRate || b.bpm || 0;
    b.rssi     = device.rssi      || b.rssi;
    b._diagN = (b._diagN||0)+1;   // 07/10d: pacotes por segundo no diagnóstico
    b._lastSeen = agora; // presença — usado pelo watchdog para limpar bikes que saíram
    if(device.bikeId>0) b._kid = device.bikeId;   // 07/10a: nº da Keiser (console) — vai para o app ler a bike direto
    window._bleLastData = agora; // watchdog do indicador de sinal BT
    // DOM do pareamento — só reescreve se mudou (evita thrash na main thread → menos travada de vídeo)
    var wEl = document.getElementById('parW'+num);
    var rEl = document.getElementById('parR'+num);
    if(wEl && b._wDom!==b.watts){ wEl.textContent = b.watts; b._wDom=b.watts; }
    if(rEl && b._rDom!==b.rpm){ rEl.textContent = b.rpm; b._rDom=b.rpm; }

    var bikeN = parseInt(num);
    if(typeof alunosMap === 'undefined') return;
    // 23/09e: a bike 99 (professor) era descartada AQUI, antes de tudo — por isso
    // pareava e transmitia mas nunca aparecia na aula, e o professor logado nela
    // no app ficava com 0 W. Agora entra como as outras (cartao 'Professor').

    var vNome = _nomeVirtual(bikeN);

    // Existe aluno REAL logado nesta bike? (fez login + escolheu a bike via QR)
    var alunoReal = null;
    Object.keys(alunosMap).forEach(function(nome){
      var a = alunosMap[nome];
      if(a && !a._virtual && parseInt(a.bike) === bikeN) alunoReal = a;
    });

    if(alunoReal){
      // OVERLAY: dados BLE entram no aluno real; FTP usa o FTP DELE (não o 150 base)
      alunoReal.watts = b.watts; alunoReal.rpm = b.rpm;
      alunoReal.gear  = b.gear||0;                 // marcha
      if(b.bpm) alunoReal.bpm = b.bpm;             // FC vinda da cinta pela Keiser
      alunoReal._bledSrc = true; alunoReal._lastSeen = agora;
      var rbase = alunoReal.ftpBase || 150;
      var rpct  = Math.round((b.watts||0) / rbase * 100);
      alunoReal.ftp  = rpct;
      alunoReal.zona = _zonaFromPct(rpct);
      if((b.watts||0) > (alunoReal.potMax||0)) alunoReal.potMax = b.watts;
      // ACUMULA kcal e distância (antes ficavam zerados nas bikes reais -> desafio mostrava 0.00)
      var _dtR=(agora-(alunoReal._accLast||agora))/1000;
      if(_dtR>0 && _dtR<10){
        alunoReal._kcalF=(alunoReal._kcalF||0)+(b.watts||0)*_dtR/3600*3.6;
        alunoReal._distF=(alunoReal._distF||0)+Math.round(b.rpm||0)*0.007*_dtR/60;
        alunoReal.kcal=Math.round(alunoReal._kcalF);
        alunoReal.dist=parseFloat(alunoReal._distF.toFixed(2));
      }
      alunoReal._accLast=agora;
      // se ainda existir um virtual desta bike (aluno acabou de logar), substitui-o
      if(alunosMap[vNome] && alunosMap[vNome]._virtual) delete alunosMap[vNome];
    } else {
      // SEM aluno logado: a bike aparece como aluno virtual SÓ POR ESTAR transmitindo
      // (presença), mesmo a 0 W. FTP base 150, nome pelo número da bike.
      var pct = Math.round((b.watts||0) / 150 * 100);
      if(!alunosMap[vNome]){
        alunosMap[vNome] = { nome:vNome, bike:bikeN, ftpBase:150, ftp:pct,
          watts:b.watts, rpm:b.rpm, bpm:(b.bpm||0), gear:(b.gear||0), zona:_zonaFromPct(pct), kcal:0, dist:0,
          potMax:b.watts, _bledSrc:true, _virtual:true, _lastSeen:agora };
      } else {
        var v = alunosMap[vNome];
        v.watts = b.watts; v.rpm = b.rpm; v.ftp = pct; v.zona = _zonaFromPct(pct);
        v.gear = b.gear||0; if(b.bpm) v.bpm = b.bpm;   // 23/09e: marcha e FC tambem na bike sem login
        v._bledSrc = true; v._lastSeen = agora;
        if((b.watts||0) > (v.potMax||0)) v.potMax = b.watts;
        var _dtV=(agora-(v._accLast||agora))/1000;
        if(_dtV>0 && _dtV<10){
          v._kcalF=(v._kcalF||0)+(b.watts||0)*_dtV/3600*3.6;
          v._distF=(v._distF||0)+Math.round(b.rpm||0)*0.007*_dtV/60;
          v.kcal=Math.round(v._kcalF);
          v.dist=parseFloat(v._distF.toFixed(2));
        }
        v._accLast=agora;
      }
    }
  });
  if(!device.ant){ _bled112LastTick = Date.now();
  _bled112Falhas = 0; }   // 07/10b: dado do ANT+ não conta como sinal do BLED112   // chegou dado: zera a contagem de falhas
}


function _parIniciarLiveBLED112(){
  if(_bled112LiveActive) return;
  _bled112LiveActive = true;
  _bled112LastTick   = Date.now();

  var _processDevice=_prProcessDevice;   // 07/10b: a mesma entrada serve ao BLED112 e ao ANT+

  function _scanLoop(){
    if(!_bled112LiveActive) return;
    if(!BLED112.connected){
      // Conexão perdida → reconectar silenciosamente e retomar
      setTimeout(function(){
        if(!_bled112LiveActive) return;
        parBLED112Init(function(){ _scanLoop(); }, function(){
          if(_bled112LiveActive) setTimeout(_scanLoop, 5000);
        });
      }, 2000);
      return;
    }
    // Scan contínuo — a M3i transmite a cada ~319ms (non-connectable broadcast).
    // Não parar nunca: reiniciar apenas se o dongle engasgar (watchdog trata disso).
    try{
      BLED112.startScan(function(device){ try{ _processDevice(device); }catch(e){} });
    }catch(e){
      // Se startScan falhar (ex: scan já ativo), aguardar 1s e tentar de novo
      setTimeout(function(){ if(_bled112LiveActive) _scanLoop(); }, 1000);
    }
  }

  _scanLoop();

  // Watchdog: M3i transmite a cada ~319ms — se não há tick em 8s algo falhou → reiniciar
  if(_bled112Watchdog) clearInterval(_bled112Watchdog);
  _bled112Watchdog = setInterval(function(){
    if(!_bled112LiveActive){ clearInterval(_bled112Watchdog); return; }
    if(Date.now() - _bled112LastTick > 8000){
      console.warn('[BLED112] Watchdog: sem dados há 8s, a reiniciar scan...');
      // Depois de 3 reinicios seguidos sem um unico byte, o problema nao e o
      // scan: e a porta. Avisa na tela em vez de ficar reiniciando em silencio.
      _bled112Falhas = (_bled112Falhas||0) + 1;
      if(_bled112Falhas>=3){
        console.error('[BLED112] 3 reinicios sem dado nenhum. Suspeita de porta zumbi: '
          + 'tirar e por o dongle e limpar a autorizacao em chrome://settings/content/serialPorts');
        try{ _parToast && _parToast('Dongle nao responde — tirar e por o pendrive BLE'); }catch(e){}
      }
      _bled112LiveActive = false;
      try{ BLED112.stopScan(); }catch(e){}
      setTimeout(function(){ _parIniciarLiveBLED112(); }, 1000);
    }
  }, 5000);
}

function _parPararLiveBLED112(){
  _bled112LiveActive = false;
  if(_bled112Watchdog){ clearInterval(_bled112Watchdog); _bled112Watchdog=null; }
  try{ BLED112.stopScan(); }catch(e){}
}

// ── TICK SEMPRE-ATIVO ──────────────────────────────────────────
// Mantém a grade de Potência viva MESMO sem aula tocando (fora do gate isPlaying),
// e limpa bikes que pararam de transmitir (descongela valores antigos).
var _gymLiveTickInt = null;
function _gymIniciarLiveTick(){
  if(_gymLiveTickInt) return;
  _gymLiveTickInt = setInterval(function(){
    if(typeof alunosMap==='undefined') return;
    var agora = Date.now();
    // 1) Presença: remove virtuais cuja bike sumiu; zera valores velhos de aluno real
    Object.keys(alunosMap).forEach(function(nome){
      var a = alunosMap[nome];
      if(a && a._celSrc && !a._bledSrc && (agora-(a._celTs||0)) > GYM_BIKE_STALE_MS && a.watts){ a.watts=0; a.rpm=0; a.ftp=0; a.zona='z1'; }   // 03/10o: celular parou de mandar
      if(!a || !a._bledSrc) return;
      if((agora - (a._lastSeen||0)) > GYM_BIKE_STALE_MS){
        if(a._virtual){ delete alunosMap[nome]; }
        else { a.watts=0; a.rpm=0; a.ftp=0; a.zona='z1'; } // descongela card do aluno real
      }
    });
    // 2) Re-render leve da tela ativa — independente de isPlaying
    if(ctrlScreen===1 || ctrlScreen===2 || ctrlScreen===5) _prSeguro('atualizaCards', atualizaCards);
    else if(ctrlScreen===4)              _prSeguro('atualizaRanking', atualizaRanking);
    else if(ctrlScreen===3)              _prSeguro('qrLista', _qrListaRender);
    if(typeof atualizaLiveBar==='function') _prSeguro('atualizaLiveBar', atualizaLiveBar);
  }, 150); // 26/09c: ~7x/s, aplicando so o que mudou
}

/** Cancela o scan BLED112 e fecha o painel */
function _parCancelarBLED112(){
  try{ BLED112.stopScan(); }catch(e){}
  try{ if(typeof ANTPLUS!=='undefined'&&ANTPLUS.connected){ ANTPLUS.stopScan(); _parIniciarLiveANT(); } }catch(e){}   // 07/10b
  if(_bled112ScanTimer){ clearTimeout(_bled112ScanTimer); _bled112ScanTimer=null; }
  var listEl=document.getElementById('bled112DevList');
  if(listEl) listEl.remove();
  _parPararScanDe();
  var instr=document.getElementById('parInstrucao');
  if(instr) instr.textContent='Scan cancelado.';
}

function _parScanFallback(num){
  setTimeout(function(){
    var nomes=['Keiser M3i','Stages SB20','Wahoo KICKR','Tacx Neo','Elite Suito','Schwinn IC8'];
    var nome=nomes[Math.floor(Math.random()*nomes.length)]+' #'+(1000+Math.floor(Math.random()*9000));
    parBikeMap[num]={tipo:parTipo,nome:nome,id:'',watts:0,rpm:0};
    _parPararScanDe();
    _parIniciarLiveSimulado(num);
    _parSalvar(); // guardar automaticamente ao conectar
    _parAtualizarCard(null,num,parBikeMap[num]);
    var instr=document.getElementById('parInstrucao');
    if(instr) instr.textContent='✓ Bike '+num+' guardada automaticamente.';
    _parAbrirOpMenu(num); // abrir menu de opções após pareamento
  },1500);
}

// ── DADOS SIMULADOS DE PAREAMENTO ─────────────────────────────────
// Este gerador existe para testar o pareamento sem dongle. O problema: ele
// escrevia watts e rotacao inventados direto no parBikeMap E DIRETO NA TELA,
// por cima da regra de "sem sinal" — por isso uma bike aparecia marcada como
// SEM SINAL exibindo 191 W ao mesmo tempo (visto em 18/09).
// Numeros inventados indistinguiveis dos medidos sao o pior defeito possivel
// neste sistema: o professor decide em cima deles.
// Agora a bike fica MARCADA como simulada, o cartao diz SIMULADO em vez de
// mentir "sem sinal", e o Console avisa.
function _parPararLiveSimulado(num){
  if(parLiveInts[num]){ clearInterval(parLiveInts[num]); delete parLiveInts[num]; }
  if(parBikeMap[num]) delete parBikeMap[num]._sim;
}
function _parIniciarLiveSimulado(num){
  if(parLiveInts[num]) clearInterval(parLiveInts[num]);
  if(parBikeMap[num]) parBikeMap[num]._sim = true;
  console.warn('[ProRider] bike '+num+' em MODO SIMULADO: os watts e a rotacao dela '
    + 'sao inventados, nao vem de bike nenhuma. Serve so para testar o pareamento.');
  try{ if(typeof _parToast==='function') _parToast('Bike '+num+': dados SIMULADOS, nao medidos'); }catch(e){}
  var baseW=120+Math.floor(Math.random()*80);
  var baseR=75+Math.floor(Math.random()*20);
  parLiveInts[num]=setInterval(function(){
    if(!parBikeMap[num]) return;
    var w=Math.round(baseW+(Math.random()-0.5)*20);
    var r=Math.round(baseR+(Math.random()-0.5)*5);
    parBikeMap[num].watts=w; parBikeMap[num].rpm=r;
    parBikeMap[num]._sim = true;
    parBikeMap[num]._lastSeen = Date.now();   // nao mentir "sem sinal"
    var wEl=document.getElementById('parW'+num);
    var rEl=document.getElementById('parR'+num);
    if(wEl) wEl.innerHTML=w+'<span style="font-size:10px;color:rgba(255,255,255,.4);"> W</span>';
    if(rEl) rEl.innerHTML=r+'<span style="font-size:9px;"> rpm</span>';
  },1000);
}

function parGuardarBike(){
  if(!parBikeMap[parBikeFoco]) return;
  _parSalvar();
  var instr=document.getElementById('parInstrucao');
  if(instr) instr.textContent='✓ Bike '+parBikeFoco+' guardada!';
  // Flash verde no card
  var card=document.getElementById('bikeCard'+parBikeFoco);
  if(card){card.style.borderColor='#5db13d';setTimeout(function(){if(parBikeMap[parBikeFoco])card.style.borderColor='#ea860c';},1000);}
}

// Navegação gamepad/teclado no pareamento
function parLimparFoco(){
  var num=parBikeFoco;
  if(!parBikeMap[num]) return;
  if(typeof parLiveInts!=='undefined' && parLiveInts[num]){clearInterval(parLiveInts[num]);delete parLiveInts[num];}
  delete parBikeMap[num];
  if(typeof _parSalvar==='function')_parSalvar();
  if(num===99) _parPintarProf(document.getElementById('bikeCard99'), null); else _parAtualizarCard(null,num,null);
  _parAtualizarResumo();
  var instr=document.getElementById('parInstrucao'); if(instr) instr.textContent='Posi\u00e7\u00e3o '+(num===99?'do professor':num)+' limpa.';
}
function parPairHR(num){
  if(num==null) num=parBikeFoco;
  var b=parBikeMap[num]; if(!b||!b.nome) return;
  if(b._hr){ b._hr=null; } else { b._hr=118+Math.floor(Math.random()*44); } // placeholder ate sensor real de FC
  if(num===99) _parPintarProf(document.getElementById('bikeCard99'), b); else _parAtualizarCard(null,num,b);
}
function parNavegar(dx,dy){
  var cols=5;
  // Se estamos na bike 99 (prof), qualquer seta para baixo vai para bike 1
  if(parBikeFoco===99){
    if(dy>0){ parBikeFoco=1; }
    else if(dx!==0){ /* nada: prof ocupa toda a linha */ }
    _parAtualizarFoco(); return;
  }
  var col=((parBikeFoco-1)%cols)+dx;
  var row=Math.floor((parBikeFoco-1)/cols)+dy;
  col=Math.max(0,Math.min(cols-1,col));
  // Se sobe acima da primeira linha → vai para bike 99 (professor)
  if(row<0){ parBikeFoco=99; _parAtualizarFoco(); return; }
  row=Math.min(Math.ceil(parNumBikes/cols)-1,row);
  parBikeFoco=Math.min(parNumBikes, row*cols+col+1);
  _parAtualizarFoco();
}

// ── CONFIGURAÇÕES ────────────────────────────────────────────
var settingsDemo = false; // começa desligado — nada de demo até o professor ligar
var settingsNumDemo_val = 15;
// 09/10: lembra o que o professor deixou (aluno demo ligado/desligado e quantos)
try{ (function(){ var d=JSON.parse(localStorage.getItem('pr_demo')||'null'); if(d){ settingsDemo=!!d.on; demoWanted=!!d.on; if(d.n>=5&&d.n<=30) settingsNumDemo_val=d.n; } })(); }catch(e){}
var _settingsHoldTimer = null;
var _settingsHoldStart = 0;

function abrirSettings(){
  if(idleOn) sairIdle();
  var s = document.getElementById('settingsScreen');
  if(s){ s.style.display='flex'; _settingsFoco=0; _settingsUpdateUI(); _settingsVerificarHardware(); setTimeout(_settingsAtualizarFoco,50); }
}
function fecharSettings(){
  var s = document.getElementById('settingsScreen');
  if(s) s.style.display='none';
}

function _settingsDot(id, cor, pulse){
  var el=document.getElementById(id);
  if(!el) return;
  el.style.background=cor;
  el.style.boxShadow=pulse?'0 0 8px '+cor:'none';
}

function _settingsVerificarHardware(){
  // Bluetooth
  var btDot=document.getElementById('btDot');
  var btSt=document.getElementById('btStatus');
  if(navigator.bluetooth){
    _settingsDot('btDot','#295fe8',true);
    if(btSt) btSt.textContent='BLE disponível neste dispositivo';
  } else {
    _settingsDot('btDot','#d62d2d',false);
    if(btSt) btSt.textContent='BLE não disponível (requer HTTPS + Chrome)';
  }
  // ANT+ via WebUSB
  var antSt=document.getElementById('antStatus');
  if(navigator.usb){
    navigator.usb.getDevices().then(function(devices){
      var ant=devices.filter(function(d){
        return d.vendorId===0x0FCF; // Garmin ANT+ vendor ID
      });
      if(ant.length>0){
        _settingsDot('antDot','#5db13d',true);
        if(antSt) antSt.textContent='Dongle detectado: '+ant[0].productName;
      } else {
        _settingsDot('antDot','rgba(255,255,255,.2)',false);
        if(antSt) antSt.textContent='Dongle não detectado';
      }
    });
  } else {
    _settingsDot('antDot','#d62d2d',false);
    if(antSt) antSt.textContent='WebUSB não disponível (requer Chrome)';
  }
}

function settingsScanBT(){
  var btSt=document.getElementById('btStatus');
  if(!navigator.bluetooth){
    _settingsDot('btDot','#d62d2d',false);
    if(btSt) btSt.textContent='BLE não disponível — requer Chrome + HTTPS';
    return;
  }
  if(location.protocol==='file:'){
    _settingsDot('btDot','#d7c414',false);
    if(btSt) btSt.textContent='BLE requer HTTPS — abre via servidor local ou GitHub Pages';
    return;
  }
  if(btSt) btSt.textContent='Escaneando...';
  _settingsDot('btDot','#295fe8',true);
  navigator.bluetooth.requestDevice({
    acceptAllDevices:true,
    optionalServices:['00001818-0000-1000-8000-00805f9b34fb',
                      '00001826-0000-1000-8000-00805f9b34fb',
                      '0000180d-0000-1000-8000-00805f9b34fb']
  }).then(function(device){
    _settingsDot('btDot','#5db13d',true);
    if(btSt) btSt.textContent='✓ '+device.name+' encontrado';
  }).catch(function(){
    _settingsDot('btDot','rgba(255,255,255,.2)',false);
    if(btSt) btSt.textContent='Scan cancelado';
  });
}

function settingsScanANT(){
  var antSt=document.getElementById('antStatus');
  if(!navigator.usb){
    _settingsDot('antDot','#d62d2d',false);
    if(antSt) antSt.textContent='WebUSB não disponível — requer Chrome';
    return;
  }
  if(location.protocol==='file:'){
    _settingsDot('antDot','#d7c414',false);
    if(antSt) antSt.textContent='WebUSB requer HTTPS — abre via servidor local';
    return;
  }
  if(antSt) antSt.textContent='Procurando dongle ANT+...';
  // Verificar dongle já autorizado antes de pedir novo
  navigator.usb.getDevices().then(function(devices){
    var ant=devices.filter(function(d){return d.vendorId===0x0FCF;});
    if(ant.length>0){
      _settingsDot('antDot','#5db13d',true);
      if(antSt) antSt.textContent='✓ Dongle detectado: '+ant[0].productName;
    } else {
      // Só abre popup se nenhum dongle autorizado
      navigator.usb.requestDevice({filters:[{vendorId:0x0FCF}]})
        .then(function(device){
          _settingsDot('antDot','#5db13d',true);
          if(antSt) antSt.textContent='✓ '+device.productName+' conectado';
        }).catch(function(){
          _settingsDot('antDot','rgba(255,255,255,.2)',false);
          if(antSt) antSt.textContent='Nenhum dongle selecionado';
        });
    }
  });
}
function _settingsUpdateUI(){
  var tog = document.getElementById('settingsDemoToggle');
  var knob = document.getElementById('settingsDemoKnob');
  var numVal = document.getElementById('settingsNumVal');
  if(tog) tog.style.background = settingsDemo ? 'rgba(93,177,61,.6)' : 'rgba(255,255,255,.1)';
  if(knob) knob.style.left = settingsDemo ? '27px' : '3px';
  if(knob) knob.style.background = settingsDemo ? '#fff' : 'rgba(255,255,255,.4)';
  if(numVal) numVal.textContent = settingsNumDemo_val;
}
function settingsToggleDemo(){
  settingsDemo = !settingsDemo;
  _settingsUpdateUI();
  demoWanted = settingsDemo;
  if(settingsDemo) simularAlunos();
  else pararDemo();
  _demoSalvar();
}
function settingsNumDemo(delta){
  settingsNumDemo_val = Math.max(5, Math.min(30, settingsNumDemo_val + delta));  // ate 30 (passos de 5)
  _settingsUpdateUI();
  _demoSalvar();
  // Reinicia demo com novo número se já estiver ativo
  if(demoOn){ pararDemo(); simularAlunos(); }
}

// Navegação gamepad dentro das configurações
// Focos: 0=BT, 1=ANT+, 2=Demo (toggle+nº), 3=Fechar
var _settingsFoco=0;
var _settingsFocoMax=2; // 0=Pareamento, 1=Demo, 2=Fechar

function settingsNavegar(dir){
  // ↑↓ SEMPRE navega entre secções
  _settingsFoco=Math.max(0,Math.min(_settingsFocoMax,_settingsFoco+dir));
  _settingsAtualizarFoco();
}
function _settingsAtualizarFoco(){
  var rows=document.querySelectorAll('.settings-row');
  rows.forEach(function(el,i){
    el.style.outline=i===_settingsFoco?'2px solid rgba(234,134,12,.7)':'none';
    el.style.borderRadius='16px';
    if(i===_settingsFoco) el.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}
function settingsAcaoLateral(dir){
  // ← → só muda o nº de alunos quando focado no Demo (foco 2)
  if(_settingsFoco===2) settingsNumDemo(dir>0?5:-5);
}
function settingsConfirmar(){
  if(_settingsFoco===0) abrirPareamento();
  else if(_settingsFoco===1) settingsToggleDemo();
  else if(_settingsFoco===2) fecharSettings();
}

// Detecção SELECT+START segurado 2s
function _settingsCheckHold(sel, sta){
  if(sel && sta){
    if(!_settingsHoldStart) _settingsHoldStart = Date.now();
    if(Date.now() - _settingsHoldStart >= 5000){
      _settingsHoldStart = 0;
      abrirSettings();
    }
  } else {
    _settingsHoldStart = 0;
  }
}
// ── FIM CONFIGURAÇÕES ─────────────────────────────────────────

// Aliases para compatibilidade com o HTML
function quickBarPause(){ qbPause(); }
function quickBarClose(){ fecharQB(); }
function quickBarFTP(){ qbFTP(); }
function quickBarFTPSel(btn){ qbFTPSel(btn); }
function quickBarFTPStart(){ qbFTPStart(); }
function quickBarFFStart(dir){ qbFFStart(dir); }
function quickBarFFStop(){ qbFFStop(); }

// Navegação D-pad na Quick Bar
var qbFocusIdx=0;
var qbFtpFocusIdx=2; // 0=3min,1=5min,2=10min,3=20min
var qbFtpVals=[3,5,10,20];

function qbGetBtns(){ return Array.from(document.querySelectorAll('#quickBar .qb-inner .qb-btn')); }
function qbSetFocus(idx){
  var btns=qbGetBtns();
  qbFocusIdx=Math.max(0,Math.min(btns.length-1,idx));
  btns.forEach(function(b,i){ b.classList.toggle('qb-focused',i===qbFocusIdx); });
}
function qbFtpNavegar(dir){
  // IMPORTANTE: a classe .qb-ftp-opt é compartilhada com os seletores do DESAFIO.
  // Escopar em #qbFTPSub pega SÓ os protocolos do teste (3/5/10/20), senão o .sel vai pro grupo errado.
  var sub=document.getElementById('qbFTPSub');
  var opts=sub?Array.prototype.slice.call(sub.querySelectorAll('.qb-ftp-opt')):[];
  if(!opts.length){
    qbFtpFocusIdx=Math.max(0,Math.min(qbFtpVals.length-1,qbFtpFocusIdx+dir));
    qbFtpMin=qbFtpVals[qbFtpFocusIdx]; return;
  }
  var cur=-1; opts.forEach(function(o,i){ if(o.classList.contains('sel')) cur=i; });
  if(cur<0) cur=Math.min(qbFtpFocusIdx, opts.length-1);
  var nxt=Math.max(0,Math.min(opts.length-1,cur+dir));
  qbFtpFocusIdx=nxt;
  opts.forEach(function(o,i){ o.classList.toggle('sel',i===nxt); });
  var dm=parseInt(opts[nxt].getAttribute('data-min'),10);
  qbFtpMin=!isNaN(dm)?dm:(qbFtpVals[nxt]!=null?qbFtpVals[nxt]:qbFtpMin);
}
function qbConfirmar(){
  if(_desafioAberto){ _desafioSubConfirmar(); return; }
  if(qbFtpAberta){ qbFTPStart(); return; }
  var btns=qbGetBtns();
  if(btns[qbFocusIdx]) btns[qbFocusIdx].click();
}

function abreQB(){var el=document.getElementById('quickBar');if(!el)return;el.style.display='flex';qbAberta=true;qbFtpAberta=false;var sub=document.getElementById('qbFTPSub');if(sub)sub.style.display='none';var fb=document.getElementById('qbFTPBtn');if(fb)fb.classList.remove('active');setTimeout(function(){el.classList.add('visible');qbSetFocus(0);},10);clearTimeout(el._ac);el._ac=setTimeout(function(){if(qbAberta)fecharQB();},30000);}
function fecharQB(){var el=document.getElementById('quickBar');if(!el)return;el.classList.remove('visible');setTimeout(function(){el.style.display='none';},280);qbAberta=false;qbFtpAberta=false;ffDir=0;if(ffInt){clearInterval(ffInt);ffInt=null;}}
function qbPause(){if(typeof isPlaying==='undefined')return;if(isPlaying){isPlaying=false;if(typeof pausedElapsed!=='undefined')pausedElapsed=performance.now()-(typeof blockStartTime!=='undefined'?blockStartTime:0);
  // PAUSE tem de parar a midia tambem: antes o MP3 e o video continuavam a tocar
  // com a aula parada, e ao avancar blocos a musica acabava antes da aula.
  try{ _prMidiaPausar(); }catch(e){}
  // congela o grafico exatamente no ponto da pausa (o laco de animacao para no
  // frame seguinte e podia deixar o desenho meio quadro atras)
  try{ _prMiniGrafUpdate(_prSecTotal(workout.slice(0,currentBlockIndex))+(pausedElapsed/1000)); }catch(e){}
}else{isPlaying=true;if(typeof blockStartTime!=='undefined')blockStartTime=performance.now()-(typeof pausedElapsed!=='undefined'?pausedElapsed:0);
  // ao retomar, realinha na hora (o professor pode ter avancado blocos na pausa)
  try{ var _pr=Math.min(1,(pausedElapsed/1000)/(_prSec(workout[currentBlockIndex])||1)); _prMidiaSync(calcDoneSec(_pr),0.2); }catch(e){}
  // e redesenha o grafico do topo antes do primeiro frame voltar a rodar
  try{ _prMiniGrafUpdate(_prSecTotal(workout.slice(0,currentBlockIndex))+(pausedElapsed/1000)); }catch(e){}
  if(typeof runTimer==='function')requestAnimationFrame(runTimer);}var pi=document.getElementById('qbPauseIcon'),pl=document.getElementById('qbPauseLabel');if(pi)pi.textContent=isPlaying?'pause':'play';if(pl)pl.textContent=isPlaying?'Pause':'Retomar';}
function qbFFStart(dir){ffDir=dir;qbFFStep();ffInt=setInterval(qbFFStep,100);}
function qbFFStop(){if(ffInt){clearInterval(ffInt);ffInt=null;}ffDir=0;}
function qbFFStep(){if(!ffDir||typeof pausedElapsed==='undefined'||typeof workout==='undefined'||!workout.length)return;pausedElapsed=Math.max(0,pausedElapsed+ffDir*1000);var ci=typeof currentBlockIndex!=='undefined'?currentBlockIndex:0,tot=_prSec(workout[ci])*1000;if(pausedElapsed>=tot&&ci<workout.length-1){pausedElapsed-=tot;currentBlockIndex++;}if(pausedElapsed<0&&ci>0){currentBlockIndex--;pausedElapsed+=_prSec(workout[currentBlockIndex])*1000;}pausedElapsed=Math.max(0,pausedElapsed);
  // realinha a midia a cada passo do avanco rapido (100ms), para o professor
  // ouvir onde esta caindo em vez de a musica seguir solta
  try{ var _pf=Math.min(1,(pausedElapsed/1000)/(_prSec(workout[currentBlockIndex])||1)); _prMidiaSync(calcDoneSec(_pf),0.3); }catch(e){}
  // ...e o grafico do topo junto. Este era o ponto cego: o avanco rapido mexia
  // no relogio, na musica e no video, mas o grafico das telas de rotacao,
  // cadencia e potencia so era redesenhado pelo laco de animacao — que NAO roda
  // com a aula pausada. Por isso ele ficava para tras depois de avancar ou
  // voltar blocos com a aula parada.
  try{
    var _dFF=_prSecTotal(workout.slice(0,currentBlockIndex))+(pausedElapsed/1000);
    _prMiniGrafUpdate(_dFF);
    if(typeof renderLiveTimeline==='function') renderLiveTimeline();
    if(typeof updateLiveScreen==='function') updateLiveScreen(_pf);
    var _tFF=_prSecTotal(workout);
    if(typeof updateTotalProgress==='function') updateTotalProgress(_tFF?_dFF/_tFF:0);
  }catch(e){}
}
function _qbSaltarBloco(novoIdx){
  if(typeof workout==='undefined'||!workout.length) return;
  currentBlockIndex=novoIdx;
  pausedElapsed=0;
  blockStartTime=performance.now();

  // Posição real da aula depois do salto. Era o ponto cego: este caminho mudava
  // o bloco e NAO mexia na midia — a musica so era puxada no frame seguinte, e
  // so se a diferenca passasse da tolerancia. Saltando bloco a bloco (varios
  // curtos, de 20-25s), a diferenca ficava abaixo da tolerancia e o MP3 seguia
  // correndo em tempo real, acumulando adianto a cada salto ate acabar antes da aula.
  var _totS = _prSecTotal(workout);
  var _doneS = _prSecTotal(workout.slice(0,currentBlockIndex));

  if(typeof renderLiveTimeline==='function') renderLiveTimeline();
  if(typeof updateLiveScreen==='function') updateLiveScreen(0);
  // updateTotalProgress(0) zerava a barra de progresso total a cada salto
  if(typeof updateTotalProgress==='function') updateTotalProgress(_totS?_doneS/_totS:0);
  if(typeof showTransition==='function') showTransition(currentBlockIndex);

  // Re-ancora a midia NA HORA e com tolerancia apertada
  try{ _prMidiaSync(_doneS, 0.15); }catch(e){}
  try{ _prMiniGrafUpdate(_doneS); }catch(e){}
  try{
    if(window._SYNC_DEBUG && typeof backgroundAudio!=='undefined' && backgroundAudio && backgroundAudio.src){
      console.log('[SYNC] bloco '+(currentBlockIndex+1)+'/'+workout.length+
        ' | aula '+formatTime(_doneS)+' | mp3 '+formatTime(backgroundAudio.currentTime)+
        ' | erro '+(backgroundAudio.currentTime-_doneS).toFixed(2)+'s');
    }
  }catch(e){}

  if(typeof wsBroadcast==='function'){
    var cb=workout[currentBlockIndex];
    // enviava doneSec=0: o app do aluno via a aula voltar ao inicio a cada salto
    var _segRest=(typeof calcSegRemaining==='function')?calcSegRemaining(cb.segmentId,0):(_prSec(cb)||60);
    wsBroadcast(cb,_segRest,_doneS,workout[currentBlockIndex+1]||null,Math.max(0,_totS-_doneS),_prSec(cb));
  }
  fecharQB();
}
function qbProximoBloco(){
  var ci=typeof currentBlockIndex!=='undefined'?currentBlockIndex:0;
  if(typeof workout==='undefined'||!workout.length||ci>=workout.length-1) return;
  _qbSaltarBloco(ci+1);
}
function qbBlocoAnterior(){
  var ci=typeof currentBlockIndex!=='undefined'?currentBlockIndex:0;
  if(typeof workout==='undefined'||!workout.length||ci<=0) return;
  _qbSaltarBloco(ci-1);
}
function qbFTP(){qbFtpAberta=!qbFtpAberta;var s=document.getElementById('qbFTPSub');if(s)s.style.display=qbFtpAberta?'flex':'none';var b=document.getElementById('qbFTPBtn');if(b)b.classList.toggle('active',qbFtpAberta);if(qbFtpAberta){var el=document.getElementById('quickBar');if(el){clearTimeout(el._ac);el._ac=setTimeout(function(){if(qbAberta)fecharQB();},30000);}}}
function qbFTPSel(btn){var sub=document.getElementById('qbFTPSub');var scope=sub||document;scope.querySelectorAll('.qb-ftp-opt').forEach(function(o){o.classList.remove('sel');});btn.classList.add('sel');qbFtpMin=parseInt(btn.dataset.min);var _vi=qbFtpVals.indexOf(qbFtpMin);if(_vi>=0)qbFtpFocusIdx=_vi;}
var _demoFtpMode = false;
var _demoFtpTick = 0;

function _ativarDemoFtpMode(duracaoMin){
  _demoFtpMode = true;
  _demoFtpTick = 0;
  var totalTicks = duracaoMin * 60 / 1.2; // ticks do intervalo demo (1.2s)
  // Guardar ftpBase original e preparar curva de esforço
  DALUNOS.forEach(function(al){
    var s = demoState[al.nome];
    if(s) s._ftpTestBase = al.ftpBase;
  });
}
function _pararDemoFtpMode(){
  _demoFtpMode = false;
  _demoFtpTick = 0;
}

// Fatores de cálculo FTP por protocolo
// Fatores de correcao por protocolo — OS MESMOS do app do aluno, senao o mesmo
// teste devolve FTP diferente conforme onde foi feito.
// 60 min = 1,00: e a propria definicao de FTP, nao precisa de correcao.
var _ftpCalcFactor={3:0.85,5:0.87,10:0.90,20:0.95,60:1.00};
var _ftpPanelInt=null;

function _prCriaFtpPanel(){
  var p=document.getElementById('ftpTestPanel');
  if(p) return p;
  // Painel não existe neste ginasio.html → cria (à prova do fork)
  p=document.createElement('div'); p.id='ftpTestPanel';
  p.style.cssText='position:fixed;inset:0;z-index:19000;background:rgba(4,6,14,.97);display:none;flex-direction:column;padding:28px 32px 24px;box-sizing:border-box;overflow:hidden;';
  p.innerHTML=''
    +'<div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">'
      +'<div style="font-family:Bebas Neue,Barlow Condensed,sans-serif;font-size:44px;letter-spacing:3px;color:#fff;line-height:1;">TESTE DE FTP</div>'
      +'<div id="ftpPanelProto" style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:800;letter-spacing:2px;color:#ea860c;">— MIN</div>'
      +'<div style="margin-left:auto;font-size:14px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.4);text-transform:uppercase;">ao vivo · cinza = abaixo do seu FTP · verde = acima</div>'
    +'</div>'
    +'<div id="ftpTestRankList" style="flex:1;min-height:0;display:grid;gap:14px;align-content:start;overflow:hidden;margin-top:14px;"></div>';
  document.body.appendChild(p);
  return p;
}
// Altura real da barra do teste FTP (a barra e criada depois do painel).
function _prFtpBarH(){
  var b=document.getElementById('profFtpBar');
  return (b&&b.offsetHeight)?b.offsetHeight:122;
}
function _prFtpAjustaTopo(){ /* 26/09c: a tela nova do teste ocupa a tela toda (sem a barra de cima) */ }
window.addEventListener('resize',_prFtpAjustaTopo);
// ══ 26/09c — TESTE DE FTP NO PADRAO DAS TELAS DE DESAFIO ════════════
// Ao vivo e no resultado final: duas colunas de alunos (10 por coluna, troca
// de pagina a cada 5 s se passar de 20) e o centro com o relogio do teste.
// Cor do aluno: verde = projecao acima do FTP atual; cinza = abaixo.
// Barra sob o nome: quanto da meta (o FTP atual) a projecao ja alcanca — o
// risco branco a 80% da barra e o FTP atual.
// Resultado: podio pela MAIOR EVOLUCAO (%) — equilibrado, como os desafios.
var FTP_VERDE='#5db13d', FTP_CINZA='#9aa0aa';
function _ftpLista(final){
  if(final && window._ftpFinalSnap) return window._ftpFinalSnap.map(function(d){ return Object.assign({},d); }); // resultado congelado
  var factor=_ftpCalcFactor[qbFtpMin]||0.95;
  return Object.values(alunosMap).filter(function(a){ return a&&a.nome&&a._ftpParticipa!==false; }).map(function(a){
    var proj=_calcNovoFtp(a,factor);
    var ant=final&&a._ftpAntTeste!=null?a._ftpAntTeste:(a.ftpBase||150);
    return {nome:a.nome,a:a,proj:proj,ant:ant,diff:proj-ant,pct:(proj>0&&ant>0)?(proj/ant-1)*100:-999,w:Math.round(_ftpWattsAgora(a))};
  });
}
function _ftpLinha(d,pos,destaque){
  if(!d) return '<div class="dsx-row dsx-vazia"></div>';
  var sem=!(d.proj>0), cor=sem?'rgba(255,255,255,.3)':(d.diff>0?FTP_VERDE:FTP_CINZA);
  var ini=String(d.nome).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
  var av=d.a.foto?'<img src="'+d.a.foto+'" alt="">':_desEsc(ini);
  var larg=sem?0:Math.max(2,Math.min(100,d.proj/d.ant*80));
  var med=!destaque?'':pos===1?'dsx-p1':pos===2?'dsx-p2':pos===3?'dsx-p3':'';
  return '<div class="dsx-row'+(destaque&&pos<=3?' dsx-podio':'')+'">'
    +'<div class="dsx-pos '+med+'">'+pos+'</div>'
    +'<div class="dsx-av" style="border-color:'+cor+';color:'+cor+';">'+av+'</div>'
    +'<div class="dsx-nm"><div class="dsx-nome">'+_desEsc(d.nome)+'</div>'
      +'<i class="dsx-barra dsx-barra-ftp"><s style="width:'+larg.toFixed(1)+'%;background:'+cor+';"></s></i></div>'
    +'<div class="dsx-val" style="color:'+cor+';">'+(sem?'--':d.proj)+'<small>'+(sem?'sem dados':((d.diff>0?'+':'')+d.diff+' W'))+'</small></div>'
    +'</div>';
}
function _ftpColuna(lista,base,cor,titulo,simbolo,rodape,destaque,nLin){
  nLin=nLin||DES_POR_PAG; var h='';
  for(var i=0;i<nLin;i++) h+=_ftpLinha(lista[i],base+i+1,destaque);
  return '<div class="dsx-col" style="--dsxc:'+cor+';">'
    +'<div class="dsx-colhead"><span class="dsx-sim">'+simbolo+'</span><span class="dsx-tit">'+titulo+'</span><span class="dsx-pag">'+rodape+'</span></div>'
    +'<div class="dsx-lista" style="grid-template-rows:repeat('+nLin+', minmax(0,1fr));">'+h+'</div></div>';
}
function _ftpPodio(tres){
  var pos=[1,0,2], cls=['dsx-pd2','dsx-pd1','dsx-pd3'], h='<div class="dsx-podio3">';
  pos.forEach(function(i,k){
    var d=tres[i]; if(!d){ h+='<div class="dsx-pd '+cls[k]+' dsx-pdv"></div>'; return; }
    var cor=d.diff>0?FTP_VERDE:FTP_CINZA;
    var ini=String(d.nome).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    var av=d.a.foto?'<img src="'+d.a.foto+'" alt="">':_desEsc(ini);
    var pr=String(d.nome).trim().split(/\s+/), curto=pr[0]+(pr[1]?' '+pr[1][0]+'.':'');
    h+='<div class="dsx-pd '+cls[k]+'"><div class="dsx-pd-av" style="border-color:'+cor+';color:'+cor+';">'+av+'</div>'
      +'<div class="dsx-pd-nome">'+_desEsc(curto)+'</div>'
      +'<div class="dsx-pd-val" style="color:'+cor+';">'+d.proj+'<small>W</small></div>'
      +'<div class="dsx-pd-sub" style="color:'+cor+';">'+(d.pct>=0?'+':'')+d.pct.toFixed(1).replace('.',',')+'%</div>'
      +'<div class="dsx-pd-bloco"><b>'+(i+1)+'</b></div></div>';
  });
  return h+'</div>';
}
function _ftpTelaHTML(final){
  var L=_ftpLista(final), R=46, C=2*Math.PI*R;
  var comW=L.filter(function(d){return d.proj>0;}), semW=L.filter(function(d){return !(d.proj>0);});
  var subiram=comW.filter(function(d){return d.diff>0;}).length;
  var mediaW=comW.length?Math.round(comW.reduce(function(s,d){return s+d.w;},0)/comW.length):0;
  // 26/09c: tudo pelo RELOGIO REAL (antes: contador de 1 em 1 s — o anel andava aos saltos)
  var dur=window._ftpDurTeste||(qbFtpMin*60);
  var decorrido=window._ftpT0?(Date.now()-window._ftpT0)/1000:0;
  var restF=Math.max(0,dur-decorrido), rest=Math.ceil(restF-1e-6);
  var fr=final?1:Math.max(0,Math.min(1,decorrido/dur));
  var colA, colB, lider, corL, centroNum, centroLbl, st1, st2, st3, st4;
  if(!final){
    comW.sort(function(a,b){return b.proj-a.proj;});
    var todos=comW.concat(semW), porTela=DES_POR_PAG*2, pags=Math.max(1,Math.ceil(todos.length/porTela));
    var pg=Math.floor(Date.now()/DES_TROCA_MS)%pags, ini=Math.max(0,Math.min(pg*porTela,todos.length-porTela));
    var esq=todos.slice(ini,ini+DES_POR_PAG), dir=todos.slice(ini+DES_POR_PAG,ini+porTela);
    var fx=function(l,b){ return l.length?(b+1)+'º ao '+(b+l.length)+'º':''; };
    colA=_ftpColuna(esq,ini,'#ea860c','PROJEÇÃO','⚡',fx(esq,ini)+(pags>1?' · de '+todos.length:''),false);
    colB=_ftpColuna(dir,ini+DES_POR_PAG,'#e6c020','PROJEÇÃO','⚡',fx(dir,ini+DES_POR_PAG),false);
    lider=subiram+' DE '+comW.length+' ACIMA DO FTP'; corL=subiram?FTP_VERDE:'#e6c020';
    centroNum=fmtMin(rest); centroLbl='FALTA NO TESTE';
    st1='<div><i>⚡</i><b style="color:#ffd23f">'+mediaW+'<small>W</small></b><span>MÉDIA DA TURMA AGORA</span></div>';
    st2='<div><i style="color:'+FTP_VERDE+'">▲</i><b style="color:'+FTP_VERDE+'">'+subiram+'<small>/'+comW.length+'</small></b><span>ACIMA DO FTP</span></div>';
  } else {
    comW.sort(function(a,b){return b.pct-a.pct || b.proj-a.proj;});
    var ord=comW.concat(semW);
    colA='<div class="dsx-col" style="--dsxc:#ea860c;"><div class="dsx-colhead"><span class="dsx-sim">🏆</span><span class="dsx-tit">MAIOR EVOLUÇÃO</span><span class="dsx-pag">'+ord.length+' participantes</span></div>'
      +_ftpPodio(ord.slice(0,3))
      +'<div class="dsx-lista" style="grid-template-rows:repeat(7, minmax(0,1fr));">'+[3,4,5,6,7,8,9].map(function(i){ return _ftpLinha(ord[i],i+1,false); }).join('')+'</div></div>';
    var resto=ord.slice(10), pags2=Math.max(1,Math.ceil(resto.length/DES_POR_PAG)), pg2=Math.floor(Date.now()/DES_TROCA_MS)%pags2;
    var b2=Math.max(0,Math.min(pg2*DES_POR_PAG,resto.length-DES_POR_PAG));
    colB=_ftpColuna(resto.slice(b2,b2+DES_POR_PAG),10+b2,'#e6c020','CLASSIFICAÇÃO','🏁',resto.length?(11+b2)+'º ao '+(10+b2+Math.min(DES_POR_PAG,resto.length))+'º':'',false);
    lider=subiram+' DE '+comW.length+' SUBIRAM O FTP'; corL=subiram?FTP_VERDE:'#e6c020';
    var evo=comW.length?comW.reduce(function(s,d){return s+d.pct;},0)/comW.length:0;
    centroNum=(evo>=0?'+':'')+evo.toFixed(1).replace('.',',')+'%'; centroLbl='EVOLUÇÃO MÉDIA';
    var ftpMed=comW.length?Math.round(comW.reduce(function(s,d){return s+d.proj;},0)/comW.length):0;
    var maior=comW.slice().sort(function(a,b){return b.diff-a.diff;})[0];
    st1='<div><i>⚡</i><b style="color:#ffd23f">'+ftpMed+'<small>W</small></b><span>FTP MÉDIO DA TURMA</span></div>';
    st2='<div><i style="color:'+FTP_VERDE+'">▲</i><b style="color:'+FTP_VERDE+'">'+(maior?((maior.diff>0?'+':'')+maior.diff):'—')+'<small>W</small></b><span>'+(maior?'MAIOR SALTO · '+_desEsc(String(maior.nome).split(/\s+/)[0].toUpperCase()):'MAIOR SALTO')+'</span></div>';
  }
  st3='<div><i>🏁</i><b>'+qbFtpMin+'<small>min</small></b><span>PROTOCOLO</span></div>';
  st4='<div><i>×</i><b>'+(_ftpCalcFactor[qbFtpMin]||0.95).toFixed(2).replace('.',',')+'</b><span>FATOR DA MÉDIA</span></div>';
  if(final) st4='<div><i>⏱</i><b id="ftpResTimer">1:00</b><span>FECHA EM</span></div>';
  var anel='<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"/>'
    +'<circle class="ftp-arco" cx="50" cy="50" r="'+R+'" fill="none" stroke="#ea860c" stroke-width="5" stroke-dasharray="'+(C*fr).toFixed(3)+' '+C.toFixed(2)+'" transform="rotate(-90 50 50)" style="transition:none"/>';
  return '<div class="dsx">'
    +'<div class="dsx-bg dsx-bg-ge"></div>'
    +'<div class="dsx-top"><div class="dsx-logo"><img src="logo-prorider.png" alt="ProRider" style="height:58px;display:block;"></div>'
    +'<div class="dsx-tipo"><b>TESTE DE FTP</b><i>PROTOCOLO '+qbFtpMin+' MIN · FTP = '+Math.round((_ftpCalcFactor[qbFtpMin]||0.95)*100)+'% DA MÉDIA</i></div></div>'
    +'<div class="dsx-grid">'+colA
    +'<div class="dsx-centro">'
      +'<div class="dsx-fogo">🏁</div>'
      +'<div class="dsx-h1">'+(final?'RESULTADO <b>FINAL</b>':'TESTE <b>DE FTP</b>')+'</div>'
      +'<div class="dsx-h2">'+(final?'TESTE DE FTP':'AO VIVO')+'</div>'
      +'<div class="dsx-lider" style="color:'+corL+';">'+lider+'</div>'
      +'<div class="dsx-anel"><svg viewBox="0 0 100 100">'+anel+'<circle cx="50" cy="50" r="39" fill="rgba(6,8,16,.92)" stroke="rgba(255,255,255,.08)"/></svg>'
        +'<div class="dsx-anel-in"><span>⏱</span><b>'+centroNum+'</b><i>'+centroLbl+'</i></div></div>'
      +'<div class="dsx-stats">'+st1+st2+st3+st4+'</div>'
      +'<div class="dsx-nota">'+(final?'o novo FTP já vale para as próximas aulas · SELECT fecha':'verde = acima do seu FTP · risco branco = seu FTP atual · entra quem pedalou nos 10 primeiros segundos · SELECT encerra')+'</div>'
    +'</div>'+colB
    +'</div><div class="dsx-linha"></div></div>';
}

function _abrirFtpPanel(minutos){
  var p=_prCriaFtpPanel();
  // 26/09c: o painel vira a tela nova (padrao dos desafios), de ponta a ponta
  if(p){ p.style.display='block'; p.style.zIndex='19000'; p.style.pointerEvents='auto';
         p.style.top='0'; p.style.padding='0'; p.style.background='#06050c';
         p.innerHTML='<div id="ftpTelaNova" style="position:absolute;inset:0;"></div>';
         _prFade(p); }
  // anel do teste: anda a CADA QUADRO, pelo relogio real
  _prAnimar('ftpArco',function(){
    var pn=document.getElementById('ftpTestPanel'); if(!pn||pn.style.display==='none') return false;
    var arc=pn.querySelector('.ftp-arco'); if(!arc) return;
    var dur=window._ftpDurTeste||(qbFtpMin*60), fr=window._ftpT0?Math.min(1,(Date.now()-window._ftpT0)/1000/dur):0;
    var C=2*Math.PI*46; arc.setAttribute('stroke-dasharray',(C*fr).toFixed(3)+' '+C.toFixed(2));
  });
  clearInterval(_ftpPanelInt);
  _ftpPanelInt=setInterval(_atualizarFtpPanel,100); // 26/09c: 10x/s
  setTimeout(_atualizarFtpPanel,50);
}
function _fecharFtpPanel(){
  var p=document.getElementById('ftpTestPanel');
  if(p){p.style.display='none';p.style.pointerEvents='none';}
  if(_ftpPanelInt){clearInterval(_ftpPanelInt);_ftpPanelInt=null;}
}
function _atualizarFtpPanel(){
  var c=document.getElementById('ftpTelaNova'); if(!c||typeof alunosMap==='undefined') return;
  _desPintarHTML(c,_ftpTelaHTML(false));
}

function qbFTPStart(){fecharQB();iniciarTesteFTP(qbFtpMin);}
function iniciarTesteFTP(minutos){
  minutos=parseInt(minutos,10)||10;
  _ftpResultadosEnviados=false; // novo teste → permite enviar resultados de novo
  try{ _ativarDemoFtpMode(minutos); }catch(e){ try{console.error('[ProRider] demoFtpMode:',e);}catch(_){} }
  // ── QUEM ENTRA NO TESTE ────────────────────────────────────────
  // Regra do professor: "quem ja fez o teste, para de pedalar agora".
  // No instante do arranque, quem estiver com potencia ZERO fica de fora e
  // pode voltar a pedalar em seguida sem entrar no teste. Nao da para usar a
  // presenca da bike no ar: a Keiser leva cerca de 1 minuto para parar de
  // transmitir, e ninguem fica 1 minuto parado.
  var _PR_FTP_MIN_W = 5;   // ruido: abaixo disso e considerado parado
  try{
    var _dentro=0,_fora=0,_nomesFora=[];
    Object.keys(alunosMap).forEach(function(n){
      var a=alunosMap[n]; if(!a||!a.nome) return;
      var _w=(_demoFtpMode&&demoState[n])?(demoState[n].watts||0):(a.watts||0);
      // 26/09d: a decisao sai nos 10 PRIMEIROS SEGUNDOS (ver _ftpAmostrar);
      // ate la todos aparecem como provisorios
      a._ftpParticipa = undefined; a._ftpViu = _w >= _PR_FTP_MIN_W; a._ftpDecidido = false;
      a._ftpWattsIni  = _w;
      if(a._ftpParticipa) _dentro++; else { _fora++; _nomesFora.push(a.nome); }
    });
    console.log('[ProRider] teste FTP: '+_dentro+' participando, '+_fora+' de fora'+
      (_fora?' ('+_nomesFora.join(', ')+')':'')+' — criterio: potencia >= '+_PR_FTP_MIN_W+'W no arranque.');
  }catch(e){ try{console.error('[ProRider] snapshot FTP:',e);}catch(_){} }

  window._ftpFinalSnap=null;
  try{ Object.keys(alunosMap).forEach(function(n){ var a=alunosMap[n]; if(a){ a._ftpSomaW=0; a._ftpSeg=0; } }); }catch(e){}
  clearInterval(_ftpAmostraInt); _ftpAmostraT=performance.now(); _ftpAmostraInt=setInterval(_ftpAmostrar,250);
  window._ftpDurTeste=minutos*60; window._ftpT0=Date.now();
  try{ _abrirFtpPanel(minutos); }catch(e){ try{console.error('[ProRider] abrirFtpPanel:',e);}catch(_){} }
  // Envia para todos os alunos via servidor
  if(wsProf&&wsProf.readyState===WebSocket.OPEN){
    wsProf.send(JSON.stringify({tipo:'iniciar_ftp',protocolo:minutos}));
  }
  try{ console.log('[ProRider] Teste FTP iniciado:',minutos,'min'); }catch(e){}
  // Mostra timer no professor
  var dur=minutos*60;
  var secsLeft=dur;
  var barEl=document.createElement('div');
  barEl.id='profFtpBar';
  barEl.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(0,0,0,.94);padding:12px 32px;display:flex;align-items:center;gap:28px;border-bottom:2px solid #ea860c;';
  barEl.innerHTML='<div style="display:flex;flex-direction:column;line-height:1;">'
      +'<span style="font-size:20px;font-weight:800;letter-spacing:4px;color:#ea860c;text-transform:uppercase;">TESTE DE FTP</span>'
      +'<span style="font-size:15px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.55);text-transform:uppercase;margin-top:4px;">Protocolo '+minutos+' min</span>'
    +'</div>'
    +'<span id="profFtpTimer" style="font-family:Barlow Condensed,sans-serif;font-size:96px;font-weight:900;color:#fff;letter-spacing:2px;line-height:1;">'+fmtMin(secsLeft)+'</span>'
    +'<div style="flex:1"></div>'
    +'<button onclick="ftpPedirConfirmacao()" style="padding:14px 34px;border-radius:26px;background:rgba(214,45,45,.2);border:1px solid rgba(214,45,45,.5);color:#ff5a5a;font-size:20px;font-weight:800;letter-spacing:1px;cursor:pointer;">Encerrar teste</button>';
  var old=document.getElementById('profFtpBar'); if(old) old.remove();
  document.body.appendChild(barEl);
  // a barra fica ACIMA do painel (19000) para o painel poder cobrir de top:0
  barEl.style.zIndex='19500';
  barEl.style.display='none'; // 26/09c: a tela nova do teste mostra o relogio; a barra fica so como marcador
  requestAnimationFrame(_prFtpAjustaTopo);
  window._ftpSecsLeft=secsLeft;
  var _t0FTP=window._ftpT0||Date.now();
  var profFtpInt=setInterval(function(){
    secsLeft=Math.max(0,dur-Math.floor((Date.now()-_t0FTP)/1000)); window._ftpSecsLeft=secsLeft; // pelo relogio real
    var el=document.getElementById('profFtpTimer');
    if(el) el.textContent=fmtMin(secsLeft);
    if(secsLeft<=0){clearInterval(profFtpInt);setTimeout(function(){try{_mostrarResultadosFinalFTP();}catch(e){encerrarTesteFTP();}},1000);}
  },1000);
  window._profFtpInt=profFtpInt;
}
function encerrarTesteFTP(){
  _enviarResultadosFTP();
  try{ Object.keys(alunosMap).forEach(function(n){ if(alunosMap[n]) delete alunosMap[n]._ftpParticipa; }); }catch(e){} // PRIMEIRO: usa watts/demoState atuais, antes de limpar (cobre fim automático)
  if(window._profFtpInt){ clearInterval(window._profFtpInt); window._profFtpInt=null; }
  clearInterval(_ftpAmostraInt); _ftpAmostraInt=null;
  var el=document.getElementById('profFtpBar'); if(el) el.remove();
  _fecharFtpPanel();
  _pararDemoFtpMode();
}
function fmtMin(s){s=Math.max(0,s);return (Math.floor(s/60)<10?'0':'')+Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60;}
function handleStart(){
  var mE=document.getElementById('modalEncerrar');
  if(mE&&mE.classList.contains('active')){modalEncFoco===1?ctrlConfirmYes():ctrlConfirmNo();return;}
  if(boxMode==='end'){if(Date.now()>=_endUnlockedAt)_endConfirmar();return;}
  if(qbAberta){qbConfirmar();return;}
  // Tela de resultados do FTP: quem fecha e o SELECT (ver handleSelect).
  // O START nao mexe nela — evita fechar sem querer ao tentar abrir a quick bar.
  if(document.getElementById('ftpResultadosFinais')) return;
  // Teste a correr: o START tambem nao faz nada; e o SELECT que pergunta.
  if(document.getElementById('profFtpBar')) return;
  // Desafio ativo → pedir confirmação encerrar
  if(window._desafioAtivo){_desafioEncModal();return;}
  // START abre a QuickBar a partir de QUALQUER tela da aula (potência/rotação/QR/etc).
  // Se houver um overlay aberto, fecha-o (volta ao gráfico) e abre a barra, sempre funcional.
  if(APP_MODE==='gym'&&typeof workout!=='undefined'&&workout&&workout.length){
    if(typeof ctrlScreen!=='undefined'&&ctrlScreen!==0){ try{ ctrlSetScreen(0); }catch(e){} }
    abreQB();
  }
}
function handleSelect(){
  // REGRA DO SELECT (Mario, 30/09):
  //  - teste de FTP / desafio rodando: 1o SELECT PARA (mostra o resultado);
  //    2o SELECT fecha o resultado e volta para o GRAFICO PRINCIPAL;
  //  - tela de imersao (espaco): SELECT sai e volta para o grafico principal;
  //  - nada disso na tela: SELECT pergunta se quer encerrar a AULA.
  if(typeof _espaco!=='undefined' && _espaco.on){ espacoDesligar(); _selVoltarGrafico(); return; }
  if(document.getElementById('ftpResultadosFinais')){ fecharResultadosFinalFTP(); _selVoltarGrafico(); return; }
  if(document.getElementById('desafioResultadoFinal')){ desafioFecharResultado(); _selVoltarGrafico(); return; }
  var mF=document.getElementById('modalEncerrarFTP'); if(mF&&mF.classList.contains('active')) mF.classList.remove('active');
  if(document.getElementById('profFtpBar')){ ftpModalSim(); return; }        // para o teste na hora (sem pergunta)
  var mD=document.getElementById('modalEncerrarDesafio'); if(mD&&mD.classList.contains('active')) mD.classList.remove('active');
  if(window._desafioAtivo){ desafioModalSim(); return; }                      // para o desafio na hora
  if(qbAberta){fecharQB();return;}
  // Na aula ativa → pedir confirmação para encerrar aula
  if(boxMode==='live'||boxMode==='livre'||boxMode==='sessao'){ctrlAskConfirm();return;}
}
function _selVoltarGrafico(){
  try{ if(typeof ctrlScreen!=='undefined' && ctrlScreen>0) ctrlSetScreen(0); }catch(e){}
}

// ============================================================
// WPP + DEMO
// ============================================================
function startWPP(){stopWPP();
  if(typeof alunosMap!=='undefined')Object.keys(alunosMap).forEach(function(n){
    if(!wppScores[n])wppScores[n]=0;
    if(!alunoStats[n])alunoStats[n]={rpmSum:0,ftpSum:0,wattsSum:0,ticks:0,tempoZona:0};
  });wppInterval=setInterval(function(){var cb=(typeof workout!=='undefined'&&workout&&typeof currentBlockIndex!=='undefined'&&typeof isPlaying!=='undefined'&&isPlaying)?workout[currentBlockIndex]:null;if(!cb)return;var zs=['z1','z2','z3','z4','z5','z6','z7'],tz=cb.intensity||'z1';var isFTP=cb.isFTP||cb.type==='ftp'||false;if(typeof alunosMap!=='undefined')Object.keys(alunosMap).forEach(function(n){var a=alunosMap[n],z=a.zona||'z1',diff=Math.abs(zs.indexOf(z)-zs.indexOf(tz)),pts=isFTP?0:Math.pow(0.5,diff);if(!wppScores[n])wppScores[n]=0;wppScores[n]+=pts/600;
      // Acumula stats
      if(!alunoStats[n])alunoStats[n]={rpmSum:0,ftpSum:0,wattsSum:0,ticks:0,tempoZona:0};
      alunoStats[n].rpmSum   += (a.rpm||0);
      alunoStats[n].ftpSum   += (a.ftp||0);
      alunoStats[n].wattsSum += (a.watts||0);
      alunoStats[n].ticks    += 1;
      var _hrT=_hrDe(a); if(_hrT>0){ alunoStats[n].hrSum=(alunoStats[n].hrSum||0)+_hrT; alunoStats[n].hrTicks=(alunoStats[n].hrTicks||0)+1; } // 26/09d: FC media
      if(diff===0) alunoStats[n].tempoZona += 0.1; // segundos na zona certa
    });
    if(ctrlScreen===1||ctrlScreen===2||ctrlScreen===5) _prSeguro('atualizaCards', atualizaCards);
    if(ctrlScreen===4)                 _prSeguro('atualizaRanking', atualizaRanking);
    _prSeguro('atualizaLiveBar', atualizaLiveBar);
  },100);}
function stopWPP(){if(wppInterval){clearInterval(wppInterval);wppInterval=null;}}
var DALUNOS=[
  {nome:'Carlos Mendes',  genero:'M', ftpBase:220},
  {nome:'Ana Paula',      genero:'F', ftpBase:160},
  {nome:'Ricardo Borges', genero:'M', ftpBase:195},
  {nome:'Marina Silva',   genero:'F', ftpBase:175},
  {nome:'Pedro Henrique', genero:'M', ftpBase:240},
  {nome:'Julia Rocha',    genero:'F', ftpBase:155},
  {nome:'Thiago Ferreira',genero:'M', ftpBase:210},
  {nome:'Fernanda Lima',  genero:'F', ftpBase:168},
  {nome:'Bruno Castro',   genero:'M', ftpBase:185},
  {nome:'Camila Torres',  genero:'F', ftpBase:172},
  {nome:'Rafael Nunes',   genero:'M', ftpBase:228},
  {nome:'Beatriz Alves',  genero:'F', ftpBase:162},
  {nome:'Lucas Pereira',  genero:'M', ftpBase:200},
  {nome:'Isabela Costa',  genero:'F', ftpBase:158},
  {nome:'Diego Santos',   genero:'M', ftpBase:215},
  {nome:'Larissa Dias',   genero:'F', ftpBase:165},
  {nome:'Gustavo Reis',   genero:'M', ftpBase:205},
  {nome:'Patricia Gomes', genero:'F', ftpBase:170},
  {nome:'Felipe Araujo',  genero:'M', ftpBase:232},
  {nome:'Vanessa Melo',   genero:'F', ftpBase:159},
  {nome:'Rodrigo Pinto',  genero:'M', ftpBase:198},
  {nome:'Aline Barbosa',  genero:'F', ftpBase:166},
  {nome:'Marcelo Cunha',  genero:'M', ftpBase:222},
  {nome:'Tatiane Ramos',  genero:'F', ftpBase:157},
  {nome:'Vinicius Lopes', genero:'M', ftpBase:208},
  {nome:'Carolina Freitas',genero:'F', ftpBase:174},
  {nome:'Andre Martins',  genero:'M', ftpBase:190},
  {nome:'Priscila Moura', genero:'F', ftpBase:163},
  {nome:'Eduardo Ramos',  genero:'M', ftpBase:218},
  {nome:'Renata Cardoso', genero:'F', ftpBase:161}
];
var DNOMES=DALUNOS.map(function(a){return a.nome;});
var DZONAS=['z1','z2','z2','z3','z3','z3','z4','z4','z5','z6'];
var demoState={};
// Ha bike real transmitindo agora?
function _haBikeReal(){
  try{
    for(var i=1;i<=parNumBikes;i++){
      var b=parBikeMap[i];
      if(b && b.nome && (Date.now()-(b._lastSeen||0)) < PAR_SINAL_SEM_MS) return true;
    }
  }catch(e){}
  return false;
}

function simularAlunos(){
  if(demoOn)return;
  // O demo grava no MESMO alunosMap dos alunos de verdade — nao ha separacao.
  // Com bike real transmitindo, os numeros inventados se misturam aos medidos e
  // nao ha como distinguir na tela. Entao o demo simplesmente nao entra.
  // Ligar o demo e uma decisao deliberada, feita no menu secreto. Bloquear
  // isso impedia o teste — que e justamente para o que ele serve. Entao ele
  // liga sempre; so avisa quando ha bike real, porque aí os numeros simulados
  // convivem com os medidos na mesma tela.
  if(_haBikeReal()){
    console.warn('[ProRider] ALUNOS DEMO ligado COM bike real transmitindo: '
      + 'os alunos simulados aparecem junto dos reais. Desligue o demo antes de '
      + 'conferir numeros de verdade.');
    try{ if(typeof _parToast==='function') _parToast('Demo ligado — ha bike real na sala tambem'); }catch(e){}
  }
  demoOn=true;
  var limite=settingsNumDemo_val||15;
  DALUNOS.slice(0,limite).forEach(function(al,i){
    var nome=al.nome;
    var zb=DZONAS[i%DZONAS.length];
    var zi=['z1','z2','z3','z4','z5','z6','z7'].indexOf(zb);
    var ftpPct=45+zi*12+Math.floor(Math.random()*15);
    var watts=Math.round(al.ftpBase*(ftpPct/100));
    demoState[nome]={zi:zi,rpm:65+zi*8+Math.floor(Math.random()*10),ftp:ftpPct,watts:watts,dir:1,kcal:0,dist:0,potMax:watts};
    alunosMap[nome]={_demo:true,nome:nome,genero:al.genero,ftpBase:al.ftpBase,rpm:demoState[nome].rpm,watts:watts,bpm:130+zi*8,zona:zb,ftp:ftpPct,kcal:0,dist:0,potMax:watts};
    wppScores[nome]=Math.random()*8+2;
  });
  if(typeof renderAlunos==='function') renderAlunos();
  demoInterval=setInterval(function(){
    var zs=['z1','z2','z3','z4','z5','z6','z7'];
    var dt=1.2; // segundos por tick
    if(_demoFtpMode) _demoFtpTick++;
    var limite=settingsNumDemo_val||15;
    DALUNOS.slice(0,limite).forEach(function(al){
      var nome=al.nome; var s=demoState[nome];
      if(_demoFtpMode){
        // Modo FTP: esforço máximo com curva realista
        // Sobe nos primeiros 30 ticks (~36s), mantém, cai nos últimos 20
        var fase=_demoFtpTick<30?(_demoFtpTick/30):1.0;
        var alvoFtp=88+fase*7+Math.random()*4; // 88-99% do FTP
        s.ftp=Math.min(99,Math.max(80,s.ftp+(alvoFtp-s.ftp)*0.1));
        s.rpm=Math.min(105,Math.max(85,s.rpm+(90-s.rpm)*0.05+Math.random()*2-1));
        s.watts=Math.round(al.ftpBase*(s.ftp/100)+Math.random()*8);
        var zi=5; s.zi=zi; // zona 6 durante o teste
      } else {
      s.rpm+=s.dir*(Math.random()>.5?1:2);
      if(s.rpm>55+s.zi*10+14) s.dir=-1;
      if(s.rpm<55+s.zi*10-6)  s.dir=1;
      s.rpm=Math.max(40,Math.min(130,s.rpm));
      s.ftp+=(Math.random()>.6?1:Math.random()>.3?-1:0);
      s.ftp=Math.max(30,Math.min(135,s.ftp));
      s.watts=Math.round(al.ftpBase*(s.ftp/100)+Math.random()*10);
      } // fim else normal
      if(!_demoFtpMode){
        var zi=s.ftp<60?0:s.ftp<76?1:s.ftp<90?2:s.ftp<105?3:s.ftp<118?4:s.ftp<130?5:6;
        s.zi=zi;
      }
      // Acumular kcal, distância, potência máxima
      s.kcal+=s.watts*dt/3600*3.6; // aproximação
      s.dist+=Math.round(s.rpm)*0.007*dt/60; // km aproximado
      if(s.watts>s.potMax) s.potMax=s.watts;
      if(!alunosMap[nome]) alunosMap[nome]={};
      alunosMap[nome].rpm=Math.round(s.rpm);
      alunosMap[nome].watts=s.watts;
      alunosMap[nome].ftp=Math.round(s.ftp);
      alunosMap[nome].zona=zs[zi];
      alunosMap[nome].bpm=110+zi*12+Math.floor(Math.random()*8);
      alunosMap[nome].kcal=Math.round(s.kcal);
      alunosMap[nome].dist=parseFloat(s.dist.toFixed(2));
      alunosMap[nome].potMax=s.potMax;
      wppScores[nome]+=(zi>=2&&zi<=4)?.08:.03;
      // Envia dados ao servidor para aparecer no mini PC
      if(wsProf&&wsProf.readyState===1){
        wsProf.send(JSON.stringify({
          tipo:'dados_aluno',
          nome:nome,
          genero:al.genero,
          rpm:alunosMap[nome].rpm,
          watts:alunosMap[nome].watts,
          fc:alunosMap[nome].bpm,
          zona:alunosMap[nome].zona,
          ftp:alunosMap[nome].ftp,
          kcal:alunosMap[nome].kcal,
          dist:alunosMap[nome].dist,
          potMax:alunosMap[nome].potMax,
          horario:new Date().toLocaleTimeString('pt-BR')
        }));
      }
    });
    if(ctrlScreen===1||ctrlScreen===2||ctrlScreen===5) atualizaCards();
    if(ctrlScreen===4) atualizaRanking();
    atualizaLiveBar();
  },1200);
}
function pararDemo(){demoOn=false;if(demoInterval){clearInterval(demoInterval);demoInterval=null;}DNOMES.forEach(function(n){delete alunosMap[n];delete wppScores[n];});if(typeof renderAlunos==='function')renderAlunos();}

// ============================================================
// UNIVERSO ANIMADO
// ============================================================
var uC=null,uX=null,uA=null,uP=[],uColor='#295fe8';
// Garante que o canvas do cosmos NUNCA fique preso em container display:none
// (funciona em qualquer ginasio.html: __gymCompatStubs, __gymSafetyStubs, etc.)
function _cosmosFixCanvas(){
  try{
    var c=document.getElementById('universeBg');
    if(!c) return;
    if(c.parentElement && c.parentElement!==document.body) document.body.appendChild(c);
    c.style.position='fixed'; c.style.left='0'; c.style.top='0';
    c.style.width='100%'; c.style.height='100%';
  }catch(e){}
}
function universeInit(){_cosmosFixCanvas();uC=document.getElementById('universeBg');if(!uC)return;uX=uC.getContext('2d');universeResize();universeMakeP();window.addEventListener('resize',universeResize);}
function universeResize(){if(!uC)return;uC.width=uC.offsetWidth||window.innerWidth;uC.height=uC.offsetHeight||window.innerHeight;}
function universeMakeP(){
  var W=uC.width||800,H=uC.height||600;
  uP=[];for(var i=0;i<140;i++)uP.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*3+1,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,a:Math.random()*.7+.3,da:(Math.random()-.5)*.006,c:uColor});
  _bgVLines=[];for(var j=0;j<180;j++)_bgVLines.push({x:Math.random()*W,y:Math.random()*H,l:40+Math.random()*200,v:3+Math.random()*10});
  _bgBolts=[];_bgT=0;
}
function universeSetZone(color){
  uColor=color; bgZC=color;
  // velocidade baseada na zona (z1=lento, z7=rápido)
  var zSpeedMap={z1:.45,z2:.65,z3:.85,z4:1.05,z5:1.3,z6:1.6,z7:2.0};
  // detecta zona pela cor
  var zKey='z4';
  var zColors={'#a1a1a1':'z1','#295fe8':'z2','#5db13d':'z3','#d7c414':'z4','#ea860c':'z5','#d62d2d':'z6','#9b30ff':'z7'};
  if(zColors[color]) zKey=zColors[color];
  bgZoneSpeed=zSpeedMap[zKey]||1.0;
  uP.forEach(function(p,i){if(i%3===0)p.c=color;});
  // Atualiza partículas PRParticles com o número da zona
  var zNum={z1:1,z2:2,z3:3,z4:4,z5:5,z6:6,z7:7};
  if(typeof PRParticles!=='undefined') PRParticles.setZone(zNum[zKey]||4);
}
function _universeRun(){
  _cosmosFixCanvas();
  if(!uC) universeInit();
  if(!uC) return;
  uC.style.display='block';
  universeResize();
  if(!uP||!uP.length) universeMakeP();
  if(uA) return;
  universeDraw();
}
function universeStart(){
  if(bgActiveMode==='none'||bgActiveMode==='camera'||bgActiveMode==='video'){universeStop();return;}
  _universeRun();
}
// Fundo de emergência: roda o universo IGNORANDO o modo (usado quando o vídeo falha, pra não ficar tela preta)
function universeStartForce(){ try{ _universeRun(); }catch(e){} }
function universeStop(){
  if(uA){cancelAnimationFrame(uA);uA=null;}
  if(uC) uC.style.display='none';
}
function universeDraw(){
  if(!uX||!uC)return;
  var W=uC.width,H=uC.height;
  switch(bgActiveMode){
    case 'nebula':   _bgDrawNebula(uX,W,H);   break;
    case 'fire':     _bgDrawFire(uX,W,H);     break;
    case 'cosmos':   _bgDrawCosmos(uX,W,H);   break;
    default:         _bgDrawCosmos(uX,W,H);   break;
  }
  uA=requestAnimationFrame(universeDraw);
}

// ============================================================
// GAMEPAD + TECLADO
// ============================================================
var gpState={},gpTimer=null,_gpBlockUntil=0;
function startGamepad(){
  if(gpTimer)return;
  gpTimer=setInterval(function(){
   try{
    var gps=navigator.getGamepads?navigator.getGamepads():[];
    for(var i=0;i<gps.length;i++){
      var gp=gps[i];if(!gp)continue;
      var id=gp.index;if(!gpState[id])gpState[id]={p:[]};
      var prev=gpState[id].p,now=[];
      for(var b=0;b<gp.buttons.length;b++)now[b]=gp.buttons[b].value>0.5;
      // gpDebug removido — era debug de desenvolvimento
      function edge(b){return now[b]&&!prev[b];}
      var axH=gp.axes[0]||0,axV=gp.axes[1]||0;
      var dU=now[12]||(axV<-.5),dD=now[13]||(axV>.5),dL=now[14]||(axH<-.5),dR=now[15]||(axH>.5);
      // 03/10n: so conta como "alguem mexeu" se apertou botao ou mexeu o direcional.
      // Antes isto rodava em todo quadro com o controle ligado e a TV nunca voltava para a tela de espera.
      if(now.some(Boolean)||Math.abs(axH)>.5||Math.abs(axV)>.5) resetIdleTimer();
      // Bloquear input por 600ms após mudanças de estado (evita double-fire)
      if(Date.now()<_gpBlockUntil){gpState[id].p=now;continue;}
      if(idleOn){if(edge(0)||edge(1)||edge(2)||edge(3)||edge(9)||(dU&&!gpState[id]._dUI)||(dD&&!gpState[id]._dDI)){_gpBlockUntil=Date.now()+600;sairIdle();}gpState[id]._dUI=dU;gpState[id]._dDI=dD;gpState[id].p=now;continue;}
      // Telas de MINHAS AULAS (origem e pareamento) tem o proprio tratamento.
      if(typeof window._nuvemGp==='function'){
        var _st=gpState[id];
        var _eL=dL&&!_st._nvL, _eR=dR&&!_st._nvR, _eU=dU&&!_st._nvU, _eD=dD&&!_st._nvD;
        _st._nvL=dL; _st._nvR=dR; _st._nvU=dU; _st._nvD=dD;
        try{ window._nuvemGp({a:edge(0)||edge(9), b:edge(1)||edge(8), left:_eL, right:_eR, up:_eU, down:_eD}); }catch(_e){}
        gpState[id].p=now; continue;
      }
      // 26/09d: MODO ESPACO — LB+RB segurados 1 s, na aula
      if(boxMode==='live'||boxMode==='livre'||boxMode==='sessao'){
        var _lb=gp.buttons[4]&&gp.buttons[4].pressed, _rb=gp.buttons[5]&&gp.buttons[5].pressed;
        var _segurando=_espacoHold(_lb,_rb);   // 26/09d (final): LB + RB segurados 5 s
        if(_segurando || _espaco.on){ gpState[id]._rbComLb=true; if(_rb&&!gpState[id]._rbIni) gpState[id]._rbIni=Date.now(); } // RB junto com LB nao abre o QR
        if(_espaco.on){ if(edge(1)) espacoDesligar(); if(edge(8)) handleSelect(); gpState[id].p=now; continue; }  // tela escura: B, SELECT ou LB+RB
        if(_segurando){ gpState[id].p=now; continue; }                                 // nao dispara LB/RB sozinhos
      }
      if(boxMode==='escolha'){
        // L1+R1 segurados 2s → configurações
        var btn4=gp.buttons[4]&&gp.buttons[4].pressed;
        var btn5=gp.buttons[5]&&gp.buttons[5].pressed;
        _secretCheckHold(btn4, btn5);   // L1+R1 arma o modo secreto (CONFIG pisca)

        // Modal genérico bgAviso (ex: PENDRIVE NÃO LIGADO) — A=confirmar, B=fechar
        var bgAv=document.getElementById('bgAviso');
        if(bgAv){
          if(edge(0)||edge(9)){var bc=document.getElementById('bgAvisoBtnConectar');if(bc)bc.click();}
          if(edge(1)){bgAv.remove();}
          gpState[id].p=now;continue;
        }

        // Se menu de opções da bike aberto → navegar nele (tem prioridade)
        var bikeOpEl2=document.getElementById('bikeOpMenu');
        if(bikeOpEl2&&bikeOpEl2.style.display==='flex'){
          if(dU&&!gpState[id]._dUbo){_bikeOpNavegar(-1);}
          if(dD&&!gpState[id]._dDbo){_bikeOpNavegar(1);}
          gpState[id]._dUbo=dU; gpState[id]._dDbo=dD;
          if(edge(9)||edge(0)){_bikeOpConfirmar();}
          if(edge(1)||edge(2)) parFecharOpMenu();
          gpState[id].p=now;continue;
        }

        // Se lista BLED112 aberta → navegar com D-pad, A=confirmar, B=cancelar
        var bledList=document.getElementById('bled112DevList');
        if(bledList){
          if(dU&&!gpState[id]._dUp){
            _bled112ListFoco=Math.max(0,_bled112ListFoco-1);
            _bled112ListFocar();
          }
          if(dD&&!gpState[id]._dDp){
            _bled112ListFoco=Math.min(_bled112ListKeys.length-1,_bled112ListFoco+1);
            _bled112ListFocar();
          }
          gpState[id]._dUp=dU;gpState[id]._dDp=dD;
          if(edge(0)||edge(9)){ // A ou START = confirmar
            if(_bled112ListKeys.length>0)
              _parSelecionarBLED112(_bled112ListNum,_bled112ListKeys[_bled112ListFoco]);
          }
          if(edge(1)){ _parCancelarBLED112(); } // B = cancelar
          gpState[id].p=now;continue;
        }

        // Se pareamento aberto → navegar no grid de bikes
        var parEl2=document.getElementById('pareamentoScreen');
        if(parEl2&&parEl2.style.display==='flex'){
          if(dL&&!gpState[id]._dLp) parNavegar(-1,0);
          if(dR&&!gpState[id]._dRp) parNavegar(1,0);
          if(dU&&!gpState[id]._dUp) parNavegar(0,-1);
          if(dD&&!gpState[id]._dDp) parNavegar(0,1);
          gpState[id]._dLp=dL;gpState[id]._dRp=dR;
          gpState[id]._dUp=dU;gpState[id]._dDp=dD;
          if(edge(9)||edge(0)){
            if(parBikeMap[parBikeFoco]) _parAbrirOpMenu(parBikeFoco);
            else _parScanBike(parBikeFoco);
          }
          if(edge(4)){parSetTipo('bt');}  // L1 = BT
          if(edge(5)){parSetTipo('ant');}  // R1 = ANT+
          if(edge(6)){parAjustarNumBikes(-1);}  // L2 = menos bikes
          if(edge(7)){parAjustarNumBikes(1);}   // R2 = mais bikes
          if(edge(1)) fecharPareamento();
          gpState[id].p=now;continue;
        }

        // Se configurações abertas → navegar dentro delas
        var settEl2=document.getElementById('settingsScreen');
        if(settEl2&&settEl2.style.display==='flex'){
          if(dU&&!gpState[id]._dUs){settingsNavegar(-1);}
          if(dD&&!gpState[id]._dDs){settingsNavegar(1);}
          if(dL&&!gpState[id]._dLs){settingsAcaoLateral(-1);}
          if(dR&&!gpState[id]._dRs){settingsAcaoLateral(1);}
          gpState[id]._dUs=dU;gpState[id]._dDs=dD;
          gpState[id]._dLs=dL;gpState[id]._dRs=dR;
          if(edge(9)||edge(0)){settingsConfirmar();}
          if(edge(1)){fecharSettings();}
          gpState[id].p=now;continue;
        }

        // MENU SECRETO aberto -> Cima/Baixo entre cards; no Demo Esq/Dir=-/+; A/START confirma; B fecha
        var msEl2=document.getElementById('menuSecretoScreen');
        if(msEl2&&msEl2.style.display==='flex'){
          if(dU&&!gpState[id]._dUms){_msFoco=Math.max(0,_msFoco-1);_msFocar();}
          if(dD&&!gpState[id]._dDms){_msFoco=Math.min(1,_msFoco+1);_msFocar();}
          gpState[id]._dUms=dU;gpState[id]._dDms=dD;
          if(_msFoco===1){
            if(dL&&!gpState[id]._dLms){settingsNumDemo(-5);_msRender();}
            if(dR&&!gpState[id]._dRms){settingsNumDemo(5);_msRender();}
          }
          gpState[id]._dLms=dL;gpState[id]._dRms=dR;
          if(edge(9)||edge(0)){ if(_msFoco===0)abrirPareamento(); else _msToggleDemo(); }
          if(edge(1)){fecharMenuSecreto();}
          gpState[id].p=now;continue;
        }
        if(_secretArmed){ if(edge(9)){_gpBlockUntil=Date.now()+800;_secretAbrir();gpState[id].p=now;continue;} }
        if(dU&&!gpState[id]._dU){escolhaIdx=Math.max(0,escolhaIdx-1);escolhaFocus();_escolhaReady=true;}
        if(dD&&!gpState[id]._dD){escolhaIdx=Math.min(_escMax(),escolhaIdx+1);escolhaFocus();_escolhaReady=true;}
        gpState[id]._dU=dU;gpState[id]._dD=dD;
        if(edge(9)&&_escolhaReady){_gpBlockUntil=Date.now()+800;escolhaConfirmar();}
        gpState[id].p=now;continue;
      }
      // Sub-lista vídeo/música aberta
      if(document.getElementById('bgSubLista')){
        var files2=_bgSubListaTipo==='video'?_bgVideoFiles:_bgMusicFiles;
        if(dU&&!gpState[id]._dUsl){_bgSubListaIdx=Math.max(0,_bgSubListaIdx-1);_bgSubListaFocar();}
        if(dD&&!gpState[id]._dDsl){_bgSubListaIdx=Math.min(files2.length-1,_bgSubListaIdx+1);_bgSubListaFocar();}
        gpState[id]._dUsl=dU;gpState[id]._dDsl=dD;
        if(edge(0)||edge(9)){_bgSubListaSelecionar(_bgSubListaIdx);}
        if(edge(1)){var sl=document.getElementById('bgSubLista');if(sl)sl.remove();}
        gpState[id].p=now;continue;
      }
      if(boxMode==='bgPicker'){
        if(dL&&!gpState[id]._dLbg){_bgMover('left');}
        if(dR&&!gpState[id]._dRbg){_bgMover('right');}
        gpState[id]._dLbg=dL;gpState[id]._dRbg=dR;
        if(dU&&!gpState[id]._dUbg){_bgMover('up');}
        if(dD&&!gpState[id]._dDbg){_bgMover('down');}
        gpState[id]._dUbg=dU;gpState[id]._dDbg=dD;
        if(edge(9)||edge(0)){_bgStart();}   // START (tecla única): escolhe/confirma/avança
        if(edge(1)||edge(8)){_bgVoltar();}   // B ou SELECT: voltar para as aulas
        gpState[id].p=now;continue;
      }
      if(boxMode==='picker'){
        if(edge(9)||edge(0)){var btn=document.getElementById('btnPicker');if(btn)btn.click();}
        if(edge(1)){var bd=document.getElementById('pickerBD');if(bd){bd.remove();mostrarEscolha();}}
        gpState[id].p=now;continue;
      }
      if(boxMode==='usb'){
        if(!_sistEmCateg){
          // Ecrã de categorias do Sistema
          // 30/09e: categorias em grade de 3 colunas — ←→ anda 1, ↑↓ anda uma linha
          if(dU&&!gpState[id]._dU){_sistCatMover(0,-1);}
          if(dD&&!gpState[id]._dD){_sistCatMover(0,1);}
          if(dL&&!gpState[id]._dLc){_sistCatMover(-1,0);}
          if(dR&&!gpState[id]._dRc){_sistCatMover(1,0);}
          gpState[id]._dU=dU;gpState[id]._dD=dD;gpState[id]._dLc=dL;gpState[id]._dRc=dR;
          if(edge(9)||edge(0)){_abrirSistCat(_sistCats[_sistCatIdx]);}
          if(edge(1)||edge(8))mostrarEscolha();
        } else {
          // Lista de aulas dentro da categoria (ou pendrive)
          if(dU&&!gpState[id]._dU){usbIdx=Math.max(0,usbIdx-1);_renderAulasList();}
          if(dD&&!gpState[id]._dD){usbIdx=Math.min(Math.max(0,usbList.length-1),usbIdx+1);_renderAulasList();}
          gpState[id]._dU=dU;gpState[id]._dD=dD;
          if(edge(9)||edge(0)){if(usbList.length>0)abrirAula();else _usbVoltar();}
          if(edge(1)||edge(8)){_usbVoltar();}
        }
        gpState[id].p=now;continue;
      }
      if(boxMode==='preAula'){
        // 07/10d: LB+RB 2 s abre o diagnóstico da sala; aberto, só o B fecha
        var _dh=_diagHold(gp.buttons[4]&&gp.buttons[4].pressed, gp.buttons[5]&&gp.buttons[5].pressed);
        if(_diag.on){ if(edge(1)) diagFechar(); gpState[id].p=now; continue; }
        if(_dh){ gpState[id].p=now; continue; }
        if(edge(9))iniciarAula();if(edge(1)||edge(8))fecharPreAula();
        gpState[id].p=now;continue;
      }
      var mVg=document.getElementById('modalVoltar');
      if(mVg&&mVg.classList.contains('active')){
        if((dL&&!gpState[id]._dLv)||edge(1)){modalVoltarFoco=0;focusModalVoltar();}
        if(dR&&!gpState[id]._dRv){modalVoltarFoco=1;focusModalVoltar();}
        gpState[id]._dLv=dL;gpState[id]._dRv=dR;
        if(edge(9))modalVoltarFoco===1?confirmarVoltar():fecharModalVoltar();
        gpState[id].p=now;continue;
      }
      // Resultados do FTP visíveis → SELECT fecha (era START).
      // Sequencia combinada: SELECT encerra o teste, SELECT fecha os resultados,
      // SELECT de novo pergunta se quer encerrar a AULA.
      if(document.getElementById('ftpResultadosFinais')){
        if(edge(8)){ handleSelect(); }
        gpState[id].p=now; continue;
      }

      // SELECT(8) + START(9) segurado 2s → configurações (funciona na tela idle também)
      var selOn=gp.buttons[8]&&gp.buttons[8].pressed;
      var staOn=gp.buttons[9]&&gp.buttons[9].pressed;
      _settingsCheckHold(selOn, staOn);
      // Se só SELECT+START juntos → não sair do idle, aguardar combo
      if(selOn&&staOn){ gpState[id].p=now; continue; }

      // Modal opções bike aberto
      var bikeOpEl=document.getElementById('bikeOpMenu');
      if(bikeOpEl&&bikeOpEl.style.display==='flex'){
        if(dU&&!gpState[id]._dUbo){_bikeOpNavegar(-1);}
        if(dD&&!gpState[id]._dDbo){_bikeOpNavegar(1);}
        gpState[id]._dUbo=dU; gpState[id]._dDbo=dD;
        if(edge(9)||edge(0)){_bikeOpConfirmar();}
        if(edge(1)||edge(2)) parFecharOpMenu(); // B ou X fecha
        gpState[id].p=now;continue;
      }
      // Lista BLED112 aberta → navegar com D-pad
      var bledList2=document.getElementById('bled112DevList');
      if(bledList2){
        if(dU&&!gpState[id]._dUp){_bled112ListFoco=Math.max(0,_bled112ListFoco-1);_bled112ListFocar();}
        if(dD&&!gpState[id]._dDp){_bled112ListFoco=Math.min(_bled112ListKeys.length-1,_bled112ListFoco+1);_bled112ListFocar();}
        gpState[id]._dUp=dU;gpState[id]._dDp=dD;
        if(edge(0)||edge(9)){if(_bled112ListKeys.length>0)_parSelecionarBLED112(_bled112ListNum,_bled112ListKeys[_bled112ListFoco]);}
        if(edge(1)){_parCancelarBLED112();}
        gpState[id].p=now;continue;
      }
      // Pareamento aberto → navegar no grid
      var parEl=document.getElementById('pareamentoScreen');
      if(parEl&&parEl.style.display==='flex'){
        if(dL&&!gpState[id]._dLp) parNavegar(-1,0);
        if(dR&&!gpState[id]._dRp) parNavegar(1,0);
        if(dU&&!gpState[id]._dUp) parNavegar(0,-1);
        if(dD&&!gpState[id]._dDp) parNavegar(0,1);
        gpState[id]._dLp=dL;gpState[id]._dRp=dR;gpState[id]._dUp=dU;gpState[id]._dDp=dD;
        if(edge(0)||edge(9)) parSelecionarBike(parBikeFoco);
        if(edge(3)) parLimparFoco();        // Y = limpar posição
        if(edge(4)) parSetTipo('bt');       // L1 = Bluetooth
        if(edge(5)) parSetTipo('ant');      // R1 = ANT+
        if(edge(6)){parAjustarNumBikes(-1);}  // L2 = menos bikes
        if(edge(7)){parAjustarNumBikes(1);}   // R2 = mais bikes
        if(edge(1)) fecharPareamento();
        gpState[id].p=now;continue;
      }
      // Configurações abertas → navegar nas opções
      var settEl=document.getElementById('settingsScreen');
      if(settEl&&settEl.style.display==='flex'){
        gpState[id].p=now; continue;
      }

      if(qbAberta){
        if(dL&&!gpState[id]._dLqb){
          if(_desafioAberto) _desafioSubNavLeft();
          else if(qbFtpAberta) qbFtpNavegar(-1);
          else qbSetFocus(qbFocusIdx-1);
        }
        if(dR&&!gpState[id]._dRqb){
          if(_desafioAberto) _desafioSubNavRight();
          else if(qbFtpAberta) qbFtpNavegar(1);
          else qbSetFocus(qbFocusIdx+1);
        }
        if(dU&&!gpState[id]._dUqb){ if(_desafioAberto) _desafioSubNavUp(); }
        if(dD&&!gpState[id]._dDqb){ if(_desafioAberto) _desafioSubNavDown(); }
        gpState[id]._dLqb=dL;gpState[id]._dRqb=dR;
        gpState[id]._dUqb=dU;gpState[id]._dDqb=dD;
        if(edge(9)){qbConfirmar();}
        if(edge(1)){
          if(_desafioAberto) qbDesafioAbrir();
          else if(qbFtpAberta) qbFTP();
          else fecharQB();
        }
        gpState[id].p=now;continue;
      }
      // Resultado final desafio → START fecha
      if(document.getElementById('desafioResultadoFinal')){
        if(edge(9)) desafioFecharResultado();
        if(edge(8)) handleSelect();               // 30/09a: SELECT fecha e volta ao grafico
        gpState[id].p=now; continue;
      }
      // Modal encerrar desafio
      var mD=document.getElementById('modalEncerrarDesafio');
      if(mD&&mD.classList.contains('active')){
        if((dL&&!gpState[id]._dLd)||edge(1)){_desafioEncModalFoco=0;_desafioFocusModal();}
        if(dR&&!gpState[id]._dRd){_desafioEncModalFoco=1;_desafioFocusModal();}
        gpState[id]._dLd=dL;gpState[id]._dRd=dR;
        if(edge(9))_desafioEncModalFoco===1?desafioModalSim():desafioModalNao();
        if(edge(1))desafioModalNao();
        gpState[id].p=now;continue;
      }
      var mF=document.getElementById('modalEncerrarFTP');
      if(mF&&mF.classList.contains('active')){
        if((dL&&!gpState[id]._dLf)||edge(1)){ftpModalFoco=0;focusModalFTP();}
        if(dR&&!gpState[id]._dRf){ftpModalFoco=1;focusModalFTP();}
        gpState[id]._dLf=dL;gpState[id]._dRf=dR;
        if(edge(9)||edge(0)||edge(8))ftpModalFoco===1?ftpModalSim():ftpModalNao();  // START/A/SELECT confirmam
        gpState[id].p=now;continue;
      }
      // endRanking → qualquer botão vai para home
      if(boxMode==='endRanking'){
        if(Date.now()>=_endUnlockedAt&&(edge(9)||edge(0)||edge(1)||edge(8))){resetCompleto();}
        gpState[id].p=now;continue;
      }
      // endScreen — ← → navegar, START/A confirmar, B ir para início
      var esGP=document.getElementById('endScreen');
      if(boxMode==='end'||(esGP&&esGP.classList.contains('show'))){
        var _esOk=Date.now()>=_endUnlockedAt;
        if(_esOk&&dL&&!gpState[id]._dESL){_endNavegar(-1);}
        if(_esOk&&dR&&!gpState[id]._dESR){_endNavegar(1);}
        gpState[id]._dESL=dL;gpState[id]._dESR=dR;
        if(_esOk&&(edge(9)||edge(0))) _endConfirmar();
        if(_esOk&&edge(1)) endAcaoVoltar();
        gpState[id].p=now;continue;
      }
      var mE=document.getElementById('modalEncerrar');
      if(mE&&mE.classList.contains('active')){
        if(edge(1)){ctrlConfirmNo();gpState[id].p=now;continue;}  // B fecha imediatamente
        if(dL&&!gpState[id]._dL){modalEncFoco=0;focusModalEnc();}
        if(dR&&!gpState[id]._dR){modalEncFoco=1;focusModalEnc();}
        gpState[id]._dL=dL;gpState[id]._dR=dR;
        if(edge(0)||edge(9))modalEncFoco===1?ctrlConfirmYes():ctrlConfirmNo();
        gpState[id].p=now;continue;
      }
      if((boxMode==='live'||boxMode==='livre'||boxMode==='sessao')&&APP_MODE==='gym'){
        // Quick Bar aberta: D-pad navega, A/START confirma, B fecha
        if(qbAberta){
          if(qbFtpAberta){
            // Sub-painel FTP: ←→ mudam duração (3/5/10/20 min)
            if(dL&&!gpState[id]._dLqb){qbFtpNavegar(-1);}
            if(dR&&!gpState[id]._dRqb){qbFtpNavegar(1);}
            if(edge(0)||edge(9)){qbConfirmar();}
            if(edge(1)){qbFTP();} // B fecha sub-painel FTP
          } else if(_desafioAberto){
            // Sub-painel Desafio: ↑↓ mudam linha, ←→ mudam opção
            if(dU&&!gpState[id]._dUqb){_desafioSubNavUp();}
            if(dD&&!gpState[id]._dDqb){_desafioSubNavDown();}
            if(dL&&!gpState[id]._dLqb){_desafioSubNavLeft();}
            if(dR&&!gpState[id]._dRqb){_desafioSubNavRight();}
            if(edge(0)||edge(9)){_desafioSubConfirmar();}
            if(edge(1)){qbDesafioAbrir();} // B fecha desafio
          } else {
            // QB principal: ←→ navegam botões
            if(dL&&!gpState[id]._dLqb){qbSetFocus(qbFocusIdx-1);}
            if(dR&&!gpState[id]._dRqb){qbSetFocus(qbFocusIdx+1);}
            if(edge(0)||edge(9)){qbConfirmar();}
            if(edge(1)){fecharQB();} // B fecha QB
          }
          gpState[id]._dUqb=dU;gpState[id]._dDqb=dD;gpState[id]._dLqb=dL;gpState[id]._dRqb=dR;
          gpState[id].p=now;continue;
        }
        // Durante o TESTE DE FTP: os botões de troca de tela NÃO navegam.
        // SELECT é quem pergunta se quer encerrar o teste — mesma lógica do
        // encerrar aula e do desafio. Antes era o START; os demais botões
        // também perguntavam, o que atrapalhava. Agora ficam inertes.
        if(document.getElementById('profFtpBar')){
          if(edge(8)){ try{ handleSelect(); }catch(e){} }   // 30/09a: SELECT para o teste na hora
          gpState[id].p=now; continue;
        }
        // 26/09d — MAPA FINAL (Mario): RB = QR Code · Y = frequencia cardiaca ·
        // RT = esconde as caixas (grafico cresce) · LB+RB segurados 5 s = modo espaco.
        // O RB abre o QR ao SOLTAR, e so se foi um toque curto sem o LB junto —
        // assim segurar LB+RB para o espaco nunca abre o QR sem querer.
        var _rbNow=gp.buttons[5]&&gp.buttons[5].pressed, _lbNow=gp.buttons[4]&&gp.buttons[4].pressed, _st=gpState[id];
        if(_rbNow && !_st._rbIni){ _st._rbIni=Date.now(); _st._rbComLb=false; }
        if(_rbNow && _lbNow) _st._rbComLb=true;
        if(!_rbNow && _st._rbIni){ var _curto=(Date.now()-_st._rbIni)<700 && !_st._rbComLb; _st._rbIni=0;
          if(_curto){ ctrlSetScreen(3); gpState[id].p=now; continue; } }                   // RB (toque) = QR Code
        if(edge(7)){ _prTopoToggle(); gpState[id].p=now; continue; }                     // RT = topo limpo
        if(edge(2))ctrlSetScreen(1);if(edge(0))ctrlSetScreen(2);
        if(edge(1))ctrlSetScreen(4);if(edge(3))ctrlSetScreen(5);
        if(edge(8))handleSelect();if(edge(9))handleStart();
      }
      if(boxMode==='live'&&APP_MODE==='builder'){
        if(edge(8))handleSelect();if(edge(9))handleStart();
      }
      gpState[id].p=now;
    }
   }catch(_e){
     // Um erro aqui dentro matava o tick em silencio e o controle parava de
     // responder por inteiro — sem nada no Console. Agora avisa uma vez e segue.
     if(!startGamepad._erroLogado){ startGamepad._erroLogado=1;
       try{ console.error('[ProRider] erro no laço do controle:',_e); }catch(_){} }
   }
  },50);
}

// ── WATCHDOG DO CONTROLE ────────────────────────────────────────
// Independente de gamepadconnected e de DOMContentLoaded: se houver controle
// e a leitura nao estiver rodando, religa. Cobre o caso do controle ja estar
// ligado antes da pagina abrir e o de o laço ter morrido.
(function(){
  var avisou=false;
  setInterval(function(){
    try{
      var gps=navigator.getGamepads?navigator.getGamepads():[];
      var achou=null;
      for(var i=0;i<gps.length;i++){ if(gps[i]){ achou=gps[i]; break; } }
      if(achou && !gpTimer){
        console.log('[ProRider] controle detectado ('+achou.id+') — iniciando leitura.');
        startGamepad();
      }
      if(achou && !avisou){ avisou=true; console.log('[ProRider] controle ativo: '+achou.id+' · '+achou.buttons.length+' botoes'); }
      // window._GP_DEBUG = true  ->  mostra o indice de cada botao apertado
      if(window._GP_DEBUG && achou){
        for(var b=0;b<achou.buttons.length;b++){
          if(achou.buttons[b].value>0.5 && !(_gpDbgPrev[b])) console.log('[GP] botao '+b);
          _gpDbgPrev[b]=achou.buttons[b].value>0.5;
        }
      }
    }catch(e){}
  }, 1200);
})();
var _gpDbgPrev=[];
window.addEventListener('gamepadconnected',function(e){console.log('[ProRider] Controle:',e.gamepad.id);startGamepad();});
// Fallback: se o controle já estava conectado antes da página carregar, gamepadconnected pode não disparar
document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){var gps=navigator.getGamepads?navigator.getGamepads():[];for(var i=0;i<gps.length;i++){if(gps[i]){console.log('[ProRider] Controle detectado no arranque:',gps[i].id);startGamepad();break;}}},500);});
window.addEventListener('gamepaddisconnected',function(){if(gpTimer){clearInterval(gpTimer);gpTimer=null;}});
function gpDebug(idx,gpId){var el=document.getElementById('ctrlDebug');if(!el)return;el.innerHTML='<div style="font-size:13px;opacity:.5;margin-bottom:4px;">BOTAO</div><div style="font-size:60px;line-height:1;">Indice: <strong>'+idx+'</strong></div><div style="font-size:11px;opacity:.4;margin-top:4px;">'+(gpId||'').substring(0,40)+'</div>';el.style.display='block';clearTimeout(el._t);el._t=setTimeout(function(){el.style.display='none';},2500);}
window.addEventListener('keydown',function(e){
  if(e.repeat)return;
  if(Date.now()<_gpBlockUntil)return;
  resetIdleTimer();var k=e.key;
  if(document.getElementById('ftpResultadosFinais')){
    if(k==='Enter'||k===' '||k==='Escape') fecharResultadosFinalFTP();
    e.preventDefault(); return;
  }
  var settEl=document.getElementById('settingsScreen');
  if(settEl&&settEl.style.display==='flex'){
    if(k==='Escape'||k==='b'||k==='B') fecharSettings();
    return;
  }
  if(idleOn){_gpBlockUntil=Date.now()+800;sairIdle();return;}
  if(boxMode==='escolha'){
    // Pareamento aberto → navegar
    var parElK=document.getElementById('pareamentoScreen');
    if(parElK&&parElK.style.display==='flex'){
      if(k==='ArrowLeft'){parNavegar(-1,0);e.preventDefault();return;}
      if(k==='ArrowRight'){parNavegar(1,0);e.preventDefault();return;}
      if(k==='ArrowUp'){parNavegar(0,-1);e.preventDefault();return;}
      if(k==='ArrowDown'){parNavegar(0,1);e.preventDefault();return;}
      if(k==='Enter'||k===' '){
        if(parBikeMap[parBikeFoco]) _parAbrirOpMenu(parBikeFoco);
        else _parScanBike(parBikeFoco);
        e.preventDefault();return;
      }
      if(k==='b'||k==='B'||k==='Escape'){fecharPareamento();return;}
      if(k==='y'||k==='Y'){parLimparFoco();return;}
      if(k==='1') parSetTipo('bt');
      if(k==='2') parSetTipo('ant');
      return;
    }
    var msElK=document.getElementById('menuSecretoScreen');
    if(msElK&&msElK.style.display==='flex'){
      if(k==='ArrowUp'){_msFoco=Math.max(0,_msFoco-1);_msFocar();e.preventDefault();return;}
      if(k==='ArrowDown'){_msFoco=Math.min(1,_msFoco+1);_msFocar();e.preventDefault();return;}
      if(_msFoco===1&&k==='ArrowLeft'){settingsNumDemo(-5);_msRender();e.preventDefault();return;}
      if(_msFoco===1&&k==='ArrowRight'){settingsNumDemo(5);_msRender();e.preventDefault();return;}
      if(k==='Enter'||k===' '){ if(_msFoco===0)abrirPareamento(); else _msToggleDemo(); e.preventDefault();return; }
      if(k==='b'||k==='B'||k==='Escape'){fecharMenuSecreto();return;}
      return;
    }
    if(k==='ArrowUp'){escolhaIdx=Math.max(0,escolhaIdx-1);escolhaFocus();_escolhaReady=true;return;}
    if(k==='ArrowDown'){escolhaIdx=Math.min(_escMax(),escolhaIdx+1);escolhaFocus();_escolhaReady=true;return;}
    if(k==='F9'){ _secretArmed?_secretDisarm():_secretArm(); e.preventDefault(); return; }
    if((k==='Enter'||k===' ')&&_secretArmed){ _secretAbrir(); e.preventDefault(); return; }
    if(k==='Enter'||k===' '){if(_escolhaReady){_gpBlockUntil=Date.now()+800;escolhaConfirmar();}e.preventDefault();return;}
    if(k==='s'||k==='S'){abrirSettings();return;}
    return;
  }
  if(boxMode==='bgPicker'){
    if(k==='ArrowLeft'){_bgMover('left');return;}
    if(k==='ArrowRight'){_bgMover('right');return;}
    if(k==='ArrowUp'){_bgMover('up');return;}
    if(k==='ArrowDown'){_bgMover('down');return;}
    if(k==='Enter'||k===' '||k==='a'||k==='A'){_bgStart();e.preventDefault();return;}
    if(k==='b'||k==='B'){_bgVoltar();return;}
    if(k==='Escape'){ _bgVoltar(); return; }
    return;
  }
  if(boxMode==='picker'){
    if(k==='Enter'||k===' '){var btn=document.getElementById('btnPicker');if(btn)btn.click();e.preventDefault();return;}
    if(k==='Escape'||k==='b'||k==='B'){var bd=document.getElementById('pickerBD');if(bd){bd.remove();mostrarEscolha();}return;}
    return;
  }
  if(boxMode==='usb'){
    if(!_sistEmCateg){
      // Ecrã de categorias do Sistema
      if(k==='ArrowUp'){_sistCatMover(0,-1);return;}
      if(k==='ArrowDown'){_sistCatMover(0,1);return;}
      if(k==='ArrowLeft'){_sistCatMover(-1,0);return;}
      if(k==='ArrowRight'){_sistCatMover(1,0);return;}
      if(k==='Enter'||k===' '){_abrirSistCat(_sistCats[_sistCatIdx]);e.preventDefault();return;}
      if(k==='Escape'||k==='b'||k==='B'){mostrarEscolha();return;}
    } else {
      // Lista de aulas dentro da categoria (ou pendrive)
      if(k==='ArrowUp'){usbIdx=Math.max(0,usbIdx-1);_renderAulasList();return;}
      if(k==='ArrowDown'){usbIdx=Math.min(Math.max(0,usbList.length-1),usbIdx+1);_renderAulasList();return;}
      if(k==='Enter'||k===' '){if(usbList.length>0)abrirAula();else _usbVoltar();e.preventDefault();return;}
      if(k==='Escape'||k==='b'||k==='B'){_usbVoltar();return;}
    }
    return;
  }
  if(boxMode==='preAula'){
    if(_diag.on){ if(k==='Escape'||k==='b'||k==='B') diagFechar(); return; }   // 07/10d
    if((k==='d'||k==='D')&&e.ctrlKey&&e.shiftKey){ diagAbrir(); e.preventDefault(); return; }
    if(k==='Enter'||k===' '){iniciarAula();e.preventDefault();return;}
    if(k==='Escape'||k==='b'||k==='B'){fecharPreAula();return;}
    return;
  }
  // endRanking — qualquer tecla vai para home
  if(boxMode==='endRanking'){if(Date.now()>=_endUnlockedAt){resetCompleto();}return;}
  // endScreen — ← → navegar, Enter confirmar, Escape ir para início
  var esKB=document.getElementById('endScreen');
  if(boxMode==='end'||(esKB&&esKB.classList.contains('show'))){
    if(k==='ArrowLeft'){_endNavegar(-1);return;}
    if(k==='ArrowRight'){_endNavegar(1);return;}
    if(k==='Enter'||k===' '){_endConfirmar();e.preventDefault();return;}
    if(k==='Escape'||k==='b'||k==='B'){endAcaoVoltar();return;}
    return;
  }
  var mV2=document.getElementById('modalVoltar');
  if(mV2&&mV2.classList.contains('active')){
    if(k==='ArrowLeft'||k==='ArrowRight'){modalVoltarFoco=k==='ArrowLeft'?0:1;focusModalVoltar();return;}
    if(k==='Enter'||k===' '||k==='e'||k==='E'){modalVoltarFoco===1?confirmarVoltar():fecharModalVoltar();e.preventDefault();return;}
    if(k==='Escape'){fecharModalVoltar();return;}
    return;
  }
  var mF=document.getElementById('modalEncerrarFTP');
  if(mF&&mF.classList.contains('active')){
    if(k==='ArrowLeft'||k==='ArrowRight'){ftpModalFoco=k==='ArrowLeft'?0:1;focusModalFTP();return;}
    if(k==='Enter'||k===' '){ftpModalFoco===1?ftpModalSim():ftpModalNao();e.preventDefault();return;}
    if(k==='Escape'){ftpModalNao();return;}
    return;
  }
  var mE=document.getElementById('modalEncerrar');
  if(mE&&mE.classList.contains('active')){
    if(k==='ArrowLeft'||k==='ArrowRight'){modalEncFoco=k==='ArrowLeft'?0:1;focusModalEnc();return;}
    if(k==='Enter'||k===' '||k==='e'||k==='E'){modalEncFoco===1?ctrlConfirmYes():ctrlConfirmNo();e.preventDefault();return;}
    if(k==='Escape'){ctrlConfirmNo();return;}
    return;
  }
  if(qbAberta){
    if(k==='ArrowLeft'){
      if(_desafioAberto) _desafioSubNavLeft();
      else if(qbFtpAberta) qbFtpNavegar(-1);
      else qbSetFocus(qbFocusIdx-1);
      e.preventDefault();return;
    }
    if(k==='ArrowRight'){
      if(_desafioAberto) _desafioSubNavRight();
      else if(qbFtpAberta) qbFtpNavegar(1);
      else qbSetFocus(qbFocusIdx+1);
      e.preventDefault();return;
    }
    if(k==='ArrowUp'){ if(_desafioAberto){_desafioSubNavUp();e.preventDefault();return;} }
    if(k==='ArrowDown'){ if(_desafioAberto){_desafioSubNavDown();e.preventDefault();return;} }
    if(k==='Enter'||k===' '){qbConfirmar();e.preventDefault();return;}
    if(k==='Escape'||k==='b'||k==='B'){
      if(_desafioAberto){qbDesafioAbrir();}
      else if(qbFtpAberta){qbFTP();}
      else fecharQB();
      return;
    }
    return;
  }
  if(boxMode==='live'||boxMode==='livre'||boxMode==='sessao'){
    if(APP_MODE==='gym'){
      if(document.getElementById('profFtpBar')){
        // Teste de FTP em curso: teclas de tela perguntam se quer encerrar
        if(k==='1'||k==='2'||k==='3'||k==='4'){ try{ ftpPedirConfirmacao(); }catch(e){} return; }
      } else {
        if(k==='1')ctrlSetScreen(1);if(k==='2')ctrlSetScreen(2);
        if(k==='3')ctrlSetScreen(3);if(k==='4')ctrlSetScreen(4);if(k==='5')ctrlSetScreen(5);
      }
    }
    if(k==='e'||k==='E'||k==='Escape'){ctrlAskConfirm();return;}
    if(k==='b'||k==='B'){
      // B fecha o overlay activo; se nenhum overlay aberto, pede confirmação de saída
      if(typeof ctrlScreen!=='undefined'&&ctrlScreen>0)ctrlSetScreen(ctrlScreen);
      else ctrlAskConfirm();
      return;
    }
    if(k===' '){handleStart();e.preventDefault();}
    if(k==='q'||k==='Q'){handleSelect();e.preventDefault();}
  }
},true);
['mousedown','mousemove','touchstart'].forEach(function(ev){document.addEventListener(ev,function(){if(!idleOn)resetIdleTimer();},{passive:true});});

// ============================================================
// BOOT
// ============================================================
function boxBoot(){
  var h=document.getElementById('boxHeader'),b=document.getElementById('boxBuilder');
  if(h)h.style.display='none';if(b)b.style.display='none';
  boxMode='idle'; ativarIdle();
}
// ── ESCALA AUTOMÁTICA — adapta a qualquer ecrã/TV ────────────────
var _DESIGN_W = 1920, _DESIGN_H = 1080;
function _scaleApp(){
  var s = Math.min(window.innerWidth / _DESIGN_W, window.innerHeight / _DESIGN_H);
  document.body.style.zoom = s;
}
window.addEventListener('resize', _scaleApp);
_scaleApp();

document.addEventListener('DOMContentLoaded',function(){
  _scaleApp();
  universeInit(); boxBoot(); _parCarregarSalvo();
  var gps=navigator.getGamepads?navigator.getGamepads():[];
  for(var i=0;i<gps.length;i++){if(gps[i]){startGamepad();break;}}
  // Demo automático só roda se APP_MODE for builder (nunca em produção GYM)
  if(APP_MODE==='builder'){
    setTimeout(function(){if(demoWanted&&!demoOn&&typeof alunosMap!=='undefined'&&Object.keys(alunosMap).length===0)simularAlunos();},2000);
  }
});



function renderAlunos() {
  var list = document.getElementById('qrAlunosList');
  var num = document.getElementById('qrAlunosNum');
  var total = Object.keys(alunosMap).length;
  if(num) num.textContent = total;
  if(!list) return;
  if(total === 0) { list.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,.3);">Aguardando alunos...</div>'; return; }
  var zC = {z1:'#888',z2:'#295fe8',z3:'#5db13d',z4:'#d7c414',z5:'#ea860c',z6:'#d62d2d',z7:'#b030ff'};
  list.innerHTML = '';
  for(var n in alunosMap) {
    var a = alunosMap[n];
    var row = document.createElement('div');
    // Foto grande + nome. Antes era uma bolinha de 8px e o nome espremido no
    // meio, com um vao enorme ate a rotacao encostada na direita.
    var ini2=String(n).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    var zc=(zC[a.zona]||'#888');
    var av2=a.foto
      ? 'background-image:url(\''+a.foto+'\');background-size:cover;background-position:center;'
      : 'background:'+zc+'22;color:'+zc+';border:2px solid '+zc+'66;';
    row.style.cssText = 'display:flex;align-items:center;gap:11px;padding:8px 11px;background:rgba(255,255,255,.05);border-radius:10px;border-left:3px solid '+zc+';';
    row.innerHTML = '<div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;'
        + 'font-family:\'Barlow Condensed\',sans-serif;font-weight:900;font-size:14px;'+av2+'">'+(a.foto?'':ini2)+'</div>'
      + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+n+'</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,.45);margin-top:1px;">'
          + (a.rpm||0)+' rpm'+(a.watts?('  ·  '+a.watts+' W'):'')+'</div>'
      + '</div>';
    list.appendChild(row);
  }
}

function toggleQRProf() {
  var panel = document.getElementById('qrProfPanel');
  if(!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// Broadcast bloco atual para alunos
// ── RELAY ginásio → aluno ──────────────────────────────────────
// O celular do aluno NÃO pareia BLE dentro do ginásio (iOS-navegador nem suporta).
// O ginásio lê as bikes pelo dongle e devolve os dados por bike. Fonte única de verdade.
var _wsRelayInt=null;

// 29/09a: qual aula está aberta (nome e professor) — vai no sala_info para
// a faixa verde do app e o totem. Professor vem da grade de hoje (aula mais
// perto do horário); sem grade, só o nome escolhido na pré-aula.
function _gymAulaAtualInfo(){
  var nome=''; try{ var el=document.getElementById('className'); nome=(el&&el.value)||''; }catch(e){}
  var prof='', dur=null;
  try{
    var d=new Date(), m=d.getHours()*60+d.getMinutes(), melhor=null, dist=1e9;
    (window._gymGradeHoje||[]).forEach(function(a){
      var h=String(a.hora||'').split(':'), ini=parseInt(h[0],10)*60+parseInt(h[1]||0,10);
      var dd=Math.abs(ini-m); if(dd<=30 && dd<dist){ dist=dd; melhor=a; }
    });
    if(melhor){ prof=melhor.professor_nome||''; dur=melhor.duracao_min||null; if(!nome || nome==='ProRider') nome=melhor.nome||nome; }
  }catch(e){}
  try{ if(typeof workout!=='undefined' && workout && workout.length && typeof _prSecTotal==='function') dur=Math.round(_prSecTotal(workout)/60)||dur; }catch(e){}
  return {nome:nome||'Aula ao vivo', professor:prof, duracao_min:dur};
}
// Config da sala: quais bikes existem (pareadas, exceto 99) e quais estão ocupadas.
function _wsEnviarSalaInfo(){
  if(!wsProf || wsProf.readyState!==1 || typeof parBikeMap==='undefined') return;
  var bikes=[], ocup=[], ocupantes={};
  Object.keys(parBikeMap).forEach(function(num){
    var n=parseInt(num);
    if(n===99) return;                       // bike do professor não entra na grade de alunos
    if(!parBikeMap[num]||!parBikeMap[num].bled112) return; // só bikes realmente pareadas
    bikes.push(n);
  });
  if(typeof alunosMap!=='undefined') Object.keys(alunosMap).forEach(function(nome){
    var a=alunosMap[nome];
    // 26/09b: quem o servidor nao conhece mais (_semSala) nao segura a bike;
    // e o NOME de quem ocupa vai junto, para o proprio aluno poder voltar
    // para a bike dele depois de reabrir o app.
    if(a && !a._virtual && a.bike && !a._semSala){ ocup.push(parseInt(a.bike)); ocupantes[parseInt(a.bike)]=nome; }
  });
  // 01/10b: bike reservada pelo app fica ocupada (com o nome de quem reservou):
  // os outros não a escolhem, e quem reservou a vê como SUA no app.
  try{ if(typeof _resvPorBike==='function'){ var _rv=_resvPorBike(0); Object.keys(_rv).forEach(function(b){ var n=parseInt(b,10);
    if(ocup.indexOf(n)<0){ ocup.push(n); ocupantes[n]=_rv[b].nome; } }); } }catch(e){}
  bikes.sort(function(x,y){return x-y;});
  var num=(typeof parNumBikes!=='undefined')?parNumBikes:bikes.length;
  // 07/10a: nº de cada bike na TV → nº da Keiser no console (o app das lojas lê a Keiser direto pelo nº dela)
  var keiser={}; Object.keys(parBikeMap).forEach(function(num){ var b=parBikeMap[num]; if(b&&b._kid) keiser[parseInt(num)]=b._kid; });
  try{ wsProf.send(JSON.stringify({tipo:'sala_info', numBikes:num, bikes:bikes, ocupadas:ocup, ocupantes:ocupantes, keiser:keiser, aula:_gymAulaAtualInfo()})); }catch(e){}
}

// Dados ao vivo de todas as bikes transmitindo (cada aluno filtra a sua pelo número).
// %FTP já calculado: usa o FTP do aluno logado naquela bike; senão base 150.
function _wsEnviarBikesLive(){
  if(!wsProf || wsProf.readyState!==1 || typeof parBikeMap==='undefined' || typeof alunosMap==='undefined') return;
  // Envia sempre que houver bike pareada e fresca. (Antes exigia aluno não-virtual logado,
  // o que travava o relay se o aluno_conectou não tivesse registrado o aluno real no ginásio.
  // O servidor só repassa para os alunos da sala, então enviar é barato e seguro.)
  var agora=Date.now(), lista=[];
  Object.keys(parBikeMap).forEach(function(num){
    var n=parseInt(num);
    // 23/09e: a 99 tambem vai no relay — sem isto o professor na bike 99 via app
    // nao recebia watts/rpm e a Vista da sala mostrava a 99 como nao conectada.
    var b=parBikeMap[num];
    if(!b || !b.bled112) return;
    if((agora-(b._lastSeen||0))>GYM_BIKE_STALE_MS) return; // bike sem broadcast → fora
    var base=150;
    Object.keys(alunosMap).forEach(function(nome){
      var a=alunosMap[nome];
      if(a && !a._virtual && parseInt(a.bike)===n) base=a.ftpBase||150;
    });
    var pct=Math.round((b.watts||0)/base*100);
    // g = marcha, hr = frequencia cardiaca. O bled112.js ja le os dois do broadcast
    // da Keiser, mas eles nunca eram enviados: o app so recebia w/r/ftp/z e por isso
    // os campos GEAR e BPM ficavam sempre com um traco.
    lista.push({b:n, w:b.watts||0, r:b.rpm||0, ftp:pct, z:_zonaFromPct(pct),
                g:b.gear||0, hr:(function(){ var h=b.bpm||0; Object.keys(alunosMap).forEach(function(nm){ var a=alunosMap[nm]; if(a&&!a._virtual&&parseInt(a.bike)===n){ var x=_hrDe(a); if(x>0) h=x; } }); return h; })(), s:_parSinal(b).lvl});
  });
  if(!lista.length) return;
  if(window._RELAY_DEBUG){ try{ console.log('[RELAY] alunos='+Object.keys(alunosMap).filter(function(n){return !alunosMap[n]._virtual;}).length+' bikes='+JSON.stringify(lista.map(function(x){return x.b+':'+x.w+'W/'+x.r+'rpm';}))); }catch(e){} }
  try{ wsProf.send(JSON.stringify({tipo:'bikes_live', bikes:lista})); }catch(e){}
}

function wsBroadcast(blocoAtual, segTime, totTime, upNext, totRest, blocoRest) {
  if(!wsProf || wsProf.readyState !== 1) return;
  // Serializa o gráfico completo (só envia na primeira vez ou quando muda)
  var grafico = (typeof workout !== 'undefined' && workout) ? workout.map(function(b,i){
    return {
      idx: i,
      z: b.intensity || 'z1',
      dur: b.duration || 1,
      rpmMin: b.rpmMin || 80,
      rpmMax: b.rpmMax || 90,
      ftpMin: b.ftpMin || 70,
      ftpMax: b.ftpMax || 90,
      pos: b.position || 'Sentado',
      seg: b.segmentId || ''
    };
  }) : [];
  wsProf.send(JSON.stringify({
    tipo:       'update_aula',
    bloco:      blocoAtual,
    blocoIdx:   typeof currentBlockIndex !== 'undefined' ? currentBlockIndex : 0,
    zona:       blocoAtual ? (blocoAtual.intensity || blocoAtual.z || 'z1') : 'z1',
    segTime:    segTime,
    // Tempo que falta no BLOCO atual, em segundos. O app so recebia o tempo do
    // SEGMENTO; para mostrar o relogio do bloco ele teria de adivinhar.
    blocoRest:  (typeof blocoRest!=='undefined' ? Math.max(0,Math.round(blocoRest)) : undefined),
    totTime:    totTime,
    totRest:    (typeof totRest!=='undefined'?totRest:undefined),
    upNext:     upNext,
    grafico:    grafico,
    nomeAula:   (function(){ var el=document.getElementById('className'); return el?el.value:'ProRider'; })(),
    totalBlocos: grafico.length
  }));
}
// ========================================
/* ══════════════════════════════════════════
   PRORIDER — script.js v10
   Correções: bug arrasto, MP3, cards superiores,
   círculos, tela final, Zone 7, chamas Z6, PSE
═══════════════════════════════════════════ */

// ── SEGMENTOS ──────────────────────────────
let segments = [
  { id:"warmup",   name:"Aquecimento",     type:"warmup"   },
  { id:"main_1",   name:"Bloco Principal", type:"main"     },
  { id:"cooldown", name:"Volta à Calma",   type:"cooldown" },
];
let activeSegmentId = "warmup";
let mainCounter     = 1;
let workout         = [];

// ── MODO DE INTENSIDADE ────────────────────
let intensityMode = "ftp"; // "ftp" | "hr" | "pse"

// Retorna label de intensidade conforme modo selecionado
function getZoneLabel(zone){
  if(intensityMode==="hr") return zone.fc;
  if(intensityMode==="pse") return `PSE ${zone.pse}`;
  return zone.ftp;
}
function getZoneLabelFull(zone){
  if(intensityMode==="hr") return zone.fcFull;
  if(intensityMode==="pse") return zone.pseFull;
  return zone.ftpFull;
}

// ── VÍDEO / CÂMERA ─────────────────────────
let videoSource    = "video";
let videoDuration  = 0;
let videoEndPoint  = 0;
let videoObjectUrl = null;

/** Pré-carrega o vídeo no elemento de fundo assim que o URL estiver disponível.
 *  Não dá play — só faz o browser iniciar o buffering para evitar atrasos. */
// ── SINCRONIA DO VÍDEO ────────────────────────────────────────────
// A "linha de chegada" do vídeo tem de cair no ÚLTIMO SEGUNDO do último bloco
// principal (fim de aquecimento + principal), logo antes do desaquecimento.
// videoEndPoint = instante do ARQUIVO que deve coincidir com esse momento.
// O início é derivado: videoEndPoint - (aquecimento + principal).
function _prFimPrincipalSec(){
  try{
    var w=_prSecTotal(workout.filter(function(b){var s=segmentById(b.segmentId);return s&&s.type==='warmup';}));
    var m=_prSecTotal(workout.filter(function(b){var s=segmentById(b.segmentId);return s&&s.type==='main';}));
    return w+m;
  }catch(e){ return 0; }
}
function _prDuracaoVideo(url){
  return new Promise(function(res){
    try{
      var v=document.createElement('video');
      v.preload='metadata';
      var done=false;
      var fim=function(){ if(done)return; done=true; var d=v.duration; v.removeAttribute('src'); res(isFinite(d)?d:0); };
      v.onloadedmetadata=fim; v.onerror=fim;
      setTimeout(fim,4000);            // nunca trava a abertura da aula
      v.src=url;
    }catch(e){ res(0); }
  });
}
// Define videoEndPoint validando contra a duração REAL do arquivo escolhido.
// endDeclarado = video.syncOffset do JSON (o que o professor marcou no construtor).
async function _prAplicarSyncVideo(url, endDeclarado){
  var alvo=_prFimPrincipalSec();
  var dur=await _prDuracaoVideo(url);
  if(typeof videoDuration!=='undefined') videoDuration=dur||0;
  var end=Number(endDeclarado)||0;
  var origem='JSON';
  if(!end || (dur && end>dur+0.5)){     // sem marcação, ou marcação maior que o arquivo
    end=dur; origem=end?'fim do arquivo':'indefinido';
  }
  if(typeof videoEndPoint!=='undefined') videoEndPoint=end;
  var ini=end-alvo;
  if(end && ini<0){
    console.warn('[ProRider] vídeo curto: tem '+formatTimeFull(end)+' e a aula precisa de '
      +formatTimeFull(alvo)+' até o fim do bloco principal. Vai tocar do início e a chegada não bate.');
  } else {
    console.log('[ProRider] sync do vídeo ('+origem+'): arquivo '+formatTimeFull(dur)
      +' · chegada em '+formatTimeFull(end)+' · começa em '+formatTimeFull(Math.max(0,ini))
      +' · fim do bloco principal aos '+formatTime(alvo)+' de aula.');
  }
  return {dur:dur, end:end, ini:Math.max(0,ini), alvo:alvo, ok:(end>0&&ini>=0)};
}
function _preloadVideo(url){
  if(!url) return;
  var bv = document.getElementById('backgroundVideo');
  if(!bv) return;
  bv.preload = 'auto';
  if(bv.src !== url){
    bv.src = url;
    bv.load();
    console.log('[ProRider] Vídeo pré-carregando...');
  }
}
let cameraStream   = null;

// ── MP3 ────────────────────────────────────
let mp3Duration  = 0;
let mp3EndPoint  = 0;
let mp3ObjectUrl = null;

// ── LIVE STATE ─────────────────────────────
let currentBlockIndex = 0;
let isPlaying         = false;
let blockStartTime    = null;
let pausedElapsed     = 0;
let animationId       = null;
let bannerTimeout     = null;
let transitionTimeout = null;
let inSegTransition   = false;
let liveStartTime     = 0;
let dragSrcBlock      = null;

// ── ZONAS ──────────────────────────────────
const zoneInfo = {
  zone1:{ name:"Zone 1 – Recovery",       color:"#a1a1a1", fill:"rgba(161,161,161,0.52)", glow:"rgba(161,161,161,0.32)", ftp:"< 60%",    ftpFull:"Abaixo de 60%",  fc:"< 60%",    fcFull:"Abaixo de 60% FCmax",  pse:1,  pseFull:"Muito leve",          beepHz:440,  beepType:"sine"     },
  zone2:{ name:"Zone 2 – Endurance",      color:"#295fe8", fill:"rgba(41,95,232,0.52)",   glow:"rgba(41,95,232,0.35)",   ftp:"60–75%",   ftpFull:"60% a 75%",      fc:"60–70%",   fcFull:"60% a 70% FCmax",       pse:3,  pseFull:"Leve",                beepHz:528,  beepType:"sine"     },
  zone3:{ name:"Zone 3 – Tempo",          color:"#5db13d", fill:"rgba(93,177,61,0.52)",   glow:"rgba(93,177,61,0.35)",   ftp:"76–89%",   ftpFull:"76% a 89%",      fc:"71–80%",   fcFull:"71% a 80% FCmax",       pse:5,  pseFull:"Moderado",            beepHz:660,  beepType:"sine"     },
  zone4:{ name:"Zone 4 – Threshold",      color:"#d7c414", fill:"rgba(215,196,20,0.52)",  glow:"rgba(215,196,20,0.35)",  ftp:"90–104%",  ftpFull:"90% a 104%",     fc:"81–90%",   fcFull:"81% a 90% FCmax",       pse:6,  pseFull:"Forte",               beepHz:784,  beepType:"square"   },
  zone5:{ name:"Zone 5 – VO2 Max",        color:"#ea860c", fill:"rgba(234,134,12,0.52)",  glow:"rgba(234,134,12,0.35)",  ftp:"105–118%", ftpFull:"105% a 118%",    fc:"91–95%",   fcFull:"91% a 95% FCmax",       pse:7,  pseFull:"Muito forte",         beepHz:880,  beepType:"square"   },
  zone6:{ name:"Zone 6 – Anaerobic",   color:"#d62d2d", fill:"rgba(214,45,45,0.52)",   glow:"rgba(214,45,45,0.35)",   ftp:"> 118%",   ftpFull:"Acima de 118%",  fc:"> 95%",    fcFull:"Acima de 95% FCmax",    pse:9,  pseFull:"Máximo esforço",      beepHz:220,  beepType:"sawtooth" },
  zone7:{ name:"Zone 7 – Neuromuscular",color:"#9b30ff", fill:"rgba(155,48,255,0.52)",  glow:"rgba(155,48,255,0.4)",   ftp:"Máx",      ftpFull:"Potência Máxima", fc:"Máx",      fcFull:"Frequência máxima",     pse:10, pseFull:"Sprint total",        beepHz:1200, beepType:"square"   },
};


// Helper: lookup zoneInfo by z1 or zone1 format
function zi(key){
  if(!key) return zoneInfo['zone1'];
  var k=(/^z(\d)$/.test(key))?'zone'+key[1]:key;
  return zoneInfo[k]||zoneInfo['zone1'];
}
// ── ELEMENTOS ──────────────────────────────
const addBlockBtn        = document.getElementById("addBlock");
const startLiveBtn       = document.getElementById("startLive");
const liveClass          = document.getElementById("liveClass");
const closeLiveBtn       = document.getElementById("closeLive");
const liveTimelineEl     = document.getElementById("liveTimeline");
const graphTimesEl       = document.getElementById("graphTimes");
const timerText          = document.getElementById("timerText");
const rpmText            = document.getElementById("rpmText");
const ftpCircleText      = document.getElementById("ftpCircleText");
const timerCircle        = document.getElementById("timerCircle");
const rpmCircle          = document.getElementById("rpmCircle");
const backgroundVideo    = document.getElementById("backgroundVideo");
const backgroundAudio    = document.getElementById("backgroundAudio");
const cameraLive         = document.getElementById("cameraLive");
const liveBadge          = document.getElementById("liveBadge");
const liveClassName      = document.getElementById("liveClassName");
const nextZoneEl         = document.getElementById("nextZone");
const nextDurationEl     = document.getElementById("nextDuration");
const nextPositionEl     = document.getElementById("nextPosition");
const nextRPMEl          = document.getElementById("nextRPM");
const nextFTPEl          = document.getElementById("nextFTP");
const nextFTPTextEl      = document.getElementById("nextFTPText");
const currentZoneBanner  = document.getElementById("currentZoneBanner");
const currentZoneLabel   = document.getElementById("currentZoneLabel");
const currentZoneFTP     = document.getElementById("currentZoneFTP");
const totalProgressFill  = document.getElementById("totalProgressFill");
const totalProgressText  = document.getElementById("totalProgressText");
const transitionOverlay  = document.getElementById("transitionOverlay");
const transitionZoneEl   = document.getElementById("transitionZone");
const transitionSubEl    = document.getElementById("transitionSub");
const clockElapsedVal    = document.querySelector("#clockElapsed .clock-value");
const clockRemainingVal  = document.querySelector("#clockRemaining .clock-value");
const clockElapsedLbl    = document.querySelector("#clockElapsed .clock-label");
const liveSegmentLabel   = document.getElementById("liveSegmentLabel");
const liveBottomGradient = document.getElementById("liveBottomGradient");
const countdownOverlay   = document.getElementById("countdownOverlay");
const countdownNumber    = document.getElementById("countdownNumber");
const countdownZoneName  = document.getElementById("countdownZoneName");
const endScreen          = document.getElementById("endScreen");
const endClassName       = document.getElementById("endClassName");
const endStats           = document.getElementById("endStats");
const endSegStats        = document.getElementById("endSegStats");
const saveBtn            = document.getElementById("saveWorkout");
const loadBtn            = document.getElementById("loadWorkout");
const exportPDFBtn       = document.getElementById("exportPDF");
const clearBtn           = document.getElementById("clearWorkout");
const loadFileInput      = document.getElementById("loadFileInput");
const workoutSummary     = document.getElementById("workoutSummary");
const summaryTotal       = document.getElementById("summaryTotal");
const summaryBlocks      = document.getElementById("summaryBlocks");
const videoInputBuilder  = document.getElementById("videoInputBuilder");
const videoPreview       = document.getElementById("videoPreview");
const videoPreviewBox    = document.getElementById("videoPreviewBox");
const videoDurationLabel = document.getElementById("videoDurationLabel");
const endPointSlider     = document.getElementById("endPointSlider");
const endPointDisplay    = document.getElementById("endPointDisplay");
const startPointDisplay  = document.getElementById("startPointDisplay");
const endPointFinal      = document.getElementById("endPointFinal");
const workoutDurDisplay  = document.getElementById("workoutDurDisplay");
const syncInfo           = document.getElementById("syncInfo");
const previewSyncBtn     = document.getElementById("previewSyncBtn");
const removeVideoBuilder = document.getElementById("removeVideoBuilder");
const cameraPreviewBuilder = document.getElementById("cameraPreviewBuilder");
const testCameraBtn      = document.getElementById("testCameraBtn");
const stopCameraBtn      = document.getElementById("stopCameraBtn");
const mp3InputBuilder    = document.getElementById("mp3InputBuilder");
const audioPreview       = document.getElementById("audioPreview");
const mp3PreviewBox      = document.getElementById("mp3PreviewBox");
const mp3EndPointSlider  = document.getElementById("mp3EndPointSlider");
const mp3EndPointDisplay = document.getElementById("mp3EndPointDisplay");
const mp3StartDisplay    = document.getElementById("mp3StartDisplay");
const mp3EndDisplay      = document.getElementById("mp3EndDisplay");
const mp3DurDisplay      = document.getElementById("mp3DurDisplay");
const mp3SyncInfo        = document.getElementById("mp3SyncInfo");
const mp3PreviewBtn      = document.getElementById("mp3PreviewBtn");
const removeMp3Btn       = document.getElementById("removeMp3Btn");
const segTransOverlay    = document.getElementById("segmentTransitionOverlay");
const stSegmentName      = document.getElementById("stSegmentName");
const stBlockTimer       = document.getElementById("stBlockTimer");
const stGraph            = document.getElementById("stGraph");
const stGraphTimes       = document.getElementById("stGraphTimes");

// ══════════════════════════════════════════
// MODO DE INTENSIDADE
// ══════════════════════════════════════════
document.querySelectorAll(".mode-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".mode-tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    intensityMode=btn.dataset.mode;
  });
});

// ══════════════════════════════════════════
// TOGGLE VÍDEO / CÂMERA
// ══════════════════════════════════════════
function setVideoSource(src){
  videoSource=src;
  document.getElementById("srcVideoBtn").classList.toggle("active",src==="video");
  document.getElementById("srcCameraBtn").classList.toggle("active",src==="camera");
  document.getElementById("panelVideo").style.display  = src==="video"  ? "block":"none";
  document.getElementById("panelCamera").style.display = src==="camera" ? "block":"none";
  if(src!=="camera") stopCameraPreview();
}
document.getElementById("srcVideoBtn").addEventListener("click",()=>setVideoSource("video"));
document.getElementById("srcCameraBtn").addEventListener("click",()=>setVideoSource("camera"));

// câmera preview
testCameraBtn.addEventListener("click",async()=>{
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    cameraPreviewBuilder.srcObject=stream; cameraPreviewBuilder.style.display="block";
    stopCameraBtn.style.display="block"; testCameraBtn.style.display="none";
    cameraPreviewBuilder._stream=stream;
  }catch(e){ alert("Não foi possível acessar a câmera. Verifique as permissões."); }
});
stopCameraBtn.addEventListener("click",()=>stopCameraPreview());
function stopCameraPreview(){
  if(cameraPreviewBuilder._stream){ cameraPreviewBuilder._stream.getTracks().forEach(t=>t.stop()); cameraPreviewBuilder._stream=null; }
  cameraPreviewBuilder.srcObject=null; cameraPreviewBuilder.style.display="none";
  stopCameraBtn.style.display="none"; testCameraBtn.style.display="block";
}

// ══════════════════════════════════════════
// SEGMENTO TABS
// ══════════════════════════════════════════
function renderSegTabs(){
  const container=document.getElementById("segTabs"); container.innerHTML="";
  segments.forEach(seg=>{
    const btn=document.createElement("button");
    btn.className=`seg-tab type-${seg.type}${seg.id===activeSegmentId?" active":""}`;
    btn.dataset.id=seg.id;
    const badge=seg.type==="warmup"?"Aquec.":seg.type==="cooldown"?"Calma":"Principal";
    btn.innerHTML=`<span class="seg-tab-name">${seg.name}</span><span class="seg-type-badge">${badge}</span>`;
    btn.addEventListener("click",()=>{ activeSegmentId=seg.id; renderSegTabs(); });
    container.appendChild(btn);
  });
}
document.getElementById("addSegmentBtn").addEventListener("click",()=>{
  mainCounter++; const id=`main_${mainCounter}`;
  const ci=segments.findIndex(s=>s.type==="cooldown");
  segments.splice(ci,0,{id,name:`Bloco Principal ${mainCounter}`,type:"main"});
  activeSegmentId=id; renderSegTabs(); renderBuilderTimeline();
});
document.getElementById("applySegName").addEventListener("click",()=>{
  const val=document.getElementById("editSegName").value.trim(); if(!val) return;
  const seg=segments.find(s=>s.id===activeSegmentId); if(seg) seg.name=val;
  document.getElementById("editSegName").value=""; renderSegTabs(); renderBuilderTimeline();
});
document.getElementById("deleteSegBtn").addEventListener("click",()=>{
  const seg=segments.find(s=>s.id===activeSegmentId);
  if(!seg||seg.type!=="main"){ alert("Só é possível remover segmentos do tipo Bloco Principal."); return; }
  if(workout.some(b=>b.segmentId===activeSegmentId)){
    if(!confirm(`Remover "${seg.name}" e todos os seus blocos?`)) return;
    workout=workout.filter(b=>b.segmentId!==activeSegmentId);
  }
  segments=segments.filter(s=>s.id!==activeSegmentId);
  activeSegmentId=segments[0].id;
  renderSegTabs(); renderBuilderTimeline(); updateSummary(); updateSyncInfo();
});


// ══ 26/09b — DESAFIO AUTOMATICO NO BLOCO (construtor) ═══════════════
// O professor marca, no bloco, qual desafio e quantos segundos ele dura. Na
// aula, o desafio comeca sozinho quando faltarem esses segundos para o fim do
// bloco e termina exatamente no fim dele (resultado na TV e no celular).
function _blkDesDurBloco(){ var d=document.getElementById('duration'); return Math.max(1,Math.round(Number(d&&d.value)||0)); }
function blkDesAtualizar(){
  var t=document.getElementById('blkDesTipo'), m=document.getElementById('blkDesModo'), sEl=document.getElementById('blkDesSeg');
  var tp=document.getElementById('blkDesTempo'), dica=document.getElementById('blkDesDica');
  if(!t) return;
  var on=!!t.value;
  if(tp) tp.style.display=on?'flex':'none';
  if(m) m.style.display=on?'':'none';
  if(!on){ if(dica) dica.textContent=''; return; }
  if(t.value==='cabo' && m && m.value==='geral') m.value='equipes';   // cabo precisa de dois lados
  var dur=_blkDesDurBloco();
  var seg=Math.round(Number(sEl&&sEl.value)||0);
  if(!(seg>0) || seg>dur) seg=dur;
  if(sEl && Number(sEl.value)!==seg) sEl.value=seg;
  var ini=dur-seg, f=function(x){ return Math.floor(x/60)+':'+String(x%60).padStart(2,'0'); };
  if(dica) dica.textContent = (ini<=0 ? 'Começa junto com o bloco' : 'Começa em '+f(ini)+' do bloco')
      +' e termina no fim dele ('+f(seg)+' de desafio).';
}
function blkDesAdj(d){ var e=document.getElementById('blkDesSeg'); if(!e) return; e.value=Math.max(5,(Math.round(Number(e.value)||0)+d)); blkDesAtualizar(); }
function blkDesInteiro(){ var e=document.getElementById('blkDesSeg'); if(e) e.value=_blkDesDurBloco(); blkDesAtualizar(); }
function _blkDesLer(){
  var t=document.getElementById('blkDesTipo'); if(!t||!t.value) return null;
  var m=document.getElementById('blkDesModo'), e=document.getElementById('blkDesSeg');
  var dur=_blkDesDurBloco(), seg=Math.round(Number(e&&e.value)||dur);
  seg=Math.max(5,Math.min(dur,seg));
  var modo=(m&&m.value)||'equipes'; if(t.value==='cabo'&&modo==='geral') modo='equipes';
  return {tipo:t.value, modo:modo, seg:seg};
}
try{ document.addEventListener('input',function(ev){ if(ev.target&&ev.target.id==='duration') blkDesAtualizar(); }); }catch(e){}
try{ setTimeout(blkDesAtualizar,0); }catch(e){}

// Na aula: chamado a cada quadro pelo relogio da aula.
var _desAutoFeito={};
function _desAutoTick(progress){
  try{
    if(typeof workout==='undefined'||!workout.length) return;
    var idx=currentBlockIndex, cb=workout[idx];
    // terminou o bloco do desafio automatico -> resultado
    if(desafio.ativo && desafio._autoBloco!=null){
      if(idx!==desafio._autoBloco){ desafio._autoBloco=null; _desafioMostrarResultadoFinais(); return; }
      var r=_prSec(cb)*(1-progress); desafio._autoRest=r;
      if(r<=0.25){ desafio._autoBloco=null; _desafioMostrarResultadoFinais(); }
      return;
    }
    if(!cb||!cb.desafio||!cb.desafio.tipo||desafio.ativo||_desAutoFeito[idx]) return;
    var rest=_prSec(cb)*(1-progress), seg=Math.max(5,Math.min(_prSec(cb),cb.desafio.seg||_prSec(cb)));
    if(rest<=seg+0.05 && rest>1){
      _desAutoFeito[idx]=true;
      desafio.tipo=cb.desafio.tipo; desafio.modo=cb.desafio.modo||'equipes';
      desafioIniciar();
      desafio._autoBloco=idx; desafio._autoSeg=seg; desafio._autoRest=rest;
      try{ console.log('[ProRider] desafio automatico do bloco '+idx+': '+desafio.tipo+' / '+desafio.modo+' por '+seg+' s'); }catch(e){}
    }
  }catch(e){}
}
// ══════════════════════════════════════════
// ADICIONAR BLOCO
// ══════════════════════════════════════════
addBlockBtn.addEventListener("click",()=>{
  const duration=document.getElementById("duration").value;
  const rpmMin=document.getElementById("rpmMin").value;
  const rpmMax=document.getElementById("rpmMax").value;
  const intensity=document.getElementById("intensity").value;
  const position=document.getElementById("position").value;
  const notes=document.getElementById("notes").value;
  if(!duration||!rpmMin||!rpmMax){ alert("Preencha Tempo, RPM mínimo e RPM máximo."); return; }
  if(Number(rpmMin)>Number(rpmMax)){ alert("RPM mínimo não pode ser maior que o máximo."); return; }
  const seg=segments.find(s=>s.id===activeSegmentId);
  // Normaliza: zone1→z1, zone5→z5 etc
  function zoneKey(v){ var m=String(v).match(/^zone(\d)$/i); return m?'z'+m[1]:v; }
  const rawIntensity=(seg&&seg.type==="cooldown")?"zone1":intensity;
  const finalIntensity=zoneKey(rawIntensity);
  workout.push({
    durationSec: Math.max(1,Math.round(Number(duration))),  // input ja e em SEGUNDOS — fonte da verdade
    duration:  Math.max(1,Math.round(Number(duration))) / 60,  // derivado, so retrocompat
    rpmMin:    Number(rpmMin),
    rpmMax:    Number(rpmMax),
    intensity: finalIntensity,
    position,notes,
    segmentId: activeSegmentId
  });
  var _bd=_blkDesLer(); if(_bd) workout[workout.length-1].desafio=_bd;
  renderBuilderTimeline(); updateSummary(); updateSyncInfo();
  document.getElementById("notes").value="";
  try{ var _t=document.getElementById('blkDesTipo'); if(_t){ _t.value=''; blkDesAtualizar(); } }catch(e){}
});

// ══════════════════════════════════════════
// TIMELINE BUILDER — drag só dentro do segmento
// ══════════════════════════════════════════
function renderBuilderTimeline(){
  const container=document.getElementById("segmentTimelineContainer"); container.innerHTML="";
  segments.forEach(seg=>{
    const segBlocks=workout.filter(b=>b.segmentId===seg.id);
    const totalMin=segBlocks.reduce((a,b)=>a+b.duration,0);
    const wrapper=document.createElement("div"); wrapper.className="segment-timeline";
    const header=document.createElement("div"); header.className="seg-timeline-header";
    const totalSec=Math.round(totalMin*60);
    const segDurStr=totalSec>0?(Math.floor(totalSec/60)+':'+(totalSec%60).toString().padStart(2,'0')):'';
    header.innerHTML=`<span class="seg-timeline-label">${seg.name}</span><span class="seg-timeline-dur">${segDurStr}</span>`;
    wrapper.appendChild(header);
    const blocksRow=document.createElement("div"); blocksRow.className="seg-blocks"; blocksRow.dataset.segId=seg.id;
    if(!segBlocks.length){
      blocksRow.innerHTML=`<span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;color:rgba(255,255,255,0.2);padding:8px;">Nenhum bloco</span>`;
    } else {
      segBlocks.forEach(block=>{
        const gi=workout.indexOf(block);
        const div=document.createElement("div");
        div.classList.add("block",block.intensity);
        if(/em\s*p|standing/i.test(String(block.position||""))) div.classList.add("standing");
        div.draggable=true; div.dataset.gi=gi;
        const bSec=_prSec(block);
        const bDurStr=Math.floor(bSec/60)+':'+(bSec%60).toString().padStart(2,'0');
        const _dsc=block.desafio&&block.desafio.tipo?`<span class="block-des" title="Desafio automático — clique para remover">${(_desafioIcons[block.desafio.tipo]||'🏆')} ${Math.floor(block.desafio.seg/60)}:${String(block.desafio.seg%60).padStart(2,'0')}</span>`:'';
        div.innerHTML=`${bDurStr}<br>${block.rpmMin}–${block.rpmMax}${_dsc}<div class="block-actions"><button class="block-btn block-duplicate" title="Duplicar">⧉</button><button class="block-btn block-delete" title="Remover">✕</button></div>`;
        div.querySelector(".block-duplicate").addEventListener("click",e=>{ e.stopPropagation(); const copy={...workout[gi]}; workout.splice(gi+1,0,copy); renderBuilderTimeline(); updateSummary(); updateSyncInfo(); });
        const _bdEl=div.querySelector(".block-des");
        if(_bdEl) _bdEl.addEventListener("click",e=>{ e.stopPropagation(); if(confirm('Remover o desafio automático deste bloco?')){ delete workout[gi].desafio; renderBuilderTimeline(); } });
        div.querySelector(".block-delete").addEventListener("click",e=>{ e.stopPropagation(); workout.splice(gi,1); renderBuilderTimeline(); updateSummary(); updateSyncInfo(); });
        // drag — só dentro do mesmo segmento
        div.addEventListener("dragstart",e=>{ dragSrcBlock={gi,segId:seg.id}; div.classList.add("dragging"); e.dataTransfer.effectAllowed="move"; });
        div.addEventListener("dragend",()=>{ div.classList.remove("dragging"); document.querySelectorAll(".drag-over").forEach(el=>el.classList.remove("drag-over")); dragSrcBlock=null; });
        div.addEventListener("dragover",e=>{ e.preventDefault(); if(dragSrcBlock&&dragSrcBlock.segId===seg.id) div.classList.add("drag-over"); });
        div.addEventListener("dragleave",()=>div.classList.remove("drag-over"));
        div.addEventListener("drop",e=>{
          e.preventDefault(); div.classList.remove("drag-over");
          if(!dragSrcBlock||dragSrcBlock.gi===gi||dragSrcBlock.segId!==seg.id) return;
          const moved=workout.splice(dragSrcBlock.gi,1)[0];
          const newGi=workout.indexOf(block);
          workout.splice(newGi,0,moved);
          renderBuilderTimeline(); updateSummary();
        });
        blocksRow.appendChild(div);
      });
    }
    wrapper.appendChild(blocksRow); container.appendChild(wrapper);
  });
  document.getElementById("classNameHeader").textContent=document.getElementById("className").value||"";
}
document.getElementById("className").addEventListener("input",()=>{ document.getElementById("classNameHeader").textContent=document.getElementById("className").value||""; });

// ══════════════════════════════════════════
// RESUMO
// ══════════════════════════════════════════
function updateSummary(){
  if(!workout.length){ workoutSummary.style.display="none"; return; }
  const totalMin=workout.reduce((a,b)=>a+b.duration,0);
  const h=Math.floor(totalMin/60),m=totalMin%60;
  summaryTotal.textContent=`⏱ ${h>0?h+"h "+m+"min":m+" min"}`;
  summaryBlocks.textContent=`📦 ${workout.length} blocos`;
  // TSS planejado ao vivo (calculadora no construtor)
  try{
    var _t=calcularTSS(workout);
    var _el=document.getElementById('summaryTSS');
    if(!_el){ _el=document.createElement('span'); _el.id='summaryTSS'; workoutSummary.appendChild(_el); }
    _el.textContent='⚡ TSS '+_t.tss+' · IF '+_t.if.toFixed(2);
  }catch(e){}
  workoutSummary.style.display="flex";
}

// ══════════════════════════════════════════
// VÍDEO BUILDER
// ══════════════════════════════════════════
videoInputBuilder.addEventListener("change",()=>{
  const file=videoInputBuilder.files[0]; if(!file) return;
  if(videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl=URL.createObjectURL(file);
  videoPreview.src=videoObjectUrl; videoPreviewBox.style.display="block";
  videoPreview.onloadedmetadata=()=>{
    videoDuration=videoPreview.duration;
    videoDurationLabel.textContent="Duração: "+formatTimeFull(videoDuration);
    endPointSlider.max=videoDuration; endPointSlider.value=videoDuration;
    videoEndPoint=videoDuration; endPointDisplay.textContent=formatTimeFull(videoDuration);
    updateSyncInfo();
  };
});
endPointSlider.addEventListener("input",()=>{
  videoEndPoint=parseFloat(endPointSlider.value);
  endPointDisplay.textContent=formatTimeFull(videoEndPoint);
  videoPreview.currentTime=videoEndPoint; updateSyncInfo();
});
function calcVideoStartPoint(){
  const wSec=_prSecTotal(workout.filter(b=>segmentById(b.segmentId)?.type==="warmup"));
  const mSec=_prSecTotal(workout.filter(b=>segmentById(b.segmentId)?.type==="main"));
  return videoEndPoint-wSec-mSec;
}
function updateSyncInfo(){
  if(!videoDuration||!workout.length){ syncInfo.style.display="none"; return; }
  const sp=calcVideoStartPoint();
  workoutDurDisplay.textContent=formatTime(_prSecTotal(workout))+" total";
  endPointFinal.textContent=formatTimeFull(videoEndPoint);
  if(sp<0){ startPointDisplay.textContent="⚠ Vídeo curto"; startPointDisplay.style.color="#d62d2d"; }
  else { startPointDisplay.textContent=formatTimeFull(sp); startPointDisplay.style.color="#fff"; }
  syncInfo.style.display="block";
}
previewSyncBtn.addEventListener("click",()=>{
  const sp=calcVideoStartPoint(); if(sp<0){ alert("Vídeo mais curto que Aquecimento + Blocos."); return; }
  videoPreview.currentTime=sp; videoPreview.play(); setTimeout(()=>videoPreview.pause(),4000);
});
removeVideoBuilder.addEventListener("click",()=>{
  videoPreview.pause(); videoPreview.removeAttribute("src"); videoPreview.load();
  videoPreviewBox.style.display="none"; videoDurationLabel.textContent="";
  if(videoObjectUrl){ URL.revokeObjectURL(videoObjectUrl); videoObjectUrl=null; }
  videoDuration=0; videoEndPoint=0; videoInputBuilder.value=""; syncInfo.style.display="none";
});
// ══════════════════════════════════════════════════════════════════
// MÍDIA — âncora única: a posição do MP3 e do vídeo SEMPRE sai do doneSec da
// aula. Nunca deixar audio/video correndo por conta propria.
//   _prMidiaPausar()          → congela audio e video junto com a aula
//   _prMidiaSync(doneSec, ...)→ realinha e RETOMA o que estiver parado
// ══════════════════════════════════════════════════════════════════
function _prMidiaPausar(){
  try{ if(typeof backgroundAudio!=='undefined'&&backgroundAudio&&backgroundAudio.src) backgroundAudio.pause(); }catch(e){}
  try{ if(typeof backgroundVideo!=='undefined'&&backgroundVideo&&backgroundVideo.src && videoSource==='video') backgroundVideo.pause(); }catch(e){}
}
function _prMidiaSync(doneSec, tolerancia){
  var tol=(tolerancia==null)?1.0:tolerancia;
  // ── MP3: comeca junto com a aula (currentTime = doneSec)
  try{
    if(typeof mp3ObjectUrl!=='undefined'&&mp3ObjectUrl&&backgroundAudio&&backgroundAudio.src){
      var alvoA=Math.max(0,doneSec);
      if(Math.abs(backgroundAudio.currentTime-alvoA)>tol){
        // se ja passou do fim do arquivo o elemento fica em 'ended': mexer no
        // currentTime nao volta a tocar sozinho, precisa de play() explicito.
        if(alvoA < (backgroundAudio.duration||Infinity)) backgroundAudio.currentTime=alvoA;
      }
      if(isPlaying && backgroundAudio.paused && alvoA < (backgroundAudio.duration||Infinity)){
        var pA=backgroundAudio.play(); if(pA&&pA.catch) pA.catch(function(){});
      }
    }
  }catch(e){}
  // ── VÍDEO: entra no ponto derivado do videoEndPoint
  try{
    if(typeof videoSource!=='undefined'&&videoSource==='video'&&videoObjectUrl&&backgroundVideo&&backgroundVideo.src){
      var alvoV=Math.max(0,calcVideoStartPoint())+doneSec;
      if(Math.abs(backgroundVideo.currentTime-alvoV)>tol){
        if(alvoV < (backgroundVideo.duration||Infinity)) backgroundVideo.currentTime=alvoV;
      }
      if(isPlaying && backgroundVideo.paused && alvoV < (backgroundVideo.duration||Infinity)){
        var pV=backgroundVideo.play(); if(pV&&pV.catch) pV.catch(function(){});
      }
    }
  }catch(e){}
}
// Voltar de minimizado: a aba fica sem frames, mas o relogio da aula segue o
// tempo real. Realinha na hora, sem esperar a tolerancia.
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState!=='visible') return;
  try{
    if(typeof isPlaying==='undefined'||!isPlaying) return;
    if(typeof workout==='undefined'||!workout.length) return;
    var prog=Math.min(1,(pausedElapsed/1000)/(_prSec(workout[currentBlockIndex])||1));
    _prMidiaSync(calcDoneSec(prog), 0.2);
    console.log('[ProRider] voltou de minimizado — midia realinhada.');
  }catch(e){}
});

function syncVideoToAula(doneSec){
  if(!videoObjectUrl||!backgroundVideo.src) return;
  const sp=Math.max(0,calcVideoStartPoint());
  const expected=sp+doneSec;
  if(Math.abs(backgroundVideo.currentTime-expected)>1.0) backgroundVideo.currentTime=expected;
}

// ══════════════════════════════════════════
// MP3 BUILDER
// ══════════════════════════════════════════
if(mp3InputBuilder) mp3InputBuilder.addEventListener("change",()=>{
  const file=mp3InputBuilder.files[0]; if(!file) return;
  if(mp3ObjectUrl) URL.revokeObjectURL(mp3ObjectUrl);
  mp3ObjectUrl=URL.createObjectURL(file);
  if(audioPreview){ audioPreview.src=mp3ObjectUrl; mp3PreviewBox.style.display="block"; }
  const tmp=new Audio(mp3ObjectUrl);
  tmp.onloadedmetadata=()=>{
    mp3Duration=tmp.duration;
    const mp3DurLbl=document.getElementById("mp3DurationLabel");
    if(mp3DurLbl) mp3DurLbl.textContent="Duração: "+formatTime(Math.floor(mp3Duration));
    if(mp3EndPointSlider){ mp3EndPointSlider.max=mp3Duration; mp3EndPointSlider.value=mp3Duration; }
    mp3EndPoint=mp3Duration;
    if(mp3EndPointDisplay) mp3EndPointDisplay.textContent=formatTime(Math.floor(mp3Duration));
    updateMp3SyncInfo();
  };
});
if(mp3EndPointSlider) mp3EndPointSlider.addEventListener("input",()=>{
  mp3EndPoint=parseFloat(mp3EndPointSlider.value);
  if(mp3EndPointDisplay) mp3EndPointDisplay.textContent=formatTime(Math.floor(mp3EndPoint));
  if(audioPreview) audioPreview.currentTime=mp3EndPoint;
  updateMp3SyncInfo();
});
function calcMp3StartPoint(){
  const wSec=_prSecTotal(workout.filter(b=>segmentById(b.segmentId)?.type==="warmup"));
  const mSec=_prSecTotal(workout.filter(b=>segmentById(b.segmentId)?.type==="main"));
  return mp3EndPoint-wSec-mSec;
}
function updateMp3SyncInfo(){
  if(!mp3Duration||!workout.length){ if(mp3SyncInfo) mp3SyncInfo.style.display="none"; return; }
  const sp=calcMp3StartPoint();
  if(mp3DurDisplay) mp3DurDisplay.textContent=formatTime(_prSecTotal(workout))+" total";
  if(mp3EndDisplay) mp3EndDisplay.textContent=formatTime(Math.floor(mp3EndPoint));
  if(mp3StartDisplay){
    if(sp<0){ mp3StartDisplay.textContent="⚠ MP3 curto"; mp3StartDisplay.style.color="#d62d2d"; }
    else { mp3StartDisplay.textContent=formatTime(Math.floor(sp)); mp3StartDisplay.style.color="#fff"; }
  }
  if(mp3SyncInfo) mp3SyncInfo.style.display="block";
}
if(mp3PreviewBtn) mp3PreviewBtn.addEventListener("click",()=>{
  const sp=calcMp3StartPoint(); if(sp<0){ alert("MP3 mais curto que Aquecimento + Blocos."); return; }
  if(audioPreview){ audioPreview.currentTime=sp; audioPreview.play(); setTimeout(()=>audioPreview.pause(),5000); }
});
if(removeMp3Btn) removeMp3Btn.addEventListener("click",()=>{
  if(audioPreview){ audioPreview.pause(); audioPreview.removeAttribute("src"); audioPreview.load(); }
  if(mp3PreviewBox) mp3PreviewBox.style.display="none";
  if(mp3ObjectUrl){ URL.revokeObjectURL(mp3ObjectUrl); mp3ObjectUrl=null; }
  mp3Duration=0; mp3EndPoint=0;
  if(mp3InputBuilder) mp3InputBuilder.value="";
  if(mp3SyncInfo) mp3SyncInfo.style.display="none";
  const mp3DurLbl=document.getElementById("mp3DurationLabel");
  if(mp3DurLbl) mp3DurLbl.textContent="";
});

// ══════════════════════════════════════════
// SALVAR / CARREGAR / LIMPAR / PDF
// ══════════════════════════════════════════
function getLibrary(){ try{ return JSON.parse(localStorage.getItem("prb_library")||"[]"); }catch(e){ return []; } }
function saveLibrary(lib){ localStorage.setItem("prb_library",JSON.stringify(lib)); }

// ── TSS / NP / IF (planejado, a partir das zonas dos blocos) ──────────────────
// Independe do FTP do aluno: o %FTP da zona já é relativo ao FTP, então ele se
// cancela na conta. Conceito profissional (TrainingPeaks):
//   IF  = ( Σ(if_i^4 · seg_i) / Σseg_i )^(1/4)   (média à 4ª potência = ideia do NP)
//   TSS = horas × IF² × 100        NP(%FTP) = IF × 100
function _zonaFtpMid(b){
  var z=(typeof toZKey==='function')?toZKey(b.intensity):String(b.intensity||'z1');
  var ZT={z1:50,z2:65,z3:83,z4:98,z5:113,z6:135,z7:160}; // meio de cada zona (%FTP)
  var lo=Number(b.ftpMin)||0, hi=Number(b.ftpMax)||0;
  // se o bloco tiver faixa de %FTP REAL (futuro), usa o meio dela; ignora o default 60/89
  if(lo>0&&hi>0 && !(lo===60&&hi===89)) return (lo+hi)/2;
  return ZT[z]||60;
}
function calcularTSS(wo){
  var sumSec=0, sum4=0;
  (wo||[]).forEach(function(b){
    var sec=(Number(b.duration)||0)*60;   // duration em MINUTOS → segundos
    var ifb=_zonaFtpMid(b)/100;           // fração do FTP
    sumSec+=sec; sum4+=Math.pow(ifb,4)*sec;
  });
  if(sumSec<=0) return {tss:0,np:0,if:0,durMin:0};
  var IF=Math.pow(sum4/sumSec,0.25);
  var horas=sumSec/3600;
  return { tss:Math.round(horas*IF*IF*100), np:Math.round(IF*100), if:Math.round(IF*100)/100, durMin:Math.round(sumSec/60) };
}
function saveToLibrary(){
  if(!workout.length){ alert("Adicione blocos antes de salvar."); return; }
  const name = document.getElementById("className").value || "Aula sem nome";

  // ── Mídia: vídeo ──
  var videoEntry = null;
  if(typeof videoSource !== 'undefined'){
    if(videoSource === 'camera'){
      videoEntry = { fonte:'camera', arquivo:null, syncOffset:0 };
    } else if(videoSource === 'video' && typeof videoObjectUrl !== 'undefined' && videoObjectUrl){
      var vInput = document.getElementById('videoInputBuilder'); // era 'videoInput' (id inexistente) -> gravava sempre 'video.mp4'
      var vName  = (vInput && vInput.files[0]) ? vInput.files[0].name : 'video.mp4';
      // syncOffset sempre em segundos
      var vSync  = typeof videoEndPoint !== 'undefined' ? Math.max(0, Math.round(videoEndPoint)) : 0;
      videoEntry = { fonte:'local', arquivo:vName, syncOffset: vSync };
    }
  }

  // ── Mídia: música ──
  var musicaEntry = null;
  if(typeof spotifyPlaylistUri !== 'undefined' && spotifyPlaylistUri){
    musicaEntry = { fonte:'spotify', spotifyUri:spotifyPlaylistUri, arquivo:null, syncOffset:0 };
  } else if(typeof mp3ObjectUrl !== 'undefined' && mp3ObjectUrl){
    var mInput = document.getElementById('mp3InputBuilder');
    var mName  = (mInput && mInput.files[0]) ? mInput.files[0].name : 'musica.mp3';
    // Música sempre começa do início (0)
    musicaEntry = { fonte:'mp3', arquivo:mName, syncOffset: 0 };
  }

  // ── Normaliza workout para formato v1.0 ──
  var workoutV1 = workout.map(function(b){
    var _s = _prSec(b) || 60;   // segundos inteiros = fonte da verdade (v1.1)
    return {
      durationSec: _s,
      duration:   _s/60,        // derivado, so para leitores antigos (v1.0)
      rpmMin:     b.rpmMin    || 80,
      rpmMax:     b.rpmMax    || 90,
      intensity:  b.intensity || 'z1',
      ftpMin:     (b.ftpMin!=null? b.ftpMin : 60),  // !=null: preserva 0 (bloco livre 0-55%)
      ftpMax:     b.ftpMax    || 89,
      position:   b.position  || 'Sentado',
      notes:      b.notes     || '',
      segmentId:  b.segmentId || 'main_1',
      desafio:    (b.desafio && b.desafio.tipo) ? {tipo:b.desafio.tipo, modo:b.desafio.modo||'equipes', seg:b.desafio.seg} : undefined
    };
  });

  var duracaoTotalSec = workoutV1.reduce(function(a,b){ return a+b.durationSec; }, 0);
  var duracaoTotal    = duracaoTotalSec/60;

  // ── TSS planejado da aula (independe do FTP do aluno) ──
  var _tssCalc = calcularTSS(workoutV1);

  // ── Monta entry v1.0 ──
  var entry = {
    versao:        '1.1',
    nome:           name,
    savedAt:        new Date().toISOString(),
    duracaoTotal:   duracaoTotal,
    duracaoTotalSec: duracaoTotalSec,
    segments:       segments,
    mainCounter:    mainCounter,
    workout:        workoutV1,
    // retrocompat
    blocks:         workoutV1,
    // carga/intensidade (planejada)
    tss:            _tssCalc.tss,   // Training Stress Score
    np:             _tssCalc.np,    // Normalized Power como %FTP
    if:             _tssCalc.if,    // Intensity Factor
    // mídia
    video:          videoEntry,
    musica:         musicaEntry
  };

  // Salva na biblioteca local
  const lib = getLibrary();
  const existing = lib.findIndex(function(i){ return i.nome===name||i.name===name; });
  if(existing>=0){ if(!confirm('Substituir "'+name+'"?')) return; lib[existing]=entry; } else lib.unshift(entry);
  saveLibrary(lib);

  // Download do .json
  const blob = new Blob([JSON.stringify(entry, null, 2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}
saveBtn.addEventListener("click",saveToLibrary);
loadBtn.addEventListener("click",()=>loadFileInput.click());
loadFileInput.addEventListener("change",()=>{
  const file=loadFileInput.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      // Aceita formato v1.0 (workout) e legado (blocks)
      const blocos = data.workout || data.blocks;
      if(!blocos||!Array.isArray(blocos)) throw new Error("Formato inválido");
      workout = _prNormWorkout(blocos).map(function(b){
        if(!b.segmentId) b.segmentId="main_1";
        // normaliza campo intensity (antigo formato usava z direto)
        if(!b.intensity && b.z) b.intensity = b.z;
        return b;
      });
      if(data.segments)    segments    = data.segments;
      if(data.mainCounter) mainCounter = data.mainCounter;
      const nomeCampo = data.nome || data.name;
      if(nomeCampo) document.getElementById("className").value = nomeCampo;
      activeSegmentId = segments[0].id;
      renderSegTabs(); renderBuilderTimeline(); updateSummary(); updateSyncInfo(); updateMp3SyncInfo();
      // Informa referências de mídia se existirem
      if(data.video || data.musica){
        var info = [];
        if(data.video)  info.push('Vídeo: '+data.video.fonte+(data.video.arquivo?' ('+data.video.arquivo+')':''));
        if(data.musica) info.push('Música: '+data.musica.fonte+(data.musica.arquivo?' ('+data.musica.arquivo+')':data.musica.spotifyUri?' (Spotify)':''));
        alert('Aula carregada.\n\n' + info.join('\n') + '\n\nColoque os arquivos de mídia nas pastas videos/ e musicas/ do pendrive.');
      }
    }catch(e){ alert("Arquivo inválido."); }
  };
  reader.readAsText(file); loadFileInput.value="";
});
clearBtn.addEventListener("click",()=>{
  if(!workout.length) return;
  if(!confirm("Limpar todos os blocos?")) return;
  workout=[];
  segments=[{id:"warmup",name:"Aquecimento",type:"warmup"},{id:"main_1",name:"Bloco Principal",type:"main"},{id:"cooldown",name:"Volta à Calma",type:"cooldown"}];
  mainCounter=1; activeSegmentId="warmup";
  renderSegTabs(); renderBuilderTimeline(); updateSummary();
  document.getElementById("className").value=""; syncInfo.style.display="none"; if(mp3SyncInfo) mp3SyncInfo.style.display="none";
});
document.getElementById("toggleLibrary").addEventListener("click",()=>{
  const list=document.getElementById("libraryList");
  const isOpen=list.style.display==="block";
  list.style.display=isOpen?"none":"block";
  document.getElementById("toggleLibrary").textContent=isOpen?"▾ ver":"▴ fechar";
  if(!isOpen) renderLibrary();
});
function renderLibrary(){
  const list=document.getElementById("libraryList"); list.innerHTML="";
  const lib=getLibrary();
  if(!lib.length){ list.innerHTML=`<div class="lib-empty">Nenhuma aula salva ainda.</div>`; return; }
  lib.forEach((item,i)=>{
    const d=document.createElement("div"); d.className="library-item";
    const totalSecLib=_prSecTotal(item.blocks);
    d.innerHTML=`<div><div class="lib-item-name">${item.name}</div><div class="lib-item-info">${_saDur(totalSecLib)} · ${item.blocks.length} blocos · ${new Date(item.savedAt).toLocaleDateString("pt-BR")}</div></div><div class="lib-item-actions"><button class="btn-lib-load">Carregar</button><button class="btn-lib-del">🗑</button></div>`;
    d.querySelector(".btn-lib-load").addEventListener("click",()=>{ loadFromLibrary(item); });
    d.querySelector(".btn-lib-del").addEventListener("click",()=>{ if(!confirm(`Remover "${item.name}"?`)) return; const lib2=getLibrary(); lib2.splice(i,1); saveLibrary(lib2); renderLibrary(); });
    list.appendChild(d);
  });
}
// Limpa TODO o estado de midia da aula anterior. Sem isto, as referencias do
// video e da musica de uma aula do pendrive sobreviviam e eram usadas pela aula
// seguinte — inclusive por uma aula do sistema, que nao tem video nenhum. Era o
// que deixava a tela preta indo e voltando.
function _prLimparMidiaDaAula(){
  try{ if(typeof videoObjectUrl!=='undefined' && videoObjectUrl){ URL.revokeObjectURL(videoObjectUrl); } }catch(e){}
  try{ if(typeof mp3ObjectUrl!=='undefined' && mp3ObjectUrl){ URL.revokeObjectURL(mp3ObjectUrl); } }catch(e){}
  try{ if(typeof videoObjectUrl!=='undefined') videoObjectUrl=''; }catch(e){}
  try{ if(typeof mp3ObjectUrl!=='undefined')   mp3ObjectUrl=''; }catch(e){}
  window._prVideoHandle  = null;
  window._prMusicaHandle = null;
  try{ _bgSelVideoItem = null; }catch(e){}
  try{ _bgSelMusicItem = null; }catch(e){}
  try{ if(typeof videoSource!=='undefined') videoSource=''; }catch(e){}
  try{
    if(typeof backgroundVideo!=='undefined' && backgroundVideo){
      backgroundVideo.pause(); backgroundVideo.removeAttribute('src'); backgroundVideo.load();
    }
  }catch(e){}
  try{
    if(typeof backgroundAudio!=='undefined' && backgroundAudio){
      backgroundAudio.pause(); backgroundAudio.removeAttribute('src'); backgroundAudio.load();
    }
  }catch(e){}
  console.log('[ProRider] estado de midia da aula anterior limpo.');
}

function loadFromLibrary(item){
  _prLimparMidiaDaAula();
  workout=_prNormWorkout(item.blocks); workout.forEach(b=>{ if(!b.segmentId) b.segmentId="main_1"; });
  if(item.segments) segments=item.segments;
  if(item.mainCounter) mainCounter=item.mainCounter;
  if(item.name) document.getElementById("className").value=item.name;
  activeSegmentId=segments[0].id;
  renderSegTabs(); renderBuilderTimeline(); updateSummary(); updateSyncInfo(); updateMp3SyncInfo();
  document.getElementById("libraryList").style.display="none";
  document.getElementById("toggleLibrary").textContent="▾ ver";
}
exportPDFBtn.addEventListener("click",()=>{
  if(!workout.length){ alert("Adicione blocos antes de exportar."); return; }
  const name=document.getElementById("className").value||"Aula";
  const _sec = b => _prSec(b);
  const totalSec = workout.reduce((a,b)=>a+_sec(b),0);
  const _mmss = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`;
  const _dur  = t => { const h=Math.floor(t/3600), m=Math.floor((t%3600)/60), ss=t%60;
                       return (h>0? h+"h "+String(m).padStart(2,"0")+"min" : m+"min") + " " + String(ss).padStart(2,"0") + "s"; };

  // ── GRAFICO DA AULA (SVG) — mesma linguagem visual da TV ──
  const GW=1120, GH=300, GAP=3, SEPW=10;
  const segsUsadas = segments.filter(sg=>workout.some(b=>b.segmentId===sg.id));
  const nBar = workout.length, nSep = Math.max(0,segsUsadas.length-1);
  const barW = (GW - nSep*SEPW - (nBar-1)*GAP) / nBar;
  const zAlt = {z1:0.24,z2:0.38,z3:0.50,z4:0.63,z5:0.81,z6:1.0,z7:1.0};
  const zKeyOf = k => (/^z(\d)$/.test(k)? k : (/^zone(\d)$/.test(k)? "z"+k[4] : "z1"));
  let x=0, bars="", seps="", labels="";
  segsUsadas.forEach((sg,si)=>{
    if(si>0){ seps+=`<rect x="${(x+SEPW/2-0.5).toFixed(1)}" y="0" width="1" height="${GH}" fill="#ffffff" opacity=".18"/>`; x+=SEPW; }
    const x0=x;
    workout.filter(b=>b.segmentId===sg.id).forEach(b=>{
      const z=zi(b.intensity), zk=zKeyOf(b.intensity||"z1");
      const h=Math.max(10,(zAlt[zk]||0.24)*GH), y=GH-h;
      const emPe=/em\s*p|standing/i.test(String(b.position||""));
      bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${z.color}" opacity=".88"/>`;
      if(emPe) bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="3" fill="#ffffff"/>`;
      x+=barW+GAP;
    });
    const cx=(x0+(x-GAP))/2;
    labels+=`<text x="${cx.toFixed(1)}" y="${GH+20}" fill="rgba(255,255,255,.45)" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="1.5">${sg.name.toUpperCase()}</text>`;
  });
  const svg=`<svg id="prGraph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GW} ${GH+30}" width="100%">`
    +`<rect x="0" y="0" width="${GW}" height="${GH+30}" fill="#070b14"/>${seps}${bars}${labels}</svg>`;

  // ── DISTRIBUICAO POR ZONA ──
  const zsec={}; workout.forEach(b=>{ const k=zKeyOf(b.intensity||"z1"); zsec[k]=(zsec[k]||0)+_sec(b); });
  const zmax=Math.max(...Object.values(zsec),1);
  let zrows="";
  ["z1","z2","z3","z4","z5","z6","z7"].forEach(k=>{
    if(!zsec[k]) return; const z=zi(k);
    zrows+=`<div class="zr"><i style="background:${z.color}"></i><b>${z.name}</b>`
      +`<div class="zw"><div style="width:${Math.round(zsec[k]/zmax*100)}%;background:${z.color}"></div></div>`
      +`<u>${_mmss(zsec[k])}</u></div>`;
  });

  // ── CHIPS DE SEGMENTO ──
  const chips=segsUsadas.map(sg=>{
    const sb=workout.filter(b=>b.segmentId===sg.id);
    return `<span class="chip">${sg.name} · ${_mmss(sb.reduce((a,b)=>a+_sec(b),0))} · ${sb.length} blocos</span>`;
  }).join("");

  // ── MIDIA (video / musica), se houver ──
  let midia="";
  try{
    const wS=workout.filter(b=>segmentById(b.segmentId)?.type==="warmup").reduce((a,b)=>a+_sec(b),0);
    const mS=workout.filter(b=>segmentById(b.segmentId)?.type==="main").reduce((a,b)=>a+_sec(b),0);
    if(typeof videoEndPoint!=="undefined" && videoEndPoint>0){
      midia+=`<span class="chip">🎬 Vídeo começa em ${formatTimeFull(Math.max(0,videoEndPoint-wS-mS))} · chegada em ${formatTimeFull(videoEndPoint)} (fim do bloco principal, ${_mmss(wS+mS)} de aula)</span>`;
    }
    if(typeof mp3Duration!=="undefined" && mp3Duration>0){
      midia+=`<span class="chip">🎵 MP3 ${formatTime(mp3Duration)}</span>`;
    }
  }catch(e){}

  // ── TABELA ──
  let rows="";
  segsUsadas.forEach(seg=>{
    const sb=workout.filter(b=>b.segmentId===seg.id);
    rows+=`<tr class="seg-row"><td colspan="5">${seg.name} — ${_mmss(sb.reduce((a,b)=>a+_sec(b),0))}</td></tr>`;
    sb.forEach((b,i)=>{ const z=zi(b.intensity);
      rows+=`<tr><td class="num">${i+1}</td>`
        +`<td><span class="dot" style="background:${z.color}"></span>${z.name}</td>`
        +`<td class="mono">${_mmss(_sec(b))}</td>`
        +`<td>${b.rpmMin}–${b.rpmMax} RPM</td>`
        +`<td style="color:${z.color}">${z.ftp} FTP · ${b.position}</td></tr>`; });
  });

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name}</title><style>
    *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    body{background:#070b14;color:#fff;font-family:'Barlow Condensed',Arial,sans-serif;padding:36px 40px;}
    .header{display:flex;align-items:center;gap:14px;margin-bottom:8px;}
    .logo-bolt{font-size:32px;}
    .logo-name{font-size:42px;font-weight:900;letter-spacing:3px;line-height:1;}
    .logo-rider{background:linear-gradient(90deg,#ffe033,#ea860c,#d62d2d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    .logo-bar{height:3px;background:linear-gradient(90deg,#ffe033,#ea860c,#d62d2d);border-radius:2px;margin:4px 0 2px;}
    .logo-sub{font-size:11px;letter-spacing:4px;color:rgba(255,255,255,0.3);text-transform:uppercase;}
    .aula-name{font-size:30px;font-weight:900;letter-spacing:2px;margin:18px 0 4px;}
    .sub{font-size:13px;color:rgba(255,255,255,0.42);letter-spacing:1px;margin-bottom:18px;}
    .card{background:#0b1120;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 18px;margin-bottom:16px;}
    .card-t{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.32);margin-bottom:12px;}
    .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
    .chip{font-size:12px;letter-spacing:1px;color:rgba(255,255,255,.55);background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:5px 13px;}
    .zr{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
    .zr i{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
    .zr b{width:190px;font-size:13px;font-weight:700;color:rgba(255,255,255,.72);}
    .zw{flex:1;height:8px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden;}
    .zw div{height:100%;border-radius:4px;}
    .zr u{width:52px;text-align:right;font-size:13px;font-weight:700;text-decoration:none;color:rgba(255,255,255,.5);}
    table{width:100%;border-collapse:collapse;}
    th{text-align:left;padding:9px 12px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.08);}
    td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;}
    .num{color:#888;width:38px;}
    .mono{font-variant-numeric:tabular-nums;font-weight:700;}
    .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;}
    .seg-row td{background:#131c2e;color:#7ba7ff;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:12px;}
    tbody tr:nth-child(even):not(.seg-row){background:rgba(255,255,255,0.02);}
    .fire-bar{height:3px;background:linear-gradient(90deg,#ffe033,#ea860c,#d62d2d);margin-top:26px;border-radius:2px;}
    .footer{font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.16);text-transform:uppercase;margin-top:10px;text-align:right;}
    #dl{position:fixed;top:14px;right:16px;background:#ea860c;color:#fff;border:none;border-radius:8px;
        padding:9px 16px;font-family:inherit;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer;}
    @media print{ #dl{display:none;} .card,table{break-inside:avoid;} }
  </style></head><body>
    <button id="dl">⬇ Baixar gráfico (SVG)</button>
    <div class="header">
      <div class="logo-bolt">⚡</div>
      <div>
        <div class="logo-name"><span>PRO</span><span class="logo-rider">RIDER</span></div>
        <div class="logo-bar"></div>
        <div class="logo-sub">Cycling Performance</div>
      </div>
    </div>
    <div class="aula-name">${name}</div>
    <div class="sub">${_dur(totalSec)} · ${workout.length} blocos · ${segsUsadas.length} segmentos · ${new Date().toLocaleDateString("pt-BR")}</div>
    <div class="chips">${chips}${midia}</div>
    <div class="card"><div class="card-t">Jornada completa · topo branco = em pé</div>${svg}</div>
    <div class="card"><div class="card-t">Distribuição de esforço por zona</div>${zrows}</div>
    <table><thead><tr><th>#</th><th>Zona</th><th>Tempo</th><th>RPM</th><th>Intensidade · Posição</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="fire-bar"></div>
    <div class="footer">ProRider Cycling Performance · prorider.app</div>
    <script>
      document.getElementById('dl').addEventListener('click',function(){
        var el=document.getElementById('prGraph');
        var blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>'+el.outerHTML],{type:'image/svg+xml'});
        var a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        a.download=${JSON.stringify(name)}.replace(/[^\w\-]+/g,'_')+'_grafico.svg';
        a.click();
      });
    <\/script>
  </body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const w=window.open(url,"_blank");
  setTimeout(()=>{ w&&w.print(); URL.revokeObjectURL(url); },800);
});

// ══════════════════════════════════════════
// INICIAR LIVE
// ══════════════════════════════════════════
startLiveBtn.addEventListener("click",async()=>{
  if(!workout.length){ alert("Adicione pelo menos um bloco."); return; }

  // ORDENAR por segmento antes de iniciar — fix bug arrasto
  const segOrder=segments.map(s=>s.id);
  workout.sort((a,b)=>segOrder.indexOf(a.segmentId)-segOrder.indexOf(b.segmentId));

  liveClass.style.display="block";
  closeLiveBtn.style.display='';     // sempre visível durante live class
  currentBlockIndex=0; window._prDoneSecAgora=0; _desAutoFeito={}; isPlaying=false; pausedElapsed=0; blockStartTime=null; inSegTransition=false;
  liveStartTime=performance.now();
  iniciarWS();
  startWPP();
  
  // Focar a janela para capturar teclas
  setTimeout(function(){ 
    var lc=document.getElementById('liveClass');
    if(lc) lc.focus();
  }, 100);

  const cn=document.getElementById("className").value;
  if(liveClassName) liveClassName.textContent=cn||"";

  // vídeo
  if(videoSource==="camera"){
    try{
      cameraStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1920},height:{ideal:1080},facingMode:"user"},audio:false});
      cameraLive.srcObject=cameraStream; cameraLive.style.display="block";
      backgroundVideo.style.display="none"; liveBadge.style.display="flex";
    }catch(e){ alert("Câmera não acessível: "+e.message); liveClass.style.display="none"; return; }
  } else if(bgActiveMode==='camera'&&cameraStream){
    // Câmera iniciada via Sessão Livre bgPicker — stream já ativo, só exibir
    cameraLive.srcObject=cameraStream; cameraLive.style.display="block";
    backgroundVideo.style.display="none"; liveBadge.style.display="flex";
  } else {
    cameraLive.style.display="none"; liveBadge.style.display="none";

    // ── ENDERECO DO VIDEO RECRIADO NA HORA ─────────────────────
    // O endereco temporario (blob:) era criado quando a aula era CONFIGURADA e
    // usado so quando ela COMECAVA, minutos depois. Com o arquivo num pendrive,
    // basta o Windows re-enumerar a unidade nesse intervalo para o endereco
    // apontar para o vazio — e o video falha com ERR_REQUEST_RANGE_NOT_SATISFIABLE
    // e "no supported sources", que foi o que aconteceu no teste de 17/09.
    // Aqui o endereco e refeito a partir do arquivo, no instante de usar.
    try{
      // a referencia pode vir da janela de escolha OU da varredura automatica
      // do pendrive (caminho do .prorider), que e o caso mais comum na academia
      // endereco fixo nao precisa ser refeito
      if(typeof videoObjectUrl!=='undefined' && videoObjectUrl && videoObjectUrl.indexOf('blob:')!==0) throw 'fixo';
      var _vh = (typeof _bgSelVideoItem!=='undefined' && _bgSelVideoItem && _bgSelVideoItem.handle)
                ? _bgSelVideoItem.handle : (window._prVideoHandle || null);
      if(_vh && _vh.getFile){
        // com limite: referencia morta pode nao responder, e a aula nao pode
        // ficar pendurada esperando por ela
        var _vf = await Promise.race([
          _vh.getFile(),
          new Promise(function(r){ setTimeout(function(){ r(null); }, 4000); })
        ]);
        if(_vf === null) console.error('[ProRider] a leitura do arquivo de VIDEO nao respondeu em 4s — seguindo sem trocar o endereco.');
        // ARQUIVO VAZIO = referencia velha. Acontece quando a autorizacao da
        // pasta foi guardada numa sessao anterior e a unidade saiu, trocou de
        // letra ou o programa foi reinstalado: o arquivo "existe" e vem com 0
        // bytes. Trocar o endereco bom por um vazio so piora — entao nao troca.
        if(_vf && _vf.size > 0){
          var _vAntigo = videoObjectUrl;
          videoObjectUrl = URL.createObjectURL(_vf);
          if(_vAntigo){ try{ URL.revokeObjectURL(_vAntigo); }catch(e){} }
          console.log('[ProRider] endereco do video refeito na hora de iniciar ('+_vf.size+' bytes).');
        } else {
          console.error('[ProRider] o arquivo de VIDEO veio com 0 bytes. A autorizacao da pasta '
            + 'esta velha (a unidade saiu, mudou de letra ou o programa foi reinstalado). '
            + 'Solucao: voltar a tela de escolha do pendrive e SELECIONAR A PASTA DE NOVO.');
          try{ if(typeof _parToast==='function') _parToast('Arquivo de video inacessivel — escolher a pasta do pendrive de novo'); }catch(e){}
        }
      }
    }catch(eRefaz){
      // 'fixo' e 'classico' nao sao falhas: sao o codigo avisando que nao ha
      // nada a refazer. So erro de verdade vira console.error.
      if(eRefaz==='fixo' || eRefaz==='classico'){
        if(eRefaz==='fixo') console.log('[ProRider] video ja esta em endereco fixo — nada a refazer.');
      } else {
        console.error('[ProRider] nao consegui reler o arquivo de video do pendrive:', eRefaz);
      }
    }

    if(videoObjectUrl){
      backgroundVideo.style.display="block";
      var _vsp=Math.max(0,calcVideoStartPoint());
      // Se já foi pré-carregado (_preloadVideo fez isso), não recarregar — só dar play
      if(backgroundVideo.src===videoObjectUrl && backgroundVideo.readyState>=3){
        backgroundVideo.currentTime=_vsp; backgroundVideo.play();
      } else {
        backgroundVideo.src=videoObjectUrl; backgroundVideo.load();

        // ── ARRANQUE DO VIDEO — a prova de tela preta ──────────────
        // O codigo antigo so dava play no evento 'canplaythrough'. Esse evento
        // pode simplesmente NUNCA disparar (arquivo longo, codec pesado, leitura
        // do pendrive), e aí nada acontecia: nem play, nem fundo animado, tela
        // preta ate o fim da aula. A protecao tambem so agia se readyState<2,
        // entao um video carregado mas parado passava batido.
        // Agora: qualquer sinal de que da para tocar serve, e no fim ha uma
        // verificacao que olha se o video ANDOU de verdade.
        var _vidArrancou=false;
        function _vidPlay(){
          if(_vidArrancou) return; _vidArrancou=true;
          try{
            backgroundVideo.currentTime=_vsp;
            var pr=backgroundVideo.play();
            if(pr && pr.catch) pr.catch(function(e){
              console.warn('[ProRider] video play() recusado:', e && e.message);
              _vidDesistir('o navegador recusou iniciar o video');
            });
          }catch(e){ _vidDesistir('erro ao iniciar o video'); }
        }
        var _vidDesistiu=false;
        function _vidDesistir(motivo){
          if(_vidDesistiu) return; _vidDesistiu=true;   // um aviso, nao tres
          console.error('[ProRider] VIDEO nao rodou ('+motivo+') — caindo para o fundo animado.');
          try{ backgroundVideo.pause(); }catch(e){}
          try{ backgroundVideo.style.display='none'; }catch(e){}
          try{ universeStartForce(); }catch(e){}
          try{ if(typeof _parToast==='function') _parToast('Video nao rodou — fundo animado no lugar'); }catch(e){}
        }
        backgroundVideo.oncanplaythrough=_vidPlay;
        backgroundVideo.oncanplay      =_vidPlay;
        backgroundVideo.onloadeddata   =_vidPlay;
        backgroundVideo.onerror=function(){ _vidDesistir('o arquivo nao carregou'); };

        clearTimeout(window._vidFallbackT);
        clearTimeout(window._vidConfereT);
        // 3s: se nem chegou a ter dado, forca o arranque assim mesmo
        window._vidFallbackT=setTimeout(function(){ _vidPlay(); },3000);
        // 6s: conferir se ANDOU. Video parado no lugar = tela preta.
        window._vidConfereT=setTimeout(function(){
          try{
            if(backgroundVideo.paused || backgroundVideo.currentTime<=_vsp+0.2){
              _vidDesistir('carregou mas nao avancou');
            }
          }catch(e){}
        },6000);
      }
    }
  }

  // ── ENDERECO DA MUSICA GARANTIDO NA HORA ───────────────────────
  // Duas falhas que davam no mesmo: (1) desde 16/09h a escolha da musica passou
  // a valer na hora e o arquivo carrega DEPOIS — iniciando a aula logo em
  // seguida, o endereco ainda nao existia e a musica nao tocava; (2) com o
  // arquivo no pendrive, um endereco criado minutos antes pode ter morrido,
  // igual ao que acontecia com o video.
  // Refazer o endereco a partir do arquivo resolve os dois.
  try{
    if(typeof mp3ObjectUrl!=='undefined' && mp3ObjectUrl && mp3ObjectUrl.indexOf('blob:')!==0) throw 'fixo';
    var _mh = (typeof _bgSelMusicItem!=='undefined' && _bgSelMusicItem && _bgSelMusicItem.handle)
              ? _bgSelMusicItem.handle : (window._prMusicaHandle || null);
    if(_mh && _mh.getFile){
      var _mf = await Promise.race([
        _mh.getFile(),
        new Promise(function(r){ setTimeout(function(){ r(null); }, 4000); })
      ]);
      if(_mf === null) console.error('[ProRider] a leitura do arquivo de MUSICA nao respondeu em 4s — seguindo sem trocar o endereco.');
      if(_mf && _mf.size > 0){
        var _mAntigo = mp3ObjectUrl;
        mp3ObjectUrl = URL.createObjectURL(_mf);
        if(_mAntigo){ try{ URL.revokeObjectURL(_mAntigo); }catch(e){} }
        console.log('[ProRider] endereco da musica refeito na hora de iniciar ('+_mf.size+' bytes).');
      } else {
        console.error('[ProRider] o arquivo de MUSICA veio com 0 bytes — mesma causa do video: '
          + 'autorizacao da pasta velha. Selecionar a pasta do pendrive de novo.');
      }
    }
  }catch(eM){
    if(eM==='fixo' || eM==='classico'){
      if(eM==='fixo') console.log('[ProRider] musica ja esta em endereco fixo — nada a refazer.');
    } else {
      console.error('[ProRider] nao consegui reler o arquivo de musica:', eM);
    }
  }

  // MP3: apenas pré-carregar (src + load), NÃO dar play ainda — música começa depois do 3-2-1
  if(mp3ObjectUrl && backgroundAudio){
    backgroundAudio.src=mp3ObjectUrl;
    backgroundAudio.currentTime=0;
    backgroundAudio.load();
    backgroundAudio.onerror=function(){
      console.error('[ProRider] MUSICA nao carregou — a aula roda sem som. Conferir o arquivo no pendrive.');
    };
  } else if(typeof _bgSelMusicItem!=='undefined' && _bgSelMusicItem){
    console.error('[ProRider] havia musica escolhida ("'+(_bgSelMusicItem.name||'?')+'") mas o endereco do arquivo nao existe.');
  }

  try{ renderLiveTimeline(); }catch(e){ console.error('[ProRider] falha renderLiveTimeline:',e); }
  try{ updateLiveScreen(0); }catch(e){ console.error('[ProRider] falha updateLiveScreen:',e); }
  try{ updateTotalProgress(0); }catch(e){ console.error('[ProRider] falha updateTotalProgress:',e); }
  try{ updateDualClocks(0,0); }catch(e){ console.error('[ProRider] falha updateDualClocks:',e); }
  try{ updateClockLabels(); }catch(e){ console.error('[ProRider] falha updateClockLabels:',e); }
  try{ showZoneBanner(0); }catch(e){ console.error('[ProRider] falha showZoneBanner:',e); }
  // Inicia fundo canvas no modo escolhido
  if(!videoObjectUrl || videoSource !== 'video') {
    setTimeout(function(){ try{ universeStart(); }catch(e){} }, 100);
  } else {
    universeStop(); // modo vídeo: o vídeo cuida do fundo; se falhar, o fallback (universeStartForce) entra e evita tela preta
  }
  // Inicia demo se não há alunos reais
  if(demoWanted&&!demoOn&&typeof alunosMap!=='undefined'&&Object.keys(alunosMap).length===0) simularAlunos();
  startCountdown(0,()=>{
    try{ _prTopoReset(); }catch(e){}
    isPlaying=true; blockStartTime=performance.now();
    // Música começa AQUI — depois do countdown 3-2-1, sincronizada com o início real da aula
    if(mp3ObjectUrl && backgroundAudio && backgroundAudio.src){
      backgroundAudio.currentTime=0;
      backgroundAudio.play().catch(function(){
        backgroundAudio.oncanplaythrough=function(){
          backgroundAudio.currentTime=0;
          backgroundAudio.play().catch(function(){});
          backgroundAudio.oncanplaythrough=null;
        };
      });
    }
    animationId=requestAnimationFrame(runTimer);
    // Notifica alunos que a aula iniciou
    if(wsProf&&wsProf.readyState===WebSocket.OPEN&&typeof workout!=='undefined'&&workout.length){
      var graficoInicio=workout.map(function(b,i){return{idx:i,z:b.intensity||'z1',dur:b.duration||1,rpmMin:b.rpmMin||80,rpmMax:b.rpmMax||90,ftpMin:b.ftpMin||70,ftpMax:b.ftpMax||90,pos:b.position||'Sentado'};});
      var nomeInicio=(function(){var el=document.getElementById('className');return el?el.value:'ProRider';})();
      window._fimAulaPendente=false;
      wsProf.send(JSON.stringify({tipo:'iniciar_aula',grafico:graficoInicio,blocoIdx:0,nomeAula:nomeInicio}));
    }
  });
});

closeLiveBtn.addEventListener("click",()=>{
  // No modo construtor: só confirmar saída e voltar ao menu
  if(boxMode==='construtor'){
    if(confirm('Sair do construtor? Alterações não salvas serão perdidas.')){
      var h=document.getElementById('boxHeader'),b=document.getElementById('boxBuilder');
      if(h)h.style.display='none';if(b)b.style.display='none';
      closeLiveBtn.style.display='none';
      mostrarEscolha();
    }
    return;
  }
  // No modo live/livre: usar confirmação e mostrar resultados
  if(boxMode==='live'||boxMode==='livre'){ ctrlAskConfirm(); return; }
  liveClass.style.display="none"; closeLiveBtn.style.display='none'; stopEverything(); hideBanner();
  endScreen.classList.remove("show");
  if(cameraStream){ cameraStream.getTracks().forEach(t=>t.stop()); cameraStream=null; }
  cameraLive.srcObject=null; cameraLive.style.display="none";
  backgroundVideo.pause(); backgroundVideo.removeAttribute("src"); backgroundVideo.style.display="none";
  if(backgroundAudio){ backgroundAudio.pause(); backgroundAudio.removeAttribute("src"); }
  liveBadge.style.display="none"; liveBottomGradient.classList.remove("hidden");
});
// ══════════════════════════════════════════════════════════════
// FIM DE AULA — navegação dos botões (GYM: ranking+início+repetir / BUILDER: início+repetir)
// ══════════════════════════════════════════════════════════════
var _endFoco = 0;
var _endUnlockedAt = 0;

function _endGetOpcoes(){
  return APP_MODE==='gym' ? ['ranking','inicio','repetir'] : ['inicio','repetir'];
}
function _endFocarBtns(){
  _endGetOpcoes().forEach(function(op,i){
    var b=document.getElementById('endBtn_'+op);
    if(b) b.classList.toggle('focused',i===_endFoco);
    var b2=document.getElementById('fimBtn_'+op);   // 26/09d: tela nova
    if(b2) b2.classList.toggle('fim-foco',i===_endFoco);
  });
}
function _endNavegar(d){
  var n=_endGetOpcoes().length;
  _endFoco=(_endFoco+d+n)%n;
  _endFocarBtns();
}
function _endConfirmar(){
  if(Date.now()<_endUnlockedAt) return;
  var op=_endGetOpcoes()[_endFoco];
  if(op==='ranking') endAcaoRanking();
  else if(op==='inicio') endAcaoVoltar();
  else endAcaoRepetir();
}

// ── FIT DA TELA DE FIM DE AULA ───────────────────────────────
// O conteudo e desenhado num "canvas de projeto" de largura fixa (designW)
// e depois recebe zoom para PREENCHER a TV — cresce quando sobra espaco e
// encolhe quando falta. Usa `zoom` (nao `transform`) porque o zoom reflui o
// layout, entao nao sobra buraco em volta.
// Os botoes e o hint levam contra-zoom (1/k): os DADOS crescem, os botoes nao.
var _END_FIT_W = 2360;
function _endFit(designW){
  var ec=document.getElementById('endContent');
  var es=document.getElementById('endScreen');
  if(!ec||!es) return;
  if(designW) _END_FIT_W=designW;
  try{
    // 1) medir sempre em escala natural
    ec.style.zoom=1;
    ec.style.transform='none';
    ec.style.width=_END_FIT_W+'px';
    var acts=document.getElementById('endActions');
    var hint=document.getElementById('endHint');
    if(acts) acts.style.zoom=1;
    if(hint) hint.style.zoom=1;

    // largura = o canvas de projeto. NAO usar scrollWidth: se algum filho
    // transbordar, o fator sai errado e o conteudo some para fora da tela.
    var w=_END_FIT_W;
    var h=ec.scrollHeight || 1;
    var vw=es.clientWidth  || window.innerWidth;
    var vh=es.clientHeight || window.innerHeight;

    // 2) fator que preenche a tela (0.98 = respiro nas bordas)
    var k=Math.min((vw*0.98)/w, (vh*0.98)/h);
    if(!isFinite(k)||k<=0) k=1;
    k=Math.max(0.35, Math.min(k, 2.6));

    ec.style.zoom=k;

    // 3) botoes ficam do mesmo tamanho fisico
    if(k>1){
      var inv=1/k;
      if(acts) acts.style.zoom=inv;
      if(hint) hint.style.zoom=inv;
    }
  }catch(e){ console.warn('[ProRider] _endFit:',e); }
}
// Reajusta se a resolucao da TV mudar
window.addEventListener('resize', function(){
  var es=document.getElementById('endScreen');
  if(es&&es.classList.contains('show')) _endFit();
});

// ── RANQUEAMENTO ─────────────────────────────────────────────
function endAcaoRanking(){
  // 26/09d: tela nova do ranking (padrao dos desafios)
  if(document.getElementById('fimNovo')){ _fimNovoRanking(); return; }
  var ec=document.getElementById('endContent');
  if(!ec){ resetCompleto(); return; }

  var scores=typeof wppScores!=='undefined'?wppScores:{};
  var stats=typeof alunoStats!=='undefined'?alunoStats:{};

  var arr=Object.keys(scores).map(function(n){
    var s=stats[n]||{};
    var ticks=s.ticks||1;
    return {
      nome:n,
      wpp:scores[n]||0,
      rpm:ticks>0?Math.round((s.rpmSum||0)/ticks):0,
      watts:ticks>0?Math.round((s.wattsSum||0)/ticks):0
    };
  }).sort(function(a,b){return b.wpp-a.wpp;});

  var COLORS=['#d4a017','#8a8a8a','#a0522d'];
  var BG=['rgba(212,160,23,.15)','rgba(138,138,138,.12)','rgba(160,82,45,.12)'];

  function inits(n){
    var p=n.trim().split(/\s+/);
    return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():n.substring(0,2).toUpperCase();
  }

  function podCard(a,rank,lg){
    var c=COLORS[rank]||'rgba(255,255,255,.3)';
    var bg=BG[rank]||'rgba(255,255,255,.05)';
    var av=lg?72:56; var nFz=lg?28:22; var wFz=lg?38:28; var mFz=lg?20:16;
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;'
      +'background:'+bg+';border:1.5px solid '+c+';border-radius:16px;padding:'+(lg?'28px 24px':'20px 18px')+';'
      +'flex:'+(lg?'1.2':'1')+';min-width:0;">'
      // A foto do aluno vem antes das iniciais — e ela que se reconhece na tela
      // grande. Sem foto, mantem as iniciais sobre a cor da posicao.
      +(function(){
         var _f=null; try{ _f=(alunosMap[a.nome]||{}).foto||null; }catch(e){}
         if(_f){
           return '<div style="width:'+av+'px;height:'+av+'px;border-radius:50%;flex-shrink:0;'
             +'background-image:url(\''+_f+'\');background-size:cover;background-position:center;'
             +'border:3px solid '+c+';box-shadow:0 0 0 2px rgba(0,0,0,.35);"></div>';
         }
         return '<div style="width:'+av+'px;height:'+av+'px;border-radius:50%;background:'+c+';'
           +'display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;'
           +'font-size:'+(av*.38)+'px;font-weight:900;color:#111;">'+inits(a.nome)+'</div>';
       })()
      +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:'+nFz+'px;font-weight:700;color:#fff;'
        +'text-align:center;word-break:break-word;line-height:1.1;margin-top:4px;">'+a.nome+'</div>'
      +'<div style="font-family:\'Bebas Neue\',sans-serif;font-size:'+wFz+'px;color:'+c+';letter-spacing:1px;">'
        +a.wpp.toFixed(1)+'<span style="font-size:'+(wFz*.45)+'px;color:rgba(255,255,255,.35);margin-left:4px;">pts</span></div>'
      +'<div style="display:flex;gap:16px;margin-top:4px;">'
        +'<div style="text-align:center;">'
          +'<div style="font-size:11px;letter-spacing:1px;color:rgba(255,255,255,.35);font-family:\'Barlow Condensed\',sans-serif;">RPM MÉD</div>'
          +'<div style="font-size:'+mFz+'px;font-weight:700;color:rgba(255,255,255,.85);font-family:\'Barlow Condensed\',sans-serif;">'+a.rpm+'</div>'
        +'</div>'
        +'<div style="text-align:center;">'
          +'<div style="font-size:11px;letter-spacing:1px;color:rgba(255,255,255,.35);font-family:\'Barlow Condensed\',sans-serif;">WATTS MÉD</div>'
          +'<div style="font-size:'+mFz+'px;font-weight:700;color:rgba(255,255,255,.85);font-family:\'Barlow Condensed\',sans-serif;">'+a.watts+'</div>'
        +'</div>'
      +'</div>'
      +'</div>';
  }

  var html='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:42px;letter-spacing:4px;color:#fff;margin-bottom:24px;">🏆 RANQUEAMENTO WPP</div>';

  if(!arr.length){
    html+='<div style="color:rgba(255,255,255,.4);font-size:22px;">Nenhum aluno conectado nesta sessão.</div>';
  } else {
    // Pódio: coluna esquerda=2º, centro=1º (maior), direita=3º
    html+='<div style="display:flex;gap:12px;align-items:flex-end;width:100%;margin-bottom:16px;">';
    var podOrder=[1,0,2]; var podLg=[false,true,false];
    podOrder.forEach(function(rank,col){
      if(arr[rank]) html+=podCard(arr[rank],rank,podLg[col]);
      else html+='<div style="flex:1;"></div>';
    });
    html+='</div>';

    // 4º em diante — grid de cards compactos
    if(arr.length>3){
      html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;width:100%;">';
      arr.slice(3).forEach(function(a,i){
        html+='<div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.05);'
          +'border:0.5px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 14px;">'
          +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:rgba(255,255,255,.3);min-width:30px;">#'+(i+4)+'</div>'
          +(function(){
             var _f2=null; try{ _f2=(alunosMap[a.nome]||{}).foto||null; }catch(e){}
             var _i2=inits(a.nome);
             if(_f2) return '<div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;background-image:url(\''+_f2+'\');background-size:cover;background-position:center;border:2px solid rgba(255,255,255,.2);"></div>';
             return '<div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;'
               +'background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.16);font-family:\'Barlow Condensed\',sans-serif;'
               +'font-weight:900;font-size:15px;color:rgba(255,255,255,.75);">'+_i2+'</div>';
           })()
          +'<div style="flex:1;min-width:0;">'
            +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+a.nome+'</div>'
            +'<div style="font-size:12px;color:rgba(255,255,255,.4);font-family:\'Barlow Condensed\',sans-serif;">'+a.rpm+' RPM · '+a.watts+' W</div>'
          +'</div>'
          +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:900;color:#ea860c;">'
            +a.wpp.toFixed(1)+'<span style="font-size:13px;color:rgba(255,255,255,.3);margin-left:3px;">pts</span></div>'
          +'</div>';
      });
      html+='</div>';
    }
  }

  html+='<div style="margin-top:24px;font-size:15px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.3);text-transform:uppercase;">Qualquer botão → início</div>';
  ec.innerHTML=html;
  // Ranking mantem as proporcoes proprias (canvas de 1200) e tambem preenche a TV
  requestAnimationFrame(function(){ _endFit(1200); });
  _endUnlockedAt=Date.now()+700;
  boxMode='endRanking';
}

// ── INÍCIO ───────────────────────────────────────────────────
function endAcaoVoltar(){
  try{ _endRestaurarLayout(); }catch(e){}
  resetCompleto(); // pendrive é liberado silenciosamente via resetCompleto
}

// ── REPETIR AULA ─────────────────────────────────────────────
function endAcaoRepetir(){
  _endReiniciarMesmaAula();
}

// ── REINICIAR (mantém workout/segments, volta ao QR ou INICIAR) ──
function _endReiniciarMesmaAula(){
  try{ _endRestaurarLayout(); }catch(e){}
  var es=document.getElementById('endScreen');
  if(es) es.classList.remove('show');
  currentBlockIndex=0;
  isPlaying=false;
  pausedElapsed=0;
  if(typeof animationId!=='undefined'&&animationId){cancelAnimationFrame(animationId);animationId=null;}
  stopWPP();
  ctrlScreen=0;
  ['overlayFTP','overlayRPM','overlayQR','overlayRank','overlayFC'].forEach(function(id){
    var e=document.getElementById(id);if(e)e.classList.remove('active');
  });
  encerrarWS();
  var cn=document.getElementById('className');
  var nome=cn?cn.value||cn.textContent||'Aula':'Aula';
  mostrarPreAula({nome:nome},{ok:false,msg:'--'},{ok:false,msg:'--'});
}

// ── LISTENERS dos botões ─────────────────────────────────────
// Precisa ser reaplicavel: quando o layout do fim de aula e restaurado
// (_endRestaurarLayout), os botoes sao elementos NOVOS e perdem os listeners.
function _endLigarBotoes(){
  var rb=document.getElementById('endBtn_ranking');
  var ib=document.getElementById('endBtn_inicio');
  var rep=document.getElementById('endBtn_repetir');
  if(rb  && !rb._pr){  rb._pr=1;  rb.addEventListener('click', endAcaoRanking); }
  if(ib  && !ib._pr){  ib._pr=1;  ib.addEventListener('click', endAcaoVoltar); }
  if(rep && !rep._pr){ rep._pr=1; rep.addEventListener('click', endAcaoRepetir); }
}
_endLigarBotoes();

// ── LAYOUT DO FIM DE AULA — guarda e restaura ────────────────────
// endAcaoRanking() substitui o innerHTML de #endContent pelo ranking. Sem
// restaurar, os elementos das estatisticas (#endStats, #endFullGraph,
// #endZoneDistribution...) somem PARA SEMPRE: na aula seguinte o showEndScreen
// escrevia em elementos inexistentes e a tela abria direto no ranking da aula
// anterior. Era o "encerro a aula e nao aparece o grafico".
var _END_HTML_ORIG=null;
function _endRestaurarLayout(){
  var ec=document.getElementById('endContent'); if(!ec) return;
  var temStats=!!ec.querySelector('#endStats');
  if(_END_HTML_ORIG===null){
    if(temStats) _END_HTML_ORIG=ec.innerHTML;   // primeira vez: guarda o original
    return;
  }
  if(!temStats){
    ec.innerHTML=_END_HTML_ORIG;
    ec.style.zoom=1; ec.style.transform='none';
    _endLigarBotoes();
    console.log('[ProRider] layout do fim de aula restaurado (estava com o ranking).');
  }
}

function stopEverything(){
  isPlaying=false;
  if(animationId){ cancelAnimationFrame(animationId); animationId=null; }
  if(typeof _zoneFlameStop==='function') _zoneFlameStop();
  stopWPP();
  ctrlSetScreen(0);
  // Para video e audio
  try{ if(typeof backgroundVideo!=='undefined'&&backgroundVideo){ backgroundVideo.pause(); } }catch(e){}
  try{ if(typeof backgroundAudio!=='undefined'&&backgroundAudio){ backgroundAudio.pause(); } }catch(e){}
  // Para câmera ao vivo se ativa
  try{ if(typeof cameraStream!=='undefined'&&cameraStream){ cameraStream.getTracks().forEach(function(t){t.stop();}); cameraStream=null; } }catch(e){}
  try{ if(typeof cameraLive!=='undefined'&&cameraLive){ cameraLive.srcObject=null; cameraLive.style.display='none'; } }catch(e){}
  if(bgActiveMode==='camera'){ bgActiveMode='cosmos'; if(typeof uC!=='undefined'&&uC) uC.style.opacity=''; }
  // Para universo animado e fundo externo
  try{ universeStop(); }catch(e){}
  try{ bgParar(); }catch(e){}
  if(inSegTransition){ try{segTransOverlay.classList.remove("show");}catch(e){} inSegTransition=false; try{liveBottomGradient.classList.remove("hidden");}catch(e){} }
}

// ══════════════════════════════════════════
// COUNTDOWN 3-2-1
// ══════════════════════════════════════════
function startCountdown(blockIndex, onComplete){
 try{
  const block=workout[blockIndex];
  var _ciz=(/^z(\d)$/.test(block.intensity))?'zone'+block.intensity[1]:block.intensity;
  const zone=zoneInfo[_ciz]||zoneInfo['zone1'];
  countdownNumber.style.color=zone.color;
  countdownZoneName.textContent=zone.name; countdownZoneName.style.color=zone.color;
  countdownOverlay.classList.add("show");
  let count=3; countdownNumber.textContent=count; try{playZoneBeep(zone,0.2);}catch(e){}
  const iv=setInterval(()=>{
    count--;
    if(count>0){ countdownNumber.textContent=count; try{playZoneBeep(zone,0.2);}catch(e){} }
    else { clearInterval(iv); countdownOverlay.classList.remove("show"); if(onComplete) onComplete(); }
  },1000);
 }catch(err){
  console.error('[ProRider] falha no countdown (iniciando aula mesmo assim):',err);
  try{ countdownOverlay.classList.remove("show"); }catch(e){}
  if(onComplete) onComplete();
 }
}

// ══════════════════════════════════════════
// LOOP PRINCIPAL
// ══════════════════════════════════════════
function runTimer(timestamp){
  if(!isPlaying) return;
  const cb=workout[currentBlockIndex];
  const totalMs=_prSec(cb)*1000;
  const elapsed=timestamp-blockStartTime;
  pausedElapsed=elapsed;
  let progress=Math.min(elapsed/totalMs,1);

  // overlay segmento: atualiza timer com tempo restante do bloco
  if(inSegTransition){
    const elapsedSec=elapsed/1000;
    const overlayDur=Math.min(20,_prSec(cb));
    const blockRemaining=Math.max(0,_prSec(cb)-elapsedSec);
    stBlockTimer.textContent=formatTime(Math.ceil(blockRemaining));
    if(elapsedSec>=overlayDur){ segTransOverlay.classList.remove("show"); liveBottomGradient.classList.remove("hidden"); inSegTransition=false; }
  }

  if(progress>=1){
    // Excesso de tempo alem do bloco. Antes era DESCARTADO (blockStartTime=timestamp),
    // entao ao voltar de minimizado — quando a aba fica minutos sem frames — a aula
    // andava so UM bloco por frame e o relogio ficava atrasado em relacao ao tempo real,
    // enquanto o MP3 seguia tocando. Agora a sobra e consumida bloco a bloco.
    var _sobraMs = elapsed - totalMs;
    var _pulou = 0;
    while(_sobraMs > 0 && (currentBlockIndex+1) < workout.length){
      var _durProx = _prSec(workout[currentBlockIndex+1])*1000;
      if(_sobraMs < _durProx) break;
      _sobraMs -= _durProx; currentBlockIndex++; _pulou++;
    }
    if(_pulou) console.log('[ProRider] recuperou '+_pulou+' bloco(s) de tempo parado (aba minimizada).');
    // Vigia do bloco atual: se ele ANDAR PARA TRAS em algum momento, o Console
    // registra na hora, com quem estava antes e quem ficou. E o suspeito
    // principal da repeticao da tela relatada em 19/09.
    try{
      if(window._pgUltBloco!=null && currentBlockIndex < window._pgUltBloco){
        console.error('[pg2] BLOCO RECUOU: '+window._pgUltBloco+' -> '+currentBlockIndex
          + ' | aula '+Math.round(elapsed/1000)+'s. Isto nao deveria acontecer numa aula a correr.');
      }
      window._pgUltBloco=currentBlockIndex;
    }catch(_e){}
    const ni=currentBlockIndex+1;
    if(ni>=workout.length){
      currentBlockIndex=workout.length-1;
      try{updateLiveScreen(1);}catch(e){}
      try{updateTotalProgress(1);}catch(e){}
      try{updateDualClocks(0,0);}catch(e){}
      isPlaying=false; if(animationId){cancelAnimationFrame(animationId);animationId=null;}
      try{stopEverything();}catch(e){console.error('[ProRider] stopEverything:',e);}
      try{showEndScreen();}catch(e){
        console.error('[ProRider] showEndScreen:',e);
        boxMode='end';
        var _fes=document.getElementById('endScreen'); if(_fes) _fes.classList.add('show');
        var _fea=document.getElementById('endActions'); if(_fea) _fea.style.display='flex';
        try{encerrarWS();}catch(e2){}
      }
      return;
    }
    const curSegId=workout[currentBlockIndex].segmentId;
    const nxtSegId=workout[ni].segmentId;
    // blockStartTime recua a sobra: o relogio da aula passa a seguir o tempo real
    currentBlockIndex=ni; pausedElapsed=Math.max(0,_sobraMs); blockStartTime=timestamp-Math.max(0,_sobraMs); progress=0;
    // 03/10a: a tela de transição entra cobrindo tudo (CSS) — o gráfico se redesenha por baixo, sem aparecer
    if(nxtSegId!==curSegId){ startSegOverlay(ni); renderLiveTimeline(); }
    else { showTransition(currentBlockIndex); }
    showZoneBanner(currentBlockIndex);
  }

  updateLiveScreen(progress);
  _desAutoTick(progress);
  const totalSec=_prSecTotal(workout);
  const doneSec=calcDoneSec(progress);
  window._prDoneSecAgora=doneSec; // 26/09b: a agulha do perfil (tela do QR) le daqui
  updateTotalProgress(doneSec/totalSec);
  var _segRem=calcSegRemaining(workout[currentBlockIndex].segmentId,progress);
  var _totRem=Math.max(0,totalSec-doneSec);
  updateDualClocks(_segRem,_totRem);
  // A faixa do gráfico novo é atualizada DEPOIS dos relógios e recebe os valores
  // já calculados. Antes ela era chamada de dentro do updateLiveScreen(), que roda
  // ANTES do updateDualClocks() — lia o texto do frame anterior e parecia congelada.
  try{ _pg2InfoAtualiza(_segRem,_totRem); }catch(e){}
  // Broadcast para alunos a cada ~1s
  if(!runTimer._lastBroadcast||timestamp-runTimer._lastBroadcast>1000){
    runTimer._lastBroadcast=timestamp;
    var cb2=workout[currentBlockIndex];
    var nb2=workout[currentBlockIndex+1]||null;
    var segRest2=calcSegRemaining(workout[currentBlockIndex].segmentId,progress);
    wsBroadcast(cb2, segRest2, doneSec, nb2, Math.max(0,totalSec-doneSec), _prSec(cb2)*(1-progress));
  }
  // mini gráfico da aula no topo das telas de dados
  try{ _prMiniGrafUpdate(doneSec); }catch(e){}
  // vídeo e MP3 ancorados no doneSec (e retomados se tiverem parado)
  _prMidiaSync(doneSec, 1.0);
  animationId=requestAnimationFrame(runTimer);
}

function calcDoneSec(progress){ return _prSecTotal(workout.slice(0,currentBlockIndex))+_prSec(workout[currentBlockIndex])*progress; }
function calcSegRemaining(segId,progress){
  const sb=workout.filter(b=>b.segmentId===segId);
  const total=_prSecTotal(sb);
  const done=_prSecTotal(sb.filter(b=>workout.indexOf(b)<currentBlockIndex))+_prSec(workout[currentBlockIndex])*progress;
  return Math.max(0,total-done);
}

// ══════════════════════════════════════════
// OVERLAY SEGMENTO
// ══════════════════════════════════════════
function startSegOverlay(blockIndex){
  inSegTransition=true;
  const seg=segmentById(workout[blockIndex].segmentId);
  const zone=zi(workout[blockIndex].intensity);
  const overlayDur=Math.min(20,_prSec(workout[blockIndex]));
  stSegmentName.textContent=seg?seg.name:""; stSegmentName.style.color=zone.color;
  stBlockTimer.textContent=formatTime(Math.ceil(overlayDur)); stBlockTimer.style.color=zone.color;
  buildSegGraph(workout[blockIndex].segmentId);
  segTransOverlay.classList.add("show");
  liveBottomGradient.classList.add("hidden");
  updateClockLabels();
}
function buildSegGraph(segId){
  stGraph.innerHTML=""; stGraphTimes.innerHTML="";
  // altura por ZONA (a partir do número da intensidade: z1..z7 ou zone1..zone7)
  function _stBarH(it){ var n=parseInt(String(it).replace(/[^0-9]/g,''))||1; var hs={1:60,2:95,3:130,4:165,5:200,6:230,7:255}; return hs[n]||60; }
  workout.filter(b=>b.segmentId===segId).forEach(block=>{
    const z=zi(block.intensity);
    const bar=document.createElement("div");
    bar.className=`stBar ${block.intensity}`+(/em\s*p|standing/i.test(String(block.position||""))?" standing":"");
    bar.style.cssText=`--c:${z.color};--fill:${z.fill};--glow:${z.glow};height:${_stBarH(block.intensity)}px;`;
    bar.innerHTML=`<span class="stBarLabel">${z.ftp}</span>`;
    stGraph.appendChild(bar);
    // (tempos removidos: blocos picotados em segundos poluíam a tela)
  });
}

// ── RELÓGIOS ──
function updateDualClocks(segRem,totalRem){ if(clockElapsedVal) clockElapsedVal.textContent=formatTime(Math.ceil(segRem)); if(clockRemainingVal) clockRemainingVal.textContent=formatTime(Math.ceil(totalRem)); }
function updateClockLabels(){ const seg=segmentById(workout[currentBlockIndex]?.segmentId); if(clockElapsedLbl) clockElapsedLbl.textContent=seg?seg.name:"Segmento"; }

// ── BANNER ZONA ──
function showZoneBanner(idx){
  const block=workout[idx];
  var _siz=(/^z(\d)$/.test(block.intensity))?'zone'+block.intensity[1]:block.intensity;
  const zone=zoneInfo[_siz]||zoneInfo['zone1'];
  currentZoneLabel.textContent=zone.name; currentZoneLabel.style.color=zone.color;
  const modeLabel = intensityMode==="hr" ? zone.fcFull+" FC"
                  : intensityMode==="pse" ? "PSE "+zone.pse+" — "+zone.pseFull
                  : zone.ftpFull+" FTP";
  currentZoneFTP.textContent=modeLabel;
  currentZoneBanner.classList.add("visible");
  // Chama anaeróbica: Z6/Z7 acende, demais apagam
  var _zNum=parseInt((_siz||'zone1').replace('zone',''),10);
  if(_zNum>=6){ if(typeof _zoneFlameStart==='function') _zoneFlameStart(_zNum); }
  else { if(typeof _zoneFlameStop==='function') _zoneFlameStop(); }
  // Atualiza cor e velocidade do fundo animado
  if(typeof universeSetZone === 'function') universeSetZone(zone.color);
  const ms=Math.min(5000,_prSec(block)*1000);
  if(bannerTimeout) clearTimeout(bannerTimeout);
  bannerTimeout=setTimeout(hideBanner,ms);
}
function hideBanner(){ currentZoneBanner.classList.remove("visible"); if(bannerTimeout){ clearTimeout(bannerTimeout); bannerTimeout=null; } }

// ══════════════════════════════════════════════════════════════
// CHAMA ANAERÓBICA — canvas pequeno acima do card de zona (Z6/Z7)
// ══════════════════════════════════════════════════════════════
(function(){
  var fc=null,fctx=null,fraf=null,fRunning=false,fT=0;
  var fParticles=[];
  var FLAME_ZONE=null; // 6 ou 7

  var COLORS={
    6:{ core:[[255,80,0],[255,130,0],[255,40,0]], ember:[255,200,50] },
    7:{ core:[[200,100,255],[255,220,255],[100,180,255]], ember:[255,255,255] }
  };

  function FP(W,H,z){
    var pal=COLORS[z]||COLORS[6];
    var c=pal.core[Math.floor(Math.random()*pal.core.length)];
    this.r=c[0];this.g=c[1];this.b=c[2];
    // nasce na base central com dispersão horizontal
    this.x=W/2+(Math.random()-0.5)*W*0.55;
    this.y=H;
    this.vx=(Math.random()-0.5)*0.7;
    this.vy=-(1.2+Math.random()*2.0);
    this.life=0.8+Math.random()*0.5;
    this.decay=0.016+Math.random()*0.012;
    this.size=6+Math.random()*10;
    this.phase=Math.random()*Math.PI*2;
    this.isEmber=(Math.random()<0.18);
    if(this.isEmber){
      this.r=pal.ember[0];this.g=pal.ember[1];this.b=pal.ember[2];
      this.size=1.5+Math.random()*2;
      this.vy=-(2.5+Math.random()*2.5);
      this.decay=0.022+Math.random()*0.01;
    }
  }
  FP.prototype.tick=function(t){
    this.vx+=Math.sin(t*2.4+this.phase)*0.035;
    this.x+=this.vx; this.y+=this.vy;
    this.vx*=0.97;
    this.life-=this.decay;
  };
  FP.prototype.draw=function(ctx){
    if(this.life<=0)return;
    var a=Math.max(0,this.life);
    if(this.isEmber){
      ctx.save();
      ctx.shadowBlur=6; ctx.shadowColor='rgba('+this.r+','+this.g+','+this.b+',0.9)';
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
      ctx.fillStyle='rgba('+this.r+','+this.g+','+this.b+','+Math.min(1,a)+')';
      ctx.fill(); ctx.restore();
    } else {
      var grd=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.size);
      var cr=Math.min(255,this.r+50),cg=Math.min(255,this.g+50),cb=Math.min(255,this.b+30);
      grd.addColorStop(0,'rgba('+cr+','+cg+','+cb+','+Math.min(0.9,a*0.85)+')');
      grd.addColorStop(0.4,'rgba('+this.r+','+this.g+','+this.b+','+Math.min(0.55,a*0.5)+')');
      grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
      ctx.fillStyle=grd; ctx.fill();
    }
  };

  function _loop(){
    if(!fRunning)return;
    fT+=0.016; fraf=requestAnimationFrame(_loop);
    var W=fc.width,H=fc.height;
    fctx.clearRect(0,0,W,H);
    // spawn 2-3 partículas por frame
    var n=2+(FLAME_ZONE===7?1:0);
    for(var i=0;i<n;i++) if(fParticles.length<80) fParticles.push(new FP(W,H,FLAME_ZONE));
    fParticles=fParticles.filter(function(p){return p.life>0;});
    fParticles.forEach(function(p){p.tick(fT);p.draw(fctx);});
  }

  function _posicionar(){
    var nb=document.getElementById('nextBlock');
    if(!nb||!fc)return;
    var r=nb.getBoundingClientRect();
    var W=Math.round(r.width*0.42); // largura = ~42% do card (acima do card de zona)
    var H=70;
    fc.width=W; fc.height=H;
    fc.style.width=W+'px'; fc.style.height=H+'px';
    fc.style.left=Math.round(r.left)+'px';
    fc.style.top=Math.round(r.top-H+4)+'px'; // 4px de overlap para ligar visualmente
  }

  window._zoneFlameStart=function(zoneNum){
    fc=document.getElementById('zoneFlameCanvas');
    if(!fc)return;
    FLAME_ZONE=zoneNum; fParticles=[];
    fctx=fc.getContext('2d');
    _posicionar();
    fc.style.display='block';
    if(!fRunning){fRunning=true;_loop();}
  };
  window._zoneFlameStop=function(){
    fRunning=false;
    if(fraf){cancelAnimationFrame(fraf);fraf=null;}
    if(fc){fc.style.display='none';}
    fParticles=[];
  };
})();

// ── TRANSIÇÃO BLOCO ──
function showTransition(idx){ const block=workout[idx]; const zone=zi(block.intensity); transitionZoneEl.textContent=zone.name; transitionZoneEl.style.color=zone.color; transitionSubEl.textContent=/em\s*p|standing/i.test(String(block.position||''))?"EM PÉ":"SENTADO"; transitionOverlay.classList.add("show"); playZoneBeep(zone,0.35); if(transitionTimeout) clearTimeout(transitionTimeout); transitionTimeout=setTimeout(()=>transitionOverlay.classList.remove("show"),2000); }

function playZoneBeep(zone,vol=0.35){
  try{ const ctx=new(window.AudioContext||window.webkitAudioContext)(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type=zone.beepType||"sine"; osc.frequency.value=zone.beepHz||880; gain.gain.setValueAtTime(vol,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.45); osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.45); }catch(e){}
}

// ── LIVE TIMELINE ──
// ══════════════════════════════════════════════════════════════
// GRÁFICO 2 — cartões por bloco (LB alterna com o gráfico de barras)
// Mesma abrangência do gráfico atual: os blocos do SEGMENTO em curso.
// Largura proporcional ao tempo com PISO (--pg2min): bloco curto engorda
// para continuar visível. Como isso deixa a escala não-linear, a agulha
// NÃO pode sair de tempo/total — ela é posicionada dentro do cartão real,
// medido. Assim ela nunca aponta o bloco errado; só anda mais devagar
// nos blocos curtos, que é justamente onde o professor precisa olhar.
// ══════════════════════════════════════════════════════════════
// 0 = barras (gráfico antigo) · 1 = cartões
// A UNIDADE DE TELA É O SEGMENTO. Nada de paginar por tempo: página cortava
// bloco no meio (um pedaço numa tela, o resto na seguinte). O segmento é o
// recorte que o professor já pensa — aquecimento, principal, volta à calma —
// e se ele quiser encurtar a tela, divide o principal em dois no construtor.
// 26/09c: o grafico antigo (barras) foi DESATIVADO — decisao do Mario. So o
// grafico novo (cartoes); LB nao alterna mais.
var PG2_MODO = 1;
var PG2_ON = PG2_MODO>0;
function _pg2Mix(hex,alvo,p){
  var n=parseInt(String(hex).replace('#',''),16),r=n>>16,g=(n>>8)&255,b=n&255;
  return 'rgb('+Math.round(r+(alvo-r)*p)+','+Math.round(g+(alvo-g)*p)+','+Math.round(b+(alvo-b)*p)+')';
}
// ══ ESCALA AUTOMATICA DA ALTURA ═══════════════════════════════
// A regua do grafico ia sempre de z1 a z7. Numa aula que so usa z1 e z2 — um
// endurance de marcha pesada, por exemplo, onde o esforco vem da cadencia e nao
// da potencia — os blocos ficavam todos no pe da regua, quase iguais, e a
// diferenca entre esforco e recuperacao sumia da tela.
// Agora a regua se ajusta ao que a aula REALMENTE usa:
//   - aula que percorre muitas zonas  -> regua cheia, como sempre foi;
//   - aula espremida em poucas zonas  -> a regua estica so naquela faixa.
// As CORES nao mudam nunca: z2 continua azul, z5 continua laranja. So a altura
// se adapta, senao a leitura de intensidade por cor deixaria de valer.
// Dentro da faixa usa-se o %FTP do bloco, nao so a zona — e o que separa um
// bloco de 70-75% de um de 61-71%, que caem os dois em z2.
var _pg2EscalaCache = null;

function _pg2PctMeio(b){
  var t=String(b&&b.ftp||''); var ns=t.match(/\d+/g);
  if(ns&&ns.length>=2) return (parseInt(ns[0])+parseInt(ns[1]))/2;
  if(ns&&ns.length===1) return parseInt(ns[0]);
  var zt={z1:45,z2:65,z3:83,z4:98,z5:113,z6:135,z7:170};
  var zk=(typeof toZKey==='function')?toZKey(b&&b.intensity):(b&&b.z);
  return zt[zk]||100;
}

// Calcula a faixa da AULA INTEIRA (nao do segmento), para a regua nao mudar a
// cada virada de tela — isso daria a impressao de que os blocos crescem sozinhos.
function _pg2Escala(){
  var wo=(typeof workout!=='undefined')?workout:[];
  if(!wo.length) return {lo:0,hi:100,auto:false};
  var chave=wo.length+'|'+_pg2PctMeio(wo[0])+'|'+_pg2PctMeio(wo[wo.length-1]);
  if(_pg2EscalaCache && _pg2EscalaCache.chave===chave) return _pg2EscalaCache;

  var lo=1e9, hi=-1e9;
  wo.forEach(function(b){ var p=_pg2PctMeio(b); if(p<lo)lo=p; if(p>hi)hi=p; });
  var amplitude=hi-lo;
  // Regua cheia quando a aula ja usa bem a altura (amplitude larga).
  // 55 pontos percentuais e mais ou menos o salto de z1 ate z5.
  var auto = amplitude>0 && amplitude<55;
  var r={chave:chave, lo:lo, hi:hi, auto:auto};
  _pg2EscalaCache=r;
  return r;
}

function _pg2Altura(zk, bloco){
  var cs=getComputedStyle(document.documentElement);
  var h1=parseFloat(cs.getPropertyValue('--pg2h1'))||3.9;
  var h7=parseFloat(cs.getPropertyValue('--pg2h7'))||8.1;

  var e=_pg2Escala();
  if(e.auto && bloco){
    // Estica a faixa usada entre 35% e 100% da altura: o bloco mais leve da
    // aula continua visivel e o mais forte encosta no teto.
    var p=_pg2PctMeio(bloco);
    var f=(e.hi>e.lo)?((p-e.lo)/(e.hi-e.lo)):0.5;
    return h1+(0.35+0.65*f)*(h7-h1);
  }
  var i=parseInt(String(zk).replace(/\D/g,''),10)||1;
  return h1+(Math.min(7,Math.max(1,i))-1)/6*(h7-h1);
}
// segundos já decorridos DENTRO do segmento atual
function _pg2SegDecorrido(progresso){
  var bl=_pg2Blocos(); if(!bl.length) return 0;
  var k=bl.indexOf(workout[currentBlockIndex]); if(k<0) k=0;
  var t=0; for(var i=0;i<k;i++) t+=_prSec(bl[i]);
  return t+_prSec(bl[k])*Math.max(0,Math.min(1,progresso||0));
}
// Posicao do bloco atual DENTRO do segmento, contada por posicao e nao por
// identidade. O indexOf() que havia aqui comparava referencia de objeto: se o
// construtor duplica um bloco (recuperacao repetida, por exemplo), todas as
// copias sao o MESMO objeto e o indexOf devolvia sempre a primeira. A agulha
// marcava o bloco errado e os mostradores mostravam a intensidade de outro
// ponto da aula.
// ── TRECHO CONTINUO DO SEGMENTO ATUAL ──────────────────────────────
// ERRO ATE 19/09b: _pg2Blocos usava filter() sobre a aula INTEIRA, juntando
// todos os blocos com o mesmo segmentId estivessem onde estivessem. Numa aula
// com segmentos intercalados (main, rec, main, rec, main) isso remontava uma
// lista falsa de blocos "seguidos", e _pg2IdxAtual contava do mesmo jeito.
// Resultado visto na aula de 19/09: a sequencia aparecia repetida, a agulha
// ANDAVA PARA TRAS (segmento com 13:35 restantes mostrava a agulha no fim da
// pagina; com 08:53, de volta ao segundo bloco), a pagina nunca virava de 1/2
// para 2/2 e o ultimo bloco nao chegava a aparecer.
// Agora pegamos apenas o TRECHO CONTINUO que contem o bloco atual: anda para
// tras e para frente a partir de currentBlockIndex enquanto o segmentId for o
// mesmo. O indice passa a ser a posicao real dentro desse trecho.
function _pg2Faixa(){
  var vazio={ini:0,fim:0};
  if(typeof workout==='undefined'||!workout.length) return vazio;
  var ci=currentBlockIndex;
  if(ci<0) ci=0; if(ci>=workout.length) ci=workout.length-1;
  var sid=workout[ci]?workout[ci].segmentId:null;
  var ini=ci; while(ini>0 && workout[ini-1] && workout[ini-1].segmentId===sid) ini--;
  var fim=ci; while(fim+1<workout.length && workout[fim+1] && workout[fim+1].segmentId===sid) fim++;
  return {ini:ini,fim:fim+1};
}
function _pg2IdxAtual(){
  if(typeof workout==='undefined'||!workout.length) return 0;
  var f=_pg2Faixa();
  var k=currentBlockIndex-f.ini;
  return (k<0)?0:k;
}
function _pg2Blocos(){
  if(typeof workout==='undefined'||!workout.length) return [];
  var f=_pg2Faixa();
  return workout.slice(f.ini,f.fim);
}
// ══ PAGINACAO DO GRAFICO ═══════════════════════════════════════
// Regra: o bloco nunca encolhe para caber. Cabe o que cabe; o resto aparece na
// proxima virada de tela, quando a agulha passa do ultimo bloco da pagina.
// Onde cortar: de preferencia logo DEPOIS de um bloco de descanso (z1/z2), para
// a tela seguinte comecar ja na intensidade em vez de abrir no meio de um
// esforco. Se nao houver descanso na parte final da pagina, corta na capacidade
// cheia mesmo.
var PG2_CAP_MIN=6;   // nunca menos que isto por tela, mesmo em tela estreita
// Ultima capacidade medida com largura VALIDA. Guardada porque, quando o
// grafico esta escondido (teste de FTP, desafio, potencia, rotacao, ranking
// abertos por cima), clientWidth vem ZERO — e o codigo antigo devolvia 999,
// que significa "cabe tudo numa pagina so". O grafico era entao recalculado
// sem paginacao e, ao voltar, reparticionado em outro ponto: a sequencia
// aparecia repetida e o ultimo trecho sumia.
// Agora, sem largura valida, devolvemos a ULTIMA capacidade boa — o desenho
// nao muda enquanto a tela esta escondida.
var _pg2CapUltima = 0;
function _pg2Capacidade(){
  var cards=document.getElementById('pg2Cards');
  if(!cards) return _pg2CapUltima || 999;
  var larg=cards.clientWidth||cards.offsetWidth||0;
  if(larg<=0) return _pg2CapUltima || 999;
  var cs=getComputedStyle(document.documentElement);
  var vao=parseFloat(cs.getPropertyValue('--pg2vao'))||6;
  var min=parseFloat(cs.getPropertyValue('--pg2min'))||34;
  _pg2CapUltima = Math.max(PG2_CAP_MIN,Math.floor((larg+vao)/(min+vao)));
  return _pg2CapUltima;
}
function _pg2EhDescanso(b){
  var zk=(typeof toZKey==='function')?toZKey(b.intensity):(b.intensity||'z1');
  return zk==='z1'||zk==='z2';
}
// Devolve { blocos, ini, fim, pagina, paginas, k } — k e o indice do bloco
// atual DENTRO da pagina.
function _pg2Pag(){
  var todos=_pg2Blocos();
  var vazio={blocos:todos,ini:0,fim:todos.length,pagina:1,paginas:1,k:0};
  if(!todos.length) return vazio;
  var cap=_pg2Capacidade();
  if(todos.length<=cap) {
    vazio.k=Math.max(0,Math.min(todos.length-1,_pg2IdxAtual()));
    return vazio;
  }
  var cortes=[], i=0;
  while(i<todos.length){
    var fim=Math.min(todos.length,i+cap);
    if(fim<todos.length){
      // procura o ultimo descanso no terco final da pagina para cortar ali
      var piso=i+Math.max(1,Math.ceil(cap*0.6));
      for(var j=fim-1;j>=piso;j--){
        if(_pg2EhDescanso(todos[j])){ fim=j+1; break; }
      }
    }
    cortes.push([i,fim]);
    i=fim;
  }
  var k=_pg2IdxAtual(); if(k<0||k>=todos.length) k=0;
  var p=0;
  for(var n=0;n<cortes.length;n++){ if(k>=cortes[n][0]&&k<cortes[n][1]){ p=n; break; } }
  return {blocos:todos.slice(cortes[p][0],cortes[p][1]),
          ini:cortes[p][0], fim:cortes[p][1],
          pagina:p+1, paginas:cortes.length, k:k-cortes[p][0]};
}

function _pg2Render(progresso){
  var ga=document.getElementById('graphArea'); if(ga) ga.classList.toggle('g2',!!PG2_ON);
  var raiz=document.getElementById('pg2'); if(raiz) raiz.classList.add('comMapa');
  if(!PG2_ON) return;
  var cards=document.getElementById('pg2Cards'); if(!cards) return;
  cards.style.position='';
  var bl=_pg2Blocos(); if(!bl.length){ cards.innerHTML=''; return; }

  // O bloco mantem SEMPRE a largura padrao. Quando o segmento nao cabe, o
  // grafico vira de tela — ver _pg2Pag().
  var pg=_pg2Pag(); bl=pg.blocos;
  // 23/09e: guarda QUAL pagina esta desenhada. O _pg2Pin compara com a pagina
  // da vez e redesenha quando a aula passa para a pagina seguinte.
  try{ var _fx=_pg2Faixa(); window._pg2Chave=_fx.ini+'|'+_fx.fim+'|'+pg.ini+'|'+pg.fim+'|'+pg.paginas; }catch(_e){}

  // ── DIAGNOSTICO DA REPETICAO (19/09d) ────────────────────────────
  // Nao muda comportamento nenhum: so escreve no Console o que esta sendo
  // desenhado, e so quando MUDA. Serve para apanhar a repeticao relatada por
  // Mario — a tela voltando a mostrar um trecho que ja passou.
  // Registra: bloco atual da aula, segmento, faixa continua do segmento,
  // pagina, e os blocos que estao sendo pintados. Se aparecer a mesma pagina
  // depois de ja ter avancado, ou o tempo da aula andando com a pagina
  // voltando, fica provado aqui.
  try{
    var _f=_pg2Faixa();
    var _est = [currentBlockIndex, _f.ini, _f.fim, pg.pagina, pg.paginas, pg.ini, pg.fim].join('|');
    if(window._pg2EstAnt !== _est){
      var _volt = (window._pg2PagAnt!=null && pg.pagina < window._pg2PagAnt) ? '  <<< PAGINA VOLTOU' : '';
      var _seg = (typeof workout!=='undefined' && workout[currentBlockIndex]) ? workout[currentBlockIndex].segmentId : '?';
      console.log('[pg2] bloco '+currentBlockIndex+' (seg '+_seg+')'
        + ' | faixa do segmento '+_f.ini+'-'+(_f.fim-1)
        + ' | pagina '+pg.pagina+'/'+pg.paginas
        + ' | desenhando blocos '+pg.ini+'-'+(pg.fim-1)+' da faixa'
        + ' | k='+pg.k
        + ' | aula '+(typeof pausedElapsed!=='undefined'?Math.round(pausedElapsed/1000):'?')+'s'
        + _volt);
      window._pg2EstAnt=_est; window._pg2PagAnt=pg.pagina;
    }
  }catch(_e){}

  cards.innerHTML=bl.map(function(b){
    var zk=(typeof toZKey==='function')?toZKey(b.intensity):(b.intensity||'z1');
    var cor=(typeof ZC!=='undefined'&&ZC[zk])?ZC[zk]:'#888';
    var emPe=/em\s*p|standing/i.test(String(b.position||''));
    // EM PE / SENTADO agora e a BORDA DE CIMA, nao mais a letra P/S:
    // em pe = fio claro; sentado = topo na propria cor do bloco (sem detalhe).
    var topo = emPe ? _pg2Mix(cor,255,.78) : _pg2Mix(cor,0,.42);
    // 25/09: largura mais diferenciada pelo tempo — o bloco cresce com a
    // duracao elevada a 1,3 (15 s x 60 s: antes 1:4, agora 1:6). Altura com
    // o piso e o teto 25% maiores (46->58 px, 168->235 px).
    // 26/09b: altura multiplicada por --pg2k (ver _pg2Encaixar): o grafico
    // encolhe so o necessario para caber entre o topo e a base dos circulos.
    return '<div class="pg2c'+(emPe?' pe':'')+'" style="flex:'+Math.pow(Math.max(1,_prSec(b)),1.3).toFixed(1)+' 1 0;height:calc(var(--pg2k,1) * clamp(58px,'+(_pg2Altura(zk,b)*_DESIGN_H/100).toFixed(1)+'px,235px));'
         + 'background:linear-gradient(180deg,'+_pg2Mix(cor,0,.42)+' 0%,'+_pg2Mix(cor,0,.52)+' 55%,'+_pg2Mix(cor,0,.62)+' 100%);'
         + 'border:1px solid '+_pg2Mix(cor,0,.30)+';border-top:var(--pg2borda) solid '+topo+';">'
         + '<i class="pg2v"></i>'+((b.desafio&&b.desafio.tipo)?'<em class="pg2des">'+(_desafioIcons[b.desafio.tipo]||'🏆')+'</em>':'')+'</div>';
  }).join('');
  // rótulos, tempos e pontos alinhados pela medição real dos cartões
  var els=[].slice.call(cards.querySelectorAll('.pg2c'));
  var zl=document.getElementById('pg2Zonas'), ax=document.getElementById('pg2Eixo');
  if(!zl||!ax) return;
  zl.innerHTML='';
  ax.querySelectorAll('.pg2dot').forEach(function(e){e.remove();});
  var gr=[],i=0;
  while(i<bl.length){ var j=i;
    while(j+1<bl.length && toZKey(bl[j+1].intensity)===toZKey(bl[i].intensity)) j++;
    gr.push([i,j]); i=j+1; }
  gr.forEach(function(g){
    var a=els[g[0]], b2=els[g[1]]; if(!a||!b2) return;
    var zk=toZKey(bl[g[0]].intensity), cor=ZC[zk]||'#888';
    var L=a.offsetLeft, W=b2.offsetLeft+b2.offsetWidth-L;
    var d=document.createElement('div'); d.className='pg2z';
    d.style.left=L+'px'; d.style.width=W+'px';
    d.innerHTML='<s style="color:'+cor+'">'+String(zk).toUpperCase()+'</s><i style="background:'+cor+'"></i>';
    zl.appendChild(d);
  });
  els.forEach(function(el,k){
    var L=el.offsetLeft, W=el.offsetWidth;
    el.classList.toggle('mini', W<34);
    var d=document.createElement('span'); d.className='pg2dot'; d.style.left=(L+W/2)+'px'; ax.appendChild(d);
  });
  _pg2SegRotulo();
  // 26/09b: INICIO so quando a tela mostra o comeco da aula; FIM so quando
  // mostra o ultimo bloco da aula (fim do desaquecimento). No meio fica so a
  // seta — pedido do Mario: "ali nao e o fim".
  try{
    var _fxr=_pg2Faixa(), _pa=ax.querySelector('.pg2p.a'), _pz=ax.querySelector('.pg2p.z');
    if(_pa) _pa.textContent = (_fxr.ini+pg.ini===0) ? 'IN\u00cdCIO' : '';
    if(_pz) _pz.textContent = (_fxr.ini+pg.fim>=workout.length) ? 'FIM' : '';
  }catch(_e){}
  _pg2Encaixar();
  _pg2Pin(0);
}

// 26/09b — ENCAIXE ENTRE OS CIRCULOS. Pedido do Mario (foto da TV): o grafico
// passava acima dos dois circulos laterais. Mede o que nao e cartao (nome do
// segmento, zonas, eixo, faixa de informacao), ve quanto sobra entre o topo
// do circulo e a base da faixa de informacao, e encolhe a altura dos cartoes
// (--pg2k) so o necessario. A conta usa o cartao MAIS ALTO possivel (z7), nao
// o da pagina atual: assim a mesma zona tem a mesma altura em todas as telas.
var PG2_SOBE=32;   // px do desenho 1920x1080 que o grafico pode subir acima dos circulos (30/09b)
function _pg2Encaixar(){
  try{
    var raiz=document.getElementById('pg2'), tc=document.getElementById('timerCircle');
    var seg=document.getElementById('pg2SegNome'), zl=document.getElementById('pg2Zonas');
    var cards=document.getElementById('pg2Cards'), info=document.getElementById('pg2Info');
    if(!raiz||!tc||!cards||!info||!zl) return;
    raiz.style.setProperty('--pg2k','1');
    var rc=tc.getBoundingClientRect(); if(!(rc.height>0)) return;
    var topo=zl.getBoundingClientRect().top-24;             // "VOCE ESTA AQUI"
    if(seg && seg.textContent.trim()) topo=Math.min(topo, seg.getBoundingClientRect().top);
    var semInfo = getComputedStyle(info).display==='none';
    var ax=document.getElementById('pg2Eixo');
    var base=semInfo ? (ax?ax.getBoundingClientRect().bottom:cards.getBoundingClientRect().bottom) : info.getBoundingClientRect().bottom;
    var hCards=cards.getBoundingClientRect().height;
    var resto=(base-topo)-hCards;                          // tudo o que nao e cartao
    var cs=getComputedStyle(document.documentElement);
    var h7=parseFloat(cs.getPropertyValue('--pg2h7'))||19.2;
    // 30/09a: altura no desenho 1920x1080 (antes vh da janela: com o zoom da TV
    // o grafico encolhia DUAS vezes — na TV com escala do Windows ficava ~40% menor).
    var hMax=Math.min(235, Math.max(58, h7*_DESIGN_H/100));
    // medidas da tela vem em pixels ja com zoom; converte hMax para a mesma unidade
    var _fz=(cards.offsetHeight>0)?(hCards/cards.offsetHeight):1; if(!(_fz>0.05&&_fz<20)) _fz=1;
    hMax*=_fz;
    // 30/09b (Mario): o grafico pode subir um pouco acima do topo dos circulos
    // (so o nome do segmento e os rotulos das zonas passam dessa linha; os
    // cartoes continuam na faixa dos circulos) -> cartoes ~25% maiores.
    var _sobe=PG2_SOBE*_fz;
    var cabe=(base-(rc.top+6-_sobe))-resto;                // altura livre para o cartao mais alto
    var k;
    if(!semInfo){ k=Math.max(0.45, Math.min(1, cabe/hMax)); window._pg2KVis=k; }
    else { var kv=window._pg2KVis||Math.min(1,cabe/hMax); k=Math.max(0.45, Math.min(kv*1.3, cabe/hMax)); }  // caixas escondidas: +30%, sem sair dos circulos
    raiz.style.setProperty('--pg2k', k.toFixed(3));
    window._pg2K=k;
  }catch(e){}
}
window.addEventListener('resize',function(){ try{ if(typeof PG2_ON!=='undefined'&&PG2_ON) _pg2Render(0); }catch(e){} });

// AGULHA + VÉU. Esta função tinha sido apagada junto com o modo janela: as
// chamadas continuavam lá dentro de try/catch, então falhava em silêncio e a
// agulha nunca saía do lugar. É por isso que o "você está aqui" sumiu.
//
// A posição sai da MEDIÇÃO do cartão real (offsetLeft/offsetWidth), nunca de
// tempo ÷ total: com o piso de largura (--pg2min) os pixels deixam de ser
// proporcionais ao tempo, e a conta direta apontaria o bloco errado.
function _pg2Pin(progressoBloco){
  if(!PG2_ON) return;
  var cards=document.getElementById('pg2Cards'), pin=document.getElementById('pg2Pin');
  var zl=document.getElementById('pg2Zonas'), ax=document.getElementById('pg2Eixo');
  if(!cards||!pin||!zl||!ax) return;
  var pg=_pg2Pag(); var bl=pg.blocos; if(!bl.length) return;
  // 23/09e — GRAFICO ATRASADO/ADIANTADO CONFORME A TELA (item 2.6).
  // Dentro de um mesmo segmento, a troca de pagina so acontecia no desenho
  // quando alguma outra coisa chamava _pg2Render (troca de segmento, troca de
  // tela, resize). Ate la a tela continuava a mostrar os cartoes da pagina
  // ANTERIOR, e a agulha — que ja usava o indice da pagina nova — corria por
  // cima de blocos errados. Ao trocar de tela o grafico era redesenhado e
  // "pulava" para o sitio certo: dai parecer atrasado numa tela e certo noutra.
  // Agora, se a pagina desenhada nao e a da vez, redesenha antes de mover.
  try{
    var _fx=_pg2Faixa(), _ch=_fx.ini+'|'+_fx.fim+'|'+pg.ini+'|'+pg.fim+'|'+pg.paginas;
    if(window._pg2Chave!==_ch && !_pg2Pin._emRender){
      _pg2Pin._emRender=true;
      try{ _pg2Render(progressoBloco); } finally { _pg2Pin._emRender=false; }
    }
  }catch(_e){}
  var els=cards.querySelectorAll('.pg2c'); if(!els.length) return;
  var k=pg.k; if(k<0||k>=els.length) k=0;   // indice DENTRO da pagina
  var el=els[k]; if(!el) return;

  var f=Math.max(0,Math.min(1,progressoBloco||0));
  var L=el.offsetLeft+el.offsetWidth*f;
  pin.style.left=L+'px';
  // 26/09b: medido a partir do topo das zonas (antes ignorava a altura do
  // nome do segmento e o rotulo 'VOCE ESTA AQUI' caia em cima dele).
  var topo=zl.offsetTop;
  pin.style.top=topo+'px';
  pin.style.height=(ax.offsetTop-topo+1)+'px';

  // APAGAMENTO — um veu DENTRO de cada cartao, nunca uma caixa por cima de todos.
  // A versao anterior media a caixa inteira dos cartoes e escurecia o retangulo
  // todo: pegava tambem o vao entre os blocos e o espaco vazio acima dos mais
  // baixos, formando aquela mancha cinza. Agora cada bloco recebe o seu proprio
  // veu, recortado no formato dele (overflow:hidden no cartao), com largura igual
  // ao quanto daquele bloco ja passou. O que esta fora do desenho nao escurece.
  var veuGeral=document.getElementById('pg2Veu');
  if(veuGeral) veuGeral.style.display='none';
  for(var i=0;i<els.length;i++){
    var c=els[i], v=c.querySelector('.pg2v'); if(!v) continue;
    var ini=c.offsetLeft, larg=c.offsetWidth;
    var w = L<=ini ? 0 : (L>=ini+larg ? larg : L-ini);
    v.style.width = w+'px';
  }
}

// Rótulo do segmento em curso (NOME · N de M · duração).
// O mapa da aula inteira saiu: potência/rotação/ranking já mostram a aula toda.
function _pg2SegRotulo(){
  var lb=document.getElementById('pg2SegNome'); if(!lb||!PG2_ON) return;
  if(typeof workout==='undefined'||!workout.length){ lb.textContent=''; return; }
  var sid=workout[currentBlockIndex]?workout[currentBlockIndex].segmentId:null;
  var segs=[]; workout.forEach(function(b){ if(segs.indexOf(b.segmentId)<0) segs.push(b.segmentId); });
  var dur=_prSecTotal(workout.filter(function(b){ return b.segmentId===sid; }));
  var sg=(typeof segmentById==='function')?segmentById(sid):null;
  var _pp=_pg2Pag();
  lb.textContent=((sg&&sg.name)?sg.name:'SEGMENTO')+'  ·  '+(segs.indexOf(sid)+1)+' de '+segs.length
    +'  ·  '+Math.floor(dur/60)+':'+String(Math.round(dur%60)).padStart(2,'0')
    +(_pp.paginas>1?('  ·  TELA '+_pp.pagina+'/'+_pp.paginas):'');
}

// Faixa de informação embaixo do gráfico novo. Lê os MESMOS elementos que
// alimentam as caixas do topo — assim nunca há dois cálculos divergindo.
// Mede a LARGURA REAL do texto (Range), nao scrollWidth: com reticencias o
// Chrome corta por fracao de pixel e o scrollWidth arredondado nao acusa.
function _pg2Cabe(e,base,min){
  try{
    if(!e.clientWidth) return;
    var r=document.createRange(); r.selectNodeContents(e);
    var fs=base; e.style.fontSize=fs+'px';
    var w=r.getBoundingClientRect().width, g=0;
    while(w>e.clientWidth-1 && fs>min && g++<40){ fs-=1; e.style.fontSize=fs+'px'; w=r.getBoundingClientRect().width; }
  }catch(_e){}
}
function _pg2InfoAtualiza(segRem,totRem){
  if(!PG2_ON) return;
  var box=document.getElementById('pg2Info'); if(!box) return;
  function txt(id){ var e=document.getElementById(id); return e?(e.textContent||'').trim():''; }
  function cor(id){ var e=document.getElementById(id); return e?getComputedStyle(e).color:'#fff'; }
  // 25/09: com as caixas 25% maiores, textos longos ("Zone 3 – Tempo",
  // "Sentado") eram cortados com reticencias. Agora a letra diminui so o
  // necessario para caber (piso de 18 px), e so quando o texto muda.
  function set(id,v,c){ var e=document.getElementById(id); if(!e) return; var t=v||'–';
    var mudou=(e.textContent!==t); if(mudou) e.textContent=t;
    // refaz o ajuste quando o texto muda e, 1x por segundo, se ainda estiver
    // cortado (a caixa pode ter sido medida escondida, com largura zero)
    if(e.tagName==='B'){
      var agora=Date.now();
      if(mudou || agora-(e._fitT||0)>1000){ e._fitT=agora; _pg2Cabe(e,29,18); }
    }
    if(c) e.style.color=c; }
  set('pg2iZona', txt('nextZone'), cor('nextZone'));
  var ft=document.getElementById('pg2iFtpTxt'); if(ft) ft.textContent=txt('nextFTPText');
  set('pg2iDur', txt('nextDuration'));
  set('pg2iPos', txt('nextPosition'));
  set('pg2iRpm', txt('nextRPM'));
  set('pg2iFtp', txt('nextFTP'), cor('nextFTP'));
  // relógios: valores recebidos do runTimer (nunca lidos da tela)
  if(segRem!=null) set('pg2iSeg', formatTime(Math.ceil(segRem)));
  if(totRem!=null) set('pg2iTot', formatTime(Math.ceil(totRem)));
}
function pg2Alternar(){
  try{ console.log('[ProRider] grafico antigo desativado (26/09c) — LB nao alterna mais.'); }catch(e){}
  return;
  PG2_MODO=PG2_MODO?0:1;
  PG2_ON=PG2_MODO>0;
  try{ localStorage.setItem('pr_graf2', String(PG2_MODO)); }catch(e){}
  try{ renderLiveTimeline(); }catch(e){}
  try{ _prTopoAplicar(); _pg2InfoAtualiza(); }catch(e){}
  try{ console.log('[ProRider] gráfico: '+(PG2_MODO?'2 cartões (por segmento) — info embaixo':'1 barras — info em cima')); }catch(e){}
}
window.addEventListener('resize',function(){ try{ _pg2T0=-1; _pg2Render(0); }catch(e){} });

function renderLiveTimeline(){
  try{
    requestAnimationFrame(function(){ _pg2Render(0); });
    if(!renderLiveTimeline._log){ renderLiveTimeline._log=1;
      console.log('[ProRider] gráfico ativo: '+(PG2_MODO?'2 cartões (por segmento)':'1 barras')+
                  '  — LB no controle ou tecla G alternam.');
    }
  }catch(e){}
  liveTimelineEl.innerHTML=""; graphTimesEl.innerHTML="";
  const curSegId=workout[currentBlockIndex]?.segmentId;
  const seg=segmentById(curSegId);
  if(liveSegmentLabel) liveSegmentLabel.textContent=seg?seg.name:"";
  workout.filter(b=>b.segmentId===curSegId).forEach(block=>{
    const zone=zi(block.intensity);
    const div=document.createElement("div");
    div.classList.add("liveBlock",block.intensity);
    if(/em\s*p|standing/i.test(String(block.position||""))) div.classList.add("standing");
    div.style.setProperty("--barColor",zone.color);
    div.style.setProperty("--barFill",zone.fill);
    div.style.setProperty("--barGlow",zone.glow);
    div.style.flex=block.duration+" 1 0";
    div.innerHTML=`<div class="liveBlockFill"></div><div class="liveBlockPassed"></div><div class="bar-ftp-label" style="color:${zone.color}">${zone.ftp}</div>`;
    liveTimelineEl.appendChild(div);
    // (tempos dos blocos removidos a pedido)
  });
  updateClockLabels();
}

// ── ATUALIZAR TELA ──
function updateLiveScreen(progress){
  const cb=workout[currentBlockIndex]; const zone=zi(cb.intensity);
  try{ _pg2Pin(progress); }catch(e){}
  const deg=progress*360;
  timerCircle.style.setProperty("--circleColor",zone.color);
  timerCircle.style.setProperty("--circleProgress",`${deg}deg`);
  rpmCircle.style.setProperty("--circleColor",zone.color);
  rpmCircle.style.setProperty("--circleProgress",`${deg}deg`);
  timerText.innerText=formatTime(Math.ceil(_prSec(cb)*(1-progress)));
  rpmText.innerText=`${cb.rpmMin}–${cb.rpmMax}`;
  if(ftpCircleText){
    const lbl = intensityMode==="hr" ? zone.fc+" FC" : intensityMode==="pse" ? "PSE "+zone.pse : zone.ftp+" FTP";
    ftpCircleText.textContent=lbl; ftpCircleText.style.color=zone.color;
  }
  // posição atual no círculo timer
  const posEl=document.getElementById("currentPositionText");
  if(posEl){ posEl.textContent=/em\s*p|standing/i.test(String(cb.position||''))?"EM PÉ":"SENTADO"; posEl.style.color=zone.color; posEl.style.textShadow=`0 0 10px ${zone.glow}`; }

  // CARDS SUPERIORES:
  // Aula livre/sessao → painel oculto por padrão (bike 99 aparece só quando X pressionado via ctrlSetScreen)
  // Aula estruturada/sistema → PRÓXIMO bloco
  const isLivre = (boxMode==='livre'||boxMode==='sessao');
  var nb_el = document.getElementById('nextBlock');
  if(nb_el) nb_el.style.display = isLivre ? 'none' : '';
  if(!isLivre){
    const nb = workout[currentBlockIndex+1];
    var lblEl = document.querySelector('#nextBlock .next-info-wide span');
    if(lblEl) lblEl.textContent = 'PRÓXIMO BLOCO';
    var posBox = nextPositionEl ? nextPositionEl.closest('.next-info') : null;
    if(posBox) posBox.style.display = '';
    if(nb){
      const nz=zi(nb.intensity);
      nextZoneEl.innerText=nz.name; nextZoneEl.style.color=nz.color;
      const ndSec=_prSec(nb); nextDurationEl.innerText=Math.floor(ndSec/60)+':'+(ndSec%60).toString().padStart(2,'0');
      nextPositionEl.innerText=nb.position; nextPositionEl.style.color=/em\s*p|standing/i.test(String(nb.position||""))?"#ff8c0a":"#fff";
      if(nextRPMEl){ nextRPMEl.innerText=`${nb.rpmMin}–${nb.rpmMax}`; nextRPMEl.style.color="#fff"; }
      nextFTPEl.innerText=getZoneLabel(nz); nextFTPEl.style.color=nz.color;
      nextFTPTextEl.innerText=getZoneLabelFull(nz);
    } else {
      nextZoneEl.innerText="Fim da aula"; nextZoneEl.style.color="rgba(255,255,255,.5)";
      nextDurationEl.innerText="–"; nextPositionEl.innerText="–";
      if(nextRPMEl) nextRPMEl.innerText="–";
      nextFTPEl.innerText="–"; nextFTPTextEl.innerText="–";
    }
    // Auto-shrink: reduz a fonte ate o texto caber (ver _prCabeTexto)
    requestAnimationFrame(_prAjustaCaixasTopo);
  }

  // barras do gráfico
  const curSegId=cb.segmentId;
  const segBlocks=workout.filter(b=>b.segmentId===curSegId);
  document.querySelectorAll(".liveBlock").forEach((bar,i)=>{
    const gb=segBlocks[i]; if(!gb) return;
    const gi=workout.indexOf(gb); const passed=bar.querySelector(".liveBlockPassed");
    bar.classList.toggle("active-block",gi===currentBlockIndex);
    if(gi<currentBlockIndex) passed.style.transform="scaleX(1)";
    else if(gi===currentBlockIndex) passed.style.transform=`scaleX(${progress})`;
    else passed.style.transform="scaleX(0)";
  });
}

function updateTotalProgress(ratio){
  const pct=Math.min(100,ratio*100);
  // width em % — gradiente background-size:100vw mantém o gradiente sempre contínuo
  totalProgressFill.style.width=`${pct.toFixed(1)}%`;
  totalProgressText.textContent=`${Math.round(pct)}%`;
}

// ══════════════════════════════════════════
// TELA DE FIM DE AULA
// ══════════════════════════════════════════

// ══ 26/09d — FIM DE AULA NO PADRAO NOVO (aprovado pelo Mario) ════════════
// 1) AULA CONCLUIDA: jornada da aula + tempo por zona | centro | podio WPP.
// 2) RANKING DA AULA (B/ranking): podio + 4o-10o | centro | 11o em diante.
// Tudo em segundos (_prSec) — a tela antiga mostrava "NaN min" quando a aula
// so tinha durationSec.
function _fimDados(){
  var wo=(typeof workout!=='undefined'&&workout)?workout:[];
  var tot=0; wo.forEach(function(b){ tot+=_prSec(b)||0; });
  var cn=''; try{ var cnEl=document.getElementById('className'); cn=(cnEl&&cnEl.value||'').trim();
    if(!cn){ var h=document.getElementById('classNameHeader'); cn=(h?h.textContent:'').trim(); }
    if(!cn){ var p2=document.getElementById('preAulaCardNome'); cn=(p2?p2.textContent:'').trim(); } }catch(e){}
  if(!cn||cn==='—') cn='Aula';
  var snap=window._fimSnap||{}, sc=(typeof wppScores!=='undefined')?wppScores:{}, st=(typeof alunoStats!=='undefined')?alunoStats:{};
  var nomes=Object.keys(sc).filter(function(n){ return !String(n).match(/^Bike \d+$/) || (st[n]&&st[n].ticks>0); });
  var al=nomes.map(function(n){ var t=st[n]||{}, k=t.ticks||0, sn=snap[n]||{};
    return {nome:n, wpp:sc[n]||0, w:k?Math.round((t.wattsSum||0)/k):0, rpm:k?Math.round((t.rpmSum||0)/k):0,
            hr:t.hrTicks?Math.round(t.hrSum/t.hrTicks):0, alvo:k?Math.min(1,(t.tempoZona||0)/(k*0.1)):0,
            kcal:sn.kcal||0, pico:sn.potMax||0, foto:sn.foto||null}; }).sort(function(a,b){ return b.wpp-a.wpp; });
  var zt={}; wo.forEach(function(b){ var z=toZKey(b.intensity); zt[z]=(zt[z]||0)+(_prSec(b)||0); });
  return {wo:wo, tot:tot, cn:cn, al:al, zt:zt};
}
function _fimFmt(sec){ sec=Math.round(sec||0); var h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s2=sec%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s2).padStart(2,'0'); }
function _fimIni(n){ return String(n).trim().split(/\s+/).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase(); }
function _fimLinha(a,pos,cor,max){
  if(!a) return '<div class="dsx-row dsx-vazia"></div>';
  var av=a.foto?'<img src="'+a.foto+'" alt="">':_desEsc(_fimIni(a.nome));
  return '<div class="dsx-row"><div class="dsx-pos">'+pos+'</div><div class="dsx-av" style="border-color:'+cor+';color:'+cor+';">'+av+'</div>'
    +'<div class="dsx-nm"><div class="dsx-nome">'+_desEsc(a.nome)+'</div><i class="dsx-barra"><s style="width:'+(max>0?Math.max(2,a.wpp/max*100):0).toFixed(0)+'%;background:'+cor+'"></s></i></div>'
    +'<div class="dsx-val" style="color:'+cor+'">'+a.wpp.toFixed(1).replace('.',',')+'<small>WPP</small></div></div>';
}
function _fimPodioCol(al){
  var cor='#ea860c', max=al.length?al[0].wpp:0, o=[1,0,2], c=['dsx-pd2','dsx-pd1','dsx-pd3'];
  var pod='<div class="dsx-podio3">'+o.map(function(i,k){ var a=al[i]; if(!a) return '<div class="dsx-pd '+c[k]+' dsx-pdv"></div>';
      var pr=String(a.nome).trim().split(/\s+/), curto=pr[0]+(pr[1]?' '+pr[1][0]+'.':'');
      var av=a.foto?'<img src="'+a.foto+'" alt="">':_desEsc(_fimIni(a.nome));
      return '<div class="dsx-pd '+c[k]+'"><div class="dsx-pd-av" style="border-color:'+cor+';color:'+cor+';">'+av+'</div><div class="dsx-pd-nome">'+_desEsc(curto)+'</div><div class="dsx-pd-val" style="color:'+cor+';">'+a.wpp.toFixed(1).replace('.',',')+'<small>WPP</small></div><div class="dsx-pd-bloco"><b>'+(i+1)+'</b></div></div>'; }).join('')+'</div>';
  var lin=''; for(var i=3;i<10;i++) lin+=_fimLinha(al[i],i+1,cor,max);
  return '<div class="dsx-col" style="--dsxc:#ea860c;"><div class="dsx-colhead"><span class="dsx-sim">🏆</span><span class="dsx-tit">PÓDIO WPP</span><span class="dsx-pag">'+al.length+' alunos</span></div>'+pod
    +'<div class="dsx-lista" style="grid-template-rows:repeat(7,minmax(0,1fr));">'+lin+'</div></div>';
}
function _fimTopo(d){
  var hoje=new Date(), dias=['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];
  return '<div class="dsx-bg dsx-bg-ge"></div><div class="dsx-top"><div class="dsx-logo"><img src="logo-prorider.png" alt="ProRider" style="height:58px;display:block;"></div>'
    +'<div class="dsx-tipo"><b>'+_desEsc(d.cn.toUpperCase())+'</b><i>'+dias[hoje.getDay()]+' '+String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+' · '+d.al.length+' ALUNOS</i></div></div>';
}
function _fimAcoes(){
  var op=_endGetOpcoes(), nomes={ranking:'🏆 RANKING',inicio:'🏠 INÍCIO',repetir:'🔄 REPETIR AULA'};
  return '<div class="fim-acoes">'+op.map(function(o,i){ return '<button id="fimBtn_'+o+'" class="fim-btn'+(i===_endFoco?' fim-foco':'')+'" onclick="_endFoco='+i+';_endConfirmar()">'+nomes[o]+'</button>'; }).join('')+'</div>';
}
function _fimNovoMostrar(){
  var d=_fimDados(), Z=(typeof ZC!=='undefined')?ZC:{};
  var alt={z1:22,z2:36,z3:50,z4:64,z5:78,z6:90,z7:100};
  var x=0, bars=d.wo.map(function(b){ var z=toZKey(b.intensity), sec=_prSec(b)||0, l=d.tot?x/d.tot*100:0, w=d.tot?sec/d.tot*100:0; x+=sec;
    return '<div style="position:absolute;bottom:0;left:'+l.toFixed(3)+'%;width:'+w.toFixed(3)+'%;height:'+(alt[z]||22)+'%;padding:0 1px;box-sizing:border-box;"><div style="height:100%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,'+(Z[z]||'#888')+','+(Z[z]||'#888')+'99);"></div></div>'; }).join('');
  // rotulos dos segmentos na posicao real
  var segs=[], acc=0; (typeof segments!=='undefined'?segments:[]).forEach(function(sg){ var sec=0; d.wo.forEach(function(b){ if(b.segmentId===sg.id) sec+=_prSec(b)||0; }); if(sec>0){ segs.push({n:sg.name,l:acc/d.tot*100,w:sec/d.tot*100}); acc+=sec; } });
  var segH=segs.map(function(sg){ return '<span style="position:absolute;left:'+sg.l.toFixed(2)+'%;width:'+sg.w.toFixed(2)+'%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_desEsc(String(sg.n).toUpperCase())+'</span>'; }).join('');
  var maxZ=0; ['z1','z2','z3','z4','z5','z6','z7'].forEach(function(z){ if((d.zt[z]||0)>maxZ) maxZ=d.zt[z]; });
  var zl=['z1','z2','z3','z4','z5','z6','z7'].filter(function(z){ return d.zt[z]>0||z<'z7'; }).map(function(z){ var sec=d.zt[z]||0;
    return '<div style="display:flex;align-items:center;gap:12px;height:34px;"><span style="width:48px;font-family:\'Bebas Neue\',sans-serif;font-size:24px;color:'+(Z[z]||'#888')+'">'+z.toUpperCase()+'</span><div style="flex:1;height:12px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden;"><div style="height:100%;width:'+(maxZ?sec/maxZ*100:0).toFixed(1)+'%;background:'+(Z[z]||'#888')+';border-radius:6px;"></div></div><span style="width:74px;text-align:right;font-weight:800;font-size:22px;">'+_fimFmt(sec)+'</span></div>'; }).join('');
  // 30/09e (aprovado pelo Mario, tela T5): painel da esquerda novo — grafico mais
  // baixo com a faixa AQUECIMENTO / BLOCO PRINCIPAL / VOLTA e o eixo de minutos,
  // tempo em cada zona maior e os DESTAQUES embaixo. Centro e podio iguais.
  var _fsg={w:0,m:0,c:0}; d.wo.forEach(function(b){ var sid=String(b.segmentId||'main'), sec=_prSec(b)||0; if(/warm|aquec/i.test(sid)) _fsg.w+=sec; else if(/cool|calma|volta/i.test(sid)) _fsg.c+=sec; else _fsg.m+=sec; });
  var _fband='';
  [['AQUECIMENTO',_fsg.w,'#5db13d'],['BLOCO PRINCIPAL',_fsg.m,'#ea860c'],['VOLTA',_fsg.c,'#7fa3ff']].forEach(function(p){ if(p[1]>0) _fband+='<span style="flex:'+p[1]+';color:'+p[2]+';border-bottom:2px solid '+p[2]+';padding-bottom:4px;white-space:nowrap;overflow:hidden;">'+p[0]+'</span>'; });
  var _fmin=Math.round(d.tot/60), _feix=''; for(var _k=0;_k<=4;_k++){ _feix+='<span>'+Math.round(_fmin*_k/4)+'′</span>'; }
  var _fzl=['z1','z2','z3','z4','z5','z6','z7'].filter(function(z){ return d.zt[z]>0||z<'z7'; }).map(function(z){ var sec=d.zt[z]||0;
    return '<div style="display:grid;grid-template-columns:48px 1fr '+(d.tot>=3600?'118px':'88px')+';align-items:center;gap:14px;height:44px;"><span style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;color:'+(Z[z]||'#888')+'">'+z.toUpperCase()+'</span><div style="height:14px;border-radius:7px;background:rgba(255,255,255,.07);overflow:hidden;"><div style="height:100%;width:'+(maxZ?sec/maxZ*100:0).toFixed(1)+'%;background:'+(Z[z]||'#888')+';border-radius:7px;"></div></div><span style="text-align:right;font-family:\'Barlow Condensed\',sans-serif;font-weight:900;font-size:26px;">'+_fimFmt(sec)+'</span></div>'; }).join('');
  var _fAlvo=d.al.slice().sort(function(a,b){return b.alvo-a.alvo;})[0], _fPico=d.al.slice().sort(function(a,b){return b.pico-a.pico;})[0];
  var _fCurto=function(n){ var pr=String(n).trim().split(/\s+/); return pr[0]+(pr[1]?' '+pr[1][0]+'.':''); };
  var _fDest='<div style="margin-top:auto;padding:0 4px;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px;letter-spacing:2px;color:rgba(255,255,255,.5);margin-bottom:10px;">DESTAQUES</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
    +'<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;"><div style="font-size:12px;letter-spacing:1.6px;font-weight:700;color:rgba(255,255,255,.5);">MAIS TEMPO NO ALVO</div><b style="font-size:21px;">'+((_fAlvo&&_fAlvo.alvo>0)?_desEsc(_fCurto(_fAlvo.nome))+' · '+Math.round(_fAlvo.alvo*100)+'%':'—')+'</b></div>'
    +'<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;"><div style="font-size:12px;letter-spacing:1.6px;font-weight:700;color:rgba(255,255,255,.5);">MAIOR PICO</div><b style="font-size:21px;">'+((_fPico&&_fPico.pico>0)?_desEsc(_fCurto(_fPico.nome))+' · '+Math.round(_fPico.pico)+' W':'—')+'</b></div></div></div>';
  var colA='<div class="dsx-col" style="--dsxc:#6b9eff;"><div class="dsx-colhead"><span class="dsx-sim">📈</span><span class="dsx-tit">JORNADA DA AULA</span><span class="dsx-pag">'+_fimFmt(d.tot)+'</span></div>'
    +'<div style="display:flex;gap:4px;margin:8px 4px 0;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:14px;letter-spacing:1.5px;">'+_fband+'</div>'
    +'<div style="position:relative;height:210px;margin:8px 4px 0;">'+bars+'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:14px;color:rgba(255,255,255,.5);margin:6px 4px 0;">'+_feix+'</div>'
    +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px;letter-spacing:2px;color:rgba(255,255,255,.5);margin:22px 4px 4px;">TEMPO EM CADA ZONA</div><div style="padding:0 4px;">'+_fzl+'</div>'
    +_fDest+'</div>';
  var tss=0; try{ tss=calcularTSS(d.wo).tss; }catch(e){}
  var kcalT=d.al.reduce(function(s2,a){ return s2+(a.kcal||0); },0);
  var comW=d.al.filter(function(a){return a.w>0;}), wMed=comW.length?Math.round(comW.reduce(function(s2,a){return s2+a.w;},0)/comW.length):0;
  var comH=d.al.filter(function(a){return a.hr>0;}), hMed=comH.length?Math.round(comH.reduce(function(s2,a){return s2+a.hr;},0)/comH.length):0;
  var noAlvo=d.al.filter(function(a){return a.alvo>=0.5;}).length;
  var centro='<div class="dsx-centro"><div class="dsx-fogo">⚡</div><div class="dsx-h1">AULA <b>CONCLUÍDA</b></div><div class="dsx-h2">PARABÉNS, TURMA!</div>'
    +'<div class="dsx-lider" style="color:#5db13d;">'+(d.al.length?noAlvo+' DE '+d.al.length+' NO ALVO NA MAIOR PARTE':'BOM TREINO!')+'</div>'
    +'<div class="dsx-anel"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#ea860c" stroke-width="5"/><circle cx="50" cy="50" r="39" fill="rgba(6,8,16,.92)" stroke="rgba(255,255,255,.08)"/></svg><div class="dsx-anel-in"><span>⏱</span><b'+(_fimFmt(d.tot).length>=7?' class="dsx-longo"':'')+'>'+_fimFmt(d.tot)+'</b><i>DURAÇÃO</i></div></div>'   // 08/10: aula de 10 h (10:00:00) cabia fora do anel
    +'<div class="dsx-stats"><div><i>⚡</i><b style="color:#ffd23f">'+tss+'<small>TSS</small></b><span>CARGA DA AULA</span></div>'
    +'<div><i>🔥</i><b style="color:#ea860c">'+kcalT.toLocaleString('pt-BR')+'<small>kcal</small></b><span>A TURMA QUEIMOU</span></div>'
    +'<div><i>🚴</i><b>'+(wMed||'—')+'<small>W</small></b><span>POTÊNCIA MÉDIA</span></div>'
    +'<div><i style="color:#ff5d8f">♥</i><b>'+(hMed||'—')+'<small>'+(hMed?'bpm':'')+'</small></b><span>FC MÉDIA</span></div></div>'
    +_fimAcoes()+'</div>';
  var html='<div class="dsx">'+_fimTopo(d)+'<div class="dsx-grid">'+colA+centro+_fimPodioCol(d.al)+'</div><div class="dsx-linha"></div></div>';
  var el=document.getElementById('fimNovo');
  if(!el){ el=document.createElement('div'); el.id='fimNovo'; el.style.cssText='position:fixed;inset:0;z-index:30000;background:#06050c;overflow:hidden;'; document.body.appendChild(el); }
  el.innerHTML=html; _desAjustar(el); _prFade(el);
}
function _fimNovoRanking(){
  var d=_fimDados(), el=document.getElementById('fimNovo'); if(!el) return;
  boxMode='endRanking'; _endUnlockedAt=Date.now()+700;
  var al=d.al, max=al.length?al[0].wpp:0;
  var colB=function(){
    var resto=al.slice(10), pags=Math.max(1,Math.ceil(resto.length/10)), pg=Math.floor(Date.now()/10000)%pags, b0=Math.max(0,Math.min(pg*10,resto.length-10));
    var lin=''; for(var i=0;i<10;i++) lin+=_fimLinha(resto[b0+i],11+b0+i,'#e6c020',max);
    return '<div class="dsx-col" style="--dsxc:#e6c020;"><div class="dsx-colhead"><span class="dsx-sim">🏁</span><span class="dsx-tit">CLASSIFICAÇÃO</span><span class="dsx-pag">'+(resto.length?(11+b0)+'º ao '+(10+b0+Math.min(10,resto.length))+'º':'')+'</span></div><div class="dsx-lista" style="grid-template-rows:repeat(10,minmax(0,1fr));">'+lin+'</div></div>';
  };
  var med=al.length?al.reduce(function(s2,a){return s2+a.wpp;},0)/al.length:0;
  var alvo=al.length?Math.round(al.reduce(function(s2,a){return s2+a.alvo;},0)/al.length*100):0;
  var gk=al.slice().sort(function(a,b){return b.kcal-a.kcal;})[0], pk=al.slice().sort(function(a,b){return b.pico-a.pico;})[0];
  var pn=function(a){ return a?_desEsc(String(a.nome).split(/\s+/)[0].toUpperCase()):''; };
  var v=al[0];
  var montar=function(){
    return '<div class="dsx">'+_fimTopo(d)+'<div class="dsx-grid">'+_fimPodioCol(al)
      +'<div class="dsx-centro"><div class="dsx-fogo">🏆</div><div class="dsx-h1">RANKING <b>DA AULA</b></div><div class="dsx-h2" style="letter-spacing:5px">WORKOUT PERFORMANCE POINTS</div>'
      +'<div class="dsx-lider" style="color:#ffd23f;">'+(v?pn(v)+' VENCEU A AULA':'SEM PARTICIPANTES')+'</div>'
      +'<div class="dsx-anel"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#ffd23f" stroke-width="5"/><circle cx="50" cy="50" r="39" fill="rgba(6,8,16,.92)" stroke="rgba(255,255,255,.08)"/></svg><div class="dsx-anel-in"><span>🥇</span><b>'+(v?v.wpp.toFixed(1).replace('.',','):'—')+'</b><i>WPP DO VENCEDOR</i></div></div>'
      +'<div class="dsx-stats"><div><i>⚡</i><b style="color:#ffd23f">'+med.toFixed(1).replace('.',',')+'<small>WPP</small></b><span>MÉDIA DA TURMA</span></div>'
      +'<div><i>🎯</i><b style="color:#5db13d">'+alvo+'<small>%</small></b><span>TEMPO NO ALVO</span></div>'
      +'<div><i>🔥</i><b style="color:#ea860c">'+(gk&&gk.kcal?gk.kcal:'—')+'<small>kcal</small></b><span>MAIOR GASTO'+(gk&&gk.kcal?' · '+pn(gk):'')+'</span></div>'
      +'<div><i>💥</i><b>'+(pk&&pk.pico?pk.pico:'—')+'<small>W</small></b><span>MAIOR PICO'+(pk&&pk.pico?' · '+pn(pk):'')+'</span></div></div>'
      +'<div class="dsx-nota">WPP = pontos pelo tempo na zona certa · qualquer botão → início</div></div>'
      +colB()+'</div><div class="dsx-linha"></div></div>';
  };
  el.innerHTML=montar(); _desAjustar(el); _prFade(el);
  clearInterval(window._fimRkInt);
  if(al.length>20) window._fimRkInt=setInterval(function(){ var e=document.getElementById('fimNovo'); if(!e||boxMode!=='endRanking'){ clearInterval(window._fimRkInt); return; } _desPintarHTML(e,montar()); },1000);
}
function _fimNovoFechar(){ clearInterval(window._fimRkInt); var e=document.getElementById('fimNovo'); if(e) e.remove(); }
function showEndScreen(){
  // 26/09d: foto da turma ANTES do encerrarWS (que limpa o alunosMap)
  try{ window._fimSnap={}; Object.keys(alunosMap||{}).forEach(function(n){ var a=alunosMap[n]; if(a&&a.nome&&!a._virtual) window._fimSnap[n]={kcal:a.kcal||0,potMax:a.potMax||0,foto:a.foto||null,genero:a.genero}; }); }catch(e){}
  try{ setTimeout(_fimNovoMostrar,0); }catch(e){}
  // Antes de tudo: devolver o layout das estatisticas caso o ranking o tenha
  // substituido numa aula anterior.
  try{ _endRestaurarLayout(); }catch(e){ try{console.error('[ProRider] restaurar layout fim:',e);}catch(_){} }
  // Define modo e mostra o ecrã IMEDIATAMENTE — antes de qualquer lógica que possa falhar
  boxMode='end';
  _endUnlockedAt=Date.now()+700;
  _endFoco=APP_MODE==='gym'?1:0;
  // Garante que liveClass está visível
  var lcEl=document.getElementById('liveClass');
  if(lcEl && lcEl.style.display==='none') lcEl.style.display='flex';
  // MOSTRA O ECRÃ PRIMEIRO — garante que aparece mesmo que os stats falhem
  var _esEl=document.getElementById('endScreen');
  if(_esEl) _esEl.classList.add('show');
  // Botões e foco
  try{
    var _rkEl=document.getElementById('endBtn_ranking'); if(_rkEl) _rkEl.style.display=(APP_MODE==='gym')?'':'none';
    var _acEl=document.getElementById('endActions'); if(_acEl) _acEl.style.display='flex';
    var _hiEl=document.getElementById('endHint'); if(_hiEl) _hiEl.textContent='← → navegar · START confirmar';
    _endFocarBtns();
  }catch(e){}
  // Garante segments existe
  if(typeof segments==='undefined'||!segments||!segments.length){
    try{ segments=[{id:'main_1',name:'Aula',type:'main'}]; }catch(e){}
  }
  // Se workout vazio, ecrã já está visível — encerra WS e sai
  if(typeof workout==='undefined'||!workout||!workout.length){
    try{ encerrarWS(); }catch(e){}
    return;
  }
  try{
  encerrarWS();
  // O campo do construtor pode estar vazio quando a aula foi aberta pela
  // biblioteca ou pela tela de pre-aula — era por isso que a tela final dizia
  // so "AULA". Procura o nome em todos os lugares onde ele aparece.
  const cnEl=document.getElementById("className");
  var cn=(cnEl&&cnEl.value?cnEl.value:"").trim();
  if(!cn){ var _h=document.getElementById("classNameHeader"); cn=(_h?_h.textContent:"").trim(); }
  if(!cn){ var _p=document.getElementById("preAulaCardNome"); cn=(_p?_p.textContent:"").trim(); }
  if(!cn){ var _n=document.getElementById("preAulaNome"); cn=(_n?_n.textContent:"").trim(); }
  if(!cn||cn==="—") cn="Aula";
  const totalMin=workout.reduce((a,b)=>a+b.duration,0);
  const _totR=Math.round(totalMin); const h=Math.floor(_totR/60),m=_totR%60;
  const durStr=h>0?`${h}h ${String(m).padStart(2,"0")}min`:`${m}min`;
  var ecn=document.getElementById("endClassName"); if(ecn) ecn.textContent=cn.toUpperCase();
  var _stEl=document.getElementById("endStats"); if(_stEl) _stEl.innerHTML=`
    <div class="end-stat"><div class="end-stat-val">${durStr}</div><div class="end-stat-lbl">Duração Total</div></div>
    <div class="end-stat"><div class="end-stat-val">${workout.length}</div><div class="end-stat-lbl">Blocos</div></div>
    <div class="end-stat"><div class="end-stat-val">${(typeof segments!=="undefined"?segments:[]).filter(s=>workout.some(b=>b.segmentId===s.id)).length}</div><div class="end-stat-lbl">Segmentos</div></div>
    <div class="end-stat"><div class="end-stat-val" style="color:#ea860c;">${(typeof calcularTSS==="function"?calcularTSS(workout).tss:0)}</div><div class="end-stat-lbl">TSS</div></div>
  `;
  const graphEl=document.getElementById("endFullGraph"); const legendEl=document.getElementById("endGraphLegend");
  if(graphEl) graphEl.innerHTML=""; if(legendEl) legendEl.innerHTML="";
  if(graphEl&&legendEl) segments.forEach((seg,si)=>{
    const sb=workout.filter(b=>b.segmentId===seg.id); if(!sb.length) return;
    if(si>0&&graphEl.children.length>0){ const sep=document.createElement("div"); sep.className="end-graph-sep"; graphEl.appendChild(sep); }
    const group=document.createElement("div"); group.className="end-graph-seg-group";
    sb.forEach(block=>{
      var _biz=(/^z(\d)$/.test(block.intensity))?'zone'+block.intensity[1]:block.intensity;
      const z=zoneInfo[_biz]||zoneInfo['zone1']||{color:'#888',fill:'#444',glow:'#888'};
      const bar=document.createElement("div"); bar.className=`end-bar ${block.intensity||''}`;
      bar.style.cssText=`--c:${z.color};--fill:${z.fill};--glow:${z.glow};`;
      const eSec=_prSec(block); bar.innerHTML=`<span class="end-bar-dur">${Math.floor(eSec/60)}:${(eSec%60).toString().padStart(2,'0')}</span>`;
      if(/em\s*p|standing/i.test(String(block.position||""))) bar.style.borderTop=`2px solid #fff`;
      group.appendChild(bar);
    });
    graphEl.appendChild(group);
    // o grupo cresce conforme o numero de blocos; o rotulo recebe o mesmo peso
    group.style.flex=sb.length+' 1 0';
    if(legendEl.children.length>0){
      const lsep=document.createElement("span"); lsep.className="end-legend-sep"; legendEl.appendChild(lsep);
    }
    const lbl=document.createElement("span"); lbl.className="end-graph-seg-label";
    lbl.style.flex=sb.length+' 1 0'; lbl.title=seg.name; lbl.textContent=seg.name; legendEl.appendChild(lbl);
  });
  // Encolhe as barras pra caber na largura (evita transbordo sobre o fundo)
  if(graphEl){ graphEl.style.overflow='hidden'; requestAnimationFrame(function(){
    var bars=graphEl.querySelectorAll('.end-bar'); var N=bars.length; if(!N) return;
    // zera o zoom residual da aula anterior antes de medir a largura
    var _ec=document.getElementById('endContent');
    _END_FIT_W=2360; // stats sempre no canvas de 2360 (o ranking usa 1200)
    if(_ec){ _ec.style.zoom=1; _ec.style.width='2360px'; }
    var avail=graphEl.clientWidth||0; if(avail<60) return;
    var bw=Math.floor((avail-(N*6))/N); bw=Math.max(6,Math.min(46,bw));
    var hideLbl=bw<34;
    bars.forEach(function(b){ b.style.minWidth=bw+'px'; b.style.flex='1 1 '+bw+'px'; var l=b.querySelector('.end-bar-dur'); if(l) l.style.display=hideLbl?'none':''; });
  }); }
  const distEl=document.getElementById("endZoneDistribution"); if(distEl) distEl.innerHTML=`<div class="zdist-title">Distribuição de esforço por zona</div>`;
  if(distEl){
    const zoneMinutes={}; workout.forEach(b=>{ zoneMinutes[b.intensity]=(zoneMinutes[b.intensity]||0)+b.duration; });
    const maxMin=Math.max(...Object.values(zoneMinutes))||1;
    var zoneMinutes2={};
    Object.keys(zoneMinutes).forEach(function(k){
      var k2=(/^z(\d)$/.test(k))?'zone'+k[1]:k;
      zoneMinutes2[k2]=(zoneMinutes2[k2]||0)+zoneMinutes[k];
    });
    ["zone1","zone2","zone3","zone4","zone5","zone6","zone7"].forEach(zk=>{
      const mins=zoneMinutes2[zk]; if(!mins) return;
      const z=zoneInfo[zk]||{color:'#888',name:zk,glow:'#888'}; const pct=Math.round((mins/maxMin)*100);
      const row=document.createElement("div"); row.className="zdist-row";
      row.innerHTML=`<div class="zdist-dot" style="background:${z.color};box-shadow:0 0 8px ${z.color}55;"></div><div class="zdist-name">${z.name}</div><div class="zdist-bar-wrap"><div class="zdist-bar-fill" style="width:0%;background:${z.color};box-shadow:0 0 8px ${z.glow};"></div></div><div class="zdist-time">${_fmMMSS(mins)}</div>`;
      distEl.appendChild(row);
      requestAnimationFrame(()=>{ setTimeout(()=>{ const fill=row.querySelector(".zdist-bar-fill"); if(fill) fill.style.width=pct+"%"; },100); });
    });
  }
  const segStatsEl=document.getElementById("endSegStats"); if(segStatsEl){ segStatsEl.innerHTML="";
  segments.forEach(seg=>{ const sb=workout.filter(b=>b.segmentId===seg.id); if(!sb.length) return; const segMin=sb.reduce((a,b)=>a+b.duration,0); const d=document.createElement("div"); d.className="end-seg"; d.textContent=`${seg.name}  ·  ${_fmMMSS(segMin)}  ·  ${sb.length} ${sb.length===1?'bloco':'blocos'}`; segStatsEl.appendChild(d); }); }
  // Preenche a tela inteira (cresce E encolhe) — ver _endFit()
  requestAnimationFrame(function(){ _endFit(2360); });
  }catch(err){ console.error("[ProRider] showEndScreen stats error:",err); }
  // MP3 continua tocando — se acabar reinicia automaticamente (loop já está ativo)
  // Só toca som de fim se não há MP3 tocando
  if(!mp3ObjectUrl || !backgroundAudio || !backgroundAudio.src){
    playEndSound();
  }
}
function playEndSound(){
  try{ const ctx=new(window.AudioContext||window.webkitAudioContext)(); [523,659,784,1046].forEach((freq,i)=>{ const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type="sine"; osc.frequency.value=freq; const t=ctx.currentTime+i*0.18; gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(0.3,t+0.05); gain.gain.exponentialRampToValueAtTime(0.001,t+0.5); osc.start(t); osc.stop(t+0.5); }); }catch(e){}
}

// ── UTILITÁRIOS ──
function segmentById(id){ return segments.find(s=>s.id===id); }
function formatTime(s){ s=Math.max(0,Math.floor(s+1e-6)); return  /* +1e-6: duracao em minutos vira fracao periodica; sem isso 2966,999999994s exibia 49:26 */ `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function formatTimeFull(s){ s=Math.floor(s+1e-6); const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`; }

// INIT
renderSegTabs();
renderBuilderTimeline();

// ══════════════════════════════════════════
// SPOTIFY — integração via Web Playback SDK
// O professor faz login, escolhe playlist,
// a música toca no DISPOSITIVO DELE via Spotify
// O ProRider só sincroniza o tempo
// ══════════════════════════════════════════

// NOTA: Para funcionar em produção você precisa:
// 1. Criar um app em developer.spotify.com
// 2. Configurar o Client ID abaixo
// 3. Adicionar a URL do seu site como Redirect URI no painel Spotify
// Por enquanto está em modo demonstração

const SPOTIFY_CLIENT_ID = "SEU_CLIENT_ID_AQUI"; // substituir em produção
const SPOTIFY_REDIRECT   = window.location.origin + window.location.pathname;
const SPOTIFY_SCOPES     = "user-read-private playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state";

let spotifyToken    = localStorage.getItem("spotify_token") || null;
let spotifyUserId   = null;
let spotifyPlaylistUri = null;

// Verifica token na URL (retorno do login Spotify)
function checkSpotifyCallback(){
  const hash = window.location.hash;
  if(hash && hash.includes("access_token")){
    const params = new URLSearchParams(hash.substring(1));
    const token  = params.get("access_token");
    if(token){
      spotifyToken = token;
      localStorage.setItem("spotify_token", token);
      // Limpa hash da URL
      history.replaceState(null, "", window.location.pathname);
      initSpotifyUI();
    }
  } else if(spotifyToken){
    initSpotifyUI();
  }
}

async function initSpotifyUI(){
  try{
    const res  = await fetch("https://api.spotify.com/v1/me", { headers:{ Authorization:`Bearer ${spotifyToken}` } });
    if(!res.ok){ spotifyLogout(); return; }
    const data = await res.json();
    spotifyUserId = data.id;
    document.getElementById("spotifyNotConnected").style.display = "none";
    document.getElementById("spotifyConnected").style.display    = "block";
    document.getElementById("spotifyUserName").textContent = `✓ ${data.display_name||data.id}`;
    document.getElementById("spotifyStatus").textContent = "Conectado";
    document.getElementById("spotifyStatus").style.color = "#1DB954";
    loadSpotifyPlaylists();
  }catch(e){ console.log("Spotify:", e); }
}

async function loadSpotifyPlaylists(){
  try{
    const res  = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", { headers:{ Authorization:`Bearer ${spotifyToken}` } });
    const data = await res.json();
    const sel  = document.getElementById("spotifyPlaylistSelect");
    sel.innerHTML = '<option value="">Selecione uma playlist...</option>';
    (data.items||[]).forEach(pl=>{
      const opt = document.createElement("option");
      opt.value       = pl.uri;
      opt.textContent = `${pl.name} (${pl.tracks.total} músicas)`;
      sel.appendChild(opt);
    });
  }catch(e){ console.log("Playlists:", e); }
}

function spotifyLogin(){
  if(SPOTIFY_CLIENT_ID === "SEU_CLIENT_ID_AQUI"){
    alert("Spotify em modo demonstração.\n\nPara ativar: configure o Client ID no script.js após criar um app em developer.spotify.com");
    return;
  }
  const url = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}`;
  window.location.href = url;
}

function spotifyLogout(){
  spotifyToken = null;
  localStorage.removeItem("spotify_token");
  document.getElementById("spotifyNotConnected").style.display = "block";
  document.getElementById("spotifyConnected").style.display    = "none";
  document.getElementById("spotifyStatus").textContent = "";
  spotifyPlaylistUri = null;
}

// Inicializar eventos Spotify
const spotifyLoginBtn  = document.getElementById("spotifyLoginBtn");
const spotifyLogoutBtn = document.getElementById("spotifyLogoutBtn");
const spotifyPlaySel   = document.getElementById("spotifyPlaylistSelect");

if(spotifyLoginBtn)  spotifyLoginBtn.addEventListener("click",  spotifyLogin);
if(spotifyLogoutBtn) spotifyLogoutBtn.addEventListener("click",  spotifyLogout);
if(spotifyPlaySel)   spotifyPlaySel.addEventListener("change", ()=>{
  spotifyPlaylistUri = spotifyPlaySel.value;
  const info = document.getElementById("spotifySelectedInfo");
  if(spotifyPlaylistUri && info){
    info.style.display = "block";
    info.textContent   = `✓ Playlist selecionada — tocará no Spotify quando a live iniciar`;
  } else if(info){
    info.style.display = "none";
  }
});

// Verificar callback do Spotify ao carregar
checkSpotifyCallback();

// ============================================

// ── Marcador de build (confira no console F12 qual versão está rodando) ──
// ── Tracinho branco de "Em Pé" nos gráficos da telemetria (igual ao da tela de fim) ──
(function(){
  function _injPosCSS(){
    if(document.getElementById('prStandingCSS')) return;
    var s=document.createElement('style'); s.id='prStandingCSS';
    s.textContent=''
      // GRÁFICO PRINCIPAL da telemetria (entre as bolas): o .liveBlock tem overflow:hidden,
      // então o tracinho tem que ficar DENTRO do bloco (top:0), senão é cortado e some.
      +'.liveBlock.standing::before{content:"" !important;position:absolute !important;top:0 !important;left:0 !important;width:100% !important;height:5px !important;background:rgba(255,255,255,.95) !important;border-radius:3px 3px 0 0 !important;box-shadow:0 0 8px rgba(255,255,255,.6) !important;z-index:9 !important;}'
      +'.liveBlock.standing{overflow:visible !important;}'
      // gráfico de blocos (stBar) — este não tem overflow:hidden, tracinho pode ficar acima
      +'.stBar.standing::before{background:rgba(255,255,255,.92) !important;height:4px !important;top:-6px !important;border-radius:3px !important;box-shadow:0 0 6px rgba(255,255,255,.45) !important;z-index:9 !important;}'
      +'.block.standing::before{background:rgba(255,255,255,.92) !important;box-shadow:0 0 5px rgba(255,255,255,.4) !important;}';
    (document.head||document.documentElement).appendChild(s);
  }
  if(document.readyState!=='loading') _injPosCSS();
  else document.addEventListener('DOMContentLoaded', _injPosCSS);
})();
// 23/09b: prova da faixa preta no Console. Meio segundo depois de o video
// comecar a tocar, mede onde ele esta. Se descer, diz quanto e porque.
(function(){
  var v=document.getElementById('backgroundVideo'); if(!v) return;
  function medir(){
    try{
      var r=v.getBoundingClientRect(), lc=document.getElementById('liveClass');
      var rl=lc?lc.getBoundingClientRect():{top:0};
      if(r.top>2 || rl.top>2 || r.height < window.innerHeight-2){
        console.error('[ProRider] VIDEO FORA DO LUGAR — topo do video '+Math.round(r.top)+'px, altura '+Math.round(r.height)+'px de '+window.innerHeight+
          ' · topo da aula '+Math.round(rl.top)+'px · position '+getComputedStyle(v).position+' · style da tag: '+(v.getAttribute('style')||'(vazio)'));
      } else console.log('[ProRider] video no topo: ok (top 0, altura '+Math.round(r.height)+'px)');
    }catch(e){}
  }
  // ── 25/09: FAIXA PRETA DENTRO DO PROPRIO ARQUIVO → CORTE AUTOMATICO ──
  // Com a 24/09a na TV (video ja travado no topo) a faixa continuou: entao ela
  // vem gravada no arquivo (videos de transmissao costumam trazer tarja).
  // Mede as linhas pretas no alto e no baixo do quadro em 3 momentos; se a
  // tarja aparecer em pelo menos 2 (uma cena escura sozinha nao engana) e for
  // de 1,5% a 20% da altura, amplia o video o suficiente para ela sair da tela.
  function _faixas(){
    var vw=v.videoWidth, vh=v.videoHeight; if(!vw||!vh) return null;
    var W=160, H=Math.max(1,Math.round(160*vh/vw)), c=document.createElement('canvas'); c.width=W; c.height=H;
    var cx=c.getContext('2d'); cx.drawImage(v,0,0,W,H);
    var d=cx.getImageData(0,0,W,H).data;
    function linhaPreta(y){ var soma=0; for(var x=0;x<W;x++){ var k=(y*W+x)*4; soma+=d[k]+d[k+1]+d[k+2]; } return soma/(W*3)<14; }
    var top=0; while(top<H && linhaPreta(top)) top++;
    var bot=0; while(bot<H-top && linhaPreta(H-1-bot)) bot++;
    if(top>=H) return {top:0,bot:0,vw:vw,vh:vh,escuro:true};   // quadro todo preto: nao conta
    return {top:top*vh/H, bot:bot*vh/H, vw:vw, vh:vh};
  }
  var _amostras=[];
  function _aplicarCorte(){
    var t=[], b=[];
    _amostras.forEach(function(a){ if(a && !a.escuro){ t.push(a.top); b.push(a.bot); } });
    if(t.length<2) return;
    function consenso(arr){ arr=arr.slice().sort(function(x,y){return x-y;}); return arr.length>=3?arr[1]:Math.min(arr[0],arr[1]); }
    var a0=_amostras[_amostras.length-1], pxT=consenso(t), pxB=consenso(b);
    var r=v.getBoundingClientRect(), Wd=r.width, Hd=r.height; if(!Wd||!Hd) return;
    var sc=Math.max(Wd/a0.vw, Hd/a0.vh), off=(Hd-a0.vh*sc)/2;         // object-fit:cover
    var ft=Math.max(0, off+pxT*sc)/Hd, fb=Math.max(0, off+pxB*sc)/Hd;
    if(ft+fb<0.015 || ft+fb>0.20){
      document.documentElement.style.removeProperty('--prVidCrop');
      console.log('[ProRider] video '+a0.vw+'x'+a0.vh+' · tela '+window.innerWidth+'x'+window.innerHeight+
        (ft+fb<0.015?' · sem faixa preta no arquivo':' · faixa escura grande demais ('+Math.round((ft+fb)*100)+'%) — nao cortei, pode ser a cena'));
      return;
    }
    var k=1/(1-ft-fb);
    var tr='translate('+(-(k-1)*50).toFixed(3)+'%,'+(-k*ft*100).toFixed(3)+'%) scale('+k.toFixed(4)+')';
    document.documentElement.style.setProperty('--prVidCrop', tr);
    console.log('[ProRider] video '+a0.vw+'x'+a0.vh+' · O PROPRIO ARQUIVO tem faixa preta (em cima ~'+Math.round(pxT)+' px, embaixo ~'+Math.round(pxB)+
      ' px do video) — cortada automaticamente: ampliado '+Math.round((k-1)*100)+'%.');
  }
  function _amostrar(){ try{ var a=_faixas(); if(a) _amostras.push(a); if(_amostras.length>=2) _aplicarCorte(); }catch(e){} }
  v.addEventListener('playing',function(){
    _amostras=[];
    setTimeout(_amostrar,1500); setTimeout(_amostrar,6000); setTimeout(_amostrar,15000);
  });
  v.addEventListener('emptied',function(){ _amostras=[]; document.documentElement.style.removeProperty('--prVidCrop'); });
  v.addEventListener('playing',function(){ setTimeout(medir,500); });
})();
try{ console.log('%c[ProRider] BUILD 07/10d — diagnostico da sala (LB+RB 2 s na tela do QR) + alunos demo ficam ligados + 07/10c: relatorio da aula (falhas por bike, quedas, fps) na Saude + 07/10b: pendrive ANT+ na TV (bikes que so falam ANT+: Schwinn Echelon2, Spinner Blade ION, ICG TFT 1.0...) lidas todas ao mesmo tempo, como a Keiser + 07/10a: atualizacao automatica pelo servidor (assinada, de madrugada, volta sozinha se falhar), Keiser: resumo (review) ignorado e nº da Keiser enviado ao app + 03/10z: internet da academia caindo: a TV percebe em 15 s e religa sozinha, o aluno que cai continua na bike (sem aluno fantasma no resumo), o fim da aula chega aos celulares quando a internet volta + 03/10x: TV volta sozinha quando o servidor reinicia no meio da aula (tenta de 5 em 5 s) e manda a propria saude (memoria, fps, tempo ligada) para a Saude + 03/10w: ativacao pelo codigo da TV (secreto, Admin > Licencas) + 03/10v: GERAR_PROGRAMA_DA_TV.bat confere a versao antes de gerar o programa + 03/10s: fim de aula nao conta mais como queda do servidor (sem aviso falso na Saude), resumo da aula com o codigo da sala, cartoes com o numero sempre inteiro (100% e zona nao cortam) e nome sem passar por baixo da bike + 03/10r: TV conversa com o servidor pelo endereco novo app.prorider.app.br + 03/10q: musica e video do Dropbox baixados pelo endereco direto do arquivo + 03/10p: bike/rolo de outras marcas (FTMS, potencia) ligado no celular do aluno aparece na TV; a Keiser continua pelo dongle + 03/10n: TV parada volta sozinha para a tela de espera (aulas de hoje) depois de 10 min sem uso, mesmo com o controle ligado; nunca durante a aula, aula pausada, contagem, gravacao, sessao livre ou na tela do QR + 03/10h: erro da TV mostra um codigo pequeno no canto (E-XXXX) para buscar na lupinha da Saude + 03/10f: sem internet a TV guarda o resumo da aula, o resultado do campeonato e a ficha da gravacao e envia sozinha quando a conexao volta (ate 7 dias); erros e avisos da TV chegam sozinhos na Saude do sistema + 03/10c: gravacao avisa na TV (nao comecou / salva / enviada ao app / falhou) + 03/10a: tela de transicao de segmento entra cobrindo a tela principal (sem o corte do grafico/video) + 02/10j: aula em rede: nas outras academias o professor principal vira o fundo (sem video) ou um quadrinho no canto (com video); na principal, com video escolhido, a camera so grava/transmite; musica e video por link baixados antes da aula (C:\ProRider\Cache, apagados em 2 dias); video da aula por link + 02/10f: musica por LINK (Dropbox/Google Drive) com o pendrive de reserva; aula em rede: START da mae libera 5 min antes do horario, as outras seguem sozinhas 5 min depois se ela nao comecar, RECOMECAR em todas nos primeiros 5 min (alunos continuam conectados) + 02/10e: AULA AO VIVO EM REDE: a academia que criou o desafio ao vivo da a aula; as outras entram por "Aula ao vivo em rede" no inicio, comecam junto com o START dela, seguem pausa e avanco, e mostram o video e a voz do professor num quadro + 02/10c: trilha do Construtor: varias musicas em sequencia, cada uma no trecho escolhido (de/ate), no mesmo relogio da aula + 02/10b: gravação = câmera limpa + roteiro da aula (aula gravada no app com os números do aluno), envio para teste + 02/10a: desafio entre academias (resumo de cada aula, placar ao vivo entre academias), gravar a aula (câmera + faixa da aula) e transmitir no app (WebRTC) e no YouTube Live (ffmpeg), quem está na bike reservada vira presente + 01/10f: reservas com bike: quem reservou aparece na bike reservada na tela do QR (amarelo; verde pedalando) e a bike fica bloqueada para os outros no app + 01/10e: telas de preparar a aula com o visual de volta (CSS completo), graficos de perfil proporcionais ao tempo, START responde na hora, menos carga + 01/10d: tela de espera opcao 2: logo original centralizado (maior) e as aulas de hoje passando embaixo + 01/10c: logo original em todas as telas + logo original (raio + PRO RIDER) em todas as telas + 01/10a: CAMPEONATO (Tour/Giro/Vuelta/Mundial): a TV acha a etapa de hoje, soma sprint e montanha bloco a bloco, manda o resultado no fim e mostra a classificacao como 3a tela do fim da aula; camisa ao lado do nome (grade de bikes, ranking) + 30/09f: camera ao vivo em cartao proprio na tela de configurar a aula + telas de preparar a aula no visual do Portal (inicio com 3 opcoes, Minhas aulas com QR no card e pendrive, aulas do sistema em grade com perfil, lista com detalhe, configurar aula com MP3/Spotify/sem musica e pendrive/YouTube/camera/sem video, QR com os dois codigos grandes e as bikes ao vivo) + YouTube de fundo sincronizado + contagem 3-2-1 com o play do Spotify + tela final com jornada, zonas e destaques + logo original em todas as telas + desafio do Construtor chega na aula + grafico 2 ~25% maior (sobe 32 px acima dos circulos) + grafico 2 no tamanho do projeto em qualquer TV (alturas no desenho 1920x1080, nao em vh) + tela de imersao cobrindo a TV inteira + SELECT: para teste/desafio, 2o SELECT volta ao grafico, sai da imersao + brasões novos (Aquecimento, Cadência, Pelotão antes do Bronze) + aulas do dia em cartões grandes na tela de espera (professor, tipo, duração, reservas, contagem regressiva, km e kcal do clube) + brasão ao lado do nome no ranking + aluno do totem (sem celular) na bike + nome/professor da aula aberta vão ao servidor (faixa verde do app) + ranking da TV com os campos escolhidos no Portal (ordem e colunas) + versao do Ginasio aparece no Portal + aluno da sala fica ligado a academia + novo mapa (RB=QR, Y=FC, LB+RB 5 s=espaco) + tela de frequencia cardiaca (bike ou cinta do celular) + fim de aula chega ao celular (pendente, ao fechar, sala encerrada) + fim de aula e ranking no padrao novo + modo espaco (LB+RB 1 s: tela escura com estrelas na velocidade da sala) + teste FTP: so entra quem pedala nos 10 primeiros s; resultado vai ao celular + lista da tela do QR sem rolagem + ranking >20 em rodizio de 10 s, nome e foto maiores + fluidez: anel do teste FTP a cada quadro pelo relogio real, desafio e FTP 10x/s, cartoes e ranking ~7x/s atualizados no lugar, agulha do perfil 5x/s + trocas de tela com esmaecimento rapido + teste de FTP na tela nova (ao vivo e resultado com podio por evolucao) + FTP pela MEDIA do teste x fator (antes: instante / fator) + grafico antigo desativado; esconder as caixas faz o grafico descer e crescer 30% + desafio fluido (4x/s, atualiza no lugar, kcal fracionaria, corda e barras deslizando; pico de potencia so dentro do desafio) + resultado do desafio congelado no fim + ranking com muitos alunos sem corte (linhas encolhem para caber, nome maior em duas colunas) + desafio automatico no bloco (construtor: tipo, modo e segundos; comeca sozinho e termina com o bloco) + desafio CABO DE GUERRA (corda pelo esforco de agora em %FTP) + podio no resultado final + barra de progresso por aluno + desafios equilibrados pelo FTP (kcal em pontos, potencia media em %FTP; potencia maxima bruta) + reconexao: confere os alunos com o servidor e libera a bike de quem nao voltou + desafio Homens x Mulheres com tela nova (10 por lado, troca a cada 5 s, sem rolagem) + resultado individual enviado ao celular + grafico 2 cabe entre os circulos + INICIO/FIM so no comeco e no fim da aula + mini grafico das telas de cartoes no mesmo eixo de tempo (sem os ~5 s de diferenca) + lobby: linha branca do perfil removida + coluna 3 sem sobreposicao (so CSS) + agulha do progresso andando no perfil da tela do QR + grafico 2 25% maior + altura 15% mais contrastada + largura mais proporcional ao tempo + caixas do rodape 25% maiores (texto se ajusta) + linha do perfil da pre-aula atras das barras + TrainingPeaks do pendrive + faixa preta gravada no video cortada sozinha + versao na tela inicial + linha do BUILD consertada + grade da sala limitada pelas bikes da licenca (/display/licenca) + grafico 2 troca de pagina na hora (nao fica atrasado conforme a tela) + bike 99 do professor aparece na aula e vai no relay + marcha e FC tambem nas bikes sem login + bled112.js unificado (Electron + Chrome) + marcha e FC nos cartoes + FC na lista do lobby + perfil do lobby alinhado (barras e linha no mesmo eixo) + cartao AULA SELECIONADA sem transbordar + QR sem dica flutuante + Meta FTP < 55% + 401 no pareamento oferece reativar + video travado no topo (faixa preta) + grafico 2: veu virou apagamento so nos cartoes + em pe/sentado pela borda de cima (sem P/S) + video de fundo cobrindo a tela inteira + gasto calorico pela mesma conta do app do aluno + painel de opcoes (quickbar) no visual das caixas do rodape + barra ao vivo ocupando a largura toda e com a posicao (de pe/sentado) + apagamento recortado bloco a bloco + pre-aula reorganizada + grafico pagina em telas + tela final: nome da aula, legenda alinhada + TSS na pre-aula e na tela final + protocolo de 60 min e fatores alinhados + grafico do topo acompanha pausa/avanco + lista de alunos sem rolagem + barras de rolagem removidas + dongle BLE: prova de vida, deteccao da velocidade e liberacao correta do leitor entre tentativas','color:#ea860c;font-weight:700;'); }catch(e){}

// 26/09d: fechar o programa (ou a janela) avisa os celulares que a aula acabou.
// Sem isto, o celular so descobria 3 minutos depois (prazo do servidor).
window.addEventListener('beforeunload',function(){
  try{ if(wsProf && wsProf.readyState===1 && salaCode && (boxMode==='live'||boxMode==='end'||boxMode==='endRanking'||boxMode==='livre'||boxMode==='sessao')) wsProf.send(JSON.stringify({tipo:'fim_aula'})); }catch(e){}
});

// 26/09d: sair do fim de aula (inicio, repetir, reset) fecha a tela nova
(function(){
  ['resetCompleto','endAcaoVoltar','endAcaoRepetir'].forEach(function(fn){
    var orig=window[fn]; if(typeof orig!=='function') return;
    window[fn]=function(){ try{ _fimNovoFechar(); }catch(e){} return orig.apply(this,arguments); };
  });
})();

// ── 03/10x: SAÚDE DA TV ──────────────────────────────────────────
// A cada minuto a TV conta ao servidor como está: memória do JavaScript, nós da tela,
// quadros por segundo, há quanto tempo está ligada e a aula em andamento. Aparece em
// Admin → Saúde → TVs; uma aula longa (8–10 h) mostra se a memória cresce sem parar.
(function(){
  var _errosTv=0, _ini=Date.now();
  window.addEventListener('error',function(){ _errosTv++; });
  function _fps(cb){ var n=0, t0=performance.now(); function f(){ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else cb(Math.round(n/((performance.now()-t0)/1000))); } requestAnimationFrame(f); }
  function _aulaMin(){ try{ if(typeof isPlaying==='undefined'||!isPlaying||!workout||!workout.length) return 0; return Math.round((_prSecTotal(workout.slice(0,currentBlockIndex))+(performance.now()-blockStartTime)/1000)/6)/10; }catch(e){ return 0; } }
  function _enviar(){
    if(!_gymDisplayToken||_gymDisplayToken==='dev-bypass'||window._PR_OFFLINE) return;
    _fps(function(fps){
      var m=performance.memory||{};
      var d={ mem_mb:m.usedJSHeapSize?Math.round(m.usedJSHeapSize/104857.6)/10:null, mem_lim_mb:m.jsHeapSizeLimit?Math.round(m.jsHeapSizeLimit/1048576):null,
        nos:document.getElementsByTagName('*').length, fps:fps, ligada_min:Math.round((Date.now()-_ini)/6000)/10, aula_min:_aulaMin(),
        alunos:(typeof alunosMap!=='undefined'?Object.keys(alunosMap).filter(function(k){ return alunosMap[k]&&!alunosMap[k]._virtual; }).length:0),
        quedas_ws:(typeof _wsQuedas!=='undefined'?_wsQuedas:0), erros:_errosTv, build:PR_BUILD };
      d.atualizador=!!window.prAtualizador;   // 07/10c: o programa da TV tem o atualizador automático?
      try{ _prRelAmostra(d.fps,d.mem_mb); }catch(e){}
      window._prSaudeTv=d;
      fetch(SERVER_HTTP+'/display/saude',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+_gymDisplayToken,'X-PR-Build':PR_BUILD},body:JSON.stringify(d)}).catch(function(){});
    });
  }
  setTimeout(_enviar,15000);
  setInterval(_enviar,parseInt(window._PR_SAUDE_MS||60000,10));
})();

// ── 07/10a: ATUALIZAÇÃO AUTOMÁTICA DA TV (pelo servidor, sem pendrive nem TeamViewer) ────────
// O programa da TV precisa ter o atualizador (atualizador-tv.js + preload → window.prAtualizador).
// A cada 10 min a TV pergunta ao servidor. Se houver versão nova para esta academia, ela só instala
// quando estiver PARADA na tela de espera (sem aula, sem pré-aula, sem gravação) e dentro da janela
// (padrão 02:00–05:00, no relógio do próprio computador da TV) — ou na hora, se o Admin pediu
// "atualizar agora". Quem confere a assinatura e grava os arquivos é o programa (processo principal).
// Depois de abrir a versão nova, a tela se CONFIRMA em 60 s; se travar, o programa volta sozinho.
(function(){
  var _errosAtu=0, _avisouSemSuporte=false, _tentouEm={};
  window.addEventListener('error',function(){ _errosAtu++; });
  function tk(){ return (typeof _gymDisplayToken!=='undefined'&&_gymDisplayToken&&_gymDisplayToken!=='dev-bypass')?_gymDisplayToken:''; }
  function contar(etapa,de,para,msg){ var t=tk(); if(!t) return;
    fetch(SERVER_HTTP+'/display/atualizacao/status',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t,'X-PR-Build':PR_BUILD},
      body:JSON.stringify({etapa:etapa,de:de||'',para:para||'',msg:msg||''})}).catch(function(){}); }
  function naJanela(j){ var m=String(j||'02:00-05:00').match(/^(\d\d):(\d\d)-(\d\d):(\d\d)$/); if(!m) return false;
    var n=new Date(), x=n.getHours()*60+n.getMinutes(), a=(+m[1])*60+(+m[2]), b=(+m[3])*60+(+m[4]); return a<=b?(x>=a&&x<b):(x>=a||x<b); }
  function parada(){ try{ if(typeof isPlaying!=='undefined'&&isPlaying) return false; return typeof boxMode!=='undefined'&&boxMode==='idle'; }catch(e){ return false; } }
  window._prAtuPodeAgora=parada;
  async function checar(){
    var t=tk(); if(!t||window._PR_OFFLINE) return;
    var r; try{ r=await (await fetch(SERVER_HTTP+'/display/atualizacao',{headers:{'Authorization':'Bearer '+t,'X-PR-Build':PR_BUILD},cache:'no-store'})).json(); }catch(e){ return; }
    window._prAtuUltima=r;
    if(!r||r.nada||!r.versao) return;
    if(!window.prAtualizador){ if(!_avisouSemSuporte){ _avisouSemSuporte=true; contar('sem_suporte',PR_BUILD.replace('BUILD ',''),r.versao,'o programa da TV ainda não tem o atualizador: instalar uma vez pelo GERAR_PROGRAMA_DA_TV.bat'); } return; }
    if(!(r.agora||naJanela(r.janela))||!parada()) return;
    if(_tentouEm[r.versao]&&Date.now()-_tentouEm[r.versao]<3600000) return;   // falhou há pouco: tenta de novo em 1 h
    _tentouEm[r.versao]=Date.now();
    var de=PR_BUILD.replace('BUILD ','');
    try{ console.log('[ProRider] atualização automática: instalando a '+r.versao+'…'); }catch(e){}
    contar('baixando',de,r.versao,'');
    var res=null; try{ res=await window.prAtualizador.instalar({versao:r.versao,url:r.url,sha256:r.sha256,assinatura:r.assinatura}); }catch(e){ res={ok:false,erro:(e&&e.message)||String(e)}; }
    if(res&&res.ok){ contar('instalada',de,r.versao,'reabrindo na versão nova'); }
    else{ contar('erro',de,r.versao,(res&&res.erro)||'falhou'); try{ prErroTv('Atualização automática da TV falhou ('+r.versao+'): '+((res&&res.erro)||'?'),'aviso'); }catch(e){} }
  }
  // ao abrir: confirma a versão nova (ou conta que voltou para a anterior)
  setTimeout(async function(){
    if(!window.prAtualizador) return;
    var e=null; try{ e=await window.prAtualizador.estado(); }catch(x){ return; }
    if(e&&e.falhou&&e.falhou.em&&Date.now()-new Date(e.falhou.em).getTime()<86400000&&localStorage.getItem('pr_atu_falha_contada')!==e.falhou.em){
      localStorage.setItem('pr_atu_falha_contada',e.falhou.em); contar('voltou',e.falhou.versao,e.falhou.versao,e.falhou.motivo||''); }
    if(!e||!e.pendente) return;
    var ok=(typeof iniciarWS==='function')&&(typeof BLED112!=='undefined')&&_errosAtu===0&&document.getElementById('idleScreen');
    if(!ok){ try{ console.warn('[ProRider] versão nova abriu com problema — não confirmo; o programa volta sozinho para a anterior.'); }catch(x){} return; }
    var c=null; try{ c=await window.prAtualizador.confirmar(PR_BUILD); }catch(x){}
    if(c&&c.ok) contar('ok',e.anterior||'',e.atual||PR_BUILD.replace('BUILD ',''),'confirmada');
  },parseInt(window._PR_ATU_CONFIRMAR_MS||60000,10));
  setTimeout(checar,parseInt(window._PR_ATU_PRIMEIRA_MS||90000,10));
  setInterval(checar,parseInt(window._PR_ATU_MS||600000,10));
  window._prAtuChecar=checar;
})();
