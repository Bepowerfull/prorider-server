Oi! Obrigado pela investigação dos "crashes", ela estava certa. Segue o **pacote 03/10l**, que já resolve isso. Ele substitui o 03/10k (que ainda não foi publicado) e todos os anteriores.

## 1. Subir
- **`server.js`.** Ele agora trata o `SIGTERM`: fecha as conexões, fecha o banco e sai com código 0, no máximo em 8 s. TVs e celulares reconectam sozinhos no servidor novo.
- O **`index.html`** do site (página do admin), do 03/10k.
- Na raiz do repositório:
  - **novo:** `testes/conferencia.test.js`;
  - **atualizados:** `testes/rodar.js` e `testes/asaas-simulado.js`.
- **Se o 03/10j ainda não subiu:** também `ferramentas/restaurar-backup.js` e `testes/backup.test.js`.
- **No Railway, uma vez:** prorider-server → Settings → Deploy → **Custom Start Command: `node server.js`**.
  - Pelo `npm start` o problema continua. Testei aqui: o `npm` sai com 143 antes do Node terminar; com `node server.js` a saída é 0 em cerca de 30 ms.

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
São **8 grupos**. Só suba com **"TUDO OK — pode subir."**

## 3. Depois de subir (5 minutos)
1. No log do deploy **anterior** deve aparecer `[Servidor] SIGTERM recebido (deploy novo ou parada): desligando com calma`, e não deve chegar e-mail de "Deployment crashed".
2. Admin → **Saúde do sistema** → **Conferência com o Asaas** → **Conferir agora**.
   - A cobrança de 03/10 do **Clube Alto dos Pinheiros** deve aparecer como "registrado R$ 5,00". Ela estava paga no Asaas e não tinha chegado aqui.
   - Mande print para o Mario.
3. Admin → **Saúde do sistema** → **Backup do banco** → **Fazer backup agora** → **Baixar**, e guarde com o Mario (se ainda não fez no 03/10j).

## 4. Webhook do Asaas (importante)
A conferência roda 1 vez por dia e é só a rede de segurança. O normal é o Asaas avisar **na hora** pelo webhook, mas os Logs de Webhooks do Asaas estavam vazios em 05/10. Então:
- Confira no Railway se **`ASAAS_WEBHOOK_TOKEN`** é **exatamente igual** ao token do webhook "ProRider Railway" no Asaas (Integrações → Webhooks).
- Na dúvida: no Asaas, gere um token novo, salve, e cole o mesmo valor no Railway. Não mande o token por chat nem WhatsApp.
- Depois do próximo pagamento, em Asaas → Webhooks → **Logs** tem que aparecer **200**. Se aparecer **401**, o token não confere, e a Saúde acende o vermelho "Avisos de pagamento do Asaas estão sendo recusados".

## 5. Ainda pendente (dos pacotes anteriores)
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto. Até lá vale o backup do 03/10j.
- **UptimeRobot** chamando `/ping` a cada 5 min.
- **Ginásio nas duas TVs:** a Demo 01 está na 02/10j e o Clube na 01/10d. As duas precisam ir para a BUILD 03/10l, ver `ATUALIZAR_AS_TVS.md`. TV que já estiver na 03/10j ou 03/10k não precisa reinstalar.

Obrigado!
