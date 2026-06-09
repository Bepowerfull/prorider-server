/**
 * PRORIDER — Servidor v2.0
 * WebSocket (salas de aula) + HTTP REST (usuários, licenças, gamificação)
 */

const http       = require('http');
const WebSocket  = require('ws');
const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');
const bcrypt     = require('bcryptjs');  // pure-JS, sem compilação nativa
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');

// ══ Configuração ══════════════════════════════════════════════
const PORT       = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'prorider_dev_secret_change_in_production';
const DB_URL     = process.env.DATABASE_URL;

// ══ Express ═══════════════════════════════════════════════════
const app = express();
app.use(cors());
app.use(express.json());

// ══ PostgreSQL ════════════════════════════════════════════════
let db = null;
// Tenta conectar via DATABASE_URL ou via variáveis individuais PGHOST/PGPASSWORD
const PG_HOST = process.env.PGHOST;
const PG_USER = process.env.PGUSER || process.env.POSTGRES_USER;
const PG_PASS = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
const PG_DB   = process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway';
const PG_PORT = parseInt(process.env.PGPORT || '5432');

log('DB config: URL=' + (DB_URL?'sim':'não') + ' PGHOST=' + (PG_HOST||'não'));

const poolConfig = DB_URL
  ? { connectionString: DB_URL, ssl: DB_URL.includes('.railway.internal') ? false : { rejectUnauthorized: false } }
  : PG_HOST
    ? { host: PG_HOST, user: PG_USER, password: PG_PASS, database: PG_DB, port: PG_PORT, ssl: false }
    : null;

if (poolConfig) {
  db = new Pool(poolConfig);
  db.connect()
    .then(client => { client.release(); log('PostgreSQL conectado ✅'); })
    .catch(e => { db = null; log('PostgreSQL ERRO: ' + e.message); });
} else {
  log('Sem configuração de banco — modo WebSocket only');
}

// ══ Helpers ═══════════════════════════════════════════════════
function log(msg) {
  const now = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${now}] ${msg}`);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Acesso negado' });
    next();
  };
}

function calcLevel(points) {
  if (points >= 80000) return 'godmode';
  if (points >= 40000) return 'legend';
  if (points >= 20000) return 'champion';
  if (points >= 10000) return 'master';
  if (points >= 5000)  return 'elite';
  if (points >= 2000)  return 'avancado';
  if (points >= 800)   return 'intermediario';
  if (points >= 300)   return 'basico';
  return 'iniciante';
}

function calcPoints(aulaData) {
  let pts = 100; // base por completar
  if (aulaData.zona_predominante === 'z4' || aulaData.zona_predominante === 'z5') pts += 50;
  if (aulaData.zona_predominante === 'z6' || aulaData.zona_predominante === 'z7') pts += 75;
  if (aulaData.sem_pausas) pts += 25;
  if (aulaData.badge === 'Hard')     pts = Math.round(pts * 1.5);
  if (aulaData.badge === 'Advanced') pts = Math.round(pts * 2.0);
  return pts;
}

function shortId() {
  return crypto.randomBytes(10).toString('hex'); // 20 chars
}

// ══ Migração completa (idempotente — CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS) ══
async function runMigrations() {
  if (!db) return;
  try {
    // Criar tabela principal se não existir
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           SERIAL PRIMARY KEY,
        email        TEXT UNIQUE NOT NULL,
        name         TEXT,
        password_hash TEXT,
        role         TEXT DEFAULT 'aluno',  -- aluno | professor | gestor | financeiro | admin
        license_id   TEXT,
        points       INTEGER DEFAULT 0,
        level        TEXT DEFAULT 'Iniciante',
        peso         NUMERIC(5,1) DEFAULT 70,
        ftp          INTEGER DEFAULT 130,
        updated_at   TIMESTAMPTZ DEFAULT NOW(),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    log('Migração users OK (CREATE IF NOT EXISTS)');
    // Adicionar colunas novas em instâncias antigas
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS peso       NUMERIC(5,1) DEFAULT 70,
        ADD COLUMN IF NOT EXISTS ftp        INTEGER      DEFAULT 130,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ  DEFAULT NOW()
    `);
    // Tabela de histórico de aulas
    await db.query(`
      CREATE TABLE IF NOT EXISTS aula_historico (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome       TEXT,
        data_aula  TIMESTAMPTZ DEFAULT NOW(),
        dur_seg    INTEGER DEFAULT 0,
        kcal       INTEGER DEFAULT 0,
        zona_pct   JSONB,
        avg_ftp    INTEGER DEFAULT 0,
        avg_rpm    INTEGER DEFAULT 0,
        max_rpm    INTEGER DEFAULT 0,
        avg_watts  INTEGER DEFAULT 0
      )
    `);
    log('Migração aula_historico OK');
    // Tabela de licenças (academias/clientes)
    await db.query(`
      CREATE TABLE IF NOT EXISTS licencas (
        id           SERIAL PRIMARY KEY,
        codigo       TEXT UNIQUE NOT NULL,
        nome         TEXT NOT NULL,
        contato_nome TEXT,
        contato_email TEXT,
        contato_tel  TEXT,
        plano        TEXT DEFAULT 'basico',
        max_alunos   INTEGER DEFAULT 30,
        max_profs    INTEGER DEFAULT 2,
        status       TEXT DEFAULT 'ativa',
        valor_mensal NUMERIC(8,2) DEFAULT 0,
        vencimento   DATE,
        obs          TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`
      ALTER TABLE licencas
        ADD COLUMN IF NOT EXISTS obs TEXT,
        ADD COLUMN IF NOT EXISTS valor_mensal NUMERIC(8,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cidade TEXT,
        ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
        ADD COLUMN IF NOT EXISTS financeiro_email TEXT,
        ADD COLUMN IF NOT EXISTS financeiro_nome  TEXT,
        ADD COLUMN IF NOT EXISTS dia_vencimento   SMALLINT DEFAULT 10,
        ADD COLUMN IF NOT EXISTS ultimo_pagamento DATE,
        ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'em_dia',
        -- Dados do cartão: NUNCA armazenar número completo nem CVV.
        -- Apenas dados seguros para exibição (últimos 4 dígitos, bandeira, validade).
        -- O número completo JAMAIS transita pelo nosso servidor — vai direto ao gateway.
        ADD COLUMN IF NOT EXISTS cartao_bandeira   TEXT,
        ADD COLUMN IF NOT EXISTS cartao_final      CHAR(4),
        ADD COLUMN IF NOT EXISTS cartao_validade   CHAR(7),  -- MM/AAAA
        ADD COLUMN IF NOT EXISTS cartao_titular    TEXT,
        ADD COLUMN IF NOT EXISTS onboarding_token  TEXT UNIQUE,  -- token do formulário de onboarding
        -- Capacidade física da sala (bikes). Definida APENAS pelo admin Mario.
        -- O gestor NÃO pode alterar. É o teto máximo de vagas por aula.
        ADD COLUMN IF NOT EXISTS max_bikes         INTEGER DEFAULT 0
    `);
    // Tabela de histórico de pagamentos
    await db.query(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id           SERIAL PRIMARY KEY,
        license_id   TEXT NOT NULL,
        valor        NUMERIC(8,2) NOT NULL,
        data_pgto    DATE NOT NULL DEFAULT CURRENT_DATE,
        referencia   TEXT,  -- ex: "Junho/2026"
        metodo       TEXT DEFAULT 'cartao',
        status       TEXT DEFAULT 'confirmado',
        obs          TEXT,
        registrado_por TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    log('Migração pagamentos OK');
    // Vincular users à licença
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS license_id TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'
    `);
    // Criar conta gestor padrão para ProRider 001
    await db.query(`
      INSERT INTO users (email, name, password_hash, role, license_id)
      VALUES ('gestor001@prorider.com', 'Gestor ProRider 001', $1, 'gestor', '7DB49082')
      ON CONFLICT (email) DO NOTHING
    `, [await bcrypt.hash('prorider001', 10)]);
    log('Migração licencas OK');

    // ── Grade de aulas ────────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS aulas_agenda (
        id           SERIAL PRIMARY KEY,
        license_id   TEXT NOT NULL,
        nome         TEXT NOT NULL,
        professor_nome TEXT,
        professor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        dia_semana   SMALLINT NOT NULL, -- 0=Dom 1=Seg ... 6=Sab
        hora         TIME NOT NULL,
        duracao_min  INTEGER DEFAULT 50,
        vagas_max    INTEGER DEFAULT 20,
        sala         TEXT,
        cidade       TEXT,
        ativa        BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`
      ALTER TABLE licencas
        ADD COLUMN IF NOT EXISTS cidade TEXT,
        ADD COLUMN IF NOT EXISTS nome_fantasia TEXT
    `);
    log('Migração aulas_agenda OK');

    // ── Reservas de aulas ─────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS aulas_reservas (
        id         SERIAL PRIMARY KEY,
        agenda_id  INTEGER REFERENCES aulas_agenda(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data_aula  DATE NOT NULL,  -- data específica da ocorrência
        status     TEXT DEFAULT 'reservado', -- reservado | presente | ausente | cancelado
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(agenda_id, user_id, data_aula)
      )
    `);
    log('Migração aulas_reservas OK');

  } catch(e) {
    log('Migração ERRO: ' + e.message);
  }
}
runMigrations();

// ══════════════════════════════════════════════════════════════
// ROTAS HTTP
// ══════════════════════════════════════════════════════════════

// ── Health check ──────────────────────────────────────────────
app.get('/ping', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let dbOk = false;
  if (db) {
    try { const c = await db.query('SELECT 1'); dbOk = true; } catch(e) {}
  }
  res.json({
    status: 'ok',
    version: '2.2',
    db: dbOk,
    db_pool: !!db,
    db_url_set: !!process.env.DATABASE_URL,
    db_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0,35)+'...' : 'NOT SET',
    ts: Date.now()
  });
});

// ── Usuários ──────────────────────────────────────────────────

// Cadastro
app.post('/user/register', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  // Aceita tanto inglês (name/password) quanto português (nome/senha)
  const email    = req.body.email;
  const name     = req.body.name  || req.body.nome;
  const password = req.body.password || req.body.senha;
  const peso     = parseFloat(req.body.peso)  || 70;
  const ftp      = parseInt(req.body.ftp)     || 130;

  if (!email || !name || !password)
    return res.status(400).json({ error: 'email, nome e senha obrigatórios' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      'INSERT INTO users (email, name, password_hash, peso, ftp) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role, points, level, peso, ftp',
      [email.toLowerCase(), name, hash, peso, ftp]
    );
    const user = r.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user, token });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    log('register error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Login
app.post('/user/login', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email e password obrigatórios' });
  try {
    const r = await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!r.rows.length) return res.status(401).json({ error: 'Email ou senha incorretos' });
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Email ou senha incorretos' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, points: user.points, level: user.level }, token });
  } catch(e) {
    log('login error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Perfil atual
app.get('/user/me', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  try {
    const r = await db.query(
      'SELECT id, email, name, role, license_id, points, level, peso, ftp, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Licenças ───────────────────────────────────────────────────

// Validar chave de licença (Studio/Gym ao iniciar)
app.post('/license/validate', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { key, device_fingerprint } = req.body;
  if (!key) return res.status(400).json({ error: 'key obrigatória' });
  try {
    const r = await db.query('SELECT * FROM licenses WHERE key=$1', [key]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const lic = r.rows[0];
    if (lic.status !== 'active') return res.status(403).json({ error: 'Licença inativa ou revogada' });
    if (lic.expires_at && new Date(lic.expires_at) < new Date())
      return res.status(403).json({ error: 'Licença expirada' });

    // Vincular ao dispositivo na primeira ativação
    if (!lic.device_fingerprint && device_fingerprint) {
      await db.query('UPDATE licenses SET device_fingerprint=$1 WHERE id=$2', [device_fingerprint, lic.id]);
    } else if (lic.device_fingerprint && lic.device_fingerprint !== device_fingerprint) {
      return res.status(403).json({ error: 'Licença vinculada a outro dispositivo' });
    }

    const token = jwt.sign(
      { license_id: lic.id, type: lic.type, name: lic.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ valid: true, license: { id: lic.id, name: lic.name, type: lic.type }, token });
  } catch(e) {
    log('license/validate error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Gerar token QR para ativar professor no celular (Studio gera este token)
app.post('/license/generate-mobile-token', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { license_token } = req.body;
  if (!license_token) return res.status(400).json({ error: 'license_token obrigatório' });
  try {
    const payload = jwt.verify(license_token, JWT_SECRET);
    // Token QR válido por 5 minutos
    const qrToken = jwt.sign(
      { type: 'professor_activation', license_id: payload.license_id, license_name: payload.name },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    res.json({ qr_token: qrToken, expires_in: 300 });
  } catch(e) {
    res.status(401).json({ error: 'license_token inválido' });
  }
});

// Ativar modo professor no celular (app Aluno chama após escanear QR)
app.post('/license/activate-mobile', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { qr_token, device_id } = req.body;
  if (!qr_token || !device_id) return res.status(400).json({ error: 'qr_token e device_id obrigatórios' });
  try {
    const payload = jwt.verify(qr_token, JWT_SECRET);
    if (payload.type !== 'professor_activation') return res.status(400).json({ error: 'Token inválido' });

    // Salvar ativação
    await db.query(
      'INSERT INTO mobile_activations (license_id, user_id, device_id, token_hash) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [payload.license_id, req.user.id, device_id, crypto.createHash('sha256').update(qr_token).digest('hex')]
    );

    // Promover usuário a professor
    await db.query(
      'UPDATE users SET role=$1, license_id=$2, updated_at=NOW() WHERE id=$3',
      ['professor', payload.license_id, req.user.id]
    );

    // Novo token com role atualizado
    const newToken = jwt.sign(
      { id: req.user.id, email: req.user.email, role: 'professor' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ success: true, role: 'professor', token: newToken, license_name: payload.license_name });
  } catch(e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ error: 'QR expirado. Gere um novo no Studio.' });
    log('activate-mobile error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Aulas ──────────────────────────────────────────────────────

// Salvar aula compartilhada via QR (professor publica, aluno escaneia)
app.post('/aula/share', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { aula_json } = req.body;
  if (!aula_json) return res.status(400).json({ error: 'aula_json obrigatório' });
  try {
    const share_id = shortId();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await db.query(
      'INSERT INTO shared_aulas (share_id, aula_json, created_by, expires_at) VALUES ($1,$2,$3,$4)',
      [share_id, JSON.stringify(aula_json), req.user.id, expires_at]
    );
    res.json({ share_id, url: `https://prorider-server-production.up.railway.app/aula/load/${share_id}`, expires_at });
  } catch(e) {
    log('aula/share error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Carregar aula pelo share_id (aluno usa após escanear QR)
app.get('/aula/load/:share_id', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  try {
    const r = await db.query(
      'SELECT aula_json, expires_at FROM shared_aulas WHERE share_id=$1',
      [req.params.share_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Aula não encontrada' });
    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date())
      return res.status(410).json({ error: 'Link expirado. Peça um novo QR ao professor.' });
    res.json({ aula: row.aula_json });
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Registrar aula completada + calcular pontos
app.post('/aula/complete', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { aula_nome, duracao_sec, zona_predominante, badge, sem_pausas, zonas } = req.body;
  try {
    const pontos = calcPoints({ zona_predominante, badge, sem_pausas });
    await db.query(
      `INSERT INTO aulas_completadas
        (user_id, aula_nome, duracao_sec, pontos, zona_predominante,
         z1_pct, z2_pct, z3_pct, z4_pct, z5_pct, z6_pct, z7_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [req.user.id, aula_nome, duracao_sec, pontos, zona_predominante,
       zonas?.z1||0, zonas?.z2||0, zonas?.z3||0, zonas?.z4||0,
       zonas?.z5||0, zonas?.z6||0, zonas?.z7||0]
    );
    // Atualizar pontos e nível do usuário
    const r = await db.query(
      'UPDATE users SET points=points+$1, updated_at=NOW() WHERE id=$2 RETURNING points',
      [pontos, req.user.id]
    );
    const newPoints = r.rows[0].points;
    const newLevel  = calcLevel(newPoints);
    await db.query('UPDATE users SET level=$1 WHERE id=$2', [newLevel, req.user.id]);
    res.json({ pontos_ganhos: pontos, total_pontos: newPoints, nivel: newLevel });
  } catch(e) {
    log('aula/complete error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Atualizar perfil do usuário
app.put('/user/profile', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { name, email, peso, ftp } = req.body;
  try {
    const fields = [], vals = [];
    let idx = 1;
    if (name  && name.trim())        { fields.push(`name=$${idx++}`);  vals.push(name.trim()); }
    if (email && email.trim())       { fields.push(`email=$${idx++}`); vals.push(email.trim().toLowerCase()); }
    if (peso  && parseFloat(peso)>0) { fields.push(`peso=$${idx++}`);  vals.push(parseFloat(peso)); }
    if (ftp   && parseFloat(ftp)>0)  { fields.push(`ftp=$${idx++}`);   vals.push(parseFloat(ftp)); }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    fields.push(`updated_at=NOW()`);
    vals.push(req.user.id);
    const r = await db.query(
      `UPDATE users SET ${fields.join(',')} WHERE id=$${idx} RETURNING id, email, name, role, points, level, peso, ftp`,
      vals
    );
    res.json({ user: r.rows[0] });
  } catch(e) {
    log('user/profile error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Histórico de aulas do usuário
app.get('/aula/historico', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  try {
    const r = await db.query(
      'SELECT * FROM aulas_completadas WHERE user_id=$1 ORDER BY completed_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Admin — Super Admin ────────────────────────────────────────

// Listar todos os usuários
app.get('/admin/users', authMiddleware, requireRole('super_admin', 'admin_licenca'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  try {
    let query, params;
    if (req.user.role === 'super_admin') {
      query  = 'SELECT id,email,name,role,license_id,points,level,created_at FROM users ORDER BY created_at DESC';
      params = [];
    } else {
      // admin_licenca vê só sua licença
      const me = await db.query('SELECT license_id FROM users WHERE id=$1', [req.user.id]);
      const lic_id = me.rows[0]?.license_id;
      query  = 'SELECT id,email,name,role,license_id,points,level,created_at FROM users WHERE license_id=$1 ORDER BY created_at DESC';
      params = [lic_id];
    }
    const r = await db.query(query, params);
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Listar licenças
app.get('/admin/licenses', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  try {
    const r = await db.query('SELECT id,key,type,name,status,admin_email,created_at,expires_at FROM licenses ORDER BY created_at DESC');
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Criar nova licença
app.post('/admin/license/create', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { type, name, admin_email, expires_at } = req.body;
  if (!type || !name) return res.status(400).json({ error: 'type e name obrigatórios' });
  try {
    // Gerar chave: PRDR-STDO-XXXX-XXXX-XXXX
    const suffix = crypto.randomBytes(6).toString('hex').toUpperCase();
    const key = `PRDR-${type.toUpperCase().substring(0,4)}-${suffix.substring(0,4)}-${suffix.substring(4,8)}-${suffix.substring(8,12)}`;
    const r = await db.query(
      'INSERT INTO licenses (key, type, name, admin_email, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [key, type, name, admin_email||null, expires_at||null]
    );
    res.json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Promover usuário a professor
app.post('/admin/user/promote', authMiddleware, requireRole('super_admin', 'admin_licenca'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { user_id, role } = req.body;
  if (!user_id || !role) return res.status(400).json({ error: 'user_id e role obrigatórios' });
  const allowed = ['professor', 'admin_licenca', 'aluno'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'role inválido' });
  try {
    await db.query('UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2', [role, user_id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Pedidos de professor pendentes
app.get('/admin/professor-requests', authMiddleware, requireRole('super_admin', 'admin_licenca'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  try {
    const r = await db.query(
      `SELECT pr.*, u.name, u.email, l.name as license_name
       FROM professor_requests pr
       JOIN users u ON u.id=pr.user_id
       JOIN licenses l ON l.id=pr.license_id
       WHERE pr.status='pending'
       ORDER BY pr.requested_at DESC`
    );
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Aprovar/rejeitar pedido de professor
app.post('/admin/professor-requests/:id/review', authMiddleware, requireRole('super_admin', 'admin_licenca'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { status } = req.body; // 'approved' | 'rejected'
  if (!['approved','rejected'].includes(status)) return res.status(400).json({ error: 'status inválido' });
  try {
    const r = await db.query('SELECT * FROM professor_requests WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
    const pedido = r.rows[0];
    await db.query(
      'UPDATE professor_requests SET status=$1, reviewed_at=NOW(), reviewed_by=$2 WHERE id=$3',
      [status, req.user.id, req.params.id]
    );
    if (status === 'approved') {
      await db.query('UPDATE users SET role=$1, license_id=$2, updated_at=NOW() WHERE id=$3',
        ['professor', pedido.license_id, pedido.user_id]);
    }
    res.json({ success: true, status });
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ══════════════════════════════════════════════════════════════
// WEBSOCKET — código original preservado integralmente
// ══════════════════════════════════════════════════════════════
const salas = {};

function broadcastAlunos(salaCode, msg, excludeWs = null) {
  const sala = salas[salaCode];
  if (!sala) return;
  const data = JSON.stringify(msg);
  for (const [nome, ws] of sala.alunos) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function broadcast(salaCode, msg, excludeWs = null) {
  const sala = salas[salaCode];
  if (!sala) return;
  const data = JSON.stringify(msg);
  if (sala.professor && sala.professor !== excludeWs && sala.professor.readyState === WebSocket.OPEN) sala.professor.send(data);
  for (const [nome, ws] of sala.alunos) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

// HTTP server unificado (Express + WebSocket no mesmo porto)
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws._salaCode = null; ws._tipo = null; ws._nome = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.tipo) {

      case 'criar_sala': {
        const codigo = msg.codigo;
        if (!codigo) return;
        salas[codigo] = { professor: ws, alunos: new Map(), estado: { iniciada: false, grafico: [], blocoIdx: 0, nomeAula: '' } };
        ws._salaCode = codigo; ws._tipo = 'professor';
        log(`Sala criada: ${codigo}`);
        ws.send(JSON.stringify({ tipo: 'sala_criada', codigo }));
        break;
      }

      case 'entrar_sala': {
        const { codigo, nome, bike } = msg;
        if (!codigo || !nome) return;
        const sala = salas[codigo];
        if (!sala) { ws.send(JSON.stringify({ tipo: 'erro', msg: 'Sala nao encontrada' })); return; }
        sala.alunos.set(nome, ws);
        ws._salaCode = codigo; ws._tipo = 'aluno'; ws._nome = nome;
        log(`Aluno entrou: ${nome} na sala ${codigo}`);
        if (sala.professor && sala.professor.readyState === WebSocket.OPEN) {
          sala.professor.send(JSON.stringify({ tipo: 'aluno_conectou', nome, bike: bike || null, horario: new Date().toLocaleTimeString('pt-BR') }));
        }
        ws.send(JSON.stringify({ tipo: 'conectado', codigo, nome }));
        ws.send(JSON.stringify({ tipo: 'entrou_sala', codigo, nome }));
        if (sala.estado.iniciada && sala.estado.grafico.length > 0) {
          ws.send(JSON.stringify({ tipo: 'aula_iniciada', grafico: sala.estado.grafico, blocoIdx: sala.estado.blocoIdx, nomeAula: sala.estado.nomeAula }));
        }
        break;
      }

      case 'dados_aluno': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        const sala = salas[salaCode];
        if (sala.professor && sala.professor.readyState === WebSocket.OPEN) {
          sala.professor.send(JSON.stringify({ tipo: 'dados_aluno', nome: ws._nome || msg.nome, genero: msg.genero, watts: msg.watts, rpm: msg.rpm, fc: msg.fc, zona: msg.zona, ftp: msg.ftp, kcal: msg.kcal, dist: msg.dist, potMax: msg.potMax, horario: msg.horario || new Date().toLocaleTimeString('pt-BR') }));
        }
        break;
      }

      case 'iniciar_aula': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        const sala = salas[salaCode];
        sala.estado.iniciada = true;
        sala.estado.grafico  = msg.grafico || [];
        sala.estado.blocoIdx = msg.blocoIdx || 0;
        sala.estado.nomeAula = msg.nomeAula || '';
        log(`Aula iniciada na sala ${salaCode}`);
        broadcastAlunos(salaCode, { tipo: 'aula_iniciada', grafico: sala.estado.grafico, blocoIdx: sala.estado.blocoIdx, nomeAula: sala.estado.nomeAula });
        break;
      }

      case 'dados_aula':
      case 'update_aula': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        const sala = salas[salaCode];
        if (msg.grafico)              sala.estado.grafico  = msg.grafico;
        if (msg.blocoIdx !== undefined) sala.estado.blocoIdx = msg.blocoIdx;
        if (msg.nomeAula)             sala.estado.nomeAula = msg.nomeAula;
        broadcast(salaCode, msg, ws);
        break;
      }

      case 'iniciar_ftp': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        log(`Teste FTP ${msg.protocolo}min na sala ${salaCode}`);
        broadcastAlunos(salaCode, { tipo: 'iniciar_ftp', protocolo: msg.protocolo });
        break;
      }

      case 'fim_ftp': {
        const salaCodeFtp = ws._salaCode;
        if (!salaCodeFtp || !salas[salaCodeFtp]) return;
        log(`Teste FTP encerrado na sala ${salaCodeFtp}`);
        broadcastAlunos(salaCodeFtp, { tipo: 'fim_ftp' });
        break;
      }

      case 'fim_aula': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        salas[salaCode].estado.iniciada = false;
        log(`Aula encerrada na sala ${salaCode}`);
        broadcastAlunos(salaCode, { tipo: 'fim_aula' });
        break;
      }

      case 'iniciar_desafio':
      case 'desafio_update':
      case 'fim_desafio': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        log(`${msg.tipo} na sala ${salaCode}`);
        broadcastAlunos(salaCode, msg, ws);
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ tipo: 'pong' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    const salaCode = ws._salaCode;
    if (!salaCode || !salas[salaCode]) return;
    const sala = salas[salaCode];
    if (ws._tipo === 'professor') {
      log(`Professor saiu da sala ${salaCode}`);
      broadcastAlunos(salaCode, { tipo: 'sala_encerrada' });
      delete salas[salaCode];
    } else if (ws._tipo === 'aluno' && ws._nome) {
      sala.alunos.delete(ws._nome);
      log(`Aluno saiu: ${ws._nome}`);
      if (sala.professor && sala.professor.readyState === WebSocket.OPEN)
        sala.professor.send(JSON.stringify({ tipo: 'aluno_saiu', nome: ws._nome }));
    }
  });

  ws.on('error', (err) => { if (err.code !== 'ECONNRESET') console.error('WS error:', err.message); });
});

// ══════════════════════════════════════════════════════════════
// ROTAS ADMIN (role = 'admin')
// ══════════════════════════════════════════════════════════════

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    req.user = payload;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// ── Dashboard resumo ──
app.get('/admin/dashboard', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [alunos, licencas, aulas30] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM users WHERE role='aluno'`),
      db.query(`SELECT COUNT(*), status FROM licencas GROUP BY status`),
      db.query(`SELECT COUNT(*) FROM aula_historico WHERE data_aula > NOW()-INTERVAL '30 days'`),
    ]);
    res.json({
      total_alunos: parseInt(alunos.rows[0].count),
      licencas: licencas.rows,
      aulas_30d: parseInt(aulas30.rows[0].count),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Licenças CRUD ──
app.get('/admin/licencas', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT l.*,
        (SELECT COUNT(*) FROM users u WHERE u.license_id=l.codigo AND u.role='aluno') AS total_alunos,
        (SELECT COUNT(*) FROM users u WHERE u.license_id=l.codigo AND u.role='professor') AS total_profs
      FROM licencas l ORDER BY l.created_at DESC
    `);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/licencas', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs, valor_mensal, vencimento, obs, max_bikes } = req.body;
  if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
  const codigo = shortId().substring(0, 8).toUpperCase();
  try {
    const r = await db.query(
      `INSERT INTO licencas (codigo, nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs, valor_mensal, vencimento, obs, max_bikes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [codigo, nome, contato_nome||null, contato_email||null, contato_tel||null,
       plano||'basico', max_alunos||30, max_profs||2,
       valor_mensal||0, vencimento||null, obs||null, parseInt(max_bikes)||0]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/admin/licencas/:id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs, valor_mensal, vencimento, status, obs, max_bikes } = req.body;
  try {
    const r = await db.query(
      `UPDATE licencas SET nome=$1, contato_nome=$2, contato_email=$3, contato_tel=$4,
       plano=$5, max_alunos=$6, max_profs=$7, valor_mensal=$8, vencimento=$9,
       status=$10, obs=$11, max_bikes=$12, updated_at=NOW() WHERE id=$13 RETURNING *`,
      [nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs,
       valor_mensal, vencimento, status, obs, parseInt(max_bikes)||0, req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/licencas/:id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    await db.query('DELETE FROM licencas WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Alunos ──
app.get('/admin/alunos', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { license_id, search } = req.query;
  try {
    let q = `SELECT u.id, u.name, u.email, u.role, u.license_id, u.status,
               u.points, u.level, u.peso, u.ftp, u.created_at,
               (SELECT COUNT(*) FROM aula_historico ah WHERE ah.user_id=u.id) AS total_aulas,
               (SELECT MAX(data_aula) FROM aula_historico ah WHERE ah.user_id=u.id) AS ultima_aula
             FROM users u WHERE u.role='aluno'`;
    const params = [];
    if (license_id) { params.push(license_id); q += ` AND u.license_id=$${params.length}`; }
    if (search) { params.push('%'+search+'%'); q += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`; }
    q += ' ORDER BY u.created_at DESC';
    const r = await db.query(q, params);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/alunos/:id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [user, hist] = await Promise.all([
      db.query('SELECT id,name,email,role,license_id,status,points,level,peso,ftp,created_at FROM users WHERE id=$1', [req.params.id]),
      db.query('SELECT * FROM aula_historico WHERE user_id=$1 ORDER BY data_aula DESC LIMIT 50', [req.params.id]),
    ]);
    if (!user.rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ...user.rows[0], historico: hist.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/admin/alunos/:id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { name, license_id, status, role } = req.body;
  try {
    const r = await db.query(
      'UPDATE users SET name=$1, license_id=$2, status=$3, role=$4, updated_at=NOW() WHERE id=$5 RETURNING id,name,email,role,license_id,status',
      [name, license_id, status||'ativo', role||'aluno', req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Criar conta admin (só via servidor, sem rota pública) ──
app.post('/admin/criar-admin', async (req, res) => {
  // Rota protegida por secret key de setup
  if (req.headers['x-setup-key'] !== (process.env.SETUP_KEY || 'prorider_setup_2026')) {
    return res.status(403).json({ error: 'Chave inválida' });
  }
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,'admin')
       ON CONFLICT (email) DO UPDATE SET role='admin', password_hash=$3 RETURNING id, email, name, role`,
      [email.toLowerCase(), name||email, hash]
    );
    res.json({ ok: true, user: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// IMPERSONAÇÃO — admin entra como gestor de qualquer licença
// ══════════════════════════════════════════════════════════════
app.post('/admin/impersonate/:license_id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const lic = await db.query('SELECT * FROM licencas WHERE codigo=$1', [req.params.license_id]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    // Gera token temporário com role gestor + license_id desta academia
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, role: 'gestor',
        license_id: req.params.license_id, impersonated_by: req.user.email },
      JWT_SECRET, { expiresIn: '4h' }
    );
    res.json({ token, academia: lic.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// PAGAMENTOS — admin gerencia pagamentos de todas as licenças
// ══════════════════════════════════════════════════════════════

// Helper — calcula status de pagamento automático
function calcStatusPagamento(ultimoPagamento, diaVenc) {
  if (!ultimoPagamento) return 'pendente';
  const hoje  = new Date(); hoje.setHours(0,0,0,0);
  const pgto  = new Date(ultimoPagamento);
  const mesAtual = hoje.getMonth(), anoAtual = hoje.getFullYear();
  // Data de vencimento do mês atual
  const vencMesAtual = new Date(anoAtual, mesAtual, diaVenc || 10);
  // Se já pagou neste mês ou no mês passado e ainda não venceu
  const mesUltimoPgto  = pgto.getMonth();
  const anoUltimoPgto  = pgto.getFullYear();
  const diffMeses = (anoAtual - anoUltimoPgto) * 12 + (mesAtual - mesUltimoPgto);
  if (diffMeses === 0) return 'em_dia';
  const diasAtraso = Math.floor((hoje - vencMesAtual) / 86400000);
  if (diasAtraso < 0)  return 'em_dia';    // ainda não venceu
  if (diasAtraso < 15) return 'atrasado';  // amarelo
  return 'bloqueado';                       // vermelho — corta acesso
}

// Listar pagamentos de uma licença
app.get('/admin/pagamentos/:license_id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [lic, pgs] = await Promise.all([
      db.query('SELECT * FROM licencas WHERE codigo=$1', [req.params.license_id]),
      db.query('SELECT * FROM pagamentos WHERE license_id=$1 ORDER BY data_pgto DESC LIMIT 24', [req.params.license_id]),
    ]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const l = lic.rows[0];
    const status = calcStatusPagamento(l.ultimo_pagamento, l.dia_vencimento);
    // Atualiza status_pagamento se mudou
    if (status !== l.status_pagamento) {
      await db.query('UPDATE licencas SET status_pagamento=$1, status=$2 WHERE codigo=$3',
        [status, status === 'bloqueado' ? 'bloqueada' : 'ativa', req.params.license_id]);
    }
    res.json({ licenca: { ...l, status_pagamento: status }, pagamentos: pgs.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Registrar pagamento
app.post('/admin/pagamentos/:license_id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { valor, data_pgto, referencia, metodo, obs } = req.body;
  if (!valor) return res.status(400).json({ error: 'Valor obrigatório' });
  try {
    const dataPgto = data_pgto || new Date().toISOString().split('T')[0];
    await db.query(`
      INSERT INTO pagamentos (license_id, valor, data_pgto, referencia, metodo, obs, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [req.params.license_id, valor, dataPgto, referencia||null, metodo||'cartao', obs||null, req.user.email]);
    // Atualiza ultimo_pagamento e status
    await db.query(`
      UPDATE licencas SET ultimo_pagamento=$1, status_pagamento='em_dia', status='ativa', updated_at=NOW()
      WHERE codigo=$2
    `, [dataPgto, req.params.license_id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Atualizar dados financeiros da licença (email financeiro, dia vencimento, valor)
app.patch('/admin/licencas/:id/financeiro', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { financeiro_email, financeiro_nome, dia_vencimento, valor_mensal } = req.body;
  try {
    const r = await db.query(`
      UPDATE licencas SET
        financeiro_email=$1, financeiro_nome=$2,
        dia_vencimento=$3, valor_mensal=$4, updated_at=NOW()
      WHERE id=$5 RETURNING *
    `, [financeiro_email||null, financeiro_nome||null, dia_vencimento||10, valor_mensal||0, req.params.id]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Status de pagamento de todas as licenças (dashboard financeiro)
app.get('/admin/financeiro/dashboard', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT l.*,
        (SELECT COUNT(*) FROM users WHERE license_id=l.codigo AND role='aluno') as total_alunos,
        (SELECT data_pgto FROM pagamentos WHERE license_id=l.codigo ORDER BY data_pgto DESC LIMIT 1) as ultimo_pgto_data
      FROM licencas l ORDER BY l.nome
    `);
    // Recalcular status de cada licença
    const licencas = r.rows.map(l => ({
      ...l,
      status_pagamento: calcStatusPagamento(l.ultimo_pagamento || l.ultimo_pgto_data, l.dia_vencimento)
    }));
    const resumo = {
      total: licencas.length,
      em_dia:   licencas.filter(l => l.status_pagamento === 'em_dia').length,
      atrasado: licencas.filter(l => l.status_pagamento === 'atrasado').length,
      bloqueado:licencas.filter(l => l.status_pagamento === 'bloqueado').length,
      pendente: licencas.filter(l => l.status_pagamento === 'pendente').length,
      receita_mensal: licencas.reduce((s,l) => s + parseFloat(l.valor_mensal||0), 0),
    };
    res.json({ licencas, resumo });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// ROTAS GESTOR (role = 'gestor' — acesso por licença)
// ══════════════════════════════════════════════════════════════

function gestorAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (p.role !== 'gestor' && p.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    req.user = p;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// Alunos da licença do gestor
app.get('/gestor/alunos', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const licId = req.user.license_id;
  try {
    const r = await db.query(`
      SELECT u.id, u.name, u.email, u.status, u.points, u.level, u.peso, u.ftp, u.created_at,
        (SELECT COUNT(*) FROM aula_historico ah WHERE ah.user_id=u.id) AS total_aulas,
        (SELECT MAX(data_aula) FROM aula_historico ah WHERE ah.user_id=u.id) AS ultima_aula
      FROM users u WHERE u.license_id=$1 AND u.role='aluno'
      ORDER BY u.created_at DESC`, [licId]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Detalhes de aluno da licença
app.get('/gestor/alunos/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [user, hist] = await Promise.all([
      db.query('SELECT id,name,email,role,license_id,status,points,level,peso,ftp,created_at FROM users WHERE id=$1', [req.params.id]),
      db.query('SELECT * FROM aula_historico WHERE user_id=$1 ORDER BY data_aula DESC LIMIT 100', [req.params.id]),
    ]);
    if (!user.rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ...user.rows[0], historico: hist.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Editar dados de um aluno (gestor ou admin)
app.put('/gestor/alunos/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { name, email, ftp, peso, status } = req.body;
  try {
    // Gestor só pode editar alunos da sua licença (admin pode qualquer)
    const aluno = await db.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!aluno.rows.length) return res.status(404).json({ error: 'Aluno não encontrado' });
    if (req.user.role === 'gestor' && aluno.rows[0].license_id !== req.user.license_id)
      return res.status(403).json({ error: 'Aluno não pertence à sua academia' });
    const fields = [], vals = []; let idx = 1;
    if (name)   { fields.push(`name=$${idx++}`);  vals.push(name.trim()); }
    if (email)  { fields.push(`email=$${idx++}`); vals.push(email.trim().toLowerCase()); }
    if (ftp)    { fields.push(`ftp=$${idx++}`);   vals.push(parseInt(ftp)); }
    if (peso)   { fields.push(`peso=$${idx++}`);  vals.push(parseFloat(peso)); }
    if (status) { fields.push(`status=$${idx++}`);vals.push(status); }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo enviado' });
    fields.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    const r = await db.query(
      `UPDATE users SET ${fields.join(',')} WHERE id=$${idx} RETURNING id,name,email,ftp,peso,status,level,points`,
      vals
    );
    res.json(r.rows[0]);
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Este e-mail já está em uso.' });
    res.status(500).json({ error: e.message });
  }
});

// Reset de senha de um aluno (gestor ou admin)
app.post('/gestor/alunos/:id/reset-senha', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
  try {
    const aluno = await db.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!aluno.rows.length) return res.status(404).json({ error: 'Aluno não encontrado' });
    if (req.user.role === 'gestor' && aluno.rows[0].license_id !== req.user.license_id)
      return res.status(403).json({ error: 'Aluno não pertence à sua academia' });
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Stats da academia
app.get('/gestor/stats', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const licId = req.user.license_id;
  try {
    const [alunos, aulas7, aulas30, top] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM users WHERE license_id=$1 AND role='aluno'`, [licId]),
      db.query(`SELECT COUNT(*) FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 AND ah.data_aula > NOW()-INTERVAL '7 days'`, [licId]),
      db.query(`SELECT COUNT(*) FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 AND ah.data_aula > NOW()-INTERVAL '30 days'`, [licId]),
      db.query(`SELECT u.name, COUNT(ah.id) as total FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 GROUP BY u.id, u.name ORDER BY total DESC LIMIT 5`, [licId]),
    ]);
    res.json({
      total_alunos: parseInt(alunos.rows[0].count),
      aulas_7d: parseInt(aulas7.rows[0].count),
      aulas_30d: parseInt(aulas30.rows[0].count),
      top_alunos: top.rows,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// ROTAS ALUNO PORTAL (qualquer aluno autenticado)
// ══════════════════════════════════════════════════════════════

// Histórico completo do aluno
app.get('/aluno/portal/historico', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(
      'SELECT * FROM aula_historico WHERE user_id=$1 ORDER BY data_aula DESC LIMIT 100',
      [req.user.id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Perfil completo do aluno
app.get('/aluno/portal/perfil', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [user, stats] = await Promise.all([
      db.query('SELECT id,name,email,role,license_id,points,level,peso,ftp,created_at FROM users WHERE id=$1', [req.user.id]),
      db.query(`SELECT COUNT(*) as total_aulas, COALESCE(SUM(dur_seg),0) as total_seg, COALESCE(SUM(kcal),0) as total_kcal FROM aula_historico WHERE user_id=$1`, [req.user.id]),
    ]);
    res.json({ ...user.rows[0], ...stats.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// ONBOARDING — formulário público de nova academia
// ══════════════════════════════════════════════════════════════

// Gerar token de onboarding para uma licença (admin envia o link)
app.post('/admin/licencas/:id/gerar-onboarding', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const token = crypto.randomBytes(16).toString('hex');
    await db.query('UPDATE licencas SET onboarding_token=$1 WHERE id=$2', [token, req.params.id]);
    const link = `${req.headers.origin || 'https://bepowerfull.github.io/prorider'}/onboarding.html?token=${token}`;
    res.json({ token, link });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Consultar dados da licença pelo token de onboarding (público)
app.get('/onboarding/:token', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(
      'SELECT id, codigo, nome, nome_fantasia, cidade, plano, valor_mensal, dia_vencimento, financeiro_email, financeiro_nome FROM licencas WHERE onboarding_token=$1',
      [req.params.token]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Link inválido ou expirado' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Submeter formulário de onboarding (público — cria gestor + financeiro)
app.post('/onboarding/:token', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { gestor_nome, gestor_email, gestor_senha,
          fin_nome, fin_email, fin_senha,
          academia_nome_fantasia, cidade } = req.body;
  if (!gestor_email || !gestor_senha)
    return res.status(400).json({ error: 'Dados do gestor obrigatórios' });
  try {
    const lic = await db.query('SELECT * FROM licencas WHERE onboarding_token=$1', [req.params.token]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Link inválido' });
    const l = lic.rows[0];
    // Atualizar nome fantasia e cidade se fornecidos
    if (academia_nome_fantasia || cidade) {
      await db.query('UPDATE licencas SET nome_fantasia=COALESCE($1,nome_fantasia), cidade=COALESCE($2,cidade) WHERE id=$3',
        [academia_nome_fantasia||null, cidade||null, l.id]);
    }
    // Criar conta gestor
    const hashGestor = await bcrypt.hash(gestor_senha, 10);
    await db.query(`
      INSERT INTO users (email, name, password_hash, role, license_id)
      VALUES ($1,$2,$3,'gestor',$4)
      ON CONFLICT (email) DO UPDATE SET role='gestor', license_id=$4, password_hash=$3
    `, [gestor_email.toLowerCase(), gestor_nome||gestor_email, hashGestor, l.codigo]);
    // Criar conta financeiro (se fornecida)
    if (fin_email && fin_senha) {
      const hashFin = await bcrypt.hash(fin_senha, 10);
      await db.query(`
        INSERT INTO users (email, name, password_hash, role, license_id)
        VALUES ($1,$2,$3,'financeiro',$4)
        ON CONFLICT (email) DO UPDATE SET role='financeiro', license_id=$4, password_hash=$3
      `, [fin_email.toLowerCase(), fin_nome||fin_email, hashFin, l.codigo]);
      await db.query('UPDATE licencas SET financeiro_email=$1, financeiro_nome=$2 WHERE id=$3',
        [fin_email, fin_nome||fin_email, l.id]);
    }
    // Invalidar token de onboarding após uso
    await db.query('UPDATE licencas SET onboarding_token=NULL WHERE id=$1', [l.id]);
    res.json({ ok: true, message: 'Cadastro concluído! Faça login com suas credenciais.' });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// FINANCEIRO DA ACADEMIA (role: financeiro ou gestor ou admin)
// ══════════════════════════════════════════════════════════════

function finAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (!['financeiro','gestor','admin'].includes(p.role))
      return res.status(403).json({ error: 'Acesso negado' });
    req.user = p;
    next();
  } catch(e) { return res.status(401).json({ error: 'Token inválido' }); }
}

// Ver situação financeira da própria academia
app.get('/academia/financeiro', finAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const licId = req.user.license_id;
  if (!licId) return res.status(403).json({ error: 'Sem licença associada' });
  try {
    const [lic, pgs] = await Promise.all([
      db.query('SELECT * FROM licencas WHERE codigo=$1', [licId]),
      db.query('SELECT id,data_pgto,referencia,valor,metodo,status FROM pagamentos WHERE license_id=$1 ORDER BY data_pgto DESC LIMIT 24', [licId]),
    ]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const l = lic.rows[0];
    const isAdmin = req.user.role === 'admin' || req.user.impersonated_by;
    // ⚠️ SEGURANÇA: dados do cartão são INVISÍVEIS para admin e gestor em modo suporte.
    // Apenas o role 'financeiro' ou o gestor titular (sem impersonação) vê dados mascarados.
    // Número completo e CVV NUNCA são armazenados — apenas últimos 4 dígitos e bandeira.
    const podeVerCartao = req.user.role === 'financeiro' ||
                          (req.user.role === 'gestor' && !req.user.impersonated_by);
    res.json({
      status_pagamento: calcStatusPagamento(l.ultimo_pagamento, l.dia_vencimento),
      valor_mensal: l.valor_mensal,
      dia_vencimento: l.dia_vencimento,
      ultimo_pagamento: l.ultimo_pagamento,
      financeiro_nome: l.financeiro_nome,
      financeiro_email: l.financeiro_email,
      // Cartão — apenas para financeiro/gestor titular; admin vê null
      cartao: podeVerCartao ? {
        bandeira:  l.cartao_bandeira,
        final:     l.cartao_final,      // apenas últimos 4 dígitos
        validade:  l.cartao_validade,   // MM/AAAA
        titular:   l.cartao_titular,
      } : null,
      cartao_cadastrado: !!(l.cartao_final), // admin vê só se há cartão, mas não os dados
      pagamentos: pgs.rows,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Salvar dados do cartão (apenas financeiro ou gestor titular — NUNCA admin)
app.put('/academia/financeiro/cartao', finAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  // ⚠️ SEGURANÇA: admin e modo suporte não podem salvar nem ver dados completos do cartão.
  // Qualquer tentativa de acesso via impersonação é bloqueada aqui no servidor.
  if (req.user.role === 'admin' || req.user.impersonated_by)
    return res.status(403).json({ error: 'Administradores não têm acesso a dados de cartão. Use o login do responsável financeiro.' });
  const { bandeira, final, validade, titular } = req.body;
  // Validação: final deve ser exatamente 4 dígitos
  if (!final || !/^\d{4}$/.test(final))
    return res.status(400).json({ error: 'Informe os últimos 4 dígitos do cartão.' });
  if (!validade || !/^\d{2}\/\d{4}$/.test(validade))
    return res.status(400).json({ error: 'Validade no formato MM/AAAA.' });
  // IMPORTANTE: número completo e CVV NUNCA chegam aqui.
  // O formulário do cliente envia APENAS estes campos seguros.
  try {
    await db.query(`
      UPDATE licencas SET
        cartao_bandeira=$1, cartao_final=$2, cartao_validade=$3, cartao_titular=$4, updated_at=NOW()
      WHERE codigo=$5
    `, [bandeira||null, final, validade, titular||null, req.user.license_id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// CONFIG — GESTOR (ler configurações da licença)
// ══════════════════════════════════════════════════════════════

// Retorna configurações não-sensíveis da licença (incluindo max_bikes)
// max_bikes é somente-leitura para o gestor — definido apenas pelo admin Mario
app.get('/gestor/config', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(
      'SELECT max_bikes, max_alunos, plano, nome_fantasia, cidade FROM licencas WHERE codigo=$1',
      [req.user.license_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// AGENDA — GESTOR (criar/editar grade de aulas)
// ══════════════════════════════════════════════════════════════

// Listar grade completa da academia
app.get('/gestor/agenda', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT a.*,
        (SELECT COUNT(*) FROM aulas_reservas r
         WHERE r.agenda_id=a.id AND r.data_aula=CURRENT_DATE AND r.status<>'cancelado') as reservas_hoje
      FROM aulas_agenda a
      WHERE a.license_id=$1
      ORDER BY a.dia_semana, a.hora
    `, [req.user.license_id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Criar aula na grade
app.post('/gestor/agenda', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala } = req.body;
  if (!nome || dia_semana === undefined || !hora)
    return res.status(400).json({ error: 'nome, dia_semana e hora obrigatórios' });
  try {
    // buscar cidade e capacidade (max_bikes) da licença
    const lic = await db.query('SELECT cidade, max_bikes FROM licencas WHERE codigo=$1', [req.user.license_id]);
    const cidade    = lic.rows[0]?.cidade    || null;
    const max_bikes = lic.rows[0]?.max_bikes || 0;
    // Validar vagas contra capacidade física da sala
    const vagasSolicitadas = parseInt(vagas_max) || 20;
    if (max_bikes > 0 && vagasSolicitadas > max_bikes)
      return res.status(400).json({
        error: `A sala tem capacidade para ${max_bikes} bikes. Você não pode configurar mais vagas do que isso.`
      });
    const r = await db.query(`
      INSERT INTO aulas_agenda (license_id, nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala, cidade)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [req.user.license_id, nome, professor_nome||null, dia_semana, hora, duracao_min||50, vagasSolicitadas, sala||null, cidade]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Editar aula
app.put('/gestor/agenda/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala, ativa } = req.body;
  try {
    // Validar vagas contra capacidade física da sala
    const lic = await db.query('SELECT max_bikes FROM licencas WHERE codigo=$1', [req.user.license_id]);
    const max_bikes = lic.rows[0]?.max_bikes || 0;
    const vagasSolicitadas = parseInt(vagas_max) || 20;
    if (max_bikes > 0 && vagasSolicitadas > max_bikes)
      return res.status(400).json({
        error: `A sala tem capacidade para ${max_bikes} bikes. Você não pode configurar mais vagas do que isso.`
      });
    const r = await db.query(`
      UPDATE aulas_agenda SET
        nome=$1, professor_nome=$2, dia_semana=$3, hora=$4,
        duracao_min=$5, vagas_max=$6, sala=$7, ativa=$8
      WHERE id=$9 AND license_id=$10 RETURNING *
    `, [nome, professor_nome, dia_semana, hora, duracao_min, vagasSolicitadas, sala, ativa !== false, req.params.id, req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Remover aula da grade
app.delete('/gestor/agenda/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    await db.query('DELETE FROM aulas_agenda WHERE id=$1 AND license_id=$2', [req.params.id, req.user.license_id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Lista de reservados numa aula (data específica) — professor e gestor
app.get('/gestor/agenda/:id/reservas', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const data = req.query.data || new Date().toISOString().split('T')[0];
  try {
    const r = await db.query(`
      SELECT r.id, r.status, r.created_at, u.id as user_id, u.name, u.email, u.ftp
      FROM aulas_reservas r
      JOIN users u ON u.id=r.user_id
      WHERE r.agenda_id=$1 AND r.data_aula=$2
      ORDER BY r.created_at
    `, [req.params.id, data]);
    // contar vagas
    const aula = await db.query('SELECT vagas_max FROM aulas_agenda WHERE id=$1', [req.params.id]);
    const vagas_max = aula.rows[0]?.vagas_max || 20;
    const confirmados = r.rows.filter(x => x.status !== 'cancelado').length;
    res.json({ reservas: r.rows, vagas_max, confirmados, vagas_livres: vagas_max - confirmados });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Check-in / alterar status da reserva (professor/gestor)
app.put('/gestor/reservas/:id/status', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { status } = req.body; // presente | ausente | cancelado | reservado
  if (!['presente','ausente','cancelado','reservado'].includes(status))
    return res.status(400).json({ error: 'Status inválido' });
  try {
    const r = await db.query(
      'UPDATE aulas_reservas SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Adicionar aluno manualmente (walk-in)
app.post('/gestor/agenda/:id/walkin', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { user_id, data } = req.body;
  const dataAula = data || new Date().toISOString().split('T')[0];
  try {
    const r = await db.query(`
      INSERT INTO aulas_reservas (agenda_id, user_id, data_aula, status)
      VALUES ($1,$2,$3,'presente')
      ON CONFLICT (agenda_id, user_id, data_aula) DO UPDATE SET status='presente'
      RETURNING *
    `, [req.params.id, user_id, dataAula]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// AGENDA — PÚBLICO (busca por cidade, sem autenticação)
// ══════════════════════════════════════════════════════════════

// Buscar academias por cidade
app.get('/agenda/cidades', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT DISTINCT l.codigo, l.nome, l.nome_fantasia, l.cidade
      FROM licencas l
      JOIN aulas_agenda a ON a.license_id=l.codigo
      WHERE l.status='ativa' AND a.ativa=TRUE AND l.cidade IS NOT NULL
      ORDER BY l.cidade, l.nome
    `);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Grade de uma academia específica (próximos 7 dias)
app.get('/agenda/grade/:license_id', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [lic, aulas] = await Promise.all([
      db.query('SELECT codigo, nome, nome_fantasia, cidade FROM licencas WHERE codigo=$1 AND status=$2',
        [req.params.license_id, 'ativa']),
      db.query(`
        SELECT a.*,
          (SELECT COUNT(*) FROM aulas_reservas r
           WHERE r.agenda_id=a.id
             AND r.data_aula=CURRENT_DATE + ((a.dia_semana - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7) * INTERVAL '1 day'
             AND r.status<>'cancelado') as reservas
        FROM aulas_agenda a
        WHERE a.license_id=$1 AND a.ativa=TRUE
        ORDER BY a.dia_semana, a.hora
      `, [req.params.license_id]),
    ]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Academia não encontrada' });
    res.json({ academia: lic.rows[0], aulas: aulas.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// AGENDA — ALUNO (reservar / cancelar / ver suas reservas)
// ══════════════════════════════════════════════════════════════

// Ver reservas futuras do aluno
app.get('/aluno/reservas', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT r.*, a.nome as aula_nome, a.hora, a.dia_semana, a.professor_nome,
             a.duracao_min, a.sala, l.nome as academia_nome, l.nome_fantasia, l.cidade
      FROM aulas_reservas r
      JOIN aulas_agenda a ON a.id=r.agenda_id
      JOIN licencas l ON l.codigo=a.license_id
      WHERE r.user_id=$1 AND r.data_aula >= CURRENT_DATE AND r.status<>'cancelado'
      ORDER BY r.data_aula, a.hora
    `, [req.user.id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Reservar vaga
app.post('/aluno/reservar', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { agenda_id, data_aula } = req.body;
  if (!agenda_id || !data_aula) return res.status(400).json({ error: 'agenda_id e data_aula obrigatórios' });
  try {
    // verificar vagas
    const aula = await db.query('SELECT vagas_max FROM aulas_agenda WHERE id=$1 AND ativa=TRUE', [agenda_id]);
    if (!aula.rows.length) return res.status(404).json({ error: 'Aula não encontrada' });
    const confirmados = await db.query(
      "SELECT COUNT(*) FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=$2 AND status<>'cancelado'",
      [agenda_id, data_aula]
    );
    if (parseInt(confirmados.rows[0].count) >= aula.rows[0].vagas_max)
      return res.status(409).json({ error: 'Aula lotada' });
    const r = await db.query(`
      INSERT INTO aulas_reservas (agenda_id, user_id, data_aula)
      VALUES ($1,$2,$3)
      ON CONFLICT (agenda_id, user_id, data_aula) DO UPDATE SET status='reservado'
      RETURNING *
    `, [agenda_id, req.user.id, data_aula]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Cancelar reserva
app.delete('/aluno/reservar/:id', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    await db.query(
      "UPDATE aulas_reservas SET status='cancelado' WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// LEADERBOARD GLOBAL (por licença)
// ══════════════════════════════════════════════════════════════

// Ranking acumulado de pontos — todos os alunos da academia
app.get('/gestor/leaderboard', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const licId = req.user.license_id;
  try {
    const r = await db.query(`
      SELECT u.id, u.name, u.points, u.level, u.ftp,
             COUNT(ah.id) as total_aulas,
             COALESCE(SUM(ah.kcal),0) as total_kcal,
             COALESCE(SUM(ah.dur_seg),0) as total_seg,
             MAX(ah.data_aula) as ultima_aula
      FROM users u
      LEFT JOIN aula_historico ah ON ah.user_id = u.id
      WHERE u.license_id=$1 AND u.role='aluno' AND u.status='ativo'
      GROUP BY u.id, u.name, u.points, u.level, u.ftp
      ORDER BY u.points DESC, total_aulas DESC
      LIMIT 50
    `, [licId]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// RELATÓRIOS MENSAIS (gestor)
// ══════════════════════════════════════════════════════════════

// Relatório mensal: aulas por semana, top alunos, distribuição de zonas, totais
app.get('/gestor/relatorio', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const licId = req.user.license_id;
  const mes   = parseInt(req.query.mes  || new Date().getMonth() + 1);
  const ano   = parseInt(req.query.ano  || new Date().getFullYear());
  try {
    const [totais, porSemana, topAlunos, zonas, aulasMes] = await Promise.all([
      // Totais do mês
      db.query(`
        SELECT COUNT(ah.id) as total_aulas,
               COALESCE(SUM(ah.kcal),0) as total_kcal,
               COALESCE(SUM(ah.dur_seg),0) as total_seg,
               COUNT(DISTINCT ah.user_id) as alunos_ativos
        FROM aula_historico ah
        JOIN users u ON u.id=ah.user_id
        WHERE u.license_id=$1
          AND EXTRACT(MONTH FROM ah.data_aula)=$2
          AND EXTRACT(YEAR  FROM ah.data_aula)=$3
      `, [licId, mes, ano]),
      // Aulas por semana do mês
      db.query(`
        SELECT EXTRACT(WEEK FROM ah.data_aula) as semana,
               COUNT(*) as aulas,
               COALESCE(SUM(ah.kcal),0) as kcal
        FROM aula_historico ah
        JOIN users u ON u.id=ah.user_id
        WHERE u.license_id=$1
          AND EXTRACT(MONTH FROM ah.data_aula)=$2
          AND EXTRACT(YEAR  FROM ah.data_aula)=$3
        GROUP BY semana ORDER BY semana
      `, [licId, mes, ano]),
      // Top 10 alunos do mês
      db.query(`
        SELECT u.name, COUNT(ah.id) as aulas, COALESCE(SUM(ah.kcal),0) as kcal,
               ROUND(AVG(ah.avg_ftp)::numeric,1) as avg_ftp
        FROM aula_historico ah
        JOIN users u ON u.id=ah.user_id
        WHERE u.license_id=$1
          AND EXTRACT(MONTH FROM ah.data_aula)=$2
          AND EXTRACT(YEAR  FROM ah.data_aula)=$3
        GROUP BY u.id, u.name ORDER BY aulas DESC LIMIT 10
      `, [licId, mes, ano]),
      // Distribuição de zonas média do mês
      db.query(`
        SELECT
          ROUND(AVG((zona_pct->>'z1')::numeric),1) as z1,
          ROUND(AVG((zona_pct->>'z2')::numeric),1) as z2,
          ROUND(AVG((zona_pct->>'z3')::numeric),1) as z3,
          ROUND(AVG((zona_pct->>'z4')::numeric),1) as z4,
          ROUND(AVG((zona_pct->>'z5')::numeric),1) as z5,
          ROUND(AVG((zona_pct->>'z6')::numeric),1) as z6,
          ROUND(AVG((zona_pct->>'z7')::numeric),1) as z7
        FROM aula_historico ah
        JOIN users u ON u.id=ah.user_id
        WHERE u.license_id=$1
          AND EXTRACT(MONTH FROM ah.data_aula)=$2
          AND EXTRACT(YEAR  FROM ah.data_aula)=$3
          AND zona_pct IS NOT NULL
      `, [licId, mes, ano]),
      // Lista de aulas do mês
      db.query(`
        SELECT ah.nome, ah.data_aula, ah.kcal, ah.dur_seg, ah.avg_ftp, ah.avg_watts, u.name as aluno
        FROM aula_historico ah
        JOIN users u ON u.id=ah.user_id
        WHERE u.license_id=$1
          AND EXTRACT(MONTH FROM ah.data_aula)=$2
          AND EXTRACT(YEAR  FROM ah.data_aula)=$3
        ORDER BY ah.data_aula DESC LIMIT 100
      `, [licId, mes, ano]),
    ]);
    res.json({
      mes, ano,
      totais: totais.rows[0],
      por_semana: porSemana.rows,
      top_alunos: topAlunos.rows,
      zonas: zonas.rows[0] || {},
      aulas: aulasMes.rows,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Limpeza de salas inativas
setInterval(() => {
  for (const [codigo, sala] of Object.entries(salas)) {
    const profOk = sala.professor && sala.professor.readyState === WebSocket.OPEN;
    if (!profOk && sala.alunos.size === 0) { delete salas[codigo]; log(`Sala removida: ${codigo}`); }
  }
}, 30000);

// Limpeza de aulas expiradas
if (db) {
  setInterval(async () => {
    try {
      const r = await db.query('DELETE FROM shared_aulas WHERE expires_at < NOW()');
      if (r.rowCount > 0) log(`${r.rowCount} aulas expiradas removidas`);
    } catch(e) {}
  }, 60 * 60 * 1000); // a cada 1h
}

// ── Start ──────────────────────────────────────────────────────
server.listen(PORT, () => {
  log(`ProRider Server v2.0 rodando na porta ${PORT}`);
  log(`HTTP + WebSocket ativos`);
  log(`Banco: ${db ? 'PostgreSQL conectado' : 'sem banco (modo WebSocket only)'}`);
});
