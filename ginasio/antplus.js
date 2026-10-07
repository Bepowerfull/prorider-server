// ================================================================
// ANTPLUS — pendrive ANT+ no computador da TV (07/10b)
// Para as bikes que só falam ANT+ (Schwinn Echelon2/MPower, Spinner Blade ION, ICG/Life Fitness
// TFT 1.0, Technogym Skillbike…) e para as que falam os dois. O ANT+ é TRANSMISSÃO: um pendrive
// escuta todas as bikes da sala ao mesmo tempo, sem limite de conexões — igual à Keiser no BLED112.
//
// Mesmo jeito de usar do BLED112: ANTPLUS.connect() → ANTPLUS.startScan(cb) → cb(device) com
//   { mac:'ANT:<nº>:<tipo>', name, rssi, watts, cadence, heartRate, gear:0, ant:true, antTipo }
//
// Pendrive: Garmin/Dynastream ANT USB-m, USB2 e compatíveis (fabricante 0x0FCF).
//  - Se o Windows mostra o pendrive como PORTA COM: usa Web Serial (igual ao BLED112).
//  - Senão: WebUSB (no Windows o pendrive precisa do driver WinUSB — instalar uma vez com o Zadig).
// Protocolo: "ANT Message Protocol and Usage" (thisisant.com) — mensagem A4 <tam> <id> <dados> <xor>.
// Modo de escuta: "Continuous Scan" (0x5B) na rede ANT+ (frequência 2457 MHz), com mensagens
// estendidas (nº do aparelho, tipo e sinal) em cada pacote.
// Páginas lidas (perfis ANT+ públicos):
//  - FE-C 0x11 (bike/rolo): página 0x19 (cadência byte 2; potência 12 bits bytes 5–6) e 0x15
//    (cadência byte 4; potência bytes 5–6); página 0x10 traz a FC (byte 6, 0xFF = sem FC)
//  - Potência 0x0B: página 0x10 (cadência byte 3, 0xFF = sem; potência bytes 6–7)
//  - Cadência 0x7A e Velocidade+Cadência 0x79: cadência pelas voltas do pedivela
//  - FC 0x78: byte 7
// ================================================================
(function(global){
  'use strict';
  var REDE_ANTPLUS = [0xB9, 0xA5, 0x21, 0xFB, 0xBD, 0x72, 0xC3, 0x45];   // chave pública da rede ANT+
  var TIPOS = { 0x11: 'FE-C', 0x0B: 'Potência', 0x79: 'Vel+Cad', 0x7A: 'Cadência', 0x78: 'FC' };
  var VENDOR = 0x0FCF;

  function msg(id, dados){ var m=[0xA4, dados.length, id].concat(dados), x=0; m.forEach(function(b){ x^=b; }); m.push(x); return new Uint8Array(m); }
  var CMD = {
    reset:   function(){ return msg(0x4A, [0x00]); },
    chave:   function(){ return msg(0x46, [0x00].concat(REDE_ANTPLUS)); },
    canal:   function(){ return msg(0x42, [0x00, 0x00, 0x00]); },          // canal 0, escravo (recebe), rede 0
    idCanal: function(){ return msg(0x51, [0x00, 0x00, 0x00, 0x00, 0x00]); },   // qualquer aparelho, qualquer tipo
    freq:    function(){ return msg(0x45, [0x00, 57]); },                   // 2457 MHz (ANT+)
    extend:  function(){ return msg(0x6E, [0x00, 0xC0]); },                 // pacote leva nº/tipo (0x80) e o sinal (0x40)
    escuta:  function(){ return msg(0x5B, [0x00]); },                       // escuta contínua (todas as bikes)
    fechar:  function(){ return msg(0x4C, [0x00]); }
  };

  // ── leitura das páginas ──────────────────────────────────────
  var _ultCad = {};   // voltas do pedivela anteriores (cadência dos sensores)
  function lerPagina(tipo, num, p){
    var r = {};
    if(tipo===0x11){
      if(p[0]===0x19){ r.cadence = p[2]===0xFF?0:p[2]; r.watts = p[5] | ((p[6]&0x0F)<<8); if(r.watts===0xFFF) r.watts=0; }
      else if(p[0]===0x15){ r.cadence = p[4]===0xFF?0:p[4]; r.watts = p[5] | (p[6]<<8); if(r.watts===0xFFFF) r.watts=0; }
      else if(p[0]===0x10){ if(p[6]!==0xFF && p[6]>0) r.heartRate = p[6]; }
    } else if(tipo===0x0B){
      if(p[0]===0x10){ r.cadence = p[3]===0xFF?0:p[3]; r.watts = p[6] | (p[7]<<8); }
    } else if(tipo===0x78){
      if(p[7]>0) r.heartRate = p[7];
    } else if(tipo===0x7A || tipo===0x79){
      var t = tipo===0x7A ? (p[4]|(p[5]<<8)) : (p[0]|(p[1]<<8)), n = tipo===0x7A ? (p[6]|(p[7]<<8)) : (p[2]|(p[3]<<8));
      var a = _ultCad[num+':'+tipo]; _ultCad[num+':'+tipo] = { t:t, n:n, em:Date.now() };
      if(a){ var dt=((t-a.t)&0xFFFF)/1024, dn=(n-a.n)&0xFFFF;
        if(dt>0 && dn<20) r.cadence = Math.round(60*dn/dt);
        else if(dn===0 && Date.now()-a.em>3000) r.cadence = 0; }
    }
    return r;
  }

  // ── estado ───────────────────────────────────────────────────
  var _tx=null, _cb=null, _buf=[], _ultimo={}, _recebeu=false, _conectando=null;
  var ANTPLUS = {
    connected: false, tipo: null, onQueda: null, onVoltou: null,
    _CMD: CMD, _lerPagina: lerPagina,
    // transporte de teste (os testes injetam um pendrive de mentira)
    _transporteTeste: null,

    connect: function(pedir){
      if(ANTPLUS.connected) return Promise.resolve(true);
      if(_conectando) return _conectando;   // duas chamadas juntas (abertura + pareamento) usam a mesma
      _conectando = conectar(pedir).finally(function(){ _conectando = null; });
      return _conectando;
    },
    startScan: async function(cb){ _cb = cb; if(!ANTPLUS.connected) throw new Error('ANT+ desconectado'); await enviar(CMD.escuta()); },
    stopScan: function(){ _cb = null; },   // a escuta continua no pendrive; só para de entregar
    disconnect: async function(){ try{ await enviar(CMD.fechar()); }catch(e){} try{ _tx && _tx.fechar && _tx.fechar(); }catch(e){} _tx=null; ANTPLUS.connected=false; },
    vistos: function(){ return Object.keys(_ultimo).map(function(k){ return _ultimo[k]; }); }
  };

  async function conectar(pedir){
      var tx = ANTPLUS._transporteTeste || await abrirSerial(pedir) || await abrirUsb(pedir);
      if(!tx) throw new Error('Pendrive ANT+ não encontrado (ligue o pendrive e autorize uma vez)');
      _tx = tx; ANTPLUS.tipo = tx.tipo;
      tx.aoReceber(receber);
      tx.aoCair && tx.aoCair(function(){ ANTPLUS.connected=false; _tx=null; try{ ANTPLUS.onQueda && ANTPLUS.onQueda(); }catch(e){} });
      _recebeu=false; await enviar(CMD.reset()); await espera(600);
      // pendrive na porta COM que não respondeu ao reset: tenta a outra velocidade (USB2 = 57600)
      if(!_recebeu && tx.tipo==='serial' && tx.reabrir){ try{ await tx.reabrir(57600); _recebeu=false; await enviar(CMD.reset()); await espera(600); }catch(e){} }
      await enviar(CMD.chave()); await espera(60);
      await enviar(CMD.canal()); await espera(60);
      await enviar(CMD.idCanal()); await espera(60);
      await enviar(CMD.freq()); await espera(60);
      await enviar(CMD.extend()); await espera(60);
      ANTPLUS.connected = true;   // só depois de preparado (antes disso, quem chamar espera o mesmo connect)
      console.log('[ANT+] pendrive pronto ('+tx.tipo+').');
      return true;
  }
  function espera(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function enviar(m){ return _tx ? _tx.enviar(m) : Promise.reject(new Error('sem pendrive')); }

  function receber(bytes){
    if(bytes && bytes.length) _recebeu=true;
    for(var i=0;i<bytes.length;i++) _buf.push(bytes[i]);
    while(_buf.length >= 4){
      if(_buf[0] !== 0xA4){ _buf.shift(); continue; }
      var len = _buf[1], tot = len + 4; if(_buf.length < tot) return;
      var m = _buf.splice(0, tot), x = 0; for(var k=0;k<tot-1;k++) x ^= m[k];
      if(x !== m[tot-1]) continue;   // pacote estragado
      tratar(m[2], m.slice(3, 3+len));
    }
  }
  function tratar(id, d){
    if(id !== 0x4E && id !== 0x4F) return;          // só dados (broadcast / acknowledged)
    if(d.length < 9) return;
    var p = d.slice(1, 9), flag = d[9];
    if(!(flag & 0x80) || d.length < 14) return;       // sem nº do aparelho não dá para saber qual bike
    var num = d[10] | (d[11]<<8), tipo = d[12] & 0x7F, rssi = null;
    if((flag & 0x40) && d.length >= 17) rssi = (d[15] > 127 ? d[15]-256 : d[15]);
    if(!TIPOS[tipo]) return;
    var k = 'ANT:'+num+':'+tipo, u = _ultimo[k] || (_ultimo[k] = { mac:k, name:'ANT+ '+TIPOS[tipo]+' '+num, rssi:rssi, watts:0, cadence:0, heartRate:0, gear:0, ant:true, antTipo:tipo, antNum:num });
    var r = lerPagina(tipo, num, p);
    if(r.watts!=null) u.watts = r.watts; if(r.cadence!=null) u.cadence = r.cadence; if(r.heartRate!=null) u.heartRate = r.heartRate;
    if(rssi!=null) u.rssi = rssi; u.em = Date.now();
    if(_cb){ try{ _cb({ mac:u.mac, name:u.name, rssi:u.rssi, watts:u.watts, cadence:u.cadence, heartRate:u.heartRate, gear:0, ant:true, antTipo:tipo, antNum:num }); }catch(e){ console.error(e); } }
  }

  // ── transportes ──────────────────────────────────────────────
  async function abrirSerial(pedir){
    if(!('serial' in navigator)) return null;
    try{
      // 0x0FCF = Dynastream/Garmin; 0x10C4 = Silicon Labs (pendrives compatíveis com o chip CP210x)
      var portas = (await navigator.serial.getPorts()).filter(function(p){ var i=p.getInfo&&p.getInfo(); return i && (i.usbVendorId===VENDOR || i.usbVendorId===0x10C4); });
      var porta = portas[0] || (pedir ? await navigator.serial.requestPort({ filters:[{ usbVendorId: VENDOR }, { usbVendorId: 0x10C4 }] }).catch(function(){ return null; }) : null);
      if(!porta) return null;
      var reader=null, writer=null, ouvinte=null, cair=null, vivo=false;
      async function abrir(baud){
        await porta.open({ baudRate: baud }); reader = porta.readable.getReader(); writer = porta.writable.getWriter(); vivo = true;
        var r0 = reader;
        (async function(){ try{ while(vivo && r0===reader){ var r = await r0.read(); if(r.done) break; ouvinte && ouvinte(r.value); } }catch(e){} if(r0===reader){ vivo=false; cair && cair(); } })();
      }
      async function fechar(){ vivo=false; var r=reader; reader=null; try{ await r.cancel(); }catch(e){} try{ r.releaseLock(); }catch(e){} try{ writer.releaseLock(); }catch(e){} try{ await porta.close(); }catch(e){} }
      await abrir(115200);
      return { tipo:'serial', enviar:function(m){ return writer.write(m); }, aoReceber:function(f){ ouvinte=f; }, aoCair:function(f){ cair=f; },
        reabrir:async function(baud){ await fechar(); await abrir(baud); console.log('[ANT+] porta reaberta a '+baud); }, fechar:fechar };
    }catch(e){ console.warn('[ANT+] porta serial: '+e.message); return null; }
  }
  async function abrirUsb(pedir){
    if(!('usb' in navigator)) return null;
    try{
      var devs = (await navigator.usb.getDevices()).filter(function(d){ return d.vendorId===VENDOR; });
      var d = devs[0] || (pedir ? await navigator.usb.requestDevice({ filters:[{ vendorId: VENDOR }] }).catch(function(){ return null; }) : null);
      if(!d) return null;
      await d.open(); if(d.configuration===null) await d.selectConfiguration(1);
      var itf = d.configuration.interfaces[0]; await d.claimInterface(itf.interfaceNumber);
      var eps = itf.alternate.endpoints, epIn = eps.filter(function(e){ return e.direction==='in'; })[0], epOut = eps.filter(function(e){ return e.direction==='out'; })[0];
      var ouvinte=null, cair=null, vivo=true;
      (async function(){ try{ while(vivo){ var r = await d.transferIn(epIn.endpointNumber, 64); if(r.data && r.data.byteLength) ouvinte && ouvinte(new Uint8Array(r.data.buffer)); } }catch(e){} vivo=false; cair && cair(); })();
      return { tipo:'usb', enviar:function(m){ return d.transferOut(epOut.endpointNumber, m); }, aoReceber:function(f){ ouvinte=f; }, aoCair:function(f){ cair=f; },
        fechar:function(){ vivo=false; try{ d.close(); }catch(e){} } };
    }catch(e){ console.warn('[ANT+] USB: '+e.message+' (no Windows: driver WinUSB pelo Zadig)'); return null; }
  }

  global.ANTPLUS = ANTPLUS;
})(typeof window !== 'undefined' ? window : this);
