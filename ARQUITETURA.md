# ProRider — Arquitetura

> Documento vivo. Descreve **como o sistema funciona hoje**: onde cada coisa vive, como as partes conversam e por que certas decisões foram tomadas.
> Atualizado a cada mudança relevante, junto com o `CHANGELOG.md`.
> Última revisão: **22/09/2026** — Ginásio 20/09c · app 20/09f · servidor até o commit `d31da68`.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Onde vive cada coisa](#2-onde-vive-cada-coisa)
3. [Ginásio](#3-ginásio)
4. [App do aluno e do professor](#4-app-do-aluno-e-do-professor)
5. [Servidor](#5-servidor)
6. [Protocolo WebSocket — a sala ao vivo](#6-protocolo-websocket--a-sala-ao-vivo)
7. [Rotas HTTP](#7-rotas-http)
8. [Banco de dados](#8-banco-de-dados)
9. [Autenticação e tokens](#9-autenticação-e-tokens)
10. [Licenças](#10-licenças)
11. [Papéis e permissões](#11-papéis-e-permissões)
12. [Formato do arquivo de aula](#12-formato-do-arquivo-de-aula)
13. [Mídia: vídeo e música](#13-mídia-vídeo-e-música)
14. [Bluetooth: das bikes ao ecrã](#14-bluetooth-das-bikes-ao-ecrã)
15. [Regras de ouro](#15-regras-de-ouro)
16. [Guia de problemas](#16-guia-de-problemas)
17. [Histórico de incidentes](#17-histórico-de-incidentes)

---

## 1. Visão geral

Quatro componentes:

```
                    ┌──────────────────────────────┐
                    │  SERVIDOR  (Railway)         │
                    │  server.js + PostgreSQL      │
                    │  HTTP  +  WebSocket          │
                    └──────┬───────────┬───────────┘
                 WebSocket │           │ HTTP + WebSocket
                 + HTTP    │           │
     ┌─────────────────────┴──┐     ┌──┴──────────────────────┐
     │  GINÁSIO               │     │  APP (aluno/professor)  │
     │  notebook da academia  │     │  navegador do celular   │
     │  Electron ou Chrome    │     │  servido pelo Railway   │
     └───┬────────────────┬───┘     └─────────────────────────┘
         │ Bluetooth      │ HTTP local
     ┌───┴────────┐   ┌───┴──────────────────┐        ┌──────────────┐
     │ BLED112    │   │ servidor-local.js    │        │  PORTAL      │
     │ (dongle)   │   │ serve o pendrive     │        │  portal.html │
     └───┬────────┘   └──────────────────────┘        │  admin/gestor│
         │ anúncios BLE                               └──────────────┘
     ┌───┴──────────────┐
     │ Bikes Keiser M3i │
     └──────────────────┘
```

**Ginásio** — roda no notebook da academia, ligado ao projetor. Lê as bikes por Bluetooth, mostra a aula, o gráfico, o ranking. Cria a sala ao vivo no servidor.

**App** — o que o aluno abre no celular. Entra na sala pelo QR, recebe os dados da própria bike em tempo real. Para quem é professor, ganha ferramentas extra.

**Servidor** — guarda contas, licenças, grade de aulas, reservas, histórico. Faz a ponte ao vivo entre o Ginásio e os celulares.

**Portal** — administração: super admin, gestor da academia.

**Princípio que atravessa tudo:** o que é pesado fica **na academia** (vídeo e música no pendrive). O que vai para a nuvem é **leve** (arquivos de aula, resumos, contas). É isso que mantém a hospedagem barata.

---

## 2. Onde vive cada coisa

| Componente | Onde está o código | Como vai para o ar |
|---|---|---|
| Servidor | repositório **`prorider-server`**, `server.js` | push no `main` → Railway faz deploy sozinho |
| App | **`prorider-server/public/aluno/index.html`** | junto com o servidor |
| Portal | `prorider-server/…/portal.html` | junto com o servidor |
| Ginásio | pasta local com `ginasio.html`, `script.js`, etc. | o Mario copia nas pastas e regera o executável |

> ⚠️ **O app NÃO vive no repositório `prorider-aluno`.**
> Até 19/09 os deploys iam para lá, e o servidor servia um arquivo antigo de `public/aluno/`. Nenhuma correção chegava ao celular.
> **Teste para confirmar que subiu:** abrir o app em aba anônima, ir em *Entrar na Aula*. Deve estar escrito **"Qual é a sua bike"**. Se estiver "tua bike", é o arquivo antigo.

**Endereços**

- Servidor: `https://prorider-server-production-5784.up.railway.app`
- WebSocket: `wss://prorider-server-production-5784.up.railway.app`
- App: `…/aluno`

---

## 3. Ginásio

### Arquivos

| Arquivo | Função |
|---|---|
| `ginasio.html` | estrutura das telas |
| `script.js` | toda a lógica (~540 KB) |
| `style.css` | aparência |
| `bled112.js` | driver do dongle Bluetooth — **ver regra de ouro nº 4** |
| `servidor-local.js` | servidor HTTP local que entrega vídeo e música do pendrive |
| `construtor.html` | construtor de aulas do desktop |
| `particles-prorider.js` | efeito visual |
| `PRORIDER.bat` | arranca o servidor local e abre o Ginásio |
| `LEIA-ME.txt` | **histórico numerado de todas as mudanças** (itens 1 a 69) |

### Versão em execução

O Console (F12) mostra na primeira linha: `[ProRider] BUILD dd/mm<letra> — …`. É a forma de confirmar qual versão está a rodar.

### Telas principais

- **Espera (idle)** — grade do dia, countdown automático para a próxima aula. **Tocar 5 vezes no logo** abre a tela de ativação da licença.
- **Escolha** — Carregar aula · Aula do sistema · Sessão livre · Montar aula.
- **Carregar aula** — pergunta a origem: *Do pendrive* ou *Minhas aulas* (nuvem, com QR).
- **Pré-aula** — QR da sala, alunos a entrar, perfil da aula.
- **Aula** — vídeo, gráfico do topo, gráfico paginado de baixo, cartões.
- **Pareamento** — associa cada posição a uma bike real.

### Controle

O Ginásio é operado por **comando de Xbox**. Todo o input passa por `startGamepad()`. Telas novas registam `window._nuvemGp` para receber o controle primeiro. O teclado funciona em paralelo para testes.

---

## 4. App do aluno e do professor

Um único arquivo, um único app. O que muda para o professor é o que aparece, não o app.

### Para todos

- Home: *Entrar na Aula*, *Free Ride*, *Agenda de Aulas*, *Treino do Treinador*.
- Durante a aula, a **gaveta** (puxar para cima): trocar FTP, avançar/voltar bloco, **Revisar o treino**.
- **Revisar o treino** mostra os blocos e o **recado do treinador** de cada um, com o bloco atual em destaque.

### Só para professor

- Card comprido **Construtor de Treino** na home, abaixo da grade.
- **Vista da Sala** na gaveta.
- No construtor: **Salvar na minha conta** e **Baixar arquivo .json**.

### Como o app sabe que a pessoa é professora

**Não pelo `role`.** Pela lista de unidades devolvida por `GET /professor/licencas`. Se a lista tem pelo menos uma unidade, a pessoa é professora. `super_admin` vê tudo.

A decisão é tomada **depois** de a lista chegar. Até 20/09 era tomada antes, e um gestor-professor caía sempre como aluno.

### Atalhos de teste

- `?prof=1` na URL força a interface de professor.
- `?parear=CODIGO` confirma o pareamento com um Ginásio (é o que o QR de *Minhas aulas* abre).

---

## 5. Servidor

`server.js` em Node, Express + `ws`, PostgreSQL. Hospedado no Railway.

### Arranque

1. Liga ao banco.
2. **Migrações** — cria tabelas e colunas que faltam. Ver regra de ouro nº 1.
3. Abre HTTP e WebSocket.
4. Liga as tarefas periódicas:
   - limpeza de salas sem professor (carência de 3 min)
   - batimento WebSocket a cada 30 s
   - limpeza horária de `shared_aulas` expiradas
   - timer de 10 min das reservas

### Variáveis do Railway

| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | assina todos os tokens. **Tem de ser fixa.** Trocá-la desloga todo mundo e invalida todo Ginásio. |
| `PORT` | definida pelo Railway |

---

## 6. Protocolo WebSocket — a sala ao vivo

### Ciclo de vida da sala

```
Ginásio ──criar_sala──▶ servidor cria a sala com um código  PR-XXXX-XXXX
Aluno   ──assinar_sala─▶ recebe sala_info (bikes ocupadas) para escolher
Aluno   ──entrar_sala──▶ servidor avisa o Ginásio: aluno_conectou (nome, bike, foto, ftpBase)
Ginásio ──dados_aluno / bikes_live──▶ servidor ──▶ cada celular recebe a sua bike
Ginásio ──fim_aula──▶ servidor ──▶ alunos recebem fim_aula
```

### Quando o professor cai

**A sala não é apagada.** O servidor marca a hora (`profCaiuEm`). A limpeza periódica só apaga depois de **3 minutos** sem professor e sem alunos — e **avisa os alunos antes** (`sala_encerrada`). Se o professor voltar antes, ninguém percebe.

Encerramento **deliberado** é imediato: vem pela mensagem `fim_aula`.

### Mensagens

| Mensagem | Quem envia | Para quê |
|---|---|---|
| `criar_sala` | Ginásio | abre a sala |
| `sala_info` | Ginásio → alunos | número de bikes, quais estão ocupadas |
| `assinar_sala` | app | observa a sala antes de escolher bike |
| `entrar_sala` | app | entra com nome, bike, foto e **FTP** |
| `aluno_conectou` | servidor → Ginásio | chegou um aluno |
| `dados_aluno` | Ginásio | dados de um aluno |
| `bikes_live` | Ginásio | dados de todas as bikes, 4× por segundo |
| `dados_aula` / `update_aula` | Ginásio | bloco atual, tempo |
| `iniciar_aula` / `fim_aula` | Ginásio | início e fim |
| `iniciar_ftp` / `fim_ftp` / `ftp_resultado` | Ginásio | teste de FTP |
| `iniciar_desafio` / `desafio_update` / `fim_desafio` | Ginásio | desafio por equipes |
| `set_ftp` | app → Ginásio | aluno trocou o FTP ao vivo |
| `kcal` | Ginásio | calorias |
| `sala_encerrada` | servidor → alunos | a sala acabou |
| `erro` | servidor | ex.: `Sala nao encontrada` |
| `ping` / `pong` | ambos | batimento; o Railway derruba conexão ociosa em ~60 s |

### O código guardado no celular

O app guarda o código da última sala em `localStorage` (`pr_last_sala`), para a faixa *Voltar pra última aula*. É apagado quando chega `sala_encerrada`, `fim_aula` ou `erro` de sala inexistente. Antes disso não era, e a faixa ficava presa a salas mortas.

---

## 7. Rotas HTTP

Levantamento do código. Agrupadas por área. As marcadas com ★ foram acrescentadas depois de 19/09; ◇ estão especificadas e à espera de implementação.

**`/display`** — o Ginásio
`POST /display/ativar` · `GET /display/agenda` · `GET /display/proxima-aula` · ★ `POST /display/renovar`

**`/ginasio`** — Minhas Aulas
★ `POST /ginasio/pareamento` · ★ `GET /ginasio/pareamento/:codigo` · ★ `GET /ginasio/treinos` · ★ `GET /ginasio/treinos/:id`

**`/professor`**
★ `GET /professor/licencas` · ★ `POST/GET/PUT/DELETE /professor/treinos` · ★ `POST /professor/parear`

**`/gestor`**
`GET /gestor/agenda` · `PUT /gestor/agenda/:id` · `GET /gestor/agenda/:id/reservas` (★ professorAuth) · `POST /gestor/agenda/:id/walkin` · `PUT /gestor/reservas/:id/status` (★ professorAuth) · ★ `GET/POST /gestor/professores` · ★ `DELETE /gestor/professores/:userId` · `GET /gestor/alunos` · `GET /gestor/alunos/:id` · `POST /gestor/alunos/:id/reset-senha` · `GET /gestor/config` · `PATCH /gestor/config/bikes` · `GET /gestor/leaderboard` · `GET /gestor/proxima-aula` · `GET /gestor/relatorio` · `GET /gestor/stats` · `POST /gestor/sessao` · `DELETE /gestor/sessao/:id` · `POST /gestor/sessao/:id/encerrar` · `POST /gestor/sessao/:id/iniciar` · `POST /gestor/sessao/:id/reset-conexoes` · `GET /gestor/sessao/ativa`

**`/aluno`**
`POST /aluno/reservar` · `DELETE /aluno/reservar/:id` · `GET /aluno/reservas` · `GET /aluno/portal/historico` · `GET /aluno/portal/perfil`

**`/sessao`**
`POST /sessao/entrar` · `POST /sessao/entrar-bike` · `POST /sessao/sair` · `POST /sessao/reservar` · `PATCH /sessao/dados` · `POST /sessao/bt-anonimo` · `GET /sessao/info` · `GET /sessao/minha` · `GET /sessao/status`

**`/aula`**
`POST /aula/complete` · `GET /aula/historico` · `POST /aula/share` · `GET /aula/load/:share_id`

**`/agenda`**
`GET /agenda/cidades` · `GET /agenda/grade/:license_id`

**`/desafios`**
`POST /desafios/grupos` · `POST /desafios/grupos/:codigo/entrar` · `GET /desafios/grupos/:codigo/ranking` · `GET /desafios/ranking/:desafio_id` · `GET /desafios/ranking/mensal`

**`/admin`** — super admin
`GET /admin/dashboard` · `GET /admin/licencas` · `PUT /admin/licencas/:id` · `PATCH /admin/licencas/:id/financeiro` · `POST /admin/license/create` · `PATCH /admin/license/:id/status` · `POST /admin/license/:id/impersonate` · `POST /admin/licencas/:id/gerar-onboarding` · `GET /admin/alunos` · `GET /admin/users` · `POST /admin/user/promote` · `GET /admin/professor-requests` · `POST /admin/professor-requests/:id/review` · `GET /admin/pagamentos/:license_id` · `GET /admin/financeiro/dashboard` · `POST /admin/criar-admin`

**`/academia`** — `GET /academia/financeiro` · `PUT /academia/financeiro/cartao`
**`/license`** — `POST /license/validate` · `POST /license/activate-mobile` · `POST /license/generate-mobile-token`
**`/onboarding`** — `GET /onboarding/:token` · `GET /onboarding/lic/:token`
**`/ping`** — saúde do servidor

---

## 8. Banco de dados

| Tabela | Guarda |
|---|---|
| `users` | contas; `role` = nível administrativo |
| `licencas` | academias; `codigo` é o número da licença |
| `aulas_agenda` | grade de horários |
| `aulas_reservas` | reservas; ★ `bike_numero`; status `reservado` · `presente` · `ausente` · `cancelada` |
| `professor_licencas` ★ | quem é professor de qual unidade |
| `aulas_completadas` | resumo de cada aula feita |
| `shared_aulas` | aulas compartilhadas por QR, com validade |
| `aula_historico` | histórico |
| `sessoes_ao_vivo`, `sessao_conexoes` | sessões ao vivo |
| `desafio_grupos`, `desafio_grupo_membros` | desafios |
| `pagamentos` | financeiro |
| ★ `licenca_computadores` | computadores ativos por licença |
| ★ `treinos_professor` | aulas salvas pelo professor |
| ★ `pareamentos_ginasio` | códigos de QR de *Minhas aulas* |

**Status de reserva** — a diferença importa para o histórico de frequência:
- `cancelada` — o próprio aluno desmarcou (pode, a qualquer momento).
- `ausente` — o professor marcou que não veio, ou passaram 10 min.

---

## 9. Autenticação e tokens

Todos são JWT assinados com `JWT_SECRET`.

| Token | Quem tem | Contém | Validade |
|---|---|---|---|
| de utilizador | app, portal | id, role, license_id | login |
| do display | Ginásio (`pr_display_token`) | role `display`, license_id, ★ device_id | ★ **15 dias** |
| de pareamento | Ginásio, durante *Minhas aulas* | professor, licença | ★ 4 horas |

**Chave de reserva:** se `JWT_SECRET` não estiver definida, o código usa uma chave escrita nele — qualquer pessoa com o código pode forjar um super admin. O servidor avisa no log ao arrancar.

---

## 10. Licenças

Decisões do Mario (20/09):

- **Uma licença vendida, um computador.** Ativar noutro desliga o anterior — o último ganha.
- **Demo: três computadores**, para os testes.
- **A cada 15 dias** o servidor confere licença ativa e pagamento em dia; senão o Ginásio mostra **LICENÇA SUSPENSA**. Tolerância de 5 dias.
- Identificação por `device_id`, criado pelo Ginásio na primeira execução. **Nunca pelo IP.**

**No Ginásio:**
- ativação: 5 toques no logo → código da licença. Uma vez por computador.
- renovação: sozinha, ao abrir e a cada 6 h, quando faltam menos de 3 dias.
- **401** → pede o código de novo. **403** → tela de suspensão.
- Nada disso interrompe uma aula em andamento.

**Fluxo de trabalho:** atualizações testadas na **demo**; quando estáveis, levadas ao notebook do **Clube Alto dos Pinheiros**, que tem licença fixa.

---

## 11. Papéis e permissões

| Nível (`role`) | Quem define | Pode |
|---|---|---|
| `super_admin` | — | tudo; cria gestores |
| `admin` | super admin | administração |
| `gestor` | **só o super admin** | gerir a própria unidade; adicionar professores **só à própria unidade** |
| `aluno` | cadastro | usar o app |

**Ser professor não é um nível.** É uma linha em `professor_licencas`, por unidade. Um gestor pode ser professor da própria unidade. Um professor pode dar aula em várias unidades da mesma rede com **uma conta só**. Removê-lo de uma unidade mantém o histórico.

`professorAuth` aceita a pessoa se ela tiver acesso **àquela licença** — não basta ser professor em qualquer lugar.

---

## 12. Formato do arquivo de aula

Versão **1.1**. O mesmo no construtor do desktop, no construtor do celular e na nuvem.

```json
{
  "versao": "1.1",
  "nome": "MIX MARIO 64",
  "duracaoTotalSec": 3165,
  "segments": [
    { "id": "ativacao", "name": "AQUECIMENTO / ATIVAÇÃO", "type": "warmup" },
    { "id": "main_1",   "name": "BLOCO PRINCIPAL",        "type": "main" },
    { "id": "cooldown", "name": "VOLTA À CALMA",          "type": "cooldown" }
  ],
  "workout": [
    { "durationSec": 22, "duration": 0.367, "rpmMin": 85, "rpmMax": 90,
      "intensity": "z5", "ftpMin": 106, "ftpMax": 120,
      "position": "Em Pé", "notes": "foca na respiração", "segmentId": "main_1" }
  ],
  "video":  { "fonte": "local", "arquivo": "Montagne de Reims.mp4", "syncOffset": 3238 },
  "musica": { "fonte": "mp3",   "arquivo": "Mix Mario 64.mp3",       "syncOffset": 0 }
}
```

- `notes` é o **recado do treinador**. Aparece só no celular; o Ginásio não exibe.
- `syncOffset` do vídeo é o **ponto de chegada** em segundos.
- Um **segmento é um trecho contínuo**, não um rótulo espalhado — ver regra de ouro nº 3.

---

## 13. Mídia: vídeo e música

O arquivo de aula guarda **só os nomes**. Os arquivos ficam no pendrive:

```
<unidade>:\ProRider\
    videos\
    musicas\
    aulas\
```

1. `servidor-local.js` varre as unidades do Windows e acha a pasta `ProRider`.
2. Serve os arquivos em `http://localhost/midia?p=<caminho>`, com suporte a avanço parcial.
3. O Ginásio usa esse **endereço fixo** — sem autorização de pasta que apodrece, sem arquivo de 0 bytes.

No Console: `pendrive achado pelo servidor local: H:\ProRider (N video, N musica, N aula)`.

Vale igual para aulas do pendrive e da nuvem: o nome tem de ser **idêntico**, com colchetes, espaços e acentos.

---

## 14. Bluetooth: das bikes ao ecrã

- Cada Keiser M3i **anuncia** os dados por BLE; não há conexão.
- O dongle **BLED112** recebe todos. Um dongle, até 20 bikes.
- Anúncio: watts, rotação, **batimentos** (bytes 10–11), **marcha** (byte 20, só com firmware ≥ 21).
- O Ginásio sobe os dados em `bikes_live`, 4× por segundo.

**O vigia de 12 s:** se o dongle ficar 12 s sem pacote, a porta é reiniciada. Existe para quando o Windows suspende o USB durante a aula. **Com a sala vazia, sem ninguém pedalando, ele dispara à toa** — pendente de correção.

**Modo simulado:** quando o dongle falha, o pareamento pode gerar dados de teste. A bike fica marcada **SIMULADO** em amarelo. Nenhum número inventado pode aparecer como medido.

---

## 15. Regras de ouro

Cada uma custou um incidente.

1. **Todo `ALTER TABLE` depois de um `CREATE TABLE IF NOT EXISTS`.** Um `ALTER` sozinho numa tabela que não existia pôs o servidor em laço de reinícios a noite inteira de 18 para 19/09.
2. **Nunca `process.exit()` por configuração em falta.** O Railway reinicia e o laço recomeça. Um alarme no log basta.
3. **Segmento é um trecho contínuo.** Agrupar blocos por igualdade de `segmentId` desfaz a ordem real da aula.
4. **`bled112.js` só se mexe com motivo forte.** E o executável Electron **tem a própria cópia** — alterar o arquivo da pasta não altera o do executável. Confirmar sempre qual está a rodar.
5. **Largura zero significa "não sei", não "cabe tudo".** Nenhum cálculo de layout pode depender de um elemento escondido.
6. **Número que não vem da bike tem de estar marcado na tela.**
7. **Não substituir `server.js` por uma cópia antiga.** Mudanças vão como trechos.
8. **O app publica em `public/aluno/index.html`.** Confirmar com a frase "sua bike".
9. **Mensagem que assusta à toa faz perder tempo.** "Servidor caiu" ao encerrar uma aula é comportamento normal com texto errado.
10. **Quem valida é o servidor.** O app pode esconder botões, mas a permissão é conferida do lado de lá.

---

## 16. Guia de problemas

| Sintoma | Causa mais provável | Onde olhar |
|---|---|---|
| "Sala não encontrada" no celular | sala apagada, ou código velho guardado | log do servidor; `pr_last_sala` |
| Faixa *Voltar pra última aula* presa | app antigo no ar | frase "sua bike" em aba anônima |
| 401 em `/display/agenda` | `JWT_SECRET` mudou após a ativação | reativar: 5 toques no logo |
| Todos os alunos caem ao mesmo tempo | servidor reiniciando | logs do Railway: `Starting Container` repetido |
| Ciclo `tentando reconectar` no Console | vigia de 12 s com sala vazia, ou `requestPort` sem clique | fechar e abrir o Ginásio |
| Bike parada mostra watts | modo simulado | procurar SIMULADO no cartão |
| Gráfico repete ou volta atrás | cálculo do segmento ou da página | linhas `[pg2]` no Console |
| Vídeo ou música não carregam | nome diferente, ou pendrive não achado | `pendrive achado pelo servidor local` |
| Todo aluno com FTP 150 | FTP não enviado no `entrar_sala` | tela de Potência |
| Interface de professor não aparece | pessoa sem linha em `professor_licencas` | `GET /professor/licencas` vazio |
| Mudança não chegou ao celular | deploy no repositório errado | frase "sua bike" |

---

## 17. Histórico de incidentes

| Data | O que aconteceu | Causa | Correção |
|---|---|---|---|
| 14/09 | 401 em `/display/*` | `JWT_SECRET` alterada; Ginásio ignorava o 401 | Ginásio 20/09b pede reativação; ◇ chave fixa |
| até 19/09 | correções do app nunca chegavam | deploy no repositório `prorider-aluno` | app em `public/aluno/index.html` |
| 18–19/09 | 13 alunos caindo em duas aulas | `ALTER TABLE aulas_completadas` sem a tabela existir → laço de reinícios | `c1e80cc`, `2edbaf6` |
| 19/09 | sala morria em quedas de segundos | servidor apagava a sala ao fechar a conexão do professor | carência de 3 min |
| 19/09 | gráfico repetia trechos | segmentos agrupados por nome, não por trecho contínuo | Ginásio 19/09c |
| 20/09 | ciclo infinito de reconexão | `requestPort` exige clique; tentava sem fim | ◇ precisa do `bled112.js` do executável |
