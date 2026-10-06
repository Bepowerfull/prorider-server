#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ProRider — TESTE DE CARGA (03/10f)
// Simula muitas academias com aula ao mesmo tempo: cada uma tem a TV (Ginásio)
// mandando os dados das bikes 4x por segundo e N celulares na sala mandando os
// números 1x por segundo, mais o app consultando o servidor. Mede o atraso que o
// celular vê, erros e conexões caídas.
//
//   node ferramentas/teste-carga.js http://127.0.0.1:3999            (padrão: 30 academias x 20 bikes, 60 s)
//   ACADEMIAS=60 BIKES=20 SEGUNDOS=120 node ferramentas/teste-carga.js https://SERVIDOR-DE-HOMOLOGACAO
//
// NUNCA rodar contra o servidor de produção com academias de verdade (ele recusa).
// Rode num servidor local ou na homologação do Railway.
// Resultado: "APROVADO" (código 0) ou "REPROVADO" com o motivo (código 1).
// ═══════════════════════════════════════════════════════════════════
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const WebSocket = require(require.resolve('ws', { paths: [RAIZ, path.join(RAIZ, '1_SERVIDOR'), __dirname] }));
const BASE = (process.argv[2] || process.env.CARGA_URL || 'http://127.0.0.1:3999').replace(/\/$/, '');
if (/prorider-server-production/i.test(BASE)) { console.error('⛔ Este é o servidor de PRODUÇÃO. O teste de carga roda só no local ou na homologação.'); process.exit(2); }
const WSURL = BASE.replace(/^http/, 'ws');
const ACAD = parseInt(process.env.ACADEMIAS || '30'), BIKES = parseInt(process.env.BIKES || '20'), SEG = parseInt(process.env.SEGUNDOS || '60');
const LIMITE_P95_MS = parseInt(process.env.LIMITE_P95_MS || '500');   // atraso aceitável TV → celular
const espera = ms => new Promise(r => setTimeout(r, ms));
const lat = [], http = [], st = { wsAbertos: 0, wsFalhas: 0, wsCaidos: 0, recusas: 0, msgsTv: 0, msgsCel: 0, recebidas: 0, httpErros: 0 };
const socks = [], timers = [];
let fim = false;
function abrir() {
  return new Promise(ok => {
    const ws = new WebSocket(WSURL); let feito = false;
    ws.on('open', () => { st.wsAbertos++; feito = true; ok(ws); });
    ws.on('error', () => { if (!feito) { st.wsFalhas++; feito = true; ok(null); } });
    ws.on('close', () => { if (feito && !fim) st.wsCaidos++; });
    socks.push(ws);
  });
}
const enviar = (ws, o) => { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} };
async function academia(i) {
  const codigo = 'CARGA' + String(i).padStart(3, '0');
  const tv = await abrir(); if (!tv) return;
  enviar(tv, { tipo: 'criar_sala', codigo }); await espera(300);
  enviar(tv, { tipo: 'sala_info', numBikes: BIKES, bikes: Array.from({ length: BIKES }, (_, k) => k + 1), ocupadas: [], ocupantes: {} });
  const cel = [];
  for (let b = 1; b <= BIKES; b++) {
    const ws = await abrir(); if (!ws) continue;
    ws.on('message', raw => {
      let d; try { d = JSON.parse(raw); } catch (e) { return; }
      if (d.tipo === 'bikes_live' && d.t) { st.recebidas++; if (lat.length < 2e6) lat.push(Date.now() - d.t); }
      if (d.tipo === 'erro') st.recusas++;
    });
    enviar(ws, { tipo: 'entrar_sala', codigo, nome: 'Carga ' + i + '-' + b, bike: b, ftpBase: 200 });
    cel.push(ws);
  }
  await espera(500);
  enviar(tv, { tipo: 'iniciar_aula', grafico: Array.from({ length: 30 }, (_, k) => ({ z: 'z' + (1 + k % 6), d: 120 })), blocoIdx: 0, nomeAula: 'Carga ' + i });
  // TV: dados de todas as bikes 4x/s (o que o Ginásio faz de verdade)
  timers.push(setInterval(() => {
    const bikes = {}; for (let b = 1; b <= BIKES; b++) bikes[b] = { w: 120 + (b * 7) % 150, rpm: 85, fc: 140, z: 3, kcal: 200, dist: 12.3 };
    enviar(tv, { tipo: 'bikes_live', t: Date.now(), bikes }); st.msgsTv++;
  }, 250));
  // celulares: números do aluno 1x/s
  timers.push(setInterval(() => { cel.forEach(ws => { enviar(ws, { tipo: 'dados_aluno', watts: 180, rpm: 88, fc: 145, zona: 'z3', ftp: 200, kcal: 150, dist: 10 }); st.msgsCel++; }); }, 1000));
}
async function app() {   // o app consultando o servidor (vitrine, saúde do servidor)
  const rotas = ['/ping', '/loja'];
  while (!fim) {
    const t0 = Date.now();
    try { const r = await fetch(BASE + rotas[Math.floor(Math.random() * rotas.length)]); await r.arrayBuffer(); if (!r.ok && r.status !== 401) st.httpErros++; http.push(Date.now() - t0); }
    catch (e) { st.httpErros++; }
    await espera(200 + Math.random() * 300);
  }
}
const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
(async () => {
  console.log(`▶ ${BASE} · ${ACAD} academias x ${BIKES} bikes = ${ACAD * (BIKES + 1)} conexões · ${SEG} s`);
  for (let i = 0; i < ACAD; i += 10) await Promise.all(Array.from({ length: Math.min(10, ACAD - i) }, (_, k) => academia(i + k)));
  console.log(`▶ conectados: ${st.wsAbertos} (falhas ${st.wsFalhas}) — aula rodando…`);
  lat.length = 0;   // mede só com todo mundo já dentro
  const apps = Array.from({ length: 20 }, () => app());
  for (let s = 10; s <= SEG; s += 10) { await espera(10000); console.log(`   ${s}s · atraso p95 ${pct(lat, .95)} ms · ${st.recebidas} entregas · caídos ${st.wsCaidos}`); }
  fim = true; timers.forEach(clearInterval); socks.forEach(w => { try { w.close(); } catch (e) {} });
  await Promise.race([Promise.all(apps), espera(3000)]);
  const esperado = st.msgsTv * BIKES, entregue = esperado ? st.recebidas / esperado : 0;
  console.log('\n══════════ RESULTADO ══════════');
  console.log(`  conexões abertas ........ ${st.wsAbertos} de ${ACAD * (BIKES + 1)} (falhas ${st.wsFalhas}, caídas no meio ${st.wsCaidos}, recusas ${st.recusas})`);
  console.log(`  mensagens da TV ......... ${st.msgsTv} (${Math.round(st.msgsTv / SEG)}/s) → entregues aos celulares ${(entregue * 100).toFixed(1)}%`);
  console.log(`  mensagens dos celulares . ${st.msgsCel} (${Math.round(st.msgsCel / SEG)}/s)`);
  console.log(`  atraso TV → celular ..... p50 ${pct(lat, .5)} ms · p95 ${pct(lat, .95)} ms · p99 ${pct(lat, .99)} ms · máx ${pct(lat, 1)} ms`);
  console.log(`  app (HTTP) .............. ${http.length} pedidos · p95 ${pct(http, .95)} ms · erros ${st.httpErros}`);
  const prob = [];
  if (st.wsFalhas || st.wsAbertos < ACAD * (BIKES + 1)) prob.push('nem todas as conexões abriram');
  if (st.wsCaidos) prob.push(st.wsCaidos + ' conexões caíram no meio da aula');
  if (entregue < 0.99) prob.push('menos de 99% das mensagens chegaram aos celulares');
  if (pct(lat, .95) > LIMITE_P95_MS) prob.push(`atraso p95 acima de ${LIMITE_P95_MS} ms`);
  if (st.httpErros > http.length * 0.01) prob.push('mais de 1% de erros no HTTP');
  console.log(prob.length ? '\nREPROVADO — ' + prob.join('; ') + '\n' : '\nAPROVADO — o servidor aguenta esta carga.\n');
  process.exit(prob.length ? 1 : 0);
})().catch(e => { console.error('⛔ ' + e.message); process.exit(1); });
