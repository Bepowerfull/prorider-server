/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PRORIDER — Servidor Local (Fase 2)                         ║
 * ║  Roda no mini PC da sala, sem depender de internet          ║
 * ║                                                              ║
 * ║  INSTALAÇÃO:                                                 ║
 * ║    1. Instale Node.js: https://nodejs.org                   ║
 * ║    2. npm install ws                                         ║
 * ║    3. node prorider-server-local.js                         ║
 * ║                                                              ║
 * ║  CONFIGURAÇÃO NO script.js:                                  ║
 * ║    var SERVER_URL = 'ws://SEU_IP_LOCAL:8080';               ║
 * ║    (descubra o IP com: ipconfig no Windows)                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const WebSocket = require('ws');
const os = require('os');

// ── Configuração ────────────────────────────────────────────────
const PORT = 8080;

// ── Estado das salas ─────────────────────────────────────────────
// salas[codigo] = { professor: ws, alunos: Map<nome, ws> }
const salas = {};

// ── Utilitários ──────────────────────────────────────────────────
function log(msg) {
  const now = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${now}] ${msg}`);
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

function broadcast(salaCode, msg, excludeWs = null) {
  const sala = salas[salaCode];
  if (!sala) return;
  const data = JSON.stringify(msg);
  // Envia para o professor
  if (sala.professor && sala.professor !== excludeWs && sala.professor.readyState === WebSocket.OPEN) {
    sala.professor.send(data);
  }
  // Envia para todos os alunos
  for (const [nome, ws] of sala.alunos) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

// ── Servidor WebSocket ────────────────────────────────────────────
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
  ws._salaCode = null;
  ws._tipo = null;
  ws._nome = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.tipo) {

      // ── Professor cria a sala ──────────────────────────────────
      case 'criar_sala': {
        const codigo = msg.codigo;
        if (!codigo) return;
        salas[codigo] = { professor: ws, alunos: new Map() };
        ws._salaCode = codigo;
        ws._tipo = 'professor';
        log(`Sala criada: ${codigo}`);
        ws.send(JSON.stringify({ tipo: 'sala_criada', codigo }));
        break;
      }

      // ── Aluno entra na sala ────────────────────────────────────
      case 'entrar_sala': {
        const { codigo, nome, bike } = msg;
        if (!codigo || !nome) return;
        const sala = salas[codigo];
        if (!sala) {
          ws.send(JSON.stringify({ tipo: 'erro', msg: 'Sala não encontrada' }));
          return;
        }
        sala.alunos.set(nome, ws);
        ws._salaCode = codigo;
        ws._tipo = 'aluno';
        ws._nome = nome;
        log(`Aluno entrou: ${nome} (bike ${bike || '?'}) na sala ${codigo}`);
        // Notifica o professor
        if (sala.professor && sala.professor.readyState === WebSocket.OPEN) {
          sala.professor.send(JSON.stringify({
            tipo: 'aluno_conectou',
            nome,
            bike: bike || null,
            horario: new Date().toLocaleTimeString('pt-BR')
          }));
        }
        ws.send(JSON.stringify({ tipo: 'conectado', codigo, nome }));
        ws.send(JSON.stringify({ tipo: 'entrou_sala', codigo, nome }));
        break;
      }

      // ── Aluno envia dados da bike ──────────────────────────────
      case 'dados_aluno': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        const sala = salas[salaCode];
        // Repassa para o professor
        if (sala.professor && sala.professor.readyState === WebSocket.OPEN) {
          sala.professor.send(JSON.stringify({
            tipo: 'dados_aluno',
            nome: ws._nome || msg.nome,
            bike: msg.bike,
            watts: msg.watts,
            rpm: msg.rpm,
            fc: msg.fc,
            zona: msg.zona,
            ftp: msg.ftp,
            horario: msg.horario || new Date().toLocaleTimeString('pt-BR')
          }));
        }
        break;
      }

      // ── Professor envia dados para alunos (ex: bloco atual) ────
      case 'dados_aula':
      case 'update_aula': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        broadcast(salaCode, msg, ws);
        break;
      }
         

      // ── Heartbeat / ping ───────────────────────────────────────
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
      // Professor desconectou — notifica alunos e fecha sala
      log(`Professor saiu da sala ${salaCode}`);
      broadcast(salaCode, { tipo: 'sala_encerrada' }, ws);
      delete salas[salaCode];
    } else if (ws._tipo === 'aluno' && ws._nome) {
      sala.alunos.delete(ws._nome);
      log(`Aluno saiu: ${ws._nome}`);
      if (sala.professor && sala.professor.readyState === WebSocket.OPEN) {
        sala.professor.send(JSON.stringify({ tipo: 'aluno_saiu', nome: ws._nome }));
      }
    }
  });

  ws.on('error', (err) => {
    // Silencia erros de conexão fechada abruptamente
    if (err.code !== 'ECONNRESET') console.error('WS error:', err.message);
  });
});

// ── Limpeza periódica de salas vazias ────────────────────────────
setInterval(() => {
  for (const [codigo, sala] of Object.entries(salas)) {
    const profOk = sala.professor && sala.professor.readyState === WebSocket.OPEN;
    if (!profOk && sala.alunos.size === 0) {
      delete salas[codigo];
      log(`Sala removida (vazia): ${codigo}`);
    }
  }
}, 30000);

// ── Startup ───────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════╗');
console.log('║  PRORIDER — Servidor Local iniciado          ║');
console.log('╚══════════════════════════════════════════════╝\n');

const ips = getLocalIPs();
if (ips.length === 0) {
  console.log(`  Porta: ${PORT}`);
  console.log(`  URL local: ws://localhost:${PORT}\n`);
} else {
  console.log('  Endereços disponíveis na rede:\n');
  ips.forEach(({ name, ip }) => {
    console.log(`  ${name.padEnd(20)} ws://${ip}:${PORT}`);
  });
  console.log(`\n  Coloque o primeiro IP no script.js:`);
  console.log(`  var SERVER_URL = 'ws://${ips[0].ip}:${PORT}';\n`);
}

console.log('  Aguardando conexões...\n');
