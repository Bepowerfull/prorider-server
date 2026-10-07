#!/usr/bin/env node
// ProRider — MONTA E ASSINA a versão do Ginásio para a atualização automática das TVs (07/10a).
// Rodar a cada versão nova do Ginásio, ANTES do deploy:
//   node ferramentas/montar-atualizacao-tv.js  <pasta ginasio>  <chave PRIVADA .pem>  <pasta public>
//   ex.: node ferramentas/montar-atualizacao-tv.js ginasio C:\ProRider-chaves\prorider-tv-PRIVADA.pem public
// Gera em <public>/ginasio/atualizacao/:  <versão>.prpack (os arquivos da TV, compactados)
//   e manifesto.json { versao, arquivo, tamanho, sha256, assinatura }. O servidor só oferece às TVs
//   o manifesto que for da versão GINASIO_VERSAO dele.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const [gin, chave, pub] = process.argv.slice(2);
if (!gin || !chave || !pub) { console.error('uso: node montar-atualizacao-tv.js <pasta ginasio> <chave privada .pem> <pasta public>'); process.exit(2); }
const sc = fs.readFileSync(path.join(gin, 'script.js'), 'utf8'), m = sc.match(/var PR_BUILD='BUILD (\d\d\/\d\d[a-z])'/);
if (!m) { console.error('⛔ não achei o PR_BUILD no script.js'); process.exit(2); }
const versao = m[1], FORA = /\.(bat|cmd|exe|zip|md)$/i;
const arquivos = {};
for (const n of fs.readdirSync(gin)) { const f = path.join(gin, n);
  if (!fs.statSync(f).isFile() || FORA.test(n) || n.startsWith('.')) continue;
  if (!/^[a-z0-9][a-z0-9_.-]{0,60}\.(html|js|css|png|json|txt)$/i.test(n)) { console.error('⛔ nome de arquivo fora do padrão: ' + n); process.exit(2); }
  arquivos[n] = fs.readFileSync(f).toString('base64'); }
for (const n of ['ginasio.html', 'script.js', 'style.css', 'bled112.js']) if (!arquivos[n]) { console.error('⛔ falta ' + n); process.exit(2); }
const buf = zlib.gzipSync(Buffer.from(JSON.stringify({ versao, arquivos })), { level: 9 });
const sha = crypto.createHash('sha256').update(buf).digest('hex');
const priv = crypto.createPrivateKey(fs.readFileSync(chave));
const assinatura = crypto.sign(null, Buffer.from(versao + '|' + sha), priv).toString('base64');
const dest = path.join(pub, 'ginasio', 'atualizacao'); fs.mkdirSync(dest, { recursive: true });
const nomeArq = versao.replace('/', '-') + '.prpack';
for (const v of fs.readdirSync(dest)) if (v.endsWith('.prpack') && v !== nomeArq) fs.unlinkSync(path.join(dest, v));   // só a versão atual
fs.writeFileSync(path.join(dest, nomeArq), buf);
fs.writeFileSync(path.join(dest, 'manifesto.json'), JSON.stringify({ versao, arquivo: nomeArq, tamanho: buf.length, sha256: sha, assinatura, arquivos: Object.keys(arquivos).length, criado_em: new Date().toISOString() }, null, 1));
console.log('✓ versão ' + versao + ' assinada: ' + Object.keys(arquivos).length + ' arquivos, ' + Math.round(buf.length / 1024) + ' KB → ' + dest);
