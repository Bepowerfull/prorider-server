# Atualização automática das TVs (07/10a)

**Objetivo:** atualizar as TVs pelo servidor, sem pendrive e sem TeamViewer.
- Cada TV baixa sozinha a versão nova do Ginásio, **de madrugada e sem aula**.
- Ela confere a **assinatura da ProRider** antes de instalar.
- Se a versão nova não abrir direito, **volta sozinha para a anterior**.

O TeamViewer continua como plano B, para manutenção e emergência.

## Como funciona
1. **Desenvolvedor, a cada versão:** roda `ferramentas/montar-atualizacao-tv.js` com a **chave privada**. Isso gera `public/ginasio/atualizacao/manifesto.json` e o `.prpack`, que sobem no deploy.
2. **Servidor:** oferece a versão só para a academia com **"⟳ auto ligada"** (Admin → Licenças) e só se o manifesto for da `GINASIO_VERSAO` dele.
3. **TV:**
   - pergunta a cada 10 min;
   - instala só **parada na tela de espera** (sem aula, pré-aula ou gravação), **entre 02:00 e 05:00 no relógio do computador da TV** (então serve para qualquer fuso);
   - ou na hora, se o Admin clicar em **"atualizar agora"**.
4. **Programa da TV (este módulo):**
   - baixa só de `https://app.prorider.app.br`;
   - confere a assinatura (Ed25519) e o SHA-256;
   - recusa nomes de arquivo com pasta;
   - grava em `<dados do app>\versoes\<versão>\`, sem tocar no programa instalado;
   - reabre na versão nova.
5. **A versão nova se confirma em 60 s.** Se não confirmar em 3 min, ou se o programa fechar 2 vezes sem confirmar, volta para a anterior.
6. **Saúde do Admin**, na tabela de TVs, mostra uma destas situações: "baixando", "instalada, confirmando", "atualizou", "falhou", "voltou à anterior" ou "programa sem atualizador".

**Custo:** nenhum. O pacote tem cerca de 600 KB por TV, uma vez por versão, e não precisa de plano maior no Railway.

## Instalar no programa da TV (uma vez só)
Esta é a **última** atualização feita do jeito antigo, pelo `GERAR_PROGRAMA_DA_TV.bat` com TeamViewer ou pendrive. As próximas vêm pelo servidor.

### 1. Chaves (uma vez, com o Mario)
```
node ferramentas/chaves-atualizacao-tv.js C:\ProRider-chaves
```
- **`prorider-tv-PRIVADA.pem`:** assina as versões.
  - **Nunca** vai para o GitHub, o servidor, o e-mail, o WhatsApp ou o chat.
  - Guardem em 2 lugares: o computador de quem faz o deploy e um pendrive ou cofre de senhas do Mario.
- **`prorider-tv-publica.pem`:** o texto dela vai no `main.js`, no passo 2.

### 2. `main.js` do Electron
Copie a pasta `atualizador-tv/` para dentro do projeto do programa da TV, ao lado do `main.js`. Depois:
```js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const criarAtualizador = require('./atualizador-tv/atualizador-tv');
const CHAVE_PUBLICA = `-----BEGIN PUBLIC KEY-----
(cole aqui o conteúdo de prorider-tv-publica.pem)
-----END PUBLIC KEY-----`;

app.whenReady().then(() => {
  const atu = criarAtualizador({ pastaDados: app.getPath('userData'), chavePublica: CHAVE_PUBLICA });
  const PADRAO = path.join(__dirname, 'app', 'ginasio.html');   // onde o ginasio.html fica hoje
  const win = new BrowserWindow({ /* …o que já existe… */
    webPreferences: { /* …o que já existe… */ preload: path.join(__dirname, 'atualizador-tv', 'preload-atualizador.js') } });
  atu.ligarIpc(ipcMain, () => win, PADRAO);
  win.loadFile(atu.arquivoInicial(PADRAO));                 // em vez de win.loadFile(PADRAO)
  atu.vigiarConfirmacao(() => win.loadFile(atu.arquivoInicial(PADRAO)));
});
```
- **Se já existe um preload:** em vez de trocar, coloque `require('./atualizador-tv/preload-atualizador.js')` dentro dele.
- **No `package.json` (build):** confiram se a pasta `atualizador-tv/` entra no instalador (`files`).

### 3. Conferir no primeiro teste
- [ ] A TV abre e mostra a versão; o dongle, a ativação e as bikes pareadas continuam.
  - Os dados do navegador (localStorage) são os mesmos para qualquer arquivo local. **Confirme que a TV não pede ativação de novo.**
- [ ] Admin → Licenças → **"⟳ auto desligada"**: clique para ligar só na **academia de teste** primeiro.
- [ ] Monte uma versão de teste com o `montar-atualizacao-tv.js`, faça o deploy e clique em **"atualizar agora"**. Com a TV na tela de espera, ela instala em até 10 min.
- [ ] A Saúde mostra "atualizou".
- [ ] Ligue as outras academias.

## A cada versão nova do Ginásio
```
node ferramentas/montar-atualizacao-tv.js ginasio C:\ProRider-chaves\prorider-tv-PRIVADA.pem public
```
Depois, commit de `public/ginasio/atualizacao/` (manifesto + `.prpack`) e deploy.
- O servidor só oferece se a versão do manifesto for igual à `GINASIO_VERSAO` do `server.js`.
- **Ordem:** deploy primeiro. As TVs pegam de madrugada.

## Segurança
- **Servidor invadido:** o invasor não consegue mandar programa para as TVs, porque sem a chave privada a TV recusa.
- **Arquivo trocado no caminho:** o SHA-256 não confere e a TV recusa.
- **Só arquivos da tela** (html, js, css, png, txt), sem pastas.
  - **Não atualiza o programa em si** (`main.js`, Electron). Mudança nele continua sendo pelo `.bat`, o que é raro.

## Teste automático
`testes/autoatualiza.test.js` (precisa desta pasta `atualizador-tv/` na raiz do servidor). Ele cobre:
- chaves e montagem do pacote;
- o servidor oferecendo só para a academia ligada;
- a TV de verdade pedindo só quando está parada;
- o módulo instalando e a versão nova abrindo e se confirmando;
- os ataques: assinatura de outra chave, arquivo trocado, endereço de fora, arquivo com `../`;
- a volta para a anterior quando não confirma ou quando trava ao abrir;
- o aviso "programa sem atualizador".
