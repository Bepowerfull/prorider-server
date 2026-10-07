// 03/10v — TV NA VERSÃO ERRADA: a Saúde avisa quando uma TV está com o Ginásio diferente do servidor
// (as 3 TVs foram instaladas com uma cópia antiga e ninguém percebeu).
const B = 'http://127.0.0.1:3999';
async function j(m, p, body, tok, h) { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(h || {}) }, body: body ? JSON.stringify(body) : undefined }); let d; try { d = await r.json(); } catch (e) {} return { s: r.status, d }; }
const { sql, ADMIN, ADMIN_SENHA , codigoTv } = require('./comum');
let f = 0; const ok = (c, t, x) => { console.log((c ? '  OK ' : 'FALHA ') + t + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) f++; };
(async () => {
  const SA = (await j('POST', '/user/login', { email: ADMIN, password: ADMIN_SENHA })).d.token;
  const atual = (await j('GET', '/admin/saude', null, SA)).d.tvs.versao_atual;
  ok(/^BUILD \d\d\/\d\d[a-z]$/.test(atual || ''), 'Saúde informa a versão atual da TV', atual);
  // 03/10y: a versão da TV que o servidor espera (GINASIO_VERSAO) é a do Ginásio deste pacote
  const _gin = require('fs').readFileSync(require('path').join(__dirname, '..', 'ginasio', 'script.js'), 'utf8').match(/var PR_BUILD='([^']+)'/);
  ok(_gin && _gin[1] === atual, 'servidor espera a mesma versão do Ginásio que vai no pacote', [atual, _gin && _gin[1]]);
  await sql(`DELETE FROM licenca_computadores WHERE device_id IN ('tv-versao-velha','tv-versao-certa')`);
  const V = (await j('POST', '/display/ativar', { codigo: await codigoTv('D5448D47'), device_id: 'tv-versao-velha', nome_computador: 'TV Velha', build: 'BUILD 03/10n' })).d.token;
  await j('GET', '/display/licenca', null, V, { 'X-PR-Build': 'BUILD 03/10n' });
  let sd = (await j('GET', '/admin/saude', null, SA)).d;
  ok(sd.alertas.some(a => /versão do Ginásio diferente/.test(a.txt) && /03\/10n/.test(a.txt)), 'alerta no topo da Saúde: TV na 03/10n', sd.alertas.map(a => a.txt).filter(t => /Ginásio/.test(t)));
  let me = (await j('GET', '/admin/saude/licencas', null, SA)).d.lista.find(x => x.codigo === 'D5448D47');
  ok(me && me.cor !== 'verde' && me.motivos.some(m => /TV "TV Velha" com BUILD 03\/10n/.test(m)), 'semáforo da academia fica amarelo com o motivo', me && me.motivos);
  await j('GET', '/display/licenca', null, V, { 'X-PR-Build': atual });
  sd = (await j('GET', '/admin/saude', null, SA)).d;
  ok(!sd.alertas.some(a => /versão do Ginásio diferente/.test(a.txt)), 'TV atualizada: o alerta some sozinho');
  me = (await j('GET', '/admin/saude/licencas', null, SA)).d.lista.find(x => x.codigo === 'D5448D47');
  ok(!me.motivos.some(m => /TV "TV Velha"/.test(m)), 'semáforo sem o motivo');
  await sql(`DELETE FROM licenca_computadores WHERE device_id='tv-versao-velha'`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
