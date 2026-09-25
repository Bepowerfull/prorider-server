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

## 2026-09-25 · ginasio 25/09a

**O que mudou**
- **Gráfico 2, 25% maior** (pedido do Mario): alturas `--pg2h1` 5,0 → 6,25vh; `--pg2h7` 14,0 × 1,25 = 17,5, com a diferença ampliada em mais 15% → 19,2vh; piso e teto 46→58 px e 168→235 px; rótulos das zonas, nome do segmento, "você está aqui", INÍCIO/FIM e caixas do `#pg2Info` +25%. A largura não cresceu: o gráfico já ocupa o espaço entre os círculos. A faixa de informação ganhou 110 px de largura. `_pg2Cabe()` reduz a letra de uma caixa até caber (piso de 18 px), medindo a largura real do texto com `Range`, porque o `scrollWidth` arredondado não acusava o corte com reticências.
- **Largura proporcional ao tempo mais marcada:** `flex-grow` = segundos^1,3 (15 s × 60 s: 1:4 → 1:6).
- **Perfil da pré-aula:** a linha fica atrás das barras (`z-index` 0), e as barras passam de opacidade .55 para .9. A agulha fica por cima (`z-index` 3).
- **TrainingPeaks no pendrive e em Minhas Aulas:** `_prDeTrainingPeaks()` converte o `.json` do TrainingPeaks (`Structure`, repetições, `% FTP` ou watts pelo FTP do arquivo, cadência, notas, WarmUp/CoolDown → segmentos), com a mesma regra do app. Um `.json` que não seja aula passa a gerar um aviso no Console.
- **Faixa preta gravada no vídeo:** mede as linhas pretas no alto e no baixo do quadro a 1,5 s, 6 s e 15 s. Com a tarja em pelo menos 2 amostras e entre 1,5% e 20% da altura exibida, aplica `--prVidCrop` (translate + scale com origem no canto) no `#backgroundVideo`. O CSS de trava da 23/09b agora usa `transform: var(--prVidCrop, none)`.

**Por quê**
- Testes do Mario com a 24/09a em 24–25/09: gráfico pequeno e pouco diferenciado; linha do perfil visível por cima; TrainingPeaks não subiu no Ginásio; faixa preta ainda presente (com o vídeo já travado no topo, logo a faixa vem do arquivo).

**Como confirmar**
- Tela inicial: `BUILD 25/09a`.
- Aula com vídeo que tenha tarja: sem faixa na TV, e no Console `… cortada automaticamente: ampliado N%`.
- `.json` do TrainingPeaks no pendrive: aparece na lista e abre com os blocos certos.

**Testado** (navegador): vídeo de teste com tarja de 40 px → cortado (ampliado 6%, tarja fora da tela); sem tarja → nada muda. TrainingPeaks com aquecimento, 3×(10 min + 5 min) e volta à calma → 8 blocos, 60 min, três segmentos. Paginação do gráfico 2 continua correta (60 blocos, 3 páginas).

**Cuidados**
- O corte do vídeo lê pixels do quadro. Se o vídeo vier de outra origem (p.ex. `file://` no executável), o navegador pode bloquear a leitura; nesse caso não corta e não há erro na tela.

---

## 2026-09-24 · ginasio 24/09b

**O que mudou**
- **Versão na tela inicial**, embaixo de SISTEMA PRONTO, no lugar do "Ver. 2.1.0" fixo. Vem de `PR_BUILD`, no topo do `script.js`.
- **Linha do BUILD consertada.** O texto tinha `'< 55%'` entre aspas simples dentro de uma string com aspas simples. A frase partia-se numa comparação (`'…' < 55 % '…'`), o Console mostrava `false 'color:…'` e a versão não aparecia.

**Por quê**
- Na TV, em 24/09, o Console mostrou `false` na linha do BUILD, em `script.js:9270`. Os números de linha dessa captura (`script.js:3024`, `4718`, `9270`; `bled112.js:452`, `530`, `536`) batem exatamente com a 24/09a. Ou seja, **o executável já estava na 24/09a**; só a versão não aparecia.

**Como confirmar**
- Tela inicial → canto inferior direito → `BUILD 24/09b`.

---

## 2026-09-24 · servidor (licenças) · ginasio 24/09a · app 24/09a

**Regras (decisões do Mario, 24/09)**
- A licença é vendida por **quantidade de bikes** (`licencas.max_bikes`, definida pelo super admin), e é ela que manda em tudo: grade da sala, vagas das aulas, reservas e sessões.
- **Mínimo de 10 bikes** por licença.
- **Licença demo: 20 bikes.**
- **Aula de casa (rolo):** até o mesmo número de bikes da licença. Licença de 15 → até 15 de casa, além das 15 da sala.

**O que mudou — servidor (`server.js`)**
- `_tetoDe(licença)`: teto = `max_bikes`, ou `bikes_disponiveis` se for menor (bike parada); nunca acima do vendido.
- **`GET /display/licenca`** (novo, `displayAuth`): `{ max_bikes, bikes_disponiveis, teto }`. `POST /display/ativar` e `/display/renovar` passam a devolver também `max_bikes` e `teto`.
- `GET /agenda/grade/:license_id`: `academia.teto_bikes`, e o `vagas_max` de cada aula limitado ao teto. Isto corrige o app que mostrava mais vagas do que a licença (aulas antigas com o padrão de 20).
- `POST /aluno/reservar`, `/gestor/agenda/:id/reservas`, `/gestor/proxima-aula` e `vagas_total` da próxima aula: todos limitados ao teto. `max_conexoes` das sessões usa o mesmo teto.
- `PUT /gestor/agenda/:id` sem `vagas_max` usa o teto em vez de 20.
- **Sala ao vivo (`entrar_sala`):** usa o `numBikes` do `sala_info` (que o Ginásio já manda limitado pela licença). Bike acima do número da sala é recusada (a 99 do professor passa sempre). Quem entra **sem bike da sala** (de casa) tem teto igual ao número de bikes; o seguinte recebe "Aula de casa cheia".
- `POST /admin/licencas` exige `max_bikes` ≥ 10 e começa `bikes_disponiveis` = `max_bikes`. `PUT /admin/licencas/:id` recusa < 10, mantém o valor atual se `max_bikes` não vier e baixa `bikes_disponiveis` se ficar acima.
- **Demo com 20:** no arranque, `PRDR-DEMO-001` passa a 20 bikes **só se ainda estiver em 0 ou 15** (o valor antigo). Uma mudança feita depois pelo super admin não é desfeita. O `/setup` e a sessão de teste passam a criar com 20.

**O que mudou — Ginásio 24/09a**
- Pergunta o teto em `/display/licenca` (6 s depois de abrir e a cada 6 h), e também o recebe na ativação e na renovação. A grade (`parNumBikes`) nunca passa do teto, nem no ajuste manual; se estiver maior, é reduzida e o `sala_info` é reenviado.

**O que mudou — app 24/09a**
- **Aula anterior "grudada".** Relato: encerrar uma aula, começar outra, ler o QR novo, e o app mostrava a aula anterior no fim do bloco, sem atualizar até recarregar o app. Havia duas causas: (1) `_encerrarAulaApp` só fechava o socket se o app estivesse na tela da aula; (2) `connectQR`, com um socket aberto, ia direto para a aula sem entrar na sala nova. Agora o fim da aula fecha o socket e limpa o estado em qualquer tela, e o QR de outra sala fecha a ligação anterior e entra na nova (`wsConn._prCodigo`). Testado com o socket simulado: antes ficava na sala velha; depois entra na nova com o gráfico zerado.

**Testado**
- Servidor rodando localmente (sem banco), com WebSocket: sala de 3 bikes → bike 2 ok, bike 5 recusada, 99 ok, 3 de casa ok, a 4.ª de casa recusada.
- Ginásio com grade salva em 30 e licença com 20 → grade 20; o ajuste manual para até 20.

**Cuidados**
- **Precisa de deploy do servidor.** Sem ele, o Ginásio e o app funcionam como antes: a rota nova dá 404 e é ignorada.
- As regras de banco só valem com o banco ligado; os testes acima foram sem banco.

---

## 2026-09-24 · ginasio 23/09e

**O que mudou**
- **Gráfico 2 atrasado ou adiantado conforme a tela (item 2.6 do roteiro).** Causa: dentro de um mesmo segmento, a troca de página do gráfico de cartões só era desenhada quando outra coisa chamava `_pg2Render` (troca de segmento, troca de tela, resize). Até lá, a tela mantinha os cartões da página anterior, e o `_pg2Pin` (que já usava o índice da página nova) movia a agulha por cima de blocos errados. Agora `_pg2Render` guarda qual página está desenhada (`window._pg2Chave`) e `_pg2Pin` redesenha quando ela não é a da vez.
- **Bike 99 (professor) aparece na aula.** Era descartada em `_processDevice` (`if(bikeN === 99) return;`) antes de qualquer coisa: pareava e transmitia, mas nunca entrava em `alunosMap`. Também estava fora do `bikes_live`, então o professor na 99 pelo app ficava com 0 W e a Vista da sala a mostrava como não conectada. Agora entra como as outras, com o cartão "Professor" quando ninguém está logado nela (`_nomeVirtual(99)`), e vai no relay. O `sala_info` continua sem a 99, porque o app já a mostra à parte.
- Marcha e FC também nos alunos virtuais (bikes sem login).

**Como confirmar**
- Aula com um segmento de muitos blocos, no gráfico 2: quando a aula passa para a página seguinte, a tela vira na hora, e a agulha fica sobre o bloco certo sem precisar de trocar de tela. No Console, `[pg2] … pagina 2/N` aparece no momento da passagem.
- Bike 99 pareada e a pedalar: aparece o cartão "Professor" nas telas de FTP e RPM.
- Professor no app escolhendo a bike 99: watts e RPM no celular; na Vista da sala, a 99 aparece conectada.

**Testado** (simulação no navegador): 60 blocos em 3 páginas, com passagens nos blocos 15, 25, 35 e 45. Antes, da passagem para a página 2 em diante, a tela ficava na página 1; depois, os cartões desenhados são sempre os da página da vez. Bike 99 com dado de dongle simulado: antes não aparecia nem ia no relay; depois aparece como "Professor" e segue no relay.

**Cuidados**
- Nada na leitura das bikes foi alterado.
- O professor aparece também no ranking. Se não for para aparecer, é um ajuste pequeno.

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
