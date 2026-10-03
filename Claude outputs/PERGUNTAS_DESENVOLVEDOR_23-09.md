# ProRider · 23/09 · perguntas para o desenvolvedor

**Como responder:** escreva a resposta logo abaixo de cada pergunta, na linha **Resposta:**, e devolva este mesmo arquivo ao Mario. Pode ser o arquivo preenchido ou só o texto colado numa mensagem, mantendo os números. Quando a pergunta pede um arquivo ou uma saída de comando, cole-a inteira: não resuma.

Onde não souber, escreva "não sei". É melhor do que deixar em branco.

---

## Servidor e Railway

**1. `JWT_SECRET`.** Está definido nas *Variables* do serviço `prorider-server` no Railway? Foi criado ou alterado depois de 14/09? Se sim, em que data? (Não mande o valor, só se existe e quando mudou.)

Resposta:

**2. Commit publicado.** Qual é o commit que está rodando no Railway agora? Cole a saída de `git log -3 --oneline` da branch que o Railway publica e diga que branch é essa. Ela está no `1263390` ou depois?

Resposta:

**3. Código publicado × pasta local.** O `server.js` publicado é idêntico ao da pasta `prorider-server` do computador do Mario? Se não souber, cole a saída de `git status` e `git diff --stat` feitas nessa pasta.

Resposta:

**4. `aluno.html` publicado.** Qual BUILD aparece hoje em `/aluno` (F12 → Console → filtro `BUILD`)? E em que pasta do repositório fica o `aluno.html` que o servidor serve?

Resposta:

## Executável do Ginásio

**5. Como é gerado.** Com que ferramenta o executável é montado (Electron com electron-builder, electron-packager, outra)? Cole o `package.json` do projeto do executável e diga onde está esse projeto (repositório ou pasta).

Resposta:

**6. De onde vêm os arquivos.** De que pasta o executável tira `ginasio.html`, `script.js`, `style.css`, `bled112.js` e o resto: são copiados para dentro dele na montagem, ou ele lê de uma pasta no disco ao abrir? Se lê do disco, qual é o caminho?

Resposta:

**7. `bled112.js`.** Cole o diff completo entre o `bled112.js` que está dentro do executável e o `bled112.js` do zip `ProRider_1_GINASIO_23-09c.zip` (ex.: `git diff --no-index bled112_exe.js bled112_zip.js`). Explique o que o caminho Electron da porta serial (`requestPort`) faz e porque foi preciso.

Resposta:

**8. Servidor local.** O executável também sobe o `servidor-local.js` na porta 3000, ou faz isso de outro jeito? E o que acontece se o `PRORIDER.bat` estiver aberto ao mesmo tempo?

Resposta:

**9. Atualizações futuras.** Há um jeito de o Mario atualizar o executável sozinho (trocar arquivos numa pasta, rodar um script)? Se não houver, qual seria o caminho mais simples? A ideia é nunca mais a TV ficar numa versão antiga sem ninguém perceber.

Resposta:

## Pendências da mensagem

**10. Status de cada item da mensagem de 23/09.** Para cada item, diga *feito* (com a data) ou *pendente* (com o motivo):
- 1 · `JWT_SECRET` / 401:
- 2 · `aluno.html` 23/09d publicado:
- 3 · CHANGELOG no commit:
- 4 · executável na 23/09c:

Resposta:

**11. Algo mais.** Há alguma mudança feita direto no servidor ou no executável, fora dos arquivos que o Mario enviou, que ainda não esteja no CHANGELOG? Se houver, descreva-a aqui.

Resposta:
