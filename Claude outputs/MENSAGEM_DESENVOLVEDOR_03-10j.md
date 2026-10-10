Oi! Segue o **pacote 03/10j** (backup do banco feito pelo próprio servidor). Ele substitui o 03/10i.

## 1. Subir
- `server.js` e o `index.html` do site (página do admin).
- `ferramentas/restaurar-backup.js` (novo), `testes/backup.test.js` (novo) e `testes/rodar.js` (atualizado) na raiz do repositório.
- Nenhuma variável obrigatória. O backup vai para `/data/backups` (ao lado de `/data/gravacoes`, no mesmo Volume). Opcionais: `BACKUP_DIR` (outra pasta), `BACKUP_GUARDAR` (quantos guardar, padrão 7), `BACKUP_DESLIGADO=1` (desliga).

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
Agora são **7 grupos** (novo: **backup**, que faz um backup, baixa e restaura num banco vazio criado na hora — o usuário do Postgres local precisa poder criar banco). Só suba com **"TUDO OK — pode subir."**

## 3. Depois de subir (2 minutos)
Admin → **Saúde do sistema** → **Backup do banco** → **Fazer backup agora** → tem que aparecer o arquivo `prorider_….json.gz` → **Baixar** e mandar/guardar com o Mario. Conferir que **não** aparece "pasta temporária".

## 4. Ensaio de restauração (uma vez, num banco de teste — nunca na produção)
1. Criar um banco vazio de teste e ligar o `server.js` nele uma vez (cria as tabelas); desligar.
2. `RESTAURAR_DATABASE_URL=postgres://…/prorider_teste_x node ferramentas/restaurar-backup.js prorider_AAAA-MM-DD_HHMM.json.gz`
3. Digitar o nome do banco quando pedir. Tem que terminar com **"contagens conferem com o backup"**.

## 5. Ainda pendente (da sua lista)
- **Railway Pro:** os backups do Railway só existem no plano Pro. **Prioridade do Mario: contratar ao concluir o projeto.** Até lá vale o backup deste pacote.
- **`ASAAS_WEBHOOK_TOKEN`** — igual ao token do webhook no painel do Asaas.
- **UptimeRobot** chamando `/ping` a cada 5 min.
- **Ginásio nas duas TVs** (BUILD 03/10j) — `ATUALIZAR_AS_TVS.md`.
- O motivo dos 3 "Deployment crashed" de 05/10.

Obrigado!
