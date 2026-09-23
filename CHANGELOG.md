# ProRider — Registro de mudanças

## A regra

**Toda atualização gera uma entrada aqui, no mesmo commit.**

- Quem muda o código escreve a entrada — nunca depois.
- Se a mudança altera **como o sistema funciona** (uma rota nova, uma tabela, um fluxo), atualiza também o `ARQUITETURA.md`.
- A entrada responde a três perguntas: **o que mudou, por quê, e como confirmar que funciona.**
- Os dois arquivos ficam na raiz do `prorider-server` e vão para o GitHub junto com o código.

O `ARQUITETURA.md` diz **como o sistema é hoje**. Este arquivo diz **como chegou até aqui**. Quando algo quebrar, o primeiro responde *onde olhar*; o segundo, *o que mudou desde que funcionava*.

### Modelo

```markdown
## AAAA-MM-DD · componente · versão ou commit

**O que mudou**
- …

**Por quê**
- …

**Como confirmar**
- …

**Cuidados**
- (o que pode quebrar, dependências, ordem de publicação)
```

Componentes: `servidor` · `app` · `ginasio` · `portal` · `banco`.

---

## 2026-09-22 · servidor · a750387, 4409582, 1263390, 9d4528d

**O que mudou**
- `PUT /admin/users/:id` (super_admin): altera `role`, `license_id` e `name`.
- `PUT /admin/licencas/:id` aceita campos de endereço.
- Sala WebSocket com `trancadas: Set`; novos casos `prof_remover_aluno`, `prof_trocar_bikes`, `prof_trancar_bike`.
- `GET /agenda/aula-ativa/:license_id` (sem auth).
- `JWT_SECRET` obrigatório — `throw` no arranque se não definido; valor fixo definido no Railway em 23/09.

---

## 2026-09-23 · ginasio 23/09d

**O que mudou**
- **`bled112.js` unificado.** Até aqui havia duas versões: a do executável (`C:\ProRider\Executavel\app\bled112.js`, com o caminho Electron) e a das pastas (sem ele). O bloco do executável entrou em `BLED112.connect()`, logo depois de `if (BLED112.connected) return;`: se o `userAgent` for Electron, `requestPort({ filters: [{ usbVendorId: 0x2458 }] })`, `open` e `_provaDeVida()`; senão (`else`), o caminho de sempre do Chrome/Edge (portas autorizadas → diálogo), sem nenhuma mudança. É exatamente o diff enviado pelo desenvolvedor.

**Por quê**
- Para o executável poder receber a versão nova sem perder a abertura da porta no Electron, e para acabar com as duas versões divergentes.

**Como confirmar**
- Executável: as bikes aparecem como hoje. No Console, sem dongle ligado, a mesma sequência de hoje: `Electron requestPort falhou…` e `DONGLE_NAO_RESPONDE`.
- `PRORIDER.bat` (Chrome): `portas autorizadas: N | candidatas: M`, como antes.
- Testado com a porta serial simulada nos dois caminhos: cada um segue o seu ramo e dá o mesmo erro de antes.

**Cuidados**
- Nada na leitura das bikes foi alterado.
- Observação para depois (não mexido): no executável, a primeira tentativa automática falha com `Must be handling a user gesture` e a ligação só acontece numa tentativa seguinte. Funciona, mas vale investigar com o dev como o processo principal do Electron trata o `select-serial-port`.

---

## 2026-09-23 · app 23/09d

**O que mudou**
- **Gauge: %FTP e BLOCO simétricos.** O valor era ancorado pela direita em x=170, o separador ficava em x=196 e o relógio centrado em x=272, e o conjunto pendia para a direita. Agora cada coluna é centrada no meio da sua metade (x=120 e x=240) e o separador fica no eixo do gauge (x=180). Nada mais saiu do lugar: as caixas RPM, WATTS, BPM e GEAR continuam embaixo.
- **Marcha e FC na aula da academia.** Só o `tick()` da aula própria do app escrevia GEAR e BPM. Na aula do Ginásio o `tick()` não roda, então as caixas ficavam em "-" mesmo com o Ginásio mandando `g` e `hr` no `bikes_live`. Agora `_pushLiveTelemetria` (que roda sempre, a cada 250 ms) escreve as duas. Celular ligado direto na bike ou na cinta por Bluetooth continua com prioridade.
- **%FTP no app com o FTP da gaveta, na hora.** `_pushLiveTelemetria` usava a % calculada pelo Ginásio, com o FTP que ele recebeu na entrada. Agora calcula com `_ftpDoAluno()` e os watts recebidos, o mesmo que o `tick()` já fazia. A troca na gaveta aparece no gauge no segundo seguinte, mesmo com um Ginásio antigo na TV.
- **Relógio BLOCO no gauge durante a aula da academia:** usa o `blocoRest` que o Ginásio manda. Antes só o `tick()` o atualizava, e ele ficava parado.

**Como confirmar**
- Gauge com o número à esquerda e o relógio à direita, equidistantes da linha do meio, com 2 e com 3 dígitos.
- Aula de academia numa bike Keiser: GEAR com a marcha; BPM com a cinta, se houver.
- Trocar o FTP na gaveta: o % do gauge muda no segundo seguinte.

---

## 2026-09-23 · ginasio 23/09c · app 23/09c

**O que mudou**
- **App — FTP da gaveta chega à sala na hora.** Antes o valor novo ficava só no celular: o Ginásio seguia com o `ftpBase` recebido na entrada, e a %FTP e a zona (na TV e no próprio app, que as recebe do Ginásio) não mudavam. Agora, 400 ms depois do último toque em +/−/Digitar, o app reenvia `entrar_sala` na **mesma bike, com o mesmo nome e código** e o `ftpBase` novo. É o caminho que o servidor já aceita (reconexão) e já repassa ao Ginásio como `aluno_conectou`, que o Ginásio já trata como troca ao vivo (recalcula com os watts atuais). As respostas `conectado`/`entrou_sala` desse reenvio não fazem o app navegar.
- **App — FTP também na entrada pela reserva.** `_tentarConexaoWS` era um terceiro ponto que manda `entrar_sala` e ia sem `ftpBase` — quem entrava pela reserva ficava com 150 no Ginásio.
- **App — Revisar o treino** abre na aula de academia: usa o gráfico que o Ginásio manda (`aulaGrafico`) quando o app não tem treino próprio (`cAula`). Blocos com menos de 1 min aparecem em mm:ss.
- **Ginásio — marcha e FC nos cartões** (telas de FTP e RPM), no rodapé: `♥ 148` e `M 14`, só quando há valor. Já eram lidas da Keiser (`b.gear`, `b.bpm`) e gravadas no aluno, mas nenhum cartão mostrava.
- **Ginásio — FC na lista do lobby:** lia `a.hr||a.fc`, e a leitura da bike grava em `a.bpm`.

**Por quê**
- Teste do Mario em 23/09: FTP trocado na gaveta não atualizava; Revisar o treino não abria; marcha e FC pendentes desde a 19/09.

**Como confirmar**
- Na aula, trocar o FTP na gaveta: no Console do celular `FTP …W enviado a sala (bike N)`; na TV (F12) `aluno_conectou` com o `ftpBase` novo e a %FTP do cartão muda na próxima leitura.
- Entrar pela reserva e ver na TV a %FTP com o FTP do aluno, não 150.
- Gaveta → Revisar o treino durante uma aula do Ginásio: lista de blocos com o atual marcado AGORA.
- Cartões com ♥ e M para quem pedala com cinta; sem cinta, só M.

**Cuidados**
- O reenvio depende do Ginásio da 22/09 ou mais novo (que trata `ftpBase` em `aluno_conectou`). A TV hoje roda o executável na **20/09c** — lá pode não ter efeito até o executável ser atualizado.
- Nada na leitura das bikes foi alterado; só a exibição do que já é lido.

---

## 2026-09-23 · ginasio 23/09b

**O que mudou**
- **Perfil da aula no lobby:** as barras passam a ser posicionadas pela mesma conta da linha branca e da agulha (`_prSec`, em segundos). Antes eram itens flex com `gap:4px` e `min-width:2px`; com 69 blocos os vãos somavam ~270 px e a linha ia ficando para trás das barras.
- **Cartão AULA SELECIONADA** (coluna 3 do lobby) não transborda mais: `_fitPreAulaCol3()` encolhe o QR do browser até o cartão caber (piso de 110 px). Antes Música e Status da sala saíam por cima do perfil.
- QR Codes sem `title` — a biblioteca punha o endereço como dica flutuante, que aparecia quando o rato parava em cima.
- **Meta FTP** nos painéis da aula (`atualizaLiveBar`): bloco sem piso mostrava `--–55%`; agora `< 55%`, como o círculo. Sem teto, `> X%`.
- **MINHAS AULAS:** 401 em `POST /ginasio/pareamento` mostra *GINÁSIO NÃO AUTENTICADO* e o A abre a reativação (`_gymLicencaPerdida`). Antes aparecia *SEM LIGAÇÃO* e só dava para voltar.

**Por quê**
- Fotos da máquina de 23/09. O Console dela mostrou `BUILD 20/09c` (script.js:9072) e a mensagem `[BLED112] Electron requestPort`, que não existe no `bled112.js` das pastas: a máquina roda o **executável**, com os arquivos empacotados dentro dele, e não as pastas `Ginasio\`. Copiar a 23/09a para as pastas não mudou o que roda na TV.
- **Faixa preta em cima do vídeo** — vista na máquina com a **20/09c** (executável). A 23/09a já tinha tirado o `position:relative` da tag `<video>`. Em teste (aula real com vídeo, troca gráfico 1↔2, overlay Y) **não reproduz**: o elemento fica em `top:0` com a altura toda. Então ou algo da máquina real o empurra, ou a faixa está **dentro do próprio arquivo de vídeo**. A 23/09b (1) trava a posição no CSS com `!important` (`#liveClass > #backgroundVideo`), cobrindo o primeiro caso, e (2) mede no Console, meio segundo depois de o vídeo começar: onde está o elemento (`video no topo: ok` ou `VIDEO FORA DO LUGAR — topo …px` com a causa) e se o quadro do arquivo tem linhas pretas no alto (`O PROPRIO ARQUIVO tem faixa preta em cima: ~N px`). **Ainda não confirmado como resolvido.**

**Como confirmar**
- Console: `[ProRider] BUILD 23/09b`.
- Lobby com uma aula de muitos blocos: a linha branca passa exatamente pelo topo de cada barra, do início ao fim.
- Lobby em 1920×1080 e 1536×864: Status da sala dentro do cartão.
- Bloco Recovery na tela do QR (Y): Meta FTP `< 55%`.
- Aula com vídeo, sem faixa preta na TV. No Console, as duas linhas `[ProRider] video …` — se houver faixa, mandar essas linhas: elas dizem se a causa é a posição ou o arquivo.

**Cuidados**
- O 401 continua a acontecer até o `JWT_SECRET` ficar fixo no Railway; depois disso, reativar o Ginásio uma vez.

---

## 2026-09-23 · app 23/09b · ginasio 23/09a

**O que mudou**
- **Bike 99** na grade de escolha, em laranja, acima das outras — visível para todos (esconder impediria alguém de usá-la quando o professor cede o lugar).
- **Poderes do professor** na Vista da Sala: tocar numa bike abre *Deslogar*, *Trocar de lugar* e *Trancar*. Usa `prof_remover_aluno`, `prof_trocar_bikes` e `prof_trancar_bike` (servidor `1263390`).
- O aluno passa a tratar `removido_da_bike` e `bike_trocada` — sem elas a tela do professor mudava e o aluno continuava a achar que estava na bike antiga.
- Bikes trancadas aparecem com cadeado na grade e não podem ser escolhidas.
- **ENTRAR NA AULA DE AGORA** na grade da academia, via `GET /agenda/aula-ativa/:license_id` — para aulas abertas fora da grade.
- Ginásio: agulha de progresso no perfil da tela de QR, usando `calcDoneSec()`, o mesmo cálculo do mini gráfico do topo.

**Correção**
- O `ftpBase` era enviado em apenas **um** dos dois pontos que mandam `entrar_sala` — e não no principal, o de escolher a bike. Por isso o FTP continuava 150.

**Como confirmar**
- Tela de Potência com o FTP de cada aluno, não 150.
- Tocar numa bike na Vista da Sala abre as três opções.
- Trancar uma bike e vê-la com cadeado no celular de outro aluno.

---

## 2026-09-22 · app 22/09b · ginasio 22/09b

**O que mudou**
- Compatibilidade de campos com o servidor publicado: o app envia o treino em `dados` **e** `json`; o Ginásio lê `dados`, `json` ou `treino`; o token de pareamento é aceite como `token`, `prof_session` ou `prof_session_token`; a lista de treinos como `.treinos`, `.aulas` ou array.

**Por quê**
- O servidor grava `{ nome, dados }` e o app enviava `{ nome, json }`. O treino seria salvo vazio, sem erro visível.

- Revisão chamada a chamada das 13 rotas: código do pareamento (`codigo`|`code`|`pareamento`), validade (`expira_em_seg`|`expires_in`|`ttl`), status (`confirmado`|`confirmed`|`ok`), reservas (`nome`|`name`, `bike_numero`|`bike`, lista em `reservas`|`rows`|`data`).
- `POST /display/renovar` envia o token no corpo além do cabeçalho.

**Como confirmar**
- Salvar um treino no celular e vê-lo em `GET /professor/treinos` com os blocos preenchidos.
- Se o pareamento falhar, o Ginásio mostra a razão na tela e escreve a resposta no Console — não fica um QR vazio.

---

## 2026-09-22 · documentação

**O que mudou**
- Criados `ARQUITETURA.md` e este `CHANGELOG.md`.

**Por quê**
- Boa parte do conhecimento do sistema só existia em conversas. O incidente de 19/09 e o deploy no repositório errado levaram horas a diagnosticar por falta de um registro assim.

---

## 2026-09-20 · ginasio · 20/09c

**O que mudou**
- Identidade do computador (`device_id`), enviada em `/display/ativar`.
- Renovação automática do token do display: ao abrir e a cada 6 h, quando faltam menos de 3 dias.
- 401 → pede o código de novo, com aviso se foi outro computador. 403 → tela LICENÇA SUSPENSA.

**Por quê**
- Licença vendida roda num computador só; o pagamento é conferido a cada 15 dias.

**Como confirmar**
- Console: `licenca renovada — valida ate dd/mm/aaaa`.

**Cuidados**
- Nada interrompe uma aula em curso. Tolera o servidor antigo: sem `/display/renovar` (404), segue com o token atual.

---

## 2026-09-20 · ginasio · 20/09b

**O que mudou**
- Ao receber 401 em `/display/*`, descarta o token e abre a tela de ativação.

**Por quê**
- O 401 aparecia desde 14/09 e era ignorado; o Ginásio guardava um token morto para sempre.

---

## 2026-09-20 · ginasio · 20/09a

**O que mudou**
- *Carregar aula* pergunta a origem: *Do pendrive* ou *Minhas aulas*.
- *Minhas aulas*: QR de pareamento; as aulas da nuvem entram na mesma lista do pendrive.

**Cuidados**
- Depende das rotas `/ginasio/*` e `/professor/parear` — especificadas no documento-mestre de 22/09.

---

## 2026-09-20 · app · 20/09f

**O que mudou**
- Construtor: digitar números, editar blocos, recado do treinador, vídeo e música pelo nome, marcar chegada, exportar no formato 1.1, salvar na conta, baixar `.json`.
- Card comprido *Construtor de Treino* na home do professor.
- *Vista da Sala* na gaveta: grelha de bikes, bike 99, estados, `NÃO VEIO` / `LIBERAR`.
- Professor reconhecido pela lista de unidades, não pelo `role`.
- Confirmação de pareamento por `?parear=CODIGO`.

**Correções**
- Corrida no login: a decisão era tomada antes de a lista de unidades chegar.
- Rotação exibida como "8-0 rpm" no *Revisar o treino*.

**Como confirmar**
- Frase "Qual é a sua bike" em aba anônima.

---

## 2026-09-20 · servidor · 299c73c

- `GET /professor/licencas` sem filtro de `role`.
- `POST /gestor/professores` aceita qualquer conta.

## 2026-09-20 · servidor · 8f33946

- Tabela `professor_licencas`; `professorAuth` confere acesso por unidade.
- Rotas `/gestor/professores`.

## 2026-09-20 · servidor · 38b391c

- `professorAuth`; `bike_numero` em `aulas_reservas`; timer de 10 min.

---

## 2026-09-19 · servidor · c1e80cc, 2edbaf6

**O que mudou**
- `CREATE TABLE IF NOT EXISTS` para `aulas_completadas` e `shared_aulas`, antes dos `ALTER`.

**Por quê**
- O `ALTER` numa tabela inexistente derrubava o servidor no arranque. O Railway reiniciava em laço desde as 22:59 de 18/09 — foi o que derrubou os 13 alunos em duas aulas.

**Como confirmar**
- Logs do Railway sem `Starting Container` repetido.

---

## 2026-09-19 · ginasio · 19/09c

**O que mudou**
- O gráfico paginado usa o **trecho contínuo** do segmento atual, não todos os blocos com o mesmo `segmentId`.

**Por quê**
- Em aulas com segmentos intercalados, o gráfico repetia trechos e a página não virava.

---

## 2026-09-19 · deploy

**O que mudou**
- O app passou a ser publicado em `prorider-server/public/aluno/index.html`.

**Por quê**
- Os commits anteriores iam para o repositório `prorider-aluno`, que o Railway não usa. Nenhuma correção do app chegava ao celular.
