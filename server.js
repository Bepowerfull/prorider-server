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
        ADD COLUMN IF NOT EXISTS max_bikes         INTEGER DEFAULT 0,
        -- Bikes atualmente disponíveis na sala (pode ser < max_bikes se alguma estiver fora de serviço).
        -- Ajustável pelo admin local / técnico, mas NUNCA pode superar max_bikes.
        -- Inicializado com max_bikes quando o onboarding é concluído.
        ADD COLUMN IF NOT EXISTS bikes_disponiveis INTEGER DEFAULT 0
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
    // Adiciona modo_inicio na grade de aulas
    // 'automatico'  = aula começa sozinha quando o cronômetro chega a zero
    // 'professor'   = cronômetro zera, mas aguarda o professor pressionar "Iniciar" no mini PC
    await db.query(`
      ALTER TABLE aulas_agenda
        ADD COLUMN IF NOT EXISTS modo_inicio TEXT DEFAULT 'professor'
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

    // ── Sessões ao vivo (ProRider Jim / QR login) ─────────────────
    // Uma sessão representa uma aula em andamento no mini PC da sala.
    // O mini PC gera um QR code com o token. O aluno escaneia e "entra"
    // na sessão com o app. Max conexões = bikes_disponiveis da licença.
    await db.query(`
      CREATE TABLE IF NOT EXISTS sessoes_ao_vivo (
        id          SERIAL PRIMARY KEY,
        license_id  TEXT NOT NULL,
        agenda_id   INTEGER REFERENCES aulas_agenda(id) ON DELETE SET NULL,
        token       TEXT UNIQUE NOT NULL,
        nome_aula   TEXT,
        professor   TEXT,
        max_conexoes INTEGER NOT NULL DEFAULT 1,
        -- Estados: aguardando | em_andamento | encerrada | bloqueada
        -- aguardando   = QR visível, aguardando início
        -- em_andamento = aula iniciada (professor deu start ou automático)
        -- encerrada    = aula finalizada
        -- bloqueada    = próxima aula não pode abrir pois a anterior ainda está em_andamento
        status        TEXT DEFAULT 'aguardando',
        inicio_programado TIMESTAMPTZ,  -- horário previsto na grade
        inicio_real   TIMESTAMPTZ,      -- quando realmente começou
        fim_real      TIMESTAMPTZ,      -- quando realmente terminou
        atrasada_seg  INTEGER DEFAULT 0, -- segundos de atraso acumulados
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        encerrada_at  TIMESTAMPTZ
      )
    `);
    // Garantir colunas novas em sessoes existentes
    await db.query(`
      ALTER TABLE sessoes_ao_vivo
        ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'aguardando',
        ADD COLUMN IF NOT EXISTS inicio_programado TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS inicio_real       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS fim_real          TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS atrasada_seg      INTEGER DEFAULT 0
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS sessao_conexoes (
        id          SERIAL PRIMARY KEY,
        sessao_id   INTEGER REFERENCES sessoes_ao_vivo(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bike_num    SMALLINT,                      -- número do spot/bike na sala
        connected_at TIMESTAMPTZ DEFAULT NOW(),
        last_update  TIMESTAMPTZ DEFAULT NOW(),
        -- Dados de telemetria enviados pelo app do aluno (via Bluetooth/ANT+ do celular)
        dados       JSONB DEFAULT '{}',            -- {watts,rpm,hr,calorias,velocidade}
        status      TEXT DEFAULT 'conectado',      -- conectado | desconectado | reservada | bt_anonimo
        fonte       TEXT DEFAULT 'qr',             -- qr | qr_bike | bluetooth | reserva
        UNIQUE(sessao_id, user_id)
      )
    `);
    // Adicionar colunas novas se não existirem (upgrade de schema)
    await db.query(`ALTER TABLE sessao_conexoes ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'qr'`);
    await db.query(`ALTER TABLE sessao_conexoes ADD COLUMN IF NOT EXISTS user_id_nullable INTEGER`);
    log('Migração sessoes_ao_vivo OK');
    // Onboarding token para licenses (sistema super_admin)
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS onboarding_token TEXT`);
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_bikes INTEGER DEFAULT 10`);
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS gestor_email TEXT`);
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS gestor_nome TEXT`);
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS fin_email TEXT`);
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS fin_nome TEXT`);
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS cidade TEXT`);
    await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS nome_fantasia TEXT`);
    log('Migração licenses onboarding OK');

  } catch(e) {
    log('Migração ERRO: ' + e.message);
  }
}
runMigrations();

// ══════════════════════════════════════════════════════════════
// ROTAS HTTP
// ══════════════════════════════════════════════════════════════

// ── Health check ──────────────────────────────────────────────
// Bootstrap único — cria super_admin + licença demo se ainda não existirem
app.post('/setup/bootstrap', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { secret } = req.body;
  if (secret !== 'prorider-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  try {
    // Verificar se já existe super_admin
    const existing = await db.query("SELECT id, email FROM users WHERE role='super_admin' LIMIT 1");
    if (existing.rows.length) {
      // Criar licença demo mesmo que super_admin já exista
      await db.query(
        "INSERT INTO licencas (codigo, nome, status, max_bikes) VALUES ($1,$2,'ativa',$3) ON CONFLICT (codigo) DO NOTHING",
        ['PRDR-DEMO-001', 'ProRider Demo', 15]
      );
      return res.json({ ok: true, msg: 'Super admin já existe', id: existing.rows[0].id, email: existing.rows[0].email, licenca: 'PRDR-DEMO-001' });
    }

    // Criar super_admin
    const hash = await bcrypt.hash('123456', 10);
    const u = await db.query(
      "INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,'super_admin') RETURNING id, email, role",
      ['marioelite@hotmail.com', 'Mario Elite', hash]
    );

    // Criar licença demo
    await db.query(
      "INSERT INTO licencas (codigo, nome, status, max_bikes) VALUES ($1,$2,'ativa',$3) ON CONFLICT (codigo) DO NOTHING",
      ['PRDR-DEMO-001', 'ProRider Demo', 15]
    );

    res.json({ ok: true, user: u.rows[0], licenca: 'PRDR-DEMO-001', max_bikes: 15 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Endpoint de teste: cria sessão ativa para PRDR-DEMO-001
app.post('/setup/sessao-teste', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { secret } = req.body;
  if (secret !== 'prorider-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  try {
    // Encerrar sessão anterior se existir
    await db.query(
      "UPDATE sessoes_ao_vivo SET status='encerrada', encerrada_at=NOW() WHERE license_id='PRDR-DEMO-001' AND status IN ('aguardando','em_andamento')"
    );
    const token = crypto.randomBytes(20).toString('hex');
    const r = await db.query(
      `INSERT INTO sessoes_ao_vivo (license_id, token, nome_aula, professor, max_conexoes, status)
       VALUES ('PRDR-DEMO-001', $1, 'Aula Teste', 'Mario', 15, 'em_andamento') RETURNING *`,
      [token]
    );
    res.json({ ok: true, sessao: r.rows[0], token, qr_payload: `prorider://sessao?token=${token}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/ping', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let dbOk = false;
  if (db) {
    try { const c = await db.query('SELECT 1'); dbOk = true; } catch(e) {}
  }
  res.json({
    status: 'ok',
    version: '2.3-debug',
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
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, license_id: user.license_id || undefined }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, license_id: user.license_id || null, points: user.points, level: user.level }, token });
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

// Listar licenças (une tabela licenses + licencas legado)
app.get('/admin/licenses', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  try {
    // Busca separada — cada tabela em try/catch independente
    let rowsNew = [], rowsLeg = [];
    try {
      const rNew = await db.query(`SELECT id, key, type, name, nome_fantasia, cidade, status, admin_email,
        gestor_email, gestor_nome, fin_email, fin_nome, COALESCE(max_bikes,0) AS max_bikes,
        created_at, expires_at, 'new' AS source FROM licenses ORDER BY created_at DESC`);
      rowsNew = rNew.rows;
    } catch(e1) { log('licenses query err: ' + e1.message); }
    try {
      const rLeg = await db.query(`SELECT id, codigo AS key, plano AS type, nome AS name,
        nome_fantasia, cidade, status, contato_email AS admin_email,
        financeiro_email AS gestor_email, financeiro_nome AS gestor_nome,
        NULL AS fin_email, NULL AS fin_nome, COALESCE(max_bikes,0) AS max_bikes,
        created_at, vencimento AS expires_at, 'legacy' AS source FROM licencas ORDER BY created_at DESC`);
      rowsLeg = rLeg.rows;
    } catch(e2) { log('licencas query err: ' + e2.message); }
    const rows = [...rowsNew, ...rowsLeg].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const r = { rows };
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
});

// Impersonar academia (super_admin → token 4h como gestor)
app.post('/admin/license/:id/impersonate', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const lic = await db.query('SELECT * FROM licenses WHERE id=$1', [req.params.id]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const l = lic.rows[0];
    const token = jwt.sign(
      { id: 0, email: req.user.email, name: req.user.name || req.user.email,
        role: 'gestor', license_id: l.id.toString(),
        impersonated_by: req.user.email },
      JWT_SECRET, { expiresIn: '4h' }
    );
    res.json({ token, academia: { id: l.id, name: l.nome_fantasia || l.name, type: l.type } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Atualizar status de licença (super_admin) — suporta tabela nova e legado
app.patch('/admin/license/:id/status', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { status, expires_at } = req.body;
  if (!status) return res.status(400).json({ error: 'status obrigatório' });
  // Tenta tabela nova (pode não existir)
  try {
    const rNew = await db.query(
      `UPDATE licenses SET status=$1${expires_at ? ', expires_at=$3' : ''}, updated_at=NOW() WHERE id=$2 RETURNING id,name,status`,
      expires_at ? [status, req.params.id, expires_at] : [status, req.params.id]
    );
    if (rNew.rows.length) return res.json({ ok: true, source: 'new', ...rNew.rows[0] });
  } catch(e1) { /* tabela não existe, continua */ }
  // Fallback: tabela legado
  try {
    const rLeg = await db.query(
      `UPDATE licencas SET status=$1${expires_at ? ', vencimento=$3' : ''}, updated_at=NOW() WHERE id=$2 RETURNING id,nome,status,codigo`,
      expires_at ? [status, req.params.id, expires_at] : [status, req.params.id]
    );
    if (rLeg.rows.length) return res.json({ ok: true, source: 'legacy', ...rLeg.rows[0] });
    return res.status(404).json({ error: 'Licença não encontrada' });
  } catch(e2) { return res.status(500).json({ error: e2.message }); }
});

// Criar nova licença
app.post('/admin/license/create', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { type, name, nome_fantasia, cidade, max_bikes, admin_email, expires_at,
          gestor_nome, gestor_email, fin_nome, fin_email } = req.body;
  if (!type || !name) return res.status(400).json({ error: 'type e name obrigatórios' });
  try {
    const suffix = crypto.randomBytes(6).toString('hex').toUpperCase();
    const key = `PRDR-${type.toUpperCase().substring(0,4)}-${suffix.substring(0,4)}-${suffix.substring(4,8)}-${suffix.substring(8,12)}`;
    const r = await db.query(
      `INSERT INTO licenses (key, type, name, nome_fantasia, cidade, max_bikes, admin_email, expires_at, gestor_nome, gestor_email, fin_nome, fin_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [key, type, name, nome_fantasia||null, cidade||null, max_bikes||10,
       admin_email||null, expires_at||null, gestor_nome||null, gestor_email||null, fin_nome||null, fin_email||null]
    );
    res.json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Gerar link de onboarding para uma license (super_admin)
app.post('/admin/license/:id/gerar-onboarding', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const token = crypto.randomBytes(16).toString('hex');
    const r = await db.query('UPDATE licenses SET onboarding_token=$1 WHERE id=$2 RETURNING id,name', [token, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const origin = req.headers.origin || 'https://bepowerfull.github.io/prorider';
    const link = `${origin}/onboard.html?token=${token}`;
    res.json({ token, link });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Consultar license pelo token (público)
app.get('/onboarding/lic/:token', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(
      'SELECT id,name,nome_fantasia,cidade,type,max_bikes,admin_email FROM licenses WHERE onboarding_token=$1',
      [req.params.token]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Link inválido ou expirado' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Submeter onboarding (público)
app.post('/onboarding/lic/:token', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { gestor_nome, gestor_email, gestor_senha, fin_nome, fin_email, fin_senha, nome_fantasia, cidade } = req.body;
  if (!gestor_email || !gestor_senha) return res.status(400).json({ error: 'E-mail e senha do gestor são obrigatórios' });
  try {
    const lic = await db.query('SELECT * FROM licenses WHERE onboarding_token=$1', [req.params.token]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Link inválido' });
    const l = lic.rows[0];
    if (nome_fantasia || cidade) {
      await db.query('UPDATE licenses SET nome_fantasia=COALESCE($1,nome_fantasia), cidade=COALESCE($2,cidade) WHERE id=$3',
        [nome_fantasia||null, cidade||null, l.id]);
    }
    const hashGestor = await bcrypt.hash(gestor_senha, 10);
    await db.query(`
      INSERT INTO users (email, name, password_hash, role, license_id)
      VALUES ($1,$2,$3,'gestor',$4)
      ON CONFLICT (email) DO UPDATE SET role='gestor', license_id=$4, password_hash=$3
    `, [gestor_email.toLowerCase(), gestor_nome||gestor_email, hashGestor, l.id.toString()]);
    if (fin_email && fin_senha) {
      const hashFin = await bcrypt.hash(fin_senha, 10);
      await db.query(`
        INSERT INTO users (email, name, password_hash, role, license_id)
        VALUES ($1,$2,$3,'financeiro',$4)
        ON CONFLICT (email) DO UPDATE SET role='financeiro', license_id=$4, password_hash=$3
      `, [fin_email.toLowerCase(), fin_nome||fin_email, hashFin, l.id.toString()]);
    }
    await db.query(`
      UPDATE licenses SET
        onboarding_token = NULL,
        status = 'active',
        gestor_email = $1,
        gestor_nome = $2,
        fin_email = $3,
        fin_nome = $4
      WHERE id = $5
    `, [gestor_email, gestor_nome||gestor_email, fin_email||null, fin_nome||null, l.id]);
    res.json({ ok: true, message: 'Cadastro concluído! Faça login com suas credenciais.' });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    res.status(500).json({ error: e.message });
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

  ws.on('message', async (raw) => {
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
        const { codigo, nome, bike, user_id } = msg;
        if (!codigo || !nome) return;
        const sala = salas[codigo];
        if (!sala) { ws.send(JSON.stringify({ tipo: 'erro', msg: 'Sala nao encontrada' })); return; }

        // ── Verificar limite max_conexoes (= max_bikes da licença) ──
        // O código da sala pode ser o token de uma sessao_ao_vivo no banco
        if (db) {
          try {
            const sessaoR = await db.query(
              "SELECT id, max_conexoes FROM sessoes_ao_vivo WHERE token=$1 AND status='ativa'",
              [codigo]
            );
            if (sessaoR.rows.length) {
              const { id: sessaoId, max_conexoes } = sessaoR.rows[0];
              const alunosConectados = [...sala.alunos.values()].filter(w => w.readyState === WebSocket.OPEN).length;
              if (alunosConectados >= max_conexoes) {
                ws.send(JSON.stringify({
                  tipo: 'erro',
                  msg: `Sala cheia — limite de ${max_conexoes} bikes atingido. Aguarde uma vaga.`
                }));
                return;
              }
            }
          } catch(dbErr) { /* não bloqueia se o banco falhar */ }
        }

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
    if (payload.role !== 'admin' && payload.role !== 'super_admin' && !payload.impersonated_by)
      return res.status(403).json({ error: 'Acesso negado' });
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

// Promover user por email via setup key (uso único para setup inicial)
app.post('/admin/setup-promote', async (req, res) => {
  if (req.headers['x-setup-key'] !== (process.env.SETUP_KEY || 'prorider_setup_2026'))
    return res.status(403).json({ error: 'Chave inválida' });
  const { email, role } = req.body;
  const allowed = ['professor', 'admin', 'super_admin', 'aluno', 'admin_licenca'];
  if (!email || !role || !allowed.includes(role)) return res.status(400).json({ error: 'email e role obrigatórios' });
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query('UPDATE users SET role=$1, updated_at=NOW() WHERE email=$2 RETURNING id, email, name, role', [role, email.toLowerCase()]);
    if (!r.rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
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
// DISPLAY TOKEN — autenticação do mini PC (sem senha do professor)
// ══════════════════════════════════════════════════════════════

// Ativação única: professor digita o código da licença → recebe display token permanente
app.post('/display/ativar', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ error: 'Código da licença obrigatório' });
  try {
    const r = await db.query(
      "SELECT * FROM licencas WHERE UPPER(codigo)=UPPER($1) AND status='ativa'",
      [codigo.trim()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada ou inativa' });
    const lic = r.rows[0];
    // Token sem expiração — role 'display', só leitura de grade/sessões
    const token = jwt.sign(
      { role: 'display', license_id: lic.codigo, nome_academia: lic.nome },
      JWT_SECRET
      // sem expiresIn → token permanente
    );
    res.json({ token, nome_academia: lic.nome, codigo: lic.codigo });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Middleware display: aceita role='display' OU role='gestor'/'admin' (para compatibilidade)
function displayAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (p.role !== 'display' && p.role !== 'gestor' && p.role !== 'admin')
      return res.status(403).json({ error: 'Acesso negado' });
    req.user = p;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// Grade do dia (leitura, para o mini PC)
app.get('/display/agenda', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const licId = req.user.license_id;
    const nowBR = new Date(new Date().toLocaleString('en-US', {timeZone:'America/Sao_Paulo'}));
    const diaN  = nowBR.getDay();
    const r = await db.query(
      `SELECT a.*, p.name AS professor_nome
       FROM aulas_agenda a
       LEFT JOIN users p ON p.id = a.professor_id
       WHERE a.license_id=$1 AND a.dia_semana=$2 AND a.ativa=true
       ORDER BY a.hora`,
      [licId, diaN]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Próxima aula + sessão (leitura, para o mini PC) — mesma lógica do /gestor/proxima-aula
app.get('/display/proxima-aula', displayAuth, async (req, res) => {
  // Reutiliza exatamente a lógica do gestor — só muda o middleware
  req.user.role = 'gestor'; // temporário para reusar o handler
  // Redireciona internamente chamando a mesma lógica via forward
  // Mais simples: duplicar só a query essencial
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const MINUTOS = 10;
  try {
    const licId = req.user.license_id;
    const diaN  = new Date().getDay();

    const sessaoAtiva = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND status='em_andamento' ORDER BY inicio_real DESC LIMIT 1",
      [licId]
    );
    const aulaEmAndamento = sessaoAtiva.rows[0] || null;

    const r = await db.query(`
      SELECT a.*, p.name AS professor_nome,
        EXTRACT(EPOCH FROM (
          (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
          + a.hora::interval
          - NOW() AT TIME ZONE 'America/Sao_Paulo'
        )) AS segundos_programados
      FROM aulas_agenda a
      LEFT JOIN users p ON p.id = a.professor_id
      WHERE a.license_id=$1 AND a.dia_semana=$2 AND a.ativa=true
        AND (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' + a.hora::interval)
            >= NOW() AT TIME ZONE 'America/Sao_Paulo' - INTERVAL '2 hours'
      ORDER BY a.hora
      LIMIT 2
    `, [licId, diaN]);

    if (!r.rows.length) return res.json({
      proxima_aula: null,
      sessao_em_andamento: aulaEmAndamento ? _sessaoPublica(aulaEmAndamento) : null
    });

    const aula = r.rows[0];
    const segsProgramados = Math.round(parseFloat(aula.segundos_programados));
    let segundos_ate_aula = segsProgramados;
    let bloqueada = false;
    let atrasada = false;
    let atrasada_seg = 0;

    if (aulaEmAndamento) {
      bloqueada = true;
      segundos_ate_aula = 600;
      atrasada = segsProgramados < 0;
      atrasada_seg = segsProgramados < 0 ? Math.abs(segsProgramados) : 0;
    }

    const dentroJanela = !bloqueada && segundos_ate_aula <= MINUTOS * 60;
    let sessao = null;
    if (dentroJanela) {
      const se = await db.query(
        "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND agenda_id=$2 AND status IN ('aguardando','em_andamento') ORDER BY created_at DESC LIMIT 1",
        [licId, aula.id]
      );
      sessao = se.rows[0] || null;
      if (!sessao) {
        const lic = await db.query('SELECT bikes_disponiveis, max_bikes FROM licencas WHERE codigo=$1', [licId]);
        const max_conexoes = lic.rows[0]?.bikes_disponiveis || lic.rows[0]?.max_bikes || aula.vagas_max || 1;
        const token = crypto.randomBytes(20).toString('hex');
        const inicioProg = new Date(Date.now() + segundos_ate_aula * 1000).toISOString();
        const ns = await db.query(
          `INSERT INTO sessoes_ao_vivo (license_id, agenda_id, token, nome_aula, professor, max_conexoes, inicio_programado, atrasada_seg)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [licId, aula.id, token, aula.nome, aula.professor_nome, max_conexoes, inicioProg, atrasada_seg]
        );
        sessao = ns.rows[0];
      }
    }

    res.json({
      proxima_aula: {
        ...aula, segundos_ate_aula, bloqueada, atrasada, atrasada_seg,
        mostrar_qr: dentroJanela && !bloqueada,
        iniciar_automatico: !bloqueada && segundos_ate_aula <= 0 && aula.modo_inicio === 'automatico',
      },
      sessao: sessao ? { ..._sessaoPublica(sessao), qr_payload_base: `prorider://sessao?token=${sessao.token}` } : null,
      sessao_em_andamento: aulaEmAndamento ? _sessaoPublica(aulaEmAndamento) : null,
    });
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
    // Ativar licença + inicializar bikes_disponiveis = max_bikes + invalidar token
    await db.query(`
      UPDATE licencas SET
        onboarding_token  = NULL,
        status            = 'ativa',
        bikes_disponiveis = max_bikes
      WHERE id = $1
    `, [l.id]);
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
// ══════════════════════════════════════════════════════════════
// PRÓXIMA AULA — ProRider Jim (mini PC faz polling a cada 60s)
// ══════════════════════════════════════════════════════════════
// Retorna a próxima aula no horário de hoje que ainda não começou.
// Se faltar ≤ MINUTOS_ANTECEDENCIA minutos, também cria a sessão ao vivo
// automaticamente (caso não exista ainda) para o mini PC já exibir o QR.
//
// O mini PC usa esta resposta para:
//   1. Calcular o countdown (segundos_ate_aula)
//   2. Exibir nome da aula, professor, vagas disponíveis
//   3. Mostrar o QR code quando segundos_ate_aula <= 600 (10 min)
//   4. Se modo_inicio='automatico', disparar início da aula ao chegar em 0
//   5. Se modo_inicio='professor', aguardar o professor pressionar Iniciar
//
// Parâmetro opcional: ?antecedencia=N  (default: 10, mínimo: 1, máximo: 60 minutos)
app.get('/gestor/proxima-aula', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const MINUTOS = Math.min(60, Math.max(1, parseInt(req.query.antecedencia) || 10));
  try {
    const licId = req.user.license_id;
    const diaN  = new Date().getDay(); // 0=Dom..6=Sab (servidor usa UTC, mini PC envia tz se precisar)

    // ── 1. Verificar se há sessão em_andamento (aula ainda rolando) ──
    const sessaoAtiva = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND status='em_andamento' ORDER BY inicio_real DESC LIMIT 1",
      [licId]
    );
    const aulaEmAndamento = sessaoAtiva.rows[0] || null;

    // ── 2. Buscar próxima aula na grade de hoje ──
    const r = await db.query(`
      SELECT a.*,
        EXTRACT(EPOCH FROM (
          (CURRENT_DATE + a.hora::time) AT TIME ZONE 'America/Sao_Paulo'
          - NOW() AT TIME ZONE 'America/Sao_Paulo'
        )) AS segundos_programados
      FROM aulas_agenda a
      WHERE a.license_id = $1
        AND a.dia_semana = $2
        AND a.ativa = TRUE
        AND (
          -- Inclui aula que já deveria ter começado há até 2h (pode estar atrasada)
          (CURRENT_DATE + a.hora::time) AT TIME ZONE 'America/Sao_Paulo'
          >= NOW() AT TIME ZONE 'America/Sao_Paulo' - INTERVAL '2 hours'
        )
      ORDER BY a.hora
      LIMIT 2  -- pegamos 2 para verificar se a que está bloqueada é a mesma que está em andamento
    `, [licId, diaN]);

    if (!r.rows.length) {
      return res.json({
        proxima_aula: null,
        sessao_em_andamento: aulaEmAndamento ? _sessaoPublica(aulaEmAndamento) : null
      });
    }

    // ── 3. Determinar qual é a próxima candidata ──
    // Se a aula em andamento é a MESMA que a primeira da lista → a próxima é a segunda
    let aula = r.rows[0];
    if (aulaEmAndamento && aulaEmAndamento.agenda_id === aula.id && r.rows.length > 1) {
      aula = r.rows[1];
    }

    const segsProgramados = Math.round(parseFloat(aula.segundos_programados));

    // ── 4. Calcular inicio_efetivo ──
    // Se há atraso (aula anterior ainda em andamento OU já passou o horário),
    // o início efetivo será: agora + 10min (a partir de quando a anterior encerrar)
    // O Jim.html usa isso para o countdown real
    let segundos_ate_aula = segsProgramados;
    let atrasada = false;
    let atrasada_seg = 0;
    let bloqueada = false;

    if (aulaEmAndamento) {
      // Aula anterior ainda rolando → esta está bloqueada
      bloqueada = true;
      // Estimativa: se encerrar agora, faltariam 10min
      segundos_ate_aula = 600; // placeholder; Jim mostra "aguardando encerramento"
      atrasada = segsProgramados < 0; // já passou o horário programado
      atrasada_seg = segsProgramados < 0 ? Math.abs(segsProgramados) : 0;
    } else if (segsProgramados < 0) {
      // Passou o horário mas não tem aula anterior em andamento
      // Pode ter sido pulada → só mostra se ainda estiver dentro da duração
      const duracaoSec = (aula.duracao_min || 50) * 60;
      if (Math.abs(segsProgramados) < duracaoSec) {
        atrasada = true;
        atrasada_seg = Math.abs(segsProgramados);
        segundos_ate_aula = segsProgramados; // negativo = já passou
      } else {
        // Aula completamente perdida → pula para próxima
        return res.json({
          proxima_aula: null,
          sessao_em_andamento: null,
          aula_perdida: { ...aula, motivo: 'Janela de início expirada' }
        });
      }
    }

    // ── 5. Contar reservas ──
    const reservas = await db.query(
      "SELECT COUNT(*) FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=CURRENT_DATE AND status<>'cancelado'",
      [aula.id]
    );
    const reservadas = parseInt(reservas.rows[0].count);
    const vagas_livres = Math.max(0, (aula.vagas_max || 0) - reservadas);

    // ── 6. Criar sessão de espera se dentro da janela e não bloqueada ──
    let sessao = null;
    const dentroJanela = !bloqueada && segundos_ate_aula <= MINUTOS * 60;
    if (dentroJanela) {
      // Verificar se já existe sessão aguardando para esta aula
      const sessaoExist = await db.query(
        "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND agenda_id=$2 AND status IN ('aguardando','em_andamento') ORDER BY created_at DESC LIMIT 1",
        [licId, aula.id]
      );
      if (sessaoExist.rows.length) {
        sessao = sessaoExist.rows[0];
        // Atualizar inicio_programado se ainda não estava setado
        if (!sessao.inicio_programado) {
          const ts = new Date(Date.now() + segundos_ate_aula * 1000).toISOString();
          await db.query('UPDATE sessoes_ao_vivo SET inicio_programado=$1 WHERE id=$2', [ts, sessao.id]);
        }
      } else {
        const lic = await db.query('SELECT bikes_disponiveis, max_bikes FROM licencas WHERE codigo=$1', [licId]);
        const max_conexoes = lic.rows[0]?.bikes_disponiveis || lic.rows[0]?.max_bikes || aula.vagas_max || 1;
        const token = require('crypto').randomBytes(20).toString('hex');
        const inicioProg = new Date(Date.now() + segundos_ate_aula * 1000).toISOString();
        const ns = await db.query(`
          INSERT INTO sessoes_ao_vivo
            (license_id, agenda_id, token, nome_aula, professor, max_conexoes, inicio_programado, atrasada_seg)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [licId, aula.id, token, aula.nome, aula.professor_nome, max_conexoes, inicioProg, atrasada_seg]);
        sessao = ns.rows[0];
        log(`[AutoSessão] "${aula.nome}" — ${bloqueada?'BLOQUEADA':atrasada?'ATRASADA':'OK'} — ${segundos_ate_aula}s`);
      }
    }

    // ── 7. Contar alunos já conectados na sessão (para o QR screen) ──
    let conexoes_count = 0;
    if (sessao) {
      const cc = await db.query(
        "SELECT COUNT(*) FROM sessao_conexoes WHERE sessao_id=$1 AND status='conectado'",
        [sessao.id]
      );
      conexoes_count = parseInt(cc.rows[0].count);
    }

    res.json({
      proxima_aula: {
        ...aula,
        segundos_ate_aula,
        segundos_programados, // horário original da grade
        reservadas,
        vagas_livres,
        atrasada,
        atrasada_seg,                                    // quantos segundos de atraso
        bloqueada,                                       // true = aula anterior ainda não encerrou
        mostrar_qr: dentroJanela && !bloqueada,
        iniciar_automatico: !bloqueada && segundos_ate_aula <= 0 && aula.modo_inicio === 'automatico',
      },
      sessao: sessao ? {
        ..._sessaoPublica(sessao),
        conexoes_count,
        qr_payload_base: `prorider://sessao?token=${sessao.token}`,
      } : null,
      sessao_em_andamento: aulaEmAndamento ? _sessaoPublica(aulaEmAndamento) : null,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

function _sessaoPublica(s) {
  return {
    id: s.id, token: s.token, nome_aula: s.nome_aula, professor: s.professor,
    max_conexoes: s.max_conexoes, status: s.status,
    inicio_programado: s.inicio_programado, inicio_real: s.inicio_real,
    fim_real: s.fim_real, atrasada_seg: s.atrasada_seg || 0,
  };
}

// CONFIG — GESTOR (ler configurações da licença)
// ══════════════════════════════════════════════════════════════

// Retorna configurações da licença (max_bikes é somente-leitura — definido apenas pelo admin Mario)
app.get('/gestor/config', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const lid = req.user.license_id;
    let row = null;

    // Tenta tabela licencas (sistema legado — license_id = codigo texto)
    const rLeg = await db.query(
      'SELECT max_bikes, bikes_disponiveis, max_alunos, plano, nome_fantasia, cidade FROM licencas WHERE codigo=$1',
      [lid]
    );
    if (rLeg.rows.length) { row = rLeg.rows[0]; }

    // Tenta tabela licenses (sistema novo — license_id = id numérico)
    if (!row && !isNaN(parseInt(lid))) {
      const rNew = await db.query(
        'SELECT COALESCE(max_bikes,10) AS max_bikes, COALESCE(max_bikes,10) AS bikes_disponiveis, 50 AS max_alunos, type AS plano, nome_fantasia, cidade, key AS codigo FROM licenses WHERE id=$1',
        [parseInt(lid)]
      );
      if (rNew.rows.length) { row = rNew.rows[0]; }
    }

    if (!row) return res.status(404).json({ error: 'Licença não encontrada' });
    res.json(row);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Atualiza bikes_disponiveis (admin local / técnico da sala)
// Regras:
//   - Só gestor da própria academia pode chamar
//   - Valor mínimo: 1
//   - Valor máximo: max_bikes (teto definido por Mario — nunca pode ultrapassar)
app.patch('/gestor/config/bikes', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const novas = parseInt(req.body.bikes_disponiveis);
  if (isNaN(novas) || novas < 1)
    return res.status(400).json({ error: 'Valor inválido. Mínimo: 1.' });
  try {
    const lic = await db.query('SELECT max_bikes FROM licencas WHERE codigo=$1', [req.user.license_id]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const maxPermitido = lic.rows[0].max_bikes || 0;
    if (maxPermitido > 0 && novas > maxPermitido)
      return res.status(400).json({
        error: `Limite da licença: ${maxPermitido} bikes. Você não pode adicionar mais spots do que o contratado.`
      });
    await db.query(
      'UPDATE licencas SET bikes_disponiveis=$1 WHERE codigo=$2',
      [novas, req.user.license_id]
    );
    res.json({ ok: true, bikes_disponiveis: novas, max_bikes: maxPermitido });
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
  const { nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala, modo_inicio } = req.body;
  if (!nome || dia_semana === undefined || !hora)
    return res.status(400).json({ error: 'nome, dia_semana e hora obrigatórios' });
  try {
    // buscar cidade e capacidade operacional da licença
    const lic = await db.query('SELECT cidade, max_bikes, bikes_disponiveis FROM licencas WHERE codigo=$1', [req.user.license_id]);
    const cidade            = lic.rows[0]?.cidade            || null;
    const max_bikes         = lic.rows[0]?.max_bikes         || 0;
    const bikes_disponiveis = lic.rows[0]?.bikes_disponiveis || max_bikes || 0;
    const teto = bikes_disponiveis > 0 ? bikes_disponiveis : max_bikes;
    const vagasSolicitadas = parseInt(vagas_max) || 20;
    if (teto > 0 && vagasSolicitadas > teto)
      return res.status(400).json({
        error: `A sala tem ${teto} bikes disponíveis no momento. Você não pode configurar mais vagas do que isso.`
      });
    const modoValido = ['automatico','professor'].includes(modo_inicio) ? modo_inicio : 'professor';
    const r = await db.query(`
      INSERT INTO aulas_agenda (license_id, nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala, cidade, modo_inicio)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [req.user.license_id, nome, professor_nome||null, dia_semana, hora, duracao_min||50, vagasSolicitadas, sala||null, cidade, modoValido]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Editar aula
app.put('/gestor/agenda/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala, ativa, modo_inicio } = req.body;
  try {
    // Validar vagas contra bikes disponíveis (teto operacional)
    const lic = await db.query('SELECT max_bikes, bikes_disponiveis FROM licencas WHERE codigo=$1', [req.user.license_id]);
    const max_bikes         = lic.rows[0]?.max_bikes         || 0;
    const bikes_disponiveis = lic.rows[0]?.bikes_disponiveis || max_bikes || 0;
    const teto = bikes_disponiveis > 0 ? bikes_disponiveis : max_bikes;
    const vagasSolicitadas = parseInt(vagas_max) || 20;
    if (teto > 0 && vagasSolicitadas > teto)
      return res.status(400).json({
        error: `A sala tem ${teto} bikes disponíveis no momento. Você não pode configurar mais vagas do que isso.`
      });
    const modoValido = ['automatico','professor'].includes(modo_inicio) ? modo_inicio : 'professor';
    const r = await db.query(`
      UPDATE aulas_agenda SET
        nome=$1, professor_nome=$2, dia_semana=$3, hora=$4,
        duracao_min=$5, vagas_max=$6, sala=$7, ativa=$8, modo_inicio=$9
      WHERE id=$10 AND license_id=$11 RETURNING *
    `, [nome, professor_nome, dia_semana, hora, duracao_min, vagasSolicitadas, sala, ativa !== false, modoValido, req.params.id, req.user.license_id]);
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
// SESSÕES AO VIVO — ProRider Jim (mini PC / QR login)
// ══════════════════════════════════════════════════════════════
// Fluxo:
//   1. Mini PC chama POST /gestor/sessao → recebe token (= conteúdo do QR)
//   2. Aluno abre app, escaneia QR → app chama POST /sessao/entrar
//   3. Aluno envia telemetria periodicamente → PATCH /sessao/dados
//   4. Mini PC faz polling em GET /gestor/sessao/ativa → exibe na tela
//   5. Fim da aula → DELETE /gestor/sessao/:id

// ── Gestor: criar sessão (ProRider Jim inicia a aula) ──────────
app.post('/gestor/sessao', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { agenda_id, nome_aula, professor } = req.body;
  try {
    // Encerrar sessão ativa anterior desta academia (se houver)
    await db.query(
      "UPDATE sessoes_ao_vivo SET status='encerrada', encerrada_at=NOW() WHERE license_id=$1 AND status='ativa'",
      [req.user.license_id]
    );
    // Buscar bikes disponíveis (teto de conexões)
    const lic = await db.query(
      'SELECT bikes_disponiveis, max_bikes, nome_fantasia FROM licencas WHERE codigo=$1',
      [req.user.license_id]
    );
    const licRow = lic.rows[0] || {};
    const max_conexoes = licRow.bikes_disponiveis || licRow.max_bikes || 1;

    const token = crypto.randomBytes(20).toString('hex');
    const r = await db.query(`
      INSERT INTO sessoes_ao_vivo (license_id, agenda_id, token, nome_aula, professor, max_conexoes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [req.user.license_id, agenda_id||null, token,
        nome_aula || 'Aula ao vivo', professor || null, max_conexoes]);

    res.json({
      sessao: r.rows[0],
      token,
      max_conexoes,
      // QR deve codificar este token — o app do aluno lê e chama /sessao/entrar
      qr_payload: `prorider://sessao?token=${token}`,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Gestor: ver sessão ativa + conexões (polling do mini PC) ───
app.get('/gestor/sessao/ativa', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const s = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND status='ativa' ORDER BY created_at DESC LIMIT 1",
      [req.user.license_id]
    );
    if (!s.rows.length) return res.json({ sessao: null, conexoes: [] });
    const sessao = s.rows[0];
    const c = await db.query(`
      SELECT sc.*, u.name, u.email,
             EXTRACT(EPOCH FROM (NOW() - sc.last_update)) AS segundos_sem_update
      FROM sessao_conexoes sc
      JOIN users u ON u.id = sc.user_id
      WHERE sc.sessao_id=$1 AND sc.status='conectado'
      ORDER BY sc.bike_num NULLS LAST, sc.connected_at
    `, [sessao.id]);
    res.json({ sessao, conexoes: c.rows, total: c.rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Gestor: iniciar aula (professor aperta Start no mini PC) ───
app.post('/gestor/sessao/:id/iniciar', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    // Verifica se há outra sessão em_andamento (conflito)
    const conflito = await db.query(
      "SELECT id, nome_aula FROM sessoes_ao_vivo WHERE license_id=$1 AND status='em_andamento' AND id<>$2",
      [req.user.license_id, req.params.id]
    );
    if (conflito.rows.length) {
      return res.status(409).json({
        error: `Não é possível iniciar: a aula "${conflito.rows[0].nome_aula}" ainda está em andamento. Encerre-a primeiro.`,
        conflito_id: conflito.rows[0].id
      });
    }
    const r = await db.query(
      `UPDATE sessoes_ao_vivo SET status='em_andamento', inicio_real=NOW(), encerrada_at=NULL
       WHERE id=$1 AND license_id=$2 RETURNING *`,
      [req.params.id, req.user.license_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json({ ok: true, sessao: _sessaoPublica(r.rows[0]) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Gestor: encerrar aula ───────────────────────────────────────
// Registra fim_real, calcula atraso acumulado, libera para próxima aula
app.post('/gestor/sessao/:id/encerrar', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const s = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE id=$1 AND license_id=$2",
      [req.params.id, req.user.license_id]
    );
    if (!s.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    const sess = s.rows[0];

    // Calcular atraso: quanto tempo passou além do esperado
    let atrasada_seg = sess.atrasada_seg || 0;
    if (sess.inicio_programado) {
      const fimPrevisto = new Date(new Date(sess.inicio_programado).getTime() + (sess.duracao_min || 50) * 60000);
      const atrasoExtra = Math.max(0, Math.round((Date.now() - fimPrevisto.getTime()) / 1000));
      atrasada_seg = Math.max(atrasada_seg, atrasoExtra);
    }

    await db.query(
      `UPDATE sessoes_ao_vivo SET status='encerrada', fim_real=NOW(), encerrada_at=NOW(), atrasada_seg=$1
       WHERE id=$2`,
      [atrasada_seg, req.params.id]
    );

    // Desconectar todos os alunos desta sessão
    await db.query(
      "UPDATE sessao_conexoes SET status='desconectado' WHERE sessao_id=$1",
      [req.params.id]
    );

    // Notificar alunos via WebSocket que a aula encerrou
    const salaCode = sess.token;
    if (salas[salaCode]) {
      broadcastAlunos(salaCode, {
        tipo: 'aula_encerrada',
        nome_aula: sess.nome_aula,
        professor: sess.professor,
      });
    }

    log(`[Sessão] Encerrada: "${sess.nome_aula}" — atraso: ${atrasada_seg}s`);
    res.json({ ok: true, atrasada_seg, mensagem: atrasada_seg > 60
      ? `Aula encerrada com ${Math.round(atrasada_seg/60)} minuto(s) de atraso. Próxima aula inicia em 10 min.`
      : 'Aula encerrada no prazo.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Gestor: manter DELETE para compatibilidade (redireciona para encerrar) ──
app.delete('/gestor/sessao/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    await db.query(
      "UPDATE sessoes_ao_vivo SET status='encerrada', fim_real=NOW(), encerrada_at=NOW() WHERE id=$1 AND license_id=$2",
      [req.params.id, req.user.license_id]
    );
    await db.query("UPDATE sessao_conexoes SET status='desconectado' WHERE sessao_id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Gestor: reset de conexões (joystick do professor, 2 confirmações) ────
// Remove TODOS os alunos conectados da sessão atual.
// Usado quando pessoas erradas entraram ou há necessidade de limpar para próxima aula.
// O Jim.html pede 2 confirmações antes de chamar este endpoint.
app.post('/gestor/sessao/:id/reset-conexoes', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { confirmado } = req.body;
  if (!confirmado) return res.status(400).json({ error: 'Confirmação obrigatória. Envie { confirmado: true }.' });
  try {
    const count = await db.query(
      "SELECT COUNT(*) FROM sessao_conexoes WHERE sessao_id=$1 AND status='conectado'",
      [req.params.id]
    );
    const total = parseInt(count.rows[0].count);
    await db.query(
      "UPDATE sessao_conexoes SET status='desconectado' WHERE sessao_id=$1",
      [req.params.id]
    );
    log(`[Reset] ${total} aluno(s) desconectado(s) da sessão ${req.params.id}`);
    res.json({ ok: true, desconectados: total, mensagem: `${total} aluno(s) removido(s). QR continua ativo para novas entradas.` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Aluno: entrar na sessão via QR ─────────────────────────────
// O app do aluno chama este endpoint após escanear o QR code
app.post('/sessao/entrar', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { token, bike_num: bikeEscolhida } = req.body;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });
  try {
    const s = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE token=$1 AND status IN ('aguardando','em_andamento')",
      [token]
    );
    if (!s.rows.length) return res.status(404).json({ error: 'Sessão não encontrada ou já encerrada.' });
    const sessao = s.rows[0];

    // Verificar se já está conectado nesta sessão
    const jaConectado = await db.query(
      "SELECT id FROM sessao_conexoes WHERE sessao_id=$1 AND user_id=$2",
      [sessao.id, req.user.id]
    );
    if (jaConectado.rows.length) {
      // Reconectar (atualiza status)
      await db.query(
        "UPDATE sessao_conexoes SET status='conectado', last_update=NOW() WHERE sessao_id=$1 AND user_id=$2",
        [sessao.id, req.user.id]
      );
      return res.json({ ok: true, reconectado: true, sessao_id: sessao.id, nome_aula: sessao.nome_aula });
    }

    // Verificar limite de conexões (= max_bikes da licença)
    const contagem = await db.query(
      "SELECT COUNT(*) FROM sessao_conexoes WHERE sessao_id=$1 AND status='conectado'",
      [sessao.id]
    );
    const total = parseInt(contagem.rows[0].count);
    if (total >= sessao.max_conexoes) {
      return res.status(429).json({
        error: `A sala está cheia (${sessao.max_conexoes} bikes). Aguarde uma vaga ou entre em contato com o professor.`
      });
    }

    // Atribuir número de bike — usa a escolhida pelo aluno, ou próxima disponível
    const bikes_usadas = await db.query(
      "SELECT bike_num FROM sessao_conexoes WHERE sessao_id=$1 AND status='conectado' ORDER BY bike_num",
      [sessao.id]
    );
    const usadas = new Set(bikes_usadas.rows.map(r => r.bike_num));
    let bike_num = null;
    const escolhida = bikeEscolhida ? parseInt(bikeEscolhida) : null;
    if (escolhida && escolhida >= 1 && escolhida <= sessao.max_conexoes && !usadas.has(escolhida)) {
      bike_num = escolhida; // aluno escolheu e está livre
    } else {
      for (let i = 1; i <= sessao.max_conexoes; i++) {
        if (!usadas.has(i)) { bike_num = i; break; }
      }
    }

    await db.query(
      "INSERT INTO sessao_conexoes (sessao_id, user_id, bike_num) VALUES ($1,$2,$3)",
      [sessao.id, req.user.id, bike_num]
    );

    res.json({ ok: true, sessao_id: sessao.id, bike_num, nome_aula: sessao.nome_aula, max_conexoes: sessao.max_conexoes });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Mini PC: registrar bike Bluetooth anônima como ocupada ─────
// Chamado pelo mini PC quando detecta conexão BT sem login de aluno
app.post('/sessao/bt-anonimo', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  // Auth via display token
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  let licId;
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (p.role !== 'display' && p.role !== 'gestor' && p.role !== 'admin')
      return res.status(403).json({ error: 'Acesso negado' });
    licId = p.license_id;
  } catch(e) { return res.status(401).json({ error: 'Token inválido' }); }

  const { bike_num, dados } = req.body;
  if (!bike_num) return res.status(400).json({ error: 'bike_num obrigatório' });
  try {
    const sessaoAtiva = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND status IN ('aguardando','em_andamento') ORDER BY created_at DESC LIMIT 1",
      [licId]
    );
    const sessao = sessaoAtiva.rows[0];
    if (!sessao) return res.status(404).json({ error: 'Nenhuma sessão ativa' });

    // Verificar se já existe entrada para esta bike
    const existe = await db.query(
      "SELECT id, user_id, status FROM sessao_conexoes WHERE sessao_id=$1 AND bike_num=$2 AND status IN ('conectado','bt_anonimo','reservada')",
      [sessao.id, parseInt(bike_num)]
    );

    if (existe.rows.length) {
      const e = existe.rows[0];
      if (e.user_id) {
        // Aluno logado já está na bike — só atualizar dados
        await db.query(
          "UPDATE sessao_conexoes SET dados=$1, last_update=NOW() WHERE id=$2",
          [JSON.stringify(dados || {}), e.id]
        );
        return res.json({ ok: true, bike_num, com_aluno: true });
      }
      // Já é bt_anonimo — atualizar dados
      await db.query(
        "UPDATE sessao_conexoes SET dados=$1, last_update=NOW() WHERE id=$2",
        [JSON.stringify(dados || {}), e.id]
      );
      return res.json({ ok: true, bike_num, anonimo: true });
    }

    // Criar entrada anônima (user_id NULL)
    await db.query(
      "INSERT INTO sessao_conexoes (sessao_id, bike_num, status, fonte, dados) VALUES ($1,$2,'bt_anonimo','bluetooth',$3)",
      [sessao.id, parseInt(bike_num), JSON.stringify(dados || {watts:0,rpm:0,ftp_padrao:150})]
    );
    res.json({ ok: true, bike_num, anonimo: true, ftp_padrao: 150 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Aluno: enviar telemetria da bike (dados ANT+/Bluetooth) ────
app.patch('/sessao/dados', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  // dados: { watts, rpm, hr (bpm), calorias, velocidade, distancia }
  const { sessao_id, dados } = req.body;
  if (!sessao_id) return res.status(400).json({ error: 'sessao_id obrigatório' });
  try {
    await db.query(`
      UPDATE sessao_conexoes
      SET dados=$1, last_update=NOW(), status='conectado'
      WHERE sessao_id=$2 AND user_id=$3
    `, [JSON.stringify(dados || {}), sessao_id, req.user.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Aluno: sair da sessão ──────────────────────────────────────
app.post('/sessao/sair', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { sessao_id } = req.body;
  try {
    await db.query(
      "UPDATE sessao_conexoes SET status='desconectado' WHERE sessao_id=$1 AND user_id=$2",
      [sessao_id, req.user.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Aluno: ver sessão em que está conectado ────────────────────
app.get('/sessao/minha', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT sc.*, s.nome_aula, s.professor, s.token, s.max_conexoes, s.status as sessao_status
      FROM sessao_conexoes sc
      JOIN sessoes_ao_vivo s ON s.id = sc.sessao_id
      WHERE sc.user_id=$1 AND sc.status='conectado' AND s.status IN ('aguardando','em_andamento')
      ORDER BY sc.connected_at DESC LIMIT 1
    `, [req.user.id]);
    if (!r.rows.length) return res.json({ sessao: null });
    res.json({ sessao: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// SESSÃO PÚBLICA — status, reservas e entrada por bike
// ══════════════════════════════════════════════════════════════

// GET /sessao/status?lic=GYM-XYZ
// Público (sem login) — aluno escaneia QR da porta e vê o estado da sala
// Info básica da sessão pelo token (sem auth — usado pelo app para mostrar modal de bike)
app.get('/sessao/info', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatório' });
  try {
    const s = await db.query(
      "SELECT id, nome_aula, professor, max_conexoes, status FROM sessoes_ao_vivo WHERE token=$1 AND status IN ('aguardando','em_andamento')",
      [token]
    );
    if (!s.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    const sessao = s.rows[0];
    const bikes_usadas = await db.query(
      "SELECT bike_num FROM sessao_conexoes WHERE sessao_id=$1 AND status='conectado' ORDER BY bike_num",
      [sessao.id]
    );
    const ocupadas = bikes_usadas.rows.map(r => r.bike_num).filter(Boolean);
    res.json({ nome_aula: sessao.nome_aula, professor: sessao.professor, max_conexoes: sessao.max_conexoes, bikes_ocupadas: ocupadas });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/sessao/status', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { lic } = req.query;
  if (!lic) return res.status(400).json({ error: 'Parâmetro lic obrigatório' });
  try {
    const licRow = await db.query(
      "SELECT codigo, nome, bikes_disponiveis, max_bikes FROM licencas WHERE UPPER(codigo)=UPPER($1) AND status='ativa'",
      [lic.trim()]
    );
    if (!licRow.rows.length) return res.status(404).json({ error: 'Academia não encontrada' });
    const academia = licRow.rows[0];
    const maxBikes = academia.bikes_disponiveis || academia.max_bikes || 20;

    // Sessão ativa em andamento
    const sessaoAtiva = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND status IN ('aguardando','em_andamento') ORDER BY created_at DESC LIMIT 1",
      [academia.codigo]
    );
    const sessao = sessaoAtiva.rows[0] || null;

    // Bikes ocupadas (conectadas + bt_anonimo + reservadas)
    let bikesOcupadas = [];
    let bikesLivres = [];
    let totalConectados = 0;
    if (sessao) {
      const conex = await db.query(
        "SELECT bike_num, status, fonte FROM sessao_conexoes WHERE sessao_id=$1 AND status IN ('conectado','reservada','bt_anonimo')",
        [sessao.id]
      );
      const ocupadas = new Set(conex.rows.map(r => r.bike_num).filter(Boolean));
      totalConectados = conex.rows.filter(r => r.status === 'conectado' || r.status === 'bt_anonimo').length;
      for (let i = 1; i <= maxBikes; i++) {
        if (ocupadas.has(i)) bikesOcupadas.push(i);
        else bikesLivres.push(i);
      }
    } else {
      bikesLivres = Array.from({length: maxBikes}, (_, i) => i + 1);
    }

    // Próxima aula agendada (mesmo que não haja sessão ativa)
    const diaN = new Date().getDay();
    const proxAula = await db.query(`
      SELECT a.*, p.name AS professor_nome,
        EXTRACT(EPOCH FROM (
          (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') + a.hora::interval
          - NOW() AT TIME ZONE 'America/Sao_Paulo'
        )) AS segundos_ate_aula
      FROM aulas_agenda a
      LEFT JOIN users p ON p.id = a.professor_id
      WHERE a.license_id=$1 AND a.dia_semana=$2 AND a.ativa=true
        AND (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' + a.hora::interval)
            > NOW() AT TIME ZONE 'America/Sao_Paulo'
      ORDER BY a.hora LIMIT 1
    `, [academia.codigo, diaN]);

    res.json({
      academia: { nome: academia.nome, codigo: academia.codigo },
      sessao_ativa: sessao ? {
        id: sessao.id,
        nome_aula: sessao.nome_aula,
        professor: sessao.professor,
        status: sessao.status,
        max_conexoes: sessao.max_conexoes,
        conectados: totalConectados,
        vagas_livres: bikesLivres.length,
        bikes_livres: bikesLivres,
        bikes_ocupadas: bikesOcupadas,
        token: sessao.token,   // para o aluno entrar via /sessao/entrar
      } : null,
      proxima_aula: proxAula.rows[0] ? {
        nome: proxAula.rows[0].nome,
        professor_nome: proxAula.rows[0].professor_nome,
        hora: proxAula.rows[0].hora,
        duracao_min: proxAula.rows[0].duracao_min,
        segundos_ate_aula: Math.round(parseFloat(proxAula.rows[0].segundos_ate_aula)),
        vagas_total: proxAula.rows[0].vagas_max,
      } : null,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /sessao/reservar
// Aluno logado reserva vaga na próxima aula
app.post('/sessao/reservar', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { lic, agenda_id } = req.body;
  if (!lic) return res.status(400).json({ error: 'lic obrigatório' });
  try {
    const licRow = await db.query(
      "SELECT codigo, bikes_disponiveis, max_bikes FROM licencas WHERE UPPER(codigo)=UPPER($1) AND status='ativa'",
      [lic.trim()]
    );
    if (!licRow.rows.length) return res.status(404).json({ error: 'Academia não encontrada' });
    const academia = licRow.rows[0];
    const maxBikes = academia.bikes_disponiveis || academia.max_bikes || 20;

    // Buscar ou criar sessão para a próxima aula
    let sessao = null;
    if (agenda_id) {
      const se = await db.query(
        "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND agenda_id=$2 AND status IN ('aguardando','em_andamento') ORDER BY created_at DESC LIMIT 1",
        [academia.codigo, agenda_id]
      );
      sessao = se.rows[0] || null;
      if (!sessao) {
        // Criar sessão antecipada para receber reservas
        const aula = await db.query('SELECT * FROM aulas_agenda WHERE id=$1', [agenda_id]);
        if (!aula.rows.length) return res.status(404).json({ error: 'Aula não encontrada' });
        const a = aula.rows[0];
        const token = crypto.randomBytes(20).toString('hex');
        const ns = await db.query(
          `INSERT INTO sessoes_ao_vivo (license_id, agenda_id, token, nome_aula, professor, max_conexoes)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [academia.codigo, agenda_id, token, a.nome, a.professor_nome||'', maxBikes]
        );
        sessao = ns.rows[0];
      }
    } else {
      return res.status(400).json({ error: 'agenda_id obrigatório para reservar' });
    }

    // Verificar se já reservou
    const jaReservou = await db.query(
      "SELECT id, bike_num FROM sessao_conexoes WHERE sessao_id=$1 AND user_id=$2",
      [sessao.id, req.user.id]
    );
    if (jaReservou.rows.length) {
      return res.json({ ok: true, ja_reservado: true, bike_num: jaReservou.rows[0].bike_num, sessao_id: sessao.id });
    }

    // Verificar vagas e atribuir bike
    const conex = await db.query(
      "SELECT bike_num FROM sessao_conexoes WHERE sessao_id=$1 AND status IN ('conectado','reservada','bt_anonimo') ORDER BY bike_num",
      [sessao.id]
    );
    if (conex.rows.length >= sessao.max_conexoes) {
      return res.status(429).json({ error: 'Sala lotada — sem vagas disponíveis.' });
    }
    const usadas = new Set(conex.rows.map(r => r.bike_num).filter(Boolean));
    let bike_num = null;
    for (let i = 1; i <= sessao.max_conexoes; i++) {
      if (!usadas.has(i)) { bike_num = i; break; }
    }

    await db.query(
      "INSERT INTO sessao_conexoes (sessao_id, user_id, bike_num, status, fonte) VALUES ($1,$2,$3,'reservada','reserva')",
      [sessao.id, req.user.id, bike_num]
    );

    res.json({ ok: true, bike_num, sessao_id: sessao.id, nome_aula: sessao.nome_aula });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Notifica via WebSocket que uma bike foi identificada (fire & forget)
async function notificarBikeId(sessaoToken, bikeNum, userId) {
  if (!salas[sessaoToken]) return;
  try {
    const u = await db.query('SELECT name, ftp, foto_url FROM users WHERE id=$1', [userId]);
    if (!u.rows.length) return;
    const { name, ftp, foto_url } = u.rows[0];
    broadcast(sessaoToken, { tipo: 'bike_identificada', bike_num: bikeNum, user: { nome: name, ftp: ftp || 150, foto: foto_url || null } });
  } catch(e) { /* non-critical */ }
}

// POST /sessao/entrar-bike
// Aluno escaneia QR fixo da bike (prorider://bike?n=7&lic=GYM-XYZ)
// Sistema já sabe qual bike; entra na sessão ativa automaticamente
app.post('/sessao/entrar-bike', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { lic, bike_num } = req.body;
  if (!lic || !bike_num) return res.status(400).json({ error: 'lic e bike_num obrigatórios' });
  try {
    const licRow = await db.query(
      "SELECT codigo FROM licencas WHERE UPPER(codigo)=UPPER($1) AND status='ativa'",
      [lic.trim()]
    );
    if (!licRow.rows.length) return res.status(404).json({ error: 'Academia não encontrada' });
    const licId = licRow.rows[0].codigo;

    // Buscar sessão ativa
    const sessaoAtiva = await db.query(
      "SELECT * FROM sessoes_ao_vivo WHERE license_id=$1 AND status IN ('aguardando','em_andamento') ORDER BY created_at DESC LIMIT 1",
      [licId]
    );
    const sessao = sessaoAtiva.rows[0] || null;

    if (!sessao) {
      // Sem sessão ativa — verificar próxima aula para reservar
      return res.status(202).json({
        sem_sessao: true,
        mensagem: 'Nenhuma aula ativa no momento. Você pode reservar vaga para a próxima aula.',
      });
    }

    // Verificar se a bike está disponível
    const bikeOcupada = await db.query(
      "SELECT id, user_id, status, fonte FROM sessao_conexoes WHERE sessao_id=$1 AND bike_num=$2 AND status IN ('conectado','reservada','bt_anonimo')",
      [sessao.id, parseInt(bike_num)]
    );

    if (bikeOcupada.rows.length) {
      const ocup = bikeOcupada.rows[0];
      // Se é bt_anonimo, fazer upgrade para o aluno logado
      if (ocup.fonte === 'bluetooth' || ocup.status === 'bt_anonimo') {
        await db.query(
          "UPDATE sessao_conexoes SET user_id=$1, status='conectado', fonte='qr_bike', last_update=NOW() WHERE id=$2",
          [req.user.id, ocup.id]
        );
        notificarBikeId(sessao.token, parseInt(bike_num), req.user.id);
        return res.json({ ok: true, bike_num: parseInt(bike_num), sessao_id: sessao.id,
          nome_aula: sessao.nome_aula, sessao_token: sessao.token, upgrade_bt: true });
      }
      // Se é o mesmo aluno reconectando
      if (ocup.user_id === req.user.id) {
        await db.query(
          "UPDATE sessao_conexoes SET status='conectado', last_update=NOW() WHERE id=$1", [ocup.id]
        );
        notificarBikeId(sessao.token, parseInt(bike_num), req.user.id);
        return res.json({ ok: true, bike_num: parseInt(bike_num), sessao_id: sessao.id,
          nome_aula: sessao.nome_aula, sessao_token: sessao.token, reconectado: true });
      }
      return res.status(409).json({ error: `Bike ${bike_num} já está ocupada por outro aluno.` });
    }

    // Verificar se já está em outra bike nesta sessão
    const jaConectado = await db.query(
      "SELECT id, bike_num FROM sessao_conexoes WHERE sessao_id=$1 AND user_id=$2",
      [sessao.id, req.user.id]
    );
    if (jaConectado.rows.length) {
      const antiga = jaConectado.rows[0];
      if (antiga.bike_num === parseInt(bike_num)) {
        await db.query("UPDATE sessao_conexoes SET status='conectado', last_update=NOW() WHERE id=$1", [antiga.id]);
        notificarBikeId(sessao.token, parseInt(bike_num), req.user.id);
        return res.json({ ok: true, bike_num: parseInt(bike_num), sessao_id: sessao.id,
          nome_aula: sessao.nome_aula, sessao_token: sessao.token, reconectado: true });
      }
      // Mover para nova bike
      await db.query(
        "UPDATE sessao_conexoes SET bike_num=$1, fonte='qr_bike', last_update=NOW() WHERE id=$2",
        [parseInt(bike_num), antiga.id]
      );
      notificarBikeId(sessao.token, parseInt(bike_num), req.user.id);
      return res.json({ ok: true, bike_num: parseInt(bike_num), sessao_id: sessao.id,
        nome_aula: sessao.nome_aula, sessao_token: sessao.token, bike_trocada: true, bike_anterior: antiga.bike_num });
    }

    // Verificar limite de conexões
    const total = await db.query(
      "SELECT COUNT(*) FROM sessao_conexoes WHERE sessao_id=$1 AND status IN ('conectado','bt_anonimo')",
      [sessao.id]
    );
    if (parseInt(total.rows[0].count) >= sessao.max_conexoes) {
      return res.status(429).json({ error: `Sala cheia (${sessao.max_conexoes} bikes).` });
    }

    // Inserir nova conexão na bike especificada
    await db.query(
      "INSERT INTO sessao_conexoes (sessao_id, user_id, bike_num, status, fonte) VALUES ($1,$2,$3,'conectado','qr_bike')",
      [sessao.id, req.user.id, parseInt(bike_num)]
    );

    notificarBikeId(sessao.token, parseInt(bike_num), req.user.id);
    res.json({ ok: true, bike_num: parseInt(bike_num), sessao_id: sessao.id, nome_aula: sessao.nome_aula, sessao_token: sessao.token });
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

// ══════════════════════════════════════════════════════════════
// DESAFIOS — Grupos de amigos e ranking
// ══════════════════════════════════════════════════════════════

// Criação das tabelas se não existirem
if (db) {
  db.query(`
    CREATE TABLE IF NOT EXISTS desafio_grupos (
      id          SERIAL PRIMARY KEY,
      codigo      TEXT UNIQUE NOT NULL,
      nome        TEXT NOT NULL,
      desafio_id  TEXT NOT NULL DEFAULT '21dias',
      criador_id  INTEGER REFERENCES users(id),
      license_id  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS desafio_grupo_membros (
      id         SERIAL PRIMARY KEY,
      grupo_id   INTEGER REFERENCES desafio_grupos(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id),
      joined_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(grupo_id, user_id)
    );
  `).catch(e => log('desafio_grupos migration: ' + e.message));
}

function gerarCodigoGrupo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return 'GRP-' + c;
}

// GET /desafios/ranking/mensal — top alunos do mês (público)
app.get('/desafios/ranking/mensal', async (req, res) => {
  if (!db) return res.json({ ranking: [] });
  const mes = parseInt(req.query.mes || new Date().getMonth() + 1);
  const ano = parseInt(req.query.ano || new Date().getFullYear());
  try {
    const r = await db.query(`
      SELECT u.id AS user_id, u.name AS nome,
             COUNT(ah.id) AS aulas,
             COALESCE(SUM(u_pts.pts_aula), COUNT(ah.id) * 100) AS pontos
      FROM aula_historico ah
      JOIN users u ON u.id = ah.user_id
      LEFT JOIN LATERAL (SELECT 100 AS pts_aula) u_pts ON true
      WHERE EXTRACT(MONTH FROM ah.data_aula) = $1
        AND EXTRACT(YEAR  FROM ah.data_aula) = $2
      GROUP BY u.id, u.name
      ORDER BY pontos DESC
      LIMIT 50
    `, [mes, ano]);
    res.json({ ranking: r.rows.map(x => ({ ...x, aulas: parseInt(x.aulas), pontos: parseInt(x.pontos) })) });
  } catch(e) {
    res.json({ ranking: [] });
  }
});

// GET /desafios/ranking/:desafio_id — ranking por tipo de desafio
app.get('/desafios/ranking/:desafio_id', async (req, res) => {
  if (!db) return res.json({ ranking: [] });
  const desafioId = req.params.desafio_id;
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  try {
    // Por enquanto todos os desafios usam contagem de aulas do mês
    const r = await db.query(`
      SELECT u.id AS user_id, u.name AS nome,
             COUNT(ah.id) AS aulas,
             COUNT(ah.id) * 100 AS pontos
      FROM aula_historico ah
      JOIN users u ON u.id = ah.user_id
      WHERE EXTRACT(MONTH FROM ah.data_aula) = $1
        AND EXTRACT(YEAR  FROM ah.data_aula) = $2
      GROUP BY u.id, u.name
      ORDER BY pontos DESC
      LIMIT 50
    `, [mes, ano]);
    res.json({ desafio_id: desafioId, ranking: r.rows.map(x => ({ ...x, aulas: parseInt(x.aulas), pontos: parseInt(x.pontos) })) });
  } catch(e) {
    res.json({ ranking: [] });
  }
});

// POST /desafios/grupos — criar grupo
app.post('/desafios/grupos', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, desafio_id } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  let codigo;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    codigo = gerarCodigoGrupo();
    const existe = await db.query('SELECT id FROM desafio_grupos WHERE codigo=$1', [codigo]);
    if (!existe.rows.length) break;
  }
  try {
    const r = await db.query(
      `INSERT INTO desafio_grupos (codigo, nome, desafio_id, criador_id, license_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, codigo, nome`,
      [codigo, nome.trim(), desafio_id || '21dias', req.user.id, req.user.license_id]
    );
    const grupo = r.rows[0];
    // Criador entra automaticamente
    await db.query(
      'INSERT INTO desafio_grupo_membros (grupo_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [grupo.id, req.user.id]
    );
    res.json({ ok: true, codigo: grupo.codigo, nome: grupo.nome, desafio_id: desafio_id || '21dias' });
  } catch(e) {
    res.status(500).json({ error: 'Erro ao criar grupo: ' + e.message });
  }
});

// POST /desafios/grupos/:codigo/entrar — entrar num grupo
app.post('/desafios/grupos/:codigo/entrar', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const codigo = req.params.codigo.toUpperCase();
  try {
    const g = await db.query('SELECT * FROM desafio_grupos WHERE codigo=$1', [codigo]);
    if (!g.rows.length) return res.status(404).json({ error: 'Grupo não encontrado' });
    const grupo = g.rows[0];
    await db.query(
      'INSERT INTO desafio_grupo_membros (grupo_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [grupo.id, req.user.id]
    );
    res.json({ ok: true, codigo: grupo.codigo, nome: grupo.nome, desafio_id: grupo.desafio_id });
  } catch(e) {
    res.status(500).json({ error: 'Erro ao entrar no grupo' });
  }
});

// GET /desafios/grupos/:codigo/ranking — ranking do grupo
app.get('/desafios/grupos/:codigo/ranking', async (req, res) => {
  if (!db) return res.json({ ranking: [] });
  const codigo = req.params.codigo.toUpperCase();
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  try {
    const g = await db.query('SELECT * FROM desafio_grupos WHERE codigo=$1', [codigo]);
    if (!g.rows.length) return res.status(404).json({ error: 'Grupo não encontrado' });
    const grupoId = g.rows[0].id;
    const r = await db.query(`
      SELECT u.id AS user_id, u.name AS nome,
             COUNT(ah.id) AS aulas,
             COUNT(ah.id) * 100 AS pontos
      FROM desafio_grupo_membros dgm
      JOIN users u ON u.id = dgm.user_id
      LEFT JOIN aula_historico ah ON ah.user_id = u.id
        AND EXTRACT(MONTH FROM ah.data_aula) = $2
        AND EXTRACT(YEAR  FROM ah.data_aula) = $3
      WHERE dgm.grupo_id = $1
      GROUP BY u.id, u.name
      ORDER BY pontos DESC, u.name
    `, [grupoId, mes, ano]);
    res.json({ codigo, ranking: r.rows.map(x => ({ ...x, aulas: parseInt(x.aulas||0), pontos: parseInt(x.pontos||0) })) });
  } catch(e) {
    res.json({ ranking: [] });
  }
});

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
