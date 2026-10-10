Oi! Segue o **pacote 03/10i**. Ele substitui o 03/10h.

## 1. Subir
- Só o **`server.js`** (correção: a TV reconectando não conta mais como erro na Saúde do sistema).
- O site não mudou.
- Não precisa de variável nova. O e-mail já está ligado (`RESEND_API_KEY` e `EMAIL_FROM` com `prorider.app.br`, teste OK em 05/10).

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
Só suba com **"TUDO OK — pode subir."**

## 3. Por favor, olhar
O Railway mandou 3 e-mails **"Deployment crashed"** hoje (12:56, 13:43 e 14:03). O servidor subiu depois, mas me diga o motivo de cada um (Railway → Deployments → os vermelhos → View logs), para não repetir.

## 4. Ginásio nas TVs
As duas TVs estão em versões antigas (Demo 01: BUILD 02/10j; Clube: BUILD 01/10d). Gerar o executável a partir de `3_GINASIO/ProRider_1_GINASIO_03-10i.zip` e instalar nas duas — passo a passo em `ATUALIZAR_AS_TVS.md`.

## 5. O que ainda falta dos pacotes anteriores (03/10e a 03/10h) — conferir e marcar
O servidor já está no 03/10h, então o código anterior já subiu. Ficam só estas tarefas de configuração (uma vez só):

- [ ] **Pastas de testes e ferramentas no repositório:** `testes/` e `ferramentas/` (do `5_TESTES_E_BACKUP`) na raiz, ao lado do `server.js`.
- [ ] **`.gitignore`** com a linha `backups/` (o repositório é público: cópia do banco nunca vai para o GitHub).
- [ ] **Backups do Railway:** serviço Postgres → aba **Backups** → ligar Daily, Weekly e Monthly.
- [ ] **Cópia semanal fora do Railway:** `DATABASE_PUBLIC_URL='…' ./ferramentas/backup.sh` e guardar o arquivo num HD/nuvem do Mario.
- [ ] **Provar que o backup volta (uma vez):** `TEST_DATABASE_URL=… ./ferramentas/restaurar-teste.sh backups/<arquivo>.dump`.
- [ ] **Monitor de queda:** UptimeRobot (grátis) chamando `https://prorider-server-production-5784.up.railway.app/ping` a cada 5 min, avisando o Mario.
- [ ] **`ASAAS_WEBHOOK_TOKEN`** no Railway igual ao token do webhook no painel do Asaas (sem ele, pagamento não é liberado sozinho).
- [ ] **Volume das gravações:** parece já configurado (a Saúde mostra 4,5 GB livres, sem alerta) — só confirmar que `GRAVACOES_TESTE_DIR` aponta para o Volume.
- [x] **E-mail (Resend):** feito em 05/10 (`prorider.app.br` verificado, teste chegou).
- [ ] **Teste de carga na homologação** (quando existir): `ACADEMIAS=50 BIKES=20 SEGUNDOS=120 node ferramentas/teste-carga.js https://ENDERECO-DA-HOMOLOGACAO` — nunca na produção.

Detalhes de cada item estão no `00_LEIA-PRIMEIRO.md` do pacote.

Obrigado!
