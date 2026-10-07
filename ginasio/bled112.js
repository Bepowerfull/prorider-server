// ================================================================
// BLED112 — Bluegiga BLED112 USB Dongle via Web Serial API
// Protocolo BGAPI sobre porta serial (COM3, 256000 baud)
// ProRider Ginásio — Pareamento de Bikes
// ================================================================

(function(global){
  'use strict';

  // ── Constantes BGAPI ─────────────────────────────────────────
  var BGAPI = {
    // Comandos enviados ao dongle
    CMD_GAP_DISCOVER:     new Uint8Array([0x00, 0x01, 0x06, 0x02, 0x02]), // all devices
    CMD_GAP_STOP_PROC:    new Uint8Array([0x00, 0x00, 0x06, 0x04]),
    // system_hello: o dongle devolve resposta vazia. Serve de prova de vida —
    // e o unico jeito de saber se a porta que abriu e REAL ou uma porta zumbi
    // (autorizacao velha apontando para uma enumeracao USB que ja morreu).
    CMD_SYSTEM_HELLO:     new Uint8Array([0x00, 0x00, 0x00, 0x01]),
    // Eventos recebidos
    EVT_GAP_SCAN_RESP:    { type: 0x80, cls: 0x06, evt: 0x00 },
    EVT_CONNECTION_STATUS:{ type: 0x80, cls: 0x03, evt: 0x00 },
    EVT_ATTCLIENT_FIND:   { type: 0x80, cls: 0x04, evt: 0x02 },
    EVT_ATTCLIENT_VALUE:  { type: 0x80, cls: 0x04, evt: 0x05 },
  };

  // Bikes conhecidas (filtro por nome BLE)
  var BIKE_FILTERS = [
    { match: function(n){ return n.indexOf('M3') !== -1; },      marca: 'Keiser M3i' },
    { match: function(n){ return n.indexOf('KICKR') !== -1; },   marca: 'Wahoo KICKR' },
    { match: function(n){ return n.indexOf('Tacx') !== -1 || n.indexOf('Neo') !== -1; }, marca: 'Tacx Neo' },
    { match: function(n){ return n.indexOf('Stages') !== -1; },  marca: 'Stages' },
    { match: function(n){ return n.indexOf('TICKR') !== -1; },   marca: 'Wahoo TICKR' },
    { match: function(n){ return n.indexOf('Polar') !== -1 || n.indexOf('H10') !== -1; }, marca: 'Polar H10' },
    { match: function(n){ return n.indexOf('Elite') !== -1; },   marca: 'Elite' },
    { match: function(n){ return n.indexOf('Schwinn') !== -1; }, marca: 'Schwinn' },
  ];

  // ── Estado interno ────────────────────────────────────────────
  var _port = null;
  var _reader = null;
  var _writer = null;
  var _buffer = new Uint8Array(512);
  var _bufLen = 0;
  var _scanning = false;
  var _onDeviceCb = null;
  var _connections = {}; // connHandle → { onValue }

  // ── Funções utilitárias ───────────────────────────────────────

  /** Extrai nome e dados Keiser do payload de AD data.
   *  Retorna { name, bikeId, watts, cadence, gear } */
  function _parseAdData(data, offset, totalLen) {
    var result = { name: null, bikeId: null, watts: 0, cadence: 0, gear: 0 };
    var i = offset;
    while (i < offset + totalLen && i < data.length) {
      var adLen = data[i];
      if (adLen === 0) break;
      if (i + adLen >= data.length) break;
      var adType = data[i + 1];

      if (adType === 0x09 || adType === 0x08) {
        // Complete/Shortened Local Name
        var nameBytes = data.slice(i + 2, i + 1 + adLen);
        var name = '';
        for (var b = 0; b < nameBytes.length; b++) name += String.fromCharCode(nameBytes[b]);
        result.name = name;
      }

      if (adType === 0xFF && adLen >= 4) {
        // Manufacturer Specific Data
        // Bytes i+2,i+3: Company ID little-endian. Keiser = 0x0102
        var companyId = data[i+2] | (data[i+3] << 8);
        if (companyId === 0x0102 && adLen >= 14) {
          // Keiser M3i — formato OFICIAL (após company ID 0x0102 em i+2,i+3):
          // i+4  = build major
          // i+5  = build minor
          // i+6  = data type
          // i+7  = equipment ID (número da bike)   ← era lido errado em i+8
          // i+8..i+9   = cadência × 10 (LE)
          // i+10..i+11 = heart rate × 10 (LE)
          // i+12..i+13 = potência (watts, LE)
          // i+14..i+15 = energia (kcal, LE)
          // i+16 = minutos, i+17 = segundos
          // i+18..i+19 = distância
          // i+20 = gear (se build minor >= 21)
          var buildMinor = data[i+5];
          result.bikeId     = data[i+7];
          result.cadence    = ((data[i+8]  | (data[i+9] <<8)) / 10) | 0;
          result.heartRate  = ((data[i+10] | (data[i+11]<<8)) / 10) | 0;
          result.watts      = data[i+12] | (data[i+13]<<8);
          result.gear       = (buildMinor >= 21 && adLen >= 20) ? data[i+20] : 0;
          // DEBUG temporário: bytes crus para confirmar o offset do ID da bike.
          // Abra o Console (F12) e compare 'id' com o número físico da bike.
          try{ if(window._M3_DEBUG) console.log('[M3 raw] id(i+7)='+data[i+7]+
            ' alt(i+8)='+data[i+8]+' type(i+6)='+data[i+6]+
            ' bytes='+data.slice(i+2, i+1+adLen).map(function(x){return ('0'+x.toString(16)).slice(-2);}).join(' ')); }catch(e){}
        }
      }

      i += 1 + adLen;
    }
    return result;
  }

  // Wrapper para compatibilidade com código legado
  function _parseAdName(data, offset, totalLen) {
    return _parseAdData(data, offset, totalLen).name;
  }

  /** Converte array de 6 bytes (little-endian) para string MAC */
  function _macToStr(bytes) {
    var hex = [];
    for (var i = 5; i >= 0; i--) {
      hex.push(('0' + bytes[i].toString(16)).slice(-2).toUpperCase());
    }
    return hex.join(':');
  }

  /** Verifica se o nome corresponde a uma bike/HR conhecida */
  function _isBikeKnown(name) {
    if (!name) return false;
    for (var i = 0; i < BIKE_FILTERS.length; i++) {
      if (BIKE_FILTERS[i].match(name)) return true;
    }
    return false;
  }

  /** Envia comando BGAPI ao dongle */
  function _sendCmd(cmd) {
    if (!_writer) return Promise.reject(new Error('BLED112 não conectado'));
    return _writer.write(cmd);
  }

  // ── Parser de pacotes BGAPI recebidos ────────────────────────

  /**
   * Acumula bytes no buffer e processa pacotes completos.
   * Formato BGAPI: [type 1B][length 1B][class 1B][command 1B][payload length B]
   */
  function _processBuf() {
    while (_bufLen >= 4) {
      var pktLen = 4 + _buffer[1]; // header(4) + payload
      if (_bufLen < pktLen) break; // pacote incompleto

      var pktType = _buffer[0];
      var pktClass = _buffer[2];
      var pktEvt  = _buffer[3];
      var payload = _buffer.slice(4, pktLen);

      _handlePacket(pktType, pktClass, pktEvt, payload);

      // Avançar buffer
      _buffer.copyWithin(0, pktLen);
      _bufLen -= pktLen;
    }
  }

  // Velocidades a tentar, na ordem. 256000 e a do firmware BGAPI que vinha
  // sendo usado; 115200 e o padrao de fabrica do BLED112. Dongle com firmware
  // diferente abre a porta normalmente e simplesmente nao entende o comando —
  // nao responde e nem acende. Por isso nao da para fixar um numero.
  var BAUDS = [256000, 115200, 57600, 38400, 9600];
  var _baudOk = null;        // a que funcionou; tentada primeiro da proxima vez

  var _ultimaResposta = 0;   // quando o dongle falou pela ultima vez

  // ── PROVA DE VIDA ─────────────────────────────────────────────
  // Abrir a porta NAO significa que o dongle esta do outro lado, nem que ele
  // entende o que mandamos. Duas falhas silenciosas possiveis:
  //   1) porta fantasma: autorizacao velha, de uma enumeracao USB que ja morreu;
  //   2) velocidade errada: o comando sai, chega como ruido, ninguem responde.
  // Nos dois casos o open() passa e o write() passa. So o system_hello diz a
  // verdade. Tenta cada velocidade; a que responder fica guardada.
  // Solta o leitor e o escritor da porta e espera o laco de leitura terminar.
  // Sem isto, a tentativa seguinte chamava getReader() num fluxo ainda preso ao
  // leitor anterior e estourava: "streams that are not yet locked to a reader".
  // Era o que quebrava a prova de vida a partir da segunda velocidade.
  // Cada vez que a porta e reiniciada, a geracao avanca. O laco de leitura
  // confere a sua geracao a cada volta e sai sozinho se ficou velho.
  // Sem isto: o laco antigo so terminava quando a porta FECHAVA. O watchdog
  // reinicia sem fechar, entao um laco novo nascia e o velho continuava vivo.
  // Com a sala parada o watchdog dispara a cada 12s — em dez minutos eram
  // dezenas de lacos disputando a mesma porta, ate a tela travar.
  var _geracao = 0;

  async function _soltarPorta(){
    _geracao++;
    BLED112.connected = false;
    try { if (_reader) await _reader.cancel(); } catch(_){}
    try { if (_reader) _reader.releaseLock(); } catch(_){}
    _reader = null;
    try { if (_writer) _writer.releaseLock(); } catch(_){}
    _writer = null;
    await new Promise(function(r){ setTimeout(r, 60); });   // deixa o laco sair
  }

  async function _provaDeVida(){
    var ordem = _baudOk ? [_baudOk].concat(BAUDS.filter(function(b){return b!==_baudOk;})) : BAUDS;
    for (var bi = 0; bi < ordem.length; bi++) {
      var baud = ordem[bi];
      await _soltarPorta();
      try {
        if (!_port.readable) { try { await _port.close(); } catch(_){} await _port.open({ baudRate: baud }); }
      } catch(e) { continue; }
      try { _writer = _port.writable.getWriter(); } catch(e) { continue; }
      BLED112.connected = true;
      _bufLen = 0;
      _readLoop().catch(function(e){ console.warn('[BLED112] readLoop terminou:', e); });
      _ultimaResposta = 0;
      try { await _sendCmd(BGAPI.CMD_SYSTEM_HELLO); } catch(e){}
      var vivo = await new Promise(function(res){
        var t0 = Date.now();
        var iv = setInterval(function(){
          if (_ultimaResposta > 0) { clearInterval(iv); res(true); }
          else if (Date.now() - t0 > 900) { clearInterval(iv); res(false); }
        }, 40);
      });
      if (vivo) {
        _baudOk = baud;
        console.log('[BLED112] Dongle respondeu a ' + baud + ' baud.');
        return true;
      }
      await _soltarPorta();
      try { await _port.close(); } catch(e){}
    }
    await _soltarPorta();
    return false;
  }
  function _handlePacket(type, cls, evt, payload) {
    _ultimaResposta = Date.now();   // veio QUALQUER coisa: o dongle esta vivo
    // ── Evento scan response (advertisement recebido) ──
    if (type === 0x80 && cls === 0x06 && evt === 0x00) {
      // BGAPI evt_gap_scan_response: [rssi(signed), packet_type, mac(6B LE), addr_type, bond, data_len, data...]
      if (payload.length < 10) return;
      var rssi     = payload[0] > 127 ? payload[0] - 256 : payload[0]; // signed int8
      var advType  = payload[1];
      var mac      = _macToStr(payload.slice(2, 8));
      var addrType = payload[8];
      // payload[9] = bond, payload[10] = data_len
      var dataLen  = payload[10];
      var adParsed = null;
      if (payload.length > 11 && dataLen > 0) {
        adParsed = _parseAdData(payload, 11, dataLen);
      }
      var name = adParsed ? adParsed.name : null;

      // Keiser M3i: nome "M3" + bikeId no manufacturer data
      if (adParsed && adParsed.bikeId !== null) {
        // Mostrar como "M3 #01", "M3 #02" etc. para identificar a bike
        name = 'M3 #' + ('0' + adParsed.bikeId).slice(-2);
      }

      if (_onDeviceCb && name && _isBikeKnown(name)) {
        _onDeviceCb({
          mac: mac, name: name, rssi: rssi, addrType: addrType,
          bikeId:    adParsed ? adParsed.bikeId    : null,
          watts:     adParsed ? adParsed.watts      : 0,
          cadence:   adParsed ? adParsed.cadence    : 0,
          heartRate: adParsed ? adParsed.heartRate  : 0,
          gear:      adParsed ? adParsed.gear       : 0
        });
      }
      return;
    }

    // ── Evento connection status ──
    if (type === 0x80 && cls === 0x03 && evt === 0x00) {
      // payload[0] = handle, payload[1] = flags
      var handle = payload[0];
      var flags  = payload[1];
      if ((flags & 0x01) && _connections[handle] && _connections[handle].onConnect) {
        _connections[handle].onConnect(handle);
      }
      return;
    }

    // ── Evento GATT notification/indication ──
    if (type === 0x80 && cls === 0x04 && evt === 0x05) {
      // payload[0] = conn, payload[1-2] = attHandle LE, payload[3] = type, payload[4] = len, payload[5...] = value
      var conn    = payload[0];
      var attVal  = payload.slice(5);
      if (_connections[conn] && _connections[conn].onValue) {
        _connections[conn].onValue(attVal);
      }
      return;
    }
  }

  // ── Loop de leitura da porta serial ──────────────────────────

  // Marca de tempo do ultimo pacote recebido — usada pelo watchdog
  var _ultimoDado = 0;
  function _tocouDado(){ _ultimoDado = Date.now(); }

  async function _readLoop() {
    var _minhaGer = _geracao;
    while (_port && _port.readable) {
      if (_minhaGer !== _geracao) return;      // laco velho: sai sem barulho
      try { _reader = _port.readable.getReader(); }
      catch(e) { return; }                     // outro laco ja tem o leitor

      try {
        while (true) {
          var result = await _reader.read();
          if (result.done) break;
          var chunk = result.value;
          // Acumular no buffer
          for (var i = 0; i < chunk.length; i++) {
            if (_bufLen < _buffer.length) {
              _buffer[_bufLen++] = chunk[i];
            }
          }
          _tocouDado();
          _processBuf();
        }
      } catch(e) {
        console.warn('[BLED112] Erro leitura serial:', e);
      } finally {
        try { _reader.releaseLock(); } catch(_){}
        _reader = null;
      }
      if (!_port || !_port.readable) break;
      if (_minhaGer !== _geracao) return;
    }
    // O loop so termina quando a porta morre. Antes ele saia em silencio e
    // BLED112.connected continuava true: o app achava que estava ligado e as
    // bikes simplesmente paravam de aparecer. Agora avisa e tenta voltar.
    console.warn('[BLED112] leitura encerrada — porta caiu.');
    BLED112.connected = false;
    try { if (_writer) { _writer.releaseLock(); _writer = null; } } catch(_){}
    try { if (_port) { await _port.close(); } } catch(_){}
    _port = null;
    if (typeof BLED112.onQueda === 'function') { try{ BLED112.onQueda(); }catch(_){} }
    _agendarReconexao();
  }

  // ── RECONEXAO AUTOMATICA ─────────────────────────────────────
  // A permissao da porta ja foi dada uma vez; getPorts() devolve o dongle sem
  // dialogo nenhum. Entao da para religar sozinho, sem ninguem tocar no mouse.
  var _reconTimer = null, _reconDelay = 2000, _reconLigado = true;
  function _agendarReconexao(){
    if (!_reconLigado || _reconTimer) return;
    _reconTimer = setTimeout(async function(){
      _reconTimer = null;
      if (BLED112.connected) return;
      try {
        console.log('[BLED112] tentando reconectar...');
        await BLED112.connect();
        if (BLED112.connected) {
          _reconDelay = 2000;
          console.log('[BLED112] reconectado.');
          if (typeof BLED112.onVoltou === 'function') { try{ BLED112.onVoltou(); }catch(_){} }
          return;
        }
      } catch(e) {
        // Falta de clique nao se resolve tentando de novo: para aqui e espera
        // uma acao do professor. Sem isto o sistema entrava num ciclo infinito
        // de "requestPort falhou -> DONGLE_NAO_RESPONDE -> tentando reconectar".
        if (e && e.precisaDeClique) {
          console.error('[BLED112] o navegador exige um CLIQUE para autorizar a porta. '
            + 'A reconexao automatica foi PAUSADA. Abra o pareamento de bikes e clique em '
            + 'conectar para autorizar — depois disso ela volta a funcionar sozinha.');
          _reconLigado = false;
          if (typeof BLED112.onPrecisaClique === 'function') { try{ BLED112.onPrecisaClique(); }catch(_){} }
          return;
        }
        console.warn('[BLED112] reconexao falhou:', e && e.message ? e.message : e);
      }
      _reconDelay = Math.min(_reconDelay * 2, 10000);   // 2s -> 4s -> 8s -> 10s
      _agendarReconexao();
    }, _reconDelay);
  }

  // Watchdog: dongle "conectado" mas sem um unico pacote ha 20s = caiu de fato.
  // Acontece quando o Windows suspende a porta USB e a serial nao gera erro.
  setInterval(async function(){
    if (!BLED112.connected || !_ultimoDado) return;
    // Na tela de pareamento, com a sala parada, NENHUMA bike transmite (a Keiser
    // so anuncia com o pedal girando). Reiniciar a porta aqui e reiniciar a toa
    // — e era o que alimentava o acumulo de lacos ate travar.
    if (window.PR_PAREANDO) return;
    if (Date.now() - _ultimoDado > 12000) {
      console.warn('[BLED112] 12s sem dados — reiniciando a porta.');
      _ultimoDado = 0;
      // Fechar a porta com o leitor ainda preso estourava
      //   "Cannot cancel a locked stream"
      // e a reabertura nunca acontecia: o Bluetooth morria no meio do
      // pareamento e as bikes sumiam da tela. Solta leitor e escritor antes.
      try { await _soltarPorta(); } catch(_){}
      try { if (_port) await _port.close(); } catch(_){}
      _agendarReconexao();                 // e manda religar
    }
  }, 5000);

  // Dongle arrancado / espetado fisicamente
  try {
    if (navigator.serial && navigator.serial.addEventListener) {
      navigator.serial.addEventListener('disconnect', function(){
        console.warn('[BLED112] dongle removido da USB.');
        BLED112.connected = false; _port = null; _agendarReconexao();
      });
      navigator.serial.addEventListener('connect', function(){
        console.log('[BLED112] dongle detectado na USB.');
        _reconDelay = 1000; _agendarReconexao();
      });
    }
  } catch(e){}

  // ── API pública ───────────────────────────────────────────────

  var BLED112 = {

    /** Indica se o dongle está conectado */
    connected: false,

    /** Callbacks opcionais: BLED112.onQueda / BLED112.onVoltou */
    onQueda: null,
    onVoltou: null,

    /** Segundos desde o último pacote recebido (null se nunca recebeu) */
    segSemDados: function(){ return _ultimoDado ? Math.round((Date.now()-_ultimoDado)/1000) : null; },

    /**
     * Abre seletor de porta serial e conecta ao BLED112.
     * Requer Web Serial API (Chrome/Edge em HTTPS ou localhost).
     */
    // Qualquer conexao acionada a mao e, justamente, o clique que faltava:
    // religa a reconexao automatica que foi pausada.
    retomarReconexao: function(){ _reconLigado = true; _reconDelay = 2000; },

    connect: async function() {
      _reconLigado = true;
      if (!('serial' in navigator)) {
        var msg = 'Web Serial API não disponível. Use Chrome/Edge e abra via localhost ou HTTPS.';
        console.warn('[BLED112]', msg);
        throw new Error(msg);
      }
      if (BLED112.connected) return; // já conectado

      // Unificado em 23/09d a partir do bled112.js do EXECUTAVEL (Electron).
      // No Electron a porta e pedida direto com requestPort (o processo
      // principal escolhe o dongle pelo usbVendorId). No Chrome/Edge segue o
      // caminho de sempre (portas ja autorizadas -> dialogo), sem mudanca.
      var _emElectron = /Electron/i.test(navigator.userAgent);
      var abriu = false;
      if (_emElectron) {
        try {
          _port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x2458 }] });
          await _port.open({ baudRate: (_baudOk || 256000) });
          abriu = await _provaDeVida();
        } catch(e) {
          console.warn('[BLED112] Electron requestPort falhou:', e && e.message ? e.message : e);
        }
      } else {

      // Auto-conectar a uma porta ja autorizada (sem dialogo).
      // IMPORTANTE: quando o Windows re-enumera a USB (o "din-don" de dispositivo
      // conectado), o objeto de porta ANTIGO fica morto e o getPorts() devolve um
      // objeto NOVO. Por isso nao basta pegar o primeiro da lista: e preciso
      // TENTAR ABRIR cada candidato e ficar com o que realmente abrir.
      var abriu = false;
      try {
        // A API do Web Serial e getPorts(). getGrantedPorts() NAO EXISTE.
        var granted = await (navigator.serial.getPorts
                             ? navigator.serial.getPorts()
                             : navigator.serial.getGrantedPorts());
        var cand = [];
        for (var i = 0; i < granted.length; i++) {
          var info = granted[i].getInfo ? granted[i].getInfo() : {};
          if (!info.usbVendorId || info.usbVendorId === 0x2458) cand.push(granted[i]);
        }
        console.log('[BLED112] portas autorizadas: ' + granted.length + ' | candidatas: ' + cand.length);
        // Com o dongle re-enumerado muitas vezes, o Chrome acumula DEZENAS de
        // autorizacoes no perfil — ja vimos 40. Quase todas sao fantasmas: abrem
        // sem erro e nao tem nada do outro lado. Por isso nao basta ficar com a
        // primeira que ABRIR: e preciso ficar com a primeira que RESPONDER.
        for (var k = 0; k < cand.length; k++) {
          try {
            await cand[k].open({ baudRate: (_baudOk||256000) });
          } catch(eo) {
            console.warn('[BLED112] candidata ' + (k+1) + '/' + cand.length + ' nao abriu: ' + (eo && eo.message ? eo.message : eo));
            try { await cand[k].close(); } catch(_){}
            continue;
          }
          // abriu — agora pergunta se tem alguem do outro lado
          _port = cand[k];
          if (await _provaDeVida()) { abriu = true; break; }
          console.warn('[BLED112] candidata ' + (k+1) + '/' + cand.length + ' abriu mas nao respondeu (porta fantasma).');
          await _soltarPorta();
          try { await cand[k].close(); } catch(_){}
          _port = null;
        }
        if (!abriu && cand.length > 3) {
          console.warn('[BLED112] ' + cand.length + ' portas autorizadas e nenhuma respondeu. '
            + 'O perfil acumulou autorizacoes velhas de cada vez que o USB foi re-enumerado. '
            + 'Limpar em chrome://settings/content/serialPorts e autorizar de novo.');
        }
      } catch(e) { console.warn('[BLED112] getPorts falhou:', e && e.message ? e.message : e); }

      // Nenhuma porta autorizada abriu: aí sim o diálogo (precisa de clique)
      if (!abriu) {
        try {
          _port = await navigator.serial.requestPort({
            filters: [{ usbVendorId: 0x2458, usbProductId: 0x0001 }]
          });
        } catch(e) {
          try {
            _port = await navigator.serial.requestPort();
          } catch(e2) {
            var _m2 = (e2 && e2.message) ? e2.message : String(e2);
            // "Must be handling a user gesture" nunca vai funcionar sozinho:
            // pedir a porta exige um clique. Insistir automaticamente e gastar
            // o processador a toa e encher o Console — o que, com o F12 aberto,
            // chega a travar a tela.
            var _erro = new Error('Porta serial nao selecionada: ' + _m2);
            if (/user gesture/i.test(_m2)) _erro.precisaDeClique = true;
            throw _erro;
          }
        }
        await _port.open({ baudRate: (_baudOk||256000) });
        abriu = await _provaDeVida();
      }
      } // fim else (Chrome/navegador normal)

      // ja provado no laco das candidatas (ou no dialogo, abaixo)
      var _vivo = BLED112.connected;
      if (!_vivo) {
        BLED112.connected = false;
        _port = null;
        console.error('[BLED112] O dongle NAO respondeu em nenhuma velocidade ('
          + BAUDS.join(', ') + '). A porta abre mas nada chega do outro lado.\n'
          + '1) Tirar e por o dongle na USB;\n'
          + '2) Limpar a autorizacao em chrome://settings/content/serialPorts;\n'
          + '3) Se persistir, a porta pode estar presa por outro programa ou por '
          + 'outra janela do Chrome aberta com o mesmo perfil.');
        throw new Error('DONGLE_NAO_RESPONDE');
      }

      // (o loop de leitura ja foi iniciado antes da prova de vida)
    },

    /**
     * Inicia scan BLE. Chama onDevice para cada bike/sensor encontrado.
     * @param {function} onDevice - callback({ mac, name, rssi, addrType })
     */
    startScan: async function(onDevice) {
      if (!BLED112.connected) throw new Error('BLED112 não conectado. Chama connect() primeiro.');
      _onDeviceCb = onDevice;
      _scanning = true;
      await _sendCmd(BGAPI.CMD_GAP_DISCOVER);
      console.log('[BLED112] Scan iniciado.');
    },

    /** Para o scan BLE */
    stopScan: async function() {
      _scanning = false;
      _onDeviceCb = null;
      try { await _sendCmd(BGAPI.CMD_GAP_STOP_PROC); } catch(e){}
      console.log('[BLED112] Scan parado.');
    },

    /**
     * Liga-se diretamente a um dispositivo BLE.
     * @param {string} mac - "AA:BB:CC:DD:EE:FF"
     * @param {number} addrType - 0=public, 1=random
     * @param {function} onConnect - callback(connHandle) quando ligado
     * @returns {number} connHandle esperado (0 na primeira ligação)
     */
    connectDevice: async function(mac, addrType, onConnect) {
      if (!BLED112.connected) throw new Error('BLED112 não conectado.');

      // Converter MAC string para 6 bytes little-endian
      var parts = mac.split(':');
      var macBytes = new Uint8Array(6);
      for (var i = 0; i < 6; i++) {
        macBytes[i] = parseInt(parts[5 - i], 16);
      }

      // GAP_CONNECT_DIRECT
      // [type, len, class, cmd, mac(6), addr_type, conn_interval_min(2), conn_interval_max(2), timeout(2), latency(2), min_ce(2), max_ce(2)]
      var cmd = new Uint8Array([
        0x00, 0x0F, 0x06, 0x03,
        macBytes[0], macBytes[1], macBytes[2], macBytes[3], macBytes[4], macBytes[5],
        addrType & 0xFF,
        0x06, 0x00,  // conn_interval_min = 7.5ms
        0x0C, 0x00,  // conn_interval_max = 15ms
        0x64, 0x00,  // timeout = 100 * 10ms = 1s
        0x00, 0x00,  // latency = 0
        0xE8, 0x03   // min/max CE length
      ]);

      var handle = 0; // handle esperado
      _connections[handle] = { onConnect: onConnect, onValue: null };
      await _sendCmd(cmd);
      console.log('[BLED112] A conectar a', mac);
      return handle;
    },

    /**
     * Descobre serviços GATT (ATT_FIND_BY_TYPE_VALUE para Primary Service).
     * @param {number} connHandle
     */
    discoverServices: async function(connHandle) {
      // ATTCLIENT_READ_BY_GROUP_TYPE (Primary Services)
      var cmd = new Uint8Array([
        0x00, 0x06, 0x04, 0x01,
        connHandle & 0xFF,
        0x01, 0x00,  // start handle
        0xFF, 0xFF,  // end handle
        0x02,        // UUID len
        0x00, 0x28   // UUID = 0x2800 (Primary Service)
      ]);
      await _sendCmd(cmd);
    },

    /**
     * Subscreve notificações de uma característica.
     * @param {number} connHandle
     * @param {number} charHandle - handle da characteristic
     * @param {function} onValue - callback(Uint8Array)
     */
    subscribe: async function(connHandle, charHandle, onValue) {
      if (_connections[connHandle]) {
        _connections[connHandle].onValue = onValue;
      } else {
        _connections[connHandle] = { onConnect: null, onValue: onValue };
      }
      // Escrever 0x0001 no CCCD (charHandle + 1 geralmente)
      var cccdHandle = charHandle + 1;
      var cmd = new Uint8Array([
        0x00, 0x05, 0x04, 0x05,
        connHandle & 0xFF,
        cccdHandle & 0xFF, (cccdHandle >> 8) & 0xFF,
        0x01, 0x00  // enable notifications
      ]);
      await _sendCmd(cmd);
    },

    /**
     * Desliga um dispositivo conectado.
     * @param {number} connHandle
     */
    disconnect: async function(connHandle) {
      var cmd = new Uint8Array([0x00, 0x01, 0x03, 0x00, connHandle & 0xFF]);
      try { await _sendCmd(cmd); } catch(e){}
      delete _connections[connHandle];
      console.log('[BLED112] Desconectado handle', connHandle);
    },

    /**
     * Fecha a porta serial completamente.
     */
    close: async function() {
      _scanning = false;
      _onDeviceCb = null;
      try { if (_writer) { _writer.releaseLock(); _writer = null; } } catch(_){}
      try { if (_reader) { _reader.cancel(); _reader = null; } } catch(_){}
      try { if (_port) { await _port.close(); _port = null; } } catch(_){}
      _connections = {};
      BLED112.connected = false;
      console.log('[BLED112] Porta serial fechada.');
    },

    /** Lista de filtros de bikes (para uso externo se necessário) */
    BIKE_FILTERS: BIKE_FILTERS,
  };

  global.BLED112 = BLED112;

})(window);
