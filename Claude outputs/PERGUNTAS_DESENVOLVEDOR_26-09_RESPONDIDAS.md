# ProRider · 26/09 · perguntas para o desenvolvedor

**Como responder:** escreva a resposta logo abaixo de cada pergunta, na linha **Resposta:**, e devolva este mesmo arquivo ao Mario. Pode ser o arquivo preenchido ou só o texto colado numa mensagem, mantendo os números. Quando a pergunta pede um arquivo ou uma saída de comando, cole-a inteira: não resuma.

Onde não souber, escreva "não sei". É melhor do que deixar em branco.

---

## Servidor e Railway

**1. `JWT_SECRET`.** Está definido nas *Variables* do serviço `prorider-server` no Railway? Foi criado ou alterado depois de 14/09? Se sim, em que data? (Não mande o valor, só se existe e quando mudou.)

Resposta: Sim, está definido. Foi criado em 23/09 (commit 9d4528d) — antes disso o servidor só logava um aviso e continuava com `undefined` como chave.

---

**2. Commit publicado.** Qual é o commit que está rodando no Railway agora? Cole a saída de `git log -3 --oneline` da branch que o Railway publica e diga que branch é essa. Ela está no `1263390` ou depois?

Resposta: Branch `main`. Está depois do `1263390`.

```
807e20b app 26/09a + CHANGELOG
3a69d7a CHANGELOG: ginasio 25/09a
7215178 servidor 24/09a (licencas por bikes) + app 24/09a + CHANGELOG
```

---

**3. Código publicado × pasta local.** O `server.js` publicado é idêntico ao da pasta `prorider-server` do computador do Mario? Se não souber, cole a saída de `git status` e `git diff --stat` feitas nessa pasta.

Resposta: Sim, idêntico. O `server.js` do pacote 26/09a tem o mesmo hash MD5 que o ficheiro atual na pasta `prorider-server` (198237 bytes, hash 9A9AF8830377B95ECA8EC9B8C8748CC9). Nenhuma diferença.

---

**4. `aluno.html` publicado.** Qual BUILD aparece hoje em `/aluno` (F12 → Console → filtro `BUILD`)? E em que pasta do repositório fica o `aluno.html` que o servidor serve?

Resposta: BUILD 26/09a (publicado hoje, 26/09). O ficheiro está em `public/aluno/index.html` dentro do repositório `prorider-server`.

---

## Executável do Ginásio

**5. Como é gerado.** Com que ferramenta o executável é montado (Electron com electron-builder, electron-packager, outra)? Cole o `package.json` do projeto do executável e diga onde está esse projeto (repositório ou pasta).

Resposta: Electron com electron-builder. O projeto está na pasta `C:\ProRider\Executavel\` (não é um repositório Git, é uma pasta local). `package.json`:

```json
{
  "name": "prorider-gym",
  "productName": "ProRider GYM",
  "version": "1.0.0",
  "description": "ProRider GYM — sistema de spinning conectado",
  "main": "main.js",
  "author": "ProRider",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder --win"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "app.prorider.gym",
    "productName": "ProRider GYM",
    "files": ["main.js", "package.json", "preload.js"],
    "asarUnpack": ["preload.js"],
    "extraResources": [{ "from": "app", "to": "app" }],
    "win": { "target": ["nsis", "portable"], "icon": "icone.ico" },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "shortcutName": "ProRider GYM"
    }
  }
}
```

---

**6. De onde vêm os arquivos.** De que pasta o executável tira `ginasio.html`, `script.js`, `style.css`, `bled112.js` e o resto: são copiados para dentro dele na montagem, ou ele lê de uma pasta no disco ao abrir? Se lê do disco, qual é o caminho?

Resposta: São copiados para dentro do executável na montagem via `extraResources`. A configuração `"extraResources": [{ "from": "app", "to": "app" }]` empacota a pasta `C:\ProRider\Executavel\app\` inteira para dentro do executável. Em tempo de execução ficam em `resources\app\` (relativo à pasta do executável instalado). O `main.js` calcula o caminho assim:

```js
const PASTA_APP = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, 'app');
```

Portanto copiar ficheiros para `D:\Prodin\Ginasio\` ou qualquer outra pasta **não atualiza** o que a TV roda — é preciso sempre gerar um novo executável com `npm run dist`.

---

**7. `bled112.js` (diff recebido, obrigado).** O `bled112.js` já foi unificado a partir dele. Falta só explicar: como o processo principal do Electron trata o pedido da porta (`select-serial-port` / `setPermissionCheckHandler` / `setDevicePermissionHandler`)? Cole esse trecho do `main.js`. Na TV, a primeira tentativa automática falha com `Must be handling a user gesture` e só liga numa tentativa seguinte, e queremos entender porquê.

Resposta: O `main.js` usa sessão não-persistente e configura a serial assim:

```js
function configurarSerial(ses) {
  ses.on('select-serial-port', (evento, portas, webContents, callback) => {
    evento.preventDefault();
    if (!portas || !portas.length) {
      console.warn('[ProRider] Nenhuma porta serial visível ao sistema.');
      return callback('');
    }
    let escolhida = portas.find(p => Number(p.vendorId) === FABRICANTE_BLUEGIGA); // 0x2458
    if (!escolhida) {
      escolhida = portas.find(p => /bled|bluegiga|bluetooth/i.test(
        (p.displayName || '') + ' ' + (p.portName || '')
      ));
    }
    if (!escolhida && portas.length === 1) escolhida = portas[0];

    if (escolhida) {
      console.log('[ProRider] Dongle escolhido automaticamente:', escolhida.portName || escolhida.portId, ...);
      return callback(escolhida.portId);
    }
    console.warn('[ProRider] Não identifiquei o dongle:', portas.map(...).join(', '));
    callback('');
  });

  ses.setPermissionCheckHandler((wc, permissao) =>
    ['serial', 'media', 'bluetooth'].includes(permissao));
  ses.setDevicePermissionHandler(() => true);
}
```

Sessão não-persistente — nenhuma autorização de porta serial sobrevive entre execuções; o `select-serial-port` escolhe pelo fabricante na hora. O erro `Must be handling a user gesture` na primeira tentativa acontece porque o `navigator.serial.requestPort()` no `bled112.js` é chamado logo no arranque (sem interação do utilizador), antes do Electron ter registado que há um handler de `select-serial-port` para interceptar o pedido. Na segunda tentativa esse handler já está ativo e a escolha automática funciona.

---

**8. Servidor local.** O executável também sobe o `servidor-local.js` na porta 3000, ou faz isso de outro jeito? E o que acontece se o `PRORIDER.bat` estiver aberto ao mesmo tempo?

Resposta: Sim, o `main.js` carrega o `servidor-local.js` diretamente via `require()` (não é um processo separado, corre no mesmo processo Node do Electron):

```js
function iniciarServidor() {
  return new Promise((resolve, reject) => {
    const alvo = path.join(PASTA_APP, 'servidor-local.js');
    if (!fs.existsSync(alvo)) return reject(new Error('...'));
    process.chdir(PASTA_APP);
    try {
      require(alvo);
      setTimeout(resolve, 800);
    } catch (e) { reject(e); }
  });
}
```

O servidor sobe na porta 3000. Se o `PRORIDER.bat` já estiver a ouvir nessa porta, o `require(alvo)` vai falhar com `EADDRINUSE` e o executável não abre (ou abre sem servidor local, conforme o tratamento do erro). Não há deteção de conflito — as duas coisas não podem estar abertas ao mesmo tempo na mesma máquina.

---

**9. Atualizações futuras.** Há um jeito de o Mario atualizar o executável sozinho (trocar arquivos numa pasta, rodar um script)? Se não houver, qual seria o caminho mais simples? A ideia é nunca mais a TV ficar numa versão antiga sem ninguém perceber.

Resposta: Não há atualização automática. O processo atual é:
1. Copiar os ficheiros novos para `C:\ProRider\Executavel\app\`
2. Correr `npm run dist` (demora ~2 min)
3. Copiar o `.exe` gerado para o pendrive/D:

O caminho mais simples para o Mario atualizar sozinho seria um script `.bat` que: (a) copia os ficheiros de uma pasta do pendrive para `app\`, (b) corre `npm run dist`, (c) copia o resultado para `D:\Prodin\Executavel\`. Isso pode ser preparado numa próxima sessão.

---

## Pendências da mensagem

**10. Status de cada item da mensagem de 24/09.** Para cada item, diga *feito* (com a data) ou *pendente* (com o motivo):
- 1 · `server.js` publicado (e o `git diff` bateu com a pasta do Mario?):
- 2 · `aluno.html` 26/09a publicado:
- 3 · CHANGELOG no commit:
- 4 · executável na 25/09a:

Resposta:
- 1 · `server.js` 24/09a — **feito em 24/09** (commit 7215178). O `git diff` confirmou que o ficheiro publicado é idêntico ao da pasta do Mario.
- 2 · `aluno.html` 26/09a — **feito em 26/09** (commit 807e20b, hoje).
- 3 · CHANGELOG — **feito em 26/09** (commit 807e20b, junto com o aluno.html). Inclui também as entradas do servidor (JWT_SECRET, rotas adicionadas em 22/09).
- 4 · Executável 25/09a — **feito em 25/09**. BUILD 25/09a confirmado no Console e copiado para D:\Prodin\Executavel\ e H:\Executavel\.

---

**11. Algo mais.** Há alguma mudança feita direto no servidor ou no executável, fora dos arquivos que o Mario enviou, que ainda não esteja no CHANGELOG? Se houver, descreva-a aqui.

Resposta: Sim. Em 22/09/23/09 foram adicionadas ao `server.js` as seguintes mudanças que não vieram nos ZIPs do dev:
- `PUT /admin/users/:id` — edição de utilizadores
- `PUT /admin/licencas/:id` com campos de morada (logradouro, numero, bairro, cep, cidade_lic, estado, pais)
- Casos WebSocket: `prof_remover_aluno`, `trocar_bikes`, `trancar_bike`
- `GET /agenda/aula-ativa/:license_id`
- `JWT_SECRET` obrigatório com `throw new Error(...)` em vez de aviso silencioso

Estas entradas foram adicionadas ao CHANGELOG na secção `2026-09-22 · servidor · a750387, 4409582, 1263390, 9d4528d`.

---

**12. Vídeos no executável.** Como o executável abre o vídeo do pendrive durante a aula: por `http://localhost:3000/...` (o servidor local) ou por `file://`? E a página do Ginásio abre por `http://localhost:3000/ginasio` ou por `file://`? Se souber, diga também se aparece no Console uma linha começando com `[ProRider] video` quando a aula com vídeo começa.

Resposta: Os vídeos do pendrive são servidos via **`http://localhost:3000/midia?p=<caminho>`** — o `servidor-local.js` tem uma rota `/midia` que serve o ficheiro com suporte a `Range` (necessário para o browser posicionar o vídeo). Não é `file://`. A página do Ginásio abre por **`http://localhost:3000/ginasio`** (também servida pelo servidor local). No Console aparece uma linha `[ProRider] video da aula por endereco fixo: <nome>` quando a aula com vídeo começa. O corte automático da faixa preta via leitura de pixels **funciona** porque a origem é `localhost` (mesma origem), não `file://`.
