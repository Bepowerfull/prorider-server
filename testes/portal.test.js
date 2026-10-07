// 03/10s — TESTE DAS TELAS DO PORTAL E DO APP, de ponta a ponta, num navegador de verdade
// Portal: gestor entra (aceita os termos) e monta a grade · financeiro paga a licença (Asaas simulado)
//         · admin vê a academia em dia na Saúde.
// App:    aluno cria a conta (termos) · reserva a bike na grade · entra na aula pelo código da sala
//         (a reserva vira presença) · a aula começa e termina pela "TV".
// Precisa do Playwright (o mesmo do teste da TV); sem ele, é pulado com aviso (código 3).
const fs = require('fs'), path = require('path'), os = require('os');
const B = 'http://127.0.0.1:3999', M = 'http://127.0.0.1:3014', RAIZ = path.join(__dirname, '..');
let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [RAIZ, __dirname] }))); } catch (e) {
  try { const g = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(); ({ chromium } = require(path.join(g, 'playwright'))); } catch (e2) {} }
if (!chromium) { console.log('  ⚠ Playwright não instalado: teste do Portal e do app PULADO.\n    Instale uma vez: npm i -D playwright && npx playwright install chromium'); process.exit(3); }
const WS = require(require.resolve('ws', { paths: [RAIZ] }));
const { sql, ADMIN, ADMIN_SENHA , codigoTv } = require('./comum');
async function j(m, p, body, tok, h) { const r = await fetch((p.startsWith('http') ? '' : B) + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
const espera = ms => new Promise(r => setTimeout(r, ms));
async function ate(p, fn, ms, arg) { const t = Date.now() + (ms || 8000); let v; while (Date.now() < t) { v = await p.evaluate(fn, arg).catch(() => null); if (v) return v; await espera(300); } return v; }
const FOTOS = fs.mkdtempSync(path.join(os.tmpdir(), 'prorider-telas-portal-'));
const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

(async () => {
  await j('POST', M + '/_reset');
  await sql("DELETE FROM users WHERE email IN ('gestor.ui@x.com','fin.ui@x.com','aluna.ui@x.com')"); await sql("DELETE FROM licencas WHERE nome='Academia Portal UI'");
  const SA = (await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA })).d.token;
  let r = await j('POST', '/admin/licencas', { nome: 'Academia Portal UI', max_bikes: 12, valor_mensal: 199, vencimento: hoje, gestor_nome: 'Gestor UI', gestor_email: 'gestor.ui@x.com', financeiro_nome: 'Fin UI', financeiro_email: 'fin.ui@x.com' }, SA);
  ok(r.s === 200 && r.d.codigo, 'licença de teste criada pelo admin', r.s); const L = r.d, LIC = L.codigo;

  const nav = await chromium.launch(); const erros = [];
  const pagina = async (vp, nome) => { const c = await nav.newContext({ viewport: vp, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' }); const p = await c.newPage();
    p.on('pageerror', e => erros.push(nome + ': ' + e.message.slice(0, 160)));
    await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => /fonts\.googleapis\.com/.test(rt.request().url()) ? rt.fulfill({ path: path.join(__dirname, 'fontes-tv.css'), contentType: 'text/css' }) : rt.abort());
    p.foto = n => p.screenshot({ path: path.join(FOTOS, n + '.png') }).catch(() => {}); return p; };
  const aceitarTermos = async p => { const tem = await ate(p, () => !!document.getElementById('prsTermos'), 5000); if (!tem) return false;
    await p.evaluate(() => document.querySelectorAll('#prsTermos input[type=checkbox]').forEach(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }));
    await p.click('#prsTermos [data-ok]'); return !!(await ate(p, () => !document.getElementById('prsTermos'), 5000)); };
  const entrarPortal = async (p, email, senha) => { await p.goto(B + '/academia.html'); await espera(1200);
    await p.evaluate(([e, s]) => { document.getElementById('lEmail').value = e; document.getElementById('lPass').value = s; doLogin(); }, [email, senha]); await espera(2000); };

  console.log('1) Portal: gestor entra e monta a grade');
  const G = await pagina({ width: 1440, height: 900 }, 'portal');
  await entrarPortal(G, 'gestor.ui@x.com', L.gestor.senha_provisoria);
  ok(await aceitarTermos(G), 'gestor novo vê os termos e aceita');
  ok(await sql(`SELECT count(*) FROM termos_aceites t JOIN users u ON u.id=t.user_id WHERE u.email='gestor.ui@x.com'`) === '1', 'aceite do gestor registrado');
  await G.evaluate(() => showTab('grade')); await espera(1200);
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })), mais = new Date(Math.min(agora.getTime() + 40 * 60000, new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59).getTime()));   // perto da meia-noite: 23:59 de hoje
  const HORA = String(mais.getHours()).padStart(2, '0') + ':' + String(mais.getMinutes()).padStart(2, '0');
  await G.evaluate(([dia, hora]) => { openNovaAula(); fNome.value = 'Spin Portal UI'; fProf.value = 'Prof UI'; fDia.value = dia; fHora.value = hora; fDur.value = '45'; fVagas.value = '12'; }, [String(agora.getDay()), HORA]);
  await G.foto('1_nova_aula');
  await G.evaluate(() => salvarAula()); await espera(1500);
  const AG = await sql(`SELECT id FROM aulas_agenda WHERE license_id='${LIC}' AND nome='Spin Portal UI'`);
  ok(/^\d+$/.test(AG), 'aula criada no banco', AG);
  ok(await ate(G, () => /Spin Portal UI/.test(document.body.innerText)), 'aula aparece na grade do Portal');
  await G.foto('2_grade');

  console.log('2) Financeiro paga a licença');
  const F = await pagina({ width: 1440, height: 900 }, 'financeiro');
  await entrarPortal(F, 'fin.ui@x.com', L.financeiro.senha_provisoria);
  ok(/financeiro\.html/.test(F.url()), 'financeiro vai direto para a página de pagamento', F.url().split('/').pop());
  ok(await aceitarTermos(F), 'financeiro aceita os termos');
  ok(await ate(F, () => /Academia Portal UI/.test(document.getElementById('pAcad').textContent)), 'página mostra a academia');
  await F.fill('#iDoc', '12345678000190');
  const aba = F.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await F.click('#btPagar'); const nova = await aba; await espera(1500);
  ok(await F.evaluate(() => document.getElementById('lkPagar').style.display !== 'none' && !!document.getElementById('lkPagar').href), 'abre a página do Asaas e deixa o link "Pagar"');
  ok(!!nova, 'página do Asaas abriu em outra aba');
  await F.foto('3_financeiro_pagar');
  const st = (await j('GET', M + '/_state')).d, pay = Object.values(st.pays).find(x => true);
  ok(!!pay, 'fatura criada no Asaas (simulado)');
  if (pay) { await j('POST', M + '/_pay/' + pay.id, { status: 'CONFIRMED', confirmedDate: hoje });
    ok((await j('POST', '/webhook/asaas', { event: 'PAYMENT_CONFIRMED', payment: Object.assign({}, pay, { status: 'CONFIRMED', confirmedDate: hoje }) }, null, { 'asaas-access-token': 'tokenwebhook123' })).s === 200, 'Asaas avisa o pagamento (webhook)'); }
  await F.reload(); await espera(2000);
  ok(await ate(F, () => /em dia/i.test(document.getElementById('pSit').innerText)), 'página do financeiro: "Em dia"', await F.evaluate(() => document.getElementById('pSit').innerText));
  await F.foto('4_financeiro_em_dia');

  console.log('3) Admin vê na Saúde');
  const A = await pagina({ width: 1440, height: 900 }, 'admin');
  await entrarPortal(A, ADMIN, ADMIN_SENHA);
  ok(/index\.html/.test(A.url()), 'admin vai para o painel do admin', A.url().split('/').pop());
  await A.evaluate(() => showPage('saude')); await espera(2500);
  ok(await ate(A, () => /Academia Portal UI/.test(document.getElementById('page-saude').innerText)), 'Saúde lista a academia nova no semáforo');
  await A.foto('5_saude');
  await A.evaluate(() => showPage('licencas')); await espera(2000);
  ok(await ate(A, () => [...document.querySelectorAll('tr')].some(tr => /Academia Portal UI/.test(tr.innerText) && /em dia/i.test(tr.innerText))), 'lista de licenças: academia em dia');
  await A.foto('6_licencas');

  console.log('4) App: aluno cria a conta');
  const P = await pagina({ width: 390, height: 844 }, 'app');
  await P.goto(B + '/aluno/'); await espera(1500);
  await P.evaluate(() => { go('sLogin'); lgTab('reg'); });
  await P.fill('#lgName', 'Aluna UI'); await P.fill('#lgEmail', 'aluna.ui@x.com'); await P.fill('#lgPass', '123456');
  await P.evaluate(() => lgSubmit()); await espera(800);
  ok(await P.evaluate(() => !prToken && /termos|aceit|marque/i.test(document.getElementById('lgErr').textContent)), 'sem marcar os termos não cria a conta');
  await P.evaluate(() => { document.querySelectorAll('#lgTermos input[type=checkbox]').forEach(c => c.checked = true); lgSubmit(); });
  ok(await ate(P, () => !!prToken), 'conta criada com os termos aceitos');
  ok(await P.evaluate(() => !document.getElementById('prsTermos')), 'não pede os termos de novo');
  await P.evaluate(() => { try { localStorage.setItem('pr_ftp', '200'); profData.ftp = '200'; } catch (e) {} });

  console.log('5) App: reservar a bike');
  await P.evaluate(async l => { try { go('sAgenda'); } catch (e) {} await loadMinhasReservas(); await abrirGradeAcademia(l); }, LIC); await espera(1500);
  const btn = await P.$(`button[onclick^="abrirReservaModal(${AG},"]`);
  ok(!!btn, 'aula do Portal aparece na grade do app');
  if (btn) { await btn.click(); await espera(1200); await P.evaluate(() => rcEscolherBike(5)); await espera(300); await P.foto('7_app_escolher_bike'); await P.click('#rcBtn'); await espera(1500); }
  ok(await sql(`SELECT r.bike_numero || ' ' || r.status FROM aulas_reservas r JOIN users u ON u.id=r.user_id WHERE r.agenda_id=${AG || 0} AND u.email='aluna.ui@x.com'`) === '5 reservado', 'reserva da bike 5 no banco');
  await P.foto('8_app_reservado');

  console.log('6) App: entrar na aula pelo código da sala');
  const D = (await j('POST', '/display/ativar', { codigo: await codigoTv(LIC), device_id: 'tv-portal-ui', nome_computador: 'TV UI' })).d.token;
  const tv = new WS(B.replace('http', 'ws')); await new Promise(o => tv.on('open', o));
  const SALA = 'PR-UI12-' + Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');
  tv.send(JSON.stringify({ tipo: 'criar_sala', codigo: SALA, display_token: D })); await espera(500);
  tv.send(JSON.stringify({ tipo: 'sala_info', numBikes: 12, ocupadas: [] })); await espera(300);
  await P.evaluate(c => connectQR(c), SALA);
  ok(await ate(P, () => document.querySelector('.screen.active') && document.querySelector('.screen.active').id === 'sBikeSel'), 'app abre a escolha da bike');
  ok(await ate(P, () => !!(window._prResvHoje || (typeof _prResvHoje !== 'undefined' && _prResvHoje)) && /reservou a bike 5/i.test((document.getElementById('bikeSelResv') || {}).innerText || '')), 'escolha da bike mostra "Você reservou a bike 5"');
  await P.foto('9_app_bikes');
  await P.evaluate(() => selectBike(5)); await espera(2000);
  ok(await sql(`SELECT r.status FROM aulas_reservas r JOIN users u ON u.id=r.user_id WHERE r.agenda_id=${AG || 0} AND u.email='aluna.ui@x.com'`) === 'presente', 'entrou na bike reservada: reserva vira presença');
  tv.send(JSON.stringify({ tipo: 'iniciar_aula', nomeAula: 'Spin Portal UI', blocoIdx: 0, grafico: [{ z: 'z2', dur: 1, ftpMin: 56, ftpMax: 75, rpmMin: 85, rpmMax: 95 }, { z: 'z4', dur: 1, ftpMin: 91, ftpMax: 105, rpmMin: 85, rpmMax: 95 }] }));
  // a TV manda o andamento da aula a cada segundo (update_aula), como o Ginásio faz
  const GRAF = [{ idx: 0, z: 'z2', dur: 1, ftpMin: 56, ftpMax: 75, rpmMin: 85, rpmMax: 95, pos: 'Sentado' }, { idx: 1, z: 'z4', dur: 1, ftpMin: 91, ftpMax: 105, rpmMin: 85, rpmMax: 95, pos: 'Sentado' }];
  const andamento = setInterval(() => { try { tv.send(JSON.stringify({ tipo: 'update_aula', bloco: { intensity: 'z2', ftpMin: 56, ftpMax: 75, rpmMin: 85, rpmMax: 95, position: 'Sentado' }, blocoIdx: 0, zona: 'z2', segTime: 50, blocoRest: 50, totTime: 110, totRest: 110, upNext: GRAF[1], grafico: GRAF, nomeAula: 'Spin Portal UI', totalBlocos: 2 })); } catch (e) {} }, 1000);
  ok(await ate(P, () => document.querySelector('.screen.active') && document.querySelector('.screen.active').id === 'sLive' && aulaGrafico.length === 2 && /56–75/.test(document.getElementById('sLive').innerText)), 'aula começa no app com o gráfico e a meta da TV', await P.evaluate(() => [document.querySelector('.screen.active').id, aulaGrafico.length, document.getElementById('sLive').innerText.slice(0, 120)]));
  clearInterval(andamento);
  await P.foto('10_app_aula');
  tv.send(JSON.stringify({ tipo: 'fim_aula' }));
  const telaFim = await ate(P, () => { const a = document.querySelector('.screen.active'); return a && a.id !== 'sLive' ? a.id : null; });
  ok(!!telaFim, 'aula termina no app e sai da tela da aula', telaFim);
  await P.foto('11_app_fim');
  tv.close();

  console.log('7) Sem erros');
  ok(erros.length === 0, 'nenhum erro de JavaScript no Portal e no app', erros.slice(0, 4));
  await nav.close();
  await sql(`DELETE FROM aulas_agenda WHERE license_id='${LIC}'`);
  console.log('  fotos das telas: ' + FOTOS);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
