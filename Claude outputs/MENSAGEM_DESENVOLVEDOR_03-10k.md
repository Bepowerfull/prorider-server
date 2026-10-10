Oi! Segue o **pacote 03/10k** (conferência diária dos pagamentos com o Asaas). Ele substitui o 03/10j e todos os anteriores.

## 1. Subir
- `server.js` e o `index.html` do site (página do admin).
- `testes/conferencia.test.js` (novo), `testes/rodar.js` e `testes/asaas-simulado.js` (atualizados) na raiz do repositório.
- **Se o 03/10j ainda não subiu:** também `ferramentas/restaurar-backup.js` e `testes/backup.test.js`.
- Nenhuma variável nova obrigatória. Opcional: `ASAAS_CONFERIR_DESLIGADO=1` desliga a conferência automática.

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
Agora são **8 grupos** (novo: **conferencia**). Só suba com **"TUDO OK — pode subir."**

## 3. Depois de subir (2 minutos)
1. Admin → **Saúde do sistema** → **Backup do banco** → **Fazer backup agora** → **Baixar** e guardar com o Mario (se ainda não fez no 03/10j).
2. Admin → **Saúde do sistema** → **Conferência com o Asaas** → **Conferir agora**. Deve aparecer a cobrança de 03/10 do **Clube Alto dos Pinheiros** como "registrado R$ 5,00" (estava paga no Asaas e não tinha chegado aqui). Mande print para o Mario.

## 4. Webhook do Asaas (importante)
A conferência é a rede de segurança (1x por dia). O normal é o Asaas avisar **na hora** pelo webhook. Os Logs de Webhooks do Asaas estavam vazios em 05/10, então:
- Confira no Railway se **`ASAAS_WEBHOOK_TOKEN`** é **exatamente igual** ao token do webhook "ProRider Railway" no Asaas (Integrações → Webhooks). Se tiver dúvida: no Asaas, gerar um token novo, salvar, e colar o mesmo valor no Railway. (Não mande o token por chat/WhatsApp.)
- Depois do próximo pagamento, o Asaas → Webhooks → **Logs** tem que mostrar **200**. Se mostrar **401**, o token não confere; a Saúde também acende o vermelho "Avisos de pagamento do Asaas estão sendo recusados".

## 5. Ainda pendente (dos pacotes anteriores)
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto. Até lá vale o backup do 03/10j.
- **UptimeRobot** chamando `/ping` a cada 5 min.
- **Ginásio nas duas TVs** (Demo 01 está na 02/10j e Clube na 01/10d) → BUILD 03/10k, ver `ATUALIZAR_AS_TVS.md`. TV que já estiver na 03/10j não precisa reinstalar.
- O motivo dos 3 "Deployment crashed" de 05/10.

Obrigado!
