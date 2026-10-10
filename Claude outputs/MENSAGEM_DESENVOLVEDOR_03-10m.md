Oi! O 03/10l está no ar e funcionou: a conferência com o Asaas já registrou sozinha o pagamento de 03/10 do Clube. Obrigado!

Segue o **pacote 03/10m** (pausar avisos por academia e botão "✓ Resolvido"). Ele substitui o 03/10l.

## 1. Subir
- **`server.js`** e o **`index.html`** do site (página do admin).
- Na raiz do repositório, os testes atualizados:
  - `testes/vigia.test.js`
  - `testes/conferencia.test.js`
  - `testes/asaas-simulado.js`
  - `testes/rodar.js`
- **Nada para mudar no Railway.** Ao subir, o servidor cria sozinho a coluna `licencas.avisos_pausados_ate` e a tabela `email_envios`.

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
São **8 grupos**. Só suba com **"TUDO OK — pode subir."**

## 3. Depois de subir (2 minutos)
- Admin → **Saúde do sistema** → clicar no cartão **Clube Alto dos Pinheiros** → **"Pausar os avisos desta academia até…"**. Use a data que o Mario combinar para o piloto.
- Os avisos vermelhos de "TV desligada" do Clube fecham, e o cartão dele fica cinza.

## 4. Ainda pendente (dos pacotes anteriores)
- **`ASAAS_WEBHOOK_TOKEN`** no Railway tem que ser **exatamente igual** ao token do webhook "ProRider Railway" no Asaas.
  - O Mario vai pagar a licença Demo 01 agora. Depois do pagamento, o Asaas → Webhooks → **Logs** tem que mostrar **200**.
  - Se mostrar **401**, gere um token novo no Asaas e cole o mesmo valor no Railway. Não mande o token por chat nem WhatsApp.
  - Os eventos do webhook já foram ajustados pelo Mario em 06/10.
- **Ginásio nas duas TVs** (Demo 01 = 02/10j, Clube = 01/10d) → BUILD 03/10m, ver `ATUALIZAR_AS_TVS.md`.
- **UptimeRobot** chamando `/ping` a cada 5 min.
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto. Até lá, o backup do servidor (o Mario já baixou o primeiro para o HD externo).

Obrigado!
