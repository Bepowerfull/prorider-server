// 07/10c — Windows + Node 24: às vezes o Node quebra AO FECHAR (libuv "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"),
// depois que o teste já terminou e chamou process.exit(0). Aqui guardamos o código que o TESTE pediu, para o rodar.js
// não marcar ❌ um teste que passou. (Carregado com "node -r testes/saida.js"; não muda nada no teste.)
const fs = require('fs'), arq = process.env.T_SAIDA, sair = process.exit.bind(process);
process.exit = function (c) { try { if (arq) fs.writeFileSync(arq, String(c == null ? (process.exitCode || 0) : c)); } catch (e) {} return sair(c); };
