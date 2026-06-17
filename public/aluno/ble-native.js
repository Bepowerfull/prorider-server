// BLE nativo via Capacitor — Keiser M3i (broadcast) + HR40
// v4: lê do anúncio CRU (rawAdvertisement) — o manufacturerData do plugin é
//     instável no Android. Mantém seleção de bike + diagnóstico na tela.
window.BleNative = (function(){

  var KEISER_COMPANY_ID = 0x0102;  // 258
  var BIKE_TIMEOUT_MS   = 6000;

  var _scanning=false, _scanListener=null;
  var _onData=null, _onBikes=null;
  var _bikesVistas={}, _mode='discover', _selectedBikeId=null;
  var _totalSeen=0, _statInterval=null, _logged={};

  function hexToDataView(hex){
    var bytes=[]; for(var i=0;i<hex.length;i+=2){ bytes.push(parseInt(hex.substr(i,2),16)); }
    return new DataView(new Uint8Array(bytes).buffer);
  }
  function toDataView(val){
    if(!val) return null;
    if(typeof val==='string') return hexToDataView(val);
    if(val instanceof DataView) return val;
    return new DataView(new Uint8Array(Object.values(val)).buffer);
  }
  function getPlugin(){
    if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothLe){
      return window.Capacitor.Plugins.BluetoothLe;
    }
    return null;
  }

  // Converte DataView / Uint8Array / objeto em Uint8Array respeitando offset.
  function _toBytes(v){
    if(!v) return null;
    try {
      if(v instanceof Uint8Array) return v;
      if(v.buffer) return new Uint8Array(v.buffer, v.byteOffset||0, v.byteLength);
      if(typeof v==='string') return new Uint8Array(hexToDataView(v).buffer);
      return new Uint8Array(Object.values(v));
    } catch(e){ return null; }
  }

  function parseKeiser(bytes){
    var o=0;
    if(bytes.length>=19 && bytes[0]===0x02 && bytes[1]===0x01) o=2;
    var u16=function(i){ return bytes[o+i] | (bytes[o+i+1]<<8); };
    var distRaw=u16(14);
    return {
      versionMajor:bytes[o+0], dataType:bytes[o+2], bikeId:bytes[o+3],
      cadence:u16(4)/10, heartRate:u16(6)/10, power:u16(8), kcal:u16(10),
      durationMin:bytes[o+12], durationSec:bytes[o+13],
      distance:(distRaw&0x7FFF)/10, isMetric:!!(distRaw&0x8000), gear:bytes[o+16]
    };
  }

  // 1) tenta o manufacturerData do plugin (pode falhar no Android)
  function _bytesDoManufacturer(result){
    var md=result.manufacturerData;
    if(!md) return null;
    var dv = md[KEISER_COMPANY_ID] || md[String(KEISER_COMPANY_ID)];
    if(!dv){
      var ks=Object.keys(md);
      for(var i=0;i<ks.length;i++){ if(parseInt(ks[i],10)===KEISER_COMPANY_ID){ dv=md[ks[i]]; break; } }
    }
    return dv ? _toBytes(dv) : null;
  }

  // 2) fallback robusto: varre o anúncio CRU procurando o bloco 0xFF da Keiser
  function _bytesDoRaw(result){
    var raw=result.rawAdvertisement;
    var b=_toBytes(raw);
    if(!b) return null;
    var i=0;
    while(i+1 < b.length){
      var len=b[i];
      if(len===0) break;
      var type=b[i+1];
      if(type===0xFF && len>=3){
        var company = b[i+2] | (b[i+3]<<8); // company id little-endian
        if(company===KEISER_COMPANY_ID){
          return b.subarray(i+4, i+1+len); // payload depois do company id
        }
      }
      i += len+1;
    }
    return null;
  }

  function _bytesKeiser(result){
    return _bytesDoManufacturer(result) || _bytesDoRaw(result);
  }

  function _listaBikesAtivas(){
    var agora=Date.now();
    return Object.keys(_bikesVistas).map(function(k){return _bikesVistas[k];})
      .filter(function(b){return agora-b.lastSeen<BIKE_TIMEOUT_MS;})
      .sort(function(a,b){return a.bikeId-b.bikeId;});
  }

  async function startBikeScan(onData, onStatus, onBikes){
    var plugin=getPlugin();
    if(!plugin){ onStatus && onStatus('Plugin BLE não disponível'); return; }
    _onData=onData||null; _onBikes=onBikes||null;
    _mode='discover'; _selectedBikeId=null; _bikesVistas={}; _totalSeen=0; _logged={};

    try{
      await plugin.initialize();
      onStatus && onStatus('A procurar bikes... (v4)');

      _scanListener = await plugin.addListener('onScanResult', function(result){
        _totalSeen++;

        var bytes=_bytesKeiser(result);
        if(!bytes || bytes.length<10) return;
        var dados=parseKeiser(bytes);
        if(dados.bikeId==null) return;

        dados.lastSeen=Date.now();
        var ehNova=!_bikesVistas[dados.bikeId];
        _bikesVistas[dados.bikeId]=dados;
        if(ehNova){
          try{ console.log('[BLE] Keiser bikeId='+dados.bikeId+' rpm='+Math.round(dados.cadence)+' w='+dados.power); }catch(e){}
          _onBikes && _onBikes(_listaBikesAtivas());
        }

        if(_mode==='any' && _selectedBikeId==null){ _selectedBikeId=dados.bikeId; _mode='locked'; }
        if(_mode==='locked' && dados.bikeId===_selectedBikeId){ _onData && _onData(dados); }
      });

      await plugin.requestLEScan({ allowDuplicates:true }); // sem filtro de nome
      _scanning=true;

      _statInterval=setInterval(function(){
        if(_mode==='locked') return;
        if(Object.keys(_bikesVistas).length===0){
          onStatus && onStatus('A procurar... ('+_totalSeen+' BLE vistos · 0 Keiser) v4');
        }
      },1000);

    }catch(e){
      _scanning=false;
      onStatus && onStatus('Erro BLE: '+(e.message||e));
      console.error('[BLE Keiser]', e);
    }
  }

  function selectBike(bikeId){
    if(bikeId==null){ _mode='any'; _selectedBikeId=null; }
    else{ _mode='locked'; _selectedBikeId=Number(bikeId); }
  }
  function getBikes(){ return _listaBikesAtivas(); }

  async function stopBikeScan(){
    var plugin=getPlugin();
    if(_statInterval){ clearInterval(_statInterval); _statInterval=null; }
    if(plugin && _scanning) await plugin.stopLEScan().catch(function(){});
    if(_scanListener){ _scanListener.remove(); _scanListener=null; }
    _scanning=false; _mode='discover'; _selectedBikeId=null; _bikesVistas={};
    _onData=null; _onBikes=null;
  }

  async function startHRScan(onHR, onStatus){
    var plugin=getPlugin();
    if(!plugin){ onStatus && onStatus('Plugin BLE não disponível'); return; }
    var SVC='0000180d-0000-1000-8000-00805f9b34fb';
    var CHAR='00002a37-0000-1000-8000-00805f9b34fb';
    try{
      await plugin.initialize();
      onStatus && onStatus('A procurar cinta...');
      var result=await plugin.requestDevice({ services:[SVC] });
      var deviceId=result.deviceId;
      onStatus && onStatus('A conectar...');
      await plugin.connect({ deviceId:deviceId, timeout:15000 });
      onStatus && onStatus('Ligado! A ler BPM...');
      var notifKey='notification|'+deviceId+'|'+SVC+'|'+CHAR;
      await plugin.addListener(notifKey, function(event){
        var view=toDataView(event&&event.value);
        if(!view||view.byteLength<2) return;
        var flags=view.getUint8(0);
        var hr=(flags&0x01)?view.getUint16(1,true):view.getUint8(1);
        onHR && onHR(hr);
      });
      await plugin.startNotifications({ deviceId:deviceId, service:SVC, characteristic:CHAR });
    }catch(e){
      onStatus && onStatus('Erro HR: '+(e.message||e));
      console.error('[BLE HR]', e);
    }
  }

  return {
    startBikeScan:startBikeScan, stopBikeScan:stopBikeScan,
    selectBike:selectBike, getBikes:getBikes,
    startHRScan:startHRScan, parseKeiser:parseKeiser
  };
})();
