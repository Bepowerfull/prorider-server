Oi! Segue o **pacote 03/10r**, com o **domínio próprio `app.prorider.app.br`**. Ele substitui o 03/10q. Se o 03/10q (ou o 03/10p) ainda não subiu, suba direto este.

## 1. O domínio (já feito pelo Mario)
- No Railway, o `prorider-server` tem o domínio **`app.prorider.app.br`** (porta 8080), já validado (✓ verde).
- No Registro.br: CNAME `app` → `416c6tdi.up.railway.app` e TXT `_railway-verify.app`. Os registros do Resend continuam lá.
- **Não apaguem o domínio antigo** `prorider-server-production-5784.up.railway.app`: ele continua funcionando, para quem ainda usa o endereço antigo.

## 2. Subir
- **`server.js`:**
  - os links dos e-mails (`PORTAL_URL`) agora usam o endereço novo por padrão;
  - o link de "compartilhar aula" estava errado (endereço sem o 5784) e foi corrigido.
- **Site:** substituam a pasta `public/` pela `2_SITE_pasta_public/` do pacote.
  - O Portal, o Construtor e o app do aluno usam o endereço por onde foram abertos (`location.origin`).
  - Fora do servidor, eles usam o endereço novo.
- **Na raiz do repositório:** `testes/dominio.test.js` (novo) e `testes/rodar.js`.
  - Se o 03/10q não subiu, também `testes/loja.test.js`.
  - Se o 03/10p não subiu, também `testes/bluetooth.test.js`.
- **Railway → Variables:** confiram se existe `PORTAL_URL`.
  - Se existir com o endereço antigo, troquem para `https://app.prorider.app.br` (ou apaguem, porque o padrão já é esse).
  - Nada para mudar no banco.

## 3. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
Agora são **11 grupos**. Só suba com **"TUDO OK — pode subir."**

## 4. Depois do deploy
- Abram `https://app.prorider.app.br/ping`, que tem que responder igual ao endereço antigo.
- A Saúde do sistema tem que mostrar o servidor **03/10r**.

## 5. Ginásio: instalar a 03/10r nas 3 TVs
- As TVs estão na 03/10m. Instalem a **03/10r** (já inclui a n, a p e a q), seguindo o `ATUALIZAR_AS_TVS.md`.
- A partir dela, a TV fala com `app.prorider.app.br`. O login da TV continua e não precisa reativar.
- Instalem **depois** do deploy do servidor 03/10r.
- A Saúde tem que mostrar **BUILD 03/10r** nas três.

## 6. O Mario troca depois do deploy (para registro)
- **Dropbox:** adicionar o Redirect URI `https://app.prorider.app.br/studio.html`, sem apagar o antigo.
- **Asaas:** URL do webhook para `https://app.prorider.app.br/webhook/asaas`.
- **UptimeRobot:** monitor para `https://app.prorider.app.br/ping`. **Não removam a rota `/ping`.**

## 7. Para registro: o que já está funcionando fora do código
- **UptimeRobot:** monitor do `/ping` a cada 5 minutos, com aviso por e-mail.
- **Webhook do Asaas:** conferido em 06/10.
- **Backup semanal:** guardado num HD externo.
- **App do Dropbox:** "ProRider Cycling", App key `lngo9p5iaprfa1f`, PKCE, sem App secret no código, até 500 contas.
- **Domínio:** `app.prorider.app.br`, desde 06/10.
- Tudo registrado no `CHANGELOG.md` e no `PENDENTES.md`.

## 8. Ainda pendente
- **Teste real do Dropbox:** o Mario faz depois do deploy.
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto.

Obrigado!
