// 03/10s — CARGA AUTOMÁTICA (ERG) no app: o rolo/bike inteligente recebe a potência-alvo de cada bloco.
// Abre o app de verdade num navegador e usa um "rolo de mentira" que guarda os comandos recebidos.
// Precisa do Playwright (o mesmo do teste da TV); sem ele, é pulado com aviso (código 3).
const path = require('path');
const B = 'http://127.0.0.1:3999', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste do ERG PULADO.\n    Instale uma vez: npm i -D playwright && npx playwright install chromium'); process.exit(3); }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const nav = await chromium.launch(); const p = await nav.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on('pageerror', e => erros.push(e.message.slice(0, 160)));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.goto(B + '/aluno/'); await espera(1500);
  // rolo de mentira: FTMS com dados + Control Point (responde 0x80 <cmd> 01)
  await p.evaluate(() => {
    window.__cmd = [];
    const ev = () => { const l = []; return { addEventListener: (n, fn) => l.push(fn), _l: l }; };
    const dados = Object.assign(ev(), { startNotifications: () => Promise.resolve() });
    const cp = Object.assign(ev(), { startNotifications: () => Promise.resolve(),
      writeValueWithResponse(v) { const b = [...v]; __cmd.push(b); const r = new DataView(new Uint8Array([0x80, b[0], window.__recusar ? (window.__codRec || 3) : 1]).buffer); setTimeout(() => cp._l.forEach(fn => fn({ target: { value: r } })), 5); return Promise.resolve(); } });
    window.__rolo = { server: { getPrimaryService: u => Promise.resolve({ getCharacteristic: c => /2ad2/.test(c) ? Promise.resolve(dados) : /2ad9/.test(c) ? Promise.resolve(cp) : Promise.reject(new Error('sem')) }) },
      device: { name: 'KICKR TESTE', addEventListener() {} } };
    // rolo que só aceita NÍVEL DE RESISTÊNCIA (Fitness Machine Feature: bit 2) com faixa 0–100,0
    const feat = { readValue: () => { const v = new DataView(new ArrayBuffer(8)); v.setUint32(0, 0, true); v.setUint32(4, 1 << 2, true); return Promise.resolve(v); } };
    const faixa = { readValue: () => { const v = new DataView(new ArrayBuffer(6)); v.setInt16(0, 0, true); v.setInt16(2, 1000, true); v.setUint16(4, 10, true); return Promise.resolve(v); } };
    window.__roloRes = { server: { getPrimaryService: u => Promise.resolve({ getCharacteristic: c => /2ad2/.test(c) ? Promise.resolve(dados) : /2ad9/.test(c) ? Promise.resolve(cp) : /2acc/.test(c) ? Promise.resolve(feat) : /2ad6/.test(c) ? Promise.resolve(faixa) : Promise.reject(new Error('sem')) }) },
      device: { name: 'ROLO SÓ RESISTÊNCIA', addEventListener() {} } };
    window.__soLe = { server: { getPrimaryService: u => /1826/.test(u) ? Promise.resolve({ getCharacteristic: c => /2ad2/.test(c) ? Promise.resolve(dados) : Promise.reject(new Error('sem controle')) }) : Promise.reject(new Error('x')) },
      device: { name: 'BIKE SÓ LÊ', addEventListener() {} } };
  });
  console.log('1) Conectar');
  await p.evaluate(() => { go('sConnect'); return btConnectBike(__soLe.server, __soLe.device); }); await espera(200);
  let s = await p.evaluate(() => ({ cp: !!_erg.cp, vis: getComputedStyle(document.getElementById('cnErg')).display }));
  ok(!s.cp && s.vis === 'none', 'aparelho que só mostra números: sem opção de carga (conecta normal)', s);
  await p.evaluate(() => btConnectBike(__rolo.server, __rolo.device)); await espera(200);
  s = await p.evaluate(() => ({ cp: !!_erg.cp, vis: getComputedStyle(document.getElementById('cnErg')).display, txt: document.getElementById('cnErg').innerText, tipo: window._prBikeTipo }));
  ok(s.cp && s.vis === 'flex' && /DESLIGADA/.test(s.txt) && s.tipo === 'ftms', 'rolo com controle: aparece "Carga automática (ERG)", começa desligada', s);
  await p.click('#cnErg'); await espera(100);
  s = await p.evaluate(() => ({ liga: _erg.liga, mem: localStorage.getItem('pr_erg'), txt: document.getElementById('cnErg').innerText }));
  ok(s.liga && s.mem === '1' && /LIGADA/.test(s.txt), 'um toque liga e fica guardado no celular', s);
  await p.evaluate(() => _ergTick()); await espera(100);
  ok(await p.evaluate(() => __cmd.length === 0), 'fora da aula não manda carga nenhuma');

  console.log('2) Aula do app');
  await p.evaluate(() => { _ftpDaAula = 200; aulaGrafico = [{ z: 'z4', ftpMin: 91, ftpMax: 105 }, { z: 'z2', ftpMin: 56, ftpMax: 75 }, { z: 'z7', ftpMin: 150, ftpMax: 999 }]; aulaBlocoIdx = 0; isPaused = false;
    document.querySelectorAll('.screen').forEach(x => x.classList.remove('active')); document.getElementById('sLive').classList.add('active'); _ergTick(); });
  await espera(150);
  let c = await p.evaluate(() => __cmd.map(x => x.join(',')));
  ok(c.join('|') === '0|7|5,196,0', 'pede o controle, começa e manda 196 W (FTP 200 × 98%)', c);
  ok(await p.evaluate(() => { const e = document.getElementById('ergPill'); return !!e && e.style.display !== 'none' && /196 W/.test(e.innerText); }), 'etiqueta "ERG 196 W" na aula');
  await p.evaluate(() => { __cmd = []; _ergTick(); _ergTick(); }); await espera(100);
  ok(await p.evaluate(() => __cmd.length === 0), 'mesmo bloco: não repete o comando a cada segundo');
  await p.evaluate(() => { __cmd = []; aulaBlocoIdx = 1; _ergTick(); }); await espera(100);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '5,131,0', 'bloco novo: 131 W', c);
  await p.evaluate(() => { __cmd = []; aulaBlocoIdx = 2; _ergTick(); }); await espera(100);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '5,64,1', 'Z7 (150–999%) vira 150–170%: 320 W', c);
  await p.evaluate(() => { __cmd = []; isPaused = true; _ergTick(); }); await espera(100);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '8,1', 'pausou: solta o rolo', c);
  await p.evaluate(() => { __cmd = []; isPaused = false; aulaBlocoIdx = 0; _ergTick(); }); await espera(100);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '0|7|5,196,0', 'voltou: pede o controle de novo e retoma', c);
  await p.evaluate(() => { __cmd = []; document.getElementById('ergPill').click(); }); await espera(150);
  s = await p.evaluate(() => ({ c: __cmd.map(x => x.join(',')), liga: _erg.liga, pill: document.getElementById('ergPill').style.display }));
  ok(s.c.join('|') === '8,1' && !s.liga && s.pill === 'none', 'toque na etiqueta: desliga e solta na hora', s);

  console.log('3) Aula gravada e casos');
  await p.evaluate(() => { __cmd = []; _erg.liga = true; document.getElementById('sLive').classList.remove('active'); window._prErgGrv = { b: { ftpMin: 76, ftpMax: 90 }, pausa: false, ts: Date.now() }; _ergTick(); }); await espera(100);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '0|7|5,166,0', 'aula gravada: segue o bloco do vídeo (166 W)', c);
  await p.evaluate(() => { __cmd = []; window._prErgGrv.pausa = true; _ergTick(); }); await espera(100);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '8,1', 'vídeo pausado: solta o rolo', c);
  await p.evaluate(() => { __cmd = []; window._prErgGrv = null; _ftpDaAula = 0; profData.ftp = ''; try { localStorage.removeItem('pr_ftp'); } catch (e) {} document.getElementById('sLive').classList.add('active'); _ergTick(); }); await espera(100);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '0|7|5,127,0', 'aluno sem FTP no perfil: usa 130 (padrão do app) → 127 W', c);
  await p.evaluate(() => { __cmd = []; _ftpDaAula = 200; window.__recusar = true; _ergTick(); }); await espera(150);
  s = await p.evaluate(() => ({ n: __cmd.length, rec: _erg.recusas, modo: _erg.modo })); ok(s.n === 1 && s.rec >= 1 && s.modo === 'sim', 'rolo recusa a POTÊNCIA: o app não trava e passa para SUBIDA', s);
  await p.evaluate(() => { __cmd = []; window.__recusar = false; _ergTick(); }); await espera(150);
  s = await p.evaluate(() => ({ c: __cmd.map(x => x.join(',')), pill: document.getElementById('ergPill').innerText }));
  ok(s.c.join('|') === '17,0,0,18,2,40,51' && /196 W/.test(s.pill) && /subida 5,3%/.test(s.pill), 'modo subida: 98% FTP → inclinação 5,3% (e a etiqueta mostra)', s);
  await p.evaluate(() => { __cmd = []; aulaGrafico = [{ ftpMin: 50, ftpMax: 150, pos: 'Livre' }]; aulaBlocoIdx = 0; _ergTick(); }); await espera(100);
  s = await p.evaluate(() => ({ c: __cmd.map(x => x.join(',')), pill: document.getElementById('ergPill').innerText }));
  ok(s.c.join('|') === '8,1' && /sem alvo/.test(s.pill), 'bloco LIVRE: solta o rolo e a etiqueta diz "sem alvo"', s);
  await p.evaluate(() => { __cmd = []; aulaGrafico = [{ ftpMin: 91, ftpMax: 105 }]; window.__recusar = true; window.__codRec = 5; _ergTick(); }); await espera(150);
  s = await p.evaluate(() => ({ e: _erg.estado, pill: document.getElementById('ergPill').innerText }));
  ok(s.e === 'bloqueado' && /não liberou/.test(s.pill), 'outro app com o controle (código 5): a etiqueta avisa para fechar o outro app', s);
  await p.evaluate(() => { window.__recusar = false; window.__codRec = 0; __cmd = []; _erg.ctrlTs = 0; _ergTick(); }); await espera(150);
  s = await p.evaluate(() => ({ c: __cmd.map(x => x.join(',')), e: _erg.estado })); ok(s.c[0] === '0' && s.e !== 'bloqueado', 'depois de 10 s pede o controle de novo e volta ao normal', s);

  console.log('4) Rolo que só aceita nível de resistência');
  await p.evaluate(() => { _erg.ctrl = false; return btConnectBike(__roloRes.server, __roloRes.device); }); await espera(250);
  s = await p.evaluate(() => ({ modo: _erg.modo, fx: _erg.faixaRes })); ok(s.modo === 'res' && s.fx && s.fx.max === 1000, 'lê o que o rolo aceita (só resistência) e a faixa 0–100,0', s);
  await p.evaluate(() => { __cmd = []; _ergTick(); }); await espera(150);
  c = await p.evaluate(() => __cmd.map(x => x.join(','))); ok(c.join('|') === '0|7|4,132,2', 'manda o NÍVEL: 98% FTP → 64% da faixa (raw 644)', c);

  console.log('5) Rolo de cilindro da Elite (Arion / Nero): trabalha por subida, como no Zwift');
  await p.evaluate(() => { _erg.ctrl = false; return btConnectBike(__rolo.server, { name: 'ARION 52831', addEventListener() {} }); }); await espera(250);
  await p.evaluate(() => { __cmd = []; aulaGrafico = [{ ftpMin: 91, ftpMax: 105 }]; aulaBlocoIdx = 0; _ergTick(); }); await espera(150);
  s = await p.evaluate(() => ({ modo: _erg.modo, c: __cmd.map(x => x.join(',')), pill: document.getElementById('ergPill').innerText }));
  ok(s.modo === 'sim' && s.c.join('|') === '0|7|17,0,0,18,2,40,51' && /subida/.test(s.pill), 'Elite ARION: começa direto pela SUBIDA (5,3%)', s);
  await p.evaluate(() => { _erg.ctrl = false; return btConnectBike(__rolo.server, { name: 'NERO 10442', addEventListener() {} }); }); await espera(250);
  ok(await p.evaluate(() => _erg.modo === 'sim'), 'Elite NERO: também pela subida');
  await p.evaluate(() => { _erg.ctrl = false; return btConnectBike(__rolo.server, { name: 'KICKR TESTE', addEventListener() {} }); }); await espera(250);
  ok(await p.evaluate(() => _erg.modo === 'pot'), 'rolo de roda tirada (KICKR): continua por POTÊNCIA (watts fixos)');
  ok(erros.length === 0, 'nenhum erro de JavaScript no app', erros.slice(0, 3));
  await nav.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
