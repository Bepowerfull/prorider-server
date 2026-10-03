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
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET nao definido — adicione nas variaveis do Railway antes de fazer deploy');
}
const DB_URL        = process.env.DATABASE_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || null;
console.log('[asaas] API_KEY:', ASAAS_API_KEY ? 'presente' : 'AUSENTE');

// ══ Express ═══════════════════════════════════════════════════
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));  // 29/09a: foto do totem (~50–250 KB)
app.use(express.static(path.join(__dirname, 'public')));

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

// 29/09b — BRASÕES. Escada do Mario: três brasões antes do Bronze
// (Aquecimento, Cadência, Pelotão), Bronze a partir de 600 e o topo
// alcançável em ~1 ano (Mestre) a ~1,5 ano (Lenda) com 3 aulas por semana. A mesma tabela está em
// public/brasoes.js (desenho) — mudar as duas juntas.
const NIVEIS = [
  ['aquecimento', 0], ['cadencia', 200], ['pelotao', 400],
  ['bronze1', 600], ['bronze2', 900], ['bronze3', 1200],
  ['prata1', 1600], ['prata2', 2100], ['prata3', 2700],
  ['ouro1', 3400], ['ouro2', 4300], ['ouro3', 5300],
  ['platina1', 6500], ['platina2', 8000], ['platina3', 9700],
  ['diamante1', 11800], ['diamante2', 14300], ['diamante3', 17200],
  ['mestre', 25000], ['lenda', 35000],
];
function calcLevel(points) {
  const p = parseInt(points) || 0;
  let k = 'aquecimento';
  for (const [key, min] of NIVEIS) if (p >= min) k = key;
  return k;
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


// 26/09h — ROTAS DE SETUP SÓ COM SETUP_KEY NO AMBIENTE. Antes a chave tinha
// um valor padrão escrito no código ('prorider_setup_2026' /
// 'prorider-setup-2026'): quem lesse o código podia criar um admin, virar
// super_admin ou trocar a senha de qualquer e-mail. Agora, sem a variável
// SETUP_KEY no Railway, estas rotas respondem 404; com ela, exigem o valor.
function setupKeyOk(valor) {
  const k = process.env.SETUP_KEY;
  if (!k || k.length < 12) return false;
  const a = Buffer.from(String(valor || '')), b = Buffer.from(k);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function shortId() {
  return crypto.randomBytes(10).toString('hex'); // 20 chars
}

// ══════════════════════════════════════════════════════════════
// E-MAILS AUTOMÁTICOS (26/09e)
// ══════════════════════════════════════════════════════════════
// Configuração no Railway (variáveis de ambiente) — basta UMA das duas:
//   RESEND_API_KEY=re_xxx                 (resend.com, sem instalar nada)
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS   (ex.: Gmail com senha de app;
//        precisa do pacote nodemailer: npm i nodemailer)
//   EMAIL_FROM="ProRider <nao-responda@seudominio.com>"   (remetente)
//   PORTAL_URL=https://...   (link dos botões; padrão: este servidor)
// Sem nenhuma delas, nada é enviado e o Portal mostra "e-mail não configurado".
const EMAILS_PADRAO = { boas_vindas: true, resumo_aula: true, sumido: true, novo_ftp: true, aniversario: false, relatorio_mensal: true, lembrete_aula: true, vaga_aberta: true };
const PORTAL_URL = process.env.PORTAL_URL || 'https://prorider-server-production-5784.up.railway.app';
let _smtp = null;
function emailProvedor() {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST && process.env.SMTP_USER) return 'smtp';
  return null;
}
async function enviarEmail({ to, subject, html }) {
  const prov = emailProvedor();
  if (!prov) return { ok: false, erro: 'e-mail não configurado no servidor' };
  if (!to || !/@/.test(to)) return { ok: false, erro: 'destinatário inválido' };
  const from = process.env.EMAIL_FROM || 'ProRider <onboarding@resend.dev>';
  try {
    if (prov === 'resend') {
      const r = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html })
      });
      if (!r.ok) return { ok: false, erro: 'resend ' + r.status + ': ' + (await r.text()).slice(0, 200) };
      return { ok: true };
    }
    if (!_smtp) {
      let nm; try { nm = require('nodemailer'); } catch (e) { return { ok: false, erro: 'SMTP configurado mas falta o pacote nodemailer (npm i nodemailer)' }; }
      _smtp = nm.createTransport({
        host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT) || 587,
        secure: (parseInt(process.env.SMTP_PORT) || 587) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
    }
    await _smtp.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, html });
    return { ok: true };
  } catch (e) { return { ok: false, erro: e.message }; }
}
// Manda uma vez só por (tipo, ref). Se já foi, não manda de novo.
let _emailUltimoErro = null;
// 03/10a: por que o e-mail não saiu (o admin vê isto e passa o acesso pelo WhatsApp)
function emailMotivo(erro) {
  if (!emailProvedor()) return 'O servidor não tem e-mail configurado (falta RESEND_API_KEY no Railway).';
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  if (/resend\.dev/i.test(from) || /verify a domain|testing emails|only send/i.test(String(erro || '')))
    return 'O Resend está sem domínio verificado (remetente ' + from + '): ele só entrega para o dono da conta Resend. Falta verificar o domínio e pôr EMAIL_FROM.';
  return 'O provedor de e-mail recusou: ' + String(erro || 'erro desconhecido').slice(0, 160);
}
async function emailUmaVez(tipo, ref, userId, to, subject, html) {
  _emailUltimoErro = null;
  if (!db || !emailProvedor() || !to) return false;
  try {
    const ins = await db.query(
      'INSERT INTO email_log (user_id, email, tipo, ref) VALUES ($1,$2,$3,$4) ON CONFLICT (tipo, ref) DO NOTHING RETURNING id',
      [userId || null, to, tipo, String(ref)]);
    if (!ins.rows.length) return false;
    const r = await enviarEmail({ to, subject, html });
    if (!r.ok) {
      // falhou: libera para tentar de novo mais tarde
      await db.query('DELETE FROM email_log WHERE id=$1', [ins.rows[0].id]);
      _emailUltimoErro = r.erro || 'falhou';
      log(`E-mail ${tipo} para ${to} falhou: ${r.erro}`);
      return false;
    }
    log(`E-mail ${tipo} enviado para ${to}`);
    return true;
  } catch (e) { log('emailUmaVez erro: ' + e.message); return false; }
}
async function emailsCfgDe(licId) {
  if (!db || !licId) return { ...EMAILS_PADRAO };
  try {
    const r = await db.query('SELECT emails_cfg FROM licencas WHERE codigo=$1', [licId]);
    return { ...EMAILS_PADRAO, ...((r.rows[0] && r.rows[0].emails_cfg) || {}) };
  } catch (e) { return { ...EMAILS_PADRAO }; }
}
function _esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function emailLayout(titulo, corpo, botaoTxt, botaoUrl, academia) {
  return `<div style="background:#0b0b0e;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:540px;margin:0 auto;background:#16161a;border-radius:14px;overflow:hidden;border:1px solid #26262d">
    <div style="padding:20px 26px 16px;background:#0b0b0e;border-bottom:3px solid #ea860c">
      <img src="${PORTAL_URL}/img/logo-prorider.png" alt="ProRider" width="170" style="display:block;width:170px;height:auto;border:0">
      ${academia ? `<div style="font-size:11px;color:#9a9aa2;letter-spacing:2px;text-transform:uppercase;margin-top:8px">${_esc(academia)}</div>` : ''}
    </div>
    <div style="padding:26px;color:#e8e8ea;font-size:15px;line-height:1.55">
      <div style="font-size:21px;font-weight:800;color:#fff;margin-bottom:14px">${titulo}</div>
      ${corpo}
      ${botaoTxt ? `<div style="margin-top:22px"><a href="${botaoUrl}" style="display:inline-block;background:#ea860c;color:#16161a;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:9px">${botaoTxt}</a></div>` : ''}
    </div>
    <div style="padding:14px 26px;border-top:1px solid #26262d;color:#77777f;font-size:11px">Você recebe este e-mail porque tem conta no ProRider. A academia pode desligar estes avisos no Portal.</div>
  </div></div>`;
}
// ── TEXTOS DOS E-MAILS (30/09e) ─────────────────────────────────────
// A academia pode escrever os próprios textos no Portal (emails_cfg.textos).
// Campo vazio = texto padrão abaixo. {palavras} viram os dados do aluno.
const EMAIL_TEXTO_PADRAO = {
  boas_vindas:      { assunto: 'Bem-vindo(a) ao ProRider — {academia}', titulo: 'Bem-vindo(a), {nome}!', abertura: 'Que bom ter você com a gente na {academia}.', fechamento: 'Na aula, escaneie o QR da bike com o app e acompanhe potência, zonas e calorias em tempo real. Depois de cada aula você recebe o seu resumo.', botao: '' },
  resumo_aula:      { assunto: '⚡ {nome}, seu resumo da aula', titulo: 'Parabéns pela aula, {nome}! 🔥', abertura: 'Olha só o que você fez na aula {aula}:', fechamento: '', botao: '' },
  sumido:           { assunto: 'Sentimos sua falta, {nome} 🚴', titulo: 'Sentimos sua falta!', abertura: 'Faz {dias} dias desde a sua última aula na {academia}.', fechamento: 'Que tal voltar esta semana? Seu FTP e seu histórico continuam guardados.', botao: '' },
  novo_ftp:         { assunto: '📈 Novo FTP: {ftp_novo} W', titulo: 'Boa, {nome}! Seu FTP subiu.', abertura: '', fechamento: 'As zonas das próximas aulas já usam o FTP novo.', botao: '' },
  aniversario:      { assunto: '🎉 Feliz aniversário, {nome}!', titulo: 'Feliz aniversário! 🎂', abertura: 'A equipe da {academia} deseja um ótimo dia.', fechamento: 'Venha comemorar pedalando!', botao: '' },
  relatorio_mensal: { assunto: 'Relatório de {mes} — {academia}', titulo: 'Relatório de {mes}', abertura: '', fechamento: 'O relatório completo, com as zonas e os melhores alunos, está no Portal.', botao: 'Abrir relatórios' },
  lembrete_aula:    { assunto: '⏰ {nome}, sua aula é às {hora}', titulo: 'Sua aula é daqui a pouco!', abertura: '{aula} hoje às {hora} na {academia} — bike {bike}.', fechamento: 'Não vai conseguir ir? Cancele no app e libere a vaga para quem está na lista de espera.', botao: 'Abrir o app' },
  vaga_aberta:      { assunto: '🚲 Abriu uma vaga: {aula} às {hora}', titulo: 'Abriu uma vaga para você!', abertura: 'Você estava na lista de espera da aula {aula}, {data} às {hora}. A bike {bike} agora é sua.', fechamento: 'Se não puder ir, cancele no app para a vaga ir para o próximo da fila.', botao: 'Abrir o app' },
};
const EMAIL_CAMPOS = ['assunto', 'titulo', 'abertura', 'fechamento', 'botao'];
function emailTexto(cfg, tipo) {
  const base = EMAIL_TEXTO_PADRAO[tipo] || {}, meu = ((cfg && cfg.textos) || {})[tipo] || {}, o = {};
  EMAIL_CAMPOS.forEach(k => { o[k] = (typeof meu[k] === 'string' && meu[k].trim()) ? meu[k] : (base[k] || ''); });
  o.numeros = meu.numeros === undefined ? true : !!meu.numeros;
  return o;
}
function emailVars(t, v) { return String(t || '').replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null) ? String(v[k]) : m); }
// corpo = abertura + [números] + [extra fixo] + fechamento; tudo escapado
function emailMontar(tipo, cfg, v, numerosHtml, extraHtml, botaoUrl, academia) {
  const t = emailTexto(cfg, tipo);
  const p = x => x ? `<p>${_esc(emailVars(x, v)).replace(/\n/g, '<br>')}</p>` : '';
  const corpo = p(t.abertura) + ((t.numeros && numerosHtml) ? numerosHtml : '') + (extraHtml || '') + p(t.fechamento);
  return { subject: emailVars(t.assunto, v), html: emailLayout(_esc(emailVars(t.titulo, v)), corpo, t.botao ? _esc(emailVars(t.botao, v)) : null, botaoUrl || (PORTAL_URL + '/aluno'), academia) };
}
function _numBox(v, l, cor) {
  return `<td style="text-align:center;padding:10px"><div style="font-size:28px;font-weight:900;color:${cor || '#fff'}">${v}</div><div style="font-size:10px;color:#8a8a92;letter-spacing:1px">${l}</div></td>`;
}
async function _userLic(uid) {
  const r = await db.query(`SELECT u.id, u.name, u.email, u.ftp, u.license_id, l.nome AS academia
                            FROM users u LEFT JOIN licencas l ON l.codigo=u.license_id WHERE u.id=$1`, [uid]);
  return r.rows[0] || null;
}
async function emailBoasVindas({ userId, email, nome, academia, licId, senhaTemp, papel }) {
  if (licId) { const c = await emailsCfgDe(licId); if (!c.boas_vindas) return false; }
  const gestor = papel && papel !== 'aluno' && papel !== 'aluno_totem';
  const corpo = gestor
    ? `<p>Olá, <b>${_esc(nome || '')}</b>! A licença <b>${_esc(academia || '')}</b> está pronta no ProRider.</p>
       <p>Entre no Portal com:</p>
       <p style="background:#0b0b0e;border-radius:8px;padding:12px 14px">E-mail: <b>${_esc(email)}</b>${senhaTemp ? `<br>Senha provisória: <b>${_esc(senhaTemp)}</b>` : ''}</p>
       <p>${papel === 'financeiro' ? 'Ao entrar, abre a página de <b>pagamento da licença</b>: lá você cadastra o cartão (na página segura do Asaas) e vê as faturas e recibos.' : 'No Portal você monta a agenda, acompanha os alunos, escolhe o que aparece no ranking da TV e muito mais.'}${senhaTemp ? ' Troque a senha no primeiro acesso.' : ''}</p>`
    : null;
  if (!gestor) {
    const cfgA = licId ? await emailsCfgDe(licId) : {};
    const acesso = senhaTemp ? `<p style="background:#0b0b0e;border-radius:8px;padding:12px 14px">Seu acesso ao app: <b>${_esc(email)}</b><br>Senha provisória: <b>${_esc(senhaTemp)}</b></p>` : '';
    const m = emailMontar('boas_vindas', cfgA, { nome: String(nome || '').split(' ')[0], nome_completo: nome || '', academia: academia || 'ProRider' }, null, acesso, PORTAL_URL + '/aluno', academia);
    return emailUmaVez('boas_vindas', 'u' + (userId || email), userId, email, m.subject, m.html);
  }
  return emailUmaVez('boas_vindas', 'u' + (userId || email), userId, email,
    papel === 'financeiro' ? `Seu acesso ao pagamento da licença ProRider — ${academia || ''}` : `Sua licença ProRider está pronta — ${academia || ''}`,
    emailLayout(papel === 'financeiro' ? 'Acesso do financeiro' : 'Bem-vindo ao Portal ProRider', corpo,
      papel === 'financeiro' ? 'Entrar e pagar' : 'Abrir o Portal', PORTAL_URL + '/academia.html', academia));
}
async function emailResumoAula(uid, a) {
  if (!db || !emailProvedor()) return;
  const u = await _userLic(uid); if (!u || !u.email) return;
  const c = await emailsCfgDe(u.license_id); if (!c.resumo_aula) return;
  const min = Math.round((parseInt(a.duracao_sec) || 0) / 60);
  const v = { nome: String(u.name || '').split(' ')[0], nome_completo: u.name || '', academia: u.academia || 'ProRider', aula: a.aula_nome || 'Aula',
    duracao: min + ' min', kcal: parseInt(a.kcal) || 0, potencia: (parseInt(a.watts_med) || 0) + ' W', rpm: parseInt(a.rpm_med) || 0,
    zona: String(a.zona_predominante || '—').toUpperCase(), pontos: parseInt(a.pontos) || 0 };
  const nums = `<table style="width:100%;background:#0b0b0e;border-radius:10px;margin:10px 0"><tr>
      ${_numBox(v.duracao, 'DURAÇÃO')}${_numBox(v.kcal, 'KCAL', '#ea860c')}${_numBox(v.potencia, 'POTÊNCIA MÉDIA', '#5b8cff')}
    </tr><tr>
      ${_numBox(v.rpm, 'RPM MÉDIO')}${_numBox(v.zona, 'ZONA PREDOMINANTE')}${_numBox('+' + v.pontos, 'PONTOS', '#ffe033')}
    </tr></table>`;
  const m = emailMontar('resumo_aula', c, v, nums, '', PORTAL_URL + '/aluno', u.academia);
  await emailUmaVez('resumo_aula', 'u' + uid + ':' + Date.now(), uid, u.email, m.subject, m.html);
}
async function emailNovoFtp(uid, antes, depois) {
  if (!db || !emailProvedor()) return;
  const u = await _userLic(uid); if (!u || !u.email) return;
  const c = await emailsCfgDe(u.license_id); if (!c.novo_ftp) return;
  const v = { nome: String(u.name || '').split(' ')[0], nome_completo: u.name || '', academia: u.academia || 'ProRider', ftp_antes: antes, ftp_novo: depois, evolucao: depois - antes };
  const nums = `<table style="width:100%;background:#0b0b0e;border-radius:10px;margin:10px 0"><tr>
      ${_numBox(antes + ' W', 'ANTES')}${_numBox(depois + ' W', 'AGORA', '#5db13d')}${_numBox('+' + (depois - antes) + ' W', 'EVOLUÇÃO', '#ffe033')}
    </tr></table>`;
  const m = emailMontar('novo_ftp', c, v, nums, '', PORTAL_URL + '/aluno', u.academia);
  await emailUmaVez('novo_ftp', 'u' + uid + ':' + depois, uid, u.email, m.subject, m.html);
}
// Rotina diária (10h de Brasília): sumidos, aniversários e relatório mensal.
async function rotinaEmailsDiaria() {
  if (!db || !emailProvedor()) return;
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = agora.toISOString().slice(0, 10);
  try {
    const lics = await db.query("SELECT codigo, nome, emails_cfg, contato_email, email_gestor FROM licencas WHERE status='ativa'");
    for (const l of lics.rows) {
      const c = { ...EMAILS_PADRAO, ...(l.emails_cfg || {}) };
      if (c.sumido) {
        const r = await db.query(`
          SELECT u.id, u.name, u.email, MAX(ah.data_aula) AS ultima FROM users u
          JOIN aula_historico ah ON ah.user_id=u.id
          WHERE u.license_id=$1 AND u.role='aluno' AND COALESCE(u.status,'ativo')='ativo'
          GROUP BY u.id HAVING MAX(ah.data_aula) BETWEEN NOW()-INTERVAL '30 days' AND NOW()-INTERVAL '14 days'`, [l.codigo]);
        for (const u of r.rows) {
          const dias = Math.floor((Date.now() - new Date(u.ultima)) / 86400000);
          const mS = emailMontar('sumido', c, { nome: String(u.name || '').split(' ')[0], nome_completo: u.name || '', academia: l.nome, dias }, null, '', PORTAL_URL + '/aluno', l.nome);
          await emailUmaVez('sumido', 'u' + u.id + ':' + new Date(u.ultima).toISOString().slice(0, 10), u.id, u.email, mS.subject, mS.html);
        }
      }
      if (c.aniversario) {
        const r = await db.query(`SELECT id, name, email FROM users WHERE license_id=$1 AND nascimento IS NOT NULL
          AND EXTRACT(MONTH FROM nascimento)=$2 AND EXTRACT(DAY FROM nascimento)=$3`, [l.codigo, agora.getMonth() + 1, agora.getDate()]);
        for (const u of r.rows) {
          const mA = emailMontar('aniversario', c, { nome: String(u.name || '').split(' ')[0], nome_completo: u.name || '', academia: l.nome }, null, '', PORTAL_URL + '/aluno', l.nome);
          await emailUmaVez('aniversario', 'u' + u.id + ':' + agora.getFullYear(), u.id, u.email, mA.subject, mA.html);
        }
      }
      if (c.relatorio_mensal && agora.getDate() === 1) {
        const para = l.email_gestor || l.contato_email; if (!para) continue;
        const mes = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
        const ref = mes.getFullYear() + '-' + String(mes.getMonth() + 1).padStart(2, '0');
        const r = await db.query(`SELECT COUNT(*)::int AS aulas, COUNT(DISTINCT ah.user_id)::int AS alunos, COALESCE(SUM(ah.kcal),0)::int AS kcal
          FROM aula_historico ah JOIN users u ON u.id=ah.user_id
          WHERE u.license_id=$1 AND ah.data_aula >= $2::date AND ah.data_aula < ($2::date + INTERVAL '1 month')`, [l.codigo, ref + '-01']);
        const d = r.rows[0] || {};
        const nomeMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const numsR = `<table style="width:100%;background:#0b0b0e;border-radius:10px;margin:10px 0"><tr>
            ${_numBox(d.aulas || 0, 'AULAS CONCLUÍDAS')}${_numBox(d.alunos || 0, 'ALUNOS ATIVOS', '#5db13d')}${_numBox(d.kcal || 0, 'KCAL', '#ea860c')}</tr></table>`;
        const mR = emailMontar('relatorio_mensal', c, { academia: l.nome, mes: nomeMes, aulas: d.aulas || 0, alunos: d.alunos || 0, kcal: d.kcal || 0 }, numsR, '', PORTAL_URL + '/academia.html', l.nome);
        await emailUmaVez('relatorio_mensal', l.codigo + ':' + ref, null, para, mR.subject, mR.html);
      }
    }
  } catch (e) { log('rotinaEmailsDiaria erro: ' + e.message); }
  _ultimaRotinaEmail = hoje;
}
let _ultimaRotinaEmail = '';
setInterval(() => {
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  if (agora.getHours() >= 10 && _ultimaRotinaEmail !== agora.toISOString().slice(0, 10)) rotinaEmailsDiaria();
}, 15 * 60 * 1000);

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
    // janela_reserva: quantas HORAS antes da aula a reserva abre.
    //   NULL = sem limite (reserva sempre aberta, aula não exige reserva)
    // cor: cor da aula na grade, escolhida numa paleta pelo gestor. Ela aparece
    //   também na tela inicial do Ginásio, por isso fica guardada aqui.
    await db.query(`
      ALTER TABLE aulas_agenda
        ADD COLUMN IF NOT EXISTS janela_reserva SMALLINT,
        ADD COLUMN IF NOT EXISTS cor TEXT
    `);
    log('Migração aulas_agenda OK');

    // ── Colunas de 14/09, agora aplicadas pelo próprio servidor ────
    // Estavam num migration_14-09.sql que dependia de alguém rodar à mão e
    // ficou parado. Como o servidor já se migra sozinho no arranque, não há
    // motivo para depender disso: ADD COLUMN IF NOT EXISTS é inofensivo se as
    // colunas já existirem, e resolve de vez se não existirem.
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS peso   NUMERIC(5,2) DEFAULT 70,
        ADD COLUMN IF NOT EXISTS ftp    SMALLINT     DEFAULT 130,
        ADD COLUMN IF NOT EXISTS altura SMALLINT,
        ADD COLUMN IF NOT EXISTS idade  SMALLINT,
        ADD COLUMN IF NOT EXISTS sexo   CHAR(1),
        ADD COLUMN IF NOT EXISTS tmb    SMALLINT
    `);
    // ── A TABELA PRIMEIRO, SEMPRE ────────────────────────────────
    // ERRO MEU, de 16/09: acrescentei o ALTER TABLE abaixo sem garantir que a
    // tabela existia. Num banco onde aulas_completadas nunca tinha sido criada,
    // o PostgreSQL recusava, o processo morria e o Railway reiniciava — em
    // ciclo, a noite inteira e durante as duas aulas de 19/09. Foi isto que
    // derrubou os 13 alunos: nao era volume de mensagens nem memoria.
    // CREATE TABLE IF NOT EXISTS e inofensivo se a tabela ja existir.
    await db.query(`
      CREATE TABLE IF NOT EXISTS aulas_completadas (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
        aula_nome         TEXT,
        duracao_sec       INTEGER DEFAULT 0,
        pontos            INTEGER DEFAULT 0,
        zona_predominante TEXT,
        z1_pct SMALLINT DEFAULT 0, z2_pct SMALLINT DEFAULT 0,
        z3_pct SMALLINT DEFAULT 0, z4_pct SMALLINT DEFAULT 0,
        z5_pct SMALLINT DEFAULT 0, z6_pct SMALLINT DEFAULT 0,
        z7_pct SMALLINT DEFAULT 0,
        watts_med         SMALLINT DEFAULT 0,
        kcal              SMALLINT DEFAULT 0,
        rpm_medio         SMALLINT DEFAULT 0,
        completed_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // shared_aulas: mesma falta, apontada pelo dev. Nao derrubava o servidor,
    // mas enchia o log de erro a cada limpeza horaria.
    await db.query(`
      CREATE TABLE IF NOT EXISTS shared_aulas (
        id          SERIAL PRIMARY KEY,
        share_id    TEXT UNIQUE NOT NULL,
        aula_json   TEXT NOT NULL,
        created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`
      ALTER TABLE aulas_completadas
        ADD COLUMN IF NOT EXISTS watts_med SMALLINT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS kcal      SMALLINT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rpm_medio SMALLINT DEFAULT 0
    `);
    log('Migração 14/09 (dados físicos + medições) OK');

    // ── Acesso de professor a licenças (multi-unidade) ────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS professor_licencas (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
        license_id   TEXT NOT NULL,
        liberado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, license_id)
      )
    `);
    await db.query(`
      ALTER TABLE professor_licencas
        ADD COLUMN IF NOT EXISTS liberado_por INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    log('Migração professor_licencas OK');

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
    await db.query(`
      ALTER TABLE aulas_reservas
        ADD COLUMN IF NOT EXISTS bike_numero SMALLINT
    `);
    // 01/10b: duas pessoas não reservam a mesma bike na mesma aula
    try {
      // 02/10c: quem faltou ('ausente') também libera a bike
      await db.query(`DROP INDEX IF EXISTS aulas_reservas_bike_uniq`);
      await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS aulas_reservas_bike_uniq2 ON aulas_reservas (agenda_id, data_aula, bike_numero)
        WHERE status NOT IN ('cancelado','ausente') AND bike_numero IS NOT NULL AND bike_numero<>99`);
    } catch (e) { log('Aviso: índice de bike única nas reservas não criado (' + e.message + ') — a checagem continua no /aluno/reservar'); }
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
    // 24/09: licenca demo com 20 bikes (decisao do Mario). So troca se ainda
    // estiver no valor antigo (0 ou 15) — uma mudanca feita depois pelo super
    // admin nao e desfeita a cada arranque.
    try {
      await db.query(`UPDATE licencas SET max_bikes=20,
                        bikes_disponiveis = CASE WHEN COALESCE(bikes_disponiveis,0) IN (0,15) THEN 20 ELSE LEAST(bikes_disponiveis,20) END
                      WHERE codigo='PRDR-DEMO-001' AND COALESCE(max_bikes,0) IN (0,15)`);
    } catch(e) { log('demo 20 bikes: ' + e.message); }
    // Onboarding token para licenses (tabela legacy — ignorar se não existir)
    try {
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS onboarding_token TEXT`);
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_bikes INTEGER DEFAULT 10`);
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS gestor_email TEXT`);
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS gestor_nome TEXT`);
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS fin_email TEXT`);
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS fin_nome TEXT`);
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS cidade TEXT`);
      await db.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS nome_fantasia TEXT`);
      log('Migração licenses onboarding OK');
    } catch(e) { log('Migração licenses onboarding ignorada: ' + e.message); }

    // ── Licenças: computador único e pagamento ─────────────────────
    await db.query(`
      ALTER TABLE licencas
        ADD COLUMN IF NOT EXISTS max_computadores SMALLINT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS pagamento_ok_ate DATE
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS licenca_computadores (
        id               SERIAL PRIMARY KEY,
        license_codigo   TEXT NOT NULL,
        device_id        TEXT NOT NULL,
        nome_computador  TEXT,
        ativado_em       TIMESTAMPTZ DEFAULT NOW(),
        visto_em         TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(license_codigo, device_id)
      )
    `);
    log('Migração licenca_computadores OK');

    // ── Licenças: campos de endereço e contacto ────────────────────
    await db.query(`
      ALTER TABLE licencas
        ADD COLUMN IF NOT EXISTS email_financeiro TEXT,
        ADD COLUMN IF NOT EXISTS email_gestor     TEXT,
        ADD COLUMN IF NOT EXISTS logradouro       TEXT,
        ADD COLUMN IF NOT EXISTS numero           TEXT,
        ADD COLUMN IF NOT EXISTS bairro           TEXT,
        ADD COLUMN IF NOT EXISTS cep              TEXT,
        ADD COLUMN IF NOT EXISTS cidade_lic       TEXT,
        ADD COLUMN IF NOT EXISTS estado           TEXT,
        ADD COLUMN IF NOT EXISTS pais             TEXT DEFAULT 'Brasil',
        ADD COLUMN IF NOT EXISTS lat              NUMERIC(9,6),
        ADD COLUMN IF NOT EXISTS lng              NUMERIC(9,6)
    `);
    log('Migração licencas endereço OK');

    // ── Treinos do professor ───────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS treinos_professor (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome         TEXT NOT NULL,
        json         JSONB NOT NULL,
        duracao_sec  INTEGER,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // ── Pareamentos Ginásio ────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS pareamentos_ginasio (
        codigo      TEXT PRIMARY KEY,
        license_id  TEXT,
        user_id     INTEGER,
        token       TEXT,
        status      TEXT DEFAULT 'pendente',
        motivo      TEXT,
        expira_em   TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    log('Migração treinos_professor + pareamentos_ginasio OK');

    // ── Portal novo (26/09e) ───────────────────────────────────────
    // ranking_cfg: campos da tela de Ranking (botão B) escolhidos pelo gestor.
    // emails_cfg:  e-mails automáticos ligados/desligados por licença.
    // build:       versão do Ginásio de cada computador (o super admin vê).
    // nascimento:  para o e-mail de aniversário (opcional no perfil).
    // email_log:   impede mandar o mesmo e-mail duas vezes.
    await db.query(`
      ALTER TABLE licencas
        ADD COLUMN IF NOT EXISTS ranking_cfg JSONB,
        ADD COLUMN IF NOT EXISTS emails_cfg  JSONB
    `);
    await db.query(`ALTER TABLE licenca_computadores ADD COLUMN IF NOT EXISTS build TEXT`);
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS nascimento DATE,
        ADD COLUMN IF NOT EXISTS foto_url   TEXT
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_log (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER,
        email      TEXT,
        tipo       TEXT NOT NULL,
        ref        TEXT NOT NULL,
        ok         BOOLEAN DEFAULT TRUE,
        erro       TEXT,
        enviado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tipo, ref)
      )
    `);
    // Aulas gravadas só em aulas_completadas (antes de 26/09e) entram no
    // histórico que o Portal lê. Não duplica: compara usuário + horário.
    await db.query(`
      INSERT INTO aula_historico (user_id, nome, data_aula, dur_seg, kcal, avg_rpm, avg_watts)
      SELECT ac.user_id, ac.aula_nome, ac.completed_at, ac.duracao_sec, ac.kcal, ac.rpm_medio, ac.watts_med
      FROM aulas_completadas ac
      WHERE NOT EXISTS (SELECT 1 FROM aula_historico ah WHERE ah.user_id=ac.user_id AND ah.data_aula=ac.completed_at)
    `);
    log('Migração portal 26/09e OK');
    // 29/09a: brasões novos — recalcula o nível de todo mundo pelos pontos
    {
      const casos = NIVEIS.slice().reverse().map(([k, min]) => `WHEN COALESCE(points,0) >= ${min} THEN '${k}'`).join(' ');
      await db.query(`UPDATE users SET level = CASE ${casos} ELSE 'aquecimento' END WHERE level IS DISTINCT FROM (CASE ${casos} ELSE 'aquecimento' END)`);
    }
    await db.query(`
      ALTER TABLE licencas
        ADD COLUMN IF NOT EXISTS pagina_cfg  JSONB,
        ADD COLUMN IF NOT EXISTS totem_token TEXT
    `);
    log('Migração 29/09a (brasões, página pública, totem) OK');
    // 29/09c: localização da academia ("Perto de mim" no app)
    await db.query(`ALTER TABLE licencas ADD COLUMN IF NOT EXISTS geo_fonte TEXT, ADD COLUMN IF NOT EXISTS geo_em TIMESTAMPTZ`);
    log('Migração 29/09c (localização) OK');
    await campMigrar().catch(e => log('Migração 01/10a (campeonatos) ERRO: ' + e.message));
    await daMigrar().catch(e => log('Migração 02/10a (desafio entre academias) ERRO: ' + e.message));
    await gvMigrar().catch(e => log('Migração 02/10b (gravar e transmitir) ERRO: ' + e.message));
    await esMigrar().catch(e => log('Migração 02/10c (lista de espera e lembretes) ERRO: ' + e.message));
    await db.query(`ALTER TABLE licencas ADD COLUMN IF NOT EXISTS asaas_customer TEXT, ADD COLUMN IF NOT EXISTS asaas_sub TEXT`).catch(e => log('Migração 02/10h (Asaas) ERRO: ' + e.message));
    // 02/10l: licença criada sem situação (status NULL) não ativava a TV ("Licença não encontrada ou inativa")
    await db.query(`UPDATE licencas SET status='ativa' WHERE status IS NULL OR status='trial'`).then(r => { if (r.rowCount) log('02/10l: ' + r.rowCount + ' licença(s) sem situação → ativa'); }).catch(e => log('Migração 02/10l ERRO: ' + e.message));
    await db.query(`ALTER TABLE licencas ALTER COLUMN status SET DEFAULT 'ativa'`).catch(() => {});
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS senha_provisoria BOOLEAN DEFAULT FALSE`).catch(() => {});   // 02/10m: pede a troca no 1º acesso
    // 03/10a: livro-caixa único (manual + Asaas) e fim do "bloqueada" automático
    await db.query(`ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS origem TEXT, ADD COLUMN IF NOT EXISTS asaas_id TEXT, ADD COLUMN IF NOT EXISTS venc_ref DATE, ADD COLUMN IF NOT EXISTS cobre_ate DATE`).catch(e => log('Migração 03/10a ERRO: ' + e.message));
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_asaas_id_uq ON pagamentos(asaas_id)`).catch(e => log('Migração 03/10a índice ERRO: ' + e.message));
    await db.query(`ALTER TABLE licencas ADD COLUMN IF NOT EXISTS asaas_aviso TEXT`).catch(() => {});
    // 03/10b: o admin antigo guardava o "dia X" (modal Financeiro) separado da data "Vencimento" (que nascia com +30 dias).
    // Uma vez só: licença que nunca pagou e tem um dia escolhido (≠ 10, o padrão) passa a vencer no próximo "dia X".
    await db.query(`ALTER TABLE licencas ADD COLUMN IF NOT EXISTS venc_migrado BOOLEAN DEFAULT FALSE`).catch(() => {});
    await db.query(`
      WITH h AS (SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AS d)
      UPDATE licencas SET vencimento = (SELECT CASE WHEN x < h.d THEN (x + INTERVAL '1 month')::date ELSE x END
             FROM h, LATERAL (SELECT make_date(EXTRACT(YEAR FROM h.d)::int, EXTRACT(MONTH FROM h.d)::int, LEAST(dia_vencimento, 28)) AS x) m)
      WHERE venc_migrado IS NOT TRUE AND pagamento_ok_ate IS NULL AND dia_vencimento IS NOT NULL AND dia_vencimento BETWEEN 1 AND 28 AND dia_vencimento <> 10
        AND (vencimento IS NULL OR EXTRACT(DAY FROM vencimento) <> dia_vencimento)`)
      .then(r => { if (r.rowCount) log('03/10b: ' + r.rowCount + ' licença(s) com o vencimento acertado para o "dia X" escolhido'); }).catch(e => log('Migração 03/10b ERRO: ' + e.message));
    await db.query(`UPDATE licencas SET venc_migrado=TRUE WHERE venc_migrado IS NOT TRUE`).catch(() => {});
    await db.query(`UPDATE licencas SET status='ativa' WHERE status='bloqueada'`).then(r => { if (r.rowCount) log('03/10a: ' + r.rowCount + ' licença(s) "bloqueada" (efeito colateral antigo) → ativa'); }).catch(() => {});
    setTimeout(() => geoPreencherFaltando().catch(e => log('geo backfill: ' + e.message)), 15000);

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
  if (!setupKeyOk(secret)) return res.status(404).json({ error: 'Não encontrado' });
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
      ['PRDR-DEMO-001', 'ProRider Demo', 20]
    );

    res.json({ ok: true, user: u.rows[0], licenca: 'PRDR-DEMO-001', max_bikes: 20 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Endpoint de teste: cria sessão ativa para PRDR-DEMO-001
app.post('/setup/sessao-teste', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { secret } = req.body;
  if (!setupKeyOk(secret)) return res.status(404).json({ error: 'Não encontrado' });
  try {
    // Encerrar sessão anterior se existir
    await db.query(
      "UPDATE sessoes_ao_vivo SET status='encerrada', encerrada_at=NOW() WHERE license_id='PRDR-DEMO-001' AND status IN ('aguardando','em_andamento')"
    );
    const token = crypto.randomBytes(20).toString('hex');
    const r = await db.query(
      `INSERT INTO sessoes_ao_vivo (license_id, token, nome_aula, professor, max_conexoes, status)
       VALUES ('PRDR-DEMO-001', $1, 'Aula Teste', 'Mario', 20, 'em_andamento') RETURNING *`,
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
    version: '2.3',
    db: dbOk,
    // 26/09g (dev): db_url_preview, db_url_set e db_pool removidos — a
    // prévia expunha o começo da DATABASE_URL (com parte da senha) em rota pública.
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
  // Dados fisicos para o metabolismo basal (Mifflin-St Jeor). Enviados pelo app
  // desde a build 12/09b. Sao opcionais: cadastro antigo continua funcionando.
  const altura   = parseInt(req.body.altura)  || null;
  const idade    = parseInt(req.body.idade)   || null;
  const sexo     = (req.body.sexo === 'M' || req.body.sexo === 'F') ? req.body.sexo : null;
  // O app ja manda o basal calculado; recalculamos aqui para nao depender do
  // cliente. Se faltar qualquer dado, fica null.
  const tmb      = (peso && altura && idade && sexo)
    ? Math.round(10*peso + 6.25*altura - 5*idade + (sexo === 'F' ? -161 : 5))
    : null;

  if (!email || !name || !password)
    return res.status(400).json({ error: 'email, nome e senha obrigatórios' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      `INSERT INTO users (email, name, password_hash, peso, ftp, altura, idade, sexo, tmb)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, email, name, role, points, level, peso, ftp, altura, idade, sexo, tmb`,
      [email.toLowerCase(), name, hash, peso, ftp, altura, idade, sexo, tmb]
    );
    const user = r.rows[0];
    // 02/10h: e-mail já cadastrado como financeiro de uma licença → vira o financeiro dela
    const finLic = await finLicencaDe(user.email).catch(() => null);
    if (finLic) { await finVincular(finLic, user.email, null); user.role = 'financeiro'; user.license_id = finLic; user.financeiro = true; }
    else { const gl = (await db.query('SELECT codigo FROM licencas WHERE LOWER(TRIM(email_gestor))=$1 ORDER BY id LIMIT 1', [user.email]).catch(() => ({ rows: [] }))).rows[0];
      if (gl) { await db.query(`UPDATE users SET role='gestor', license_id=$1 WHERE id=$2`, [gl.codigo, user.id]); user.role = 'gestor'; user.license_id = gl.codigo; } }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, license_id: user.license_id || undefined }, JWT_SECRET, { expiresIn: '30d' });
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
    const financeiro = !!(await finLicencaDe(user.email).catch(() => null));   // 02/10h: o e-mail do financeiro vai para a página de pagamento
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, license_id: user.license_id || null, points: user.points, level: user.level, sexo: user.sexo || null, financeiro, senha_provisoria: !!user.senha_provisoria }, token }); // 26/09b: sexo
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
      'SELECT id, email, name, role, license_id, points, level, peso, ftp, sexo, idade, altura, nascimento, created_at FROM users WHERE id=$1', // 26/09b: sexo; 26/09e: idade, altura, nascimento (Meu perfil do Portal)
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    const fin = await finLicencaDe(r.rows[0].email).catch(() => null);   // 03/10a: o app e o Portal mostram o atalho do pagamento
    res.json(Object.assign(r.rows[0], { financeiro: !!fin, financeiro_licenca: fin || null }));
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
  // Enviados pelo app desde a build 12/09b. Sem eles a caloria do historico
  // tinha de ser estimada pelo tempo. Opcionais: aula antiga grava 0.
  const watts_med = parseInt(req.body.watts_med) || 0;
  const rpm_med   = parseInt(req.body.rpm_med)   || 0;
  const kcal      = parseInt(req.body.kcal)      || 0;
  try {
    const pontos = calcPoints({ zona_predominante, badge, sem_pausas });
    await db.query(
      `INSERT INTO aulas_completadas
        (user_id, aula_nome, duracao_sec, pontos, zona_predominante,
         z1_pct, z2_pct, z3_pct, z4_pct, z5_pct, z6_pct, z7_pct,
         watts_med, rpm_medio, kcal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [req.user.id, aula_nome, duracao_sec, pontos, zona_predominante,
       zonas?.z1||0, zonas?.z2||0, zonas?.z3||0, zonas?.z4||0,
       zonas?.z5||0, zonas?.z6||0, zonas?.z7||0,
       watts_med, rpm_med, kcal]
    );
    // 26/09e: o Portal (dashboard, alunos, relatórios, ranking) lê de
    // aula_historico, mas o app só gravava em aulas_completadas — por isso o
    // gestor via tudo zerado. Agora grava nas duas.
    try {
      const _u = await db.query('SELECT ftp FROM users WHERE id=$1', [req.user.id]);
      const _ftp = (_u.rows[0] && parseInt(_u.rows[0].ftp)) || 0;
      const _avgFtp = (_ftp > 0 && watts_med > 0) ? Math.round(watts_med * 100 / _ftp) : 0;
      await db.query(
        `INSERT INTO aula_historico (user_id, nome, dur_seg, kcal, zona_pct, avg_ftp, avg_rpm, avg_watts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.user.id, aula_nome || 'Aula', parseInt(duracao_sec) || 0, kcal,
         JSON.stringify(zonas || {}), _avgFtp, rpm_med, watts_med]
      );
    } catch (e) { log('aula_historico (espelho) erro: ' + e.message); }
    // Atualizar pontos e nível do usuário
    const r = await db.query(
      'UPDATE users SET points=points+$1, updated_at=NOW() WHERE id=$2 RETURNING points',
      [pontos, req.user.id]
    );
    const newPoints = r.rows[0].points;
    const newLevel  = calcLevel(newPoints);
    await db.query('UPDATE users SET level=$1 WHERE id=$2', [newLevel, req.user.id]);
    res.json({ pontos_ganhos: pontos, total_pontos: newPoints, nivel: newLevel });
    // 26/09e: e-mail de resumo da aula (se a academia deixou ligado)
    emailResumoAula(req.user.id, { aula_nome, duracao_sec, kcal, watts_med, rpm_med, zona_predominante, pontos }).catch(() => {});
  } catch(e) {
    log('aula/complete error: ' + e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// 26/09e: trocar a própria senha (gestor que recebeu senha provisória, etc.)
app.put('/user/senha', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { senha_atual, nova } = req.body || {};
  if (!nova || String(nova).length < 6) return res.status(400).json({ error: 'A nova senha precisa de pelo menos 6 caracteres.' });
  if (req.user.impersonated_by) return res.status(403).json({ error: 'No modo suporte não dá para trocar a senha.' });
  try {
    const r = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!(await bcrypt.compare(String(senha_atual || ''), r.rows[0].password_hash || '')))
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    await db.query('UPDATE users SET password_hash=$1, senha_provisoria=FALSE, updated_at=NOW() WHERE id=$2', [await bcrypt.hash(String(nova), 10), req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});

// Atualizar perfil do usuário
app.put('/user/profile', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { name, email, peso, ftp, altura, idade, sexo, nascimento } = req.body;
  try {
    const fields = [], vals = [];
    let idx = 1;
    // 26/09e: FTP antigo, para o e-mail de "novo FTP" quando ele sobe
    let _ftpAntes = 0;
    try { const _a = await db.query('SELECT ftp FROM users WHERE id=$1', [req.user.id]); _ftpAntes = parseInt((_a.rows[0]||{}).ftp) || 0; } catch (e) {}
    if (nascimento && /^\d{4}-\d{2}-\d{2}$/.test(String(nascimento))) {
      fields.push(`nascimento=$${idx++}`); vals.push(nascimento);
      // idade acompanha a data de nascimento (o gasto calórico usa a idade)
      if (!(idade && parseInt(idade) > 0)) {
        const _n = new Date(nascimento + 'T12:00:00'), _h = new Date();
        let _id = _h.getFullYear() - _n.getFullYear();
        if (_h.getMonth() < _n.getMonth() || (_h.getMonth() === _n.getMonth() && _h.getDate() < _n.getDate())) _id--;
        if (_id > 0 && _id < 120) { fields.push(`idade=$${idx++}`); vals.push(_id); }
      }
    }
    if (name  && name.trim())        { fields.push(`name=$${idx++}`);  vals.push(name.trim()); }
    if (email && email.trim())       { fields.push(`email=$${idx++}`); vals.push(email.trim().toLowerCase()); }
    if (peso  && parseFloat(peso)>0) { fields.push(`peso=$${idx++}`);  vals.push(parseFloat(peso)); }
    if (ftp   && parseFloat(ftp)>0)  { fields.push(`ftp=$${idx++}`);   vals.push(parseFloat(ftp)); }
    if (altura && parseInt(altura)>0){ fields.push(`altura=$${idx++}`);vals.push(parseInt(altura)); }
    if (idade  && parseInt(idade)>0) { fields.push(`idade=$${idx++}`); vals.push(parseInt(idade)); }
    if (sexo === 'M' || sexo === 'F'){ fields.push(`sexo=$${idx++}`);  vals.push(sexo); }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    fields.push(`updated_at=NOW()`);
    vals.push(req.user.id);
    const r = await db.query(
      `UPDATE users SET ${fields.join(',')} WHERE id=$${idx}
       RETURNING id, email, name, role, points, level, peso, ftp, altura, idade, sexo, tmb, nascimento`,
      vals
    );
    if (r.rows[0] && _ftpAntes > 0 && parseInt(r.rows[0].ftp) > _ftpAntes)
      emailNovoFtp(req.user.id, _ftpAntes, parseInt(r.rows[0].ftp)).catch(() => {});
    // Mexeu em peso, altura, idade ou sexo -> o basal guardado ficou velho.
    const u = r.rows[0];
    if (u.peso && u.altura && u.idade && u.sexo) {
      const novoTmb = Math.round(10*u.peso + 6.25*u.altura - 5*u.idade + (u.sexo === 'F' ? -161 : 5));
      if (novoTmb !== u.tmb) {
        await db.query('UPDATE users SET tmb=$1 WHERE id=$2', [novoTmb, u.id]);
        u.tmb = novoTmb;
      }
    }
    res.json({ user: u });
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

// Atualizar role/license_id de um usuário (super_admin)
app.put('/admin/users/:id', authMiddleware, requireRole('super_admin'), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco não disponível' });
  const { role, license_id, name } = req.body;
  const allowed = ['aluno','professor','gestor','financeiro','admin','super_admin','coordenador'];
  if (role && !allowed.includes(role)) return res.status(400).json({ error: 'Role inválida' });
  try {
    const sets = [], vals = [];
    if (role)       { sets.push(`role=$${sets.length+1}`);       vals.push(role); }
    if (license_id !== undefined) { sets.push(`license_id=$${sets.length+1}`); vals.push(license_id || null); }
    if (name)       { sets.push(`name=$${sets.length+1}`);       vals.push(name); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
    vals.push(req.params.id);
    const r = await db.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING id,email,name,role,license_id`, vals);
    if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(r.rows[0]);
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
  // batimento: marcado vivo ao conectar e a cada resposta de ping
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.tipo) {

      case 'criar_sala': {
        const codigo = msg.codigo;
        if (!codigo) return;
        // 26/09b — RECONEXAO DO GINASIO NAO APAGA A SALA.
        // Antes, todo 'criar_sala' trocava a sala por uma nova e vazia. Quando a
        // conexao do Ginasio caia e voltava (poucos segundos), os alunos ficavam
        // fora do mapa da sala: o celular continuava "conectado", mas nao recebia
        // mais nada (bloco parado, sem reconexao), e a bike dele seguia ocupada
        // na TV. Agora, se a sala ja existe, so o professor e trocado e os alunos
        // continuam. A resposta leva a lista de quem esta na sala, para o Ginasio
        // conferir (depois de um reinicio do servidor a lista vem vazia).
        const existente = salas[codigo];
        if (existente) {
          existente.professor = ws;
          existente.profCaiuEm = null;
          for (const [n, aws] of existente.alunos) { if (aws.readyState !== WebSocket.OPEN) existente.alunos.delete(n); }
          log(`Sala retomada: ${codigo} (${existente.alunos.size} alunos continuam)`);
        } else {
          salas[codigo] = { professor: ws, alunos: new Map(), observadores: new Set(), lastSalaInfo: null, trancadas: new Set(), estado: { iniciada: false, grafico: [], blocoIdx: 0, nomeAula: '' } };
          log(`Sala criada: ${codigo}`);
        }
        ws._salaCode = codigo; ws._tipo = 'professor';
        // 26/09e: o Ginasio manda o token do display; a sala fica sabendo de
        // que licenca e. Serve para ligar o aluno a academia (ver entrar_sala).
        if (msg.display_token) {
          try { const _dp = jwt.verify(msg.display_token, JWT_SECRET); if (_dp && _dp.license_id) salas[codigo].licenca = _dp.license_id; } catch (e) {}
        }
        const _lista = [...salas[codigo].alunos.entries()].map(([n, aws]) => ({ nome: n, bike: aws._bikeNum || null }))
          .concat([...(salas[codigo].totem || new Map()).entries()].map(([n, t]) => ({ nome: n, bike: t.bike, totem: true })));
        ws.send(JSON.stringify({ tipo: 'sala_criada', codigo, retomada: !!existente, alunos: _lista }));
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

        // ── 24/09: TETO DA SALA = BIKES DA LICENCA ──────────────────────
        // O Ginasio manda numBikes no sala_info ja limitado pela licenca.
        // 1) bike acima do numero da sala (exceto a 99, do professor) e recusada;
        // 2) quem entra SEM bike da sala (de casa, no rolo) tambem tem teto:
        //    o mesmo numero de bikes da licenca (decisao do Mario).
        const _tetoSala = (sala.lastSalaInfo && parseInt(sala.lastSalaInfo.numBikes)) || 0;
        const _bikeN = bike ? Number(bike) : 0;
        if (_tetoSala > 0 && _bikeN && _bikeN !== 99 && _bikeN > _tetoSala) {
          ws.send(JSON.stringify({ tipo: 'erro', msg: `Esta sala tem ${_tetoSala} bikes. Escolha uma bike de 1 a ${_tetoSala}.` }));
          return;
        }
        const _remoto = (msg.remoto === true) || !_bikeN;
        if (_remoto && _tetoSala > 0) {
          let _emCasa = 0;
          for (const [n, aws] of sala.alunos) { if (n !== nome && aws._remoto && aws.readyState === WebSocket.OPEN) _emCasa++; }
          if (_emCasa >= _tetoSala) {
            ws.send(JSON.stringify({ tipo: 'erro', msg: `Aula de casa cheia — limite de ${_tetoSala} pessoas pedalando de casa.` }));
            return;
          }
        }
        ws._remoto = _remoto;

        // Recusar bike trancada
        if (bike && sala.trancadas && sala.trancadas.has(Number(bike))) {
          ws.send(JSON.stringify({ tipo: 'erro', msg: `Bike ${bike} está em manutenção. Escolha outra posição.` }));
          return;
        }
        // 26/09b: o mesmo aluno entrando de novo (app reaberto, rede trocada)
        // substitui a conexao antiga em vez de ficar com duas. A antiga e
        // fechada; o 'close' dela nao tira o aluno da sala (ver ws.on('close')).
        const _antigo = sala.alunos.get(nome);
        if (_antigo && _antigo !== ws) { try { _antigo._substituido = true; _antigo.close(4000, 'substituido'); } catch (e) {} }
        sala.alunos.set(nome, ws);
        // 26/09e: aluno sem academia passa a ser da academia desta sala.
        // Assim ele aparece na lista de alunos do gestor sem cadastro manual.
        // Nunca troca quem ja tem academia, nem professor/gestor.
        if (db && sala.licenca && user_id) {
          db.query("UPDATE users SET license_id=$1, updated_at=NOW() WHERE id=$2 AND (license_id IS NULL OR license_id='') AND role='aluno' RETURNING id, name, email",
                   [sala.licenca, parseInt(user_id)])
            .then(async (r) => {
              if (!r.rows.length) return;
              const u = r.rows[0];
              const l = await db.query('SELECT nome FROM licencas WHERE codigo=$1', [sala.licenca]);
              emailBoasVindas({ userId: u.id, email: u.email, nome: u.name, academia: (l.rows[0] || {}).nome, licId: sala.licenca, papel: 'aluno' }).catch(() => {});
            }).catch(() => {});
        }
        sala.observadores.delete(ws); // se estava só observando o mapa, agora é participante
        ws._salaCode = codigo; ws._tipo = 'aluno'; ws._nome = nome; ws._bike = bike || null; ws._bikeNum = bike ? Number(bike) : null;
        ws._userId = user_id ? (parseInt(user_id, 10) || null) : null;   // 01/10a: campeonato liga o resultado à conta
        // 01/10b: quem reservou e entrou: reserva vira 'presente' na bike em que sentou
        if (ws._userId && db && sala.licenca) {
          const { iso } = _hojeBR();
          db.query(`UPDATE aulas_reservas r SET status='presente', bike_numero=COALESCE($1, r.bike_numero) FROM aulas_agenda a
            WHERE r.agenda_id=a.id AND a.license_id=$2 AND r.user_id=$3 AND r.data_aula=$4 AND r.status='reservado'`,
            [(_bikeN && _bikeN !== 99) ? _bikeN : null, sala.licenca, ws._userId, iso]).catch(() => {});
        }
        // 01/10a: camisa do aluno (a que veste no campeonato ou a que conquistou) vai para a TV
        if (ws._userId && db) campCamisaDestaque(ws._userId).then(cm => {
          if (cm && sala.professor && sala.professor.readyState === WebSocket.OPEN) sala.professor.send(JSON.stringify({ tipo: 'aluno_camisa', nome, camisa: cm }));
        }).catch(() => {});
        log(`Aluno entrou: ${nome} na sala ${codigo}`);
        if (sala.professor && sala.professor.readyState === WebSocket.OPEN) {
          sala.professor.send(JSON.stringify({ tipo: 'aluno_conectou', nome, bike: bike || null, foto: msg.foto || null, ftpBase: (msg.ftpBase != null ? msg.ftpBase : null), genero: ((msg.genero === 'F' || msg.genero === 'M') ? msg.genero : null), nivel: (typeof msg.nivel === 'string' ? msg.nivel.slice(0, 20) : null), horario: new Date().toLocaleTimeString('pt-BR') })); // 29/09a: nivel = brasão // 26/09b: genero para o desafio Homens x Mulheres
        }
        ws.send(JSON.stringify({ tipo: 'conectado', codigo, nome }));
        ws.send(JSON.stringify({ tipo: 'entrou_sala', codigo, nome }));
        // 26/09d: a aula desta sala ja foi encerrada (o celular perdeu o aviso
        // ou esta reentrando): manda o fim de novo, para o app fechar a aula.
        if (sala.estado.encerrada && !sala.estado.iniciada) ws.send(JSON.stringify({ tipo: 'fim_aula' }));
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

      // Mapa da sala (bikes válidas + ocupadas) — vem do ginásio a cada mudança.
      // Faz fan-out para TODOS que olham a sala: alunos logados + observadores (QR da porta).
      case 'sala_info': {
        const salaCode = ws._salaCode; // socket do professor
        if (!salaCode || !salas[salaCode]) return;
        const sala = salas[salaCode];
        const info = { tipo: 'sala_info', numBikes: msg.numBikes || 0, bikes: msg.bikes || [], ocupadas: msg.ocupadas || [], ocupantes: (msg.ocupantes && typeof msg.ocupantes === 'object') ? msg.ocupantes : {}, trancadas: [...(sala.trancadas || [])] }; // 26/09b: ocupantes = {bike: nome}
        sala.lastSalaInfo = info; // cache: novo observador recebe o mapa na hora
        // 29/09a: nome/professor da aula escolhida na pré-aula (faixa verde do app e totem)
        // Nova pré-aula depois de uma aula encerrada (mesma sala): volta a
        // valer como aula aberta para a faixa verde e o totem.
        if (msg.aula && typeof msg.aula === 'object' && sala.estado.encerrada && Date.now() - (sala.fimEm || 0) > 60000) sala.estado.encerrada = false;
        if (msg.aula && typeof msg.aula === 'object')
          sala.preAula = { nome: String(msg.aula.nome || '').slice(0, 80), professor: String(msg.aula.professor || '').slice(0, 80), duracao_min: parseInt(msg.aula.duracao_min) || null, desde: sala.preAula ? sala.preAula.desde : Date.now() };
        const data = JSON.stringify(info);
        for (const [, aws] of sala.alunos) { if (aws.readyState === WebSocket.OPEN) aws.send(data); }
        for (const ows of sala.observadores) { if (ows.readyState === WebSocket.OPEN) ows.send(data); }
        break;
      }

      // Observador: escaneou o QR fixo da porta e quer só VER o mapa ao vivo (sem entrar).
      // 02/10b: TRANSMISSÃO NO APP (WebRTC). A TV manda o vídeo direto para
      // cada celular; o servidor só passa os recados (oferta, resposta, ICE).
      case 'tx_estado': {
        const sala = ws._salaCode && salas[ws._salaCode]; if (!sala || ws._tipo !== 'professor') break;
        sala.tx = { ativo: !!msg.ativo, max: Math.max(1, Math.min(30, parseInt(msg.max, 10) || 15)) };
        if (!sala.txv) sala.txv = new Map();
        if (!sala.tx.ativo) { for (const [, v] of sala.txv) { try { v.send(JSON.stringify({ tipo: 'tx_estado', ativo: false })); } catch (e) {} } sala.txv.clear(); }
        const t = JSON.stringify({ tipo: 'tx_estado', ativo: sala.tx.ativo });
        for (const [, aws] of sala.alunos) { if (aws.readyState === WebSocket.OPEN) { try { aws.send(t); } catch (e) {} } }
        log(`Transmissão ${sala.tx.ativo ? 'ligada' : 'desligada'} na sala ${ws._salaCode}`);
        break;
      }
      case 'tx_ver': {
        const cod = String(msg.codigo || ''), sala = salas[cod];
        if (!sala || !sala.tx || !sala.tx.ativo || !sala.professor || sala.professor.readyState !== WebSocket.OPEN) { ws.send(JSON.stringify({ tipo: 'tx_erro', msg: 'Esta aula não está sendo transmitida agora.' })); break; }
        if (!sala.txv) sala.txv = new Map();
        for (const [k, v] of sala.txv) { if (v.readyState !== WebSocket.OPEN) sala.txv.delete(k); }
        if (sala.txv.size >= sala.tx.max) { ws.send(JSON.stringify({ tipo: 'tx_erro', msg: `A transmissão está cheia (${sala.tx.max} pessoas). Tente daqui a pouco.` })); break; }
        ws._txSala = cod; ws._txId = 'v' + Math.random().toString(36).slice(2, 10);
        sala.txv.set(ws._txId, ws);
        sala.professor.send(JSON.stringify({ tipo: 'tx_novo', vid: ws._txId, nome: String(msg.nome || '').slice(0, 40), tv: !!msg.tv }));   // 02/10j: TV de outra academia recebe a câmera limpa
        ws.send(JSON.stringify({ tipo: 'tx_ok', vid: ws._txId }));
        break;
      }
      case 'tx_sinal': {
        if (ws._tipo === 'professor') {
          const sala = salas[ws._salaCode]; const v = sala && sala.txv && sala.txv.get(String(msg.vid || ''));
          if (v && v.readyState === WebSocket.OPEN) v.send(JSON.stringify({ tipo: 'tx_sinal', dado: msg.dado }));
        } else if (ws._txId && salas[ws._txSala]) {
          const pr = salas[ws._txSala].professor;
          if (pr && pr.readyState === WebSocket.OPEN) pr.send(JSON.stringify({ tipo: 'tx_sinal', vid: ws._txId, dado: msg.dado }));
        }
        break;
      }

      // 02/10a: placar ao vivo do desafio entre academias (TV ↔ TVs das outras academias)
      case 'duelo_entrar': { daDueloEntrar(ws, msg).catch(() => {}); break; }
      case 'duelo_placar': { daDueloPlacar(ws, msg); break; }

      case 'assinar_sala': {
        const codigo = msg.codigo;
        if (!codigo) return;
        const sala = salas[codigo];
        if (!sala) { ws.send(JSON.stringify({ tipo: 'erro', msg: 'Sala nao encontrada' })); return; }
        ws._salaCode = codigo; ws._tipo = 'observador';
        sala.observadores.add(ws);
        ws.send(JSON.stringify({ tipo: 'assinado', codigo }));
        if (sala.lastSalaInfo) {
          ws.send(JSON.stringify(sala.lastSalaInfo)); // mapa atual na hora (cache)
        } else if (sala.professor && sala.professor.readyState === WebSocket.OPEN) {
          sala.professor.send(JSON.stringify({ tipo: 'pedir_sala_info' })); // pede ao ginásio se ainda não há cache
        }
        break;
      }

      // ── Controle da sala pelo professor ──────────────────────────────

      case 'prof_remover_aluno': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode] || ws._tipo !== 'professor') return;
        const sala = salas[salaCode];
        const bikeAlvo = msg.bike;
        const motivo = msg.motivo || 'O professor liberou esta bike.';
        // encontrar o aluno pela bike
        let alunoWs = null, alunoNome = null;
        for (const [nome, aws] of sala.alunos) {
          if (aws._bike == bikeAlvo || aws._bikeNum == bikeAlvo) { alunoWs = aws; alunoNome = nome; break; }
        }
        if (alunoWs && alunoWs.readyState === WebSocket.OPEN) {
          alunoWs.send(JSON.stringify({ tipo: 'removido_da_bike', motivo, pode_reentrar: true }));
          alunoWs._bike = null; alunoWs._bikeNum = null;
        }
        // notificar o ginásio
        ws.send(JSON.stringify({ tipo: 'aluno_removido', bike: bikeAlvo, nome: alunoNome }));
        log(`[sala ${salaCode}] prof removeu aluno da bike ${bikeAlvo}`);
        break;
      }

      case 'prof_trocar_bikes': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode] || ws._tipo !== 'professor') return;
        const sala = salas[salaCode];
        const { de, para } = msg;
        let wsA = null, nomeA = null, wsB = null, nomeB = null;
        for (const [nome, aws] of sala.alunos) {
          if (aws._bike == de   || aws._bikeNum == de)   { wsA = aws; nomeA = nome; }
          if (aws._bike == para || aws._bikeNum == para) { wsB = aws; nomeB = nome; }
        }
        if (wsA) { wsA._bike = para; wsA._bikeNum = para; wsA.send(JSON.stringify({ tipo: 'bike_trocada', bike: para, motivo: 'O professor trocou o seu lugar.' })); }
        if (wsB) { wsB._bike = de;   wsB._bikeNum = de;   wsB.send(JSON.stringify({ tipo: 'bike_trocada', bike: de,   motivo: 'O professor trocou o seu lugar.' })); }
        ws.send(JSON.stringify({ tipo: 'bikes_trocadas', de, para, nomeA, nomeB }));
        log(`[sala ${salaCode}] prof trocou bikes ${de} ↔ ${para}`);
        break;
      }

      case 'prof_trancar_bike': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode] || ws._tipo !== 'professor') return;
        const sala = salas[salaCode];
        const { bike, trancar, motivo: motivoTrancar } = msg;
        if (trancar) sala.trancadas.add(bike); else sala.trancadas.delete(bike);
        // reenviar sala_info com lista atualizada
        const infoAtualizada = sala.lastSalaInfo
          ? { ...sala.lastSalaInfo, trancadas: [...sala.trancadas] }
          : { tipo: 'sala_info', numBikes: 0, bikes: [], ocupadas: [], trancadas: [...sala.trancadas] };
        sala.lastSalaInfo = infoAtualizada;
        const dataInfo = JSON.stringify(infoAtualizada);
        for (const [, aws] of sala.alunos) { if (aws.readyState === WebSocket.OPEN) aws.send(dataInfo); }
        for (const ows of sala.observadores) { if (ows.readyState === WebSocket.OPEN) ows.send(dataInfo); }
        ws.send(JSON.stringify({ tipo: 'bike_trancada', bike, trancada: trancar }));
        log(`[sala ${salaCode}] prof ${trancar ? 'trancou' : 'destrancou'} bike ${bike}`);
        break;
      }

      // ─────────────────────────────────────────────────────────────────

      // Dados ao vivo de todas as bikes (~4 Hz) — cada aluno filtra a sua pelo número.
      case 'bikes_live': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        broadcastAlunos(salaCode, msg);
        break;
      }

      // 02/10f: aula recomeçada (aula em rede, primeiros 5 min): os celulares zeram a largada
      case 'aula_reiniciada': {
        const sala = ws._salaCode && salas[ws._salaCode]; if (!sala || ws._tipo !== 'professor') break;
        sala.estado.iniciada = false;
        broadcastAlunos(ws._salaCode, { tipo: 'aula_reiniciada' });
        log(`Aula recomeçada na sala ${ws._salaCode}`);
        break;
      }
      case 'iniciar_aula': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        const sala = salas[salaCode];
        sala.estado.iniciada = true; sala.estado.encerrada = false;
        sala.estado.grafico  = msg.grafico || [];
        sala.estado.blocoIdx = msg.blocoIdx || 0;
        sala.estado.nomeAula = msg.nomeAula || '';
        log(`Aula iniciada na sala ${salaCode}`);
        broadcastAlunos(salaCode, { tipo: 'aula_iniciada', grafico: sala.estado.grafico, blocoIdx: sala.estado.blocoIdx, nomeAula: sala.estado.nomeAula });

        // Temporizador de 10 min: reservas ainda em 'reservado' viram 'ausente'
        if (db) {
          setTimeout(async () => {
            try {
              const sv = await db.query(
                "SELECT agenda_id FROM sessoes_ao_vivo WHERE token=$1 AND status='em_andamento'",
                [salaCode]
              );
              if (!sv.rows.length || !sv.rows[0].agenda_id) return;
              const agendaId = sv.rows[0].agenda_id;
              const r = await db.query(
                "UPDATE aulas_reservas SET status='ausente' WHERE agenda_id=$1 AND data_aula=CURRENT_DATE AND status='reservado'",
                [agendaId]
              );
              if (r.rowCount > 0) log(`[timer] ${r.rowCount} reserva(s) marcada(s) ausente — sala ${salaCode}`);
            } catch(e) { log(`[timer] erro ao marcar ausentes: ${e.message}`); }
          }, 10 * 60 * 1000);
        }
        break;
      }

      case 'dados_aula':
      case 'update_aula': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        const sala = salas[salaCode];
        sala.estado.encerrada = false; // 26/09d: aula correndo de novo
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

      // 26/09d — RESULTADO DO TESTE DE FTP PARA O CELULAR DE CADA ALUNO.
      // O Ginasio sempre mandou 'ftp_resultado' (um por aluno), mas o servidor
      // nao tinha este caso: a mensagem era descartada e o FTP nunca chegava ao
      // app. Vai so para o aluno do nome indicado.
      case 'ftp_resultado': {
        const salaCodeR = ws._salaCode;
        if (!salaCodeR || !salas[salaCodeR] || ws._tipo !== 'professor') return;
        const alvo = salas[salaCodeR].alunos.get(msg.nome);
        if (alvo && alvo.readyState === WebSocket.OPEN) {
          alvo.send(JSON.stringify({ tipo: 'ftp_resultado', nome: msg.nome, ftp: msg.ftp, ant: msg.ant != null ? msg.ant : null, protocolo: msg.protocolo || null }));
          log(`FTP ${msg.ftp}W enviado para ${msg.nome} (sala ${salaCodeR})`);
        }
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
        salas[salaCode].estado.encerrada = true;   // 26/09d: quem (re)entrar depois recebe o fim
        salas[salaCode].fimEm = Date.now(); salas[salaCode].totem = new Map(); salas[salaCode].preAula = null; // 29/09a
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
    try { daDueloSair(ws); } catch (e) {}
    if (ws._txId && salas[ws._txSala]) {   // 02/10b: quem assistia saiu
      const sl = salas[ws._txSala]; if (sl.txv) sl.txv.delete(ws._txId);
      if (sl.professor && sl.professor.readyState === WebSocket.OPEN) { try { sl.professor.send(JSON.stringify({ tipo: 'tx_saiu', vid: ws._txId })); } catch (e) {} }
    }
    const salaCode = ws._salaCode;
    if (!salaCode || !salas[salaCode]) return;
    const sala = salas[salaCode];
    if (ws._tipo === 'professor') {
      // ── QUEDA DO PROFESSOR NAO ENCERRA A SALA ────────────────────
      // Antes, qualquer fechamento da conexao do professor apagava a sala NA
      // HORA e avisava os alunos que ela tinha acabado. Uma queda de poucos
      // segundos — proxy, wi-fi, rede suspendendo — destruia a aula em curso.
      // Era ESTE o caminho por tras do "Sala nao encontrada"; a carencia que eu
      // tinha posto na limpeza periodica nao cobria ele.
      // Agora a queda apenas marca a hora. Quem decide apagar e a limpeza
      // periodica, depois de 3 minutos sem professor — e e ela que avisa os
      // alunos. Se o professor voltar antes disso, ninguem percebe nada.
      // Encerramento DELIBERADO continua imediato: vem pela mensagem
      // 'fim_aula', tratada acima, nao por aqui.
      if (sala.professor && sala.professor !== ws) return; // 26/09b: conexao antiga; o Ginasio ja voltou por outra
      log(`Professor caiu da sala ${salaCode} — aguardando ate 3 min antes de encerrar`);
      sala.profCaiuEm = Date.now();
    } else if (ws._tipo === 'aluno' && ws._nome) {
      // 26/09b: so tira o aluno se ESTA conexao ainda e a dele. Se ele ja
      // entrou de novo por outra, a antiga fechando nao pode derruba-lo.
      if (sala.alunos.get(ws._nome) !== ws) return;
      sala.alunos.delete(ws._nome);
      log(`Aluno saiu: ${ws._nome}`);
      if (sala.professor && sala.professor.readyState === WebSocket.OPEN)
        sala.professor.send(JSON.stringify({ tipo: 'aluno_saiu', nome: ws._nome }));
    } else if (ws._tipo === 'observador') {
      sala.observadores.delete(ws);
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
        (SELECT COUNT(*) FROM users u WHERE u.license_id=l.codigo AND u.role='professor') AS total_profs,
        -- 26/09e: versão do Ginásio (TV) e última aula, para o super admin
        (SELECT lc.build FROM licenca_computadores lc WHERE lc.license_codigo=l.codigo ORDER BY lc.visto_em DESC LIMIT 1) AS ginasio_build,
        (SELECT MAX(lc.visto_em) FROM licenca_computadores lc WHERE lc.license_codigo=l.codigo) AS ginasio_visto,
        (SELECT MAX(ah.data_aula) FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=l.codigo) AS ultima_aula,
        (SELECT u.name FROM users u WHERE u.license_id=l.codigo AND u.role='gestor' ORDER BY u.id LIMIT 1) AS gestor_nome
      FROM licencas l ORDER BY l.created_at DESC
    `);
    res.json(r.rows.map(l => ({ ...l, ...finResumo(l), status_pagamento: finSituacao(l), vencimento: isoDia(l.vencimento) })));   // 03/10a: situação única
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/licencas', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs, valor_mensal, vencimento, obs, max_bikes } = req.body;
  if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
  // 24/09: licenca nasce com o numero de bikes vendido — minimo 10
  const _mb = _validaMaxBikes(max_bikes);
  if (!_mb.ok) return res.status(400).json({ error: _mb.erro });
  if (_mb.valor === null) return res.status(400).json({ error: `Informe quantas bikes foram vendidas (mínimo ${MIN_BIKES_LICENCA}).` });
  const codigo = shortId().substring(0, 8).toUpperCase();
  try {
    const r = await db.query(
      `INSERT INTO licencas (codigo, nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs, valor_mensal, vencimento, obs, max_bikes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [codigo, nome, contato_nome||null, contato_email||null, contato_tel||null,
       plano||'basico', max_alunos||30, max_profs||2,
       valor_mensal||0, vencimento||null, obs||null, _mb.valor]
    );
    // bikes disponiveis comecam iguais ao vendido
    try { await db.query('UPDATE licencas SET bikes_disponiveis=max_bikes WHERE id=$1', [r.rows[0].id]); r.rows[0].bikes_disponiveis = r.rows[0].max_bikes; } catch(_e) {}
    // 26/09e: endereço já na criação (antes só dava para pôr editando)
    const b = req.body || {};
    try {
      await db.query(`UPDATE licencas SET logradouro=$1, numero=$2, bairro=$3, cep=$4, cidade_lic=$5, estado=$6, pais=$7, cidade=COALESCE($5, cidade), email_gestor=$8 WHERE id=$9`,
        [b.logradouro||null, b.numero||null, b.bairro||null, b.cep||null, b.cidade_lic||null, b.estado||null, b.pais||'Brasil',
         (b.gestor_email||'').trim().toLowerCase() || null, r.rows[0].id]);
    } catch(_e) { log('licenca endereço: ' + _e.message); }
    geoAtualizarPorEndereco(r.rows[0].id, false).catch(() => {}); // 29/09c
    // 26/09e → 03/10a: gestor e financeiro pela mesma função (conta nova = senha provisória + e-mail com a senha)
    const out = { ...r.rows[0] };
    try { await db.query('UPDATE licencas SET dia_vencimento=COALESCE(EXTRACT(DAY FROM vencimento)::smallint, dia_vencimento) WHERE id=$1', [out.id]); } catch (_e) {}
    const enviar = b.enviar_email !== false;
    const gEmail = String(b.gestor_email || '').trim().toLowerCase();
    if (gEmail) { try { out.gestor = await acessoVincular(codigo, 'gestor', gEmail, b.gestor_nome || contato_nome, nome, null, enviar); } catch (_e) { out.gestor_erro = _e.message; } }
    const fEmail = String(b.financeiro_email || '').trim().toLowerCase();
    if (fEmail) { try {
      await db.query('UPDATE licencas SET financeiro_email=$1, financeiro_nome=$2 WHERE id=$3', [fEmail, b.financeiro_nome || null, out.id]);
      out.financeiro = (fEmail === gEmail && out.gestor) ? Object.assign({}, out.gestor, { mesmo_do_gestor: true }) : await acessoVincular(codigo, 'financeiro', fEmail, b.financeiro_nome, nome, null, enviar);
    } catch (_e) { out.financeiro_erro = _e.message; } }
    out.email_enviado = !!((out.gestor && out.gestor.email_enviado) || (out.financeiro && out.financeiro.email_enviado));
    res.json(out);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/admin/licencas/:id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs,
          valor_mensal, vencimento, status, obs, max_bikes,
          logradouro, numero, bairro, cep, cidade_lic, estado, pais } = req.body;
  const _mb = _validaMaxBikes(max_bikes);
  if (!_mb.ok) return res.status(400).json({ error: _mb.erro });
  try {
    const _antes = await db.query('SELECT * FROM licencas WHERE id=$1', [req.params.id]);
    const r = await db.query(
      `UPDATE licencas SET nome=$1, contato_nome=$2, contato_email=$3, contato_tel=$4,
       plano=$5, max_alunos=$6, max_profs=$7, valor_mensal=$8, vencimento=$9,
       status=COALESCE(NULLIF($10,'trial'), status, 'ativa'), obs=$11, max_bikes=COALESCE($12, max_bikes),
       logradouro=$13, numero=$14, bairro=$15, cep=$16, cidade_lic=$17, estado=$18, pais=$19,
       cidade=COALESCE($17, cidade),
       updated_at=NOW() WHERE id=$20 RETURNING *`,
      [nome, contato_nome, contato_email, contato_tel, plano, max_alunos, max_profs,
       valor_mensal, vencimento, status, obs, _mb.valor,
       logradouro||null, numero||null, bairro||null, cep||null, cidade_lic||null, estado||null, pais||'Brasil',
       req.params.id]
    );
    // disponiveis nunca acima do vendido (24/09)
    try { await db.query('UPDATE licencas SET bikes_disponiveis=LEAST(COALESCE(NULLIF(bikes_disponiveis,0), max_bikes), max_bikes) WHERE id=$1', [req.params.id]); } catch(_e) {}
    // 03/10a: mudou o vencimento ou o valor -> a situação e a fatura do Asaas acompanham
    { const A = _antes.rows[0] || {}, N = r.rows[0] || {};
      const vMudou = isoDia(A.vencimento) !== isoDia(N.vencimento), $Mudou = Number(A.valor_mensal) !== Number(N.valor_mensal);
      if (N.codigo && vMudou && N.vencimento) {
        await db.query('UPDATE licencas SET pagamento_ok_ate=CASE WHEN pagamento_ok_ate IS NOT NULL THEN vencimento ELSE NULL END WHERE id=$1', [N.id]);
        log(`[Pagamento] ${N.codigo}: vencimento mudado pelo admin ${isoDia(A.vencimento)} → ${isoDia(N.vencimento)}`);
      }
      if (N.codigo && (vMudou || $Mudou)) { Object.assign(N, await pgSituacao(N.codigo)); N.asaas = await asaasSyncLic(N.codigo); }
      if (N.codigo) Object.assign(N, finResumo(N), { vencimento: isoDia(N.vencimento) }); }
    // 02/10l: gestor e financeiro definidos aqui (cada um com o seu e-mail)
    { const A = _antes.rows[0] || {}, N = r.rows[0] || {}, b2 = req.body || {}, low = v => String(v || '').trim().toLowerCase();
      try {
        if (N.codigo && b2.gestor_email !== undefined && low(b2.gestor_email) !== low(A.email_gestor)) {
          await db.query('UPDATE licencas SET email_gestor=$1 WHERE id=$2', [low(b2.gestor_email) || null, N.id]);
          N.gestor_acesso = await acessoVincular(N.codigo, 'gestor', b2.gestor_email, b2.gestor_nome || contato_nome, N.nome_fantasia || N.nome, A.email_gestor);
        }
        if (N.codigo && b2.financeiro_email !== undefined) {
          await db.query('UPDATE licencas SET financeiro_email=$1, financeiro_nome=$2 WHERE id=$3', [low(b2.financeiro_email) || null, b2.financeiro_nome || null, N.id]);
          if (low(b2.financeiro_email) !== low(A.financeiro_email))
            N.financeiro_acesso = (N.gestor_acesso && low(b2.financeiro_email) === low(b2.gestor_email)) ? Object.assign({}, N.gestor_acesso, { mesmo_do_gestor: true })
              : await acessoVincular(N.codigo, 'financeiro', b2.financeiro_email, b2.financeiro_nome, N.nome_fantasia || N.nome, A.financeiro_email);
        }
      } catch (e) { N.acesso_erro = e.message; } }
    // 29/09c: endereço mudou (ou ainda sem localização) -> procura no mapa
    { const A = _antes.rows[0] || {}, N = r.rows[0] || {};
      const mudou = ['logradouro', 'numero', 'bairro', 'cep', 'cidade_lic', 'estado'].some(k => String(A[k] || '') !== String(N[k] || ''));
      if (N.id && (mudou || N.lat === null)) geoAtualizarPorEndereco(N.id, false).catch(() => {}); }
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/licencas/:id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    // 03/10a: licença apagada não pode continuar cobrando o cartão
    const l = (await db.query('SELECT codigo, asaas_sub FROM licencas WHERE id=$1', [req.params.id])).rows[0];
    let asaas = null;
    if (l && l.asaas_sub && ASAAS_API_KEY) {
      try { await asaasApi('DELETE', '/subscriptions/' + l.asaas_sub); asaas = 'assinatura cancelada no Asaas'; log(`[Asaas] assinatura ${l.asaas_sub} cancelada (licença ${l.codigo} excluída)`); }
      catch (e) { return res.status(502).json({ error: 'Não consegui cancelar a assinatura no Asaas (' + e.message + '). Cancele lá e tente excluir de novo.' }); }
    }
    await db.query('DELETE FROM licencas WHERE id=$1', [req.params.id]);
    res.json({ ok: true, asaas });
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
  if (!setupKeyOk(req.headers['x-setup-key'])) return res.status(404).json({ error: 'Não encontrado' });
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
  if (!setupKeyOk(req.headers['x-setup-key'])) return res.status(404).json({ error: 'Não encontrado' });
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

// ── 03/10a: PAGAMENTO — UMA REGRA SÓ ─────────────────────────────────
// licencas.vencimento       = PRÓXIMO vencimento (a data que falta pagar). O admin edita.
// licencas.pagamento_ok_ate = pago até (NULL = nunca pagou). É o que trava a TV (+5 dias).
// pagamentos                = livro-caixa: cada linha confirmada cobre [venc_ref, cobre_ate).
//   origem 'asaas'  → veio do webhook (cartão, ou "recebido em dinheiro" marcado no Asaas)
//   origem 'manual' → dinheiro recebido POR FORA (PIX/dinheiro/transferência). Não cobra cartão.
// Qualquer mudança no livro chama pgRecalc(), que recalcula a licença inteira.
function dataSP(d) { return new Date((d ? new Date(d).getTime() : Date.now()) - 3 * 3600000).toISOString().slice(0, 10); }  // "hoje" em São Paulo
function isoDia(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;  // o pg monta DATE à meia-noite local
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null;
}
function maisMes(iso, n = 1) {   // 31/01 + 1 mês = 28/02 (nunca pula mês)
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1)), ult = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, ult)); return t.toISOString().slice(0, 10);
}
function diasEntre(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
// Próximo vencimento: o que o admin pôs na licença; senão "pago até"; senão o próximo "dia X".
function proxVenc(l) {
  const v = isoDia(l.vencimento) || isoDia(l.pagamento_ok_ate);
  if (v) return v;
  const hoje = dataSP(), dia = Math.min(28, Math.max(1, parseInt(l.dia_vencimento) || 10));
  let c = hoje.slice(0, 8) + String(dia).padStart(2, '0');
  return c < hoje ? maisMes(c) : c;
}
const SUSPENDE_APOS_DIAS = 5;
// Situação única (admin, dashboard, página do financeiro e TV usam esta):
//  em_dia · a_vencer (nunca pagou, 1º vencimento ainda não chegou) · vencido (até 5 dias) · suspenso (TV trava)
function finSituacao(l) {
  if (l.status === 'suspensa') return 'suspenso';
  const hoje = dataSP(), ok = isoDia(l.pagamento_ok_ate), pv = proxVenc(l);
  if (ok && ok > hoje) return 'em_dia';
  if (pv >= hoje) return ok ? 'em_dia' : 'a_vencer';
  return (ok && diasEntre(pv, hoje) > SUSPENDE_APOS_DIAS) ? 'suspenso' : 'vencido';
}
function licTvSuspensa(l) { return finSituacao(l) === 'suspenso'; }
function finResumo(l) {
  return { situacao: finSituacao(l), proximo_vencimento: proxVenc(l), pago_ate: isoDia(l.pagamento_ok_ate), ultimo_pagamento: isoDia(l.ultimo_pagamento) };
}
// Recalcula a licença a partir do livro. vencDevolvido = vencimento que voltou a ficar em aberto (pagamento desfeito).
async function pgRecalc(codigo, vencDevolvido) {
  const r = (await db.query(`SELECT MAX(cobre_ate) FILTER (WHERE status='confirmado') AS ok, MAX(data_pgto) FILTER (WHERE status='confirmado') AS ult,
                                    COUNT(cobre_ate) AS novos FROM pagamentos WHERE license_id=$1`, [codigo])).rows[0];
  const ok = isoDia(r.ok);
  // linhas antigas (antes de 03/10a) não têm cobre_ate: se a licença só tem dessas, não mexe no "pago até"
  if (parseInt(r.novos) > 0) {
    await db.query(`UPDATE licencas SET pagamento_ok_ate=$1::date, ultimo_pagamento=$2, vencimento=COALESCE($1::date, $3::date, vencimento), updated_at=NOW() WHERE codigo=$4`,
      [ok, r.ult, vencDevolvido || null, codigo]);
  } else {
    await db.query(`UPDATE licencas SET ultimo_pagamento=$1, vencimento=COALESCE($2::date, vencimento), updated_at=NOW() WHERE codigo=$3`, [r.ult, vencDevolvido || null, codigo]);
  }
  return pgSituacao(codigo);
}
// Só recalcula a situação (e o "dia X") a partir do que está na licença
async function pgSituacao(codigo) {
  const l = (await db.query('SELECT * FROM licencas WHERE codigo=$1', [codigo])).rows[0];
  if (l) {
    const s = finSituacao(l);
    await db.query('UPDATE licencas SET status_pagamento=$1, dia_vencimento=COALESCE(EXTRACT(DAY FROM vencimento)::smallint, dia_vencimento) WHERE codigo=$2', [s, codigo]);
    l.status_pagamento = s;
  }
  return l;
}
// Deixa a assinatura do Asaas igual à licença: valor e data da fatura em aberto.
// (A fatura em aberto vai para o próximo vencimento; a assinatura gera as seguintes a partir daí.)
async function asaasSyncLic(codigo) {
  if (!ASAAS_API_KEY || !db) return { ok: false, msg: 'Asaas não ligado' };
  const l = (await db.query('SELECT * FROM licencas WHERE codigo=$1', [codigo])).rows[0];
  if (!l || !l.asaas_sub) return { ok: false, msg: 'sem assinatura no Asaas' };
  try {
    const valor = Number(l.valor_mensal) || 0, hoje = dataSP();
    let alvo = proxVenc(l); if (alvo < hoje) alvo = hoje;   // o Asaas não aceita vencimento no passado
    const d = await asaasApi('GET', '/payments?subscription=' + encodeURIComponent(l.asaas_sub) + '&limit=50');
    const abertas = (d.data || []).filter(x => ['PENDING', 'OVERDUE'].includes(x.status) && !x.deleted).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    const feito = [];
    // O Asaas gera as mensalidades seguintes com antecedência (ex.: 03/10 e 03/11 em aberto).
    // A 1ª em aberto vai para o próximo vencimento; as outras seguem mês a mês a partir dela.
    for (let k = 0; k < abertas.length; k++) {
      const a = abertas[k], d2 = maisMes(alvo, k), v2 = valor > 0 ? valor : Number(a.value);
      if (a.dueDate !== d2 || Number(a.value) !== v2) {
        await asaasApi('PUT', '/payments/' + a.id, { billingType: a.billingType || 'CREDIT_CARD', value: v2, dueDate: d2 });
        feito.push('fatura ' + a.id + ' → ' + d2);
      }
    }
    const prox = maisMes(alvo, abertas.length);
    await asaasApi('PUT', '/subscriptions/' + l.asaas_sub, Object.assign({ nextDueDate: prox }, valor > 0 ? { value: valor, updatePendingPayments: true } : {}));
    feito.push('assinatura: próxima ' + prox + (valor > 0 ? ', R$ ' + valor : ''));
    log(`[Asaas] sync ${codigo}: ${feito.join('; ')}`);
    return { ok: true, msg: feito.join('; ') };
  } catch (e) { log(`[Asaas] sync ${codigo} falhou: ${e.message}`); return { ok: false, msg: e.message }; }
}

// Listar pagamentos de uma licença (só lê — não mexe em nada)
app.get('/admin/pagamentos/:license_id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [lic, pgs] = await Promise.all([
      db.query('SELECT * FROM licencas WHERE codigo=$1', [req.params.license_id]),
      db.query("SELECT *, COALESCE(origem, CASE WHEN asaas_id IS NULL THEN 'manual' ELSE 'asaas' END) AS origem FROM pagamentos WHERE license_id=$1 ORDER BY data_pgto DESC, id DESC LIMIT 36", [req.params.license_id]),
    ]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const l = lic.rows[0];
    res.json({ licenca: { ...l, ...finResumo(l), status_pagamento: finSituacao(l) }, pagamentos: pgs.rows.map(p => ({ ...p, data_pgto: isoDia(p.data_pgto), venc_ref: isoDia(p.venc_ref), cobre_ate: isoDia(p.cobre_ate) })),
      asaas: { ligado: !!ASAAS_API_KEY, assinatura: l.asaas_sub || null, cliente: l.asaas_customer || null, aviso: l.asaas_aviso || null } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Registrar pagamento RECEBIDO POR FORA (PIX, dinheiro, transferência).
// NÃO cobra cartão. Cobre o próximo vencimento em aberto por 1 mês.
// Cartão é sempre pelo Asaas (o webhook registra sozinho).
const METODOS_MANUAIS = { pix: 'PIX', dinheiro: 'Dinheiro', transferencia: 'Transferência', boleto: 'Boleto avulso', cortesia: 'Cortesia (sem cobrança)' };
app.post('/admin/pagamentos/:license_id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const b = req.body || {}, metodo = String(b.metodo || '').toLowerCase();
  if (!METODOS_MANUAIS[metodo]) return res.status(400).json({ error: 'Cartão é cobrado só pelo Asaas (a confirmação chega sozinha). Aqui registre apenas dinheiro recebido por fora: PIX, dinheiro, transferência, boleto avulso ou cortesia.' });
  if (b.confirmo !== true) return res.status(400).json({ error: 'Confirme que o dinheiro já entrou na conta.' });
  const valor = Number(b.valor);
  if (!(valor >= 0) || (metodo !== 'cortesia' && !(valor > 0))) return res.status(400).json({ error: 'Valor obrigatório' });
  try {
    const l = (await db.query('SELECT * FROM licencas WHERE codigo=$1', [req.params.license_id])).rows[0];
    if (!l) return res.status(404).json({ error: 'Licença não encontrada' });
    const meses = Math.min(12, Math.max(1, parseInt(b.meses) || 1));
    const venc = proxVenc(l), cobre = maisMes(venc, meses);
    const dataPgto = isoDia(b.data_pgto) || dataSP();
    const ref = b.referencia || ('Vencimento ' + venc.split('-').reverse().join('/') + (meses > 1 ? ` (+${meses} meses)` : ''));
    const ins = await db.query(`INSERT INTO pagamentos (license_id, valor, data_pgto, referencia, metodo, obs, registrado_por, status, origem, venc_ref, cobre_ate)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmado','manual',$8,$9) RETURNING id`,
      [l.codigo, valor, dataPgto, ref, METODOS_MANUAIS[metodo], b.obs || null, req.user.email, venc, cobre]);
    const n = await pgRecalc(l.codigo);
    const sync = await asaasSyncLic(l.codigo);   // a fatura do cartão pula para o novo vencimento (não cobra o mês já pago)
    log(`[Pagamento manual] ${l.codigo} ${METODOS_MANUAIS[metodo]} R$ ${valor} cobre ${venc} → ${cobre} por ${req.user.email}`);
    res.json({ ok: true, id: ins.rows[0].id, cobre_de: venc, cobre_ate: cobre, ...finResumo(n), asaas: sync });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// Desfazer um registro manual (lançado por engano). Pagamento do Asaas se desfaz no Asaas.
app.delete('/admin/pagamentos/:license_id/:id', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const p = (await db.query('SELECT * FROM pagamentos WHERE id=$1 AND license_id=$2', [req.params.id, req.params.license_id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Registro não encontrado' });
    if (p.asaas_id) return res.status(400).json({ error: 'Este pagamento veio do Asaas. Desfaça (estorne) lá no Asaas — o sistema atualiza sozinho.' });
    if (p.status !== 'confirmado') return res.status(400).json({ error: 'Este lançamento já foi desfeito.' });
    await db.query("UPDATE pagamentos SET status='desfeito', obs=COALESCE(obs||' · ','')||$2 WHERE id=$1", [p.id, 'desfeito por ' + req.user.email + ' em ' + dataSP()]);   // fica no histórico, riscado
    const n = await pgRecalc(p.license_id, isoDia(p.venc_ref));
    const sync = await asaasSyncLic(p.license_id);
    log(`[Pagamento manual] ${p.license_id} registro ${p.id} (R$ ${p.valor}) DESFEITO por ${req.user.email}`);
    res.json({ ok: true, ...finResumo(n), asaas: sync });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// Acertar a assinatura do Asaas na mão (botão "Acertar Asaas")
app.post('/admin/pagamentos/:license_id/sync-asaas', adminAuth, async (req, res) => {
  res.json(await asaasSyncLic(req.params.license_id));
});

// Atualizar dados financeiros da licença (email financeiro, dia vencimento, valor)
app.patch('/admin/licencas/:id/financeiro', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { financeiro_email, financeiro_nome, valor_mensal } = req.body;
  try {
    const ant = (await db.query('SELECT * FROM licencas WHERE id=$1', [req.params.id])).rows[0];
    if (!ant) return res.status(404).json({ error: 'Licença não encontrada' });
    // 03/10a: o vencimento é uma data (próximo vencimento). "dia" antigo ainda é aceito: muda só o dia.
    let venc = isoDia(req.body.vencimento);
    if (!venc && req.body.dia_vencimento && parseInt(req.body.dia_vencimento) !== parseInt(ant.dia_vencimento)) {
      const pv = proxVenc(ant), dia = Math.min(28, Math.max(1, parseInt(req.body.dia_vencimento)));
      venc = pv.slice(0, 8) + String(dia).padStart(2, '0');
    }
    const r = await db.query(`
      UPDATE licencas SET financeiro_email=$1, financeiro_nome=$2, valor_mensal=$3,
        vencimento=COALESCE($4::date, vencimento),
        pagamento_ok_ate=CASE WHEN $4::date IS NOT NULL AND pagamento_ok_ate IS NOT NULL THEN $4::date ELSE pagamento_ok_ate END,
        dia_vencimento=COALESCE(EXTRACT(DAY FROM $4::date)::smallint, dia_vencimento), updated_at=NOW()
      WHERE id=$5 RETURNING *
    `, [String(financeiro_email || '').trim().toLowerCase() || null, financeiro_nome || null, Number(valor_mensal) || 0, venc, req.params.id]);
    const N = r.rows[0];
    let fin = null;
    if (String(financeiro_email || '').trim().toLowerCase() !== String(ant.financeiro_email || '').trim().toLowerCase())
      fin = await acessoVincular(N.codigo, 'financeiro', financeiro_email, financeiro_nome, N.nome_fantasia || N.nome, ant.financeiro_email);   // 02/10l
    if (fin) N.financeiro_acesso = fin;
    if (venc || Number(ant.valor_mensal) !== Number(N.valor_mensal)) { Object.assign(N, await pgSituacao(N.codigo)); N.asaas = await asaasSyncLic(N.codigo); }
    res.json(Object.assign(N, finResumo(N)));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Status de pagamento de todas as licenças (dashboard financeiro)
app.get('/admin/financeiro/dashboard', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT l.*,
        (SELECT COUNT(*) FROM users WHERE license_id=l.codigo AND role='aluno') as total_alunos
      FROM licencas l ORDER BY l.nome
    `);
    const licencas = r.rows.map(l => ({ ...l, ...finResumo(l), status_pagamento: finSituacao(l) }));
    const conta = s => licencas.filter(l => l.situacao === s).length;
    const resumo = {
      total: licencas.length, em_dia: conta('em_dia'), a_vencer: conta('a_vencer'), vencido: conta('vencido'), suspenso: conta('suspenso'),
      receita_mensal: licencas.reduce((s,l) => s + parseFloat(l.valor_mensal||0), 0),
    };
    res.json({ licencas, resumo });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// DISPLAY TOKEN — autenticação do mini PC (sem senha do professor)
// ══════════════════════════════════════════════════════════════

// Ativação: Ginásio envia código da licença + device_id → token 15d
app.post('/display/ativar', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { codigo, device_id, nome_computador } = req.body;
  const _build = String(req.body.build || req.headers['x-pr-build'] || '').slice(0, 40) || null;  // 26/09e
  if (!codigo) return res.status(400).json({ error: 'Código da licença obrigatório' });
  try {
    const r = await db.query(
      "SELECT * FROM licencas WHERE UPPER(codigo)=UPPER($1) AND status='ativa'",
      [codigo.trim()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada ou inativa' });
    const lic = r.rows[0];
    if (licTvSuspensa(lic)) return res.status(403).json({ error: 'LICENÇA SUSPENSA — pagamento vencido. Fale com o financeiro da academia.' });
    const devId = device_id || null;
    if (devId) {
      // Registar/atualizar computador; se passar o limite, remove os mais antigos
      await db.query(`
        INSERT INTO licenca_computadores (license_codigo, device_id, nome_computador, visto_em, build)
        VALUES ($1,$2,$3,NOW(),$4)
        ON CONFLICT (license_codigo, device_id) DO UPDATE SET nome_computador=$3, visto_em=NOW(), build=COALESCE($4, licenca_computadores.build)
      `, [lic.codigo, devId, nome_computador || null, _build]);
      const maxComp = lic.max_computadores || 1;
      await db.query(`
        DELETE FROM licenca_computadores
        WHERE license_codigo=$1 AND device_id NOT IN (
          SELECT device_id FROM licenca_computadores WHERE license_codigo=$1 ORDER BY visto_em DESC LIMIT $2
        )
      `, [lic.codigo, maxComp]);
    }
    const token = jwt.sign(
      { role: 'display', license_id: lic.codigo, nome_academia: lic.nome, device_id: devId },
      JWT_SECRET,
      { expiresIn: '15d' }
    );
    res.json({ token, nome_academia: lic.nome, codigo: lic.codigo, max_bikes: parseInt(lic.max_bikes)||0, teto: _tetoDe(lic),
               ranking_cfg: rankCfgLimpa(lic.ranking_cfg || RANK_PADRAO) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Renovar token: Ginásio envia token atual (mesmo vencido há pouco) → token novo 15d
app.post('/display/renovar', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const raw = (req.headers.authorization || '').replace('Bearer ', '');
  if (!raw) return res.status(401).json({ error: 'Token necessário' });
  const { device_id } = req.body;
  try {
    let p;
    try { p = jwt.verify(raw, JWT_SECRET); }
    catch(e) {
      // Aceita token vencido há menos de 30 dias
      p = jwt.verify(raw, JWT_SECRET, { ignoreExpiration: true });
      if (p.exp && (Date.now()/1000 - p.exp) > 30*24*3600)
        return res.status(401).json({ error: 'Token demasiado antigo para renovar' });
    }
    if (p.role !== 'display') return res.status(403).json({ error: 'Acesso negado' });
    const lic = await db.query("SELECT * FROM licencas WHERE codigo=$1 AND status='ativa'", [p.license_id]);
    if (!lic.rows.length) return res.status(403).json({ motivo: 'Licença inativa ou não encontrada' });
    const l = lic.rows[0];
    // Verificar pagamento (5 dias de tolerância)
    if (licTvSuspensa(l)) return res.status(403).json({ motivo: 'LICENÇA SUSPENSA — pagamento vencido' });   // 03/10a: mesma regra do admin
    const devId = device_id || p.device_id || null;
    if (devId) {
      // Verificar se device_id ainda está na lista (tokens antigos sem device_id: aceitar por 30 dias)
      if (p.device_id) {
        const dc = await db.query(
          'SELECT 1 FROM licenca_computadores WHERE license_codigo=$1 AND device_id=$2',
          [l.codigo, devId]
        );
        if (!dc.rows.length) return res.status(401).json({ motivo: 'outro_computador' });
      }
      await db.query(`
        INSERT INTO licenca_computadores (license_codigo, device_id, visto_em)
        VALUES ($1,$2,NOW())
        ON CONFLICT (license_codigo, device_id) DO UPDATE SET visto_em=NOW()
      `, [l.codigo, devId]);
    }
    const token = jwt.sign(
      { role: 'display', license_id: l.codigo, nome_academia: l.nome, device_id: devId },
      JWT_SECRET,
      { expiresIn: '15d' }
    );
    res.json({ token, max_bikes: parseInt(l.max_bikes)||0, teto: _tetoDe(l) });
  } catch(e) { res.status(401).json({ error: 'Token inválido: ' + e.message }); }
});

// ── TETO DE BIKES DA LICENCA (24/09) ─────────────────────────────
// Regra do Mario: a licenca e vendida por quantidade de bikes e e ela que
// manda. max_bikes e o que foi vendido (so o super admin altera);
// bikes_disponiveis pode ser menor (bike parada), nunca maior.
// Devolve 0 quando a licenca nao tem numero definido (nao limita).
function _tetoDe(row){
  if(!row) return 0;
  const max = parseInt(row.max_bikes) || 0;
  const disp = parseInt(row.bikes_disponiveis) || 0;
  if (max > 0) return disp > 0 ? Math.min(disp, max) : max;
  return disp;
}
async function tetoLicenca(licId){
  if(!db || !licId) return 0;
  try{
    const r = await db.query('SELECT max_bikes, bikes_disponiveis FROM licencas WHERE codigo=$1', [licId]);
    return _tetoDe(r.rows[0]);
  }catch(e){ return 0; }
}
// Minimo de bikes de uma licenca vendida (decisao do Mario, 24/09).
const MIN_BIKES_LICENCA = 10;
function _validaMaxBikes(v){
  if (v === undefined || v === null || v === '') return { ok: true, valor: null };  // nao informado: mantem
  const n = parseInt(v);
  if (!(n >= MIN_BIKES_LICENCA))
    return { ok: false, erro: `A licença precisa de pelo menos ${MIN_BIKES_LICENCA} bikes (recebido: ${v}).` };
  return { ok: true, valor: n };
}
function _capVagas(v, teto){
  const n = parseInt(v) || 0;
  if (!teto) return n || 20;
  return n > 0 ? Math.min(n, teto) : teto;
}

// Quantas bikes esta licenca tem — para o Ginasio limitar a grade da sala.
app.get('/display/licenca', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query('SELECT codigo, nome, max_bikes, bikes_disponiveis, ranking_cfg FROM licencas WHERE codigo=$1', [req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const l = r.rows[0];
    res.json({ codigo: l.codigo, nome: l.nome, max_bikes: parseInt(l.max_bikes)||0,
               bikes_disponiveis: parseInt(l.bikes_disponiveis)||0, teto: _tetoDe(l),
               ranking_cfg: rankCfgLimpa(l.ranking_cfg || RANK_PADRAO),  // 26/09e
               numeros: await numerosAcademia(l.codigo) });              // 29/09a: km e kcal na tela de espera
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Middleware display
async function displayAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (p.role !== 'display' && p.role !== 'gestor' && p.role !== 'admin')
      return res.status(403).json({ error: 'Acesso negado' });
    // 26/09e: o Ginásio manda a versão no cabeçalho; o super admin vê
    // qual BUILD está em cada TV e quando ela falou com o servidor.
    const _build = String(req.headers['x-pr-build'] || '').slice(0, 40);
    if (p.role === 'display' && p.device_id && db && _build) {
      db.query('UPDATE licenca_computadores SET build=$1, visto_em=NOW() WHERE license_codigo=$2 AND device_id=$3',
               [_build, p.license_id, p.device_id]).catch(() => {});
    }
    // Verificar device_id (tokens antigos sem device_id: aceitar provisoriamente)
    if (p.role === 'display' && p.device_id && db) {
      const dc = await db.query(
        'SELECT 1 FROM licenca_computadores WHERE license_codigo=$1 AND device_id=$2',
        [p.license_id, p.device_id]
      );
      if (!dc.rows.length) return res.status(401).json({ motivo: 'outro_computador' });
    }
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
      `SELECT a.*, COALESCE(p.name, a.professor_nome) AS professor_nome,
         (SELECT COUNT(*)::int FROM aulas_reservas r WHERE r.agenda_id=a.id AND r.data_aula=$3::date AND r.status NOT IN ('cancelado','ausente')) AS reservas_hoje
       FROM aulas_agenda a
       LEFT JOIN users p ON p.id = a.professor_id
       WHERE a.license_id=$1 AND a.dia_semana=$2 AND a.ativa=true
       ORDER BY a.hora`,
      [licId, diaN, nowBR.getFullYear() + '-' + String(nowBR.getMonth() + 1).padStart(2, '0') + '-' + String(nowBR.getDate()).padStart(2, '0')]
    );
    // 29/09a: nunca mostra mais vagas que as bikes da licença
    const teto = await tetoLicenca(licId);
    res.json(r.rows.map(a => Object.assign(a, { vagas_max: _capVagas(a.vagas_max, teto) })));
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
        const max_conexoes = _tetoDe(lic.rows[0]) || aula.vagas_max || 1;   // 24/09: teto da licenca
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
    if (!['gestor','admin','super_admin','coordenador','financeiro'].includes(p.role)) return res.status(403).json({ error: 'Acesso negado' });
    // 26/09e: níveis de acesso do Portal. Coordenador cuida da operação
    // (agenda, alunos, professores, relatórios, avisos), mas não mexe na
    // configuração da licença. Financeiro só lê números e alunos.
    const _rota = String(req.originalUrl || req.path || '').split('?')[0];
    if (p.role === 'financeiro') {
      const leitura = req.method === 'GET' && /^\/gestor\/(stats|relatorio|alunos|config|leaderboard)(\/|$)/.test(_rota);
      if (!leitura) return res.status(403).json({ error: 'Seu acesso (financeiro) não permite esta ação.' });
    }
    if (p.role === 'coordenador') {
      if (/^\/gestor\/config\/(bikes|ranking)/.test(_rota) && req.method !== 'GET')
        return res.status(403).json({ error: 'Só o gestor altera a configuração da licença.' });
    }
    req.user = p;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// Acesso para professor + gestor + admin + super_admin (usado nas rotas da Sala do Professor)
function professorAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (!['professor','gestor','coordenador','admin','super_admin'].includes(p.role))
      return res.status(403).json({ error: 'Acesso negado' });
    req.user = p;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// Verifica se professor tem acesso à licença indicada.
// Gestor/admin/super_admin passam sempre (usam license_id do próprio token).
async function temAcessoLicenca(user, licenseId) {
  if (['admin','super_admin'].includes(user.role)) return true;
  if (!db) return false;
  // 30/09e: quem a academia convidou em "Equipe e acessos" (professor,
  // coordenador, gestor) fica com users.license_id = a academia, mas nao
  // ganhava linha em professor_licencas — o QR de "Minhas aulas" dava
  // "Sem acesso a esta unidade". Agora vale a academia da propria conta.
  try {
    const u = await db.query('SELECT role, license_id FROM users WHERE id=$1', [user.id]);
    const x = u.rows[0];
    if (x && x.license_id && x.license_id === licenseId && ['professor','coordenador','gestor'].includes(x.role)) return true;
    if (x && x.role === 'gestor' && !x.license_id) return true;
  } catch (_e) {}
  const r = await db.query(
    'SELECT 1 FROM professor_licencas WHERE user_id=$1 AND license_id=$2',
    [user.id, licenseId]
  );
  return r.rows.length > 0;
}

// Alunos da licença do gestor
app.get('/gestor/alunos', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const licId = req.user.license_id;
  try {
    const r = await db.query(`
      SELECT u.id, u.name, u.email, u.status, u.points, u.level, u.peso, u.ftp, u.created_at,
        u.idade, u.sexo, u.altura, u.nascimento,
        (SELECT COUNT(*) FROM aula_historico ah WHERE ah.user_id=u.id AND ah.data_aula > NOW()-INTERVAL '30 days')::int AS aulas_30d,
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
    const [alunos, aulas7, aulas30, top, extra, topSem] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM users WHERE license_id=$1 AND role='aluno'`, [licId]),
      db.query(`SELECT COUNT(*) FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 AND ah.data_aula > NOW()-INTERVAL '7 days'`, [licId]),
      db.query(`SELECT COUNT(*) FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 AND ah.data_aula > NOW()-INTERVAL '30 days'`, [licId]),
      db.query(`SELECT u.name, COUNT(ah.id) as total FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 GROUP BY u.id, u.name ORDER BY total DESC LIMIT 5`, [licId]),
      // 26/09e: números do painel novo
      db.query(`SELECT
          (SELECT COUNT(DISTINCT ah.user_id) FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 AND ah.data_aula > NOW()-INTERVAL '30 days')::int AS ativos_30d,
          (SELECT COUNT(DISTINCT ah.user_id) FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 AND ah.data_aula > NOW()-INTERVAL '7 days')::int AS visitas_7d,
          (SELECT COUNT(*) FROM users u WHERE u.license_id=$1 AND u.role='aluno' AND u.created_at > NOW()-INTERVAL '30 days')::int AS novos_30d,
          (SELECT COUNT(*) FROM (SELECT ah.user_id FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1 AND u.role='aluno'
             GROUP BY ah.user_id HAVING MAX(ah.data_aula) < NOW()-INTERVAL '14 days') x)::int AS sumidos,
          (SELECT COUNT(*) FROM aulas_agenda WHERE license_id=$1 AND ativa=true)::int AS aulas_grade`, [licId]),
      db.query(`SELECT u.name, COUNT(ah.id)::int AS aulas, COALESCE(SUM(ah.kcal),0)::int AS kcal
                FROM aula_historico ah JOIN users u ON u.id=ah.user_id
                WHERE u.license_id=$1 AND ah.data_aula > NOW()-INTERVAL '7 days'
                GROUP BY u.id, u.name ORDER BY kcal DESC LIMIT 5`, [licId]),
    ]);
    res.json({
      total_alunos: parseInt(alunos.rows[0].count),
      aulas_7d: parseInt(aulas7.rows[0].count),
      aulas_30d: parseInt(aulas30.rows[0].count),
      top_alunos: top.rows,
      ...(extra.rows[0] || {}),
      top_semana: topSem.rows,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// PORTAL 26/09e — ranking da TV e e-mails por licença
// ══════════════════════════════════════════════════════════════
// Campos que a tela de Ranking (botão B) do Ginásio sabe mostrar.
const RANK_CAMPOS = ['zona', 'rpm', 'ftp', 'watts', 'kcal', 'fc', 'wpp'];
const RANK_ORDENS = ['wpp', 'kcal', 'watts', 'ftp'];
const RANK_PADRAO = { campos: ['zona', 'rpm', 'ftp', 'watts', 'kcal', 'wpp'], ordem: 'wpp' };
function rankCfgLimpa(c) {
  const campos = Array.isArray(c && c.campos) ? c.campos.filter((x, i, a) => RANK_CAMPOS.includes(x) && a.indexOf(x) === i) : RANK_PADRAO.campos;
  const ordem = RANK_ORDENS.includes(c && c.ordem) ? c.ordem : 'wpp';
  return { campos: campos.length ? campos : RANK_PADRAO.campos, ordem };
}
app.get('/gestor/config/ranking', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query('SELECT ranking_cfg FROM licencas WHERE codigo=$1', [req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    res.json({ ...rankCfgLimpa(r.rows[0].ranking_cfg || RANK_PADRAO), disponiveis: RANK_CAMPOS, ordens: RANK_ORDENS });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/gestor/config/ranking', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const cfg = rankCfgLimpa(req.body || {});
  try {
    const r = await db.query('UPDATE licencas SET ranking_cfg=$1, updated_at=NOW() WHERE codigo=$2 RETURNING ranking_cfg', [JSON.stringify(cfg), req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    res.json({ ok: true, ...cfg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/gestor/emails', gestorAuth, async (req, res) => {
  const cfg = await emailsCfgDe(req.user.license_id);
  let enviados = [];
  try {
    if (db) enviados = (await db.query(`SELECT el.tipo, COUNT(*)::int AS total FROM email_log el
      LEFT JOIN users u ON u.id=el.user_id
      WHERE (u.license_id=$1 OR el.ref LIKE $2) AND el.enviado_em > NOW()-INTERVAL '30 days' GROUP BY el.tipo`,
      [req.user.license_id, req.user.license_id + ':%'])).rows;
  } catch (e) {}
  res.json({ cfg, provedor: emailProvedor(), enviados_30d: enviados, padrao: EMAIL_TEXTO_PADRAO });
});
// Prévia com um aluno de exemplo (o Portal mostra exatamente o que sai)
const EMAIL_EXEMPLO = { nome: 'Ana', nome_completo: 'Ana Paula', aula: 'Endurance de quinta', duracao: '55 min', kcal: 512, potencia: '168 W', rpm: 88, zona: 'Z3', pontos: 152,
  dias: 16, ftp_antes: 180, ftp_novo: 192, evolucao: 12, mes: 'setembro de 2026', aulas: 214, alunos: 63, hora: '18:30', bike: 7, data: 'quinta, 03/10' };
function emailPrevia(tipo, cfg, academia) {
  const v = Object.assign({}, EMAIL_EXEMPLO, { academia });
  let nums = null;
  if (tipo === 'resumo_aula') nums = `<table style="width:100%;background:#0b0b0e;border-radius:10px;margin:10px 0"><tr>${_numBox('55 min', 'DURAÇÃO')}${_numBox(512, 'KCAL', '#ea860c')}${_numBox('168 W', 'POTÊNCIA MÉDIA', '#5b8cff')}</tr><tr>${_numBox(88, 'RPM MÉDIO')}${_numBox('Z3', 'ZONA PREDOMINANTE')}${_numBox('+152', 'PONTOS', '#ffe033')}</tr></table>`;
  if (tipo === 'novo_ftp') nums = `<table style="width:100%;background:#0b0b0e;border-radius:10px;margin:10px 0"><tr>${_numBox('180 W', 'ANTES')}${_numBox('192 W', 'AGORA', '#5db13d')}${_numBox('+12 W', 'EVOLUÇÃO', '#ffe033')}</tr></table>`;
  if (tipo === 'relatorio_mensal') nums = `<table style="width:100%;background:#0b0b0e;border-radius:10px;margin:10px 0"><tr>${_numBox(214, 'AULAS CONCLUÍDAS')}${_numBox(63, 'ALUNOS ATIVOS', '#5db13d')}${_numBox('96.400', 'KCAL', '#ea860c')}</tr></table>`;
  return emailMontar(tipo, cfg, v, nums, '', PORTAL_URL + '/aluno', academia);
}
app.post('/gestor/emails/previa', gestorAuth, async (req, res) => {
  const b = req.body || {}; const tipo = EMAIL_TEXTO_PADRAO[b.tipo] ? b.tipo : 'resumo_aula';
  const cfg = await emailsCfgDe(req.user.license_id);
  if (b.texto && typeof b.texto === 'object') cfg.textos = Object.assign({}, cfg.textos || {}, { [tipo]: b.texto });
  let academia = 'Sua academia'; try { const l = await db.query('SELECT COALESCE(nome_fantasia, nome) AS n FROM licencas WHERE codigo=$1', [req.user.license_id]); if (l.rows[0]) academia = l.rows[0].n; } catch (e) {}
  res.json(emailPrevia(tipo, cfg, academia));
});
app.put('/gestor/emails', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const b = req.body || {}, cfg = {};
  Object.keys(EMAILS_PADRAO).forEach(k => { cfg[k] = (b[k] === undefined) ? EMAILS_PADRAO[k] : !!b[k]; });
  // 30/09e: textos próprios da academia (só os campos conhecidos, até 600 caracteres)
  try { const at = await emailsCfgDe(req.user.license_id); if (at.textos) cfg.textos = at.textos; } catch (e) {}
  if (b.textos && typeof b.textos === 'object') {
    cfg.textos = cfg.textos || {};
    Object.keys(EMAIL_TEXTO_PADRAO).forEach(tp => {
      const x = b.textos[tp]; if (!x || typeof x !== 'object') return;
      const o = {}; EMAIL_CAMPOS.forEach(k => { if (typeof x[k] === 'string') o[k] = x[k].slice(0, 600); });
      if (x.numeros !== undefined) o.numeros = !!x.numeros;
      cfg.textos[tp] = o;
    });
  }
  try {
    await db.query('UPDATE licencas SET emails_cfg=$1, updated_at=NOW() WHERE codigo=$2', [JSON.stringify(cfg), req.user.license_id]);
    res.json({ ok: true, cfg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Equipe da licença: quem tem acesso ao Portal/app e com qual papel.
const PAPEIS_EQUIPE = ['aluno', 'professor', 'coordenador', 'financeiro'];
app.get('/gestor/equipe', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`SELECT id, name, email, role, status, created_at FROM users
      WHERE license_id=$1 AND role <> 'aluno' ORDER BY CASE role WHEN 'gestor' THEN 0 WHEN 'coordenador' THEN 1 WHEN 'professor' THEN 2 ELSE 3 END, name`, [req.user.license_id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/gestor/equipe', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  if (!['gestor', 'admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Só o gestor convida a equipe.' });
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const nome = String((req.body || {}).nome || '').trim();
  const papel = (req.body || {}).papel;
  if (!email || !/@/.test(email)) return res.status(400).json({ error: 'E-mail inválido' });
  if (!PAPEIS_EQUIPE.includes(papel) || papel === 'aluno') return res.status(400).json({ error: 'Papel inválido' });
  try {
    const ex = await db.query('SELECT id, role, license_id FROM users WHERE email=$1', [email]);
    let senhaTemp = null, uid;
    if (ex.rows.length) {
      const u = ex.rows[0];
      if (['gestor', 'admin', 'super_admin'].includes(u.role)) return res.status(409).json({ error: 'Esta conta já é gestor/admin.' });
      if (u.license_id && u.license_id !== req.user.license_id && u.role !== 'aluno') return res.status(409).json({ error: 'Esta conta já é da equipe de outra academia.' });
      await db.query('UPDATE users SET role=$1, license_id=$2, updated_at=NOW() WHERE id=$3', [papel, req.user.license_id, u.id]);
      uid = u.id;
    } else {
      senhaTemp = 'PR-' + crypto.randomBytes(4).toString('hex');
      const ins = await db.query('INSERT INTO users (email, name, password_hash, role, license_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [email, nome || email.split('@')[0], await bcrypt.hash(senhaTemp, 10), papel, req.user.license_id]);
      uid = ins.rows[0].id;
    }
    const l = await db.query('SELECT nome FROM licencas WHERE codigo=$1', [req.user.license_id]);
    const enviado = await emailBoasVindas({ userId: uid, email, nome, academia: (l.rows[0] || {}).nome, licId: req.user.license_id, senhaTemp, papel });
    res.json({ ok: true, id: uid, senha_provisoria: senhaTemp, email_enviado: enviado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/gestor/equipe/:id/papel', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  if (!['gestor', 'admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Só o gestor muda papéis.' });
  const papel = (req.body || {}).papel;
  if (!PAPEIS_EQUIPE.includes(papel)) return res.status(400).json({ error: 'Papel inválido' });
  try {
    const r = await db.query(`UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2 AND license_id=$3
      AND role NOT IN ('gestor','admin','super_admin') RETURNING id, name, role`, [papel, parseInt(req.params.id), req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Pessoa não encontrada nesta academia (ou é gestor).' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Manda um e-mail de teste para quem está logado (confere a configuração)
app.post('/gestor/emails/teste', gestorAuth, async (req, res) => {
  const para = (req.body && req.body.email) || req.user.email;
  let msg = { subject: 'Teste de e-mail — ProRider', html: emailLayout('Tudo certo!', '<p>Se você está lendo isto, os e-mails automáticos do ProRider estão funcionando.</p>') };
  if (req.body && EMAIL_TEXTO_PADRAO[req.body.tipo]) {   // 30/09e: manda o modelo escolhido, com dados de exemplo
    const cfg = await emailsCfgDe(req.user.license_id);
    let academia = 'Sua academia'; try { const l = await db.query('SELECT COALESCE(nome_fantasia, nome) AS n FROM licencas WHERE codigo=$1', [req.user.license_id]); if (l.rows[0]) academia = l.rows[0].n; } catch (e) {}
    const pv = emailPrevia(req.body.tipo, cfg, academia); msg = { subject: '[TESTE] ' + pv.subject, html: pv.html };
  }
  const r = await enviarEmail({ to: para, subject: msg.subject, html: msg.html });
  res.status(r.ok ? 200 : 400).json(r.ok ? { ok: true, para } : { error: r.erro });
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

// 02/10h (regra do Mario): a página de pagamento é SÓ do responsável financeiro.
// Vale o e-mail do login igual ao licencas.financeiro_email da licença — o papel
// não importa (num estúdio pequeno o gestor pode ser também o financeiro).
// Gestor e coordenador ficam de fora. Admin e super admin (modo suporte) só leem.
// A licença de quem é o financeiro: o e-mail do login igual ao financeiro_email
// (vale para quem se cadastrou pelo app ou pelo Portal, com qualquer papel).
async function finLicencaDe(email) {
  const e = String(email || '').trim().toLowerCase(); if (!e || !db) return null;
  const r = await db.query('SELECT codigo FROM licencas WHERE LOWER(TRIM(financeiro_email))=$1 ORDER BY id LIMIT 1', [e]);
  return r.rows.length ? r.rows[0].codigo : null;
}
// 02/10l: o admin define (ou troca) o GESTOR ou o FINANCEIRO da licença pelo e-mail.
// Conta que já existe vira gestor/financeiro desta licença (admin nunca é mexido;
// o financeiro não rebaixa um gestor — a página do financeiro vale pelo e-mail).
// Conta que não existe é criada com senha provisória e recebe o e-mail de boas-vindas.
// O e-mail anterior perde o papel (volta a aluno).
async function acessoVincular(codigo, papel, email, nome, academia, antigo, enviar = true) {
  email = String(email || '').trim().toLowerCase(); antigo = String(antigo || '').trim().toLowerCase();
  if (antigo && antigo !== email) await db.query(`UPDATE users SET role='aluno' WHERE LOWER(email)=$1 AND role=$2 AND license_id=$3`, [antigo, papel, codigo]);
  if (!email) return null;
  const ex = (await db.query('SELECT id, role FROM users WHERE LOWER(email)=$1', [email])).rows[0];
  if (ex) {
    const pode = papel === 'gestor' ? !['admin', 'super_admin'].includes(ex.role) : ['aluno', 'financeiro'].includes(ex.role);
    if (pode) await db.query('UPDATE users SET role=$1, license_id=$2, updated_at=NOW() WHERE id=$3', [papel, codigo, ex.id]);
    return { email, papel, ja_existia: true };
  }
  const senhaTemp = 'PR-' + crypto.randomBytes(4).toString('hex');
  const ins = await db.query(`INSERT INTO users (email, name, password_hash, role, license_id, senha_provisoria) VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id`,
    [email, nome || (papel === 'gestor' ? 'Gestor' : 'Financeiro'), await bcrypt.hash(senhaTemp, 10), papel, codigo]);
  let enviado = false, motivo = null;
  if (enviar) { try { enviado = await emailBoasVindas({ userId: ins.rows[0].id, email, nome, academia, licId: null, senhaTemp, papel }); } catch (e) { _emailUltimoErro = e.message; } }
  if (enviar && !enviado) motivo = emailMotivo(_emailUltimoErro);
  log(`[Acesso] ${papel} ${email} criado na licença ${codigo} — e-mail ${enviado ? 'enviado' : 'NÃO enviado' + (motivo ? ' (' + motivo + ')' : '')}`);
  return { email, papel, nome: nome || '', senha_provisoria: senhaTemp, email_enviado: !!enviado, email_motivo: motivo };
}
// 03/10a: "Gerar nova senha e reenviar" — para quando o e-mail não chegou ou a pessoa esqueceu.
// Gera senha provisória nova (a pessoa troca no 1º acesso) e tenta mandar o e-mail de novo.
app.post('/admin/licencas/:id/reenviar-acesso', adminAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const l = (await db.query('SELECT * FROM licencas WHERE id=$1', [req.params.id])).rows[0];
    if (!l) return res.status(404).json({ error: 'Licença não encontrada' });
    const papel = req.body && req.body.papel === 'financeiro' ? 'financeiro' : 'gestor';
    const email = String(papel === 'financeiro' ? l.financeiro_email : l.email_gestor || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Esta licença não tem e-mail de ' + papel + '.' });
    const u = (await db.query('SELECT id, name, role FROM users WHERE LOWER(email)=$1', [email])).rows[0];
    if (!u) {   // não tem conta ainda: cria agora
      const r = await acessoVincular(l.codigo, papel, email, papel === 'financeiro' ? l.financeiro_nome : l.contato_nome, l.nome_fantasia || l.nome, null, true);
      return res.json(r);
    }
    if (['admin', 'super_admin'].includes(u.role)) return res.status(400).json({ error: 'Essa conta é de administrador — a senha dela não é trocada por aqui.' });
    const senhaTemp = 'PR-' + crypto.randomBytes(4).toString('hex');
    await db.query('UPDATE users SET password_hash=$1, senha_provisoria=TRUE, updated_at=NOW() WHERE id=$2', [await bcrypt.hash(senhaTemp, 10), u.id]);
    await db.query("DELETE FROM email_log WHERE tipo='boas_vindas' AND ref=$1", ['u' + u.id]).catch(() => {});
    let enviado = false; _emailUltimoErro = null;
    try { enviado = await emailBoasVindas({ userId: u.id, email, nome: u.name, academia: l.nome_fantasia || l.nome, licId: null, senhaTemp, papel }); } catch (e) { _emailUltimoErro = e.message; }
    log(`[Acesso] nova senha provisória para ${papel} ${email} (licença ${l.codigo}) por ${req.user.email} — e-mail ${enviado ? 'enviado' : 'NÃO enviado'}`);
    res.json({ email, papel, nome: u.name || '', senha_provisoria: senhaTemp, email_enviado: !!enviado, email_motivo: enviado ? null : emailMotivo(_emailUltimoErro) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// O admin pôs (ou trocou) o e-mail do financeiro: o cadastro com esse e-mail
// vira "financeiro" da licença; o anterior volta a ser aluno. Gestor e outros
// papéis não são rebaixados (a página vale pelo e-mail).
async function finVincular(codigo, novo, antigo) {
  novo = String(novo || '').trim().toLowerCase(); antigo = String(antigo || '').trim().toLowerCase();
  if (antigo && antigo !== novo) await db.query(`UPDATE users SET role='aluno' WHERE LOWER(email)=$1 AND role='financeiro'`, [antigo]);
  if (novo) await db.query(`UPDATE users SET role='financeiro', license_id=$2 WHERE LOWER(email)=$1 AND role IN ('aluno','financeiro')`, [novo, codigo]);
}
async function finAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  let p; try { p = jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(401).json({ error: 'Token inválido' }); }
  const suporte = ['admin', 'super_admin'].includes(p.role) || !!p.impersonated_by;
  let lic = null;
  try { if (!suporte) lic = await finLicencaDe(p.email); } catch (e) { return res.status(500).json({ error: 'Erro interno' }); }
  if (!suporte && !lic) return res.status(403).json({ error: 'Esta página é só do responsável financeiro da academia (o e-mail cadastrado como financeiro na licença).' });
  if (suporte && req.method !== 'GET') return res.status(403).json({ error: 'Modo suporte: só o responsável financeiro mexe no pagamento.' });
  req.user = suporte ? p : Object.assign({}, p, { license_id: lic }); req.finSuporte = suporte;
  next();
}

// Situação da licença + faturas do Asaas (a página financeiro.html)
app.get('/academia/financeiro', finAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const licId = req.user.license_id;
  if (!licId) return res.status(403).json({ error: 'Sem licença associada' });
  try {
    const l = (await db.query('SELECT * FROM licencas WHERE codigo=$1', [licId])).rows[0];
    if (!l) return res.status(404).json({ error: 'Licença não encontrada' });
    let faturas = [], erroAsaas = null;
    if (ASAAS_API_KEY) {
      try {
        // 03/10b: fatura em aberto fora da data da licença (ex.: dia 3 em vez de 4) → acerta no Asaas antes de mostrar
        if (l.asaas_sub) {
          const hoje = dataSP(); let alvo = proxVenc(l); if (alvo < hoje) alvo = hoje;
          const ps = await asaasApi('GET', '/payments?subscription=' + encodeURIComponent(l.asaas_sub) + '&limit=50');
          const ab = (ps.data || []).filter(x => ['PENDING', 'OVERDUE'].includes(x.status)).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
          if (ab.length && (ab[0].dueDate !== alvo || ab.some((x, k) => x.dueDate !== maisMes(alvo, k)))) await asaasSyncLic(licId);
        }
        const d = await asaasApi('GET', '/payments?externalReference=' + encodeURIComponent(licId) + '&limit=12');
        faturas = (d.data || []).map(x => ({ id: x.id, valor: x.value, status: x.status, vencimento: x.dueDate, pago_em: x.paymentDate || x.clientPaymentDate || null,
          url: x.invoiceUrl || null, recibo: x.transactionReceiptUrl || null,
          cartao: x.creditCard && x.creditCard.creditCardNumber ? { final: String(x.creditCard.creditCardNumber).slice(-4), bandeira: x.creditCard.creditCardBrand || '' } : null }));
      } catch (e) { erroAsaas = 'Não consegui ler as faturas agora (' + e.message + ').'; }
    } else erroAsaas = 'Cobrança automática ainda não ligada no servidor.';
    const aberta = faturas.filter(x => ['PENDING', 'OVERDUE'].includes(x.status)).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0] || null;
    const cartao = (faturas.find(x => x.cartao) || {}).cartao || null;
    res.json({ academia: l.nome_fantasia || l.nome, codigo: l.codigo, ...finResumo(l), valor_mensal: Number(l.valor_mensal) || 0,
      dia_vencimento: l.dia_vencimento, financeiro_nome: l.financeiro_nome, financeiro_email: l.financeiro_email, tem_assinatura: !!l.asaas_sub,
      aviso: l.asaas_aviso || null, fatura_aberta: aberta, cartao, faturas, erro_asaas: erroAsaas, suporte: !!req.finSuporte });
  } catch (e) { log('financeiro: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// Pagar: na 1ª vez cria o cliente e a assinatura mensal no Asaas (cartão de
// crédito, valor da licença); depois devolve a fatura em aberto. O cartão é
// digitado na página do próprio Asaas — nunca passa por aqui.
app.post('/academia/financeiro/pagar', finAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  if (!ASAAS_API_KEY) return res.status(503).json({ error: 'Cobrança automática ainda não ligada no servidor. Fale com a ProRider.' });
  const licId = req.user.license_id;
  try {
    const l = (await db.query('SELECT * FROM licencas WHERE codigo=$1', [licId])).rows[0];
    if (!l) return res.status(404).json({ error: 'Licença não encontrada' });
    const valor = Number(l.valor_mensal) || 0;
    if (valor <= 0) return res.status(400).json({ error: 'O valor da licença ainda não foi definido. Fale com a ProRider.' });
    const b = req.body || {}, doc = String(b.cpf_cnpj || '').replace(/\D/g, '');
    if (!l.asaas_sub) {
      if (!(doc.length === 11 || doc.length === 14)) return res.status(400).json({ error: 'Informe o CPF ou CNPJ de quem paga (só números).' });
      let cust = l.asaas_customer;
      if (!cust) {
        const c = await asaasApi('POST', '/customers', { name: String(b.nome || l.financeiro_nome || l.nome).slice(0, 100), email: l.financeiro_email, cpfCnpj: doc, externalReference: licId, notificationDisabled: false });
        cust = c.id; await db.query('UPDATE licencas SET asaas_customer=$1, updated_at=NOW() WHERE codigo=$2', [cust, licId]);
      }
      // 03/10a: a 1ª fatura vence no PRÓXIMO VENCIMENTO da licença (antes: sempre "hoje" — o erro do dia 3 em vez do dia 4)
      const hoje = dataSP(); let venc = proxVenc(l); if (venc < hoje) venc = hoje;
      const sub = await asaasApi('POST', '/subscriptions', { customer: cust, billingType: 'CREDIT_CARD', value: valor, nextDueDate: venc, cycle: 'MONTHLY',
        description: 'ProRider — licença ' + (l.nome_fantasia || l.nome) + ' (' + licId + ')', externalReference: licId });
      await db.query(`UPDATE licencas SET asaas_sub=$1, vencimento=COALESCE(vencimento, $3::date), updated_at=NOW() WHERE codigo=$2`, [sub.id, licId, venc]);
      log(`[Asaas] assinatura ${sub.id} criada para ${licId} (R$ ${valor}, 1º vencimento ${venc}) pelo financeiro ${req.user.email}`);
      l.asaas_sub = sub.id;
    } else await asaasSyncLic(licId);   // garante que a fatura em aberto está na data e no valor certos
    const d = await asaasApi('GET', '/payments?subscription=' + encodeURIComponent(l.asaas_sub) + '&limit=50');
    const ab = (d.data || []).filter(x => ['PENDING', 'OVERDUE'].includes(x.status)).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
    if (!ab) return res.json({ ok: true, url: null, msg: 'Nenhuma fatura em aberto agora. A próxima chega perto do vencimento.' });
    res.json({ ok: true, url: ab.invoiceUrl, vencimento: ab.dueDate, valor: ab.value });
  } catch (e) { log('financeiro pagar: ' + e.message); res.status(502).json({ error: 'O Asaas recusou: ' + e.message }); }
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
      "SELECT COUNT(*) FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=CURRENT_DATE AND status NOT IN ('cancelado','ausente')",
      [aula.id]
    );
    const reservadas = parseInt(reservas.rows[0].count);
    const vagas_livres = Math.max(0, _capVagas(aula.vagas_max, await tetoLicenca(licId)) - reservadas);

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
        const max_conexoes = _tetoDe(lic.rows[0]) || aula.vagas_max || 1;   // 24/09: teto da licenca
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
      'SELECT max_bikes, bikes_disponiveis, max_alunos, plano, nome_fantasia, nome, cidade FROM licencas WHERE codigo=$1',
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
         WHERE r.agenda_id=a.id AND r.data_aula=CURRENT_DATE AND r.status NOT IN ('cancelado','ausente')) as reservas_hoje
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
  const { nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala, modo_inicio, janela_reserva, cor } = req.body;
  if (!nome || dia_semana === undefined || !hora)
    return res.status(400).json({ error: 'nome, dia_semana e hora obrigatórios' });
  try {
    // buscar cidade e capacidade operacional da licença
    const lic = await db.query('SELECT cidade, max_bikes, bikes_disponiveis FROM licencas WHERE codigo=$1', [req.user.license_id]);
    const cidade            = lic.rows[0]?.cidade            || null;
    const max_bikes         = lic.rows[0]?.max_bikes         || 0;
    const bikes_disponiveis = lic.rows[0]?.bikes_disponiveis || max_bikes || 0;
    const teto = bikes_disponiveis > 0 ? bikes_disponiveis : max_bikes;
    const vagasSolicitadas = parseInt(vagas_max) || teto || 20;
    if (teto > 0 && vagasSolicitadas > teto)
      return res.status(400).json({
        error: `A sala tem ${teto} bikes disponíveis no momento. Você não pode configurar mais vagas do que isso.`
      });
    const modoValido = ['automatico','professor'].includes(modo_inicio) ? modo_inicio : 'professor';
    // janela_reserva em horas; vazio ou 0 = sem limite (guardado como NULL)
    const janela = (janela_reserva === '' || janela_reserva === null || janela_reserva === undefined)
      ? null : (parseInt(janela_reserva) || null);
    const r = await db.query(`
      INSERT INTO aulas_agenda (license_id, nome, professor_nome, dia_semana, hora, duracao_min, vagas_max, sala, cidade, modo_inicio, janela_reserva, cor)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [req.user.license_id, nome, professor_nome||null, dia_semana, hora, duracao_min||50, vagasSolicitadas, sala||null, cidade, modoValido, janela, cor||null]);
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
    const vagasSolicitadas = parseInt(vagas_max) || teto || 20;
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
app.get('/gestor/agenda/:id/reservas', professorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const data = req.query.data || new Date().toISOString().split('T')[0];
  try {
    const aula = await db.query('SELECT vagas_max, license_id FROM aulas_agenda WHERE id=$1', [req.params.id]);
    if (!aula.rows.length) return res.status(404).json({ error: 'Aula não encontrada' });
    if (!await temAcessoLicenca(req.user, aula.rows[0].license_id))
      return res.status(403).json({ error: 'Sem acesso a esta unidade' });
    const r = await db.query(`
      SELECT r.id, r.status, r.bike_numero, r.created_at, u.id as user_id, u.name, u.email, u.ftp
      FROM aulas_reservas r
      JOIN users u ON u.id=r.user_id
      WHERE r.agenda_id=$1 AND r.data_aula=$2
      ORDER BY r.created_at
    `, [req.params.id, data]);
    const vagas_max = _capVagas(aula.rows[0].vagas_max, await tetoLicenca(aula.rows[0].license_id));
    const confirmados = r.rows.filter(x => x.status !== 'cancelado').length;
    res.json({ reservas: r.rows, vagas_max, confirmados, vagas_livres: vagas_max - confirmados });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Check-in / alterar status da reserva (professor/gestor)
app.put('/gestor/reservas/:id/status', professorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { status } = req.body; // presente | ausente | cancelado | reservado
  if (!['presente','ausente','cancelado','reservado'].includes(status))
    return res.status(400).json({ error: 'Status inválido' });
  try {
    const licR = await db.query(
      'SELECT a.license_id FROM aulas_reservas r JOIN aulas_agenda a ON a.id=r.agenda_id WHERE r.id=$1',
      [req.params.id]
    );
    if (!licR.rows.length) return res.status(404).json({ error: 'Reserva não encontrada' });
    if (!await temAcessoLicenca(req.user, licR.rows[0].license_id))
      return res.status(403).json({ error: 'Sem acesso a esta unidade' });
    const r = await db.query(
      "UPDATE aulas_reservas SET status=$1 WHERE id=$2 RETURNING *, to_char(data_aula,'YYYY-MM-DD') AS data_iso",
      [status, req.params.id]
    );
    // 02/10c: professor liberou a vaga → vai para a lista de espera
    if (r.rows[0] && (status === 'ausente' || status === 'cancelado')) await esPromover(r.rows[0].agenda_id, r.rows[0].data_iso, r.rows[0].bike_numero);
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
// GESTÃO DE PROFESSORES POR LICENÇA
// ══════════════════════════════════════════════════════════════

// Listar professores com acesso à licença do gestor
app.get('/gestor/professores', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT pl.id, pl.created_at, u.id as user_id, u.name, u.email,
             lb.name as liberado_por_nome
      FROM professor_licencas pl
      JOIN users u ON u.id = pl.user_id
      LEFT JOIN users lb ON lb.id = pl.liberado_por
      WHERE pl.license_id = $1
      ORDER BY pl.created_at
    `, [req.user.license_id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Adicionar professor à licença (por e-mail — a conta já deve existir com role=professor)
// super_admin pode especificar license_id no body; gestor usa o próprio
app.post('/gestor/professores', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { email, license_id: licBody } = req.body;
  if (!email) return res.status(400).json({ error: 'email obrigatório' });
  const licenseId = licBody || req.user.license_id;
  if (!licenseId) return res.status(400).json({ error: 'license_id obrigatório' });
  try {
    const u = await db.query(
      "SELECT id, name, role FROM users WHERE email=$1",
      [email.toLowerCase()]
    );
    if (!u.rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    const r = await db.query(`
      INSERT INTO professor_licencas (user_id, license_id, liberado_por)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, license_id) DO NOTHING
      RETURNING *
    `, [u.rows[0].id, licenseId, req.user.id]);
    res.json({ ok: true, user: u.rows[0], ja_existia: r.rows.length === 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Remover professor da licença (histórico de aulas preservado)
app.delete('/gestor/professores/:userId', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    await db.query(
      'DELETE FROM professor_licencas WHERE user_id=$1 AND license_id=$2',
      [req.params.userId, req.user.license_id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Professor: listar as licenças onde tem acesso (qualquer utilizador autenticado) ──
app.get('/professor/licencas', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT l.codigo, l.nome, l.plano, pl.created_at as acesso_desde
      FROM professor_licencas pl
      JOIN licencas l ON l.codigo = pl.license_id
      WHERE pl.user_id = $1
      ORDER BY pl.created_at
    `, [req.user.id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// AGENDA — PÚBLICO (busca por cidade, sem autenticação)
// ══════════════════════════════════════════════════════════════

// Aula ativa agora numa licença — sem autenticação (mesma info do QR na parede)
app.get('/agenda/aula-ativa/:license_id', async (req, res) => {
  // 29/09a: a sala do Ginásio sabe a academia (token do display no
  // criar_sala). Aula ativa = Ginásio conectado com a sala aberta: da
  // pré-aula (tela do QR) até o fim. Vale também para aula fora da grade.
  const r = aulaAtivaDe(req.params.license_id);
  if (r) return res.json(r);
  // legado: sessões criadas pelo Portal (sessoes_ao_vivo)
  for (const [codigo, sala] of Object.entries(salas)) {
    if (sala.professor && sala.professor.readyState === WebSocket.OPEN && db) {
      try {
        const q = await db.query("SELECT sv.token, sv.nome_aula, u.name as professor FROM sessoes_ao_vivo sv LEFT JOIN users u ON u.id=sv.professor_id WHERE sv.token=$1 AND sv.status IN ('ativa','em_andamento') AND sv.license_id=$2 LIMIT 1", [codigo, req.params.license_id]);
        if (q.rows.length) return res.json({ ativa: true, codigo: q.rows[0].token, nome_aula: q.rows[0].nome_aula || sala.estado.nomeAula || '', professor: q.rows[0].professor || '' });
      } catch (e) {}
    }
  }
  res.json({ ativa: false });
});
function aulaAtivaDe(licId) {
  for (const [codigo, sala] of Object.entries(salas)) {
    if (!sala.licenca || String(sala.licenca) !== String(licId)) continue;
    if (!sala.professor || sala.professor.readyState !== WebSocket.OPEN) continue;
    if (sala.estado && sala.estado.encerrada) continue;
    const info = sala.lastSalaInfo || {};
    const pedalando = [...sala.alunos.values()].filter(w => w.readyState === WebSocket.OPEN).length + (sala.totem ? sala.totem.size : 0);
    const num = parseInt(info.numBikes) || 0;
    const ocupadas = (info.ocupadas || []).length;
    const pre = sala.preAula || {};
    return {
      ativa: true, codigo,
      nome_aula: (sala.estado && sala.estado.nomeAula) || pre.nome || 'Aula ao vivo',
      professor: pre.professor || '', duracao_min: pre.duracao_min || null,
      iniciada: !!(sala.estado && sala.estado.iniciada),
      desde: pre.desde || null,
      pedalando, bikes: num, livres: num ? Math.max(0, num - ocupadas) : null,
      bikes_lista: info.bikes || [], ocupadas: info.ocupadas || [],
      transmitindo: !!(sala.tx && sala.tx.ativo)   // 02/10b: dá para assistir no app
    };
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
// 29/09a — NÚMEROS PÚBLICOS, PÁGINA DA ACADEMIA E TOTEM
// ══════════════════════════════════════════════════════════════
// Km: o banco guarda potência média e duração, não distância. A distância
// é estimada pela potência (modelo de ciclismo em plano, CdA·ρ ≈ 0,5 · v³):
// v (m/s) = (P / 0,25)^(1/3). 200 W ≈ 33 km/h.
const SQL_KM = `COALESCE(SUM( (ah.dur_seg/3600.0) * 3.6 * POWER(GREATEST(COALESCE(ah.avg_watts,0),0)/0.25, 1.0/3) ),0)`;
let _pubStatsCache = null, _pubStatsEm = 0;
app.get('/public/stats', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=20');
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    if (!_pubStatsCache || Date.now() - _pubStatsEm > 30000) {
      const hojeBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const hoje = hojeBR.getFullYear() + '-' + String(hojeBR.getMonth() + 1).padStart(2, '0') + '-' + String(hojeBR.getDate()).padStart(2, '0');
      const [u, a, h] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS atletas,
                         COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '7 days')::int AS novos_7d,
                         COALESCE(SUM(points),0)::bigint AS wpp_total FROM users`),
        db.query(`SELECT COUNT(*)::int AS aulas, COALESCE(SUM(kcal),0)::bigint AS kcal,
                         COALESCE(SUM(dur_seg),0)::bigint AS seg, ${SQL_KM} AS km,
                         COUNT(*) FILTER (WHERE data_aula >= $1::date)::int AS aulas_hoje,
                         COALESCE(SUM(kcal) FILTER (WHERE data_aula >= $1::date),0)::bigint AS kcal_hoje
                  FROM aula_historico ah`, [hoje]),
        db.query(`SELECT COALESCE(SUM(dur_seg),0)::bigint AS seg_mes_passado FROM aula_historico WHERE data_aula BETWEEN NOW()-INTERVAL '60 days' AND NOW()-INTERVAL '30 days'`),
      ]);
      const x = Object.assign({}, u.rows[0], a.rows[0]);
      _pubStatsCache = {
        atletas: x.atletas, novos_7d: x.novos_7d, wpp_total: Number(x.wpp_total),
        aulas: x.aulas, aulas_hoje: x.aulas_hoje, kcal: Number(x.kcal), kcal_hoje: Number(x.kcal_hoje),
        horas: Math.round(Number(x.seg) / 3600), km: Math.round(Number(x.km)),
      };
      _pubStatsEm = Date.now();
    }
    // ao vivo: sempre na hora (memória)
    let aulas = 0, bikes = 0;
    for (const sala of Object.values(salas)) {
      if (!sala.professor || sala.professor.readyState !== WebSocket.OPEN) continue;
      const n = [...sala.alunos.values()].filter(w => w.readyState === WebSocket.OPEN).length + (sala.totem ? sala.totem.size : 0);
      if (sala.estado && sala.estado.iniciada && !sala.estado.encerrada) aulas++;
      bikes += n;
    }
    res.json(Object.assign({}, _pubStatsCache, { ao_vivo: { aulas, bikes } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function numerosAcademia(lic) {
  if (!db || !lic) return null;
  try {
    const r = await db.query(`SELECT COUNT(*)::int AS aulas, COALESCE(SUM(ah.kcal),0)::bigint AS kcal, ${SQL_KM} AS km,
        COUNT(DISTINCT ah.user_id)::int AS atletas_com_aula
      FROM aula_historico ah JOIN users u ON u.id=ah.user_id WHERE u.license_id=$1`, [lic]);
    const t = await db.query(`SELECT COUNT(*)::int AS atletas FROM users WHERE license_id=$1 AND role='aluno'`, [lic]);
    const x = r.rows[0];
    return { aulas: x.aulas, kcal: Number(x.kcal), km: Math.round(Number(x.km)), atletas: t.rows[0].atletas };
  } catch (e) { return null; }
}

// ── Página pública da academia (para o site dela) ────────────
const PAGINA_PADRAO = { numeros: true, grade: true, ranking: true, fotos: true, aovivo: true, cor: '#ea860c', ranking_por: 'aulas' };
function paginaCfgLimpa(c) {
  c = c || {};
  const o = {};
  ['numeros', 'grade', 'ranking', 'fotos', 'aovivo'].forEach(k => { o[k] = c[k] === undefined ? PAGINA_PADRAO[k] : !!c[k]; });
  o.cor = /^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : PAGINA_PADRAO.cor;
  o.ranking_por = ['aulas', 'kcal', 'pontos'].includes(c.ranking_por) ? c.ranking_por : 'aulas';
  return o;
}
app.get('/public/academia/:codigo', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=20');
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const l = await db.query(`SELECT codigo, nome, nome_fantasia, COALESCE(NULLIF(cidade,''), cidade_lic) AS cidade, estado,
        logradouro, numero, bairro, max_bikes, bikes_disponiveis, pagina_cfg FROM licencas WHERE UPPER(codigo)=UPPER($1) AND status='ativa'`, [req.params.codigo]);
    if (!l.rows.length) return res.status(404).json({ error: 'Academia não encontrada' });
    const L = l.rows[0], cfg = paginaCfgLimpa(L.pagina_cfg), teto = _tetoDe(L);
    const out = { academia: { codigo: L.codigo, nome: L.nome_fantasia || L.nome, cidade: L.cidade, estado: L.estado,
      endereco: [L.logradouro, L.numero].filter(Boolean).join(', ') + (L.bairro ? ' — ' + L.bairro : ''), bikes: teto }, cfg };
    if (cfg.numeros) out.numeros = await numerosAcademia(L.codigo);
    if (cfg.grade) {
      const g = await db.query(`SELECT a.id, a.nome, COALESCE(p.name, a.professor_nome) AS professor_nome, a.dia_semana, a.hora, a.duracao_min, a.vagas_max, a.cor
        FROM aulas_agenda a LEFT JOIN users p ON p.id=a.professor_id WHERE a.license_id=$1 AND a.ativa=TRUE ORDER BY a.dia_semana, a.hora`, [L.codigo]);
      out.grade = g.rows.map(a => Object.assign(a, { vagas_max: _capVagas(a.vagas_max, teto) }));
    }
    if (cfg.ranking) {
      const ord = cfg.ranking_por === 'kcal' ? 'kcal DESC' : cfg.ranking_por === 'pontos' ? 'u.points DESC' : 'aulas DESC, kcal DESC';
      const rk = await db.query(`SELECT u.name, u.points, u.level, ${cfg.fotos ? 'u.foto_url' : 'NULL AS foto_url'},
          COUNT(ah.id)::int AS aulas, COALESCE(SUM(ah.kcal),0)::int AS kcal
        FROM users u JOIN aula_historico ah ON ah.user_id=u.id
        WHERE u.license_id=$1 AND ah.data_aula >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
        GROUP BY u.id ORDER BY ${ord} LIMIT 10`, [L.codigo]);
      // só o primeiro nome + inicial: página pública
      out.ranking = rk.rows.map(r => ({ nome: _nomeCurto(r.name), aulas: r.aulas, kcal: r.kcal, pontos: r.points, nivel: calcLevel(r.points), foto: r.foto_url || null }));
    }
    if (cfg.aovivo) { const a = aulaAtivaDe(L.codigo); out.ao_vivo = a ? { nome_aula: a.nome_aula, professor: a.professor, pedalando: a.pedalando, iniciada: a.iniciada } : null; }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
function _nomeCurto(n) { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : (p[0] || 'Atleta'); }
app.get('/gestor/pagina', gestorAuth, async (req, res) => {
  try {
    const r = await db.query('SELECT pagina_cfg, codigo FROM licencas WHERE codigo=$1', [req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    res.json({ cfg: paginaCfgLimpa(r.rows[0].pagina_cfg), codigo: r.rows[0].codigo, url: PORTAL_URL + '/academia-publica.html?c=' + encodeURIComponent(r.rows[0].codigo) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/gestor/pagina', gestorAuth, async (req, res) => {
  if (!['gestor', 'admin', 'super_admin'].includes(req.user.role) && !req.user.impersonated_by) return res.status(403).json({ error: 'Só o gestor altera a página.' });
  try {
    const cfg = paginaCfgLimpa(req.body);
    await db.query('UPDATE licencas SET pagina_cfg=$1, updated_at=NOW() WHERE codigo=$2', [JSON.stringify(cfg), req.user.license_id]);
    res.json({ ok: true, cfg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Totem (tablet na porta da sala) ──────────────────────────
// O gestor gera no Portal um link com um código secreto da licença. O
// tablet abre esse link e fica preso nele. O código pode ser trocado a
// qualquer momento (o link antigo para de funcionar).
async function totemLic(token) {
  if (!db || !token || String(token).length < 16) return null;
  const r = await db.query("SELECT codigo, nome, nome_fantasia, max_bikes, bikes_disponiveis FROM licencas WHERE totem_token=$1 AND status='ativa'", [String(token)]);
  return r.rows[0] || null;
}
app.get('/gestor/totem', gestorAuth, async (req, res) => {
  try {
    let r = await db.query('SELECT totem_token FROM licencas WHERE codigo=$1', [req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    let t = r.rows[0].totem_token;
    if (!t || req.query.novo === '1') {
      if (req.query.novo === '1' && !['gestor', 'admin', 'super_admin'].includes(req.user.role) && !req.user.impersonated_by) return res.status(403).json({ error: 'Só o gestor troca o código.' });
      t = crypto.randomBytes(12).toString('hex');
      await db.query('UPDATE licencas SET totem_token=$1 WHERE codigo=$2', [t, req.user.license_id]);
    }
    res.json({ token: t, url: PORTAL_URL + '/totem.html#' + t });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
function _hojeBR() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return { d, iso: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
}
app.get('/totem/:t/info', async (req, res) => {
  try {
    const L = await totemLic(req.params.t); if (!L) return res.status(404).json({ error: 'Totem desativado. Peça ao gestor um link novo.' });
    const teto = _tetoDe(L), { d, iso } = _hojeBR();
    // hoje e amanhã
    const dias = [d.getDay(), (d.getDay() + 1) % 7];
    const g = await db.query(`SELECT a.id, a.nome, COALESCE(p.name, a.professor_nome) AS professor_nome, a.dia_semana, a.hora, a.duracao_min, a.vagas_max, a.cor,
        (SELECT COUNT(*)::int FROM aulas_reservas r WHERE r.agenda_id=a.id AND r.status NOT IN ('cancelado','ausente')
           AND r.data_aula = ($2::date + ((a.dia_semana - EXTRACT(DOW FROM $2::date)::int + 7) % 7) * INTERVAL '1 day')::date) AS reservas
      FROM aulas_agenda a LEFT JOIN users p ON p.id=a.professor_id
      WHERE a.license_id=$1 AND a.ativa=TRUE AND a.dia_semana = ANY($3::int[]) ORDER BY ((a.dia_semana - $4 + 7) % 7), a.hora`, [L.codigo, iso, dias, d.getDay()]);
    const agoraMin = d.getHours() * 60 + d.getMinutes();
    const aulas = g.rows.map(a => {
      const [hh, mm] = String(a.hora).split(':').map(Number);
      const off = (a.dia_semana - d.getDay() + 7) % 7;
      const data = new Date(d.getTime() + off * 864e5);
      return Object.assign(a, { vagas_max: _capVagas(a.vagas_max, teto), data: data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0'), hoje: off === 0 });
    }).filter(a => !a.hoje || (parseInt(String(a.hora).slice(0, 2)) * 60 + parseInt(String(a.hora).slice(3, 5)) + (a.duracao_min || 50)) > agoraMin);
    res.json({ academia: { nome: L.nome_fantasia || L.nome, bikes: teto }, aulas, ao_vivo: aulaAtivaDe(L.codigo) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Identifica pelo e-mail (sem senha: o totem fica dentro da academia).
// Devolve só o primeiro nome, o FTP e se tem foto — nada além disso.
app.post('/totem/:t/identificar', async (req, res) => {
  try {
    const L = await totemLic(req.params.t); if (!L) return res.status(404).json({ error: 'Totem desativado.' });
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!/@/.test(email)) return res.status(400).json({ error: 'E-mail inválido' });
    const r = await db.query('SELECT id, name, ftp, foto_url, license_id, role, sexo, points FROM users WHERE email=$1', [email]);
    if (!r.rows.length) return res.status(404).json({ error: 'Não achamos este e-mail. Faça o cadastro rápido.' });
    const u = r.rows[0];
    if (!u.license_id && u.role === 'aluno') await db.query('UPDATE users SET license_id=$1 WHERE id=$2', [L.codigo, u.id]);
    res.json({ id: u.id, nome: u.name, primeiro: String(u.name || '').split(' ')[0], ftp: u.ftp || 130, tem_foto: !!u.foto_url, genero: u.sexo || null, nivel: calcLevel(u.points) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// FTP estimado pelo questionário rápido (3 perguntas): nível × peso.
function ftpQuestionario(q) {
  const peso = Math.min(160, Math.max(35, parseFloat(q.peso) || 70));
  const nivel = { iniciante: 1.6, intermediario: 2.2, avancado: 2.9, atleta: 3.5 }[q.nivel] || 2.0;
  const freq = { '0': 0.92, '1': 1.0, '2': 1.05, '3': 1.1 }[String(q.freq)] || 1.0;
  return Math.round(peso * nivel * freq / 5) * 5;
}
app.post('/totem/:t/cadastro', async (req, res) => {
  try {
    const L = await totemLic(req.params.t); if (!L) return res.status(404).json({ error: 'Totem desativado.' });
    const b = req.body || {};
    const nome = String(b.nome || '').trim().slice(0, 60);
    if (nome.length < 2) return res.status(400).json({ error: 'Digite o nome' });
    let ftp = parseInt(b.ftp) || 0;
    if (!ftp && b.questionario) ftp = ftpQuestionario(b.questionario);
    if (!ftp) ftp = 130;
    ftp = Math.min(500, Math.max(50, ftp));
    let foto = null;
    if (b.foto && /^data:image\/(jpeg|png|webp);base64,/.test(b.foto) && b.foto.length < 300000) foto = b.foto;
    const genero = (b.genero === 'F' || b.genero === 'M') ? b.genero : null;
    const email = String(b.email || '').trim().toLowerCase();
    if (!email) {
      // sem conta: vale só para esta aula
      return res.json({ convidado: true, nome, ftp, foto, genero });
    }
    if (!/@/.test(email)) return res.status(400).json({ error: 'E-mail inválido' });
    const ex = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (ex.rows.length) return res.status(409).json({ error: 'Este e-mail já tem conta. Use "Reservar com e-mail".' });
    const senhaTemp = 'PR-' + crypto.randomBytes(4).toString('hex');
    const ins = await db.query(`INSERT INTO users (email, name, password_hash, role, license_id, ftp, sexo, foto_url, peso)
      VALUES ($1,$2,$3,'aluno',$4,$5,$6,$7,$8) RETURNING id`,
      [email, nome, await bcrypt.hash(senhaTemp, 10), L.codigo, ftp, genero, foto, b.questionario && parseFloat(b.questionario.peso) || 70]);
    emailBoasVindas({ userId: ins.rows[0].id, email, nome, academia: L.nome_fantasia || L.nome, licId: L.codigo, senhaTemp, papel: 'aluno_totem' }).catch(() => {});
    res.json({ id: ins.rows[0].id, nome, primeiro: nome.split(' ')[0], ftp, genero, nivel: 'aquecimento', conta_criada: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/totem/:t/foto', async (req, res) => {
  try {
    const L = await totemLic(req.params.t); if (!L) return res.status(404).json({ error: 'Totem desativado.' });
    const { user_id, foto } = req.body || {};
    if (!foto || !/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 300000) return res.status(400).json({ error: 'Foto inválida' });
    await db.query('UPDATE users SET foto_url=$1 WHERE id=$2 AND license_id=$3', [foto, parseInt(user_id), L.codigo]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Núcleo da reserva, igual ao /aluno/reservar (vagas, janela, teto de bikes)
async function reservarAula(userId, agenda_id, data_aula) {
  const aula = await db.query('SELECT vagas_max, hora, janela_reserva, nome, license_id FROM aulas_agenda WHERE id=$1 AND ativa=TRUE', [agenda_id]);
  if (!aula.rows.length) return [404, { error: 'Aula não encontrada' }];
  const A = aula.rows[0];
  if (A.janela_reserva !== null && A.janela_reserva !== undefined) {
    const inicio = new Date(String(data_aula) + 'T' + String(A.hora));
    if (new Date() < new Date(inicio.getTime() - A.janela_reserva * 3600 * 1000)) return [425, { error: 'A reserva desta aula ainda não abriu.' }];
  }
  const conf = await db.query("SELECT COUNT(*) FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=$2 AND status NOT IN ('cancelado','ausente')", [agenda_id, data_aula]);
  const teto = await tetoLicenca(A.license_id);
  if (parseInt(conf.rows[0].count) >= _capVagas(A.vagas_max, teto)) return [409, { error: 'Aula lotada' }];
  const r = await db.query(`INSERT INTO aulas_reservas (agenda_id, user_id, data_aula) VALUES ($1,$2,$3)
    ON CONFLICT (agenda_id, user_id, data_aula) DO UPDATE SET status='reservado' RETURNING *`, [agenda_id, userId, data_aula]);
  return [200, Object.assign(r.rows[0], { aula_nome: A.nome, hora: A.hora })];
}
app.post('/totem/:t/reservar', async (req, res) => {
  try {
    const L = await totemLic(req.params.t); if (!L) return res.status(404).json({ error: 'Totem desativado.' });
    const { user_id, agenda_id, data_aula } = req.body || {};
    const ok = await db.query('SELECT 1 FROM aulas_agenda WHERE id=$1 AND license_id=$2', [parseInt(agenda_id), L.codigo]);
    if (!ok.rows.length) return res.status(404).json({ error: 'Aula não encontrada' });
    const [st, body] = await reservarAula(parseInt(user_id), parseInt(agenda_id), data_aula);
    res.status(st).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Entrar na aula aberta agora, numa bike, sem celular: o Ginásio passa a
// mostrar o nome (e a foto) na bike escolhida e calcula tudo pelo FTP dado.
app.post('/totem/:t/entrar', async (req, res) => {
  try {
    const L = await totemLic(req.params.t); if (!L) return res.status(404).json({ error: 'Totem desativado.' });
    const b = req.body || {};
    const at = aulaAtivaDe(L.codigo);
    if (!at) return res.status(409).json({ error: 'Nenhuma aula aberta agora.' });
    const sala = salas[at.codigo];
    const bike = parseInt(b.bike);
    if (!bike || (at.bikes && (bike < 1 || bike > at.bikes))) return res.status(400).json({ error: 'Escolha uma bike válida.' });
    if ((at.ocupadas || []).map(Number).includes(bike)) return res.status(409).json({ error: 'Esta bike já está ocupada.' });
    if (sala.trancadas && sala.trancadas.has(bike)) return res.status(409).json({ error: 'Esta bike está em manutenção.' });
    let nome = String(b.nome || '').trim().slice(0, 40), ftp = parseInt(b.ftp) || 130, foto = b.foto || null, genero = b.genero || null, nivel = null;
    if (b.user_id) {
      const u = await db.query('SELECT name, ftp, foto_url, sexo, points FROM users WHERE id=$1', [parseInt(b.user_id)]);
      if (u.rows.length) { nome = u.rows[0].name; ftp = u.rows[0].ftp || ftp; foto = u.rows[0].foto_url || foto; genero = u.rows[0].sexo || genero; nivel = calcLevel(u.rows[0].points); }
    }
    if (!nome) return res.status(400).json({ error: 'Falta o nome' });
    if (sala.alunos.has(nome) || (sala.totem && sala.totem.has(nome))) nome = nome + ' (' + bike + ')';
    if (!sala.totem) sala.totem = new Map();
    sala.totem.set(nome, { bike, ftp, user_id: b.user_id || null, em: Date.now() });
    if (sala.professor && sala.professor.readyState === WebSocket.OPEN)
      sala.professor.send(JSON.stringify({ tipo: 'aluno_conectou', nome, bike, foto: (foto && foto.length < 300000) ? foto : null, ftpBase: ftp,
        genero: (genero === 'F' || genero === 'M') ? genero : null, nivel, totem: true, horario: new Date().toLocaleTimeString('pt-BR') }));
    if (b.user_id && db) {
      const { iso } = _hojeBR();
      db.query(`UPDATE aulas_reservas r SET status='presente', bike_numero=$1 FROM aulas_agenda a
        WHERE r.agenda_id=a.id AND a.license_id=$2 AND r.user_id=$3 AND r.data_aula=$4 AND r.status='reservado'`, [bike, L.codigo, parseInt(b.user_id), iso]).catch(() => {});
    }
    log(`Totem: ${nome} entrou na bike ${bike} (sala ${at.codigo})`);
    res.json({ ok: true, nome, bike, aula: at.nome_aula });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// LOCALIZAÇÃO DAS ACADEMIAS (29/09c) — "Perto de mim" na lupinha do app
// ══════════════════════════════════════════════════════════════
// A academia ganha latitude/longitude de 3 jeitos (geo_fonte):
//   'gps'      — o gestor, estando na academia, toca "usar a localização
//                deste aparelho" no Portal (o mais preciso);
//   'manual'   — o gestor cola coordenadas ou um link do Google Maps;
//   'endereco' — o servidor procura o endereço cadastrado no mapa
//                (OpenStreetMap/Nominatim, grátis) sempre que o endereço
//                muda. Nunca sobrescreve 'gps' nem 'manual'.
// O celular do aluno manda a posição só na busca; o servidor não grava.
function geoNum(v, lim) { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).trim().replace(',', '.')); return (isFinite(n) && Math.abs(n) <= lim) ? n : null; }
function geoDistKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// aceita "-23.55, -46.70" ou links do Google Maps (@-23.55,-46.70 / q=-23.55,-46.70 / !3d-23.55!4d-46.70)
function geoDeTexto(t) {
  t = String(t || '');
  let m = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(t)
       || /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(t)
       || /[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(t)
       || /^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/.exec(t);
  if (!m) return null;
  const lat = geoNum(m[1], 90), lng = geoNum(m[2], 180);
  return (lat === null || lng === null || (lat === 0 && lng === 0)) ? null : { lat, lng };
}
const GEOCODER_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
let _geoUltima = 0;
async function geoBuscarEndereco(L) {
  // tenta o endereço completo; se não achar, rua + cidade; por último o CEP
  const cidade = L.cidade_lic || L.cidade, uf = L.estado, pais = L.pais || 'Brasil';
  const tentativas = [];
  if (L.logradouro && cidade) tentativas.push([L.logradouro + (L.numero ? ', ' + L.numero : ''), L.bairro, cidade, uf, pais].filter(Boolean).join(', '));
  if (L.logradouro && cidade) tentativas.push([L.logradouro, cidade, uf, pais].filter(Boolean).join(', '));
  if (L.cep) tentativas.push([String(L.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2'), pais].join(', '));
  for (const q of tentativas) {
    const espera = 1100 - (Date.now() - _geoUltima); if (espera > 0) await new Promise(r => setTimeout(r, espera)); // regra do Nominatim: 1 por segundo
    _geoUltima = Date.now();
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(GEOCODER_URL + '?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(q),
        { headers: { 'User-Agent': 'ProRider/1.0 (' + (process.env.GEOCODER_EMAIL || 'contato@prorider.app') + ')', 'Accept-Language': 'pt-BR' }, signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j) && j.length) { const lat = geoNum(j[0].lat, 90), lng = geoNum(j[0].lon, 180); if (lat !== null && lng !== null) return { lat, lng, q }; }
    } catch (e) { log('geo: ' + e.message); }
  }
  return null;
}
// procura pelo endereço, a não ser que o gestor já tenha marcado no GPS/manual
async function geoAtualizarPorEndereco(codigoOuId, forcar) {
  if (!db) return null;
  const r = await db.query('SELECT * FROM licencas WHERE ' + (typeof codigoOuId === 'number' ? 'id=$1' : 'codigo=$1'), [codigoOuId]);
  const L = r.rows[0]; if (!L) return null;
  if (!forcar && ['gps', 'manual'].includes(L.geo_fonte)) return null;
  const g = await geoBuscarEndereco(L);
  if (!g) return null;
  await db.query("UPDATE licencas SET lat=$1, lng=$2, geo_fonte='endereco', geo_em=NOW() WHERE id=$3", [g.lat, g.lng, L.id]);
  log('geo: ' + L.codigo + ' → ' + g.lat + ',' + g.lng);
  return g;
}
async function geoPreencherFaltando() {
  if (!db) return;
  const r = await db.query(`SELECT id FROM licencas WHERE status='ativa' AND lat IS NULL AND geo_em IS NULL
    AND ((logradouro IS NOT NULL AND COALESCE(cidade_lic, cidade) IS NOT NULL) OR cep IS NOT NULL) LIMIT 50`);
  for (const x of r.rows) {
    const g = await geoAtualizarPorEndereco(x.id, false);
    if (!g) await db.query('UPDATE licencas SET geo_em=NOW() WHERE id=$1 AND lat IS NULL', [x.id]); // não tenta de novo a cada reinício
  }
}

// Buscar academias (lupinha). Sem posição: igual antes (por cidade).
// Com ?lat=&lng= (celular do aluno): traz dist_km e vem ordenado por
// distância. Toda academia com aula acontecendo agora vem com ao_vivo.
app.get('/agenda/cidades', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT l.codigo, l.nome, l.nome_fantasia, COALESCE(NULLIF(l.cidade,''), l.cidade_lic) AS cidade, l.estado, l.bairro,
             l.lat, l.lng,
             (SELECT COUNT(*) FROM aulas_agenda a WHERE a.license_id=l.codigo AND a.ativa=TRUE)::int AS n_aulas
      FROM licencas l
      WHERE l.status='ativa'
    `);
    const uLat = geoNum(req.query.lat, 90), uLng = geoNum(req.query.lng, 180), comPos = uLat !== null && uLng !== null;
    const out = [];
    for (const l of r.rows) {
      const av = aulaAtivaDe(l.codigo);
      if (!l.n_aulas && !av) continue;                                 // sem grade e sem aula agora: não aparece
      const temGeo = l.lat !== null && l.lng !== null;
      if (!l.cidade && !temGeo) continue;
      const o = { codigo: l.codigo, nome: l.nome, nome_fantasia: l.nome_fantasia, cidade: l.cidade, estado: l.estado, bairro: l.bairro,
                  tem_localizacao: temGeo, ao_vivo: av ? { nome_aula: av.nome_aula, iniciada: av.iniciada, livres: av.livres } : null };
      if (comPos && temGeo) o.dist_km = Math.round(geoDistKm(uLat, uLng, Number(l.lat), Number(l.lng)) * 10) / 10;
      out.push(o);
    }
    out.sort((a, b) => comPos
      ? ((a.dist_km == null) - (b.dist_km == null)) || ((a.dist_km || 0) - (b.dist_km || 0)) || String(a.cidade || '').localeCompare(String(b.cidade || ''))
      : String(a.cidade || '').localeCompare(String(b.cidade || '')) || String(a.nome_fantasia || a.nome).localeCompare(String(b.nome_fantasia || b.nome)));
    res.json(out);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Portal do gestor: ver / marcar a localização da academia
app.get('/gestor/localizacao', gestorAuth, async (req, res) => {
  try {
    const r = await db.query('SELECT lat, lng, geo_fonte, geo_em, logradouro, numero, bairro, cep, COALESCE(NULLIF(cidade_lic,\'\'), cidade) AS cidade, estado FROM licencas WHERE codigo=$1', [req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Licença não encontrada' });
    const L = r.rows[0];
    res.json({ lat: L.lat === null ? null : Number(L.lat), lng: L.lng === null ? null : Number(L.lng), fonte: L.lat === null ? null : L.geo_fonte, em: L.geo_em,
      endereco: [[L.logradouro, L.numero].filter(Boolean).join(', '), L.bairro, [L.cidade, L.estado].filter(Boolean).join(' - '), L.cep].filter(Boolean).join(' · ') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/gestor/localizacao', gestorAuth, async (req, res) => {
  if (!['gestor', 'admin', 'super_admin'].includes(req.user.role) && !req.user.impersonated_by) return res.status(403).json({ error: 'Só o gestor marca a localização.' });
  try {
    const b = req.body || {};
    if (b.pelo_endereco) {
      const g = await geoAtualizarPorEndereco(req.user.license_id, true);
      if (!g) return res.status(422).json({ error: 'Não achei esse endereço no mapa. Confira o endereço da academia ou use a localização do aparelho estando lá.' });
      return res.json({ ok: true, lat: g.lat, lng: g.lng, fonte: 'endereco' });
    }
    let g = null, fonte = b.fonte === 'gps' ? 'gps' : 'manual';
    if (b.texto) g = geoDeTexto(b.texto);
    else { const lat = geoNum(b.lat, 90), lng = geoNum(b.lng, 180); if (lat !== null && lng !== null) g = { lat, lng }; }
    if (!g) return res.status(400).json({ error: 'Coordenadas inválidas. Cole algo como -23.5505, -46.6333 ou um link do Google Maps.' });
    await db.query('UPDATE licencas SET lat=$1, lng=$2, geo_fonte=$3, geo_em=NOW(), updated_at=NOW() WHERE codigo=$4', [g.lat, g.lng, fonte, req.user.license_id]);
    res.json({ ok: true, lat: g.lat, lng: g.lng, fonte });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Grade de uma academia específica (próximos 7 dias)
app.get('/agenda/grade/:license_id', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const [lic, aulas] = await Promise.all([
      db.query('SELECT codigo, nome, nome_fantasia, COALESCE(NULLIF(cidade,\'\'), cidade_lic) AS cidade, max_bikes, bikes_disponiveis FROM licencas WHERE codigo=$1 AND status=$2',
        [req.params.license_id, 'ativa']),
      db.query(`
        SELECT a.*,
          (SELECT COUNT(*) FROM aulas_reservas r
           WHERE r.agenda_id=a.id
             AND r.data_aula=CURRENT_DATE + ((a.dia_semana - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7) * INTERVAL '1 day'
             AND r.status NOT IN ('cancelado','ausente')) as reservas
        FROM aulas_agenda a
        WHERE a.license_id=$1 AND a.ativa=TRUE
        ORDER BY a.dia_semana, a.hora
      `, [req.params.license_id]),
    ]);
    if (!lic.rows.length) return res.status(404).json({ error: 'Academia não encontrada' });
    // 24/09: nenhuma aula mostra mais vagas do que a licenca tem de bikes
    const teto = _tetoDe(lic.rows[0]);
    const academia = Object.assign({}, lic.rows[0], { teto_bikes: teto });
    const lista = aulas.rows.map(a => Object.assign({}, a, { vagas_max: _capVagas(a.vagas_max, teto) }));
    res.json({ academia, aulas: lista });
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
      SELECT r.*, to_char(r.data_aula,'YYYY-MM-DD') AS data_aula, a.nome as aula_nome, a.hora, a.dia_semana, a.professor_nome,
             a.duracao_min, a.sala, l.nome as academia_nome, l.nome_fantasia, l.cidade
      FROM aulas_reservas r
      JOIN aulas_agenda a ON a.id=r.agenda_id
      JOIN licencas l ON l.codigo=a.license_id
      WHERE r.user_id=$1 AND r.data_aula >= CURRENT_DATE AND r.status NOT IN ('cancelado','ausente')
      ORDER BY r.data_aula, a.hora
    `, [req.user.id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 01/10b: quantas bikes a sala tem para reservar = bikes da licença (teto);
// sem teto, as vagas da aula. Nunca mais de 40.
async function _bikesDaAula(agendaId) {
  const a = await db.query('SELECT vagas_max, license_id FROM aulas_agenda WHERE id=$1', [agendaId]);
  if (!a.rows.length) return 0;
  const teto = await tetoLicenca(a.rows[0].license_id);
  return Math.min(40, teto || _capVagas(a.rows[0].vagas_max, 0));
}
// 01/10b: mapa das bikes de uma aula num dia — o app mostra antes de reservar
app.get('/aluno/agenda/:id/bikes', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const id = parseInt(req.params.id, 10) || 0, data = String(req.query.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'data obrigatória (AAAA-MM-DD)' });
    const total = await _bikesDaAula(id);
    if (!total) return res.status(404).json({ error: 'Aula não encontrada' });
    const r = await db.query(`SELECT user_id, bike_numero FROM aulas_reservas
      WHERE agenda_id=$1 AND data_aula=$2 AND status NOT IN ('cancelado','ausente') AND bike_numero IS NOT NULL`, [id, data]);
    let minha = null; const ocupadas = [];
    r.rows.forEach(x => { if (x.user_id === req.user.id) minha = x.bike_numero; else ocupadas.push(x.bike_numero); });
    const sem = await db.query(`SELECT COUNT(*)::int AS n FROM aulas_reservas
      WHERE agenda_id=$1 AND data_aula=$2 AND status NOT IN ('cancelado','ausente') AND bike_numero IS NULL AND user_id<>$3`, [id, data, req.user.id]);
    res.json({ total, ocupadas, minha, sem_bike: sem.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reservar vaga — 01/10b: com a BIKE escolhida (bike: 1..total). Reservar de
// novo a mesma aula troca a bike.
app.post('/aluno/reservar', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { agenda_id, data_aula } = req.body;
  if (!agenda_id || !data_aula) return res.status(400).json({ error: 'agenda_id e data_aula obrigatórios' });
  try {
    // verificar vagas
    const aula = await db.query('SELECT vagas_max, hora, janela_reserva, nome FROM aulas_agenda WHERE id=$1 AND ativa=TRUE', [agenda_id]);
    if (!aula.rows.length) return res.status(404).json({ error: 'Aula não encontrada' });

    // ── Janela de reserva ──────────────────────────────────────
    // O gestor define, POR AULA, quantas horas antes a reserva abre.
    // NULL = sem limite: reserva sempre aberta.
    const janela = aula.rows[0].janela_reserva;
    if (janela !== null && janela !== undefined) {
      const inicioAula = new Date(String(data_aula) + 'T' + String(aula.rows[0].hora));
      const abreEm = new Date(inicioAula.getTime() - janela * 3600 * 1000);
      const agora  = new Date();
      if (agora < abreEm) {
        return res.status(425).json({
          error: 'A reserva desta aula abre ' + janela + 'h antes, a partir de '
               + abreEm.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) + '.'
        });
      }
      if (agora > inicioAula) {
        return res.status(425).json({ error: 'Esta aula já começou.' });
      }
    }
    // quem já tem reserva nesta aula não conta (está só trocando de bike)
    const confirmados = await db.query(
      "SELECT COUNT(*) FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=$2 AND status NOT IN ('cancelado','ausente') AND user_id<>$3",
      [agenda_id, data_aula, req.user.id]
    );
    // 24/09: o limite e o menor entre as vagas da aula e as bikes da licenca
    const _licR = await db.query('SELECT a.license_id FROM aulas_agenda a WHERE a.id=$1', [agenda_id]);
    const _teto = await tetoLicenca(_licR.rows[0] && _licR.rows[0].license_id);
    if (parseInt(confirmados.rows[0].count) >= _capVagas(aula.rows[0].vagas_max, _teto))
      return res.status(409).json({ error: 'Aula lotada' });
    // 01/10b: bike escolhida
    let bike = null;
    if (req.body.bike != null && req.body.bike !== '') {
      bike = parseInt(req.body.bike, 10) || 0;
      const total = await _bikesDaAula(agenda_id);
      if (bike < 1 || bike > total) return res.status(400).json({ error: `Escolha uma bike de 1 a ${total}.` });
      const ocup = await db.query(`SELECT 1 FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=$2 AND status NOT IN ('cancelado','ausente')
        AND bike_numero=$3 AND user_id<>$4`, [agenda_id, data_aula, bike, req.user.id]);
      if (ocup.rows.length) return res.status(409).json({ error: `A bike ${bike} acabou de ser reservada por outra pessoa. Escolha outra.`, bike_ocupada: bike });
    }
    const r = await db.query(`
      INSERT INTO aulas_reservas (agenda_id, user_id, data_aula, bike_numero, liberar_apos)
      VALUES ($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')
      ON CONFLICT (agenda_id, user_id, data_aula) DO UPDATE SET status='reservado', bike_numero=COALESCE(EXCLUDED.bike_numero, aulas_reservas.bike_numero), liberar_apos=EXCLUDED.liberar_apos
      RETURNING *
    `, [agenda_id, req.user.id, data_aula, bike]);
    res.json(r.rows[0]);
  } catch(e) {
    if (e && e.code === '23505') return res.status(409).json({ error: 'Essa bike acabou de ser reservada por outra pessoa. Escolha outra.' });
    res.status(500).json({ error: e.message });
  }
});

// Cancelar reserva
app.delete('/aluno/reservar/:id', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const c = await db.query(
      "UPDATE aulas_reservas SET status='cancelado' WHERE id=$1 AND user_id=$2 AND status<>'cancelado' RETURNING agenda_id, to_char(data_aula,'YYYY-MM-DD') AS data_aula, bike_numero",
      [req.params.id, req.user.id]
    );
    // 02/10c: a vaga vai para o primeiro da lista de espera (na mesma bike)
    if (c.rows.length) await esPromover(c.rows[0].agenda_id, c.rows[0].data_aula, c.rows[0].bike_numero);
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
    const maxBikes = _tetoDe(academia) || 20;   // 24/09: disponiveis nunca acima do vendido

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
        vagas_total: _capVagas(proxAula.rows[0].vagas_max, _tetoDe(academia)),
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
    const maxBikes = _tetoDe(academia) || 20;   // 24/09: disponiveis nunca acima do vendido

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

// ── Limpeza de salas inativas, COM CARÊNCIA ────────────────────────
// Antes a sala era apagada assim que o professor caía, se não houvesse aluno
// conectado. Uma queda de poucos segundos — e elas acontecem: proxy, wi-fi,
// suspensão de rede — destruía a sala. O aluno que escaneasse o QR nesse
// intervalo recebia "Sala não encontrada", e o código na tela do Ginásio já não
// valia mais. Agora a sala só é removida depois de 3 MINUTOS sem professor.
const CARENCIA_SALA_MS = 3 * 60 * 1000;
setInterval(() => {
  const agora = Date.now();
  for (const [codigo, sala] of Object.entries(salas)) {
    const profOk = sala.professor && sala.professor.readyState === WebSocket.OPEN;
    if (profOk) { sala.profCaiuEm = null; continue; }
    // 26/09d: antes, havendo alunos na sala, o prazo nunca corria — com o
    // Ginasio fechado direto, os celulares ficavam "em aula" para sempre.
    // Agora os 3 minutos contam mesmo com alunos; no fim eles recebem
    // 'sala_encerrada' e o app fecha a aula e mostra o resultado.
    if (!sala.profCaiuEm) { sala.profCaiuEm = agora; continue; }   // começa a contar
    if (agora - sala.profCaiuEm >= CARENCIA_SALA_MS) {
      // avisa quem ainda estiver na sala ANTES de apaga-la, para o app do aluno
      // poder limpar o codigo guardado e nao tentar voltar para uma sala morta
      try { broadcastAlunos(codigo, { tipo: 'sala_encerrada' }); } catch(e) {}
      delete salas[codigo];
      log(`Sala removida apos ${Math.round((agora - sala.profCaiuEm)/1000)}s sem professor: ${codigo}`);
    }
  }
}, 30000);

// ── Batimento do servidor ──────────────────────────────────────────
// Duas funções: detectar conexões mortas (o socket pode ficar "aberto" para
// sempre quando a rede some sem avisar) e gerar tráfego que impede o proxy do
// Railway de derrubar a conexão por ociosidade — que é a causa mais provável
// do "servidor caiu" repetido fora da aula.
setInterval(() => {
  try {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) { try { ws.terminate(); } catch(e) {} return; }
      ws.isAlive = false;
      try { ws.ping(); } catch(e) {}
    });
  } catch(e) {}
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

// ══════════════════════════════════════════════════════════════
// TREINOS DO PROFESSOR (conta pessoal, authMiddleware)
// ══════════════════════════════════════════════════════════════
app.post('/professor/treinos', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, json } = req.body;
  if (!nome || !json) return res.status(400).json({ error: 'nome e json obrigatórios' });
  try {
    const dur = Array.isArray(json.blocos) ? json.blocos.reduce((a,b) => a + ((b.duracao_seg || b.duracao_min*60) || 0), 0) : null;
    const r = await db.query(
      'INSERT INTO treinos_professor (user_id, nome, json, duracao_sec) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.user.id, nome, json, dur]
    );
    res.json({ id: r.rows[0].id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/professor/treinos', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(
      'SELECT id, nome, duracao_sec, updated_at FROM treinos_professor WHERE user_id=$1 ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json({ treinos: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/professor/treinos/:id', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { nome, json } = req.body;
  try {
    const dur = Array.isArray(json && json.blocos) ? json.blocos.reduce((a,b) => a + ((b.duracao_seg || b.duracao_min*60) || 0), 0) : null;
    const r = await db.query(
      'UPDATE treinos_professor SET nome=COALESCE($1,nome), json=COALESCE($2,json), duracao_sec=COALESCE($3,duracao_sec), updated_at=NOW() WHERE id=$4 AND user_id=$5 RETURNING id',
      [nome||null, json||null, dur, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Treino não encontrado' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/professor/treinos/:id', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    await db.query('DELETE FROM treinos_professor WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Professor confirma pareamento (precisa ter acesso à licença)
app.post('/professor/parear', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ error: 'codigo obrigatório' });
  try {
    const pr = await db.query("SELECT * FROM pareamentos_ginasio WHERE codigo=$1", [codigo]);
    if (!pr.rows.length || new Date() > new Date(pr.rows[0].expira_em))
      return res.status(410).json({ error: 'Código expirado ou não encontrado' });
    const p = pr.rows[0];
    if (p.status === 'usado') return res.status(410).json({ error: 'Código já usado' });
    // 30/09e (Mario): o login de professor vale em QUALQUER academia — o
    // professor que dá aula em outra unidade da rede lê o QR e traz as aulas
    // DELE (a sessão só lê os treinos da própria conta). Aluno não pareia.
    const _pu = await db.query('SELECT role FROM users WHERE id=$1', [req.user.id]);
    const _papel = (_pu.rows[0] || {}).role || req.user.role;
    if (!['professor', 'coordenador', 'gestor', 'admin', 'super_admin'].includes(_papel))
      return res.status(403).json({ error: 'Só professor ou equipe da academia abre as próprias aulas na TV.' });
    // Token de sessão do professor para o Ginásio (4h, só lê treinos deste professor)
    const token = jwt.sign(
      { role: 'prof_session', user_id: req.user.id, license_id: p.license_id },
      JWT_SECRET,
      { expiresIn: '4h' }
    );
    await db.query(
      "UPDATE pareamentos_ginasio SET status='confirmado', user_id=$1, token=$2 WHERE codigo=$3",
      [req.user.id, token, codigo]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// ROTAS DO GINÁSIO — pareamento e treinos
// ══════════════════════════════════════════════════════════════

app.post('/ginasio/pareamento', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const codigo = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expira = new Date(Date.now() + 120 * 1000);
    await db.query(
      "INSERT INTO pareamentos_ginasio (codigo, license_id, status, expira_em) VALUES ($1,$2,'pendente',$3)",
      [codigo, req.user.license_id, expira]
    );
    res.json({ codigo, expira_em_seg: 120 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/ginasio/pareamento/:codigo', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const pr = await db.query("SELECT * FROM pareamentos_ginasio WHERE codigo=$1", [req.params.codigo]);
    if (!pr.rows.length) return res.status(404).json({ error: 'Código não encontrado' });
    const p = pr.rows[0];
    if (p.license_id !== req.user.license_id) return res.status(403).json({ error: 'Acesso negado' });
    let professor = null;
    if (p.user_id) {
      const u = await db.query('SELECT id, name FROM users WHERE id=$1', [p.user_id]);
      if (u.rows.length) professor = { id: u.rows[0].id, nome: u.rows[0].name };
    }
    if (p.status === 'confirmado' && p.token) {
      await db.query("UPDATE pareamentos_ginasio SET status='usado' WHERE codigo=$1", [req.params.codigo]);
    }
    res.json({ status: p.status, motivo: p.motivo || null, professor, token: p.status === 'confirmado' ? p.token : null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

function profSessionAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (p.role !== 'prof_session') return res.status(403).json({ error: 'Acesso negado' });
    req.user = p;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

app.get('/ginasio/treinos', profSessionAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(
      'SELECT id, nome, duracao_sec FROM treinos_professor WHERE user_id=$1 ORDER BY updated_at DESC',
      [req.user.user_id]
    );
    res.json({ treinos: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/ginasio/treinos/:id', profSessionAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(
      'SELECT id, nome, json FROM treinos_professor WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.user_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Treino não encontrado' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Start ──────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 01/10a — CAMPEONATOS (Tour de France, Giro d'Italia, La Vuelta e Mundial)
// ──────────────────────────────────────────────────────────────
// O gestor cria o campeonato no Portal e marca aulas da grade como ETAPAS.
// No fim de cada etapa o Ginásio manda o resultado da sala e o servidor:
//   1) grava a posição de cada aluno pelo WPP e os pontos (25, 20, 16, 13,
//      11, 10, 9, 8, 7, 6; do 11º em diante 1 ponto; etapa rainha vale x2);
//   2) refaz a classificação inteira (quem faltou ganha 0 naquela etapa);
//   3) redistribui as camisas (líder, pontos, montanha, estreante);
//   4) na última etapa, encerra e grava as camisas CONQUISTADAS, que o
//      aluno leva para sempre (aparecem no app e na TV de qualquer academia).
// Mundial: só uma camisa, a arco-íris, que fica com o campeão no final.
// ══════════════════════════════════════════════════════════════
const CAMP_PONTOS = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6];
const CAMP_TIPOS = {
  tour:    { nome: 'Tour de France', lider: { k: 'amarela', cor: '#ffd400', rotulo: 'Camisa amarela' },
             pontos: { k: 'verde', cor: '#1fb34a', rotulo: 'Camisa verde' }, montanha: { k: 'bolinhas', cor: 'bol-vermelha', rotulo: 'Camisa de bolinhas' },
             jovem: { k: 'branca', cor: '#f4f4f4', rotulo: 'Camisa branca' } },
  giro:    { nome: "Giro d'Italia", lider: { k: 'rosa', cor: '#f59ec4', rotulo: 'Maglia rosa' },
             pontos: { k: 'ciclamino', cor: '#b0307a', rotulo: 'Maglia ciclamino' }, montanha: { k: 'azzurra', cor: '#2f8cff', rotulo: 'Maglia azzurra' },
             jovem: { k: 'bianca', cor: '#f4f4f4', rotulo: 'Maglia bianca' } },
  vuelta:  { nome: 'La Vuelta', lider: { k: 'roja', cor: '#d62d2d', rotulo: 'Camisa vermelha' },
             pontos: { k: 'verde', cor: '#1fb34a', rotulo: 'Camisa verde' }, montanha: { k: 'bolinhas-azuis', cor: 'bol-azul', rotulo: 'Camisa de bolinhas azuis' },
             jovem: { k: 'branca', cor: '#f4f4f4', rotulo: 'Camisa branca' } },
  mundial: { nome: 'Mundial', lider: { k: 'arco-iris', cor: 'arcoiris', rotulo: 'Camisa arco-íris de campeão mundial' } }
};
const CAMP_ETAPA_TIPOS = ['plano', 'montanha', 'sprint', 'contrarrelogio', 'rainha'];
const CAMP_ESTREANTE_DIAS = 90;

async function campMigrar() {
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS campeonatos (
      id SERIAL PRIMARY KEY, license_id TEXT NOT NULL, nome TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'tour', inicio DATE, fim DATE,
      status TEXT NOT NULL DEFAULT 'ativo', criado_em TIMESTAMPTZ DEFAULT NOW(), encerrado_em TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS campeonato_etapas (
      id SERIAL PRIMARY KEY, campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE CASCADE,
      ordem INTEGER, data DATE NOT NULL, hora TIME, agenda_id INTEGER, nome TEXT,
      tipo_etapa TEXT DEFAULT 'plano', feita BOOLEAN DEFAULT FALSE, feita_em TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS campeonato_resultados (
      id SERIAL PRIMARY KEY, etapa_id INTEGER REFERENCES campeonato_etapas(id) ON DELETE CASCADE,
      campeonato_id INTEGER, user_id INTEGER, nome TEXT NOT NULL, foto TEXT,
      posicao INTEGER, wpp NUMERIC(8,2) DEFAULT 0, pontos INTEGER DEFAULT 0,
      pts_sprint INTEGER DEFAULT 0, pts_montanha INTEGER DEFAULT 0,
      UNIQUE (etapa_id, nome)
    );
    CREATE TABLE IF NOT EXISTS camisas_conquistadas (
      id SERIAL PRIMARY KEY, user_id INTEGER, nome TEXT, camisa TEXT NOT NULL, cor TEXT, rotulo TEXT,
      campeonato_id INTEGER, campeonato_nome TEXT, tipo_campeonato TEXT, license_id TEXT, academia TEXT,
      conquistada_em TIMESTAMPTZ DEFAULT NOW(), UNIQUE (campeonato_id, camisa)
    );
    CREATE INDEX IF NOT EXISTS camp_lic_idx ON campeonatos (license_id, status);
    CREATE INDEX IF NOT EXISTS camp_res_camp_idx ON campeonato_resultados (campeonato_id);
    CREATE INDEX IF NOT EXISTS camisas_user_idx ON camisas_conquistadas (user_id);
  `);
  log('Migração 01/10a (campeonatos) OK');
}

function campChave(r) { return r.user_id ? 'u' + r.user_id : 'n:' + String(r.nome || '').trim().toLowerCase(); }

// Soma as etapas; ateEtapa = só até aquela etapa (para calcular quem subiu/desceu)
function campSomar(resultados, etapasValidas) {
  const m = new Map();
  for (const r of resultados) {
    if (etapasValidas && !etapasValidas.has(r.etapa_id)) continue;
    const k = campChave(r);
    const a = m.get(k) || { chave: k, nome: r.nome, user_id: r.user_id || null, foto: r.foto || null, pontos: 0, sprint: 0, montanha: 0, etapas: 0, vitorias: 0, wpp: 0 };
    a.pontos += r.pontos || 0; a.sprint += r.pts_sprint || 0; a.montanha += r.pts_montanha || 0;
    a.etapas += 1; if (r.posicao === 1) a.vitorias += 1; a.wpp += Number(r.wpp) || 0;
    if (r.foto) a.foto = r.foto; if (r.user_id) a.user_id = r.user_id;
    m.set(k, a);
  }
  return [...m.values()].sort((x, y) => (y.pontos - x.pontos) || (y.vitorias - x.vitorias) || (y.wpp - x.wpp));
}

async function campClassificacao(campId) {
  const c = (await db.query("SELECT *, to_char(inicio,'YYYY-MM-DD') AS inicio_s, to_char(fim,'YYYY-MM-DD') AS fim_s FROM campeonatos WHERE id=$1", [campId])).rows[0];
  if (!c) return null;
  const tipo = CAMP_TIPOS[c.tipo] || CAMP_TIPOS.tour;
  const etapas = (await db.query("SELECT *, to_char(data,'YYYY-MM-DD') AS data_s, to_char(hora,'HH24:MI') AS hora_s FROM campeonato_etapas WHERE campeonato_id=$1 ORDER BY data, hora NULLS LAST, id", [campId])).rows;
  const res = (await db.query('SELECT * FROM campeonato_resultados WHERE campeonato_id=$1', [campId])).rows;
  const feitas = etapas.filter(e => e.feita).sort((a, b) => new Date(a.feita_em) - new Date(b.feita_em));
  const cls = campSomar(res);
  // subiu/desceu: posição antes da última etapa feita
  const antes = new Map();
  if (feitas.length > 1) {
    const val = new Set(feitas.slice(0, -1).map(e => e.id));
    campSomar(res, val).forEach((a, i) => antes.set(a.chave, i + 1));
  }
  cls.forEach((a, i) => { a.pos = i + 1; a.delta = antes.has(a.chave) ? antes.get(a.chave) - a.pos : null; a.camisa = null; });
  // estreantes: cadastro com até 90 dias no início do campeonato
  const estreantes = new Set();
  const uids = cls.filter(a => a.user_id).map(a => a.user_id);
  if (uids.length && tipo.jovem) {
    const ini = c.inicio || c.criado_em;
    const u = await db.query(`SELECT id FROM users WHERE id = ANY($1::int[]) AND created_at >= ($2::date - INTERVAL '${CAMP_ESTREANTE_DIAS} days')`, [uids, ini]);
    u.rows.forEach(r => estreantes.add(r.id));
    if (!estreantes.size) { // ninguém novo: vale o primeiro campeonato da pessoa
      const p = await db.query('SELECT DISTINCT user_id FROM campeonato_resultados WHERE user_id = ANY($1::int[]) AND campeonato_id <> $2', [uids, campId]);
      const ja = new Set(p.rows.map(r => r.user_id));
      uids.forEach(id => { if (!ja.has(id)) estreantes.add(id); });
    }
  }
  // camisas: cada um veste só uma (a mais importante); a outra passa para o próximo
  const camisas = {}; const vestindo = new Set();
  const dar = (cat, lista) => {
    const def = tipo[cat]; if (!def) return;
    const q = lista.find(a => !vestindo.has(a.chave));
    if (!q) return;
    vestindo.add(q.chave); q.camisa = { cat, k: def.k, cor: def.cor, rotulo: def.rotulo };
    camisas[cat] = { ...def, nome: q.nome, foto: q.foto, user_id: q.user_id, pontos: cat === 'pontos' ? q.sprint : cat === 'montanha' ? q.montanha : q.pontos };
  };
  if (cls.length && feitas.length) {
    if (c.tipo === 'mundial') {
      if (c.status === 'encerrado') dar('lider', cls);
    } else {
      dar('lider', cls);
      dar('pontos', cls.filter(a => a.sprint > 0).sort((x, y) => y.sprint - x.sprint || x.pos - y.pos));
      dar('montanha', cls.filter(a => a.montanha > 0).sort((x, y) => y.montanha - x.montanha || x.pos - y.pos));
      dar('jovem', cls.filter(a => a.user_id && estreantes.has(a.user_id)));
    }
  }
  return {
    campeonato: { id: c.id, nome: c.nome, tipo: c.tipo, tipo_nome: tipo.nome, inicio: c.inicio_s, fim: c.fim_s, status: c.status, license_id: c.license_id },
    tipo_def: tipo,
    etapas: etapas.map((e, i) => ({ id: e.id, n: i + 1, data: e.data_s, hora: e.hora_s, nome: e.nome, tipo_etapa: e.tipo_etapa, feita: e.feita, agenda_id: e.agenda_id })),
    feitas: feitas.length, total_etapas: etapas.length,
    classificacao: cls.map(a => ({ pos: a.pos, nome: a.nome, user_id: a.user_id, foto: a.foto, pontos: a.pontos, sprint: a.sprint, montanha: a.montanha, etapas: a.etapas, vitorias: a.vitorias, delta: a.delta, camisa: a.camisa, estreante: !!(a.user_id && estreantes.has(a.user_id)) })),
    camisas
  };
}

async function campEncerrar(campId) {
  const cl = await (async () => { await db.query("UPDATE campeonatos SET status='encerrado', encerrado_em=COALESCE(encerrado_em,NOW()) WHERE id=$1", [campId]); return campClassificacao(campId); })();
  if (!cl) return null;
  const lic = await db.query('SELECT nome, nome_fantasia FROM licencas WHERE codigo=$1', [cl.campeonato.license_id]);
  const acad = lic.rows[0] ? (lic.rows[0].nome_fantasia || lic.rows[0].nome) : '';
  for (const cat of Object.keys(cl.camisas)) {
    const h = cl.camisas[cat];
    await db.query(`INSERT INTO camisas_conquistadas (user_id, nome, camisa, cor, rotulo, campeonato_id, campeonato_nome, tipo_campeonato, license_id, academia)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (campeonato_id, camisa) DO NOTHING`,
      [h.user_id || null, h.nome, h.k, h.cor, h.rotulo, cl.campeonato.id, cl.campeonato.nome, cl.campeonato.tipo, cl.campeonato.license_id, acad]);
  }
  log(`Campeonato ${campId} encerrado — camisas gravadas: ${Object.keys(cl.camisas).join(', ') || 'nenhuma'}`);
  return cl;
}

// Camisa que a pessoa mostra: a que veste num campeonato ativo > campeão mundial > última conquistada
async function campCamisaDestaque(userId) {
  if (!db || !userId) return null;
  const ativos = await db.query(`SELECT DISTINCT c.id FROM campeonatos c JOIN campeonato_resultados r ON r.campeonato_id=c.id WHERE r.user_id=$1 AND c.status='ativo'`, [userId]);
  for (const row of ativos.rows) {
    const cl = await campClassificacao(row.id);
    const eu = cl && cl.classificacao.find(a => a.user_id === userId && a.camisa);
    if (eu) return { ...eu.camisa, agora: true, campeonato: cl.campeonato.nome };
  }
  const q = await db.query(`SELECT camisa AS k, cor, rotulo, campeonato_nome AS campeonato, conquistada_em FROM camisas_conquistadas WHERE user_id=$1
                            ORDER BY (camisa='arco-iris') DESC, conquistada_em DESC LIMIT 1`, [userId]);
  return q.rows[0] ? { ...q.rows[0], agora: false } : null;
}

// ── Portal (gestor) ─────────────────────────────────────────────
app.get('/gestor/campeonatos', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`SELECT c.*, to_char(c.inicio,'YYYY-MM-DD') AS inicio_s, to_char(c.fim,'YYYY-MM-DD') AS fim_s, (SELECT COUNT(*) FROM campeonato_etapas e WHERE e.campeonato_id=c.id)::int AS n_etapas,
      (SELECT COUNT(*) FROM campeonato_etapas e WHERE e.campeonato_id=c.id AND e.feita)::int AS n_feitas
      FROM campeonatos c WHERE c.license_id=$1 ORDER BY (c.status='ativo') DESC, c.inicio DESC NULLS LAST, c.id DESC`, [req.user.license_id]);
    res.json({ campeonatos: r.rows, tipos: CAMP_TIPOS, pontos: CAMP_PONTOS });
  } catch (e) { log('campeonatos list: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// datas da grade dentro do período (para marcar as etapas)
app.get('/gestor/campeonatos-grade', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const ini = new Date(String(req.query.inicio || '') + 'T12:00:00'), fim = new Date(String(req.query.fim || '') + 'T12:00:00');
    if (isNaN(ini) || isNaN(fim) || fim < ini) return res.status(400).json({ error: 'Período inválido' });
    if ((fim - ini) / 864e5 > 120) return res.status(400).json({ error: 'Período máximo: 120 dias' });
    const g = await db.query(`SELECT a.id, a.nome, a.dia_semana, to_char(a.hora,'HH24:MI') AS hora, a.duracao_min, COALESCE(p.name, a.professor_nome) AS professor
      FROM aulas_agenda a LEFT JOIN users p ON p.id=a.professor_id WHERE a.license_id=$1 AND a.ativa=TRUE ORDER BY a.hora`, [req.user.license_id]);
    const out = [];
    for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
      const dia = d.getDay(), iso = d.toISOString().slice(0, 10);
      g.rows.filter(a => a.dia_semana === dia).forEach(a => out.push({ data: iso, hora: a.hora, agenda_id: a.id, nome: a.nome, professor: a.professor, duracao_min: a.duracao_min }));
    }
    res.json({ aulas: out });
  } catch (e) { log('campeonatos grade: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
function campLimparEtapas(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 60).map(e => ({
    data: /^\d{4}-\d{2}-\d{2}$/.test(String(e.data)) ? e.data : null,
    hora: /^\d{2}:\d{2}/.test(String(e.hora || '')) ? String(e.hora).slice(0, 5) : null,
    agenda_id: parseInt(e.agenda_id, 10) || null,
    nome: String(e.nome || '').slice(0, 80),
    tipo_etapa: CAMP_ETAPA_TIPOS.includes(e.tipo_etapa) ? e.tipo_etapa : 'plano'
  })).filter(e => e.data);
}
app.post('/gestor/campeonatos', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const b = req.body || {};
  const nome = String(b.nome || '').trim().slice(0, 80);
  if (!nome) return res.status(400).json({ error: 'Dê um nome ao campeonato.' });
  const tipo = CAMP_TIPOS[b.tipo] ? b.tipo : 'tour';
  const etapas = campLimparEtapas(b.etapas);
  if (!etapas.length) return res.status(400).json({ error: 'Marque pelo menos uma aula da grade como etapa.' });
  try {
    const c = await db.query('INSERT INTO campeonatos (license_id, nome, tipo, inicio, fim) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [req.user.license_id, nome, tipo, b.inicio || etapas[0].data, b.fim || etapas[etapas.length - 1].data]);
    const id = c.rows[0].id;
    for (let i = 0; i < etapas.length; i++) { const e = etapas[i];
      await db.query('INSERT INTO campeonato_etapas (campeonato_id, ordem, data, hora, agenda_id, nome, tipo_etapa) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, i + 1, e.data, e.hora, e.agenda_id, e.nome, e.tipo_etapa]); }
    res.json({ ok: true, id });
  } catch (e) { log('campeonatos criar: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
async function campDoGestor(req, res) {
  const c = await db.query('SELECT * FROM campeonatos WHERE id=$1 AND license_id=$2', [parseInt(req.params.id, 10) || 0, req.user.license_id]);
  if (!c.rows.length) { res.status(404).json({ error: 'Campeonato não encontrado' }); return null; }
  return c.rows[0];
}
app.get('/gestor/campeonatos/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try { const c = await campDoGestor(req, res); if (!c) return; res.json(await campClassificacao(c.id)); }
  catch (e) { log('campeonato ver: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.put('/gestor/campeonatos/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const c = await campDoGestor(req, res); if (!c) return;
    const b = req.body || {};
    const nome = String(b.nome || c.nome).trim().slice(0, 80);
    const feitas = (await db.query('SELECT COUNT(*)::int n FROM campeonato_etapas WHERE campeonato_id=$1 AND feita', [c.id])).rows[0].n;
    const tipo = (feitas === 0 && CAMP_TIPOS[b.tipo]) ? b.tipo : c.tipo;   // depois da 1ª etapa o tipo não muda
    await db.query('UPDATE campeonatos SET nome=$1, tipo=$2, inicio=COALESCE($3,inicio), fim=COALESCE($4,fim) WHERE id=$5', [nome, tipo, b.inicio || null, b.fim || null, c.id]);
    if (Array.isArray(b.etapas)) {
      const novas = campLimparEtapas(b.etapas);
      const velhas = (await db.query("SELECT *, to_char(data,'YYYY-MM-DD') AS data_s, to_char(hora,'HH24:MI') AS hora_s FROM campeonato_etapas WHERE campeonato_id=$1", [c.id])).rows;
      const chave = e => String(e.data).slice(0, 10) + '|' + (e.agenda_id || '') + '|' + String(e.hora || '').slice(0, 5);
      const mapaNovas = new Map(novas.map(e => [chave(e), e]));
      for (const v of velhas) {
        const vk = chave({ data: v.data_s, agenda_id: v.agenda_id, hora: v.hora_s });
        if (mapaNovas.has(vk)) { const n = mapaNovas.get(vk); await db.query('UPDATE campeonato_etapas SET tipo_etapa=$1, nome=$2 WHERE id=$3', [n.tipo_etapa, n.nome || v.nome, v.id]); mapaNovas.delete(vk); }
        else if (!v.feita) await db.query('DELETE FROM campeonato_etapas WHERE id=$1', [v.id]);   // etapa feita nunca some
      }
      for (const e of mapaNovas.values())
        await db.query('INSERT INTO campeonato_etapas (campeonato_id, data, hora, agenda_id, nome, tipo_etapa) VALUES ($1,$2,$3,$4,$5,$6)', [c.id, e.data, e.hora, e.agenda_id, e.nome, e.tipo_etapa]);
    }
    res.json(await campClassificacao(c.id));
  } catch (e) { log('campeonato editar: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.post('/gestor/campeonatos/:id/encerrar', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try { const c = await campDoGestor(req, res); if (!c) return; res.json(await campEncerrar(c.id)); }
  catch (e) { log('campeonato encerrar: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.delete('/gestor/campeonatos/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try { const c = await campDoGestor(req, res); if (!c) return;
    await db.query('DELETE FROM campeonatos WHERE id=$1', [c.id]); await db.query('DELETE FROM campeonato_resultados WHERE campeonato_id=$1', [c.id]);
    res.json({ ok: true }); }
  catch (e) { log('campeonato apagar: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ── Ginásio (TV) ────────────────────────────────────────────────
// Etapa de hoje: a aula mais perto do horário atual (de 1 h antes a 3 h depois)
// 01/10b: reservas da aula de agora (ou a próxima de hoje) — a TV mostra quem
// reservou na bike reservada, já na tela do QR, mesmo antes de pedalar.
app.get('/display/reservas/agora', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const a = await db.query(`
      SELECT a.id, a.nome, to_char(a.hora,'HH24:MI') AS hora, a.duracao_min,
             ABS(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'America/Sao_Paulo')::time - a.hora))) AS dist
      FROM aulas_agenda a
      WHERE a.license_id=$1 AND a.ativa=TRUE
        AND a.dia_semana=EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))::int
        AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::time BETWEEN a.hora - INTERVAL '90 minutes'
            AND a.hora + make_interval(mins => COALESCE(a.duracao_min,60))
      ORDER BY dist ASC LIMIT 1`, [req.user.license_id]);
    if (!a.rows.length) return res.json({ aula: null, reservas: [] });
    const A = a.rows[0];
    const r = await db.query(`
      SELECT r.id, r.status, r.bike_numero AS bike, u.id AS user_id, u.name AS nome,
             CASE WHEN length(u.foto_url) < 150000 THEN u.foto_url ELSE NULL END AS foto
      FROM aulas_reservas r JOIN users u ON u.id=r.user_id
      WHERE r.agenda_id=$1 AND r.data_aula=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date AND r.status NOT IN ('cancelado','ausente')
      ORDER BY r.bike_numero NULLS LAST, r.created_at`, [A.id]);
    res.json({ aula: { id: A.id, nome: A.nome, hora: A.hora, duracao_min: A.duracao_min }, reservas: r.rows });
  } catch (e) { log('reservas agora: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.get('/display/campeonato/hoje', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT e.id AS etapa_id, e.campeonato_id, e.nome AS etapa_nome, e.tipo_etapa, to_char(e.hora,'HH24:MI') AS hora, e.feita,
             ABS(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'America/Sao_Paulo')::time - COALESCE(e.hora, (NOW() AT TIME ZONE 'America/Sao_Paulo')::time)))) AS dist
      FROM campeonato_etapas e JOIN campeonatos c ON c.id=e.campeonato_id
      WHERE c.license_id=$1 AND c.status='ativo' AND e.data=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        AND (e.hora IS NULL OR ((NOW() AT TIME ZONE 'America/Sao_Paulo')::time BETWEEN e.hora - INTERVAL '60 minutes' AND e.hora + INTERVAL '180 minutes'))
      ORDER BY e.feita ASC, dist ASC LIMIT 1`, [req.user.license_id]);
    if (!r.rows.length) return res.json({ etapa: null });
    const e = r.rows[0];
    const cl = await campClassificacao(e.campeonato_id);
    const n = cl.etapas.find(x => x.id === e.etapa_id);
    res.json({ etapa: { id: e.etapa_id, n: n ? n.n : null, nome: e.etapa_nome, tipo_etapa: e.tipo_etapa, hora: e.hora, feita: e.feita }, ...cl });
  } catch (e) { log('campeonato hoje: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// Resultado da etapa (fim da aula). Pode ser reenviado: substitui o anterior.
app.post('/display/campeonato/resultado', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const b = req.body || {};
    const et = await db.query(`SELECT e.*, c.license_id, c.status FROM campeonato_etapas e JOIN campeonatos c ON c.id=e.campeonato_id WHERE e.id=$1`, [parseInt(b.etapa_id, 10) || 0]);
    const e = et.rows[0];
    if (!e || e.license_id !== req.user.license_id) return res.status(404).json({ error: 'Etapa não encontrada' });
    if (e.status !== 'ativo') return res.status(409).json({ error: 'Campeonato já encerrado' });
    const sala = salas[String(b.sala || '')];
    const lista = (Array.isArray(b.resultados) ? b.resultados : []).slice(0, 200)
      .map(r => ({ nome: String(r.nome || '').trim().slice(0, 60), wpp: Math.max(0, Number(r.wpp) || 0), sprint: Math.max(0, parseInt(r.sprint, 10) || 0), montanha: Math.max(0, parseInt(r.montanha, 10) || 0) }))
      .filter(r => r.nome && !/^Bike \d+$/i.test(r.nome) && !/^demo\b/i.test(r.nome))
      .sort((x, y) => y.wpp - x.wpp);
    const mult = e.tipo_etapa === 'rainha' ? 2 : 1;
    await db.query('DELETE FROM campeonato_resultados WHERE etapa_id=$1', [e.id]);
    for (let i = 0; i < lista.length; i++) {
      const r = lista[i];
      let uid = null;
      try { const w = sala && sala.alunos && sala.alunos.get(r.nome); if (w && w._userId) uid = parseInt(w._userId, 10) || null; } catch (_) {}
      if (!uid) { const u = await db.query('SELECT id FROM users WHERE license_id=$1 AND LOWER(TRIM(name))=LOWER($2) LIMIT 2', [e.license_id, r.nome]); if (u.rows.length === 1) uid = u.rows[0].id; }
      let foto = null; if (uid) { const f = await db.query('SELECT foto_url FROM users WHERE id=$1', [uid]); foto = (f.rows[0] || {}).foto_url || null; }
      const pts = (i < CAMP_PONTOS.length ? CAMP_PONTOS[i] : 1) * mult;
      await db.query(`INSERT INTO campeonato_resultados (etapa_id, campeonato_id, user_id, nome, foto, posicao, wpp, pontos, pts_sprint, pts_montanha)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (etapa_id, nome) DO NOTHING`, [e.id, e.campeonato_id, uid, r.nome, foto, i + 1, r.wpp.toFixed(2), pts, r.sprint, r.montanha]);
    }
    await db.query('UPDATE campeonato_etapas SET feita=TRUE, feita_em=COALESCE(feita_em,NOW()) WHERE id=$1', [e.id]);
    const falta = (await db.query('SELECT COUNT(*)::int n FROM campeonato_etapas WHERE campeonato_id=$1 AND NOT feita', [e.campeonato_id])).rows[0].n;
    const cl = falta === 0 ? await campEncerrar(e.campeonato_id) : await campClassificacao(e.campeonato_id);
    const n = cl.etapas.find(x => x.id === e.id);
    log(`Campeonato ${e.campeonato_id}: etapa ${e.id} com ${lista.length} aluno(s)${falta === 0 ? ' — ÚLTIMA ETAPA, campeonato encerrado' : ''}`);
    res.json({ ok: true, etapa: { id: e.id, n: n ? n.n : null, nome: e.nome, tipo_etapa: e.tipo_etapa }, ...cl });
  } catch (err) { log('campeonato resultado: ' + err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ── Leitura pública (app, página pública) ─────────────────────────
app.get('/campeonato/:id/classificacao', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try { const cl = await campClassificacao(parseInt(req.params.id, 10) || 0); if (!cl) return res.status(404).json({ error: 'Campeonato não encontrado' });
    cl.classificacao.forEach(a => { delete a.user_id; }); Object.values(cl.camisas).forEach(h => { delete h.user_id; }); res.json(cl); }
  catch (e) { log('campeonato público: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// ── App: meus campeonatos e minhas camisas ─────────────────────────
app.get('/user/campeonatos', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const u = (await db.query('SELECT license_id FROM users WHERE id=$1', [req.user.id])).rows[0] || {};
    const ids = await db.query(`SELECT id FROM campeonatos WHERE status='ativo' AND (license_id=$1 OR id IN (SELECT campeonato_id FROM campeonato_resultados WHERE user_id=$2)) ORDER BY inicio NULLS LAST LIMIT 5`, [u.license_id || '', req.user.id]);
    const out = [];
    for (const r of ids.rows) {
      const cl = await campClassificacao(r.id);
      const eu = cl.classificacao.find(a => a.user_id === req.user.id) || null;
      const _br = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })); const hoje = _br.getFullYear() + '-' + String(_br.getMonth() + 1).padStart(2, '0') + '-' + String(_br.getDate()).padStart(2, '0');
      const prox = cl.etapas.find(e => !e.feita && String(e.data) >= hoje) || null;
      out.push({ campeonato: cl.campeonato, tipo_def: cl.tipo_def, feitas: cl.feitas, total_etapas: cl.total_etapas, eu, camisas: cl.camisas, proxima: prox, top: cl.classificacao.slice(0, 10).map(a => ({ pos: a.pos, nome: a.nome, pontos: a.pontos, camisa: a.camisa, foto: a.foto })) });
    }
    res.json({ campeonatos: out });
  } catch (e) { log('user campeonatos: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.get('/user/camisas', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const q = await db.query('SELECT camisa AS k, cor, rotulo, campeonato_nome, tipo_campeonato, academia, conquistada_em FROM camisas_conquistadas WHERE user_id=$1 ORDER BY conquistada_em DESC', [req.user.id]);
    res.json({ destaque: await campCamisaDestaque(req.user.id), conquistadas: q.rows });
  } catch (e) { log('user camisas: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ══════════════════════════════════════════════════════════════
// 02/10a — DESAFIO ENTRE ACADEMIAS
// ══════════════════════════════════════════════════════════════
// Toda aula que termina na TV manda um resumo (aulas_tv): quantos pedalaram,
// WPP, kcal e km de cada um. É daí que sai o placar entre academias — conta
// todo mundo que pedalou, com ou sem app.
//   POR PERÍODO: semana/mês; vence a MÉDIA por participação (justo entre
//   academia pequena e grande). Métricas: wpp, kcal, km, presenca.
//   AO VIVO: as academias dão a aula no mesmo horário; as TVs trocam o placar
//   pelo WebSocket (duelos) e cada uma mostra a faixa com todas.
const DA_METRICAS = {
  wpp:      { nome: 'WPP médio por aluno',  un: 'WPP' },
  kcal:     { nome: 'kcal média por aluno', un: 'kcal' },
  km:       { nome: 'km médio por aluno',   un: 'km' },
  presenca: { nome: 'Alunos por bike',      un: 'por bike' },
};
const duelos = {};   // desafioId -> Map(license_id -> {ws, nome, valor, n, kcal, t})
async function daMigrar() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS aulas_tv (
      id SERIAL PRIMARY KEY, license_id TEXT NOT NULL, uid TEXT NOT NULL, sala TEXT, nome_aula TEXT,
      inicio TIMESTAMPTZ, fim TIMESTAMPTZ DEFAULT NOW(), dur_seg INTEGER DEFAULT 0,
      n_alunos INTEGER DEFAULT 0, wpp_soma NUMERIC DEFAULT 0, kcal_total INTEGER DEFAULT 0, km_total NUMERIC DEFAULT 0,
      watts_med INTEGER DEFAULT 0, detalhe JSONB, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(license_id, uid));
    CREATE INDEX IF NOT EXISTS aulas_tv_lic_inicio ON aulas_tv (license_id, inicio);
    CREATE TABLE IF NOT EXISTS desafios_academias (
      id SERIAL PRIMARY KEY, codigo TEXT UNIQUE NOT NULL, nome TEXT NOT NULL, criador_license TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'periodo', metrica TEXT NOT NULL DEFAULT 'wpp',
      inicio DATE, fim DATE, data_hora TIMESTAMPTZ, status TEXT DEFAULT 'ativo', vencedor_license TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS desafios_academias_part (
      id SERIAL PRIMARY KEY, desafio_id INTEGER REFERENCES desafios_academias(id) ON DELETE CASCADE,
      license_id TEXT NOT NULL, entrou_em TIMESTAMPTZ DEFAULT NOW(), UNIQUE(desafio_id, license_id));
  `);
  log('Migração 02/10a (desafio entre academias) OK');
}
function daCodigo() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = 'DA-'; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
// janela de tempo que vale: período = dias inteiros (horário de Brasília); ao vivo = aula que começou de 30 min antes a 30 min depois
function daJanela(d) {
  if (d.tipo === 'ao_vivo') { const t = new Date(d.data_hora).getTime(); return [new Date(t - 30 * 60000), new Date(t + 30 * 60000)]; }
  return [new Date(String(d.inicio_s) + 'T00:00:00-03:00'), new Date(String(d.fim_s) + 'T23:59:59-03:00')];
}
function daTerminou(d) {
  if (d.tipo === 'ao_vivo') return Date.now() > new Date(d.data_hora).getTime() + 3 * 3600000;
  return Date.now() > new Date(String(d.fim_s) + 'T23:59:59-03:00').getTime();
}
async function daCarregar(id) {
  const r = await db.query(`SELECT d.*, to_char(d.inicio,'YYYY-MM-DD') AS inicio_s, to_char(d.fim,'YYYY-MM-DD') AS fim_s FROM desafios_academias d WHERE d.id=$1`, [id]);
  return r.rows[0] || null;
}
async function daRanking(d) {
  const [ini, fim] = daJanela(d);
  const r = await db.query(`
    SELECT p.license_id, COALESCE(l.nome_fantasia, l.nome, p.license_id) AS nome, l.cidade,
           COALESCE(NULLIF(l.bikes_disponiveis,0), NULLIF(l.max_bikes,0), 15) AS bikes,
           COUNT(a.id)::int AS aulas, COALESCE(SUM(a.n_alunos),0)::int AS part,
           COALESCE(SUM(a.wpp_soma),0)::float AS wpp, COALESCE(SUM(a.kcal_total),0)::float AS kcal, COALESCE(SUM(a.km_total),0)::float AS km
    FROM desafios_academias_part p
    JOIN licencas l ON l.codigo=p.license_id
    LEFT JOIN aulas_tv a ON a.license_id=p.license_id AND a.inicio BETWEEN $2 AND $3 AND a.n_alunos>0
    WHERE p.desafio_id=$1
    GROUP BY p.license_id, l.nome_fantasia, l.nome, l.cidade, l.bikes_disponiveis, l.max_bikes`, [d.id, ini, fim]);
  const lista = r.rows.map(x => {
    let v = 0;
    if (x.part > 0) {
      if (d.metrica === 'kcal') v = x.kcal / x.part;
      else if (d.metrica === 'km') v = x.km / x.part;
      else if (d.metrica === 'presenca') v = x.part / Math.max(1, x.bikes);
      else v = x.wpp / x.part;
    }
    const casas = d.metrica === 'kcal' ? 1 : d.metrica === 'km' ? 10 : 100;
    return { license_id: x.license_id, nome: x.nome, cidade: x.cidade, aulas: x.aulas, participacoes: x.part, valor: Math.round(v * casas) / casas };
  }).sort((a, b) => b.valor - a.valor || b.participacoes - a.participacoes);
  lista.forEach((x, i) => { x.pos = (i > 0 && x.valor === lista[i - 1].valor && x.participacoes === lista[i - 1].participacoes) ? lista[i - 1].pos : i + 1; });
  return lista;
}
async function daResumo(d, minhaLic) {
  if (d.status === 'ativo' && daTerminou(d)) {   // encerra sozinho quando passa do fim
    const rk = await daRanking(d);
    const venc = rk[0] && rk[0].participacoes > 0 ? rk[0].license_id : null;
    await db.query(`UPDATE desafios_academias SET status='encerrado', vencedor_license=$2 WHERE id=$1 AND status='ativo'`, [d.id, venc]);
    d.status = 'encerrado'; d.vencedor_license = venc;
  }
  const ranking = await daRanking(d);
  const eu = ranking.find(x => x.license_id === minhaLic) || null;
  const ao = (d.tipo === 'ao_vivo' && duelos[d.id]) ? [...duelos[d.id].values()].filter(x => Date.now() - x.t < 20000).map(x => ({ license_id: x.lic, nome: x.nome, valor: x.valor, n: x.n })) : [];
  return { id: d.id, codigo: d.codigo, nome: d.nome, tipo: d.tipo, metrica: d.metrica, metrica_nome: (DA_METRICAS[d.metrica] || DA_METRICAS.wpp).nome,
    unidade: (DA_METRICAS[d.metrica] || DA_METRICAS.wpp).un, inicio: d.inicio_s, fim: d.fim_s, data_hora: d.data_hora, status: d.status,
    criador: d.criador_license === minhaLic, vencedor_license: d.vencedor_license, ranking, eu, ao_vivo_agora: ao };
}
async function daParticipa(id, lic) { return (await db.query('SELECT 1 FROM desafios_academias_part WHERE desafio_id=$1 AND license_id=$2', [id, lic])).rows.length > 0; }

// ── Portal (gestor) ───────────────────────────────────────────
app.get('/gestor/desafios-academias', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`SELECT d.id FROM desafios_academias d JOIN desafios_academias_part p ON p.desafio_id=d.id
      WHERE p.license_id=$1 ORDER BY (d.status='ativo') DESC, COALESCE(d.data_hora::date, d.inicio) DESC, d.id DESC LIMIT 40`, [req.user.license_id]);
    const out = [];
    for (const x of r.rows) { const d = await daCarregar(x.id); if (d) out.push(await daResumo(d, req.user.license_id)); }
    res.json({ desafios: out, metricas: DA_METRICAS });
  } catch (e) { log('desafios-academias list: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.post('/gestor/desafios-academias', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const b = req.body || {};
    const nome = String(b.nome || '').trim().slice(0, 80);
    const tipo = b.tipo === 'ao_vivo' ? 'ao_vivo' : 'periodo';
    const metrica = DA_METRICAS[b.metrica] ? b.metrica : 'wpp';
    if (!nome) return res.status(400).json({ error: 'Dê um nome ao desafio.' });
    let inicio = null, fim = null, dataHora = null;
    if (tipo === 'periodo') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.inicio || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b.fim || '')) return res.status(400).json({ error: 'Escolha a data de começo e de fim.' });
      if (b.fim < b.inicio) return res.status(400).json({ error: 'O fim é antes do começo.' });
      inicio = b.inicio; fim = b.fim;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.data_hora || '')) return res.status(400).json({ error: 'Escolha o dia e o horário da aula.' });
      dataHora = b.data_hora + ':00-03:00'; inicio = fim = b.data_hora.slice(0, 10);
      if (new Date(dataHora).getTime() < Date.now() - 3 * 3600000) return res.status(400).json({ error: 'Esse horário já passou.' });
    }
    let id = null;
    for (let k = 0; k < 5 && !id; k++) {
      try {
        const r = await db.query(`INSERT INTO desafios_academias (codigo,nome,criador_license,tipo,metrica,inicio,fim,data_hora) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [daCodigo(), nome, req.user.license_id, tipo, metrica, inicio, fim, dataHora]);
        id = r.rows[0].id;
      } catch (e) { if (e.code !== '23505') throw e; }
    }
    await db.query('INSERT INTO desafios_academias_part (desafio_id, license_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, req.user.license_id]);
    res.json(await daResumo(await daCarregar(id), req.user.license_id));
  } catch (e) { log('desafios-academias criar: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.post('/gestor/desafios-academias/entrar', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const cod = String((req.body || {}).codigo || '').trim().toUpperCase().replace(/^DA-?/, 'DA-');
    const r = await db.query('SELECT id FROM desafios_academias WHERE codigo=$1', [cod]);
    if (!r.rows.length) return res.status(404).json({ error: 'Código não encontrado. Confira com a outra academia.' });
    const d = await daCarregar(r.rows[0].id);
    if (d.status !== 'ativo' || daTerminou(d)) return res.status(409).json({ error: 'Este desafio já terminou.' });
    const n = (await db.query('SELECT COUNT(*)::int AS n FROM desafios_academias_part WHERE desafio_id=$1', [d.id])).rows[0].n;
    if (n >= 20) return res.status(409).json({ error: 'Este desafio já tem 20 academias.' });
    await db.query('INSERT INTO desafios_academias_part (desafio_id, license_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [d.id, req.user.license_id]);
    res.json(await daResumo(d, req.user.license_id));
  } catch (e) { log('desafios-academias entrar: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.get('/gestor/desafios-academias/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const d = await daCarregar(parseInt(req.params.id, 10) || 0);
    if (!d || !(await daParticipa(d.id, req.user.license_id))) return res.status(404).json({ error: 'Desafio não encontrado' });
    res.json(await daResumo(d, req.user.license_id));
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
// sair (quem entrou) ou apagar (quem criou)
app.delete('/gestor/desafios-academias/:id', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const d = await daCarregar(parseInt(req.params.id, 10) || 0);
    if (!d || !(await daParticipa(d.id, req.user.license_id))) return res.status(404).json({ error: 'Desafio não encontrado' });
    if (d.criador_license === req.user.license_id) await db.query('DELETE FROM desafios_academias WHERE id=$1', [d.id]);
    else await db.query('DELETE FROM desafios_academias_part WHERE desafio_id=$1 AND license_id=$2', [d.id, req.user.license_id]);
    res.json({ ok: true, apagado: d.criador_license === req.user.license_id });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});

// ── App do aluno ──────────────────────────────────────────────
app.get('/user/desafios-academias', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const u = (await db.query('SELECT license_id FROM users WHERE id=$1', [req.user.id])).rows[0] || {};
    if (!u.license_id) return res.json({ desafios: [] });
    const r = await db.query(`SELECT d.id FROM desafios_academias d JOIN desafios_academias_part p ON p.desafio_id=d.id
      WHERE p.license_id=$1 AND (d.status='ativo' OR COALESCE(d.fim, d.data_hora::date) >= CURRENT_DATE - 7)
      ORDER BY (d.status='ativo') DESC, COALESCE(d.data_hora::date, d.fim) ASC LIMIT 6`, [u.license_id]);
    const out = [];
    for (const x of r.rows) { const d = await daCarregar(x.id); if (d) out.push(await daResumo(d, u.license_id)); }
    res.json({ desafios: out, minha_academia: u.license_id });
  } catch (e) { log('user desafios-academias: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ── TV ─────────────────────────────────────────────────────────
// resumo de cada aula que termina (vale para os desafios entre academias)
app.post('/display/aula/resumo', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const b = req.body || {};
    const uid = String(b.uid || '').slice(0, 60); if (!uid) return res.status(400).json({ error: 'uid obrigatório' });
    const alunos = (Array.isArray(b.alunos) ? b.alunos : []).slice(0, 200).map(a => ({
      nome: String(a.nome || '').slice(0, 60), user_id: parseInt(a.user_id, 10) || null,
      wpp: Math.max(0, Math.min(50, Number(a.wpp) || 0)), kcal: Math.max(0, Math.min(3000, Math.round(Number(a.kcal) || 0))),
      km: Math.max(0, Math.min(200, Number(a.km) || 0)), w: Math.max(0, Math.min(2500, Math.round(Number(a.w) || 0))) }))
      .filter(a => a.nome && !/^demo\b/i.test(a.nome) && (a.w > 0 || a.kcal > 0 || a.km > 0));
    const ini = b.inicio && !isNaN(new Date(b.inicio)) ? new Date(b.inicio) : new Date(Date.now() - (parseInt(b.dur_seg, 10) || 0) * 1000);
    const n = alunos.length, soma = k => alunos.reduce((s, a) => s + a[k], 0);
    const comW = alunos.filter(a => a.w > 0);
    await db.query(`INSERT INTO aulas_tv (license_id, uid, sala, nome_aula, inicio, dur_seg, n_alunos, wpp_soma, kcal_total, km_total, watts_med, detalhe)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (license_id, uid) DO UPDATE SET n_alunos=EXCLUDED.n_alunos, wpp_soma=EXCLUDED.wpp_soma, kcal_total=EXCLUDED.kcal_total,
        km_total=EXCLUDED.km_total, watts_med=EXCLUDED.watts_med, detalhe=EXCLUDED.detalhe, dur_seg=EXCLUDED.dur_seg, fim=NOW()`,
      [req.user.license_id, uid, String(b.sala || '').slice(0, 30), String(b.nome_aula || 'Aula').slice(0, 80), ini, parseInt(b.dur_seg, 10) || 0,
       n, Math.round(soma('wpp') * 100) / 100, soma('kcal'), Math.round(soma('km') * 100) / 100,
       comW.length ? Math.round(comW.reduce((s, a) => s + a.w, 0) / comW.length) : 0, JSON.stringify(alunos)]);
    // desafios ao vivo desta academia que batem com esta aula
    const ao = await db.query(`SELECT d.id FROM desafios_academias d JOIN desafios_academias_part p ON p.desafio_id=d.id
      WHERE p.license_id=$1 AND d.tipo='ao_vivo' AND d.data_hora BETWEEN $2::timestamptz - INTERVAL '30 minutes' AND $2::timestamptz + INTERVAL '30 minutes'`, [req.user.license_id, ini]);
    const desafios = [];
    for (const x of ao.rows) { const d = await daCarregar(x.id); if (d) desafios.push(await daResumo(d, req.user.license_id)); }
    res.json({ ok: true, n_alunos: n, desafios });
  } catch (e) { log('aula resumo: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// desafio AO VIVO desta academia agora (de 60 min antes a 2 h depois do horário)
app.get('/display/desafio-academias/agora', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const d = await daAgoraDe(req.user.license_id);
    if (!d) return res.json({ desafio: null });
    const lic = await db.query('SELECT COALESCE(nome_fantasia, nome) AS nome FROM licencas WHERE codigo=$1', [req.user.license_id]);
    res.json({ desafio: await daResumo(d, req.user.license_id), minha_academia: (lic.rows[0] || {}).nome || req.user.license_id, license_id: req.user.license_id });
  } catch (e) { log('desafio agora: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// desafio AO VIVO desta academia agora (de 60 min antes a 2 h depois do horário)
async function daAgoraDe(lic) {
  const r = await db.query(`SELECT d.id FROM desafios_academias d JOIN desafios_academias_part p ON p.desafio_id=d.id
    WHERE p.license_id=$1 AND d.tipo='ao_vivo' AND d.status='ativo'
      AND NOW() BETWEEN d.data_hora - INTERVAL '60 minutes' AND d.data_hora + INTERVAL '120 minutes'
    ORDER BY ABS(EXTRACT(EPOCH FROM (NOW() - d.data_hora))) LIMIT 1`, [lic]);
  return r.rows.length ? await daCarregar(r.rows[0].id) : null;
}
// ── 02/10e: AULA AO VIVO EM REDE ──────────────────────────────────
// A academia que criou o desafio ao vivo é a "mãe": a TV dela publica a aula
// (blocos, música) e, a cada segundo, onde a aula está. As outras TVs do
// desafio carregam a mesma aula, começam junto com a mãe e seguem o relógio
// dela (pausa e avanço inclusive). Fica só na memória: a aula dura 1 h.
const redes = {};   // desafioId -> {lic, nome, sala, aula, done, play, contando, fim, tx, t}
app.post('/display/rede/aula', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const d = await daAgoraDe(req.user.license_id);
    if (!d) return res.status(404).json({ error: 'Nenhum desafio ao vivo agora.' });
    if (d.criador_license !== req.user.license_id) return res.status(403).json({ error: 'Só a academia que criou o desafio dá a aula em rede.' });
    const a = (req.body || {}).aula;
    if (!a || !Array.isArray(a.workout) || !a.workout.length || a.workout.length > 300 || JSON.stringify(a).length > 400000) return res.status(400).json({ error: 'Aula inválida.' });
    const l = (await db.query('SELECT COALESCE(nome_fantasia, nome) AS nome FROM licencas WHERE codigo=$1', [req.user.license_id])).rows[0] || {};
    redes[d.id] = { lic: req.user.license_id, nome: l.nome || req.user.license_id, sala: String((req.body || {}).sala || '').slice(0, 30), aula: a,
      done: 0, play: false, contando: false, fim: false, tx: false, t: Date.now(), reinicio: (redes[d.id] && redes[d.id].reinicio) || 0 };
    log(`Aula em rede publicada: desafio ${d.id} por ${req.user.license_id} (${a.workout.length} blocos)`);
    res.json({ ok: true, desafio_id: d.id });
  } catch (e) { log('rede aula: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.post('/display/rede/estado', displayAuth, (req, res) => {
  const b = req.body || {}, r = redes[parseInt(b.desafio_id, 10) || 0];
  if (!r || r.lic !== req.user.license_id) return res.status(404).json({ error: 'Aula em rede não encontrada.' });
  Object.assign(r, { done: Math.max(0, Number(b.done) || 0), play: !!b.play, contando: !!b.contando, fim: !!b.fim, tx: !!b.tx, t: Date.now(), reinicio: Math.max(r.reinicio || 0, parseInt(b.reinicio, 10) || 0) });
  if (b.sala) r.sala = String(b.sala).slice(0, 30);
  res.json({ ok: true });
});
app.get('/display/rede/agora', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const d = await daAgoraDe(req.user.license_id); if (!d) return res.json({ rede: null });
    const r = redes[d.id], mae = d.criador_license === req.user.license_id;
    const nomeMae = r ? r.nome : ((await db.query('SELECT COALESCE(nome_fantasia, nome) AS nome FROM licencas WHERE codigo=$1', [d.criador_license])).rows[0] || {}).nome;
    const out = { desafio_id: d.id, nome: d.nome, mae, academia_mae: nomeMae || d.criador_license, data_hora: d.data_hora, tem_aula: !!r };
    if (r && !mae) {
      const idade = Date.now() - r.t;
      out.sala = r.sala; out.tx = r.tx && idade < 15000; out.nome_aula = r.aula.nome || 'Aula';
      out.estado = { done: r.play ? r.done + idade / 1000 : r.done, play: r.play, contando: r.contando, fim: r.fim, idade, reinicio: r.reinicio || 0 };
      if (req.query.aula) out.aula = r.aula;
    }
    res.json({ rede: out });
  } catch (e) { log('rede agora: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// placar ao vivo: a TV entra no duelo e manda a média da sala; o servidor
// devolve a todas as TVs do duelo a lista das academias (chamado pelo WS)
async function daDueloEntrar(ws, msg) {
  let p; try { p = jwt.verify(String(msg.display_token || ''), JWT_SECRET); } catch (e) { return; }
  if (!p || !p.license_id || !db) return;
  const id = parseInt(msg.desafio_id, 10) || 0;
  if (!(await daParticipa(id, p.license_id))) return;
  const lic = await db.query('SELECT COALESCE(nome_fantasia, nome) AS nome FROM licencas WHERE codigo=$1', [p.license_id]);
  if (!duelos[id]) duelos[id] = new Map();
  ws._duelo = id; ws._dueloLic = p.license_id;
  duelos[id].set(p.license_id, { ws, lic: p.license_id, nome: (lic.rows[0] || {}).nome || p.license_id, valor: 0, n: 0, kcal: 0, t: Date.now() });
  daDueloEnviar(id);
}
function daDueloPlacar(ws, msg) {
  const id = ws._duelo; if (!id || !duelos[id]) return;
  const e = duelos[id].get(ws._dueloLic); if (!e) return;
  e.ws = ws; e.valor = Math.max(0, Math.min(99999, Number(msg.valor) || 0)); e.n = Math.max(0, parseInt(msg.n, 10) || 0); e.kcal = Math.max(0, parseInt(msg.kcal, 10) || 0); e.t = Date.now();
  if (!duelos[id]._ult || Date.now() - duelos[id]._ult > 1500) daDueloEnviar(id);
}
function daDueloEnviar(id) {
  const m = duelos[id]; if (!m) return; m._ult = Date.now();
  const lista = [...m.values()].filter(x => Date.now() - x.t < 30000).map(x => ({ license_id: x.lic, nome: x.nome, valor: x.valor, n: x.n, kcal: x.kcal }))
    .sort((a, b) => b.valor - a.valor);
  const txt = JSON.stringify({ tipo: 'duelo_estado', desafio_id: id, academias: lista });
  for (const x of m.values()) { if (x.ws && x.ws.readyState === WebSocket.OPEN) { try { x.ws.send(txt); } catch (e) {} } }
}
function daDueloSair(ws) {
  const id = ws._duelo; if (!id || !duelos[id]) return;
  const e = duelos[id].get(ws._dueloLic); if (e && e.ws === ws) e.ws = null;   // fica no placar até 30 s sem dados
}


// ══════════════════════════════════════════════════════════════
// 02/10b — GRAVAR E TRANSMITIR
// ══════════════════════════════════════════════════════════════
// A gravação fica no computador da TV (pasta ProRider\Gravacoes); aqui só
// guardamos a ficha (nome, professor, duração, arquivo) para o Portal listar.
// Enviar a gravação para o app fica pronto mas DESLIGADO até contratar um
// armazenamento (variável GRAVACOES_STORAGE). A chave do YouTube Live é da
// academia: o gestor cola no Portal e a TV usa para transmitir.
async function gvMigrar() {
  await db.query(`
    ALTER TABLE licencas ADD COLUMN IF NOT EXISTS yt_chave TEXT;
    ALTER TABLE licencas ADD COLUMN IF NOT EXISTS tx_max INTEGER DEFAULT 15;
    CREATE TABLE IF NOT EXISTS aulas_gravadas (
      id SERIAL PRIMARY KEY, license_id TEXT NOT NULL, nome_aula TEXT, professor TEXT, dur_seg INTEGER DEFAULT 0,
      arquivo TEXT, bytes BIGINT DEFAULT 0, transmitida BOOLEAN DEFAULT FALSE, youtube BOOLEAN DEFAULT FALSE,
      status TEXT DEFAULT 'no_pc', url TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    ALTER TABLE aulas_gravadas ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE aulas_gravadas ADD COLUMN IF NOT EXISTS roteiro JSONB;
    ALTER TABLE aulas_gravadas ADD COLUMN IF NOT EXISTS teste_ate TIMESTAMPTZ;
    ALTER TABLE aulas_gravadas ADD COLUMN IF NOT EXISTS teste_bytes BIGINT DEFAULT 0;
    CREATE TABLE IF NOT EXISTS gravadas_resultados (
      id SERIAL PRIMARY KEY, gravada_id INTEGER REFERENCES aulas_gravadas(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      nome TEXT, wpp NUMERIC DEFAULT 0, kcal INTEGER DEFAULT 0, watts INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(gravada_id, user_id));
  `);
  log('Migração 02/10b (gravar e transmitir) OK');
}
function _ytMascara(k) { k = String(k || ''); return k ? '••••' + k.slice(-4) : ''; }
app.get('/gestor/transmissao', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const l = (await db.query('SELECT yt_chave, tx_max FROM licencas WHERE codigo=$1', [req.user.license_id])).rows[0] || {};
    const g = await db.query(`SELECT id, nome_aula, professor, dur_seg, arquivo, bytes, transmitida, youtube, status, url, created_at FROM aulas_gravadas WHERE license_id=$1 ORDER BY created_at DESC LIMIT 60`, [req.user.license_id]);
    res.json({ yt_configurado: !!l.yt_chave, yt_chave: _ytMascara(l.yt_chave), tx_max: l.tx_max || 15, envio_app: !!process.env.GRAVACOES_STORAGE, gravacoes: g.rows });
  } catch (e) { log('transmissao get: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.put('/gestor/transmissao', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const b = req.body || {};
    if (b.yt_chave !== undefined) {
      const k = String(b.yt_chave || '').trim();
      if (k && !/^[A-Za-z0-9_-]{8,80}$/.test(k)) return res.status(400).json({ error: 'A chave do YouTube tem só letras, números e traços (ex.: abcd-1234-efgh-5678-ijkl).' });
      await db.query('UPDATE licencas SET yt_chave=$1 WHERE codigo=$2', [k || null, req.user.license_id]);
    }
    if (b.tx_max !== undefined) await db.query('UPDATE licencas SET tx_max=$1 WHERE codigo=$2', [Math.max(1, Math.min(30, parseInt(b.tx_max, 10) || 15)), req.user.license_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
// a TV pega a configuração ao abrir a tela de configurar a aula
app.get('/display/transmissao', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const l = (await db.query('SELECT yt_chave, tx_max FROM licencas WHERE codigo=$1', [req.user.license_id])).rows[0] || {};
    res.json({ yt_chave: l.yt_chave || null, tx_max: l.tx_max || 15 });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
app.post('/display/gravacao', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const b = req.body || {};
    const rot = (b.roteiro && typeof b.roteiro === 'object' && Array.isArray(b.roteiro.a)) ? b.roteiro : null;
    const r = await db.query(`INSERT INTO aulas_gravadas (license_id, nome_aula, professor, dur_seg, arquivo, bytes, transmitida, youtube, uid, roteiro) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [req.user.license_id, String(b.nome_aula || 'Aula').slice(0, 80), String(b.professor || '').slice(0, 80), parseInt(b.dur_seg, 10) || 0,
       String(b.arquivo || '').slice(0, 300), parseInt(b.bytes, 10) || 0, !!b.transmitida, !!b.youtube, b.uid ? String(b.uid).slice(0, 60) : null, rot ? JSON.stringify(rot) : null]);
    // 02/10b2: com roteiro e até 2,5 GB, a TV manda o vídeo para o servidor de teste
    res.json({ ok: true, id: r.rows[0].id, envio_app: !!process.env.GRAVACOES_STORAGE, teste: !!rot && (parseInt(b.bytes, 10) || 0) <= GV_TESTE_MAX });
  } catch (e) { log('gravacao: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ── 02/10b2: AULA GRAVADA NO APP (servidor de TESTE) ─────────────
// Enquanto não há nuvem de vídeo contratada, a TV manda a gravação para cá
// (pasta temporária do servidor, até 5 por academia, apagadas em 72 h). O app
// toca o vídeo e monta o gráfico pelo roteiro, com os números do aluno, e no
// fim junta o resultado dele ao de quem pedalou ao vivo (aulas_tv).
const GV_TESTE_MAX = 2.5 * 1024 * 1024 * 1024;
const GV_DIR = process.env.GRAVACOES_TESTE_DIR || path.join(require('os').tmpdir(), 'prorider-gravacoes');
try { require('fs').mkdirSync(GV_DIR, { recursive: true }); } catch (e) {}
function gvArq(id) { return path.join(GV_DIR, 'g' + parseInt(id, 10) + '.webm'); }
app.post('/display/gravacao/:id/parte', displayAuth, express.raw({ type: 'application/octet-stream', limit: '12mb' }), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const g = (await db.query('SELECT id FROM aulas_gravadas WHERE id=$1 AND license_id=$2', [parseInt(req.params.id, 10) || 0, req.user.license_id])).rows[0];
    if (!g) return res.status(404).json({ error: 'Gravação não encontrada' });
    const ofs = parseInt(req.query.ofs, 10) || 0, buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'pedaço vazio' });
    if (ofs + buf.length > GV_TESTE_MAX) return res.status(413).json({ error: 'gravação grande demais para o teste' });
    const fs = require('fs'), arq = gvArq(g.id);
    const fd = fs.openSync(arq, fs.existsSync(arq) ? 'r+' : 'w'); fs.writeSync(fd, buf, 0, buf.length, ofs); fs.closeSync(fd);
    await db.query('UPDATE aulas_gravadas SET teste_bytes=GREATEST(teste_bytes,$2) WHERE id=$1', [g.id, ofs + buf.length]);
    res.json({ ok: true });
  } catch (e) { log('gravação parte: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.post('/display/gravacao/:id/pronta', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`UPDATE aulas_gravadas SET status='teste', teste_ate=NOW()+INTERVAL '72 hours' WHERE id=$1 AND license_id=$2 RETURNING id`, [parseInt(req.params.id, 10) || 0, req.user.license_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Gravação não encontrada' });
    // no máximo 5 no teste por academia: as mais antigas saem
    const velhas = await db.query(`SELECT id FROM aulas_gravadas WHERE license_id=$1 AND status='teste' ORDER BY created_at DESC OFFSET 5`, [req.user.license_id]);
    for (const v of velhas.rows) gvApagarTeste(v.id);
    log(`Gravação ${r.rows[0].id} pronta para testar no app (${req.user.license_id})`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
async function gvApagarTeste(id) {
  try { require('fs').unlinkSync(gvArq(id)); } catch (e) {}
  try { await db.query(`UPDATE aulas_gravadas SET status='no_pc', teste_ate=NULL WHERE id=$1`, [id]); } catch (e) {}
}
setInterval(async () => { if (!db) return; try { const r = await db.query(`SELECT id FROM aulas_gravadas WHERE status='teste' AND teste_ate < NOW()`); for (const x of r.rows) await gvApagarTeste(x.id); } catch (e) {} }, 3600000);
// 02/10d: na fase de teste, qualquer login do app vê as aulas gravadas de todas as academias.
// Para voltar a limitar à academia do aluno: GRAVADAS_SO_DA_ACADEMIA=1
const GV_ABERTAS = process.env.GRAVADAS_SO_DA_ACADEMIA !== '1';
async function gvDaAcademia(req, id) {
  const u = (await db.query('SELECT license_id, role FROM users WHERE id=$1', [req.user.id])).rows[0] || {};
  const g = (await db.query(`SELECT id, license_id, nome_aula, professor, dur_seg, uid, roteiro, teste_bytes, created_at FROM aulas_gravadas WHERE id=$1 AND status='teste' AND teste_ate > NOW()`, [parseInt(id, 10) || 0])).rows[0];
  if (!g) return null;
  if (!GV_ABERTAS && g.license_id !== u.license_id && !['super_admin', 'admin'].includes(u.role)) return null;
  return g;
}
async function gvRanking(g) {
  const out = [];
  if (g.uid) {
    const a = (await db.query('SELECT detalhe FROM aulas_tv WHERE license_id=$1 AND uid=$2', [g.license_id, g.uid])).rows[0];
    ((a && a.detalhe) || []).forEach(x => out.push({ nome: x.nome, wpp: Number(x.wpp) || 0, kcal: x.kcal || 0, onde: 'ao vivo' }));
  }
  const r = await db.query('SELECT user_id, nome, wpp, kcal FROM gravadas_resultados WHERE gravada_id=$1', [g.id]);
  r.rows.forEach(x => out.push({ nome: x.nome, wpp: Number(x.wpp) || 0, kcal: x.kcal || 0, onde: 'gravada', user_id: x.user_id }));
  out.sort((a, b) => b.wpp - a.wpp); out.forEach((x, i) => { x.pos = i + 1; });
  return out;
}
app.get('/user/gravadas', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const u = (await db.query('SELECT license_id, role FROM users WHERE id=$1', [req.user.id])).rows[0] || {};
    const todas = GV_ABERTAS || ['super_admin', 'admin'].includes(u.role);   // o dono do sistema vê as gravações de teste de todas as academias
    const r = await db.query(`SELECT g.id, g.nome_aula, g.professor, g.dur_seg, g.created_at, g.teste_ate, COALESCE(l.nome_fantasia, l.nome) AS academia,
        (SELECT COUNT(*)::int FROM gravadas_resultados x WHERE x.gravada_id=g.id) AS fizeram
      FROM aulas_gravadas g JOIN licencas l ON l.codigo=g.license_id
      WHERE g.status='teste' AND g.teste_ate > NOW() AND (g.license_id=$1 OR $2) AND g.roteiro IS NOT NULL ORDER BY g.created_at DESC LIMIT 20`, [u.license_id || '', todas]);
    res.json({ gravadas: r.rows, teste: true });
  } catch (e) { log('user gravadas: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.get('/gravadas/:id/roteiro', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const g = await gvDaAcademia(req, req.params.id); if (!g) return res.status(404).json({ error: 'Aula gravada não encontrada (o teste dura 72 h).' });
    res.json({ id: g.id, nome_aula: g.nome_aula, professor: g.professor, dur_seg: g.dur_seg, roteiro: g.roteiro, ranking: await gvRanking(g) });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
// o <video> não manda cabeçalho: o token vem no endereço (?t=)
app.get('/gravadas/:id/video', async (req, res) => {
  if (!db) return res.status(503).end();
  try {
    let p; try { p = jwt.verify(String(req.query.t || ''), JWT_SECRET); } catch (e) { return res.status(401).end(); }
    const g = await gvDaAcademia({ user: { id: p.id } }, req.params.id); if (!g) return res.status(404).end();
    const fs = require('fs'), arq = gvArq(g.id); let st; try { st = fs.statSync(arq); } catch (e) { return res.status(404).end(); }
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (!m) { res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(arq).pipe(res); }
    const ini = m[1] ? parseInt(m[1], 10) : 0, fim = Math.min(st.size - 1, m[2] ? parseInt(m[2], 10) : st.size - 1);
    if (ini >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
    res.writeHead(206, { 'Content-Type': 'video/webm', 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': fim - ini + 1 });
    fs.createReadStream(arq, { start: ini, end: fim }).pipe(res);
  } catch (e) { res.status(500).end(); }
});
app.post('/user/gravadas/:id/resultado', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const g = await gvDaAcademia(req, req.params.id); if (!g) return res.status(404).json({ error: 'Aula gravada não encontrada' });
    const b = req.body || {}, u = (await db.query('SELECT name FROM users WHERE id=$1', [req.user.id])).rows[0] || {};
    await db.query(`INSERT INTO gravadas_resultados (gravada_id, user_id, nome, wpp, kcal, watts) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (gravada_id, user_id) DO UPDATE SET wpp=GREATEST(gravadas_resultados.wpp, EXCLUDED.wpp), kcal=EXCLUDED.kcal, watts=EXCLUDED.watts, created_at=NOW()`,
      [g.id, req.user.id, u.name || 'Aluno', Math.max(0, Math.min(200, Number(b.wpp) || 0)), Math.max(0, Math.min(5000, parseInt(b.kcal, 10) || 0)), Math.max(0, Math.min(2500, parseInt(b.watts, 10) || 0))]);
    res.json({ ok: true, ranking: await gvRanking(g) });
  } catch (e) { log('gravada resultado: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// envio do arquivo para o app: pronto para quando houver armazenamento contratado
app.post('/display/gravacao/:id/enviar', displayAuth, async (req, res) => {
  if (!process.env.GRAVACOES_STORAGE) return res.status(501).json({ error: 'Envio de gravações para o app ainda não está ligado (falta contratar o armazenamento). A gravação continua no computador da TV.' });
  res.status(501).json({ error: 'Armazenamento configurado, mas o envio ainda não foi implementado para este provedor.' });
});


// ══════════════════════════════════════════════════════════════
// 02/10c — LISTA DE ESPERA, BIKE LIBERADA E LEMBRETE
// ══════════════════════════════════════════════════════════════
// Aula lotada → o aluno entra na fila (aulas_espera). Quando uma vaga abre
// (alguém cancela, ou não subiu na bike até 5 min depois do começo), o
// primeiro da fila ganha a reserva — de preferência na mesma bike — e recebe
// um e-mail. A TV avisa quem está na bike reservada (com ou sem app), para
// ninguém presente ser marcado como ausente. Lembrete por e-mail 1 h antes.
async function esMigrar() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS aulas_espera (
      id SERIAL PRIMARY KEY, agenda_id INTEGER REFERENCES aulas_agenda(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, data_aula DATE NOT NULL,
      status TEXT DEFAULT 'esperando', created_at TIMESTAMPTZ DEFAULT NOW(), chamado_em TIMESTAMPTZ,
      UNIQUE(agenda_id, user_id, data_aula));
    ALTER TABLE aulas_reservas ADD COLUMN IF NOT EXISTS lembrado BOOLEAN DEFAULT FALSE;
    ALTER TABLE aulas_reservas ADD COLUMN IF NOT EXISTS origem TEXT;
    ALTER TABLE aulas_reservas ADD COLUMN IF NOT EXISTS liberar_apos TIMESTAMPTZ;
  `);
  log('Migração 02/10c (lista de espera e lembretes) OK');
}
const _DSEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function _dataBR(iso) { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return _DSEM[d.getDay()] + ', ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
async function esLotacao(agendaId, data) {
  const a = (await db.query('SELECT vagas_max, license_id FROM aulas_agenda WHERE id=$1', [agendaId])).rows[0]; if (!a) return null;
  const teto = await tetoLicenca(a.license_id), cap = _capVagas(a.vagas_max, teto), total = Math.min(40, teto || cap);
  const r = await db.query(`SELECT user_id, bike_numero FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=$2 AND status NOT IN ('cancelado','ausente')`, [agendaId, data]);
  return { cap, total, n: r.rows.length, bikes: r.rows.map(x => x.bike_numero).filter(Boolean).map(Number) };
}
// chama o primeiro da fila (se houver vaga); bikePref = a bike que ficou livre
async function esPromover(agendaId, data, bikePref) {
  try {
    const L = await esLotacao(agendaId, data); if (!L || L.n >= L.cap) return null;
    const f = await db.query(`SELECT id, user_id FROM aulas_espera WHERE agenda_id=$1 AND data_aula=$2 AND status='esperando' ORDER BY created_at, id LIMIT 1`, [agendaId, data]);
    if (!f.rows.length) return null;
    const e = f.rows[0];
    let bike = (bikePref && !L.bikes.includes(Number(bikePref))) ? Number(bikePref) : null;
    if (!bike) { for (let k = 1; k <= L.total; k++) if (!L.bikes.includes(k)) { bike = k; break; } }
    // quem é chamado da fila tem 15 min para chegar antes de a bike ser liberada de novo
    await db.query(`INSERT INTO aulas_reservas (agenda_id, user_id, data_aula, bike_numero, origem, liberar_apos) VALUES ($1,$2,$3,$4,'espera',NOW()+INTERVAL '15 minutes')
      ON CONFLICT (agenda_id, user_id, data_aula) DO UPDATE SET status='reservado', bike_numero=EXCLUDED.bike_numero, origem='espera', liberar_apos=EXCLUDED.liberar_apos`, [agendaId, e.user_id, data, bike]);
    await db.query(`UPDATE aulas_espera SET status='chamado', chamado_em=NOW() WHERE id=$1`, [e.id]);
    log(`Lista de espera: usuário ${e.user_id} ganhou a vaga (bike ${bike}) na aula ${agendaId} de ${data}`);
    esEmail('vaga_aberta', e.user_id, agendaId, data, bike).catch(() => {});
    return { user_id: e.user_id, bike };
  } catch (err) { log('esPromover: ' + err.message); return null; }
}
async function esEmail(tipo, uid, agendaId, data, bike) {
  if (!emailProvedor()) return;
  const u = await _userLic(uid); if (!u || !u.email) return;
  const a = (await db.query(`SELECT a.nome, to_char(a.hora,'HH24:MI') AS hora, a.license_id, COALESCE(l.nome_fantasia, l.nome) AS academia FROM aulas_agenda a JOIN licencas l ON l.codigo=a.license_id WHERE a.id=$1`, [agendaId])).rows[0];
  if (!a) return;
  const c = await emailsCfgDe(a.license_id); if (!c[tipo]) return;
  const v = { nome: String(u.name || '').split(' ')[0], nome_completo: u.name || '', academia: a.academia, aula: a.nome, hora: a.hora, bike: bike || '—', data: _dataBR(data) };
  const m = emailMontar(tipo, c, v, null, '', PORTAL_URL + '/aluno', a.academia);
  await emailUmaVez(tipo, 'u' + uid + ':' + agendaId + ':' + String(data).slice(0, 10) + (tipo === 'vaga_aberta' ? ':' + Date.now() : ''), uid, u.email, m.subject, m.html);
}
app.post('/aluno/espera', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const agenda_id = parseInt((req.body || {}).agenda_id, 10) || 0, data = String((req.body || {}).data_aula || '').slice(0, 10);
    if (!agenda_id || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'agenda_id e data_aula obrigatórios' });
    const L = await esLotacao(agenda_id, data); if (!L) return res.status(404).json({ error: 'Aula não encontrada' });
    const ja = await db.query(`SELECT 1 FROM aulas_reservas WHERE agenda_id=$1 AND data_aula=$2 AND user_id=$3 AND status NOT IN ('cancelado','ausente')`, [agenda_id, data, req.user.id]);
    if (ja.rows.length) return res.status(409).json({ error: 'Você já tem reserva nesta aula.' });
    if (L.n < L.cap) return res.status(409).json({ error: 'Ainda tem vaga: reserve direto.', tem_vaga: true });
    await db.query(`INSERT INTO aulas_espera (agenda_id, user_id, data_aula) VALUES ($1,$2,$3)
      ON CONFLICT (agenda_id, user_id, data_aula) DO UPDATE SET status='esperando', created_at=CASE WHEN aulas_espera.status='esperando' THEN aulas_espera.created_at ELSE NOW() END`, [agenda_id, req.user.id, data]);
    const pos = (await db.query(`SELECT COUNT(*)::int AS n FROM aulas_espera WHERE agenda_id=$1 AND data_aula=$2 AND status='esperando'
      AND created_at <= (SELECT created_at FROM aulas_espera WHERE agenda_id=$1 AND data_aula=$2 AND user_id=$3)`, [agenda_id, data, req.user.id])).rows[0].n;
    res.json({ ok: true, posicao: pos });
  } catch (e) { log('espera: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.delete('/aluno/espera/:agenda/:data', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try { await db.query(`UPDATE aulas_espera SET status='saiu' WHERE agenda_id=$1 AND data_aula=$2 AND user_id=$3 AND status='esperando'`, [parseInt(req.params.agenda, 10) || 0, req.params.data, req.user.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
app.get('/aluno/esperas', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`SELECT e.agenda_id, to_char(e.data_aula,'YYYY-MM-DD') AS data_aula, a.nome AS aula_nome, to_char(a.hora,'HH24:MI') AS hora,
        COALESCE(l.nome_fantasia, l.nome) AS academia,
        (SELECT COUNT(*)::int FROM aulas_espera x WHERE x.agenda_id=e.agenda_id AND x.data_aula=e.data_aula AND x.status='esperando' AND x.created_at<=e.created_at) AS posicao
      FROM aulas_espera e JOIN aulas_agenda a ON a.id=e.agenda_id JOIN licencas l ON l.codigo=a.license_id
      WHERE e.user_id=$1 AND e.status='esperando' AND e.data_aula >= CURRENT_DATE ORDER BY e.data_aula, a.hora`, [req.user.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
// TV: quem está na bike reservada (pedalando, com ou sem app) → presente
app.post('/display/reservas/presentes', displayAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const ids = (Array.isArray((req.body || {}).ids) ? req.body.ids : []).map(x => parseInt(x, 10)).filter(Boolean).slice(0, 60);
    if (ids.length) await db.query(`UPDATE aulas_reservas r SET status='presente' FROM aulas_agenda a
      WHERE r.agenda_id=a.id AND a.license_id=$1 AND r.id = ANY($2::int[]) AND r.status='reservado'`, [req.user.license_id, ids]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});
// rotina de 1 em 1 minuto: lembrete 1 h antes e bike liberada 5 min depois do começo
async function esRotina() {
  if (!db) return;
  try {
    const { iso } = _hojeBR();
    const lem = await db.query(`SELECT r.id, r.user_id, r.agenda_id, r.bike_numero FROM aulas_reservas r JOIN aulas_agenda a ON a.id=r.agenda_id
      WHERE r.data_aula=$1 AND r.status='reservado' AND NOT COALESCE(r.lembrado,false)
        AND a.hora BETWEEN (NOW() AT TIME ZONE 'America/Sao_Paulo')::time AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::time + INTERVAL '60 minutes'`, [iso]);
    for (const r of lem.rows) { await db.query('UPDATE aulas_reservas SET lembrado=TRUE WHERE id=$1', [r.id]); esEmail('lembrete_aula', r.user_id, r.agenda_id, iso, r.bike_numero).catch(() => {}); }
    const aus = await db.query(`UPDATE aulas_reservas r SET status='ausente' FROM aulas_agenda a
      WHERE r.agenda_id=a.id AND r.data_aula=$1 AND r.status='reservado' AND (r.liberar_apos IS NULL OR NOW() > r.liberar_apos)
        AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::time BETWEEN a.hora + INTERVAL '5 minutes' AND a.hora + make_interval(mins => COALESCE(a.duracao_min,60))
      RETURNING r.agenda_id, r.bike_numero, r.user_id`, [iso]);
    for (const r of aus.rows) { log(`Bike ${r.bike_numero || '—'} liberada (usuário ${r.user_id} não chegou) na aula ${r.agenda_id}`); await esPromover(r.agenda_id, iso, r.bike_numero); }
  } catch (e) { log('esRotina: ' + e.message); }
}
setInterval(esRotina, 60000);


// ══════════════════════════════════════════════════════════════
// 02/10d — PAINEL DO GESTOR (OCUPAÇÃO E ALUNOS SUMIDOS)
// ══════════════════════════════════════════════════════════════
// Ocupação: pelas aulas que a TV fechou (aulas_tv) — quantos pedalaram em
// cada dia da semana e horário, sobre as bikes da licença. Sumidos: alunos
// com 2+ aulas cuja última foi há mais de 14 dias, com o botão de mandar o
// e-mail "Sentimos sua falta" na hora.
app.get('/gestor/ocupacao', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const dias = Math.max(7, Math.min(180, parseInt(req.query.dias, 10) || 60));
    const lic = (await db.query(`SELECT COALESCE(NULLIF(bikes_disponiveis,0), NULLIF(max_bikes,0), 15) AS bikes FROM licencas WHERE codigo=$1`, [req.user.license_id])).rows[0] || { bikes: 15 };
    const r = await db.query(`
      SELECT EXTRACT(DOW FROM (inicio AT TIME ZONE 'America/Sao_Paulo'))::int AS dow, EXTRACT(HOUR FROM (inicio AT TIME ZONE 'America/Sao_Paulo'))::int AS hora,
             COUNT(*)::int AS aulas, ROUND(AVG(n_alunos)::numeric,1)::float AS media, MAX(n_alunos)::int AS max
      FROM aulas_tv WHERE license_id=$1 AND inicio > NOW() - make_interval(days => $2) GROUP BY 1,2 ORDER BY 1,2`, [req.user.license_id, dias]);
    const tot = await db.query(`SELECT COUNT(*)::int AS aulas, COALESCE(SUM(n_alunos),0)::int AS part FROM aulas_tv WHERE license_id=$1 AND inicio > NOW() - make_interval(days => $2)`, [req.user.license_id, dias]);
    const res2 = await db.query(`SELECT COUNT(*) FILTER (WHERE r.status='presente')::int AS presentes, COUNT(*) FILTER (WHERE r.status='ausente')::int AS faltas,
        (SELECT COUNT(*)::int FROM aulas_espera e JOIN aulas_agenda a2 ON a2.id=e.agenda_id WHERE a2.license_id=$1 AND e.data_aula > CURRENT_DATE - $2::int) AS fila
      FROM aulas_reservas r JOIN aulas_agenda a ON a.id=r.agenda_id WHERE a.license_id=$1 AND r.data_aula > CURRENT_DATE - $2::int AND r.data_aula <= CURRENT_DATE`, [req.user.license_id, dias]);
    res.json({ dias, bikes: lic.bikes, celulas: r.rows.map(x => Object.assign(x, { pct: Math.round(x.media / Math.max(1, lic.bikes) * 100) })), total: tot.rows[0], reservas: res2.rows[0] });
  } catch (e) { log('ocupacao: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.get('/gestor/sumidos', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  try {
    const r = await db.query(`
      SELECT u.id, u.name AS nome, u.email, COUNT(ah.id)::int AS aulas, MAX(ah.data_aula) AS ultima,
             EXTRACT(DAY FROM NOW() - MAX(ah.data_aula))::int AS dias,
             (SELECT MAX(enviado_em) FROM email_log el WHERE el.user_id=u.id AND el.tipo='sumido') AS avisado_em
      FROM users u JOIN aula_historico ah ON ah.user_id=u.id
      WHERE u.license_id=$1 AND u.role='aluno' AND COALESCE(u.status,'ativo')='ativo'
      GROUP BY u.id HAVING COUNT(ah.id) >= 2 AND MAX(ah.data_aula) < NOW() - INTERVAL '14 days'
      ORDER BY MAX(ah.data_aula) DESC LIMIT 200`, [req.user.license_id]);
    res.json({ sumidos: r.rows, email: !!emailProvedor() });
  } catch (e) { log('sumidos: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
app.post('/gestor/sumidos/:id/avisar', gestorAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  if (!emailProvedor()) return res.status(501).json({ error: 'O envio de e-mail ainda não está configurado no servidor.' });
  try {
    const u = (await db.query(`SELECT u.id, u.name, u.email, MAX(ah.data_aula) AS ultima FROM users u LEFT JOIN aula_historico ah ON ah.user_id=u.id
      WHERE u.id=$1 AND u.license_id=$2 GROUP BY u.id`, [parseInt(req.params.id, 10) || 0, req.user.license_id])).rows[0];
    if (!u || !u.email) return res.status(404).json({ error: 'Aluno não encontrado' });
    const l = (await db.query('SELECT COALESCE(nome_fantasia, nome) AS nome FROM licencas WHERE codigo=$1', [req.user.license_id])).rows[0] || {};
    const c = await emailsCfgDe(req.user.license_id);
    const dias = u.ultima ? Math.floor((Date.now() - new Date(u.ultima)) / 86400000) : 0;
    const m = emailMontar('sumido', c, { nome: String(u.name || '').split(' ')[0], nome_completo: u.name || '', academia: l.nome, dias }, null, '', PORTAL_URL + '/aluno', l.nome);
    const ok = await emailUmaVez('sumido', 'manual:u' + u.id + ':' + new Date().toISOString().slice(0, 10), u.id, u.email, m.subject, m.html);
    res.json({ ok: true, enviado: ok, msg: ok ? 'E-mail enviado.' : 'Já foi enviado hoje para este aluno.' });
  } catch (e) { log('avisar sumido: ' + e.message); res.status(500).json({ error: 'Erro interno' }); }
});
// ══════════════════════════════════════════════════════════════
// ASAAS — WEBHOOK DE PAGAMENTOS
// ══════════════════════════════════════════════════════════════
const ASAAS_BASE    = process.env.ASAAS_URL || 'https://api.asaas.com/v3';   // ASAAS_URL só para teste (sandbox)
async function asaasApi(metodo, caminho, corpo) {
  const r = await fetch(ASAAS_BASE + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY, 'User-Agent': 'ProRider' }, body: corpo ? JSON.stringify(corpo) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.errors && d.errors[0] && d.errors[0].description) || ('HTTP ' + r.status));
  return d;
}

// 02/10g: o Asaas manda o token do webhook no cabeçalho 'asaas-access-token'.
// Sem a variável ASAAS_WEBHOOK_TOKEN (o mesmo valor do painel do Asaas), o
// webhook recusa tudo — senão qualquer um que soubesse o endereço podia
// mandar um "pagamento recebido" falso e liberar uma licença.
function asaasTokenOk(req) {
  const k = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!k || k.length < 12) return false;
  const a = Buffer.from(String(req.headers['asaas-access-token'] || '')), b = Buffer.from(k);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
app.post('/webhook/asaas', express.json(), async (req, res) => {
  if (!asaasTokenOk(req)) { log('[Asaas webhook] recusado: token ausente ou errado' + (process.env.ASAAS_WEBHOOK_TOKEN ? '' : ' (falta ASAAS_WEBHOOK_TOKEN no Railway)')); return res.status(401).json({ error: 'Token inválido' }); }
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const ev = req.body;
  if (!ev || !ev.event) return res.status(400).json({ error: 'Evento inválido' });
  log(`[Asaas webhook] ${ev.event} payment=${ev.payment && ev.payment.id}`);
  try {
    const p = ev.payment || {};
    // 03/10a: acha a licença pela referência; senão pela assinatura; senão pelo cliente
    let l = null;
    if (p.externalReference) l = (await db.query('SELECT * FROM licencas WHERE codigo=$1', [p.externalReference])).rows[0];
    if (!l && p.subscription) l = (await db.query('SELECT * FROM licencas WHERE asaas_sub=$1', [p.subscription])).rows[0];
    if (!l && p.customer) l = (await db.query('SELECT * FROM licencas WHERE asaas_customer=$1 ORDER BY id LIMIT 1', [p.customer])).rows[0];
    if (!l || !p.id) return res.json({ ok: true, ignorado: 'licença não encontrada' });
    const cod = l.codigo, venc = isoDia(p.dueDate) || proxVenc(l);
    const PAGO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'], DESFEITO = ['PAYMENT_RECEIVED_IN_CASH_UNDONE', 'PAYMENT_REFUNDED', 'PAYMENT_DELETED',
      'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL', 'PAYMENT_REFUND_IN_PROGRESS'];
    const pagoAgora = PAGO.includes(ev.event) || (ev.event === 'PAYMENT_RESTORED' && ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(p.status));
    if (pagoAgora) {
      const metodo = p.status === 'RECEIVED_IN_CASH' ? 'Asaas — marcado como recebido em dinheiro' : ({ CREDIT_CARD: 'Cartão (Asaas)', PIX: 'PIX (Asaas)', BOLETO: 'Boleto (Asaas)' }[p.billingType] || 'Asaas');
      const dataPg = isoDia(p.clientPaymentDate || p.paymentDate || p.confirmedDate) || dataSP();
      const cobre = maisMes(venc);
      await db.query(`INSERT INTO pagamentos (license_id, valor, data_pgto, referencia, metodo, status, origem, asaas_id, venc_ref, cobre_ate, registrado_por)
        VALUES ($1,$2,$3,$4,$5,'confirmado','asaas',$6,$7,$8,'asaas')
        ON CONFLICT (asaas_id) DO UPDATE SET status='confirmado', license_id=EXCLUDED.license_id, valor=EXCLUDED.valor, data_pgto=EXCLUDED.data_pgto, metodo=EXCLUDED.metodo, venc_ref=EXCLUDED.venc_ref, cobre_ate=EXCLUDED.cobre_ate`,
        [cod, Number(p.value) || 0, dataPg, 'Vencimento ' + venc.split('-').reverse().join('/'), metodo, p.id, venc, cobre]);
      await db.query("UPDATE licencas SET asaas_aviso=NULL, status=CASE WHEN status='suspensa' THEN 'ativa' ELSE status END WHERE codigo=$1", [cod]);
      await pgRecalc(cod);
      log(`[Asaas] ${cod} pago (${p.id}, ${metodo}) cobre ${venc} → ${cobre}`);
    } else if (DESFEITO.includes(ev.event)) {
      const u = await db.query("UPDATE pagamentos SET status='estornado', obs=COALESCE(obs||' · ','')||$2 WHERE asaas_id=$1 AND status='confirmado' RETURNING venc_ref", [p.id, ev.event]);
      if (u.rows.length) { await pgRecalc(cod, isoDia(u.rows[0].venc_ref)); log(`[Asaas] ${cod} pagamento ${p.id} desfeito (${ev.event})`); }
    } else if (ev.event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED' || ev.event === 'PAYMENT_REPROVED_BY_RISK_ANALYSIS') {
      await db.query('UPDATE licencas SET asaas_aviso=$1 WHERE codigo=$2', ['O cartão foi recusado na fatura de ' + venc.split('-').reverse().join('/') + '. Pague de novo com outro cartão.', cod]);
      log(`[Asaas] ${cod} cartão recusado (${p.id})`);
    } else {
      await pgRecalc(cod);   // OVERDUE, UPDATED, CREATED…: só recalcula a situação
    }
    res.json({ ok: true });
  } catch (e) { log(`[Asaas webhook] erro: ${e.message}`); res.status(500).json({ error: 'Erro interno' }); }
});

app.post('/admin/asaas/assinatura', adminAuth, async (req, res) => {
  if (!ASAAS_API_KEY) return res.status(503).json({ error: 'ASAAS_API_KEY não configurada' });
  if (!db) return res.status(503).json({ error: 'Banco indisponível' });
  const { license_id, customer_name, customer_email, customer_cpf_cnpj,
          valor, ciclo, credit_card_token } = req.body;
  if (!license_id || !customer_email || !valor)
    return res.status(400).json({ error: 'license_id, customer_email e valor obrigatórios' });
  try {
    const lic = (await db.query('SELECT * FROM licencas WHERE codigo=$1', [license_id])).rows[0];
    if (!lic) return res.status(404).json({ error: 'Licença não encontrada' });
    const custRes = await fetch(`${ASAAS_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({ name: customer_name || lic.contato_nome || lic.nome,
        email: customer_email, cpfCnpj: customer_cpf_cnpj || '', externalReference: license_id })
    });
    const cust = await custRes.json();
    if (!cust.id) return res.status(400).json({ error: 'Erro ao criar customer Asaas', detalhe: cust });
    let dataInicio = proxVenc(lic); if (dataInicio < dataSP()) dataInicio = dataSP();   // 03/10a: vencimento da licença, não "hoje" 
    const subBody = { customer: cust.id, billingType: 'CREDIT_CARD', value: parseFloat(valor),
      nextDueDate: dataInicio, cycle: ciclo || 'MONTHLY',
      description: `ProRider — licença ${license_id}`, externalReference: license_id };
    if (credit_card_token) { subBody.creditCardToken = credit_card_token; subBody.remoteIp = req.ip; }
    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(subBody)
    });
    const sub = await subRes.json();
    if (!sub.id) return res.status(400).json({ error: 'Erro ao criar assinatura Asaas', detalhe: sub });
    await db.query(`UPDATE licencas SET obs=COALESCE(obs,'')||' | asaas_sub='||$1, asaas_sub=$1, asaas_customer=$3, updated_at=NOW() WHERE codigo=$2`, [sub.id, license_id, cust.id]);
    res.json({ ok: true, customer_id: cust.id, subscription_id: sub.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

server.listen(PORT, () => {
  log(`ProRider Server v2.0 rodando na porta ${PORT}`);
  log(`HTTP + WebSocket ativos`);
  log(`Banco: ${db ? 'PostgreSQL conectado' : 'sem banco (modo WebSocket only)'}`);
});
