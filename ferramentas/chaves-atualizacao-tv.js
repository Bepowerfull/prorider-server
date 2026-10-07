#!/usr/bin/env node
// ProRider — CRIA o par de chaves da atualização automática das TVs (07/10a). Rodar UMA vez, no
// computador do Mario (ou do desenvolvedor, com o Mario junto):
//   node ferramentas/chaves-atualizacao-tv.js  C:\ProRider-chaves
// Gera:
//   prorider-tv-PRIVADA.pem  → assina cada versão. NUNCA no GitHub, no servidor, no e-mail ou no chat.
//                              Guarde em 2 lugares (pendrive + cofre de senhas). Perdeu = gera outra e
//                              reinstala o programa da TV (pelo .bat) com a chave pública nova.
//   prorider-tv-publica.pem  → vai DENTRO do programa da TV (main.js). Pode ser pública.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.argv[2]; if (!dir) { console.error('uso: node chaves-atualizacao-tv.js <pasta FORA do projeto>'); process.exit(2); }
if (fs.existsSync(path.join(process.cwd(), '.git')) && path.resolve(dir).startsWith(process.cwd())) { console.error('⛔ escolha uma pasta FORA do projeto (a chave privada não pode ir para o Git).'); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });
const priv = path.join(dir, 'prorider-tv-PRIVADA.pem'), pub = path.join(dir, 'prorider-tv-publica.pem');
if (fs.existsSync(priv)) { console.error('⛔ já existe ' + priv + ' — não sobrescrevo.'); process.exit(2); }
const k = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(priv, k.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(pub, k.publicKey.export({ type: 'spki', format: 'pem' }));
console.log('✓ chaves criadas em ' + dir + '\n  PRIVADA (guardar com cuidado): ' + priv + '\n  pública (vai no main.js):        ' + pub + '\n\n' + fs.readFileSync(pub, 'utf8'));
