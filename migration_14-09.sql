-- ══════════════════════════════════════════════════════════════
-- ProRider — Migration 14/09/2026
-- Colunas para os campos que o app do aluno passou a enviar na
-- build 12/09b: dados fisicos / metabolismo basal e os numeros
-- medidos da aula (watt, rpm, caloria).
--
-- Rodar UMA VEZ no banco PostgreSQL do Railway.
-- Tudo com IF NOT EXISTS: rodar de novo por engano nao faz nada.
-- Nao apaga nem altera dado existente.
-- ══════════════════════════════════════════════════════════════

-- ── users: dados fisicos e basal ──────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS altura SMALLINT;      -- cm
ALTER TABLE users ADD COLUMN IF NOT EXISTS idade  SMALLINT;      -- anos
ALTER TABLE users ADD COLUMN IF NOT EXISTS sexo   CHAR(1);       -- 'M' | 'F'
ALTER TABLE users ADD COLUMN IF NOT EXISTS tmb    SMALLINT;      -- kcal/dia (Mifflin-St Jeor)

-- peso e ftp ja existiam no banco em producao, mas NAO estavam no
-- schema.sql v1.0. Incluidos aqui para que um banco criado do zero
-- pelo schema antigo tambem fique correto.
ALTER TABLE users ADD COLUMN IF NOT EXISTS peso NUMERIC(5,2) DEFAULT 70;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ftp  SMALLINT     DEFAULT 130;

-- ── aulas_completadas: numeros medidos ────────────────────────
-- rpm_medio ja existe no schema v1.0; a rota grava nela o rpm_med do app.
ALTER TABLE aulas_completadas ADD COLUMN IF NOT EXISTS watts_med SMALLINT DEFAULT 0;
ALTER TABLE aulas_completadas ADD COLUMN IF NOT EXISTS kcal      SMALLINT DEFAULT 0;

-- ── conferencia ───────────────────────────────────────────────
-- Depois de rodar, isto deve listar as colunas novas:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='users' AND column_name IN ('altura','idade','sexo','tmb','peso','ftp');
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='aulas_completadas' AND column_name IN ('watts_med','rpm_medio','kcal');
