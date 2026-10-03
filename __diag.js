const { Pool } = require('pg');
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  // 1. Tabelas existentes
  const tabelas = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('=== TABELAS ===');
  tabelas.rows.forEach(r => console.log(' -', r.table_name));

  // 2. aulas_completadas de ontem
  try {
    const ac = await db.query(`
      SELECT id, academia_id, nome_aluno, bike_num,
             duracao_seg, calorias, created_at
      FROM aulas_completadas
      WHERE created_at::date = CURRENT_DATE - 1
      ORDER BY created_at
    `);
    console.log('\n=== AULAS_COMPLETADAS ONTEM (' + ac.rows.length + ' registos) ===');
    ac.rows.forEach(r => console.log(JSON.stringify(r)));
  } catch(e) { console.log('\naulas_completadas: ' + e.message); }

  // 3. aula_historico de ontem
  try {
    const ah = await db.query(`
      SELECT id, sala_codigo, evento, dado, created_at
      FROM aula_historico
      WHERE created_at::date = CURRENT_DATE - 1
      ORDER BY created_at
      LIMIT 200
    `);
    console.log('\n=== AULA_HISTORICO ONTEM (' + ah.rows.length + ' registos) ===');
    ah.rows.forEach(r => console.log(JSON.stringify(r)));
  } catch(e) { console.log('\naula_historico: ' + e.message); }
}

run().catch(e => console.error('ERRO:', e.message)).finally(() => db.end());
