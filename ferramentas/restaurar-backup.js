#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ProRider — RESTAURAR O BACKUP DO SERVIDOR (03/10j)
// Lê um arquivo prorider_AAAA-MM-DD_HHMM.json.gz (Saúde do sistema → Baixar backup)
// e devolve todas as tabelas para um banco Postgres.
//
//   1) Crie um banco vazio e ligue o server.js nele UMA vez (ele cria as tabelas), depois desligue.
//   2) RESTAURAR_DATABASE_URL=postgres://... node ferramentas/restaurar-backup.js prorider_2026-10-06_0330.json.gz
//   3) O script mostra o nome do banco e pede para digitar esse nome para confirmar
//      (ou passe --confirmar=<nome do banco>).
//
// ATENÇÃO: APAGA o que estiver nas tabelas do banco de destino e põe o backup no lugar.
// Ensaie primeiro num banco de teste. Nunca rode com a URL de produção sem combinar com o Mario.
// ═══════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), zlib = require('zlib'), readline = require('readline');
const RAIZ = path.join(__dirname, '..');
const { Client } = require(require.resolve('pg', { paths: [RAIZ, __dirname] }));
const arq = process.argv.find(a => /\.json\.gz$/.test(a));
const URL_DEST = process.env.RESTAURAR_DATABASE_URL || '';
if (!arq || !fs.existsSync(arq) || !URL_DEST) { console.error('Uso: RESTAURAR_DATABASE_URL=postgres://... node ferramentas/restaurar-backup.js <arquivo.json.gz> [--confirmar=<banco>]'); process.exit(2); }
const u = new URL(URL_DEST), banco = u.pathname.slice(1);
const conf = (process.argv.find(a => a.startsWith('--confirmar=')) || '').split('=')[1];
(async () => {
  if (conf !== banco) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const resp = await new Promise(ok => rl.question(`⚠️  Isto APAGA as tabelas do banco "${banco}" em ${u.hostname} e põe o backup no lugar.\nDigite o nome do banco para confirmar: `, ok)); rl.close();
    if (resp.trim() !== banco) { console.error('Cancelado.'); process.exit(1); }
  }
  const c = new Client({ connectionString: URL_DEST, ssl: /localhost|127\.0\.0\.1/.test(u.hostname) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const existe = new Set((await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`)).rows.map(x => x.tablename));
  const linhas = readline.createInterface({ input: fs.createReadStream(arq).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let meta = null, fim = null; const cont = {}, pulou = new Set(), q = t => '"' + t.replace(/"/g, '""') + '"';
  await c.query('BEGIN');
  await c.query("SET LOCAL session_replication_role = replica");   // sem checar chaves estrangeiras durante a carga
  for await (const l of linhas) {
    if (!l.trim()) continue; const o = JSON.parse(l);
    if (o.prorider_backup) {
      meta = o; console.log(`▶ backup de ${o.quando} (servidor ${o.versao}), ${o.tabelas.length} tabelas`);
      const alvo = o.tabelas.filter(t => existe.has(t)); o.tabelas.filter(t => !existe.has(t)).forEach(t => pulou.add(t));
      if (alvo.length) await c.query('TRUNCATE ' + alvo.map(q).join(', ') + ' CASCADE');
      continue;
    }
    if (o.fim) { fim = o; continue; }
    if (!existe.has(o.t)) { pulou.add(o.t); continue; }
    await c.query(`INSERT INTO ${q(o.t)} SELECT * FROM json_populate_recordset(NULL::${q(o.t)}, $1::json)`, [JSON.stringify(o.rows)]);
    cont[o.t] = (cont[o.t] || 0) + o.rows.length;
  }
  if (!meta || !fim) { await c.query('ROLLBACK'); console.error('⛔ Arquivo incompleto ou não é um backup do ProRider. Nada foi alterado.'); process.exit(1); }
  // contadores (SERIAL) continuam depois do maior id
  const seqs = (await c.query(`SELECT table_name, column_name, pg_get_serial_sequence(quote_ident(table_name), column_name) AS s FROM information_schema.columns
    WHERE table_schema='public' AND column_default LIKE 'nextval%'`)).rows.filter(x => x.s);
  for (const x of seqs) await c.query(`SELECT setval($1, COALESCE((SELECT MAX(${q(x.column_name)}) FROM ${q(x.table_name)}), 0) + 1, false)`, [x.s]);
  await c.query('COMMIT'); await c.end();
  const dif = Object.keys(fim.contagem).filter(t => existe.has(t) && (cont[t] || 0) !== fim.contagem[t]);
  console.log(`✅ restaurado: ${Object.keys(cont).length} tabelas, ${Object.values(cont).reduce((a, b) => a + b, 0)} linhas.`);
  if (pulou.size) console.log('   tabelas do backup que não existem neste banco (puladas): ' + [...pulou].join(', '));
  if (dif.length) { console.log('⛔ contagem diferente em: ' + dif.join(', ')); process.exit(1); }
  console.log('   contagens conferem com o backup.');
})().catch(e => { console.error('⛔ ' + e.message + ' — nada foi alterado.'); process.exit(1); });
