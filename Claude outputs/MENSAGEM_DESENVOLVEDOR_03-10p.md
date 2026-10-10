Oi! O 03/10o está no ar, obrigado! Segue o **pacote 03/10p**, com **bikes, rolos e sensores de outras marcas por Bluetooth padrão**. Ele substitui o 03/10o.

## 1. Subir
- **`server.js`**: só uma mudança pequena, que repassa a origem dos números do aluno.
- **Site:** `aluno/index.html` (app do aluno) e `index.html` (admin).
- **Na raiz do repositório:** `testes/bluetooth.test.js` (novo) e `testes/rodar.js` (atualizado).
- Nada para mudar no Railway nem no banco.

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
Agora são **10 grupos** (novo: **bluetooth**). Só suba com **"TUDO OK — pode subir."**

## 3. Ginásio: instalar a 03/10p nas 3 TVs
- As TVs ainda estão na 03/10m. Instale a **03/10p** no Clube, na Demo 01 e na Demo 02, seguindo o `ATUALIZAR_AS_TVS.md`.
- A Saúde do sistema tem que mostrar **BUILD 03/10p** nas três.

## 4. O que mudou no Bluetooth (para referência)
- **Padrões que o app lê:** FTMS (`0x1826`/`0x2AD2`), Cycling Power (`0x1818`/`0x2A63`) e CSC (`0x1816`/`0x2A5B`). O app tenta nessa ordem.
- **Correções:**
  - FTMS: o bit 0 inverte a presença da velocidade, e a velocidade média não era pulada;
  - cadência do Cycling Power: agora vem das voltas do pedivela.
- **Na academia:** o app manda `dados_aluno` com `watts`, `rpm` e `fonte:'celular'` (a Keiser não manda). A TV usa esses números só quando o dongle não está lendo a bike daquele aluno.
- A lista de marcas está em `4_REGISTROS/MARCAS_BLUETOOTH.md`.

## 5. Ainda pendente
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto.

## 6. Para registro: o que já está funcionando fora do código
- **UptimeRobot** (feito pelo Mario em 06/10): o monitor "ProRider servidor" confere `/ping` a cada 5 minutos. Se o servidor cair, avisa por e-mail. **Não removam a rota `/ping`.** Se o endereço do servidor mudar, avisem para trocar a URL do monitor.
- **Webhook do Asaas** conferido em 06/10: o pagamento chegou na hora e os eventos de estorno e de cartão recusado estão marcados.
- **Backup semanal:** o Mario baixa pela Saúde do sistema e guarda num HD externo.
- Tudo isso está registrado no `CHANGELOG.md` e no `PENDENTES.md` (seção "Infraestrutura").

Obrigado!
