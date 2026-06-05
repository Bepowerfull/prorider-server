/**
 * PRORIDER — Servidor WebSocket
 */
const WebSocket = require('ws');
const os = require('os');

const PORT = process.env.PORT || 8080;

const salas = {};

function log(msg) {
  const now = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${now}] ${msg}`);
}

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

const wss = new WebSocket.Server({ port: PORT });

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
        sala.estado.grafico = msg.grafico || [];
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
        if (msg.grafico) sala.estado.grafico = msg.grafico;
        if (msg.blocoIdx !== undefined) sala.estado.blocoIdx = msg.blocoIdx;
        if (msg.nomeAula) sala.estado.nomeAula = msg.nomeAula;
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

      case 'fim_aula': {
        const salaCode = ws._salaCode;
        if (!salaCode || !salas[salaCode]) return;
        salas[salaCode].estado.iniciada = false;
        log(`Aula encerrada na sala ${salaCode}`);
        broadcastAlunos(salaCode, { tipo: 'fim_aula' });
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
      if (sala.professor && sala.professor.readyState === WebSocket.OPEN) sala.professor.send(JSON.stringify({ tipo: 'aluno_saiu', nome: ws._nome }));
    }
  });

  ws.on('error', (err) => { if (err.code !== 'ECONNRESET') console.error('WS error:', err.message); });
});

setInterval(() => {
  for (const [codigo, sala] of Object.entries(salas)) {
    const profOk = sala.professor && sala.professor.readyState === WebSocket.OPEN;
    if (!profOk && sala.alunos.size === 0) { delete salas[codigo]; log(`Sala removida: ${codigo}`); }
  }
}, 30000);

console.log('\nPRORI DER — Servidor iniciado. Aguardando conexoes...\n');