Oi! Segue o **pacote 03/10q**, com o **Dropbox conectado no Construtor**. Ele substitui o 03/10p. Se o 03/10p ainda não subiu, suba direto este.

## 1. Subir
- **`server.js`**: o vídeo da loja usa o endereço direto do Dropbox.
- **Site:** `studio.html` (Construtor) e `index.html` (admin). Se o 03/10p não subiu, também o `aluno/index.html`. O mais simples é substituir a pasta `public/` pela `2_SITE_pasta_public/` do pacote.
- **Na raiz do repositório:**
  - **atualizado:** `testes/loja.test.js`;
  - **se o 03/10p não subiu, também:** `testes/bluetooth.test.js` e `testes/rodar.js`.
- Nada para mudar no Railway nem no banco.

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
São **10 grupos**. Só suba com **"TUDO OK — pode subir."**

## 3. Ginásio: instalar a 03/10q nas 3 TVs
- As TVs estão na 03/10m. Instale a **03/10q** (já inclui a 03/10n e a 03/10p), seguindo o `ATUALIZAR_AS_TVS.md`.
- A Saúde do sistema tem que mostrar **BUILD 03/10q** nas três.

## 4. Dropbox (para referência)
- **App no Dropbox:** "ProRider Cycling" (App key `lngo9p5iaprfa1f`, pública). Ele foi criado pelo Mario com:
  - Scoped access, do tipo App folder;
  - PKCE ligado, **sem App secret no código**;
  - liberado para até 500 contas.
- **Redirect URI cadastrado:** `https://prorider-server-production-5784.up.railway.app/studio.html`. **Se o Construtor mudar de endereço (ex.: prorider.app.br), o novo endereço precisa ser adicionado no Dropbox também** (o Mario faz em dropbox.com/developers → ProRider Cycling → Settings → Redirect URIs).
- **Como funciona:**
  - O login acontece numa janelinha (OAuth com PKCE), e o acesso fica no `localStorage` do navegador do professor (`prb_dbx`).
  - O Construtor chama a API do Dropbox direto do navegador: `files/list_folder`, `sharing/create_shared_link_with_settings` e `files/get_temporary_link`.
  - O link de compartilhamento vai na aula, como os links colados à mão.

## 5. Para registro: o que já está funcionando fora do código
- **UptimeRobot** (feito pelo Mario em 06/10):
  - monitor "ProRider servidor" no `/ping`, a cada 5 minutos;
  - avisa por e-mail se cair;
  - **não removam a rota `/ping`**.
- **Webhook do Asaas** conferido em 06/10.
- **Backup semanal** baixado pelo Mario para um HD externo.
- **App do Dropbox** criado em 06/10.
- Tudo registrado no `CHANGELOG.md` e no `PENDENTES.md`.

## 6. Ainda pendente
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto.

Obrigado!
