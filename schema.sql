-- ══════════════════════════════════════════════════════════════
-- ProRider — Schema PostgreSQL v1.0
-- Rodar uma vez no banco Railway após adicionar PostgreSQL plugin
-- ══════════════════════════════════════════════════════════════

-- Licenças (Studio, Gym)
CREATE TABLE IF NOT EXISTS licenses (
  id               SERIAL PRIMARY KEY,
  key              VARCHAR(50)  UNIQUE NOT NULL,  -- PRDR-STDO-XXXX-XXXX-XXXX
  type             VARCHAR(20)  NOT NULL,          -- 'studio' | 'gym'
  name             VARCHAR(255) NOT NULL,          -- "Politech Rio de Janeiro"
  status           VARCHAR(20)  DEFAULT 'active',  -- 'active' | 'revoked' | 'expired'
  device_fingerprint VARCHAR(255),                 -- hash único da máquina ativada
  admin_email      VARCHAR(255),
  created_at       TIMESTAMP    DEFAULT NOW(),
  expires_at       TIMESTAMP
);

-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  email            VARCHAR(255) UNIQUE NOT NULL,
  name             VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255),
  role             VARCHAR(20)  DEFAULT 'aluno',   -- 'aluno' | 'professor' | 'admin_licenca' | 'super_admin'
  license_id       INTEGER REFERENCES licenses(id) ON DELETE SET NULL,
  points           INTEGER      DEFAULT 0,
  level            VARCHAR(20)  DEFAULT 'iniciante',
  created_at       TIMESTAMP    DEFAULT NOW(),
  updated_at       TIMESTAMP    DEFAULT NOW()
);

-- Ativações do modo professor no celular
CREATE TABLE IF NOT EXISTS mobile_activations (
  id               SERIAL PRIMARY KEY,
  license_id       INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_id        VARCHAR(255) NOT NULL,
  token_hash       VARCHAR(255),                   -- hash do token QR usado
  activated_at     TIMESTAMP DEFAULT NOW()
);

-- Aulas completadas (histórico + pontos)
CREATE TABLE IF NOT EXISTS aulas_completadas (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  aula_nome        VARCHAR(255),
  duracao_sec      INTEGER,
  pontos           INTEGER DEFAULT 0,
  zona_predominante VARCHAR(10),
  z1_pct           SMALLINT DEFAULT 0,
  z2_pct           SMALLINT DEFAULT 0,
  z3_pct           SMALLINT DEFAULT 0,
  z4_pct           SMALLINT DEFAULT 0,
  z5_pct           SMALLINT DEFAULT 0,
  z6_pct           SMALLINT DEFAULT 0,
  z7_pct           SMALLINT DEFAULT 0,
  rpm_medio        SMALLINT DEFAULT 0,
  completed_at     TIMESTAMP DEFAULT NOW()
);

-- Pedidos de acesso professor
CREATE TABLE IF NOT EXISTS professor_requests (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  license_id       INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
  status           VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  requested_at     TIMESTAMP DEFAULT NOW(),
  reviewed_at      TIMESTAMP,
  reviewed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Aulas compartilhadas via QR (temporárias)
CREATE TABLE IF NOT EXISTS shared_aulas (
  id               SERIAL PRIMARY KEY,
  share_id         VARCHAR(32) UNIQUE NOT NULL,   -- ID curto para URL do QR
  aula_json        TEXT NOT NULL,                  -- JSON completo da aula
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at       TIMESTAMP NOT NULL,             -- expira em 24h por padrão
  created_at       TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_license      ON users(license_id);
CREATE INDEX IF NOT EXISTS idx_aulas_user         ON aulas_completadas(user_id);
CREATE INDEX IF NOT EXISTS idx_aulas_date         ON aulas_completadas(completed_at);
CREATE INDEX IF NOT EXISTS idx_shared_expire      ON shared_aulas(expires_at);
CREATE INDEX IF NOT EXISTS idx_prof_req_license   ON professor_requests(license_id, status);

-- Super admin padrão (trocar senha após primeiro login)
-- Senha inicial: ProRider@2026 (hash abaixo)
-- IMPORTANTE: trocar imediatamente após deploy
INSERT INTO users (email, name, role, password_hash)
VALUES ('admin@prorider.app', 'Super Admin', 'super_admin',
        '$2b$10$h/9oW7EowpDgdmR8A13MJeZdFwxAb8Vv/0RDPa2OkNgViSV1fm28S')
ON CONFLICT (email) DO NOTHING;
