// 03/10y — "AULAS AO VIVO AGORA": antes de atualizar o servidor, a Saúde mostra se tem aula rodando.
// TV de mentira (com token de TV de verdade) abre a sala, começa a aula e manda o andamento;
// confere /status/ao-vivo (público, só números), /admin/saude (com a academia) e a faixa na tela do Admin.
const path = require('path'), RAIZ = path.join(__dirname, '..');
const B = 'http://127.0.0.1:3999';
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const { codigoTv, ADMIN, ADMIN_SENHA } = require('./comum');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
const sock = () => new Promise(o => { const w = new WS(B.replace('http', 'ws')); w.on('open', () => o(w)); });
(async () => {
  const ADM = (await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA }, null, { 'X-Forwarded-For': '10.77.0.1' })).d.token;
  let r = await j('GET', '/status/ao-vivo');
  ok(r.s === 200 && r.d.aulas === 0 && r.d.pode_atualizar === true, 'sem aula: "pode atualizar"', r.d);
  const TK = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-aovivo', nome_computador: 'TV ao vivo' })).d.token;
  const tv = await sock(), SALA = 'PR-AV01-TEST';
  tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: TK })); await espera(300);
  const al = [await sock(), await sock()];
  al.forEach((w, i) => w.send(JSON.stringify({ tipo: 'entrar_sala', codigo: SALA, nome: 'Aluno AV ' + i, bike: i + 1 }))); await espera(300);
  r = await j('GET', '/status/ao-vivo');
  ok(r.d.aulas === 0, 'sala aberta mas aula não começou: não conta', r.d);
  tv.send(JSON.stringify({ tipo: 'iniciar_aula', grafico: [], blocoIdx: 0, nomeAula: 'Spin AV' }));
  const and = setInterval(() => tv.send(JSON.stringify({ tipo: 'update_aula', nomeAula: 'Spin AV', blocoIdx: 0, totTime: 754, segTime: 30 })), 1000);
  await espera(1500);
  r = await j('GET', '/status/ao-vivo');
  ok(r.d.aulas === 1 && r.d.alunos === 2 && r.d.pode_atualizar === false, 'aula rodando: 1 aula, 2 alunos, NÃO pode atualizar', r.d);
  ok(!JSON.stringify(r.d).includes('Academia') && !JSON.stringify(r.d).includes(SALA), 'rota pública não mostra academia nem sala', r.d);
  r = await j('GET', '/admin/saude', null, ADM);
  const x = (r.d.ao_vivo || [])[0] || {};
  ok(r.d.ao_vivo && r.d.ao_vivo.length === 1 && x.academia === 'Academia Teste' && x.alunos === 2 && x.nome === 'Spin AV' && x.situacao === 'rodando' && Math.abs(x.aula_min - 12.6) < 0.2, 'Saúde: academia, aula, alunos, minutos de aula e "rodando"', x);
  ok((await j('GET', '/admin/saude')).s === 401, 'detalhes da Saúde só com login de admin');

  if (chromium) {
    const nav = await chromium.launch(); const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
    await p.addInitScript(([t, e]) => { localStorage.setItem('pr_admin_token', t); localStorage.setItem('pr_admin_user', JSON.stringify({ name: 'Admin', email: e, role: 'super_admin' })); }, [ADM, ADMIN]);
    await p.goto(B + '/index.html'); await espera(1500);
    await p.evaluate(() => showPage('saude')); let txt = '';
    for (let i = 0; i < 20 && !/ao vivo agora/.test(txt); i++) { await espera(300); txt = await p.evaluate(() => (document.getElementById('sdAoVivo') || {}).innerText || ''); }
    ok(/1 aula ao vivo agora/.test(txt) && /NÃO atualize/.test(txt) && /Academia Teste/.test(txt), 'tela do Admin: faixa vermelha "1 aula ao vivo agora — NÃO atualize"', txt.slice(0, 160));
    clearInterval(and);
    tv.send(JSON.stringify({ tipo: 'fim_aula' })); await espera(500);
    await p.evaluate(() => loadSaude()); await espera(1500);
    txt = await p.evaluate(() => (document.getElementById('sdAoVivo') || {}).innerText || '');
    ok(/Nenhuma aula ao vivo/.test(txt), 'depois do fim: faixa verde "pode atualizar"', txt);
    await nav.close();
  } else { clearInterval(and); tv.send(JSON.stringify({ tipo: 'fim_aula' })); await espera(500); }
  r = await j('GET', '/status/ao-vivo');
  ok(r.d.aulas === 0 && r.d.pode_atualizar === true, 'fim da aula: volta a "pode atualizar"', r.d);
  tv.close(); al.forEach(w => w.close());
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
