/**
 * PRORIDER — Servidor v2.0
 * WebSocket (salas de aula) + HTTP REST (usuários, licenças, gamificação)
 */

const http       = require('http');
const WebSocket  = require('ws');
const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');
const bcrypt     = require('bcrypt');
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
  if (points >= 10000) return 'master';
  if (points >= 5000)  return 'elite';
  if (points >= 2000)  return 'avancado';
  if (points >= 500)   return 'intermediario';
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
    version: '2.0',
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
  const { email, name, password } = req.body;
  if (!email || !name || !password)
    return res.status(400).json({ error: 'email, name e password obrigatórios' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id, email, name, role, points, level',
      [email.toLowerCase(), name, hash]
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
      'SELECT id, email, name, role, license_id, points, level, created_at FROM users WHERE id=$1',
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
