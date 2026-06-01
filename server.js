const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('ProRider Server OK');
});

const wss = new WebSocket.Server({ server });
const salas = {};

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.tipo === 'criar_sala') {
        salas[data.codigo] = { professor: ws, alunos: [] };
        ws.salaId = data.codigo;
        ws.role = 'professor';
        ws.send(JSON.stringify({ tipo: 'sala_criada', codigo: data.codigo }));
      }
      if (data.tipo === 'entrar_sala') {
        const sala = salas[data.codigo];
        if (!sala) { ws.send(JSON.stringify({ tipo: 'erro', msg: 'Sala nao encontrada' })); return; }
        sala.alunos.push(ws);
        ws.salaId = data.codigo;
        ws.role = 'aluno';
        ws.nome = data.nome || 'Aluno';
        ws.send(JSON.stringify({ tipo: 'conectado', codigo: data.codigo }));
        if (sala.professor) sala.professor.send(JSON.stringify({ tipo: 'aluno_conectou', nome: ws.nome, total: sala.alunos.length }));
      }
      if (data.tipo === 'update_aula') {
        const sala = salas[ws.salaId];
        if (!sala) return;
        sala.alunos.forEach((aluno) => {
          if (aluno.readyState === WebSocket.OPEN) aluno.send(JSON.stringify({ tipo: 'update_aula', bloco: data.bloco, zona: data.zona, segTime: data.segTime, totTime: data.totTime, upNext: data.upNext }));
        });
      }
      if (data.tipo === 'dados_aluno') {
        const sala = salas[ws.salaId];
        if (!sala || !sala.professor) return;
        if (sala.professor.readyState === WebSocket.OPEN) sala.professor.send(JSON.stringify({ tipo: 'dados_aluno', nome: ws.nome, rpm: data.rpm, watts: data.watts, bpm: data.bpm, zona: data.zona, ftp: data.ftp }));
      }
    } catch (e) { console.error('Erro:', e.message); }
  });

  ws.on('close', () => {
    if (!ws.salaId) return;
    const sala = salas[ws.salaId];
    if (!sala) return;
    if (ws.role === 'professor') {
      sala.alunos.forEach((aluno) => { if (aluno.readyState === WebSocket.OPEN) aluno.send(JSON.stringify({ tipo: 'professor_saiu' })); });
      delete salas[ws.salaId];
    } else {
      sala.alunos = sala.alunos.filter((a) => a !== ws);
      if (sala.professor && sala.professor.readyState === WebSocket.OPEN) sala.professor.send(JSON.stringify({ tipo: 'aluno_saiu', nome: ws.nome, total: sala.alunos.length }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('ProRider Server rodando na porta', PORT));
