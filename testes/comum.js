// Ferramentas comuns dos testes (03/10e). Só rodam pelo testes/rodar.js, contra um banco de TESTE.
const { Pool } = require('pg');
const url = process.env.T_DB_URL;
if (!url || !/test/i.test(new URL(url).pathname)) { console.error('Teste sem T_DB_URL de teste. Rode pelo testes/rodar.js.'); process.exit(2); }
const u = new URL(url);
const pool = new Pool({ host: u.hostname, port: parseInt(u.port || '5432'), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1), ssl: false });
// sql('...') → texto igual ao "psql -At": linhas separadas por \n, colunas por |
async function sql(q) { const r = await pool.query(q); return (r.rows || []).map(x => Object.values(x).map(v => v === null ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v))).join('|')).join('\n'); }
// 03/10w: código secreto da TV (o código da licença não ativa mais a TV)
async function codigoTv(cod) { const r = await pool.query("UPDATE licencas SET codigo_tv=COALESCE(codigo_tv, 'T' || UPPER(SUBSTR(MD5(codigo), 1, 7))) WHERE codigo=$1 RETURNING codigo_tv", [cod]); return r.rows[0] && r.rows[0].codigo_tv; }
module.exports = { sql, pool, codigoTv, ADMIN: process.env.T_ADMIN || 'admin@teste.local', ADMIN_SENHA: process.env.T_ADMIN_SENHA || 'teste123' };
