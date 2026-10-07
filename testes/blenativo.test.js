// 03/10s — BLUETOOTH NO APP DAS LOJAS (Capacitor): o app de verdade com um plugin BluetoothLe de
// mentira (um rolo FTMS com controle e uma cinta). Confere que a ponte navigator.bluetooth → plugin
// nativo faz o mesmo que o Chrome: procurar, escolher, conectar, receber os números, mandar a carga.
// Precisa do Playwright; sem ele, é pulado com aviso (código 3).
const path = require('path');
const B = 'http://127.0.0.1:3999', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste do Bluetooth do app PULADO.\n    Instale uma vez: npm i -D playwright && npx playwright install chromium'); process.exit(3); }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const nav = await chromium.launch(); const erros = [];
  // navegador comum: a ponte não liga
  let p = await nav.newPage(); p.on('pageerror', e => erros.push(e.message));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.goto(B + '/aluno/'); await espera(800);
  ok(await p.evaluate(() => !window._prBleNativo), 'no navegador comum a ponte fica desligada');
  await p.close();
  // app "instalado": Capacitor + plugin de mentira
  p = await nav.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.addInitScript(() => {
    const L = {}, log = window.__ble = { cmd: [], escritas: [], conectou: [] };
    const FTMS = '00001826-0000-1000-8000-00805f9b34fb', HRS = '0000180d-0000-1000-8000-00805f9b34fb';
    const emit = (k, v) => (L[k] || []).forEach(f => f(v));
    window.__bleEmit = emit;
    const plug = {
      initialize: () => { log.cmd.push('init'); return Promise.resolve(); },
      addListener: (k, fn) => { (L[k] = L[k] || []).push(fn); return Promise.resolve({ remove() { L[k] = (L[k] || []).filter(x => x !== fn); } }); },
      requestLEScan: () => { log.cmd.push('scan'); setTimeout(() => {
          emit('onScanResult', { device: { deviceId: 'AA:01', name: 'KICKR SIM' }, uuids: [FTMS], rssi: -60 });
          emit('onScanResult', { device: { deviceId: 'BB:02', name: 'Fone qualquer' }, uuids: [], rssi: -50 });
          emit('onScanResult', { device: { deviceId: 'CC:03', name: 'TICKR SIM' }, uuids: [HRS], rssi: -66 }); }, 100); return Promise.resolve(); },
      stopLEScan: () => { log.cmd.push('stop'); return Promise.resolve(); },
      connect: o => { log.conectou.push(o.deviceId); return Promise.resolve(); },
      disconnect: o => { setTimeout(() => emit('disconnected|' + o.deviceId, {}), 10); return Promise.resolve(); },
      getServices: o => Promise.resolve({ services: o.deviceId === 'AA:01'
        ? [{ uuid: FTMS, characteristics: [{ uuid: '00002ad2-0000-1000-8000-00805f9b34fb', properties: { notify: true } }, { uuid: '00002ad9-0000-1000-8000-00805f9b34fb', properties: { write: true, indicate: true } }] }]
        : [{ uuid: HRS, characteristics: [{ uuid: '00002a37-0000-1000-8000-00805f9b34fb', properties: { notify: true } }] }] }),
      startNotifications: o => { log.cmd.push('notif ' + o.characteristic.slice(4, 8)); return Promise.resolve(); },
      stopNotifications: () => Promise.resolve(),
      write: o => { log.escritas.push(o.value); const k = 'notification|' + o.deviceId + '|' + o.service + '|' + o.characteristic; setTimeout(() => emit(k, { value: '80' + o.value.slice(0, 2) + '01' }), 5); return Promise.resolve(); },
      writeWithoutResponse: o => { log.escritas.push(o.value); return Promise.resolve(); },
      read: () => Promise.resolve({ value: '' })
    };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { BluetoothLe: plug } };
  });
  await p.goto(B + '/aluno/'); await espera(1000);
  ok(await p.evaluate(() => window._prBleNativo === true && typeof navigator.bluetooth.requestDevice === 'function'), 'no app instalado a ponte liga o Bluetooth');
  console.log('1) Bike (rolo FTMS com controle)');
  await p.evaluate(() => { go('sConnect'); scanDev('bike'); }); await espera(600);
  const lista = await p.evaluate(() => [...document.querySelectorAll('#prBleLista button')].map(b => b.innerText.split('\n')[0]));
  ok(lista.length === 1 && /KICKR SIM/.test(lista[0]), 'lista mostra só o que é bike (o fone e a cinta não aparecem)', lista);
  await p.click('#prBleLista button'); await espera(600);
  let s = await p.evaluate(() => ({ con: connected.bike, tipo: window._prBikeTipo, erg: !!_erg.cp, cmd: __ble.cmd, st: document.getElementById('stBike').textContent }));
  ok(s.con && s.tipo === 'ftms' && /KICKR SIM/.test(s.st), 'conectou no rolo pelo FTMS', s.st);
  ok(s.cmd.indexOf('stop') >= 0 && s.cmd.indexOf('notif 2ad2') >= 0, 'parou de procurar e ligou os números do rolo', s.cmd);
  ok(s.erg && await p.evaluate(() => getComputedStyle(document.getElementById('cnErg')).display === 'flex'), 'achou o controle de carga (ERG)');
  // FTMS: flags 0x0044 (cadência + potência), velocidade 0, cadência 90 rpm (180 * 0,5), potência 250 W
  await p.evaluate(() => __bleEmit('notification|AA:01|00001826-0000-1000-8000-00805f9b34fb|00002ad2-0000-1000-8000-00805f9b34fb', { value: '44000000b400fa00' })); await espera(100);
  s = await p.evaluate(() => ({ w: _bleWatts, r: _bleRpm }));
  ok(s.w === 250 && s.r === 90, 'números do rolo chegam no app (250 W, 90 rpm)', s);
  await p.evaluate(() => { _erg.liga = true; _ftpDaAula = 200; aulaGrafico = [{ ftpMin: 91, ftpMax: 105 }]; aulaBlocoIdx = 0; isPaused = false; window._prErgGrv = null;
    document.querySelectorAll('.screen').forEach(x => x.classList.remove('active')); document.getElementById('sLive').classList.add('active'); _ergTick(); }); await espera(200);
  s = await p.evaluate(() => ({ e: __ble.escritas, rec: _erg.recusas }));
  ok(s.e.join('|') === '00|07|05c400' && s.rec === 0, 'carga automática chega ao rolo pelo plugin (196 W) e o rolo responde ok', s);
  console.log('2) Cinta');
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach(x => x.classList.remove('active')); go('sConnect'); scanDev('hr'); }); await espera(600);
  const l2 = await p.evaluate(() => [...document.querySelectorAll('#prBleLista button')].map(b => b.innerText.split('\n')[0]));
  ok(l2.length >= 2, 'na cinta a lista mostra todos os aparelhos com nome (como no Chrome)', l2);
  await p.evaluate(() => [...document.querySelectorAll('#prBleLista button')].find(b => /TICKR/.test(b.innerText)).click()); await espera(500);
  await p.evaluate(() => __bleEmit('notification|CC:03|0000180d-0000-1000-8000-00805f9b34fb|00002a37-0000-1000-8000-00805f9b34fb', { value: '0096' })); await espera(100);
  s = await p.evaluate(() => ({ con: connected.hr, hr: window._meuHr && window._meuHr.v }));
  ok(s.con && s.hr === 150, 'cinta conectada e FC chegando (150)', s);
  console.log('3) Cancelar e cair');
  await p.evaluate(() => scanDev('bike')); await espera(400);
  await p.click('#prBleCanc'); await espera(300);
  ok(await p.evaluate(() => !document.getElementById('prBleLista') && /Nenhum aparelho/.test(document.getElementById('stBike').textContent)), 'cancelar fecha a lista e avisa', await p.evaluate(() => document.getElementById('stBike').textContent));
  await p.evaluate(() => __bleEmit('disconnected|CC:03', {})); await espera(300);
  ok(await p.evaluate(() => /reconectando|Tentar|Sinal/i.test(document.getElementById('stHR').textContent)), 'aparelho que cai: o app tenta reconectar', await p.evaluate(() => document.getElementById('stHR').textContent));
  ok(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 3));
  await nav.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
