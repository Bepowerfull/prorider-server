#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ProRider — TESTES AUTOMÁTICOS (03/10p)
// Roda o servidor de verdade contra um BANCO DE TESTE vazio, com o Asaas e o
// Resend simulados, e passa por pagamento, loja, desafios e segurança.
//
//   TEST_DATABASE_URL=postgres://usuario:senha@localhost:5432/prorider_teste node testes/rodar.js
//
// Regras de segurança:
//  - o nome do banco PRECISA ter "test" (ex.: prorider_teste). Senão, não roda.
//  - o banco é APAGADO e recriado a cada rodada. Nunca use o banco do Railway.
//  - o servidor sobe só com variáveis de teste (nenhuma chave real é herdada).
// Resultado: "TUDO OK" e código 0, ou a lista do que falhou e código 1.
// ═══════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const { spawn } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const req = m => require(require.resolve(m, { paths: [RAIZ, __dirname] }));
const { Client } = req('pg'), bcrypt = req('bcryptjs');

const URL_TESTE = process.env.TEST_DATABASE_URL || '';
let u; try { u = new URL(URL_TESTE); } catch (e) {}
if (!u || !/test/i.test(u.pathname)) {
  console.error('\n⛔ Defina TEST_DATABASE_URL apontando para um banco de TESTE (o nome precisa ter "test").');
  console.error('   Ex.: TEST_DATABASE_URL=postgres://postgres:senha@localhost:5432/prorider_teste node testes/rodar.js\n');
  process.exit(2);
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === URL_TESTE) { console.error('⛔ TEST_DATABASE_URL igual à DATABASE_URL. Abortado.'); process.exit(2); }
const PORTA = parseInt(process.env.TEST_PORT || '3999'), PORTA_MOCK = 3014;
const SERVIDOR = path.join(RAIZ, 'server.js');
const pgCfg = { host: u.hostname, port: parseInt(u.port || '5432'), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1), ssl: false };
const ADMIN = 'admin@teste.local', ADMIN_SENHA = 'teste123';
const TESTES = ['pagamento', 'loja', 'desafios', 'seguranca', 'telas', 'vigia', 'conferencia', 'termos', 'bluetooth', 'backup'];
const espera = ms => new Promise(r => setTimeout(r, ms));
const filhos = [];
function sair(c) { filhos.forEach(p => { try { p.kill(); } catch (e) {} }); process.exit(c); }
process.on('SIGINT', () => sair(130));

(async () => {
  console.log('▶ banco de teste: ' + pgCfg.database + ' em ' + pgCfg.host + ':' + pgCfg.port);
  const c = new Client(pgCfg); await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  console.log('▶ banco zerado');
  const mock = spawn(process.execPath, [path.join(__dirname, 'asaas-simulado.js')], { stdio: 'ignore' }); filhos.push(mock);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prorider-teste-'));
  const env = { PATH: process.env.PATH, HOME: process.env.HOME || os.tmpdir(), PORT: String(PORTA), JWT_SECRET: 'teste-' + Date.now(),
    PGHOST: pgCfg.host, PGPORT: String(pgCfg.port), PGUSER: pgCfg.user, PGPASSWORD: pgCfg.password, PGDATABASE: pgCfg.database,
    PORTAL_URL: 'http://127.0.0.1:' + PORTA, GRAVACOES_TESTE_DIR: pasta,
    ASAAS_API_KEY: 'chave-teste', ASAAS_URL: 'http://127.0.0.1:' + PORTA_MOCK, ASAAS_WEBHOOK_TOKEN: 'tokenwebhook123',
    RESEND_API_KEY: 're_teste', RESEND_API_URL: 'http://127.0.0.1:' + PORTA_MOCK + '/emails', EMAIL_FROM: 'ProRider <acesso@prorider.test>',
    ALERTAS_INTERVALO_S: '3600', ALERTA_TV_CAIU_S: '3', BACKUP_DIR: path.join(pasta, 'backups'), ASAAS_CONFERIR_DESLIGADO: '1' };   // 03/10g: o vigia só roda quando o teste pede
  const log = fs.openSync(path.join(pasta, 'servidor.log'), 'w');
  const srv = spawn(process.execPath, [SERVIDOR], { cwd: RAIZ, env, stdio: ['ignore', log, log] }); filhos.push(srv);
  // espera o servidor e as migrações (a última cria sistema_eventos)
  let pronto = false;
  for (let i = 0; i < 60 && !pronto; i++) {
    await espera(1000);
    try { const r = await fetch('http://127.0.0.1:' + PORTA + '/ping'); if (r.ok) { const k = new Client(pgCfg); await k.connect(); const t = await k.query("SELECT to_regclass('public.sistema_eventos') AS t, to_regclass('public.loja_pedidos') AS l"); await k.end(); pronto = !!(t.rows[0].t && t.rows[0].l); } } catch (e) {}
  }
  if (!pronto) { console.error('⛔ o servidor não subiu em 60 s. Log: ' + path.join(pasta, 'servidor.log')); console.error(fs.readFileSync(path.join(pasta, 'servidor.log'), 'utf8').slice(-3000)); sair(1); }
  await espera(1500);
  const k = new Client(pgCfg); await k.connect();
  await k.query(`INSERT INTO users (email, name, password_hash, role) VALUES ($1,'Admin Teste',$2,'super_admin') ON CONFLICT (email) DO UPDATE SET role='super_admin', password_hash=EXCLUDED.password_hash`, [ADMIN, await bcrypt.hash(ADMIN_SENHA, 10)]);
  await k.query(`INSERT INTO licencas (codigo, nome, status, max_bikes, valor_mensal) VALUES ('D5448D47','Academia Teste','ativa',15,199) ON CONFLICT (codigo) DO NOTHING`);
  await k.end();
  console.log('▶ servidor no ar (porta ' + PORTA + '), dados de teste criados\n');
  const resultado = [];
  for (const t of TESTES) {
    console.log('━━ ' + t + ' ━━');
    const code = await new Promise(ok => { const p = spawn(process.execPath, [path.join(__dirname, t + '.test.js')], { stdio: 'inherit', env: Object.assign({}, env, { T_DB_URL: URL_TESTE, T_ADMIN: ADMIN, T_ADMIN_SENHA: ADMIN_SENHA }) }); p.on('exit', ok); });
    resultado.push([t, code]); console.log('');
  }
  const erros = (fs.readFileSync(path.join(pasta, 'servidor.log'), 'utf8').match(/ERRO não tratado[^\n]*/g) || []);
  console.log('══════════ RESULTADO ══════════');
  resultado.forEach(([t, c]) => console.log((c === 0 ? '  ✅ ' : '  ❌ ') + t));
  if (erros.length) { console.log('  ❌ erros não tratados no servidor:'); erros.slice(0, 5).forEach(e => console.log('     ' + e)); }
  const ok = resultado.every(r => r[1] === 0) && !erros.length;
  console.log(ok ? '\nTUDO OK — pode subir.\n' : '\nFALHOU — não suba esta versão. Log do servidor: ' + path.join(pasta, 'servidor.log') + '\n');
  sair(ok ? 0 : 1);
})().catch(e => { console.error('⛔ ' + e.message); sair(1); });
