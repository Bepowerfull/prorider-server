// 07/10a — KEISER DIRETO NO CELULAR (app das lojas). A Keiser M3i não aceita conexão: ela anuncia
// os números no ar. Aqui o app de verdade roda com um plugin Bluetooth de mentira que "transmite"
// anúncios Keiser no formato oficial (dev.keiser.com/mseries/direct) e confere:
//  1) em casa: a lista mostra "Keiser M3 nº 7" e "nº 8"; escolher a 7 lê só a 7, sem tentar conectar;
//     o resumo (review, depois que parou) é ignorado.
//  2) na aula da academia: a TV diz que a bike 3 da sala é a Keiser nº 12; o celular ouve a nº 12 direto
//     e o ponteiro usa esse número (com o FTP do aluno), mesmo com a TV mandando outro valor;
//     quando o anúncio some, volta a valer o número que vem da TV.
const path = require('path'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999';
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const { codigoTv } = require('./comum');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste PULADO.'); process.exit(3); }
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const ate = async (pg, fn, arg, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await pg.evaluate(fn, arg); if (v) return v; } catch (e) {} await espera(200); } return null; };
(async () => {
  const nav = await chromium.launch(); const erros = [];
  const p = await nav.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.addInitScript(() => {
    const L = {}, log = window.__ble = { cmd: [], conectou: [], scans: 0 };
    const emit = (k, v) => (L[k] || []).forEach(f => f(v));
    // anúncio Keiser (sem o código 0x0102, como o plugin entrega): versão 6.30
    const hx = a => a.map(n => ('0' + (n & 255).toString(16)).slice(-2)).join('');
    window.__keiser = (id, w, rpm, tipo, g) => hx([6, 30, tipo || 0, id, (rpm * 10) & 255, (rpm * 10) >> 8, 0, 0, w & 255, w >> 8, 50, 0, 10, 5, 0, 0, g || 12]);
    window.__bikes = { 'KA:07': { id: 7, w: 180, rpm: 85 }, 'KA:08': { id: 8, w: 300, rpm: 95 } };
    window.__kOn = true; let scan = null;
    const plug = {
      initialize: () => Promise.resolve(),
      addListener: (k, fn) => { (L[k] = L[k] || []).push(fn); return Promise.resolve({ remove() { L[k] = (L[k] || []).filter(x => x !== fn); } }); },
      requestLEScan: o => { log.cmd.push('scan' + (o && o.allowDuplicates ? '+dup' : '')); log.scans++; clearInterval(scan);
        const tic = () => { if (!window.__kOn) return; for (const [id, b] of Object.entries(window.__bikes)) emit('onScanResult', { device: { deviceId: id, name: id === 'KA:08' ? null : 'M3' }, uuids: [], rssi: -60, manufacturerData: { '258': window.__keiser(b.id, b.w, b.rpm, b.tipo, b.g) } }); };
        setTimeout(tic, 50); scan = setInterval(tic, 300); return Promise.resolve(); },
      stopLEScan: () => { log.cmd.push('stop'); clearInterval(scan); scan = null; return Promise.resolve(); },
      connect: o => { log.conectou.push(o.deviceId); return Promise.reject(new Error('não aceita conexão')); },
      disconnect: () => Promise.resolve(), getServices: () => Promise.resolve({ services: [] }),
      startNotifications: () => Promise.resolve(), stopNotifications: () => Promise.resolve(), write: () => Promise.resolve(), writeWithoutResponse: () => Promise.resolve(), read: () => Promise.resolve({ value: '' })
    };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { BluetoothLe: plug } };
    try { localStorage.setItem('pr_ftp', '200'); } catch (e) {}
  });
  await p.goto(B + '/aluno/'); await espera(1000);
  ok(await p.evaluate(() => !!window.prKeiser && window.prKeiser.parse(window.__keiser(5, 250, 90)).w === 250), 'leitor da Keiser instalado e lendo o formato oficial (250 W)');
  const pc = await p.evaluate(() => ({ a: prKeiser.parse(__keiser(5, 250, 90, 0xFF)).real, b: prKeiser.parse(__keiser(5, 250, 90, 0x83)).real, c: prKeiser.parse('0201' + __keiser(9, 120, 70)).id, g: prKeiser.parse(__keiser(5, 250, 90, 0, 17)).g }));
  ok(pc.a === false && pc.b === true && pc.c === 9 && pc.g === 17, 'resumo (review) marcado, intervalo ao vivo aceito, com/sem código 0x0102, marcha lida', pc);

  console.log('1) Em casa: escolher a Keiser na lista');
  await p.evaluate(() => { go('sConnect'); scanDev('bike'); }); await espera(800);
  const lista = await p.evaluate(() => [...document.querySelectorAll('#prBleLista button')].map(b => b.innerText.split('\n')[0]));
  ok(lista.some(x => /Keiser M3 nº 7/.test(x)) && lista.some(x => /Keiser M3 nº 8/.test(x)), 'lista mostra cada Keiser pelo número dela (a nº 8 chega SEM NOME, como no Android de verdade)', lista);
  await p.evaluate(() => [...document.querySelectorAll('#prBleLista button')].find(b => /nº 7/.test(b.innerText)).click()); await espera(1200);
  let s = await p.evaluate(() => ({ con: connected.bike, w: _bleWatts, r: _bleRpm, tipo: window._prBikeTipo, conectou: __ble.conectou, cmd: __ble.cmd.slice(-3) }));
  ok(s.con && s.w === 180 && s.r === 85 && s.tipo === 'keiser', 'lê só a nº 7 (180 W, 85 rpm), não a 8', s);
  ok(s.conectou.length === 0 && s.cmd.some(c => c === 'scan+dup'), 'não tenta conectar: ouve o anúncio (procura com repetição)', s);
  await p.evaluate(() => { __bikes['KA:07'] = { id: 7, w: 999, rpm: 0, tipo: 0xFF }; }); await espera(900);
  ok(await p.evaluate(() => _bleWatts === 180), 'resumo depois que parou (999 W) é ignorado', await p.evaluate(() => _bleWatts));
  await p.evaluate(() => { __bikes['KA:07'] = { id: 7, w: 210, rpm: 88 }; }); await espera(900);
  ok(await p.evaluate(() => _bleWatts === 210), 'volta a pedalar: número novo (210 W)');
  await p.evaluate(() => { if (window._kCasaOff) { _kCasaOff(); _kCasaOff = null; } connected.bike = false; });

  console.log('2) Na aula da academia: o celular ouve a própria Keiser');
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-keiser', nome_computador: 'TV keiser' })).d.token;
  const tv = new WS(B.replace('http', 'ws')); await new Promise(o => tv.on('open', o));
  const SALA = 'PR-KS01-TEST';
  tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: TK })); await espera(300);
  tv.send(JSON.stringify({ tipo: 'sala_info', numBikes: 5, bikes: [1, 2, 3, 4, 5], ocupadas: [], keiser: { 3: 12, 4: 'x', 9999: 5 } })); await espera(300);
  await p.evaluate(() => { __bikes = { 'KA:12': { id: 12, w: 250, rpm: 92 }, 'KA:13': { id: 13, w: 140, rpm: 70 } }; });
  await p.evaluate(c => connectQR(c), SALA);
  await ate(p, () => document.querySelector('.screen.active') && document.querySelector('.screen.active').id === 'sBikeSel');
  ok(await p.evaluate(() => JSON.stringify(_salaInfo && _salaInfo.keiser) === '{"3":12}'), 'mapa bike→Keiser chega ao app (e o servidor descarta valores errados)', await p.evaluate(() => _salaInfo && _salaInfo.keiser));
  await p.evaluate(() => selectBike(3)); await espera(800);
  tv.send(JSON.stringify({ tipo: 'iniciar_aula', nomeAula: 'Keiser', blocoIdx: 0, grafico: [{ z: 'z3', dur: 5, ftpMin: 76, ftpMax: 90, rpmMin: 85, rpmMax: 95 }] }));
  let relayW = 100;
  const rel = setInterval(() => { try { tv.send(JSON.stringify({ tipo: 'bikes_live', bikes: [{ b: 3, w: relayW, r: 80, ftp: 50, z: 'z1', g: 10, hr: 0, s: 1 }] })); tv.send(JSON.stringify({ tipo: 'update_aula', blocoIdx: 0, segTime: 200, totTime: 20, totRest: 280, nomeAula: 'Keiser', grafico: [{ idx: 0, z: 'z3', dur: 5, ftpMin: 76, ftpMax: 90, rpmMin: 85, rpmMax: 95 }] })); } catch (e) {} }, 250);
  await ate(p, () => document.querySelector('.screen.active') && document.querySelector('.screen.active').id === 'sLive', null, 10000);
  const loc = await ate(p, () => liveRelay && liveRelay.local && liveRelay.w === 250 ? liveRelay : null, null, 8000);
  ok(!!loc && loc.r === 92 && loc.ftp === 125, 'ouve a Keiser nº 12 (bike 3 da sala): 250 W, 92 rpm, 125% do FTP 200 dele', loc);
  await espera(1500);
  s = await p.evaluate(() => ({ w: liveRelay.w, local: liveRelay.local }));
  ok(s.w === 250 && s.local, 'o número da TV (100 W, chega depois) não passa por cima do número direto', s);
  await ate(p, () => /250/.test((document.getElementById('sLive') || {}).innerText || ''), null, 3000);
  ok(await p.evaluate(() => /250/.test(document.getElementById('sLive').innerText)), 'a tela da aula mostra 250 W');
  await p.evaluate(() => { window.__kOn = false; }); await espera(3500);
  s = await p.evaluate(() => ({ w: liveRelay && liveRelay.w, local: liveRelay && liveRelay.local }));
  ok(s.w === 100 && !s.local, 'sem anúncio da Keiser, volta a valer o número da TV (100 W)', s);
  clearInterval(rel); tv.send(JSON.stringify({ tipo: 'fim_aula' })); await espera(1500);
  ok(await p.evaluate(() => !window._kGymOff), 'fim da aula: o celular para de procurar a Keiser');
  ok(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 3));
  tv.close(); await nav.close();
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
