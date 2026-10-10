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

## 2026-10-09 · servidor + app (site) · 07/10f — resumo em todas as formas de terminar; botão CONTROLES

**O que mudou**
- **Aluno sai no meio** ("Encerrar Aula"): a aula vai com o que ele fez até ali (já valia com a correção da 07/10e; agora tem teste).
- **Teste de FTP do app:** também grava a aula e manda o resumo.
- **Totem (sem celular):** no `POST /display/aula/resumo`, quem entrou pelo totem com e-mail tem a aula gravada (`aulas_completadas`, `aula_historico`, pontos) e recebe o resumo. Tabela nova `totem_aulas` evita duplicar quando a TV reenvia o resumo.
- **Sem login:** a aula fica guardada no aparelho (24 h) e o resultado mostra "Receba este resumo por e-mail"; ao criar a conta ou entrar, a aula vai para o servidor.
- **App:** a faixa "CONTROLES" virou um botão laranja grande, de um toque (antes só arrastando, o que no iPhone com o app na tela de início fecha o app).
- E-mail do resumo mostra "—" no RPM quando não foi medido.
- **Tela de fim da aula nova** (no padrão do app e dos e-mails): pontos e nível, 6 cartões (duração, calorias, potência, RPM, zona, FC média), linha com %FTP, RPM máx, TSS e distância, gráfico da potência minuto a minuto colorido pela zona e tempo em cada zona. Substitui as duas telas antigas (resultado e pontos).
- **Compartilhar:** 2 modelos (1080×1920) lado a lado, arrasta para o lado (dica animada); o fundo é a foto que o aluno escolhe. Modelo 1: números em coluna; modelo 2: números em linha, gráfico da aula e rodapé.
- **Saúde → TVs:** linha "última consulta" com o que o servidor respondeu à TV (sem pacote assinado, desligada, em dia, instala na tela de espera). Coluna nova `licenca_computadores.atu_consulta`.

**Por quê**
- Pedido do Mario: todo mundo que faz a aula recebe o resumo, termine como terminar; botão difícil no iPhone.

**Como confirmar**
- Grupo `fimaula`: aluno, super admin, aluno saindo no meio, sem login → criar conta, totem (e reenvio sem duplicar), botão de um toque. **32 grupos**.

**Cuidados**
- Só servidor e `public/`. O Ginásio continua 07/10d.

## 2026-10-09 · app (site) · 07/10e — aula da TV volta a ser gravada pelo app

**O que mudou**
- No fim da aula da TV (aluno entrou pelo QR), o app agora chama `POST /aula/complete`. Antes o treino da aula estava só na TV, o app ficava sem "aula atual" e pulava a gravação: a aula não ia para o histórico, não somava pontos e o e-mail do resumo não saía — para qualquer conta.

**Por quê**
- O Mario fez aulas no Clube e não recebeu o e-mail; a Saúde mostrava o e-mail funcionando.

**Como confirmar**
- Grupo novo `fimaula`: app de verdade num navegador entra pelo QR, a TV começa e encerra a aula; confere a aula no banco, o e-mail "seu resumo da aula" e a nota, com conta de aluno e de super admin. **32 grupos**.

**Cuidados**
- Só servidor e `public/` (app web). O Ginásio continua 07/10d: as TVs não precisam de nada.

## 2026-10-09 · servidor + app + ginasio + portal · 07/10d — diagnóstico da sala, nota da aula, "o seu mês", demo fixo

**O que mudou**
- **TV — diagnóstico da sala (secreto):** na tela do QR, LB+RB por 2 s abre o painel (B fecha; teclado Ctrl+Shift+D). Mostra cada bike pareada (sinal em dBm, pacotes/s, "sem sinal há X"), cada celular com o atraso até o servidor e a internet da TV. Com o painel aberto, o START não começa a aula. Não conflita com L1+R1 (menu inicial) nem com LB+RB 5 s (modo espaço, na aula).
- **Servidor:** mensagem WebSocket `diag_pedir` (só a TV dona da sala): o servidor mede o ping de cada celular e responde `diag` com nome, bike e ms.
- **TV — alunos demo:** ligar/desligar fica salvo (`localStorage pr_demo`); a TV reabre com o demo como estava e os alunos demo voltam sozinhos na tela do QR.
- **Nota da aula:** quando o professor encerra, o app pergunta "Como foi a aula?" (1 a 5 estrelas, anônimo para o professor). `POST /aluno/nota`, tabela nova `aulas_notas` (uma nota por aluno por aula). Portal → Ocupação → "Nota das aulas": média, distribuição, por professor (o da grade naquele horário) e por horário. `GET /gestor/notas`.
- **E-mail "O seu mês":** dia 1º, para cada aluno que pedalou no mês: aulas, horas, kcal, potência média, dias pedalados (calendário) e comparação com o mês anterior. Ligado por padrão; o gestor desliga/edita no Portal → E-mails.
- **Admin → Licenças:** "atualizar agora" funciona mesmo com a atualização automática desligada; textos mais claros ("atualização automática (2h–5h)").

**Por quê**
- Pedidos do Mario de 09/10: ver o sinal de bikes e celulares sem TeamViewer, demo que não some, opinião dos alunos por professor/horário e um e-mail mensal que traz o aluno de volta.

**Como confirmar**
- Grupo novo `notas` (notas, Portal, app, e-mail do mês, desligar) e `tv` (diagnóstico com controle simulado, demo salvo) — **31 grupos**.

**Cuidados**
- Migração automática (`aulas_notas`). O servidor de teste expõe `/_teste/rotina-emails` só com `EMAIL_ROTINA_TESTE=1` (não existe no Railway).

## 2026-10-07 · servidor + app + ginasio + portal · 07/10c — e-mails novos, relatório da aula, Keiser sem nome

**O que mudou**
- **E-mails do aluno no modelo novo** (estilo da arte do Mario):
  - foto no topo, nome do aluno em destaque, cartões de números e rodapé "Ride with purpose";
  - feito só com tabelas e estilos inline (Gmail, Outlook, Apple Mail, celular); sem as fotos continua legível;
  - imagens novas: `img/email-hero.jpg` e `img/email-logo.png` (servidas pelo `PORTAL_URL`);
  - vale para todos os e-mails que usam `emailMontar` (boas-vindas do aluno, resumo, sumido, novo FTP, aniversário, relatório do mês, lembrete, vaga). Os e-mails de sistema (senha, Saúde, teste) seguem no modelo antigo.
  - **os 10 com a mesma cara:** título com o nome do aluno em destaque, um selo ou cartões próprios de cada tipo (passos no boas-vindas, dias sumido, bolo no aniversário, horário no lembrete, nº da bike na vaga, FTP antes/agora) e o texto de fechamento numa caixa de recado (`EMAIL_RECADO`), com botão "Abrir o app".
  - textos padrão revistos (nome no título de todos). Academias que escreveram textos próprios continuam com os delas.
- **Resumo da aula:**
  - 6 cartões (duração, kcal, potência, rpm, zona, pontos);
  - gráfico da potência minuto a minuto, com as barras na cor da zona (FTP do aluno) e a régua Z1–Z6.
  - O app manda `serie_min` em `POST /aula/complete` (até 240 valores, limpos no servidor).
  - Sem a série (app antigo) ou sem FTP: barra com o tempo em cada zona.
- **E-mails novos:**
  - `conquista_camisa`: quando um campeonato é encerrado, para quem levou cada camisa;
  - `desafio_concluido`: 21 dias ou Quebra FTP, com o próximo desafio sugerido.
  - Os dois vêm ligados, com textos editáveis no Portal da academia (E-mails automáticos). A prévia do Portal se ajusta à altura do e-mail.
- **Relatório da aula** (TV → Saúde):
  - por bike: pacotes, falhas acima de 2 s, maior falha, sinal, sumiu no fim;
  - por aluno: quedas, tempo fora;
  - da TV: quedas do servidor, quadros por segundo mínimos, memória máxima.
  - Fica gravado em `aulas_tv.relatorio` (JSONB); a aula fica amarela na linha do tempo da Saúde quando houve problema.
- **Lista de espera:** aula lotou enquanto o aluno escolhia a bike → `409 { lotada: true }` e o app põe o aluno na fila (antes ficava parado em "Aula lotada").
- **Saúde:** mostra se a TV tem o atualizador automático ("⟳ atualizador pronto / sem atualizador").
- **Backup da madrugada não derruba mais as TVs:** no teste de 10 h as 3 TVs caíram juntas entre 02:00 e 02:04, hora do backup automático. Agora o backup lê em lotes de 200 com pausa entre eles, espera se houver aula ao vivo (até o último ter 30 h) e o log mostra a maior travada do servidor (`[Backup] … maior travada do servidor X ms`).
- **TV (fim da aula):** aula de 1 h ou mais (ex.: 10:00:00) não passa mais para fora do anel da duração nem da coluna "tempo em cada zona"; na TV 2560×1440 o botão "REPETIR AULA" não cobre mais o pódio.
- **TV (desafio automático):** quando um desafio começa, o resultado do anterior fecha (antes, dois desafios a menos de 30 s um do outro: o resultado do 1º cobria o 2º).
- **Bateria no Windows:** `testes/saida.js` guarda o código que o teste pediu; se o Node 24 quebrar só ao fechar (libuv `UV_HANDLE_CLOSING`), o `rodar.js` conta como passou. Falha de verdade continua ❌.
- **App (Keiser):** o Android não entrega o nome da Keiser. Agora a lista aceita a Keiser pelos dados do fabricante e mostra "Keiser M3 nº X" (antes: "Aparelho / longe").

**Por quê**
- Mario pediu o e-mail de fim de aula, conquistas e desafios no padrão da arte dele.
- Na academia, a lista do celular mostrava "Aparelho / longe" para as Keiser.

**Como confirmar**
- `SO=emails node testes/rodar.js` (novo, 34 verificações); `SO=aula15,keiser` (relatório e Keiser sem nome).
- Portal da academia → E-mails automáticos → prévia de cada tipo.
- Console do app: `[ProRider Aluno] BUILD 07/10c`.

**Cuidados**
- Migração automática: `aulas_tv.relatorio`.
- As imagens novas do e-mail precisam estar publicadas em `/img` (vão na pasta do site do pacote).

---

## 2026-10-07 · ginasio · 07/10b — pendrive ANT+ na TV

**O que mudou**
- **`gin/antplus.js` (novo):** leitor do pendrive ANT+ (Garmin/Dynastream USB-m, USB2 e compatíveis, fabricante 0x0FCF).
  - Funciona pela **Web Serial**, quando o Windows mostra o pendrive como porta COM, igual ao BLED112, ou pela **WebUSB** (driver WinUSB).
  - Põe o pendrive em **escuta contínua** na rede ANT+, com o nº e o tipo de cada aparelho em cada pacote, e escuta **todas as bikes da sala ao mesmo tempo**.
- **Perfis lidos:**
  - FE-C (bikes e rolos): página 0x19, página 0x15 e FC da página 0x10;
  - Potência: página 0x10;
  - Cadência e Vel+Cad: pelas voltas do pedivela;
  - FC: a cinta é lida, mas não entra na lista de bikes.
- **Pareamento:** botão **ANT+** na tela de pareamento; gira-se o pedal e escolhe-se na lista ("ANT+ FE-C 12345 · 230 W · 85 rpm"). A bike pareada entra no mesmo caminho da Keiser (`_prProcessDevice`): cartões, %FTP com o FTP do aluno, repasse aos celulares e resumo.
- **Ao abrir:** com bikes ANT+ pareadas, a TV liga o pendrive sozinha, sem pedir nada, e religa se ele desconectar.
- **`_processDevice`** saiu de dentro do BLED112 e virou `_prProcessDevice`, a mesma entrada para os dois dongles. Os dados ANT+ não contam como "sinal" do BLED112.

**Por quê**
- Schwinn Echelon2/MPower, Spinner Blade ION, ICG/Life Fitness TFT 1.0 e Technogym Skillbike só mandam potência por ANT+, e o celular não lê ANT+.

**Como confirmar**
- `testes/antplus.test.js` (pendrive ANT+ simulado no protocolo ANT):
  - comandos de preparo com a chave ANT+ e a conferência XOR;
  - páginas lidas;
  - lista sem a cinta e sem pacote estragado;
  - pareamento de 2 bikes;
  - cartões, aluno com o FTP dele e repasse ao celular;
  - religar sozinho depois de reabrir.
- **29 grupos** na bateria.

**Cuidados**
- Arquivo novo **`antplus.js`** no zip do Ginásio. O `.bat` e o `conferir_pacote.py` já exigem esse arquivo.
- **Programa da TV (`main.js`):** o seletor de porta serial precisa aceitar o pendrive ANT+ (fabricante 0x0FCF) além do BLED112. Para WebUSB, liberar o fabricante 0x0FCF (veja `MENSAGEM_DESENVOLVEDOR_07-10b.md`).

## 2026-10-07 · servidor + ginasio + app + admin · 07/10a — atualização automática das TVs e Keiser direto no celular

**Atualização automática das TVs pelo servidor (sem pendrive e sem TeamViewer)**
- **Módulo do programa da TV:** `atualizador-tv/atualizador-tv.js` e `preload-atualizador.js`. É instalado uma vez no `main.js`; veja o `atualizador-tv/LEIA-ME.md`.
  - Baixa só de `app.prorider.app.br` e confere a assinatura Ed25519 da ProRider e o SHA-256.
  - Recusa arquivo com pasta (`../`).
  - Grava em `<dados do app>/versoes/<versão>` e guarda a anterior.
  - A versão nova precisa se confirmar. Se não confirmar em 3 min, ou se fechar 2 vezes sem confirmar, volta sozinha.
- **Ferramentas:**
  - `ferramentas/chaves-atualizacao-tv.js`: cria o par de chaves, só fora do projeto, e nunca sobrescreve uma chave existente.
  - `ferramentas/montar-atualizacao-tv.js`: monta e assina `public/ginasio/atualizacao/` (manifesto + `.prpack`, ~580 KB).
- **Servidor:**
  - `GET /display/atualizacao`: só para a academia com a atualização ligada, se a versão da TV for outra e se o manifesto for da `GINASIO_VERSAO`.
  - `POST /display/atualizacao/status` e `POST /admin/licencas/:codigo/tv-atualizacao` (ligar/desligar e "atualizar agora").
  - Colunas `licencas.tv_auto_atualizar` e `tv_atualizar_agora`, e `licenca_computadores.atualizacao`.
- **Ginásio:**
  - pergunta a cada 10 min;
  - instala só na tela de espera (sem aula), das 02:00 às 05:00 no relógio da TV, ou na hora com "atualizar agora";
  - confirma a versão nova em 60 s;
  - avisa "programa sem atualizador" quando o programa ainda não tem o módulo.
- **Admin:**
  - Licenças: "⟳ auto ligada/desligada" e "atualizar agora";
  - Saúde → TVs: o que aconteceu na última atualização;
  - aviso no topo quando falha ou volta à anterior.

**Keiser direto no celular (app das lojas)**
- O app lê o **anúncio oficial da Keiser** (dev.keiser.com/mseries/direct) pelo plugin nativo, sem conectar, porque a Keiser M3 não aceita conexão. Em vários pontos, o código antigo tentava conectar.
- **Na aula da academia:**
  - a TV manda o **nº da Keiser** de cada bike da sala (`sala_info.keiser`);
  - o celular ouve a própria bike e o ponteiro usa esse número na hora, com o FTP do aluno;
  - sem anúncio por 2,5 s, volta ao número da TV.
- **Em casa:** a lista mostra **"Keiser M3 nº 7"**, uma linha por bike.
- **Resumo da Keiser** ("review", o console mostrando a média depois que o aluno parou): agora é **ignorado no app e na TV**. Antes podia aparecer como watts ao vivo.
- **Lista de bikes:** nomes novos (PM5, Spinner, Precor, BH, Stages IC, IC5–IC8, CXP, Group Cycle).
- **`MARCAS_BLUETOOTH.md` refeito,** com a pesquisa marca por marca e as fontes:
  - como cada bike se identifica;
  - quantos aparelhos leem ao mesmo tempo;
  - quais são só ANT+;
  - como testar com o nRF Connect.

**Como confirmar**
- `testes/autoatualiza.test.js` e `testes/keiser.test.js` (novos).
- `testes/aula15.test.js`: a TV ignora o resumo da Keiser.
- **28 grupos** na bateria.

**Cuidados**
- **A chave privada da atualização** nunca vai para o GitHub, o servidor ou o chat.
- **Os pacotes de teste** são apagados pelo próprio teste.
- **A 1ª instalação do atualizador** ainda é pelo `.bat`, a última do jeito antigo.

## 2026-10-07 · servidor + app + ginasio · 03/10z — internet ruim no celular e internet da academia caindo

**Testes novos (com uma "rede de mentira", `testes/rede.js`: lenta, engasgando, sumindo sem aviso, caindo)**
- **`redecel`:** 3 celulares de verdade com a TV de verdade, cada um numa rede:
  - aluno 1 em 3G (300–600 ms): o número novo chega em ~0,7 s;
  - aluno 2 em rede péssima (1–1,5 s): o número novo chega em ~1,7 s, e ele volta depois de uma queda de 10 s;
  - aluno 3 com engasgos de 6 s e com a internet sumindo por 20 s e por 70 s: continua na aula e volta sozinho.
- **`redetv`:** a internet da academia some sem aviso por 60 s e por 4 min, com os celulares no 4G. Depois, a aula termina com a TV ainda sem internet.

**Falhas encontradas e corrigidas**
1. **Aluno fantasma e números zerados (Ginásio).**
   - **Antes:** quando o celular do aluno caía, a TV tirava o aluno. A bike dele, que continuava sendo pedalada, virava "Aluno 03": aparecia um aluno a mais no ranking e no resumo (resumo com 5 em vez de 3), e as calorias e a distância do aluno de verdade recomeçavam do zero.
   - **Agora:** com a aula rodando, o aluno fica na bike e o dongle continua somando para ele.
2. **Internet lenta (app).** A nova tentativa de 4 em 4 s criava uma segunda conexão enquanto a primeira ainda abria, e dava erro de JavaScript. Agora o app espera a tentativa em andamento por até 10 s, e cada conexão só fala por ela mesma.
3. **Internet da academia caindo por mais de 3 min (servidor).** O servidor apagava a sala depois de 3 min sem a TV e **expulsava os alunos**. Com a aula rodando, agora o servidor espera 20 min (`CARENCIA_AULA_S`).
4. **A TV demorava a perceber a internet sumida (Ginásio).**
   - Batimento de 5 em 5 s. Sem resposta do servidor em 15 s, a TV religa sozinha.
   - Conexão que não abre em 10 s conta como falha.
5. **O fim da aula se perdia quando a aula terminava sem internet (Ginásio).**
   - O fim fica pendente até um batimento confirmar que chegou.
   - Se a TV sair da tela da aula, uma conexão curta tenta entregar o fim de 10 em 10 s por até 30 min.
   - O resumo já ficava guardado (03/10f) e chega com os 3 alunos.
6. **Aviso no celular (app + servidor).**
   - Com a aula rodando e a TV calada há mais de 15 s, o servidor manda `tv_sem_sinal` e o app mostra a faixa "📡 A TV da academia está sem internet. A aula continua na TV…".
   - Quando a TV volta, o servidor manda `tv_voltou` e a faixa some.
   - TVs antigas (sem o batimento de 5 s) só disparam o aviso depois de 40 s.

**Como confirmar**
- Bateria com **26 grupos**, "TUDO OK".

**Cuidados**
- **TVs:** instalar a **03/10z**, porque o Ginásio mudou (`GINASIO_VERSAO` = 03/10z).
- Se o Ginásio for fechado à força no meio da aula, os celulares ficam com o aviso "TV sem internet" até 20 min e depois a aula é encerrada. O aluno pode sair antes, pelo botão.

## 2026-10-07 · servidor + admin · 03/10y — "aulas ao vivo agora" (não atualizar o servidor no meio da aula)

**O que mudou**
- **Admin → Saúde, no topo:** uma faixa **vermelha**, "🔴 N aula(s) ao vivo agora — NÃO atualize o servidor agora", com academia, aula, alunos, minutos de aula e situação (rodando / pausada / TV religando). Sem aula, a faixa fica **verde**: "pode atualizar o servidor".
- **`GET /status/ao-vivo`** (público, sem nomes): `{aulas, alunos, pode_atualizar}`. Serve para o desenvolvedor conferir antes do deploy, ou para um script de deploy.
- **O que conta como ao vivo:** a TV mandou o andamento da aula (`update_aula`, 1x/s) nos últimos 10 min e não encerrou. Sala aberta sem START não conta.
- **`GINASIO_VERSAO` no servidor:** é a versão do Ginásio que o servidor espera, separada da versão do servidor.
  - Pacote só de servidor e site **não obriga a reinstalar as TVs**: elas continuam na **03/10x** sem ⚠ na Saúde.
  - O `conferir_pacote.py` e o `testes/versao.test.js` conferem que o `GINASIO_VERSAO` é igual ao `PR_BUILD` do Ginásio do pacote.

**Por quê**
- O teste `queda` mostrou que um deploy no meio da aula derrubava os alunos. Isso já foi corrigido na 03/10x, mas o melhor é não atualizar com aula rodando.

**Como confirmar**
- `testes/aovivo.test.js`:
  - sem aula, "pode atualizar";
  - aula rodando, 1 aula com 2 alunos, com a faixa vermelha na tela do Admin;
  - a rota pública não mostra academia nem sala;
  - depois do fim da aula, volta a "pode atualizar".
- Bateria com 24 grupos.

**Cuidados**
- Depois de um reinício do servidor, a aula volta a contar assim que a TV religa (em até ~5 s).

## 2026-10-07 · servidor + app + ginasio + admin + testes · 03/10x — ensaio do dia 17/10, carga, servidor caindo no meio da aula e aula longa

**Ensaio da aula de 17/10 (`testes/aula15.test.js`)**
- Roda a TV de verdade com **15 bikes Keiser no dongle** (simulado na mesma entrada do BLED112) e **15 celulares pelo servidor**, cada um com um FTP diferente.
- Confere, para os 15:
  - o watt do dongle mais o FTP do celular dá o %FTP e a zona certos na TV;
  - cada celular recebe a intensidade da **sua** bike.
- Mede:
  - o atraso dongle → TV → servidor → celular: **cerca de 0,3 s**;
  - o esforço da TV: **~34% de um núcleo**.
- Também confere:
  - os 15 cartões sem corte;
  - o fim da aula nos 15 celulares;
  - o resumo com 15 alunos.

**Carga (`testes/carga.test.js` + `ferramentas/teste-carga.js`)**
- A ferramenta assina o token de TV com o `JWT_SECRET` do servidor testado (`CARGA_JWT_SECRET`), porque desde a 03/10w só a TV ativada abre sala.
- Usa o mesmo formato de `bikes_live` do Ginásio.
- Recusa rodar contra `app.prorider.app.br`.
- Resultados no servidor local:
  - **3 academias × 15 bikes:** 100% entregue, p95 4 ms;
  - **30 academias × 20 bikes** (630 conexões): 100% entregue, p95 5 ms, nenhuma queda.

**Servidor caindo no meio da aula (`testes/queda.test.js`) — falha encontrada e corrigida**
- **O que acontecia:** quando o servidor reiniciava (deploy, travamento, Railway), o celular voltava antes da TV recriar a sala. O servidor respondia "Sala não encontrada" e o app **encerrava a aula do aluno** (ia para o resultado).
- **App:** em plena aula, "sala não encontrada" agora significa "esperar a TV voltar". O app tenta de novo de 4 em 4 s por até 90 s, com o aviso "Esperando a TV da academia voltar…". Só depois disso encerra.
- **Ginásio:** durante a aula, tenta religar de 5 em 5 s, não mais 3 → 6 → 12 → 30 s.
- **O teste:**
  - sobe um servidor só dele (porta 4011);
  - abre a TV e 3 celulares de verdade;
  - **mata o servidor** no meio da aula e sobe de novo.
- **Confere:**
  - a TV religa;
  - os celulares voltam para a mesma bike, sem sair da aula;
  - a intensidade continua certa;
  - o relógio da aula não para;
  - o fim chega a todos;
  - o resumo é salvo com os 3.
- Passa com 8 s e com 40 s de servidor fora.

**Saúde da TV (para a aula longa e para achar vazamento)**
- **O Ginásio manda a cada minuto** (`POST /display/saude`):
  - a memória do JavaScript;
  - os nós da tela e os quadros por segundo;
  - o tempo ligada e o tempo de aula;
  - os alunos, as quedas de conexão e os erros.
- **O que fica guardado:**
  - o último valor em `licenca_computadores.saude`;
  - um histórico de 3 dias em `tv_saude` (1 ponto a cada 5 min).
- **Admin → Saúde → TVs:**
  - coluna "Saúde da TV", com quanto a memória subiu na última hora;
  - link "histórico", com o gráfico da memória;
  - aviso quando a memória sobe mais de 150 MB/h ou passa de 80% do limite.
- Ver `GET /admin/tv-saude?lic=&dev=`.

**Aula longa (`testes/longo.test.js`)**
- Roda a TV com 15 bikes e 15 celulares, com blocos de 30 s.
- A cada 30 s força a coleta de lixo e mede a memória e os nós da tela.
- **Ensaio de 20 min:** 40 trocas de bloco, memória estável (tendência −0,1 MB/h), nós da tela estáveis e nenhum erro.
- Na bateria, roda 4 min (`LONGO_MIN`).
- **Para o Mario em casa:** aula `TESTE_10_HORAS.json` (10 h, 124 blocos), com o roteiro em `TESTE_10_HORAS.md`.

**Dependências**
- **Servidor:** `npm audit` sem nenhuma vulnerabilidade (express 5, ws 8, pg 8, jsonwebtoken 9, bcryptjs 3).
- **`app-lojas`:**
  - o que vai dentro do app: 0 vulnerabilidades;
  - as 7 apontadas são só de ferramentas de build do desenvolvedor (`@capacitor/cli`, `@capacitor/assets`: tar, sharp, uuid) e não vão para o celular;
  - o `package-lock.json` foi acertado com o `package.json`, porque android e ios estavam como dev no lock e o `npm ci` podia reclamar.

**Como confirmar**
- `node testes/rodar.js`: **23 grupos, "TUDO OK"**.
- Admin → Saúde → TVs: a coluna "Saúde da TV" é preenchida 15 s depois que a TV 03/10x abre.

**Cuidados**
- **Ordem:** servidor primeiro, depois as TVs, como sempre. A TV 03/10x num servidor antigo só perde a saúde (o servidor responde 404 e ela ignora).
- **Para números de memória exatos no Electron:** no `main.js` do programa da TV, `app.commandLine.appendSwitch('enable-precise-memory-info')`. É opcional: sem isso a memória vem arredondada, mas a tendência de horas aparece igual.

## 2026-10-07 · servidor + app + portal + ginasio · 03/10w — revisão de segurança, números sem simulação e imagens das lojas

**Segurança (revisão antes do lançamento; cada item tem teste em `testes/invasao.test.js`)**
- **Crítico — gestor/coordenador trocava a senha de qualquer conta,** inclusive do super admin (o coordenador passava sem conferir a academia). Agora `_podeMexer`:
  - só a própria academia;
  - nunca admin;
  - na equipe, só o gestor.

  Vale para `GET/PUT /gestor/alunos/:id` e para o reset de senha. O `temAcessoLicenca` não libera mais um gestor sem academia.
- **Crítico — qualquer um ativava a TV de qualquer academia** com o código da licença, que é público e aparece na página da academia. Isso derrubava a TV verdadeira e dava acesso a dados da academia.
  - Agora existe o **código da TV** (`licencas.codigo_tv`, 8 caracteres, secreto), que aparece no Admin → Licenças e no "Meu perfil" do gestor.
  - TV já ativada continua ativada.
- **Crítico — a sala ao vivo podia ser tomada por qualquer um:**
  - `criar_sala` exige o token da TV, e a sala fica presa à academia;
  - mensagens de professor (fim de aula, gráfico, desafio etc.) só são aceitas da TV;
  - o aluno é identificado pelo token dele, não por um `user_id` mandado pelo app;
  - ninguém derruba um aluno logado usando o mesmo nome.
- **Crítico — rotas antigas `/license/*` deixavam o aluno virar professor sozinho:** removidas, junto com `/onboarding/lic/*`, que dependiam da tabela `licenses`, que não existe mais.
- **Alto:**
  - o link de cadastro da academia trocava senha e papel de uma conta que já existia; agora recusa;
  - o gestor se dava acesso a outra academia (`/gestor/professores` com `license_id`);
  - o totem mostrava e reservava aluno de qualquer academia; agora só da própria, com limite de tentativas.
- **Médio:**
  - rankings abertos mostram só o primeiro nome + a inicial;
  - o gestor não puxa aluno de outra academia para a equipe;
  - walk-in e "zerar conexões" só na própria academia;
  - o duelo entre academias só aceita token de TV;
  - o e-mail de teste só vai para o próprio gestor;
  - a conta padrão `gestor001@prorider.com` (senha no código) não é mais criada e, se existir com a senha antiga, a senha vira aleatória;
  - o app não tem mais a senha fixa "1234" para o Construtor, que é aberto a todos.

**App: sem número inventado**
- Sem bike nem TV mandando dados, o app mostrava RPM, watts e %FTP simulados (o "83 RPM"), uma FC calculada pelo %FTP e uma distância fictícia, e isso ia para o resultado. Agora mostra "—" e não conta nada; médias, máximo e zonas vêm só do que foi medido.
- Corrigido o %FTP da bike por Bluetooth, que usava 150 W fixos em vez do FTP do aluno.
- Etiqueta "ERG" fora de cima da barra de números. "SEATE" (cortado) virou "SENTADO" / "EM PÉ".

**Imagens das lojas (`6_APPS_DAS_LOJAS/imagens-das-lojas/`)**
- 6 telas para o Google (1080×1920) e para o iPhone 6,9" (1290×2796) e 6,5" (1242×2688), feitas das telas reais do app e da TV, mais a imagem de destaque do Google (1024×500).

**Testes:** novos `invasao.test.js` e `semdado.test.js`. 20 grupos no total.

**Cuidados**
- **Para ativar uma TV nova ou reativar uma TV:** use o **código da TV** (Admin → Licenças, "TV: XXXXXXXX"). O código da licença não serve mais.
- Os rankings abertos (sem login) passam a mostrar "Marina S." em vez do nome completo.

---

## 2026-10-07 · ginasio + servidor + admin · 03/10v — versão errada nas TVs não passa mais despercebida

**O que aconteceu**
- As 3 TVs foram "atualizadas", mas continuaram na **03/10n**. O programa foi gerado com os arquivos antigos. A causa provável é o "Extrair tudo" do Windows, que cria uma subpasta com o nome do zip, e assim o `app\` continuou com os arquivos velhos.

**O que mudou**
- **`GERAR_PROGRAMA_DA_TV.bat`** (no zip do Ginásio, fica em `app\`). Antes de rodar o `npm run dist`, ele confere:
  - que está em `...\Executavel\app\`, ao lado do `package.json`;
  - que não sobrou a subpasta `ProRider_1_GINASIO_*`;
  - que o `script.js` é da versão do pacote;
  - que os arquivos principais existem.

  Se algo estiver errado, mostra [ERRO] com a correção e não gera nada. Se estiver tudo certo, move os `.exe` antigos para `dist\antigos` e mostra o programa novo.
- **Saúde do sistema:** TV vista nos últimos 14 dias com BUILD diferente do servidor gera:
  - um **aviso no topo**;
  - **⚠ em laranja** na tabela de TVs;
  - **amarelo** no semáforo da academia, com o motivo.

  Some sozinho quando a TV é atualizada. A regra: a TV certa tem o mesmo número do servidor, porque o pacote sobe os dois juntos.
- `conferir_pacote.py` exige o `.bat` no zip com a versão do pacote e com quebras de linha do Windows.
- Teste novo `testes/versao.test.js`. 17 grupos de teste no total.

**Como confirmar**
- Rodar o `.bat` com o zip extraído numa subpasta → [ERRO].
- Rodar o `.bat` com tudo certo → gera e mostra o `.exe`.
- Na Saúde: TV antiga em ⚠ laranja; depois de instalada, BUILD 03/10v sem aviso.

---

## 2026-10-06 · app + apps das lojas · 03/10u — Bluetooth nativo e projeto dos apps (Android e iPhone)

**O que mudou**
- **Projeto `app-lojas/` (Capacitor 8):** o app instalado abre o app do aluno do servidor (`server.url`) com o **Bluetooth nativo** (`@capacitor-community/bluetooth-le`). Ele já tem:
  - permissões (Android e iOS) e textos em português;
  - ícone e abertura com o raio do logo;
  - página "sem internet".
  - Como gerar: `app-lojas/LEIA-ME.md`.
- **Ponte "BLUETOOTH NO APP DAS LOJAS" no `aluno.html`:** no app instalado, cria um `navigator.bluetooth` igual ao do Chrome por cima do plugin nativo, com a lista própria de aparelhos e o mesmo filtro do Chrome. No navegador comum não faz nada.
  - Com isso, o **iPhone não precisa mais do Bluefy** quando o app estiver na App Store.
- **Teste novo `testes/blenativo.test.js`:** o app com um plugin nativo simulado (rolo FTMS com controle e cinta). Confere:
  - a lista só com as bikes;
  - conectar e receber os números;
  - a carga automática chegando ao rolo;
  - a cinta;
  - cancelar e a queda com reconexão.
- `APPS_NAS_LOJAS.md`: contas, custos, passo a passo, textos da loja, formulários de privacidade e a decisão sobre compras dentro do app.
- 16 grupos de teste.

**Como confirmar**
- `node testes/rodar.js` → 16 grupos, "TUDO OK".
- No navegador, o app continua igual. A ponte só liga dentro do app instalado.

**Cuidados**
- Antes de publicar: decisão do Mario sobre compras de bens digitais dentro do app.
- Depois de publicar: trocar os links do QR da TV ("Ainda não tem o app?") para os das lojas.

---

## 2026-10-06 · servidor + testes · 03/10t — horário de Brasília no banco e teste das telas do Portal e do app

**O que mudou**
- **Horário de Brasília em toda conexão com o banco** (`SET TIME ZONE 'America/Sao_Paulo'` ao conectar). O banco do Railway fica em UTC, e isso causava dois erros:
  - **Depois das 21h, "hoje" já era amanhã.** A reserva da aula da noite sumia de "Minhas reservas" e do destaque "Você reservou a bike". O mesmo acontecia com a contagem de reservas de hoje, o "ausente" automático 10 min depois do início e a lista de espera.
  - **A conta dos minutos até a próxima aula** (`/display/proxima-aula`, `/gestor/proxima-aula`, `/sessao/status`) **errava em horas o dia todo.** Exemplo: aula às 23h, consultada às 22h20, dava 1299 min em vez de 39. Essa conta alimenta a contagem, a janela do QR e o início automático.
- Dia da semana de Brasília (não do servidor UTC) nas mesmas rotas e no relatório do mês.
- **Faturas pagas no cartão** mostram a data do pagamento (`confirmedDate`). Antes ficava "—" até o dinheiro cair, uns 30 dias depois.
- **Teste novo `testes/portal.test.js`**, num navegador de verdade:
  - **Gestor:** aceita os termos e cria uma aula na grade.
  - **Financeiro:** aceita os termos e paga (Asaas simulado + webhook); a página fica "Em dia".
  - **Admin:** a academia aparece na Saúde e na lista "em dia".
  - **Aluno:** cria a conta (sem os termos não cria), reserva a bike 5 na grade e entra na aula pelo código. A escolha da bike mostra a reserva, e a reserva vira presença. Depois a aula começa e termina pela "TV".
  - Nenhum erro de JavaScript. As fotos de cada tela ficam numa pasta.
- **Teste novo `testes/fuso.test.js`:** minutos até a próxima aula e reservas de hoje, a qualquer hora.
- 15 grupos de teste no total.

**Como confirmar**
- `node testes/rodar.js` → 15 grupos, "TUDO OK".
- Depois das 21h, uma reserva para a aula da noite continua em "Minhas reservas".

**Cuidados**
- Datas e horas que o banco devolve como texto (`to_char`, `::date`) passam a sair no horário de Brasília, que é o certo. Os horários gravados não mudam.
- TV: a 03/10t é igual à 03/10s; quem já instalou a s não precisa reinstalar.

---

## 2026-10-06 · testes + ginasio + app · 03/10s — teste automático das telas da TV e carga automática (ERG)

**O que mudou**
- **Teste das telas da TV (`testes/tv.test.js`)**: a cada pacote, o Ginásio abre num navegador de verdade contra o servidor de teste e passa por uma aula inteira:
  - tela de espera com a grade do dia, menu com a versão;
  - tela do QR (código, QR, sala aberta, nunca volta sozinha para a espera);
  - aluno entra pelo "celular" (WebSocket real), START, números chegando, cartões e ranking;
  - fim da aula (celular recebe o fim, resumo gravado no banco) e volta ao início;
  - TV parada no menu volta para a espera;
  - cartões de 1 a 30 alunos com números de 3 dígitos e nomes longos: nada cortado;
  - nenhum erro de JavaScript, nenhuma queda falsa e nenhum aviso falso na Saúde.
  - Fotos de cada tela ficam numa pasta mostrada no fim do teste.
- **Teste do ERG (`testes/erg.test.js`)**: o app de verdade com um "rolo de mentira" que guarda os comandos.
- **Correções na TV que o teste novo achou:**
  - **Fim de aula contava como queda do servidor.** A TV fecha a conexão de propósito no fim da aula (e ao abrir), mas o aviso de queda disparava mesmo assim, e a próxima conexão mandava "A TV perdeu a conexão com o servidor e religou sozinha" para a Saúde. Isso acontecia **depois de toda aula**. Agora conexão fechada de propósito não conta.
  - **Resumo da aula ia sem o código da sala** (a sala já tinha sido fechada). Agora vai o código guardado no START.
  - **Cartões com poucos alunos cortavam o número:** com 1 a 6 alunos, "100%" e o nome da zona saíam cortados. O tamanho agora é o menor entre o de antes e o que cabe no cartão.
  - O nome do aluno passava por baixo do "BIKE 3". Agora tem espaço reservado.
- **Carga automática (ERG) no app**: rolos e bikes com FTMS e controle recebem a potência-alvo de cada bloco (FTP × meio da faixa de %FTP). Detalhes em `MARCAS_BLUETOOTH.md`.
  - Liga e desliga na tela de conectar e começa desligada.
  - Na aula, a etiqueta "ERG 196 W" solta o rolo com um toque.
  - Pausa solta; ao retomar, volta.
  - Vale na aula do app, na aula ao vivo e na aula gravada.
- `testes/rodar.js`:
  - grupos `erg` e `tv`;
  - `SO=tv` roda só um grupo;
  - grupo pulado (sem Playwright) aparece com ⚠ e não reprova.
- **Pasta `ginasio/` na raiz do repositório:** os 12 arquivos do Ginásio, usados pelo teste da TV. A TV continua sendo instalada pelo zip.

**Por quê**
- Pegar erro de tela antes de chegar na academia (pedido do Mario), e rolo inteligente seguindo a aula sozinho.

**Como confirmar**
- `node testes/rodar.js` → 13 grupos, "TUDO OK".
- Na Saúde, depois de uma aula real, **não aparece** mais "A TV perdeu a conexão…".

**Cuidados**
- O teste da TV e o do ERG precisam do Playwright: `npm i -D playwright && npx playwright install chromium`, uma vez.
- ERG: confirmar com cada rolo real no 1º uso.

---

## 2026-10-06 · servidor + app + portal + ginasio · 03/10r — domínio próprio app.prorider.app.br

**O que mudou**
- O sistema passa a usar o endereço **https://app.prorider.app.br** (domínio do Mario no Registro.br, apontado para o prorider-server no Railway: CNAME `app` → `416c6tdi.up.railway.app` + TXT `_railway-verify.app`; validado em 06/10).
- **O endereço antigo `prorider-server-production-5784.up.railway.app` continua funcionando** (é o mesmo servidor). Nada é desligado.
- **Portal, Construtor e app do aluno:** usam o endereço por onde foram abertos (`location.origin`). Quem abrir pelo antigo continua no antigo; quem abrir pelo novo fica no novo. Fora do servidor (arquivo local), usam o novo.
- **Ginásio (TV):** fala com `https://app.prorider.app.br` / `wss://app.prorider.app.br`. O QR da tela e o link do APK também usam o novo.
- **Servidor:** links dos e-mails (`PORTAL_URL`) por padrão no novo endereço.
- **Corrigido:** o link de "compartilhar aula" (`/aula/share`) saía de um endereço que não existe (`prorider-server-production.up.railway.app`, sem o 5784). Agora sai do `PORTAL_URL`.
- Teste novo `testes/dominio.test.js` (11 grupos no total).

**Por quê**
- Endereço próprio e fácil de lembrar; se um dia o servidor mudar de lugar, só se troca o DNS.

**Como confirmar**
- `https://app.prorider.app.br/ping` responde igual ao antigo.
- Saúde do sistema: servidor 03/10r; TVs com BUILD 03/10r.

**Cuidados**
- **Railway → Variables:** se existir `PORTAL_URL` com o endereço antigo, trocar para `https://app.prorider.app.br` (ou apagar a variável).
- Login fica guardado por endereço: quem entrar pela primeira vez no novo endereço precisa fazer login uma vez (TV não: o login da TV continua).
- **Dropbox:** adicionar o Redirect URI `https://app.prorider.app.br/studio.html` (sem apagar o antigo).
- **Asaas:** webhook para `https://app.prorider.app.br/...` (mesmo caminho de hoje). **UptimeRobot:** monitor para `https://app.prorider.app.br/ping`.
- **Não apagar** o domínio antigo no Railway nem os registros do Resend no Registro.br.

---

## 2026-10-06 · construtor + ginasio + servidor · 03/10q — Dropbox conectado no Construtor

**O que mudou**
- **Botão "📦 Dropbox" no Construtor**, na trilha de música e no vídeo de fundo:
  - O professor clica em **Conectar Dropbox** uma vez. O login é seguro, sem senha guardada (OAuth com PKCE), e o acesso fica naquele navegador.
  - O Dropbox cria a pasta **Aplicativos/ProRider Cycling** na conta dele. O app "ProRider Cycling" (App key `lngo9p5iaprfa1f`) é do tipo **App folder**, então só enxerga essa pasta.
  - O Construtor lista as músicas (mp3, m4a, wav, aac, ogg) ou os vídeos (mp4, webm, mov), inclusive em subpastas. O professor marca na ordem que quiser, e o link de compartilhamento é criado sozinho. A onda da música é desenhada como num MP3 do computador.
  - O link vai na aula como antes (`trilha[].link` / `video.link`), e a TV baixa antes da aula.
  - O acesso é renovado sozinho; existe o botão Desconectar.
- **Links colados à mão:** o Dropbox agora vira o endereço direto `dl.dropboxusercontent.com`. O `raw=1` às vezes não abria no navegador, e o Construtor tenta os dois. Link de **pasta** (`/scl/fo/`) agora avisa que precisa ser o link de cada música ou o botão Dropbox.
- **Ginásio e servidor** (vídeo da loja) usam o mesmo endereço direto.

**Configuração no Dropbox** (feita pelo Mario em 06/10)
- App **ProRider Cycling**: Scoped access + App folder.
- Permissões: `files.metadata.read`, `files.content.read`, `sharing.write` (e as de leitura automáticas).
- Redirect URI: `https://prorider-server-production-5784.up.railway.app/studio.html`. **Se o Construtor ganhar outro endereço (ex.: prorider.app.br), adicionar lá também.**
- "Allow public clients (PKCE)": Allow. Usuários adicionais liberados (até 500 contas, para os professores testarem). Para mais contas: "Apply for production".

**Como confirmar**
- Teste no navegador com o Dropbox simulado:
  - conectar pela janelinha;
  - listar com subpasta;
  - marcar 2 músicas fora de ordem (respeita a ordem);
  - criar o link (inclusive quando ele já existia);
  - desenhar a onda;
  - salvar a aula com os links;
  - listar os vídeos;
  - renovar o acesso vencido;
  - avisar link de pasta.
  Tudo OK.
- Real: Construtor → 📦 Dropbox → Conectar → pôr um MP3 em Aplicativos/ProRider Cycling → Atualizar → Pôr na trilha.

---

## 2026-10-06 · infraestrutura · monitor externo do servidor (UptimeRobot)

**O que mudou**
- Monitor **"ProRider servidor"** no UptimeRobot (conta grátis do Mario): confere `https://prorider-server-production-5784.up.railway.app/ping` a cada 5 min. Se o servidor não responder, manda e-mail para marioelite@hotmail.com (e notificação no celular, se o app do UptimeRobot estiver instalado).
- Funciona junto com o vigia interno (Saúde do sistema). O vigia não consegue avisar quando o próprio servidor está fora do ar; o UptimeRobot avisa de fora.

**Como confirmar**
- UptimeRobot → Monitoramento → ProRider servidor: "Para cima" (verde). Primeira checagem em 06/10: 95 ms, 100%.

**Cuidados**
- Se o endereço do servidor mudar (domínio próprio, outro serviço), trocar a URL do monitor.
- Não remover a rota `/ping` do servidor.

---

## 2026-10-06 · app + ginasio + servidor · 03/10p — Bikes, rolos e sensores de outras marcas (Bluetooth padrão)

**O que mudou**
- **App, leitura Bluetooth:** funções novas `prFtmsParse`, `prCpsParse` e `prCscParse`, mais `btConnectBike`, que tenta FTMS → Cycling Power → CSC.
  - **Corrigido o FTMS:** o bit 0 ("mais dados") quer dizer que a velocidade vem quando ele é 0, e a velocidade média (bit 1) não era pulada. Em vários rolos (KICKR, Tacx, Elite) a cadência e os watts saíam errados.
  - **Corrigida a cadência dos medidores de potência:** agora vem das voltas do pedivela; antes lia o campo de torque.
  - **Novo:** sensores só de cadência (CSC).
  - **Novo:** FC enviada pela própria bike pelo FTMS (a cinta tem prioridade).
  - **Novo:** filtro por nome das marcas que não anunciam o serviço.
- **Academia:** o app manda 1 vez por segundo `dados_aluno` com `watts`, `rpm` e `fonte:'celular'` (exceto da Keiser). O servidor repassa `fonte`, e a TV calcula %FTP, zona, potência máxima, kcal e km. O dongle tem prioridade. Se o celular parar, os números zeram em 4 s.
- Lista de marcas e padrões em `MARCAS_BLUETOOTH.md`.

**Como confirmar**
- Testes dos parsers com pacotes de cada padrão: OK.
- TV simulada: celular → cartão com os números certos; dongle tem prioridade; celular parou → zera.
- `node testes/rodar.js` → 9 grupos ✅.
- Com o aparelho real: conectar no app (Pedal livre) e conferir watts e cadência.

---

## 2026-10-06 · servidor + app + portal · 03/10o — Termos de uso, Política de privacidade e aceite (LGPD)

**O que mudou**
- Páginas novas **`/termos.html`** e **`/privacidade.html`**, no visual ProRider e legíveis no celular. O texto é provisório até a revisão do advogado.
- **Cadastro (app e Portal):** duas caixas obrigatórias.
  1. "Li e aceito os Termos de uso e a Política de privacidade".
  2. "Autorizo o uso dos meus dados de treino e de saúde…". A frequência cardíaca é dado sensível pela LGPD e precisa de consentimento destacado.
  Sem as duas, o servidor não cria a conta (`/user/register` responde 400 com `termos:true`).
- **Contas que já existem:** no próximo acesso aparece a tela "Antes de continuar" e a pessoa só sai dela aceitando ou saindo da conta. Vale para o app do aluno, o Portal, o portal do aluno e a página do financeiro. O super admin e o modo suporte não são bloqueados.
- **Prova do aceite:** tabela `termos_aceites` (usuário, e-mail, versão, saúde, onde, IP, aparelho, data). Em `users` ficam `termos_versao` e `termos_aceitos_em`.
- **Rotas:** `GET /termos/versao` e `POST /user/termos/aceitar`. O login e o `/user/me` devolvem `termos_pendente`.
- **Versão dos termos:** vem da linha `<meta name="pr-versao" content="2026-10-06">` em `termos.html`.
  - Mudou a data → todo mundo aceita de novo.
  - Só corrigiu um erro de digitação → não mude a data.
- Código compartilhado em `pr-suporte.js`: `prTermosCaixas`, `prTermosLidos`, `prTermosChecar`.
- **Registro de acessos (Marco Civil, art. 15):** tabela `registros_acesso` com usuário, IP, aparelho e hora. Grava 1 linha por pessoa+IP a cada 6 h e também no login e no cadastro. Guarda 6 meses.
- **Auditoria:** tabela `auditoria`. Registra toda rota `/admin` que muda algo, o download de backup e tudo o que é feito no modo suporte (as telas vistas contam 1 vez a cada 10 min). Guarda 1 ano. Admin → Saúde → **Registro de acessos administrativos** (rota `GET /admin/auditoria`).
- **Textos finais:** aptidão física, sigilo da equipe da academia, direitos autorais das músicas, assinaturas e chargeback, serviços de terceiros, transferência para futura empresa, disposições gerais, Bluetooth e câmera, acesso do suporte, revisão de decisões automáticas (art. 20 da LGPD) e prazos de guarda.

**Por quê**
- A LGPD exige isso antes de alunos reais (piloto no Clube).

**Como confirmar**
- `node testes/rodar.js` → 9 grupos ✅ (novo: `termos`).
- No app: "Criar conta" mostra as 2 caixas. Uma conta antiga, ao entrar, vê a tela de aceite.

---

## 2026-10-06 · ginasio · 03/10n — TV parada volta sozinha para a tela de espera

**O que mudou**
- Depois de **10 min sem ninguém mexer**, a TV volta para a tela de espera (logo + aulas de hoje passando embaixo).
- **Causa do problema:** com o controle (joystick) ligado, o Ginásio "zerava" o contador de inatividade a cada quadro, e a TV nunca voltava. Agora só conta quando alguém aperta um botão ou mexe o direcional.
- **Nunca volta sozinha** (`_podeIdle`) com:
  - a aula rodando;
  - a aula pausada no meio;
  - a contagem 3-2-1;
  - a gravação ou transmissão ligada;
  - a sessão livre;
  - a tela do QR, mesmo vazia: o professor deixa a aula preparada 20–30 min antes e sai, e os alunos vão chegando e entrando.
  O menu e a tela de fim de aula voltam normalmente.
- O painel antigo da direita "Grade de hoje" não aparece mais. Sem internet, ele ficava "carregando" por cima do relógio.

**Como confirmar**
- Teste no navegador com um controle simulado: menu parado → tela de espera; apertando botões → fica; QR (com ou sem aluno), aula rodando ou pausada → fica; fim de aula → tela de espera.
- Na TV: deixar no menu, com o controle ligado, por 10 min → aparece a tela de espera.

## 2026-10-06 · servidor + admin · 03/10n — "✓ Resolvido" confere antes de fechar

**O que mudou**
- O botão **"✓ Resolvido"** de cada aviso agora pergunta ao servidor se o problema acabou mesmo antes de fechar:
  - TV desligada / TV caiu na aula: a TV tem que estar falando com o servidor agora;
  - Asaas recusado: nenhum aviso do Asaas recusado na última hora;
  - Conferência com o Asaas: roda a conferência de novo; se ainda achar pagamento sem registro, não fecha;
  - Backup: último backup ok e com menos de 36 h; "Baixe uma cópia": cópia baixada nos últimos 8 dias;
  - Picos de erros, disco e memória: o número de agora tem que estar abaixo do limite.
- Se **não** estiver resolvido, aparece a mensagem "Ainda NÃO está resolvido: …" com o que falta, e o aviso continua aberto. Dá para "fechar mesmo assim" (alarme falso), e fica registrado "fechado mesmo sem resolver por …".

**Por quê**
- Pedido do Mario: o aviso só deve fechar quando o problema foi resolvido de verdade.

**Como confirmar**
- `node testes/rodar.js` → 8 grupos ✅ (vigia parte 5; conferencia parte 1).

---

## 2026-10-06 · servidor + admin · 03/10m — pausar avisos por academia, "✓ Resolvido", contador de e-mails

**O que mudou**
- **Pausar os avisos de uma academia até uma data** (Saúde → clicar na academia → "Pausar os avisos desta academia até…"). Enquanto pausada: o vigia não abre aviso de "TV desligada" nem de "TV caiu na aula" para ela (nem e-mail), os avisos abertos dela fecham na hora, e no semáforo ela fica cinza com "Avisos pausados até dd/mm". Volta sozinha no dia seguinte à data, ou no botão "Retomar avisos agora". Coluna nova `licencas.avisos_pausados_ate`.
- **Botão "✓ Resolvido"** em cada aviso em aberto (fica registrado quem resolveu). Rota `POST /admin/alertas/:id/resolver`.
- **Asaas com cartão já cadastrado:** quando o admin muda o vencimento e o Asaas recusa ("não é possível alterar o vencimento… Cartão de Crédito"), isso vira **aviso**, não erro do servidor, e a resposta explica que vale a data da assinatura.
- **Contador de e-mails da Saúde** conta todos os e-mails que o servidor tentou mandar (enviados e falhas em 24 h). Tabela nova `email_envios` (guarda 30 dias). Antes contava só alguns tipos e mostrava "0 enviados" com alertas enviados.

**Por quê**
- O Clube ainda não começou e a TV de lá está desligada: chegava e-mail vermelho a cada horário da grade.
- Os 2 "erros" de 06/10 11:08 eram só o Asaas recusando mudar data de fatura com cartão.

**Como confirmar**
- `node testes/rodar.js` → 8 grupos ✅ (vigia: parte 5; conferencia: parte 4).
- Produção: Saúde → Clube Alto dos Pinheiros → pausar até a data do piloto → os avisos vermelhos dele somem e ele fica cinza.

---

## 2026-10-06 · servidor · 03/10l — desligamento limpo no deploy (fim dos e-mails "Deployment crashed")

**O que mudou**
- O servidor agora trata o `SIGTERM` (e `SIGINT`): para de aceitar conexões, fecha os WebSockets com código 1012 ("servidor reiniciando"; TVs e celulares reconectam sozinhos no servidor novo, como já faziam), fecha o banco e sai com **código 0**. No máximo 8 s.
- **Railway → prorider-server → Settings → Deploy → Custom Start Command: `node server.js`** (em vez de `npm start`).

**Por quê**
- A investigação do desenvolvedor mostrou que os 3 "Deployment crashed" de 05/10 não foram travamentos: a cada deploy novo o Railway manda `SIGTERM` ao container antigo; o `npm` trata isso como erro (`npm error signal SIGTERM`) e sai com código ≠ 0, e o Railway avisa "crashed".
- Testado aqui: com `node server.js` a saída é **0** em ~30 ms; com `npm start` continua **143** (o npm morre antes do Node), por isso o start command precisa ser `node server.js`.

**Como confirmar**
- Fazer o deploy: o deploy anterior deve aparecer como "Removed"/encerrado sem e-mail de crash. No log do antigo: `[Servidor] SIGTERM recebido (deploy novo ou parada): desligando com calma`.

---

## 2026-10-06 · servidor + admin · 03/10k — conferência diária dos pagamentos com o Asaas

**O que mudou**
- **Conferência diária com o Asaas:** uma vez por dia (entre 7h e 22h; ou assim que der, se passar de 30 h) o servidor pergunta ao Asaas as cobranças de cada licença com cliente/assinatura no Asaas (`externalReference` = código da licença e `subscription`). Pagamento **confirmado/recebido** lá que não está registrado aqui → registra (igual ao webhook) e libera a licença. **Estornado/chargeback** lá e confirmado aqui → desfaz. Pedidos da **loja** em aberto (até 45 dias) que o Asaas diz pagos → marca como pago.
- O que o webhook fazia virou duas funções usadas pelos dois caminhos: `asaasPagoRegistrar` e `asaasPagoDesfazer` (o webhook continua igual por fora).
- Se achou alguma coisa → **aviso amarelo** na Saúde ("N pagamento(s) não tinham chegado pelo aviso automático") — sinal de que o webhook está falhando. Sem e-mail (só vermelhos mandam e-mail).
- **Admin → Saúde do sistema → Conferência com o Asaas:** última conferência, o que registrou/desfez e o botão **Conferir agora**.
- Rotas: `GET /admin/asaas/conferencia`, `POST /admin/asaas/conferir` (só super admin). Variável opcional `ASAAS_CONFERIR_DESLIGADO=1` desliga a conferência automática.

**Por quê**
- Em 05/10 o pagamento de 03/10 do Clube Alto dos Pinheiros estava CONFIRMADO no Asaas, mas não registrado no ProRider, e os Logs de Webhooks do Asaas estavam vazios. Sem o registro, a TV travaria 5 dias depois do vencimento com a academia em dia.

**Como confirmar**
- `node testes/rodar.js` → `conferencia` ✅ (pago sem aviso é registrado, rodar de novo não duplica, fatura em aberto/apagada é ignorada, estorno desfaz, loja paga, só admin).
- Em produção: Admin → Saúde → Conferência com o Asaas → **Conferir agora**. A cobrança do Clube de 03/10 deve aparecer como "registrado R$ 5,00".

**Cuidados**
- Só **lê** do Asaas (GET). Não cria nem altera cobrança.
- O Ginásio não mudou (só o número da versão).

---

## 2026-10-06 · servidor + admin · 03/10j — backup do banco feito pelo próprio servidor (plano B até o Railway Pro)

**O que mudou**
- **Backup automático:** toda madrugada (2h–6h, Brasília) o servidor salva uma cópia completa de todas as tabelas (`prorider_AAAA-MM-DD_HHMM.json.gz`), numa fotografia só (transação REPEATABLE READ), em `BACKUP_DIR` ou, sem ela, em `<pasta das gravações>/../backups` (no Railway: `/data/backups`, no Volume). Guarda as 7 últimas (`BACKUP_GUARDAR`). Se o servidor ficou desligado, faz assim que passar de 30 h.
- **Admin → Saúde do sistema → Backup do banco:** lista, "Fazer backup agora" e **Baixar** (para guardar fora do Railway). Card "Backup do banco" no topo.
- **Avisos:** backup falhou (vermelho, com e-mail), atrasado há mais de 36 h (amarelo), mais de 8 dias sem baixar uma cópia (amarelo). Fecham sozinhos quando resolvidos.
- Rotas novas (admin): `GET /admin/backup`, `POST /admin/backup/agora`, `GET /admin/backup/baixar/:arquivo`.
- **`ferramentas/restaurar-backup.js`:** devolve um backup para um banco (pede para digitar o nome do banco; confere as contagens de cada tabela; acerta os contadores de id).
- Teste novo `testes/backup.test.js`: faz, baixa e **restaura num banco vazio**, conferindo contagens, acentos e cadastro novo depois.

**Por quê**
- Backups automáticos do Railway só no plano Pro. **PRIORIDADE: contratar o Railway Pro ao concluir o projeto / antes das academias pagantes.** Até lá, este backup + a cópia semanal baixada pelo Mario.

**Como confirmar**
- `node testes/rodar.js` → TUDO OK (7 grupos).
- Saúde do sistema → Backup do banco → "Fazer backup agora" → aparece o arquivo → "Baixar".

**Cuidados**
- O backup fica no mesmo Volume das gravações: se o Railway inteiro tiver problema, só sobra a cópia baixada. Por isso o aviso de 8 dias.

---

## 2026-10-05 · servidor + ginasio · 03/10i — queda e volta normal da TV não conta mais como erro

**O que mudou**
- As linhas "Professor caiu da sala… aguardando 3 min", "Sala retomada" e "Sala removida" (a TV reconectando, que é normal) não vão mais para a lista de erros da Saúde do sistema nem contam para o "pico de erros". A TV que cai **no meio da aula** continua gerando o aviso vermelho do vigia.
- Ginásio: só o número da versão (BUILD 03/10i).

**Por quê**
- Em produção, a Saúde mostrava "3 erros do servidor" que eram só a TV reconectando (alarme falso).

**Como confirmar**
- `node testes/rodar.js` → TUDO OK. Saúde do sistema sem "Professor caiu da sala" na lista de erros.

---

## 2026-10-05 · servidor + site + app + ginasio · 03/10h — semáforo das academias, painel por academia, lupinha e código do erro

**O que mudou**
- **Avisos no painel, e-mail só dos vermelhos:** amarelos ficam só na Saúde do sistema; os 🔴 (agir agora) também vão por e-mail. Chave "e-mail dos 🔴" na Saúde (`POST /admin/alertas/email`, cfg `alertas_email`).
- **Semáforo das academias** (`GET /admin/saude/licencas`): cada academia ativa em vermelho (aviso grave em aberto, licença suspensa), amarelo (aviso em aberto, erro nas telas em 24 h, problema reportado, pagamento vencido, TV sumida há 2+ dias), verde (tudo certo) ou cinza (sem TV). Vermelhos primeiro. O número de vermelhos aparece no título da aba.
- **Painel de uma academia** (`GET /admin/saude/licenca/:codigo`): situação, TVs (versão e última vez vista), última aula, pagamento e uma linha do tempo de 30 dias com avisos, erros das telas (com os códigos), problemas reportados e aulas. Filtros: tudo, só problemas, aulas, reportados. Botão "Entrar no Portal dela".
- **Código do erro:** todo erro numa tela ganha um código curto (`E-7F3A`). Portal, financeiro e app mostram no canto "Algo deu errado · código E-7F3A · Reportar" (no máximo a cada 30 s); a TV mostra "⚠ E-7F3A" pequeno no canto de baixo por 10 s. O "Reportar um problema" leva os últimos códigos junto. Tabela nova `erro_codigos`.
- **Lupinha** (`GET /admin/saude/busca?q=`): acha por código (E-…, S-… do evento, A-… do aviso, R-… do relato), por academia (nome ou código) ou pelo texto do erro, e abre o painel da academia já no ponto do erro.
- `sistema_alertas` ganhou `detalhe`.

**Por quê**
- Pouco e-mail; tudo num painel só. Quando o cliente liga, a ProRider entra direto no painel dele ou busca o código que ele leu na tela.

**Como confirmar**
- `node testes/rodar.js` → TUDO OK (casos novos em telas e vigia).
- Saúde do sistema: cartões coloridos das academias no topo; clicar abre o painel; buscar um código E-… acha o erro.

---

## 2026-10-04 · servidor + admin · 03/10g — vigia: avisos automáticos por e-mail

**O que mudou**
- **Vigia no servidor:** a cada minuto (`ALERTAS_INTERVALO_S`, padrão 60) confere e manda e-mail na hora:
  - TV desligada/sem internet de 10 min antes até 5 min depois de uma aula da grade (só academias com TV vista nos últimos 14 dias);
  - TV caiu no meio da aula (sala iniciada sem a TV há 90 s — `ALERTA_TV_CAIU_S`);
  - 10+ erros do servidor em 10 min; 25+ erros das telas em 15 min;
  - aviso do Asaas recusado (token do webhook) na última hora;
  - menos de 2 GB para as gravações; memória acima de 1,5 GB (`ALERTA_MEMORIA_MB`);
  - banco de dados fora do ar (e quando volta).
- Cada aviso vai uma vez só (tabela nova `sistema_alertas`, chave única). Os de TV fecham sozinhos quando a TV volta e mandam "TV ligou de novo / voltou" (só se o aviso tem menos de 3 h).
- Destino: `ALERTAS_EMAIL` (vários separados por vírgula); sem ela, o e-mail do super admin.
- Rotas novas (admin): `GET /admin/alertas`, `POST /admin/alertas/ligar`, `POST /admin/alertas/rodar` ("Verificar agora"), `POST /admin/alertas/teste` (e-mail de teste).
- **Admin → Saúde do sistema:** quadro "Avisos automáticos" (ligar/desligar, Verificar agora, Mandar e-mail de teste, lista de 7 dias com e-mail enviado e situação). O número vermelho do menu conta os avisos em aberto.
- Ginásio: só o número da versão (03/10g).

**Por quê**
- Pós-venda: a ProRider fica sabendo do problema na academia antes do cliente ligar — inclusive à noite e no fim de semana.

**Como confirmar**
- `node testes/rodar.js` → TUDO OK (novo grupo: vigia).
- Saúde do sistema → "Mandar e-mail de teste" → chega o e-mail "🧪 ProRider — teste dos avisos".

**Cuidados**
- Precisa do e-mail (Resend) ligado para os avisos saírem; sem ele, ficam só na Saúde do sistema.

---

## 2026-10-03 · servidor + site + app + ginasio · 03/10f — pós-venda: erros chegam sozinhos, TV sem internet não perde nada, teste de carga, senha trocada derruba sessões

**O que mudou**
- **Erros das telas na Saúde do sistema:** rota `POST /suporte/erro` (token opcional; com token da TV ou do usuário, sabe a academia). Recebe lotes de até 20; ignora "Script error." e ResizeObserver; mesmo erro da mesma academia em 24 h soma em `vezes`; 120 pedidos/h por IP. Novas colunas em `sistema_eventos`: `origem` (NULL = servidor; tv, app, portal, financeiro, admin), `licenca`, `chave`, `vezes`, `detalhe`.
- **Admin → Saúde do sistema:** cartão "Telas (24 h)", tabela "O que as telas avisaram" (onde, academia, mensagem, detalhes, vezes) e "Limpar lista" separado para telas e servidor. Os erros do servidor não misturam com os das telas.
- **Site e app (`pr-suporte.js`):** captura `window.onerror` e promessas rejeitadas (queda de internet não conta), no máximo 30 por página, o mesmo erro a cada 10 min; `prErroConfig(...)` em index, academia, financeiro e app.
- **Ginásio (`script.js`):** caixa de saída `_prFilaPost` — resumo da aula, resultado do campeonato e ficha da gravação que falham por rede/servidor ficam em `localStorage 'pr_fila'` (até 7 dias, sobrevive a fechar o programa) e são reenviados a cada 30 s e quando a internet volta; a ficha da gravação, quando chega, segue com o envio do vídeo para o app. Erros de JavaScript e avisos (câmera não abriu, internet caiu e voltou, envio do vídeo parou, YouTube não tocou, "guardado e enviado depois") vão para a Saúde, também guardados se estiver offline.
- **`/display/gravacao`** aceita a mesma ficha de novo (mesmo `uid` = mesma gravação). `/display/aula/resumo` e `/display/campeonato/resultado` já aceitavam repetição.
- **Trocou a senha → outras sessões caem:** `users.senha_trocada_em` (+ cópia em memória). Todo token de login emitido antes da troca deixa de valer em todas as rotas (`jwt.verify` central). Vale para troca no perfil (`PUT /user/senha` devolve um token novo para quem trocou), "Esqueci minha senha", "Nova senha" do admin e senha trocada pelo gestor. Tokens da TV não são afetados.
- **`ferramentas/teste-carga.js`:** simula N academias × N bikes (TV 4 msg/s, celular 1 msg/s, app consultando) e mede atraso e quedas. Recusa rodar no servidor de produção.
- **Testes:** `testes/telas.test.js` (novo) e caso novo em `seguranca.test.js` (senha trocada).

**Por quê**
- Pós-venda: a ProRider fica sabendo do problema na academia antes do cliente ligar, com a academia, a tela e a versão.
- Internet de academia cai; o fim da aula não pode se perder.
- Saber quanto o servidor aguenta antes de vender em escala.
- Senha vazada/trocada precisa tirar quem estava logado.

**Como confirmar**
- `node testes/rodar.js` → TUDO OK (pagamento, loja, desafios, segurança, telas).
- Admin → Saúde do sistema → aparece "O que as telas avisaram".
- TV: tirar o cabo de rede no fim da aula → aviso "Sem internet — … guardado na TV"; recolocar → "Internet de volta: … enviado ✓" e, na Saúde, "TV ficou sem internet — …: guardado na TV e enviado depois (nada perdido)".
- Teste de carga local (100 academias × 20 bikes = 2.100 conexões, 60 s): 100% entregue, atraso p95 7 ms, 0 quedas, ~135 MB de memória.

**Cuidados**
- Após subir, quem trocar a senha sai dos outros aparelhos (é o esperado).
- Nada de variável nova. Migração automática (`Migração 03/10e/f (segurança e saúde) OK` no log).

---

## 2026-10-03 · servidor + site + app · 03/10e — segurança, saúde do sistema, testes automáticos e backup

**O que mudou**
- **Limite de tentativas:** 8 senhas erradas no mesmo e-mail (ou 40 no mesmo IP) em 15 min → espera 15 min; cadastro 15/h por IP; ativação da TV 20 códigos errados por IP em 15 min; "esqueci a senha" 3/h por e-mail.
- **Esqueci minha senha:** link por e-mail (vale 1 h, uma vez só) → página `redefinir.html`. Nas entradas do Portal, do admin, do app e do portal do aluno. Não revela quem tem conta.
- **Modo suporte (Entrar → academia) não abre mais as rotas /admin.** O token do modo suporte vai na URL; antes ele também dava acesso a todas as licenças, pagamentos e usuários.
- **Reportar um problema:** no Perfil do app, no menu do Portal e na página do financeiro. Chega com a tela, a versão e o aparelho.
- **Excluir minha conta (LGPD):** no Perfil do app, com a senha; apaga os dados pessoais e deixa só números anônimos. Gestor/financeiro não se excluem sozinhos.
- **Saúde do sistema (admin):** alertas (e-mail desligado, Asaas sem token, gravações sem Volume, pouco espaço), servidor, banco, e-mail, Asaas (último aviso recebido), TVs online, licenças, loja, problemas reportados e a lista de erros/avisos do servidor (guardados 30 dias). Número vermelho no menu quando há erro.
- **`/ping` responde 503 quando o banco cai** (para o monitor de queda avisar).
- **Instalação nova/restauração:** as tabelas dos grupos de desafio eram criadas antes de `users` existir e ficavam faltando num banco vazio. Corrigido (achado pelos testes automáticos).
- **Testes automáticos** (`testes/rodar.js`): sobe o servidor contra um banco de TESTE vazio, com Asaas e Resend simulados, e roda pagamento, loja, desafios e segurança. Só roda em banco com "test" no nome.
- **Backup fora do Railway** (`ferramentas/backup.sh`) e **prova de restauração** (`ferramentas/restaurar-teste.sh`).

**Como confirmar**
- `TEST_DATABASE_URL=postgres://…/prorider_teste node testes/rodar.js` → "TUDO OK — pode subir." (pagamento, loja, desafios, segurança).

## 2026-10-03 · admin · 03/10d — "Nova senha" que não respondia e caixas apertadas

**O que mudou**
- **Nova senha p/ financeiro / gestor:** a confirmação agora é no próprio botão (clicar de novo). Antes usava a janelinha "confirmar" do navegador; se o navegador bloqueia essas janelas, o clique não fazia nada. Mostra "Gerando…", o resultado (senha provisória, e-mail enviado ou motivo, copiar p/ WhatsApp) e avisa que não precisa salvar.
- **Página de pagamentos:** coluna da esquerda mais larga (Situação e Acessos) e e-mail longo quebra linha em vez de passar por cima da caixa.
- **Desfazer** não aparece mais em lançamento já desfeito.

**Como confirmar**
- `tnova.js`: gera a senha nova e mostra o resultado; e-mail longo cabe na caixa.

## 2026-10-03 · servidor + app + admin + Ginásio · 03/10c — Loja (venda de aulas), desafios reais, pré-treino e Bluetooth

**O que mudou**
- **Loja do app (venda de aulas gravadas):** o super admin abastece em *Admin → Loja do app*: professores, aulas à venda (cada uma usa o roteiro de uma gravação da TV; vídeo do servidor ou por link do Dropbox/Drive), pacotes de créditos e assinaturas (quantos modelos quiser), vendas e repasse por professor no mês, 🎁 cortesia. Botão para ligar/desligar as vendas.
- **Compra no app:** aula avulsa, pacote (1 crédito = 1 aula para sempre) ou assinatura. Pagamento pelo Asaas da ProRider (PIX, cartão ou boleto, página segura); o CPF vai direto ao Asaas e não é guardado. O webhook libera na hora; estorno tira o acesso. Rotas: `GET /loja`, `POST /loja/comprar`, `GET /loja/pedidos/:id`, `POST /loja/aulas/:id/usar-credito`, `/admin/loja*`. Tabelas `loja_*`, `sistema_cfg`.
- **Aula comprada** abre no mesmo player da aula gravada (vídeo + gráfico + ranking com quem fez ao vivo). Gravação usada na loja não é apagada pela limpeza de 72 h.
- **Desafios reais:** 21 dias (dias diferentes com pedal em 30 dias → selo + 500 pts), Quebra FTP (FTP do começo do mês × agora, meta +5% → selo + 300 pts; histórico de FTP por gatilho no banco), ranking do mês (pontos reais), grupos no servidor (vários grupos, qualquer aparelho, sair do grupo, ranking pelo desafio do grupo). Rotas `GET /desafios/meus`, `POST /desafios/grupos/:codigo/sair`; rankings `mensal`, `21dias`, `ftp`.
- **Pré-treino no celular igual ao da TV:** lista da categoria em cartões (perfil, TSS, zonas); detalhe com faixa aquecimento/principal/volta, barras no tempo exato, eixo, Duração/TSS/FTP médio/Desafios e tempo em cada zona. Z1 cinza da TV (#a1a1a1). Botões principais laranja (eram vermelhos).
- **Conectar (Bluetooth):** tela em português, estado de cada aparelho, números ao vivo (W, RPM, bpm), 20 s de limite para conectar, reconexão sozinha (3 tentativas), "Trocar" desconecta o anterior, dicas, aviso claro sem Bluetooth (Android: Chrome; iPhone: Bluefy).
- **Caminhos do app:** voltar do conectar vai para a aula / loja / início conforme a origem; aula gravada não "vaza" para a próxima aula; aula importada (Treino do treinador) abre pela categoria; botão do professor "Scan QR" não quebra mais; detalhe e conectar sem a barra de baixo.
- **Ginásio:** a gravação avisa na TV (não começou / salva / no app / falhou).

**Como confirmar**
- `tloja.js` (28), `tdes2.js` (15), `tlojaui.js`, `tlojaui2.js`, `tgrv.js`, `tpg2.js`: tudo OK.

**Cuidados**
- **Gravações enviadas pela TV ficam no disco do Railway.** Sem um *Volume* montado na pasta de `GRAVACOES_TESTE_DIR`, cada deploy apaga os vídeos.

## 2026-10-03 · servidor + site · 03/10b — Demo 2: faturas no dia 3 com o admin no dia 4; login do financeiro caindo no lugar errado

**O que mudou**
- **Dia X × data:** o admin antigo guardava o "dia de vencimento" (modal Financeiro) separado da data "Vencimento" da licença (que nascia com +30 dias). Na subida, uma vez só: licença que nunca pagou e tem dia escolhido (≠ 10) passa a vencer no próximo "dia X" (`venc_migrado`).
- **Faturas adiantadas do Asaas:** o Asaas gera os próximos meses antes (ex.: 03/10 e 03/11 em aberto). Ao acertar, a 1ª vai para o próximo vencimento e as outras seguem mês a mês (04/10, 04/11). A página do financeiro acerta sozinha quando abre, se as datas não batem.
- **Página do financeiro:** só a 1ª fatura em aberto tem "Pagar"; as seguintes aparecem como "Próxima (automática)". (Antes o botão pegava a de 03/11.)
- **Login do financeiro sempre no pagamento**, por qualquer entrada: Portal, entrada do admin (`index.html`) e portal do aluno no navegador (`aluno.html`, que abria com a sessão guardada como aluno). "Sair" do financeiro limpa todas as sessões guardadas.

**Como confirmar**
- `tpg3.js` (caso Demo 2), `tpg4.js` (entradas), `tpg2.js` (39 verificações): tudo OK.

## 2026-10-03 · servidor + admin + financeiro + app + Ginásio · 03/10a — revisão completa do pagamento

**O que mudou**
- **Vencimento certo no Asaas:** a 1ª fatura vence no **próximo vencimento da licença** (antes: sempre "hoje" — o caso do Demo 2, dia 3 em vez de 4). Mudou o vencimento ou o valor no admin → a fatura em aberto e a assinatura do Asaas mudam juntas (`PUT /payments/{id}` e `PUT /subscriptions/{id}`). Botão "Acertar Asaas".
- **Uma regra só para a situação** (`finSituacao`): Em dia · A vencer (nunca pagou, 1º vencimento ainda não chegou) · Vencido · Suspenso (pago antes e +5 dias vencido → TV trava, inclusive na ativação). Admin (lista, Financeiro, Pagamentos), página do financeiro e TV usam a mesma.
- `licencas.vencimento` = **próximo vencimento** (editável); `pagamento_ok_ate` = pago até. O "dia X" vira consequência da data.
- **Livro-caixa único** (`pagamentos`): colunas `origem`, `asaas_id` (único), `venc_ref`, `cobre_ate`. Cada pagamento confirmado cobre 1 mês a partir do vencimento que pagou; `pgRecalc` recalcula a licença.
- **Webhook reescrito:** acha a licença pela referência, pela assinatura ou pelo cliente; CONFIRMED/RECEIVED gravam no livro (sem duplicar); **desfazer no Asaas** (RECEIVED_IN_CASH_UNDONE, REFUNDED, DELETED, CHARGEBACK…) volta o vencimento; cartão recusado vira aviso na página do financeiro.
- **Registro manual = "recebido por fora"** (PIX, transferência, dinheiro, boleto avulso, cortesia). Não aceita "cartão", exige "Confirmo que o dinheiro já entrou", mostra o que vai cobrir, pula a fatura do cartão no Asaas. Botão **Desfazer** (fica riscado no histórico).
- **Fim do efeito colateral:** abrir a página de pagamentos punha a licença como `bloqueada` (travava a TV). Removido, e as `bloqueada` voltam a `ativa` na subida.
- **Datas sem fuso:** 04/10 aparecia 03/10 no admin (`fmtDate`).
- **Acesso com senha:** gestor e financeiro pela mesma função; a tela diz se o e-mail com a senha saiu e, se não, **o motivo** (sem RESEND_API_KEY / Resend sem domínio verificado) e um botão **Copiar acesso p/ WhatsApp**. Novo: **Nova senha p/ financeiro / gestor** (gera provisória e reenvia).
- **E-mail do financeiro** com texto próprio ("Entrar e pagar").
- **Excluir licença cancela a assinatura** no Asaas.
- **Financeiro em qualquer entrada:** menu "Pagamento da licença" no Portal e faixa amarela no app quando o e-mail é o financeiro; `/user/me` traz `financeiro`.
- **Ginásio:** tela de transição de segmento entra cobrindo tudo (sem o "corte" do gráfico/vídeo).

**Como confirmar**
- `tpg2.js` (39 verificações com Asaas simulado) e `tpgui.js` (telas): tudo OK.

**Cuidados**
- `ASAAS_WEBHOOK_TOKEN` continua obrigatório. E-mail só sai com `RESEND_API_KEY` + domínio verificado + `EMAIL_FROM`.

## 2026-10-03 · servidor + portal · 02/10m — página do financeiro com menu (Pagamento · Meus dados) e senha provisória

**O que mudou**
- **`financeiro.html`:** menu lateral próprio, como o do gestor e o do admin, mas enxuto: **💳 Pagamento**, **👤 Meus dados** (nome; e-mail só leitura; trocar a senha), **🏠 Portal da academia** (só se a pessoa também for gestor) e **Sair**. No celular, o menu vira uma faixa no topo.
- **Primeiro acesso:** conta criada pelo admin (gestor ou financeiro) nasce com `users.senha_provisoria = TRUE`; o login devolve `senha_provisoria`; a página do financeiro mostra "Você está com a senha provisória — Criar minha senha" até a troca (`PUT /user/senha` zera a marca).

**Por quê**
- Pedido do Mario: o e-mail definido como financeiro cai numa tela própria, com as opções dele (pagamento e os dados/senha).

**Como confirmar**
- Admin define um e-mail novo no Financeiro → senha provisória → entrar no Portal com ela → cai no Pagamento com o aviso laranja → Meus dados → trocar a senha → o aviso some.

## 2026-10-03 · servidor + admin · 02/10l — licença sem situação travava a TV; gestor e financeiro definidos na licença

**O que mudou**
- **Causa do "Licença não encontrada ou inativa":** as licenças ProRider Demo 01 e Demo 02 estavam com `status` vazio (NULL — o "null" ao lado do código na lista do admin). A TV só ativa licença `ativa`. Na subida, o servidor passa para `ativa` toda licença sem situação ou em `trial`; o padrão da coluna passa a ser `ativa`; a edição nunca mais grava situação vazia (o admin mandava `trial` no plano Trial, o que também travava a TV).
- **Admin → Editar/Nova licença:** duas seções, **Gestor da academia** (nome + e-mail, login do Portal) e **Financeiro** (nome + e-mail, login do pagamento). Pode ser o mesmo e-mail.
- **Servidor (`acessoVincular`):** ao definir ou trocar o e-mail, a conta que existe vira gestor/financeiro da licença (admin nunca é mexido; o financeiro não rebaixa um gestor); conta que não existe é criada com senha provisória e recebe o e-mail de boas-vindas; o e-mail anterior volta a ser aluno. O admin vê a senha provisória na hora.
- Cadastro ("Criar conta") com um e-mail já definido como gestor de uma licença já entra como gestor dela.

**Por quê**
- O Mario não conseguia ativar a TV da Demo 01 nem entrar com o e-mail do financeiro (a conta não existia).

**Como confirmar**
- Depois do deploy, o log mostra "02/10l: N licença(s) sem situação → ativa" e a TV ativa com o código.
- Editar licença → e-mail novo no Financeiro → aparece "senha provisória"; essa pessoa entra e cai no pagamento.

## 2026-10-03 · portal + construtor · 02/10k — "Criar conta" visível nas duas entradas e aviso de vídeo AVI

**O que mudou**
- **`academia.html`:** "Primeiro acesso? Criar conta" virou um botão destacado logo abaixo do Entrar (computador e celular); `academia.html#criar` já abre o cadastro.
- **`index.html` (entrada do admin):** o mesmo botão, que leva ao cadastro do Portal.
- **`studio.html`:** vídeo em AVI, WMV, MKV, FLV, MPG, 3GP, VOB ou TS mostra "⚠ Este vídeo é AVI e não roda na TV: converta para MP4".

**Por quê**
- O Mario não achou onde criar a conta do financeiro (o link era pequeno e só existia no Portal) e escolheu um vídeo AVI, que o navegador da TV não abre.

**Como confirmar**
- Entrada do admin → "Primeiro acesso? Criar conta" → abre o cadastro no Portal.
- Construtor com um .AVI → aparece o aviso em vermelho.

## 2026-10-02 · servidor + portal (Construtor) + ginasio · 02/10j — professor da aula em rede no fundo ou no canto, vídeo por link e cache antes da aula

**O que mudou**
- **Ginásio — academia principal:** em "Gravar" ou "Gravar e transmitir" **com vídeo escolhido**, o fundo é o vídeo e a câmera só grava e transmite (`_bgCamFundo()`); sem vídeo, a câmera continua no fundo.
- **Ginásio — outras academias:** recebem a **câmera limpa** + a voz (o servidor marca `tv:true` no `tx_ver` → `tx_novo`); com vídeo na aula → vídeo de fundo + rosto do professor num quadrinho no canto; sem vídeo → o professor é o fundo (`cameraLive`). O vídeo da aula vai junto no convite (`aula.video`). Placar das academias, quadrinho e selo de gravação ficam acima do vídeo (z-index).
- **Cache (`servidor-local.js`):** `/cache/baixar`, `/cache/status`, `/cache/arquivo` (Range). Baixa os links (segue redirecionamentos) para `C:\ProRider\Cache`; apaga o que está sem uso há 2 dias (ao iniciar e a cada hora). Só aceita pedidos do próprio computador.
- **Ginásio:** a cada 60 s fora da aula, se há aula em rede de outra academia, pede o download de todas as músicas e do vídeo por link. Ordem para tocar: pendrive (pelo nome) → já baixado → internet; se falhar, tenta o seguinte.
- **Construtor:** vídeo de fundo por **link** (Dropbox, Google Drive, nuvem) — botão "🔗 Link do vídeo" ou 🔗 no vídeo escolhido; salva `video.link`.

**Por quê**
- Pedido do Mario: na principal o professor está ao vivo (fundo = vídeo); nas outras, o professor de fundo ou no canto; tudo baixado antes para não travar.

**Como confirmar**
- Aula com vídeo por link: na tela de configurar aparece "🔗 nome do vídeo"; no console "vídeo da aula: … (já baixado)" e a pasta `C:\ProRider\Cache` com o arquivo.
- Aula em rede com a principal em "Gravar e transmitir": nas outras, com vídeo → quadrinho no canto; sem vídeo → professor de fundo.

**Cuidados**
- Trocar o `servidor-local.js` junto (rotas do cache).
- Vídeo em boa qualidade: 1080p com taxa moderada baixa bem com antecedência; o download começa quando a principal abre a aula na tela do QR.

## 2026-10-02 · portal · 02/10i — financeiro entra e cria a conta na própria entrada do Portal

**O que mudou**
- **`academia.html`:** "Primeiro acesso? Criar conta" na entrada do Portal (computador e celular) abre o cadastro ali mesmo (nome, e-mail, senha — o mesmo do app). Se o e-mail é o financeiro da licença, entra direto no pagamento; senão, avisa (financeiro: pedir à ProRider para cadastrar o e-mail; aluno: a conta já vale no app).
- **`financeiro.html`:** saiu a tela de entrar/criar conta própria. Sem login, volta para a entrada do Portal; "Sair" também.

**Por quê**
- Pedido do Mario: uma entrada só. A academia manda para o financeiro o mesmo link do Portal.

**Como confirmar**
- Abrir o Portal → "Primeiro acesso? Criar conta" com o e-mail do financeiro → cai na página do financeiro.
- Abrir `financeiro.html` sem login → vai para a entrada do Portal.

## 2026-10-02 · servidor + portal · 02/10h — página do financeiro (pagamento da licença pelo Asaas)

**O que mudou**
- **Regra do Mario:** a página de pagamento é **só do responsável financeiro** da academia — o login cujo e-mail é o `financeiro_email` da licença (cadastrado pela ProRider no painel do admin). Gestor e coordenador não entram (nem menu, nem rota). Super admin em modo suporte só lê.
- **Portal (`academia.html`):** mesma tela de entrada; o e-mail do financeiro vai direto para **`financeiro.html`**. Link "Financeiro da academia: criar conta". O antigo "Financeiro" do gestor (com o formulário dos 4 últimos dígitos) saiu; no modo suporte fica o atalho "Financeiro (suporte)".
- **Nova página `financeiro.html`:** entrar ou criar conta (nome, e-mail, senha — sem dados de performance; a mesma conta vale no app); situação (em dia até / vencido / suspenso / aguardando o 1º pagamento), mensalidade, vencimento, cartão em uso (bandeira e final, lidos do Asaas), botão de pagar e lista de faturas (pagar / recibo). Celular e computador.
- **Servidor:**
  - `finAuth` novo: vale o e-mail do login igual ao `financeiro_email` (qualquer papel); modo suporte só GET;
  - `GET /academia/financeiro` (situação + faturas do Asaas) e `POST /academia/financeiro/pagar` (1ª vez: cria cliente + assinatura mensal no cartão com o valor da licença e o CPF/CNPJ informado; depois: devolve a fatura em aberto). O cartão é digitado na página do Asaas (`invoiceUrl`) — nunca passa pelo servidor;
  - removida a rota antiga `PUT /academia/financeiro/cartao` (últimos 4 dígitos digitados à mão);
  - login devolve `financeiro: true`; cadastro com e-mail já registrado como financeiro vira o financeiro da licença;
  - `PATCH /admin/licencas/:id/financeiro`: trocar o e-mail passa o papel para o novo cadastro e devolve o antigo a aluno (gestor e outros papéis não são rebaixados);
  - colunas `licencas.asaas_customer` e `asaas_sub`; a rota de assinatura do admin também grava nelas;
  - `ASAAS_URL` opcional (só para teste no sandbox).

**Por quê**
- Pedido do Mario: só a pessoa do financeiro paga e vê o pagamento; cadastro igual ao do app; trocar a pessoa = trocar o e-mail na licença.

**Como confirmar**
- Admin cadastra `financeiro@…` na licença → essa pessoa entra pelo Portal (ou cria conta) → cai em `financeiro.html` → "Cadastrar cartão e pagar" (CPF/CNPJ) → abre a página do Asaas.
- Gestor da mesma academia: sem o menu e `GET /academia/financeiro` = 403.
- Trocar o e-mail no admin → o antigo perde o acesso (403), o novo ganha.

**Cuidados**
- Testado com um Asaas simulado. Antes da 1ª cobrança real, testar no **sandbox** do Asaas (`ASAAS_URL=https://api-sandbox.asaas.com/v3` + chave do sandbox) e conferir se a assinatura guarda o cartão pago pela página para os meses seguintes.
- O valor cobrado é o `valor_mensal` da licença (definido no admin).

## 2026-10-02 · servidor · 02/10g — rotas do Asaas no pacote e webhook com token

**O que mudou**
- As rotas `POST /webhook/asaas` e `POST /admin/asaas/assinatura`, que o desenvolvedor colocou direto no servidor (commits ba074e1 e 2c33a79), agora fazem parte do `server.js` do pacote — o próximo pacote não as apaga mais.
- O webhook confere o cabeçalho `asaas-access-token` contra a variável **`ASAAS_WEBHOOK_TOKEN`** (comparação em tempo constante). Sem a variável, ou com token errado, responde 401 e registra no log.
- Erro interno do webhook não devolve mais a mensagem do erro.

**Por quê**
- Sem a conferência, qualquer um que soubesse o endereço podia mandar um "pagamento recebido" falso e liberar uma licença por 35 dias.

**Como confirmar**
- Sem o cabeçalho → 401 "Token inválido". Com o token certo e `PAYMENT_RECEIVED` com `externalReference` = código da licença → 200 e a licença fica `em_dia`.

**Cuidados**
- Criar `ASAAS_WEBHOOK_TOKEN` no Railway **e** pôr o mesmo valor no painel do Asaas (configuração do webhook) no mesmo deploy; senão os avisos de pagamento são recusados.
- Daqui para frente, mudança no servidor fora dos pacotes: me mandar para entrar no próximo pacote.

## 2026-10-02 · servidor + portal (Construtor) + app + ginasio · 02/10f — música por link, horário do START e recomeçar a aula em rede

**O que mudou**
- **Construtor (`studio.html`):**
  - botão **"🔗 Músicas por link"**: colar os links de compartilhamento (Dropbox ou Google Drive), um por linha; o nome do arquivo no link liga cada link à música; link novo entra no fim da trilha (duração lida pelo próprio link);
  - 🔗 em cada música para pôr, trocar ou tirar o link (verde = toca pelo link);
  - a aula salva `trilha[i].link`; ao abrir de novo, as músicas com link voltam sozinhas (sem a onda; pondo o MP3 ela aparece).
- **Ginásio (`telas-pv.js`, BUILD 02/10f):**
  - cada música toca pelo link (Dropbox vira `raw=1`; Google Drive vira `uc?export=download`); sem link ou se o link não abrir, pelo pendrive com o mesmo nome; a tela de configurar mostra "N músicas da aula · pelo link";
  - aula em rede: START da academia que criou o desafio só a partir de 5 min antes do horário; se ela não começar até 5 min depois do horário, o START das outras libera e elas seguem sozinhas;
  - **Recomeçar**: nos primeiros 5 min de aula, o SELECT da academia que criou o desafio vira "Recomeçar a aula em rede" → todas voltam à tela do QR com os mesmos alunos conectados, números zerados, gravação da largada descartada, nada vai ao placar.
- **Servidor:** `/display/rede/estado` guarda o contador `reinicio` (mantido se a aula for publicada de novo); mensagem `aula_reiniciada` da TV vai aos celulares da sala.
- **App:** `aula_reiniciada` zera os números da largada (`_lsReset`) e avisa.

**Por quê**
- Pedido do Mario: tocar as músicas do Dropbox (sem depender de pendrive em cada academia), START central com horário e poder recomeçar sem perder os alunos.

**Como confirmar**
- Construtor: "🔗 Músicas por link" → colar 2 links → as duas entram na trilha com o 🔗 verde; "Baixar"/"Salvar" leva o `link`.
- Ginásio: console "trilha da aula: 2 música(s) · 2 pelo link"; link quebrado → "usando o pendrive".
- Aula em rede: START da mãe antes do horário − 5 min → aviso com o horário; SELECT nos primeiros 5 min → "Recomeçar a aula em rede?" → todas voltam ao QR.

**Cuidados**
- Link do Dropbox precisa ser "qualquer pessoa com o link". Arquivo grande no Google Drive (> 100 MB) pede confirmação e não toca; MP3 normal toca.

## 2026-10-02 · servidor + ginasio · 02/10e — aula ao vivo em rede (desafio ao vivo entre academias)

**O que mudou**
- **Servidor:** rotas `/display/rede/aula` (a TV da academia que criou o desafio publica a aula), `/display/rede/estado` (a cada segundo: onde a aula está, contagem, tocando, pausa, fim, transmitindo) e `/display/rede/agora` (as outras TVs leem). Fica só na memória do servidor. A busca do "desafio ao vivo agora" virou a função `daAgoraDe`.
- **Ginásio (`telas-pv.js`, BUILD 02/10e):**
  - mãe = a academia que criou o desafio ao vivo; ao chegar na tela do QR, publica a aula (blocos, segmentos, música) e passa o relógio a cada segundo;
  - nas outras, o início ganha a 1ª opção **"Aula ao vivo em rede"** → configurar (MP3 do pendrive daqui, pelos mesmos nomes) → QR esperando;
  - começam sozinhas com a contagem da mãe, seguem pausa, avanço e pulo de bloco (acerto fino no começo, depois só se passar de 1 s);
  - START numa TV atrasada entra no ponto em que a aula está; START antes da mãe começar só avisa;
  - se a mãe está em "Gravar e transmitir", o vídeo e a voz do professor aparecem num quadro no canto de cima (WebRTC, como o "Assistir" do app; conta no limite de pessoas da transmissão);
  - o início monta as opções por lista (`_escOps`, `_escMax`), sem índices fixos.

**Por quê**
- Pedido do Mario: dar uma aula e as outras academias do desafio seguirem junto, com o START central.

**Como confirmar**
- Criar um desafio ao vivo na academia A (horário agora) e entrar com o código na B.
- TV da A: abrir a aula até a tela do QR (console: "aula em rede publicada").
- TV da B: o início mostra "Aula ao vivo em rede" → configurar → QR. START na A → a B começa junto; pausar na A pausa a B.

**Cuidados**
- As outras academias precisam dos mesmos MP3 no pendrive (mesmo nome). Sem eles, a aula segue sem música.
- Se a mãe ficar 15 s sem mandar o relógio, as outras seguem sozinhas.

## 2026-10-02 · servidor + app · 02/10d — caixas da aula gravada mais justas; aulas gravadas abertas a qualquer login no teste

**O que mudou**
- **App (aula gravada, tela deitada):** as caixas de RPM e % FTP ficaram do tamanho do conteúdo (menos espaço vazio) e encostadas nas pontas da tela; o meio fica livre para o professor. Números do mesmo tamanho. A lista da Loja mostra o nome da academia.
- **Servidor:** na fase de teste, **qualquer login do app** vê e faz as aulas gravadas de todas as academias (`/user/gravadas`, roteiro, vídeo e resultado). Para voltar a limitar à academia do aluno: variável `GRAVADAS_SO_DA_ACADEMIA=1`.

**Por quê**
- Pedido do Mario: ganhar espaço no meio da tela e deixar o teste aberto; a regra de quem pode assistir (pagantes etc.) fica para depois.

**Como confirmar**
- Entrar no app com um aluno de outra academia (ou sem academia) → Loja → Aulas gravadas mostra as gravações de teste, com o nome da academia.

**Cuidados**
- Só o `server.js` e o `aluno/index.html` mudaram. O Ginásio é o mesmo da 02/10c (só o BUILD passou a 02/10d).

## 2026-10-02 · portal (Construtor) + ginasio · 02/10c — linha do tempo única, zoom com a roda do mouse e trecho de cada música

**O que mudou**
- **Construtor (`studio.html`):**
  - o gráfico da aula e as músicas ficam na **mesma linha do tempo**; a escala é a maior das duas (aula ou músicas), e uma linha marca o **fim da aula**;
  - **zoom com a roda do mouse** em cima do ponto do cursor; **Shift + roda** anda para os lados; botões − / + / "Aula inteira" e uma barra para arrastar;
  - cada música tem **"toca de … até …"** (escolher o começo e antecipar o fim);
  - botão **"✂ Cortar no fim da aula"** quando as músicas passam do fim;
  - a aula salva `musica.trilha=[{arquivo,ini,fim,dur}]` e, ao abrir de novo, os cortes voltam quando os MP3 são colocados.
- **Ginásio (`telas-pv.js`, BUILD 02/10c):**
  - lê `musica.trilha` e toca as músicas **em sequência**, cada uma no trecho escolhido, ancoradas no relógio da aula (pausa, avanço e volta de minimizado continuam certos);
  - acha cada arquivo no pendrive pelo nome (sem diferença de maiúscula, acento ou extensão); música que falta vira silêncio no trecho dela, e as seguintes continuam no tempo certo;
  - aula com uma música inteira segue o caminho antigo; se o professor troca a música na TV, vale a escolhida.

**Por quê**
- O Mario montou uma aula de 1 min com várias músicas: o gráfico parou e a música continuou. Ele pediu zoom pela roda do mouse e poder escolher o trecho de cada música.

**Como confirmar**
- Construtor: colocar 2 MP3 numa aula curta → aparece a linha "fim da aula"; rolar a roda em cima de um bloco aproxima; mudar "toca de/até" e ver a faixa encurtar; "Cortar no fim da aula" deixa música = aula.
- Ginásio: aula com 2 músicas cortadas → no console, "trilha da aula: 2 música(s)"; a 2ª começa no segundo escolhido quando a 1ª termina o trecho dela.

**Cuidados**
- Os MP3 precisam estar no pendrive com o **mesmo nome** usado no Construtor.

## 2026-10-02 · servidor + portal + app + ginasio · 02/10b — aula gravada no app (vídeo do professor + números do aluno) e sai a mensalidade

**O que mudou**
- **Gravação nova (Ginásio):**
  - o arquivo é a **câmera limpa** (vídeo + voz, 1,5 Mb/s, uns 0,6 GB por aula);
  - junto vai um **roteiro**: a cada segundo, o bloco, o segundo do bloco, a tela da TV (gráfico, cartões, ranking, FC), a pausa e o desafio;
  - o quadro com a faixa da aula só é montado para a transmissão;
  - `servidor-local.js`: `/gravacao/:id/roteiro` salva o `.json` ao lado do vídeo; `/gravacao/arquivo` serve o arquivo para o envio; o ajuste da duração termina antes de responder.
- **Teste sem nuvem (Servidor):**
  - a TV manda a gravação em pedaços de 8 MB (`/display/gravacao/:id/parte`, `/pronta`);
  - ficam no máximo 5 por academia, apagadas em 72 h (`GRAVACOES_TESTE_DIR`, padrão: pasta temporária);
  - rotas `/user/gravadas`, `/gravadas/:id/roteiro`, `/gravadas/:id/video?t=` (com Range) e `/user/gravadas/:id/resultado`;
  - ranking da aula = quem pedalou ao vivo (`aulas_tv`, pelo `uid`) + quem fez gravada (`gravadas_resultados`).
- **App:**
  - Loja → **Aulas gravadas**;
  - conectar a bike → tela deitada com o vídeo do professor no fundo;
  - na tela do gráfico: as bolas (RPM e watts do aluno, com o alvo) e o perfil com a agulha;
  - nas telas de cartões, ranking e FC: o **cartão do próprio aluno**;
  - no desafio: o mesmo desafio, **só com ele**;
  - WPP pela mesma conta da TV;
  - no fim: resultado, ranking junto com a sala, `.tcx` e histórico;
  - aviso "vire o celular de lado";
  - no lugar das bolas pequenas, **duas caixas grandes e meio transparentes** no meio da tela, uma de cada lado:
    - à esquerda, a **RPM** com o alvo; a borda fica verde dentro do alvo e laranja fora;
    - à direita, o **% do FTP** na cor da zona em que o aluno está, com o alvo e os watts;
  - o perfil da aula vai embaixo, de ponta a ponta;
  - ao lado da zona aparece **SENTADO / EM PÉ**, que vem da aula do Construtor;
  - super admin vê as gravações de teste de todas as academias;
  - **Construtor (`studio.html`):** sem blocos, a régua da música era fixa em 60 s; a trilha aparecia só no primeiro minuto e a agulha grudava no fim. Agora a régua é a própria música até entrar o primeiro bloco;
  - Loja: "ProHyder" corrigido para ProRider.
- **Sai a mensalidade da academia** (decisão do Mario): sem planos e assinaturas no Portal, no app e no servidor. A venda será aula por aula, na Loja.

**Por quê**
- Gravar a tela da TV mostraria os números de quem estava na sala, ficaria borrado no celular e não mediria o aluno. Com vídeo limpo + roteiro, o app monta tudo com os números de quem está pedalando, e o arquivo fica menor.

**Como confirmar**
- Ginásio → Câmera ao vivo → **Gravar** → dar a aula. No fim, o console da TV mostra "gravação pronta para testar no app".
- App (aluno da mesma academia) → **Loja** → Aulas gravadas → conectar a bike → a aula toca com os números dele. No fim, o ranking mistura "na sala" e "gravada".

**Cuidados**
- O teste usa a pasta temporária do servidor: um redeploy apaga as gravações de teste, que voltam na próxima aula gravada.
- Banda: cada gravação de teste sobe uns 0,6 GB pela internet da academia, em segundo plano.

## 2026-10-02 · servidor + portal + app + ginasio · 02/10a — desafio entre academias, gravar e transmitir, lista de espera, Strava, painel e planos

**O que mudou**
- **Desafio entre academias:**
  - **Servidor:** tabelas `aulas_tv`, `desafios_academias` e `desafios_academias_part`, mais as rotas:
    - `/gestor/desafios-academias*` e `/user/desafios-academias`;
    - `POST /display/aula/resumo` (resumo de toda aula que termina na TV);
    - `GET /display/desafio-academias/agora`;
    - WebSocket `duelo_entrar`/`duelo_placar` → `duelo_estado`.
  - **Portal:** página **Desafio entre academias** (criar, código, entrar com código, ranking).
  - **TV:** faixa ao vivo com o placar das academias e resultado no fim.
  - **App:** cartão no início.
- **Gravar e transmitir:**
  - **Ginásio:** o cartão da câmera tem 4 modos: Desligada / No fundo / Gravar / Gravar e transmitir. O quadro 1280x720 junta a câmera com a faixa da aula (zona, tempo, FTP, RPM, perfil, professor).
  - **`servidor-local.js`:**
    - `/gravacao/*` salva em `C:\ProRider\Gravacoes` e arruma a duração com o ffmpeg;
    - `/yt/*` manda para o YouTube Live pelo ffmpeg;
    - só aceita pedidos do próprio computador.
  - **Servidor:**
    - WebSocket `tx_estado`/`tx_ver`/`tx_sinal`/`tx_saiu` (WebRTC: o servidor só passa os recados);
    - `/gestor/transmissao` (chave do YouTube e limite de pessoas);
    - `/display/transmissao`, `/display/gravacao`;
    - `aula-ativa` devolve `transmitindo`.
  - **Portal:** página **Gravar e transmitir**.
  - **App:** "📺 Assistir ao vivo" na faixa verde.
- **Lista de espera, bike liberada e lembrete:**
  - **Servidor:**
    - tabela `aulas_espera` e rotas `/aluno/espera`, `/aluno/esperas`;
    - a vaga que abre (cancelou, professor marcou ausente, ou não subiu na bike até 5 min do começo) vai para o 1º da fila, na mesma bike, com e-mail "Abriu uma vaga";
    - lembrete por e-mail 1 h antes (`lembrete_aula`);
    - a TV marca presente quem está na bike reservada (`/display/reservas/presentes`), com ou sem app;
    - status `ausente` libera a bike: índice `aulas_reservas_bike_uniq2` no lugar do antigo.
  - **App:** "Lotado · entrar na fila", "⏳ Nº na fila · sair", fila em Minhas reservas.
  - **Portal:** 2 e-mails novos editáveis.
- **Strava/Garmin:** o app grava 1 ponto por segundo (potência, cadência, FC) e gera o `.tcx` na tela de resultado.
- **Painel do gestor:** `/gestor/ocupacao` (mapa dia × horário), `/gestor/sumidos` + "Chamar de volta" (e-mail na hora).
- **Planos:**
  - **Servidor:** tabelas `planos` e `assinaturas`; rotas `/gestor/planos`, `/gestor/assinaturas/:id`, `/user/planos` e `/user/assinar`.
  - **Portal:** página **Planos dos alunos**.
  - **App:** "Meu plano" no perfil.
  - O pagamento online fica desligado até contratar (`PAGAMENTO_GATEWAY`).
- **Pacotes:** `conferir_pacote.py` confere cada pacote antes de entregar (arquivos cortados, sintaxe, BUILD, telas).

**Por quê**
- O Mario pediu tudo da lista de melhorias, sem fechar com empresa paga. O que depende de contrato ficou com a estrutura pronta e desligada.

**Como confirmar**
- **Portal → Desafio entre academias:** criar e copiar o código; na outra academia, entrar com o código. Os dois aparecem no ranking.
- **Ginásio → Configurar aula → Câmera ao vivo → Gravar e transmitir:**
  - na aula aparece o selo AO VIVO;
  - no app, a faixa verde mostra "Assistir ao vivo";
  - no fim, o arquivo fica em `C:\ProRider\Gravacoes` e aparece no Portal.
- **App:** aula lotada → "entrar na fila"; quem reservou cancela → o 1º da fila ganha a bike.
- **App, tela de resultado:** "Arquivo para Strava / Garmin" baixa um `.tcx`.

**Cuidados**
- Publicar servidor + site + Ginásio juntos. O servidor cria tudo sozinho: `Migração 02/10a`, `02/10b`, `02/10c` e `02/10d` OK no log.
- YouTube Live precisa do ffmpeg no computador da TV (`C:\ProRider\ffmpeg\bin\ffmpeg.exe`) e da chave no Portal.
- Gravar/transmitir usa CPU e internet de subida: ~2,5 Mb/s por pessoa assistindo no app.

## 2026-10-01 · servidor + app + ginasio · 01/10f — reserva com escolha da bike

**O que mudou**
- **Servidor:**
  - `GET /aluno/agenda/:id/bikes?data=` — mapa das bikes da aula (total = bikes da licença; ocupadas; a minha).
  - `POST /aluno/reservar` aceita `bike` (1..total). Bike de outra pessoa → 409; reservar de novo troca a bike; a lotação não conta a própria reserva.
  - Índice único `aulas_reservas_bike_uniq` (aula + dia + bike, fora as canceladas). Se não puder ser criado, só avisa no log.
  - `GET /display/reservas/agora` — reservas da aula de agora para a TV (nome, foto, bike).
  - `entrar_sala` com `user_id`: a reserva de hoje vira `presente` na bike em que a pessoa sentou.
  - `/aluno/reservas` devolve `data_aula` como AAAA-MM-DD (o app mostrava "NaN").
- **App (`public/aluno/index.html`):**
  - Lupinha → academia → grade → **Reservar** abre o mapa das bikes. Só reserva depois de escolher a bike.
  - A grade mostra "✓ Bike N · trocar", e Minhas reservas mostra a bike.
  - Na hora de entrar (QR), a bike reservada vem destacada como "SUA RESERVA".
  - O app passa a mandar `user_id` no `entrar_sala`.
- **Ginásio:** reservas na tela do QR (cartão amarelo; verde pedalando), bike reservada bloqueada no `sala_info`. BUILD 01/10f.

**Por quê**
- O Mario viu que o app reservava direto, sem escolher a bike, e quem reservou não aparecia na TV.

**Como confirmar**
- Reservar pelo app escolhendo a bike 10 → na TV, a tela do QR mostra o nome na bike 10.
- Outro aluno no app vê a bike 10 ocupada.

**Cuidados**
- Publicar servidor e site juntos (o app novo chama a rota nova).
- Reservas antigas, sem bike, continuam valendo. Aparecem como "sem bike escolhida" e podem ser trocadas.

## 2026-10-01 · ginasio · 01/10e — correção: telas de preparar a aula sem visual, gráficos, controle e peso

**O que mudou**
- `style.css`: o 01/10d saiu com o fim do arquivo cortado (blocos `bgc-*`, `pa2-*`, `nv-*`, `pv-info`, `pv-clk`, `#prYTWrap`, `#cdSpotify`, `#cdJa`). Restaurado a partir do 01/10c, só com a troca do bloco da tela de espera.
- `telas-pv.js` `_pvBarras`: barras em posição absoluta pelo tempo (antes flex com 2 px de vão por bloco).
- `telas-pv.js` `mostrarEscolha`: START aceito após 450 ms, sem precisar mexer no direcional.
- `telas-pv.js` `_bgPrevLoop`: prévia parada só redesenha quando muda; cenário a ~30 quadros/s.
- `script.js` `_prCabeTexto`: só reajusta quando texto/largura mudam. Medido: layout da aula ao vivo 0,11 → 0,04 s por segundo.
- BUILD 01/10e.

**Por quê**
- O Mario viu as telas de origem, configurar e QR desmontadas, gráficos esticados, controle demorando e o sistema pesado.

**Como confirmar**
- As 4 telas de preparar a aula com cartões e cores; o eixo de minutos alinhado com as barras.
- Na tela inicial, START direto abre a opção marcada.

**Cuidados**
- Só Ginásio. Servidor e site iguais ao 01/10c/d.

## 2026-10-01 · ginasio · 01/10d — tela de espera opção 2 (logo no centro, aulas passando embaixo)

**O que mudou**
- Tela de espera da TV (`telas-pv.js` seção 10, `_gymGradeRender`; bloco idle do `style.css`):
  - logo original sempre centralizado, PRO/RIDER em 190 px, brilho laranja atrás;
  - com aula no dia: o logo sobe 70 px e as aulas de hoje passam numa faixa animada embaixo (CSS `@keyframes idleTick`, conteúdo duplicado, velocidade pela quantidade de aulas);
  - academia e data no canto superior esquerdo, relógio no superior direito;
  - sem aula: só o logo no centro.
- Tela inicial: BUILD 01/10d.

**Por quê**
- O Mario escolheu a opção 2 entre as sugestões ("a 2 ficou sensacional"), com as aulas rodando.

**Como confirmar**
- TV parada com aulas no dia: a faixa de aulas anda sem parar e não pula quando a grade atualiza.
- Sem aulas: logo centralizado sozinho.

**Cuidados**
- Só Ginásio (`telas-pv.js`, `style.css`, `script.js`, `LEIA-ME.txt`). Servidor e site iguais ao 01/10c.

## 2026-10-01 · ginasio + site · 01/10c — tela de espera original e logo original em todo lugar

**O que mudou**
- **Tela de espera:** volta a ser a original (fundo quadriculado, raio, PRO branco, RIDER em degradê, linha e "cycling performance").
  - Com aula no dia, a grade de hoje fica **flutuando à direita, no mesmo fundo**, sem painel e sem faixa de outra cor.
  - O logo desliza um pouco para a esquerda (classe `com-grade` no `#idleScreen`).
  - O layout de cartões grandes da 29/09a e o da 01/10b saíram.
- **Logo:** `logo-prorider.png` (em `gin/` e em `public/img/`) agora é o **logo original**: o raio, PRO RIDER e "cycling performance", desenhado com a mesma fonte e as mesmas cores da tela de espera, em PNG transparente.
  - Todas as telas usam esse arquivo, então a troca vale em todo lugar: TV, Portal, Construtor, app, totem, página pública e e-mails.
  - O arquivo antigo (a arte recortada) saiu do pacote.

**Por quê**
- O Mario identificou que o logo original é o da tela de espera antiga, e que a grade deve flutuar sobre o mesmo fundo.

**Como confirmar**
- Tela inicial: BUILD 01/10c.
- Com aula na grade de hoje, deixar a TV parada: logo original à esquerda e grade flutuando à direita.
- No Portal, o logo do menu lateral é o raio com PRO RIDER.

---

## 2026-10-01 · ginasio · 01/10b — tela de espera com símbolo, logo e grade na lateral

**O que mudou**
- A tela de espera com aulas no dia deixou de ser só os cartões grandes das aulas.
  - **No meio:** o símbolo (raio) com o logo original colorido embaixo, o nome da academia e a data; embaixo, km e kcal do clube.
  - **Na lateral direita:** a grade de hoje (horário, aula, professor, reservas). A aula ao vivo aparece em verde e a próxima em laranja, com "COMEÇA EM N MIN". As aulas já feitas ficam apagadas.
- O raio voltou também na tela de espera sem aula (símbolo + logo).
- A nova versão de `_gymGradeRender` fica em `telas-pv.js`.

**Por quê**
- Pedido do Mario: a tela principal é o símbolo com o nome, e a grade fica ao lado.

**Como confirmar**
- Tela inicial: BUILD 01/10b.
- Com aula na grade de hoje, deixar a TV parada até a tela de espera: logo no meio e grade à direita.

---

## 2026-10-01 · servidor + portal + ginasio + app · 01/10a — Campeonatos (Tour, Giro, Vuelta e Mundial)

**O que mudou**
- **Servidor.** Quatro tabelas novas, criadas sozinhas no arranque: `campeonatos`, `campeonato_etapas`, `campeonato_resultados` e `camisas_conquistadas`. O log mostra `Migração 01/10a (campeonatos) OK`.
  - **Pontos por etapa, pelo WPP:** 25, 20, 16, 13, 11, 10, 9, 8, 7, 6; do 11º em diante, 1 ponto. A etapa rainha vale em dobro. Quem falta fica com 0. A classificação é refeita depois de cada etapa, com a seta de quem subiu ou desceu.
  - **Camisas:** líder, pontos (sprint), montanha e estreante (cadastro com até 90 dias antes do início; se ninguém for novo, vale quem está no primeiro campeonato). Cada pessoa veste só uma camisa: se o líder também for o melhor sprinter, a camisa de pontos passa para o próximo, como no Tour.
  - **Cores por tipo:**
    - Tour: amarela, verde, bolinhas vermelhas e branca;
    - Giro: rosa, ciclamino, azzurra e bianca;
    - Vuelta: vermelha, verde, bolinhas azuis e branca;
    - Mundial: só a arco-íris, que fica com o campeão no final.
  - **Fim do campeonato:** na última etapa (ou em "Encerrar"), as camisas ficam gravadas em `camisas_conquistadas`. A pessoa leva a camisa para sempre: aparece no app e na TV de qualquer academia (mensagem `aluno_camisa` quando entra na sala).
  - **Rotas novas:**
    - Portal: `GET/POST /gestor/campeonatos`, `GET/PUT/DELETE /gestor/campeonatos/:id`, `POST /gestor/campeonatos/:id/encerrar` e `GET /gestor/campeonatos-grade?inicio&fim` (as aulas da grade no período);
    - TV: `GET /display/campeonato/hoje` e `POST /display/campeonato/resultado`;
    - leitura pública: `GET /campeonato/:id/classificacao`, sem `user_id`;
    - app: `GET /user/campeonatos` e `GET /user/camisas`.
  - `entrar_sala` passa a guardar o `user_id` na conexão, para ligar o resultado à conta. Nomes "Bike N" e alunos demo não entram no campeonato.
- **Portal.** Menu novo **Campeonatos**:
  - escolha do tipo (Tour, Giro, Vuelta, Mundial), nome e período;
  - as aulas da grade no período, com marcar etapa e tipo (plano, montanha, sprint, contra-relógio, rainha x2);
  - tabela de pontos, camisas com quem veste agora e a classificação geral;
  - Encerrar e Apagar.
  - Depois da primeira etapa, o tipo não muda, e uma etapa feita nunca some.
- **Ginásio (BUILD 01/10a).**
  - Na tela do QR, a TV descobre se a aula é etapa e mostra "🏁 Etapa N de M".
  - Durante a aula, soma sprint e montanha bloco a bloco. Por enquanto a detecção é automática (Z6/Z7 curtos = sprint; Z4+ de 2 min ou mais em pé = montanha); o Construtor ainda não tem campo para marcar o bloco.
  - No fim, manda o resultado e mostra a **classificação do campeonato** como 3ª tela (depois de AULA CONCLUÍDA e do RANKING), com as camisas, fotos e setas.
  - A camisa aparece ao lado do nome na grade de bikes e no ranking do fim.
- **App.**
  - No início, o cartão do campeonato: posição, seta, pontos, camisa que veste e próxima etapa.
  - No perfil, **Minhas camisas** com as camisas conquistadas.
  - Logo original também no início.

**Como confirmar**
- Portal → Campeonatos → Giro → marcar uma aula de hoje → Salvar.
- Na TV, abrir a aula no horário: aparece "Etapa 1 de N". Fim da aula → B (ranking) → qualquer botão → classificação do campeonato.
- Encerrar pelo Portal → o app do vencedor mostra a camisa em Minhas camisas.

**Cuidados**
- A etapa é reconhecida pelo **horário**: a aula precisa ser aberta de 1 h antes a 3 h depois do horário marcado.
- Aluno sem conta (sem `user_id`) entra na classificação pelo nome, mas não leva camisa para a conta nem conta como estreante.

---

## 2026-09-30 · ginasio · 30/09f — câmera ao vivo em cartão próprio

**O que mudou**
- Na tela Configurar aula, a câmera saiu das opções de vídeo e ganhou o cartão **"3 · Câmera ao vivo"**, com duas opções: "Câmera no fundo da aula" ou "Desligada". O cartão mostra quantas câmeras o computador encontrou (notebook ou USB no mini PC) e anuncia "em breve: gravar a aula para o app · transmitir ao vivo".
- Câmera ligada: o professor aparece atrás do gráfico, no lugar do vídeo e do cenário (os dois ficam apagados na tela).
- Nova ordem da navegação: Música → Vídeo → Câmera → Cenário → Iniciar.
- Os cartões ficaram mais compactos para caber os quatro.

**Por quê**
- Pedido do Mario: a câmera tem funções próprias (aula ao vivo no telão; no futuro, gravar e transmitir), e o professor precisa enxergar a opção.

**Como confirmar**
- Tela inicial: BUILD 30/09f.
- Configurar aula → cartão 3 → ←→ liga a câmera → a prévia mostra "CÂMERA AO VIVO" → Iniciar → a câmera aparece no fundo da aula.

---

## 2026-09-30 · ginasio · 30/09e — telas de preparar a aula no visual do Portal, YouTube e Spotify

**O que mudou**
- **Arquivo novo `telas-pv.js`**, carregado depois do `script.js`. Ele substitui as funções das telas de preparar a aula (`mostrarEscolha`, `_origemAulaEscolher`, `_nuvParear`, `_renderSistCats`, `_renderSistAulas`, `abrirBgPicker`, `bgConfirmar`, `mostrarPreAula`, `_renderPreAlunos`…). O visual novo usa as classes `pv-*`, `bgc-*`, `pa2-*` e `nv-*`, que ficam no fim do `style.css`. Tudo em px do desenho 1920×1080.
- **Início:** 3 opções (Aulas do sistema · Minhas aulas · Sessão livre), mais três cartões: aulas de hoje na grade, academia e licença, sistema online com relógio. A engrenagem das configurações continua piscando com L1+R1.
- **Minhas aulas → "De onde vem a aula?":**
  - **Da minha conta:** o QR já aparece dentro do cartão (sem apertar nada) e fica esperando o celular do professor. Erros, código expirado e acesso negado aparecem no próprio cartão; START gera outro código.
  - **Do pendrive:** mostra quantas aulas o pendrive tem e abre a pasta ProRider.
- **Aulas do sistema:** 5 objetivos em grade de 3 colunas. Cada um mostra o perfil típico (aquecimento progressivo → miolo → volta à calma), com a faixa AQUEC./PRINCIPAL/CALMA e o número de aulas. ←→ anda 1; ↑↓ anda uma linha (gamepad e teclado).
- **Lista de aulas:** lista mais painel de detalhe. O painel tem perfil com faixa e eixo de minutos, duração, TSS, FTP médio, desafios, tempo em cada zona, mídia gravada e "Usar esta aula". B volta para onde veio: objetivos, Minhas aulas ou início (`_usbVoltar`).
- **Configurar aula:**
  - **Música:** MP3 do pendrive / Spotify (ou Deezer, ou outro link) / sem música. Com playlist, aparecem o QR para o celular do professor e os 3 passos.
  - **Vídeo:** pendrive / YouTube / câmera / sem vídeo. O YouTube mostra miniatura, título, ponto de início e o aviso de anúncio.
  - **Cenário:** vale só sem vídeo.
  - **Resumo:** nome, professor, academia, bikes, alunos conectados, duração, blocos, TSS, desafios e a prévia "como vai aparecer na TV".
  - ↑↓ escolhe a parte e ←→ troca a opção.
  - A câmera saiu da lista de cenários, porque virou opção de vídeo.
- **QR code:**
  - **dois QRs grandes:** ① entrar na aula (código da sala) e ② baixar o app / abrir no navegador. O "Como entrar" virou uma linha no alto das bikes (pedido do Mario);
  - **bikes da sala** de 1 a N (teto da licença): verde com W e ♥ quando pedala, "na bike · parado", livre, DEMO. Os demos e quem ainda não escolheu bike ocupam as livres do fim;
  - contadores "X de N na bike · Y pedalando" e "N alunos demo";
  - perfil grande com faixa e eixo. A agulha do progresso continua (`preAulaAgulha`).
- **YouTube de fundo:** player da IFrame API em `#prYTWrap`, logo acima do `#backgroundVideo`, sem som.
  - Começa em `syncOffset − (aquecimento + principal)`, como o vídeo do pendrive.
  - Segue o relógio da aula por `_prMidiaSync`/`_prMidiaPausar`, que agora também mexem no YouTube: pausa junto, pula junto e corrige se passar de 2,5 s de diferença.
  - Mostra a etiqueta "YouTube · sincronizado".
  - Se o vídeo não tocar (sem internet, vídeo que não deixa incorporar), a aula segue com o cenário animado.
- **Contagem 3·2·1 com playlist:** mostra "No JÁ, dê play no Spotify" e, no fim, "JÁ! ▶ play" por 1,4 s. A aula (e o YouTube) começa no fim da contagem, como sempre.
- **Tela final, painel da esquerda:** gráfico mais baixo com a faixa AQUECIMENTO / BLOCO PRINCIPAL / VOLTA e o eixo de minutos, tempo em cada zona maior e "Destaques" (mais tempo no alvo e maior pico). Centro e pódio iguais.
- **Logo original** (`logo-prorider.png`) na tela de espera, no início, em todas as telas novas, na tela final, no ranking, no menu secreto e no pareamento.
- **Correção:** `abrirAula()` não copiava o `desafio` do bloco, então o desafio montado no Construtor não disparava na TV. Agora copia.

**Por quê**
- Telas aprovadas pelo Mario em 30/09 (imagens u1, u1b, u2, fc, u4 e t5), com o ajuste dos dois QRs grandes.

**Como confirmar**
- Tela inicial: BUILD 30/09e.
- Minhas aulas → o QR aparece sozinho no cartão da esquerda → ler com o app logado como professor, **inclusive de outra academia** → as aulas dele aparecem.
- Abrir uma aula do Construtor com playlist e YouTube → Configurar aula mostra os dois → Iniciar aula → QR → Iniciar: a contagem pede o play do Spotify e o YouTube entra no fundo, sem som.
- Aula com desafio no bloco → o desafio começa sozinho no bloco.

**Cuidados**
- O YouTube precisa de internet no computador da TV e funciona com o Ginásio aberto por `http://localhost:3000` (o `PRORIDER.bat` já abre assim).
- **No executável (Electron):** se a janela abre o `ginasio.html` como arquivo (`file://`), o YouTube pode recusar tocar ("erro 153", falta de origem). Nesse caso a aula segue sozinha com o cenário e o console mostra `[ProRider] YouTube não tocou`. A correção é o Electron abrir `http://localhost:3000/ginasio` (o `servidor-local.js` já serve a pasta) ou mandar um `Referer` http nas chamadas ao youtube.com.
- Anúncio: sem anúncio só se o navegador da TV estiver logado numa conta YouTube Premium. **Testar numa TV de verdade.**
- `telas-pv.js` precisa ir junto no pacote do Ginásio (o `ginasio.html` carrega esse arquivo).

---

## 2026-09-30 · servidor · 30/09e — e-mails editáveis e login de professor em qualquer academia

**O que mudou**
- **E-mails editáveis:** cada um dos 6 e-mails (boas-vindas, resumo da aula, sumido, novo FTP, aniversário, relatório do mês) tem assunto, título, abertura, fechamento, texto do botão e "mostrar os números".
  - Os textos da academia ficam em `licencas.emails_cfg.textos`, sem coluna nova.
  - Sem texto próprio, vale o padrão (`EMAIL_TEXTO_PADRAO`).
  - Variáveis conforme o e-mail: `{nome}` e `{academia}` em todos; `{aula}`, `{duracao}`, `{kcal}`, `{potencia}`, `{rpm}`, `{zona}`, `{pontos}` no resumo; `{dias}` no sumido; `{ftp_antes}`, `{ftp_novo}`, `{evolucao}` no novo FTP; `{mes}`, `{aulas}`, `{alunos}`, `{kcal}` no relatório.
- **Rotas de e-mail:**
  - `GET /gestor/emails` agora devolve também `padrao`;
  - nova `POST /gestor/emails/previa {tipo, texto}` monta o e-mail com dados de exemplo;
  - `PUT /gestor/emails` guarda `textos`, só os campos conhecidos e até 600 caracteres cada;
  - `POST /gestor/emails/teste` aceita `tipo` e manda o modelo com "[TESTE]".
- **Cabeçalho dos e-mails:** logo original (`PORTAL_URL/img/logo-prorider.png`) em fundo escuro.
- **Professor em qualquer academia:** `POST /professor/parear` aceita quem tem papel de professor, coordenador, gestor, admin ou super_admin, **em qualquer licença**. Um professor que dá aula em outra academia lê o QR e recebe as próprias aulas. Aluno continua recusado (403).
- **`temAcessoLicenca`:** quem foi convidado em "Equipe e acessos" passa pela academia da própria conta (`users.license_id`). Antes dava "Sem acesso a esta unidade".

**Como confirmar**
- Portal → E-mails automáticos → editar o texto → a prévia muda → "Mandar este e-mail para mim".
- Ler o QR de Minhas aulas de uma TV de outra academia com login de professor: as aulas aparecem.

**Cuidados**
- Nenhuma migração nova. `PORTAL_URL` precisa apontar para o site público, para o logo carregar nos e-mails.

---

## 2026-09-30 · portal · 30/09e — E-mails automáticos, Construtor no celular e logo original

**O que mudou**
- **Página "E-mails automáticos":**
  - lista dos 6 e-mails, cada um com chave liga/desliga;
  - editor de assunto, título, abertura, fechamento, botão e "mostrar os números";
  - as variáveis entram no cursor com um toque;
  - prévia ao vivo à direita;
  - "Voltar ao texto padrão", "Mandar este e-mail para mim" e "Salvar texto".
- **Construtor (`studio.html`) também no celular:**
  - usa o login do app (`pr_token`);
  - com `?de=app`, o "voltar" leva ao app;
  - no celular em pé, aparece a dica "vire o celular de lado", que dá para fechar;
  - importa aula do TrainingPeaks;
  - logo original no topo.
- **Logo original** (imagem) no lugar do texto "PRORIDER": Portal, portal do aluno, onboarding, totem e página pública.

---

## 2026-09-30 · app · 30/09e — Construtor do celular = Construtor online

**O que mudou**
- "Construtor de treino" no app abre o **mesmo Construtor online** (`/studio.html?de=app`), com as mesmas funções e a mesma conta. O construtor antigo do app ficou guardado em `_doOpenConstructorAntigo`.
- Logo original na entrada, no perfil e na tela de login.

---

## 2026-09-30 · portal · 30/09d — link do YouTube no Construtor

**O que mudou**
- Vídeo de fundo no Construtor: além do arquivo, **link do YouTube**. Aceita `watch?v=`, `youtu.be/`, `shorts/`, `live/` e `embed/`. Mostra a miniatura e lê a duração e o título pela API do YouTube quando dá; senão, a chegada é digitada à mão.
- O arquivo da aula grava `video:{fonte:'youtube', youtubeId, url, titulo, duracao, syncOffset}`. O `syncOffset` tem o mesmo significado do vídeo local: ponto de chegada, no fim do bloco principal.
- O Ginásio atual ignora `fonte:'youtube'` sem erro e roda a aula sem vídeo. Tocar o YouTube na TV é a próxima etapa (ver PENDENTES).

**Como confirmar**
- Construtor → Vídeo de fundo → Link do YouTube → colar → aparece a miniatura. Baixar para pendrive → o `.json` traz `"fonte":"youtube"`.

---

## 2026-09-30 · portal · 30/09c — Construtor de aulas online (visual novo)

**O que mudou**
- **`studio.html` refeito:** é o Construtor de aulas online, com o visual do Portal. O antigo "Studio Builder v1.0" saiu.
  - **Perfil da aula numa linha só:** cada bloco tem largura proporcional ao tempo, altura pela faixa de %FTP e cor da zona. Tem faixa dos segmentos, eixo em minutos e linhas de 50/100/150% FTP. Nada passa da tela e não há rolagem para o lado.
  - **Edição pelo gráfico:** clicar num bloco edita; arrastar muda a ordem, e o bloco entra no segmento de onde caiu. A tabela de blocos embaixo tem subir/descer/editar/duplicar/remover.
  - **Bloco completo:** minutos + segundos, zona (com as faixas do Ginásio), %FTP de–até editável, RPM, posição, observação e desafio automático (`desafio:{tipo,modo,seg}`, igual ao Ginásio).
  - **Trilha sonora no mesmo eixo de tempo:** vários MP3 viram uma playlist. A forma de onda aparece embaixo do gráfico, com as linhas das trocas de bloco atravessando os dois; dá para ouvir a partir de onde clicar. Avisa se falta música ou se sobra.
  - **Spotify / Deezer / link:** o link fica guardado na aula (`musica.link` / `musica.playlist`). Sem forma de onda, porque esses serviços não deixam o navegador ler o áudio.
  - **Vídeo de fundo:** nome do arquivo e ponto de chegada (`video.syncOffset`), com o aviso de vídeo curto.
  - **Salvar na minha conta** (`POST /professor/treinos`), com login do app dentro da página ou reaproveitando o login do Portal. A aula aparece no Ginásio em Minhas aulas.
  - **Baixar para pendrive:** `.json` v1.1, o mesmo formato do Ginásio (`durationSec`, `ftpMin/ftpMax`, `desafio`). Abre arquivos v1.0 (minutos) e v1.1.
  - **Aulas neste computador** e rascunho automático: não perde a aula se fechar a aba.
- **Portal:**
  - a aba "Criar aula" virou **Construtor de aulas**, só com o construtor online (abrir + copiar o link para o professor + como a aula chega na TV). Saíram "Construtor no app", "Agendar na grade" (continua na Agenda da semana), "Aula ao vivo agora" e "Studio Builder";
  - o destaque do Início abre o Construtor online;
  - **o professor passa a entrar no Portal** e vê só **Construtor de aulas** e **Meu perfil**, abrindo direto no Construtor. Antes, o login de professor era mandado para o app.

**Por quê**
- O Mario montou uma aula no Studio Builder e os blocos passavam da tela, sem rolagem. Ele também pediu o visual do Portal, o nome "Construtor de aulas", só essa função na aba, acesso para gestor, coordenador e professor, e a música no mesmo tempo do gráfico.

**Como confirmar**
- Portal → Construtor de aulas → Abrir o Construtor. Monte ~20 blocos: tudo cabe na largura. Adicione 2 MP3: a trilha aparece embaixo, e "Ouvir" anda com a linha branca. Salvar na minha conta → a aula aparece em Minhas aulas no Ginásio.
- Entrar no Portal com um professor: só aparecem Construtor de aulas e Meu perfil.

**Cuidados**
- Servidor, app e Ginásio não mudam.
- A página é pública, como antes, e qualquer um com o link monta e baixa aulas. Salvar na conta exige login.

---

## 2026-09-30 · ginasio · 30/09b — gráfico ~25% maior

**O que mudou**
- `_pg2Encaixar`: o gráfico pode subir `PG2_SOBE = 32` px (do desenho 1920×1080) acima do topo dos círculos. Só o nome do segmento e os rótulos das zonas passam dessa linha; os cartões continuam na faixa dos círculos.
- Em 1920×1080, os cartões vão de k 0,61 para **0,77** (+26%). Com o RT (caixas escondidas), vão de 0,80 para **1,00**: o gráfico desce e fica 30% maior que o normal, e a regra continua valendo.
- Medido: 14,7% da altura em 1920×1080, 14,3% em 1280×720 (escala do Windows 150%) e 15,8% em 4K.

**Por quê**
- O Mario viu o 30/09a e pediu o gráfico um pouco maior.

**Como confirmar**
- BUILD 30/09b. Na aula, o bloco mais alto encosta perto do topo dos círculos. Com o RT, as caixas somem e o gráfico desce e cresce.

---

## 2026-09-30 · ginasio · 30/09a — gráfico no tamanho certo, imersão em tela cheia, regra do SELECT

**O que mudou**
- **Gráfico 2 (cartões) no tamanho do projeto em qualquer TV.**
  - As alturas eram em `vh` (`clamp(58px, X vh, 235px)`) e o `hMax` do `_pg2Encaixar` usava `window.innerHeight`. Por cima disso, `_scaleApp` aplica `body.style.zoom = min(W/1920, H/1080)`, e o gráfico era escalado duas vezes.
  - Numa janela de 1280×720 CSS (TV 1080p com escala do Windows em 150%), os cartões ocupavam 7,5% da altura da tela em vez de 11,8%. Em 4K sem escala, estouravam para cima (21,8%).
  - Agora as alturas são px do desenho 1920×1080 (`h × 1080/100`), e o `hMax` é convertido para a mesma unidade das medidas da tela (`getBoundingClientRect` ÷ `offsetHeight`).
  - Medido: 11,8% em 1920×1080, 11,3% em 1280×720 e 12,8% em 3840×2160. Em 1920×1080 nada muda.
- **Tela de imersão (LB+RB 5 s) cobrindo a TV inteira.**
  - O canvas ia dentro do `<body>` com zoom, e `100vw/100vh` eram reduzidos pelo zoom: em 1280×720 ficava 853×480, no canto de cima à esquerda.
  - Agora vai no `<html>`, fora do zoom, e mede 1280×720.
- **Regra do SELECT** (Mario), toda em `handleSelect()`:
  - teste de FTP rodando: o 1º SELECT para na hora, sem pergunta, e mostra o resultado; o 2º fecha o resultado e volta ao gráfico principal (`ctrlSetScreen(0)`);
  - desafio: igual. Antes, o resultado do desafio só fechava com START, e o SELECT perguntava se queria encerrar a aula;
  - imersão: o SELECT sai e volta ao gráfico principal (B e LB+RB continuam saindo);
  - nada disso ativo: o SELECT pergunta se quer encerrar a aula, como antes.
  - O controle e o teclado (`q`) passam pela mesma função.

**Por quê**
- Teste do Mario na TV do Clube em 29/09: gráfico menor que o projetado, imersão só num canto, SELECT fora da regra combinada.

**Como confirmar**
- Tela inicial com **BUILD 30/09a**.
- Na aula, o gráfico tem a mesma proporção em qualquer TV. LB+RB 5 s escurece a TV inteira, e o SELECT sai.
- Teste de FTP: SELECT → resultado; SELECT → gráfico. Desafio: igual. Sem nada rodando: SELECT → "Encerrar aula?".

**Cuidados**
- O servidor, o Portal e o app não mudam.
- Outras telas antigas ainda usam `vh` (tela de licença vencida e escolha de nuvem). São telas cheias e não tiveram queixa; ficam anotadas.

---

## 2026-09-29 · servidor + portal + app · 29/09c — localização ("Perto de mim")

**O que mudou**
- **App, lupinha (Agenda → Buscar academia):**
  - botão **"Perto de mim"**: usa o GPS do celular e lista as academias por distância ("300 m", "5,9 km");
  - se o aluno já deu permissão antes, a lista já abre em ordem de distância;
  - academia com aula aberta agora ganha a etiqueta verde **"AULA AGORA / AULA ABRINDO · N bikes livres"**. Sem GPS, ela vai para o topo, no grupo "Aula acontecendo agora";
  - a busca por texto também acha pelo **bairro** e ignora acentos ("sao paulo" acha "São Paulo");
  - permissão negada: o app explica como liberar e a busca por cidade continua funcionando.
- **Portal, "Página no site" → cartão "📍 Localização no app":**
  - "Estou na academia: usar este aparelho" (GPS);
  - "Buscar pelo endereço";
  - colar coordenadas ou um link do Google Maps;
  - mostra de onde veio a localização e o link "ver no mapa".
  - Na **Grade**, aparece um aviso enquanto a academia não tiver localização.
- **Servidor:**
  - `GET /agenda/cidades` aceita `?lat=&lng=` e devolve `dist_km`, `bairro`, `ao_vivo` e `tem_localizacao`. Sem posição, a resposta é igual à de antes (compatível com o app antigo). Agora também aparece a academia com aula aberta mesmo sem grade;
  - rotas novas `GET/PUT /gestor/localizacao`;
  - ao criar ou editar uma licença no Portal do super admin, o servidor procura o endereço no mapa sozinho (OpenStreetMap / Nominatim, grátis, sem chave). Na primeira subida, ele preenche as academias que já têm endereço (até 50, uma por segundo).
- **Banco:** colunas novas `licencas.geo_fonte` (`gps` | `manual` | `endereco`) e `licencas.geo_em`. As colunas `lat`/`lng` já existiam e agora são usadas.

**Por quê**
- O Mario pediu busca por localização na lupinha: o aluno acha a academia mais perto e entra na aula que está acontecendo.

**Como confirmar**
- O log mostra `Migração 29/09c (localização) OK` e, alguns segundos depois, uma linha `geo: CODIGO → lat,lng` para cada academia com endereço.
- `GET /agenda/cidades?lat=-23.56&lng=-46.70` traz `dist_km` e vem em ordem de distância.
- Portal → Página no site: o cartão mostra "✓ Aparece no Perto de mim" e o link do mapa abre no lugar certo.
- No celular (https), abra o app → Agenda → **Perto de mim** → permitir: aparece a distância.

**Cuidados**
- A localização do aluno não é gravada: vai só na busca, arredondada para cerca de 10 m.
- A busca pelo endereço nunca sobrescreve uma localização marcada pelo GPS ou colada à mão.
- O Nominatim pede no máximo 1 consulta por segundo e um contato no User-Agent. O servidor respeita isso. A variável opcional `GEOCODER_EMAIL` troca o contato (o padrão é contato@prorider.app).
- A localização por endereço é aproximada (às vezes cai no meio da rua ou do bairro). O melhor é o gestor tocar "Estou na academia" uma vez, pelo celular.
- O Ginásio não mudou: continua o BUILD 29/09b.

---

## 2026-09-29 · servidor + portal + ginasio · 29/09b (substitui a 29/09a, que não foi publicada)

**O que mudou**
- **Entrada do site idêntica à arte do marketing.** A arte aprovada (`img/entrada-arte.jpg`, 1586×992) é o fundo. Por cima, nos mesmos lugares, ficam só as partes vivas:
  - campos de e-mail e senha, botão Entrar, "Esqueci a senha" e "Sou aluno → app";
  - o card do vídeo;
  - os 6 números ao vivo, com as linhas verdes embaixo.

  A arte escala inteira na tela (sem cortar); sobra lateral é preenchida com a própria arte desfocada.
  - Celular em pé (ou tela estreita): versão empilhada, usando o logo e o título recortados da arte (`img/entrada-logo.jpg`, `img/entrada-titulo.jpg`).
- **Brasões — escada nova, pedida pelo Mario:**
  - 3 brasões antes do Bronze: **Aquecimento** (0), **Cadência** (200) e **Pelotão** (400);
  - Bronze começa em **600**: I 600 · II 900 · III 1.200;
  - Prata 1.600 · 2.100 · 2.700;
  - Ouro 3.400 · 4.300 · 5.300;
  - Platina 6.500 · 8.000 · 9.700;
  - Diamante 11.800 · 14.300 · 17.200;
  - Mestre **25.000** (~1 ano com 3 aulas/semana) e Lenda **35.000** (~1,5 ano).

  Servidor (`NIVEIS`), `brasoes.js` e a migração (recalcula todo mundo) usam a mesma tabela.
  - Chaves antigas continuam valendo: `iniciante` → `aquecimento`.
  - O brasão de Aquecimento não aparece ao lado do nome na TV nem na página pública.
- Ginásio BUILD 29/09b: `brasoes.js` novo e a regra do Aquecimento.

**Por quê**
- O Mario pediu a tela de entrada igual à arte do marketing, sem diferença.
- Bronze com 2 aulas era rápido demais, e o topo precisava ser alcançável em 1 a 1,5 ano.

**Como confirmar**
- A raiz do site, num computador, fica igual à arte, com os números mudando.
- Num usuário com 900 pontos, `level` = `bronze2`.

---

## 2026-09-29 · servidor + portal + ginasio + app · 29/09a

**O que mudou — Portal / site (`public/`)**
- **Tela de entrada nova** em `index.html` (raiz do site) e `academia.html`, na arte aprovada pelo Mario:
  - "Ride with Purpose" em pincel e a foto do ciclista (`img/entrada-ciclista.jpg`);
  - login flutuante, 4 recursos, card "Assista ao vídeo" (link em `PR_VIDEO_URL`, vazio = "em breve") e a faixa de zonas Z1–Z6;
  - **6 contadores ao vivo** vindos de `/public/stats`, atualizados a cada 30 s: atletas, km, kcal, aulas, horas e WPP total;
  - no celular, o login sobe logo depois do título.
- **Página no site** (menu nova no painel da academia): a página pública `academia-publica.html?c=CÓDIGO`, com link e código de iframe.
  - Mostra números, grade da semana, ranking do mês com brasão e foto, e "Aula agora".
  - O gestor liga e desliga cada parte, escolhe a cor e a ordem do ranking.
  - Só aparece o primeiro nome e a inicial do sobrenome.
- **Totem na porta** (menu nova): link secreto por licença para `totem.html` (tablet), com QR e "Trocar código".
  - O totem faz: reservar pelo e-mail, cadastro rápido (nome, e-mail opcional, sexo, FTP ou 3 perguntas ou pular, foto pela câmera), pedalar sem conta e **entrar na aula aberta escolhendo a bike**.
  - Volta ao início sozinho em 60 s e bloqueia o botão voltar e o menu.
- **Brasões:** `brasoes.js` desenha os 7 brasões, com degraus I–III do Bronze ao Diamante. O portal do aluno (`aluno.html`) usa os brasões novos.
- **QR das bikes:** as imagens vinham quebradas (o gerador do Google foi desligado); agora usa `api.qrserver.com`.

**O que mudou — servidor**
- **Brasões:** `calcLevel` segue a escada nova (300 · 600 · 900 · 1.200 · 1.700 · 2.200 · 3.000 … 45.000) e a migração recalcula o nível de todo mundo. `aluno_conectou` leva `nivel` para o Ginásio.
- **Aula ativa pela sala do Ginásio:** `/agenda/aula-ativa/:lic` usa `sala.licenca`. Vale da pré-aula ao fim, inclusive aula fora da grade.
  - Devolve nome, professor, pedalando, bikes livres e a lista de bikes.
  - O `sala_info` aceita `aula {nome, professor, duracao_min}`.
  - Nova pré-aula na mesma sala, 60 s depois de um `fim_aula`, reabre a sala.
- **Rotas novas:**
  - `GET /public/stats` (cache de 30 s; o "ao vivo" é na hora);
  - `GET /public/academia/:codigo`;
  - `GET/PUT /gestor/pagina`;
  - `GET /gestor/totem` (`?novo=1` troca o código);
  - `GET /totem/:t/info`;
  - `POST /totem/:t/identificar`, `/cadastro`, `/foto`, `/reservar` e `/entrar`.
- **Totem na sala:** `POST /totem/:t/entrar` manda `aluno_conectou {totem:true, bike, ftpBase, foto, genero}` ao Ginásio e guarda o aluno em `sala.totem`.
  - `sala_criada` inclui esses alunos, para não perderem a bike numa reconexão.
  - Quem tinha reserva vira `presente`, com a bike anotada.
- **Km:** o banco não guarda distância. Ela é estimada pela potência média e pela duração: v = (P/0,25)^(1/3), ≈ 33 km/h a 200 W.
- **Ajustes:**
  - `/display/agenda` traz o professor pelo nome digitado (antes vinha vazio sem `professor_id`), `reservas_hoje` e as vagas limitadas pelas bikes;
  - `/display/licenca` traz os `numeros` do clube;
  - `express.json` com limite de 1 MB, por causa da foto do totem;
  - o e-mail de boas-vindas do totem leva a senha provisória.
- **Banco (automático):** colunas `licencas.pagina_cfg` e `licencas.totem_token`; recálculo de `users.level`.

**O que mudou — Ginásio BUILD 29/09a**
- A tela de espera mostra as aulas do dia em cartões grandes, com destaque, contagem regressiva, rodapé com as aulas feitas e km/kcal do clube.
- Brasão ao lado do nome no Ranking. `brasoes.js` na pasta.
- `sala_info` leva a aula aberta (nome da pré-aula e professor da grade).

**O que mudou — app BUILD 29/09a**
- Faixa **verde** "Entrar na aula" na academia (Agenda → buscar academia), atualizada a cada 15 s, com o selo "fora da grade".
- A grade mostra as aulas de **hoje** que ainda não acabaram. Antes, elas pulavam para a semana seguinte, e a data da reserva virava o dia seguinte depois das 21h (UTC).
- Brasão no perfil e no resumo da aula; tela de comemoração ao subir de brasão. O app manda `nivel` ao entrar na sala.

**Por quê**
- Tudo aprovado pelo Mario em 29/09: entrada do site na arte dele, faixa verde, aulas na TV, brasões, página da academia e totem.

**Como confirmar**
- Local, com PostgreSQL 16:
  - 30 verificações de API (brasões, stats, aula ativa, página, totem completo: reservar, cadastrar, entrar, reconexão, fim, troca de código);
  - telas do totem, da página pública, do painel, do app e do Ginásio renderizadas sem erro de página.
- Em produção:
  - a raiz do site mostra "RIDE WITH PURPOSE" com números;
  - com o Ginásio na pré-aula, o app mostra a faixa verde na academia.

**Cuidados**
- Publicar o **servidor antes** do Portal e do app.
- Criar `public/img/`.
- `PR_VIDEO_URL`, nas duas páginas de entrada, fica vazio até o Mario mandar o link do vídeo.
- Quem pedala pelo totem **sem app** ainda não tem a aula gravada no histórico (está em PENDENTES.md).

---

## 2026-09-29 · servidor · 26/09h

**O que mudou**
- As rotas de setup passam a exigir a variável de ambiente `SETUP_KEY` (12 caracteres ou mais). A comparação é feita em tempo constante. Sem a variável, as rotas respondem 404:
  - `POST /admin/criar-admin`
  - `POST /admin/setup-promote`
  - `POST /setup/bootstrap`
  - `POST /setup/sessao-teste`

**Por quê**
- As chaves tinham valor padrão escrito no código (`prorider_setup_2026` / `prorider-setup-2026`). Quem lesse o código podia:
  - criar um admin;
  - promover qualquer conta a `super_admin`;
  - trocar a senha de qualquer e-mail (`criar-admin` faz `ON CONFLICT ... SET password_hash`).

**Como confirmar**
- Sem `SETUP_KEY`: `POST /admin/setup-promote` com a chave antiga devolve 404.
- Com `SETUP_KEY`: a chave certa funciona; a antiga devolve 404.

**Cuidados**
- Nenhuma tela usa estas rotas. Se um dia precisar do setup, defina `SETUP_KEY` no Railway, use e apague a variável depois.

---

## 2026-09-29 · servidor · 26/09g (feito pelo desenvolvedor, commit 0a6ff29)

**O que mudou**
- `GET /ping` sem `db_url_preview`, `db_url_set` e `db_pool`. Versão "2.3" (antes "2.3-debug").

**Por quê**
- A prévia expunha o começo da `DATABASE_URL`, com parte da senha do Postgres, numa rota pública.

---

## 2026-09-29 · servidor · 26/09f

**O que mudou**
- `/agenda/cidades` e `/agenda/grade/:id` usam a cidade do endereço (`cidade_lic`) quando `cidade` está vazia.
- `PUT /admin/licencas/:id` passa a gravar `cidade` junto com `cidade_lic`.

**Por quê**
- O Portal grava a cidade em `cidade_lic`, mas a busca de academias do app ("Buscar academia", na Agenda) exigia `cidade`. Uma licença com endereço preenchido pelo Portal e grade pronta não aparecia na busca.

**Como confirmar**
- Com a cidade preenchida no Portal, uma aula na grade e a licença com status `ativa`, a academia aparece no app em Agenda → Buscar academia.

**Cuidados**
- Nenhum. Só leitura e uma coluna a mais no `UPDATE`.

---

## 2026-09-26 · portal + servidor + ginasio + app · 26/09e

**O que mudou — Portal (`public/index.html` e `public/academia.html`)**
- Visual novo, no padrão das telas do Ginásio: menu lateral fixo, cartão "Meu perfil" no rodapé do menu.
- **Super admin (`index.html`)**
  - O login aceita `super_admin`: antes só entrava quem era `admin`, e por isso o super admin não achava onde criar licença.
  - Gestor, coordenador ou financeiro que entra por aqui é levado ao painel da academia.
  - Licenças: colunas de gestor, bikes, última aula e **Ginásio (TV)** — o BUILD de cada TV, se está online e o aviso "atualizar".
  - O botão "Entrar →" funciona com um clique.
  - "+ Nova licença" abre um painel lateral com:
    - endereço;
    - gestor (nome e e-mail);
    - e-mail de boas-vindas.

    Ao criar, mostra o login e a senha provisória do gestor.
- **Modo suporte:** barra fixa no topo, "Você está vendo: X como gestor · ← Voltar ao meu painel". O botão volta para a lista de licenças.
- **Painel da academia (`academia.html`)**
  - O menu muda conforme o papel (gestor, coordenador, financeiro, admin).
  - Páginas novas:

    | Página | O que tem |
    |---|---|
    | Início | "Criar aula" em destaque, números da semana, agenda visual, top da semana |
    | Criar aula | Construtor do app, agendar na grade, aula ao vivo, Studio Builder |
    | Equipe e acessos | Convidar pessoa, trocar papel, tabela de permissões |
    | Ranking na TV | Campos, ordem, prévia |
    | E-mails automáticos | Liga/desliga cada e-mail e manda um teste |
    | Meu perfil | Nome, e-mail, nascimento, sexo, peso, altura, FTP; troca de senha |
  - **Alunos:** a lista fica fechada por padrão. Tem busca com lupa, seta para abrir e filtros:
    - Ativos;
    - Sumidos;
    - Novos;
    - Nunca pedalaram.

    Também mostra aniversariantes do mês e exporta CSV.
  - A página abre direto pelo endereço (`academia.html#alunos`, `#rankingtv`, …).

**O que mudou — servidor**
- **Histórico:** `/aula/complete` passa a gravar também em `aula_historico`.
  - Antes, o app gravava só em `aulas_completadas`, mas dashboard, alunos, relatórios e ranking do Portal leem `aula_historico` — por isso o gestor via tudo zerado.
  - Na migração, as aulas antigas são copiadas para `aula_historico`, sem duplicar.
- **Aluno ligado à academia:** `criar_sala` aceita `display_token`. No `entrar_sala` com `user_id`, o aluno sem academia (role `aluno`) recebe o `license_id` da sala. Nunca troca quem já tem academia.
- **Níveis de acesso:** `gestorAuth` aceita `coordenador` e `financeiro`.
  - Financeiro: só `GET` em stats, relatório, alunos, config e leaderboard.
  - Coordenador: tudo, menos alterar bikes e o ranking da TV.
  - `professorAuth` passa a aceitar `coordenador`.
- **Rotas novas:**

  | Rota | Método |
  |---|---|
  | `/gestor/config/ranking` | `GET` / `PUT` |
  | `/gestor/emails` | `GET` / `PUT` |
  | `/gestor/emails/teste` | `POST` |
  | `/gestor/equipe` | `GET` / `POST` |
  | `/gestor/equipe/:id/papel` | `PUT` |
  | `/user/senha` | `PUT` |
- **Rotas alteradas:**
  - `POST /admin/licencas`: aceita endereço e `gestor_nome`/`gestor_email`. Cria o login do gestor com senha provisória (ou promove a conta existente) e manda o e-mail de boas-vindas. O mínimo de 10 bikes continua.
  - `GET /admin/licencas`: traz `ginasio_build`, `ginasio_visto`, `ultima_aula`, `gestor_nome`.
  - `GET /gestor/stats`: traz `ativos_30d`, `visitas_7d`, `novos_30d`, `sumidos`, `aulas_grade`, `top_semana`.
  - `GET /gestor/alunos`: traz idade, sexo, nascimento, `aulas_30d`.
  - `GET /gestor/config`: traz `nome`.
  - `/user/me` e `PUT /user/profile`: aceitam `nascimento` (a idade é calculada a partir dele).
- **Versão do Ginásio:** `displayAuth` grava o cabeçalho `X-PR-Build` em `licenca_computadores.build`. `/display/ativar` aceita `build`. `/display/ativar` e `/display/licenca` devolvem `ranking_cfg`.
- **E-mails automáticos:**
  - Tipos: boas-vindas, resumo da aula, novo FTP, sumido há 14 dias, aniversário, relatório mensal.
  - A rotina diária roda às 10h de Brasília. O relatório mensal sai no dia 1º.
  - Configuração por licença em `licencas.emails_cfg`. `email_log` impede repetir o mesmo e-mail.
- **Banco (migração automática):**
  - `licencas.ranking_cfg` e `licencas.emails_cfg` (JSONB);
  - `licenca_computadores.build`;
  - `users.nascimento` e `users.foto_url`;
  - tabela `email_log`.

**O que mudou — Ginásio BUILD 26/09e**
- A tela de Ranking (B) monta as colunas e a ordem pela configuração da licença.
  - Colunas: zona, rpm, ftp, watts, kcal, **fc** (nova), wpp.
  - Ordem: wpp, kcal, watts, ftp.
  - O subtítulo mostra a ordem.
- Envia `X-PR-Build` nas chamadas `/display/*` e `build` na ativação. `/display/licenca` passa a ser consultado a cada 15 min (antes 6 h).
- `criar_sala` leva o token do display.

**O que mudou — app 26/09e**
- `/aluno#construtor` abre direto o Construtor para professor, coordenador, gestor e admin. É o botão "Criar aula" do Portal.

**Por quê**
- Pedidos do Mario para o Portal:
  - voltar da licença;
  - criar licença;
  - menu e perfil por papel;
  - lista de alunos com lupa;
  - campos do ranking por licença;
  - e-mails automáticos;
  - níveis de acesso;
  - Criar aula visível.

**Como confirmar**
- Entrar em `index.html` com o super admin. A lista de licenças mostra a coluna "Ginásio (TV)", e "+ Nova licença" cria a licença com o gestor.
- "Entrar →" leva ao painel com a barra azul. "Voltar ao meu painel" volta para a lista.
- Em Ranking na TV, desligue RPM, ligue FC e ordene por Kcal. Salve e reabra o Ginásio: o Console mostra `ranking da TV: zona, ftp, watts, kcal, wpp, fc — ordem por kcal`.
- Depois de uma aula feita pelo app, o Início do gestor mostra "Aulas concluídas (7 dias)" acima de zero.
- Testado localmente com PostgreSQL 16:
  - 34 verificações de API (papéis, licença, ranking, e-mails, Ginásio, aluno ligado, histórico);
  - envio real com Resend simulado (boas-vindas, teste, resumo, novo FTP uma só vez);
  - telas em 1440×900 sem erro de página.

**Cuidados**
- **E-mail:** nada é enviado enquanto o Railway não tiver `RESEND_API_KEY` (mais simples) ou `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`. O SMTP também precisa do pacote `nodemailer` (`npm i nodemailer`). Também:
  - `EMAIL_FROM` define o remetente;
  - `PORTAL_URL` define o link dos botões.

  Sem nada disso, o Portal avisa "e-mail não configurado", e a senha provisória aparece na tela para ser passada à mão.
- Publicar o **servidor antes** do Portal: as páginas novas chamam rotas novas.
- O Ginásio 26/09d continua funcionando com o servidor novo, mas sem o ranking do Portal e sem informar a versão.

---

## 2026-09-26 · servidor 26/09d

**O que mudou**
- Novo caso WebSocket `ftp_resultado` (professor → **um** aluno, pelo nome): repassa `{nome, ftp, ant, protocolo}`.
- **Fim de aula garantido:** `fim_aula` marca `estado.encerrada`, que é zerado em `iniciar_aula`/`update_aula`. Quem (re)entra numa sala com a aula encerrada recebe `fim_aula` na hora. A limpeza de salas passa a contar os 3 min sem professor **mesmo com alunos** (antes nunca contava, e com o Ginásio fechado os celulares ficavam "em aula" para sempre) e envia `sala_encerrada`.

**Por quê**
- O Ginásio sempre enviou o FTP do teste para cada aluno, mas o servidor não tinha esse caso e descartava a mensagem: o FTP nunca chegava ao celular.
- Mario (26/09): fechando o programa, o celular não recebia o fim; encerrando do jeito certo, uma vez a aula também não terminou no celular.

**Como confirmar**
- Teste de FTP na aula com um aluno pelo app: ao encerrar, o celular mostra "Seu novo FTP". No log: `FTP …W enviado para …`.

---

## 2026-09-26 · app 26/09d

**O que mudou**
- FC da cinta/relógio ligado no celular vai para o Ginásio (`dados_aluno.fc`, 1×/s). "Avg. HR" passa a ser a média da aula (antes, a FC do instante); tudo passa por `_appHr`.
- Em aula, se o servidor responde que a sala não existe/foi encerrada, o app fecha a aula e mostra o resultado (antes ficava tentando reconectar).
- Resultado do teste de FTP da aula no celular (`_ftpResultadoApp`, 60 s na tela). Com atualização automática ligada, grava e avisa; desligada, pergunta "Atualizar meu FTP / Agora não" e só grava no sim. Nos dois casos, o novo FTP vale para o resto da aula. `aplicarFtpResultado(ftp, forcar)`.

**Como confirmar**
- `/aluno` → `[ProRider Aluno] BUILD 26/09d`.

---

## 2026-09-26 · ginasio 26/09d

**O que mudou**
- Fluidez em todo o sistema. A regra agora é: nunca refazer a tela inteira. Monta-se o HTML novo fora da tela e aplica-se só o que mudou (`_prMorphHTML` / `_prMorphFilhos`, sobre `_desMorph`). Coisas que dependem do tempo andam a cada quadro (`_prAnimar`, com `requestAnimationFrame`).
- Anel do teste de FTP atualizado a cada quadro pelo relógio real (`ftp-arco`). O relógio do teste (`profFtpInt`) passou a contar pelo relógio real, sem acumular atraso de `setInterval`.
- Desafio e teste de FTP: de 4 para 10 atualizações por segundo; transições de 0,12 a 0,15 s.
- Cartões de Potência e Rotação e o Ranking: de 4 para ~7 atualizações por segundo, atualizados no lugar (antes, `innerHTML` refazia a grade inteira).
- Agulha do perfil na tela do QR: de 1 para 5 atualizações por segundo.
- **Modo espaço** (`espacoLigar` / `espacoDesligar`): segurar LB+RB por 1 s na aula abre, em tela cheia, um canvas preto com estrelas vindo em direção a quem olha, em projeção 3D (sem planeta, pedido do Mario). A velocidade segue a razão média watts/FTP da sala, suavizada. LB+RB (5 s) de novo ou B fecham; atalho de teclado Shift+E.
- Teste de FTP — participação: entra só quem mandou ≥5 W em algum momento dos **10 primeiros segundos** (`FTP_JANELA_S`); a decisão sai aos 10 s (`_ftpDecidido`). Só os participantes recebem `ftp_resultado`, agora com `ant`. O resultado final congela a lista (`_ftpFinalSnap`).
- Tela do QR na aula: lista sem rolagem (`_qrListaRender`). As linhas crescem até 96 px; se não couber, rodízio de 10 s. Atualizada no lugar, também pelo tick da aula.
- Ranking: acima de 20 alunos, 20 por vez em rodízio de 10 s (`#rkPagInfo`); em duas colunas, nome e foto maiores.
- **Mapa do controle na aula:** RB (toque curto, ao soltar, sem LB junto) = QR Code (tela 3); Y = frequência cardíaca (tela 5, `overlayFC`/`fcGrid`); RT = esconde as caixas; **LB+RB segurados 5 s** = modo espaço, sem abrir o QR.
- **Frequência cardíaca:** fonte única `_hrDe(a)` (FC do celular `a.fc` se fresca <5 s, senão bike `bpm`/`hr`). A tela nova mostra bpm, zona de FC e % da FC máxima (`_fcMaxDe`: `fcMax`, ou 220 − idade, ou 190). Cartões, lista do QR, relay `bikes_live.hr` e WPP (`hrSum`) usam a mesma fonte. Nas telas de desafio, o ♥ mostrava o tempo de aula e virou ⏱.
- **Fim de aula no padrão novo** (`_fimNovoMostrar` / `_fimNovoRanking`, `#fimNovo`): jornada da aula por tempo real, tempo por zona, TSS, kcal da turma, potência e FC médias, pódio WPP; ranking com pódio, classificação em rodízio e destaques. Tudo em segundos: a tela antiga mostrava "NaN min" com aulas só em `durationSec`. Navegação e botões são os mesmos (`fimBtn_*` recebem o foco).
- **Fim de aula chega ao celular:** sem conexão no encerramento, `_fimAulaPendente` envia `fim_aula` ao reconectar; `beforeunload` (fechar o programa) também envia.

**Por quê**
- Pedidos do Mario (26/09): tela escura para o professor, regra de participação do FTP, fim da rolagem na tela do QR e ranking maior.
- Mario (teste do 26/09c): o anel do teste de FTP andava "bem quebrado", e ele pediu mais fluidez em todo o sistema.

**Como confirmar**
- Na tela inicial deve aparecer `BUILD 26/09d`. No teste de FTP, o anel deve andar contínuo. Nos desafios, nos cartões e no ranking, os números e as barras devem mudar sem piscar.

---

## 2026-09-26 · ginasio 26/09c

**O que mudou**
- Resultado do desafio **congelado**: `_desafioMostrarResultadoFinais` grava `desafio.congelado` (`{nome: valor}`), além da zona e do tempo de aula do instante do fim. `_desafioGetMetrica` passa a ler desse registro, e quem entrou depois fica de fora. `desafioIniciar` limpa o registro.
- Desafio fluido: relógio a 4 Hz, medido pelo tempo real (`desafio._seg`). A tela é atualizada no lugar (`_desPintar` + `_desMorph`, que muda só texto e atributos diferentes) em vez de refeita com `innerHTML`, então as transições CSS de barras, anel e corda funcionam. A letra é reajustada só onde o texto mudou. As kcal usam `_kcalF` (fracionária), a potência média é ponderada pelo tempo e a corda anda proporcional a `dt`. O `desafio_update` para os celulares continua 1× por segundo.
- Potência máxima do desafio = pico **dentro** do desafio (`desafio.potPico`); antes usava `a.potMax`, o pico da aula toda.
- Gráfico antigo (barras) desativado: `PG2_MODO = 1` fixo, e o LB não alterna mais. O RT esconde as caixas de informação (`display:none`) e põe `.pg2-grande`: `_pg2Encaixar` usa a base do eixo e aplica k × 1,3, limitado aos círculos. Os cartões têm transição de altura de 0,35 s.
- Trocas de tela com esmaecimento rápido (`_prFade` / `_prFadeOut`, 0,22 s / 0,18 s) nos painéis do controle (X, A, Y, B), no painel de desafio e nos resultados.
- Teste de FTP no padrão das telas de desafio (`_ftpTelaHTML`): ao vivo (projeção por aluno, 20 por tela, relógio do teste no centro, atualização no lugar 4×/s) e resultado final (pódio da maior evolução %, FTP médio, maior salto, fecha em 1 min). A barra antiga `profFtpBar` continua existindo, escondida, porque o controle a usa como marcador de "teste em curso".
- **FTP pela média do teste**: `_calcNovoFtp` = média ponderada pelo tempo (`_ftpAmostrar`, 4×/s, só participantes) × fator do protocolo, igual ao app do aluno. Antes era potência instantânea ÷ fator: pegava só o último segundo e inflava o resultado (250 W ÷ 0,95 = 263 W, quando o correto, com média de 250 W, é 238 W). A média congela quando o resultado abre.
- Ranking (botão B) com mais de 10 alunos: em duas colunas saem o nome da zona sob o nome e as unidades sob os números (classe `rk-enxuto`), a coluna do nome fica mais larga (`--rkNomeFr`) e a escala (`_rkAplicarK`) encolhe até o conteúdo caber na linha. Posição e WPP passam a encolher junto (antes só cresciam).

**Por quê**
- Mario: trocas de tela "secas" demais; e teste de FTP fora do padrão novo.
- Mario: nos desafios, os segundos e os números andavam travados, "quadrados"; e ele pediu para deixar só o gráfico novo, com o RT fazendo o gráfico crescer no lugar das caixas.
- Mario: ao terminar um desafio, os números do resultado continuavam mudando.
- Foto da TV com 21 alunos: cada linha tinha ~58 px e o conteúdo pedia ~86 px; nomes, números e posições saíam cortados.

**Como confirmar**
- Tela inicial `BUILD 26/09c`. Ranking com 20+ alunos: nomes inteiros, números e posições sem corte.
- Encerrar um desafio com a turma pedalando: os números do resultado não mudam mais.

---

## 2026-09-26 · servidor 26/09b

**O que mudou**
- `aluno_conectou` (WebSocket, para o Ginásio) passa a levar `genero` ('M'/'F'), vindo do `entrar_sala` do app.
- `POST /user/login` devolve `sexo` no objeto `user`; `GET /user/me` também seleciona `sexo`. A coluna já existia (`users.sexo`), nada muda no banco.

- **Reconexão do Ginásio não apaga mais a sala.** `criar_sala` com um código que já existe mantém a sala e os alunos e troca só o professor. A resposta `sala_criada` leva `retomada` e `alunos: [{nome, bike}]`.
- `entrar_sala` do mesmo nome por outra conexão fecha a conexão antiga (`_substituido`). No `close`, o aluno só sai da sala se aquela conexão ainda for a dele, e o professor antigo só marca a queda se ainda for o professor da sala.
- `sala_info` repassa `ocupantes` (`{bike: nome}`) vindo do Ginásio.
- `aluno_conectou` passa a levar `genero` ('M'/'F'), vindo do `entrar_sala` do app.
- `POST /user/login` devolve `sexo` no objeto `user`, e `GET /user/me` também seleciona `sexo`. A coluna já existia (`users.sexo`), então nada muda no banco.

**Por quê**
- Teste de 26/09: a conexão do Ginásio caiu e voltou. O `criar_sala` recriou a sala vazia, e o celular do aluno continuou "conectado" sem receber nada: o bloco parou e não houve reconexão. A bike dele (99) seguiu ocupada na TV, e, ao reabrir o app, ele não conseguia voltar para ela.
- O desafio Homens × Mulheres separava os grupos por `genero`, mas ninguém mandava esse dado: todo aluno real caía em "Homens".

**Como confirmar**
- Entrar numa sala com uma conta de sexo F e iniciar no Ginásio um desafio Homens × Mulheres: o aluno aparece na coluna MULHERES.
- Com um aluno na aula, fechar e reabrir o Ginásio (ou derrubar a rede dele por uns segundos): no log, `Sala retomada: … (1 alunos continuam)`. O celular continua a receber a aula.

**Cuidados**
- Retrocompatível: app antigo não manda `genero` e o servidor envia `null` (o Ginásio trata como homem, como antes).

---

## 2026-09-26 · app 26/09b

**O que mudou**
- Voltar para a própria bike: uma bike ocupada pelo próprio aluno (pelo nome em `ocupantes` ou pela última bike escolhida naquela sala, guardada em `pr_ult_bike_<código>`) aparece livre e marcada como SUA (`_bikeEhMinha`).
- O relógio do bloco anda mesmo sem bike transmitindo. Antes, ficava depois do "sem dado fresco" e parava.
- Vigia da aula: se o `update_aula` parar por 15 s com o socket aberto, o app reenvia o `entrar_sala` na mesma bike (no máximo 1 vez a cada 20 s).
- `_salaInfo` passa a guardar `trancadas` (antes era descartado, e o cadeado das bikes em manutenção nunca aparecia) e `ocupantes`.
- Home do professor: saiu o card antigo "Build Workout" (construtor com código de acesso, duplicado). O professor vê a mesma grade do aluno — Agenda de Aulas + Treino do Treinador — e, abaixo, o card Construtor de Treino.
- Resultado do desafio no celular: ao receber `fim_desafio`, o app procura o próprio nome no ranking e mostra a colocação (no grupo e no geral), o valor e o grupo vencedor por 10 s; um toque fecha. Tratado nos dois sockets (QR e reserva/sessão).
- `entrar_sala` leva `genero` (`_prSexoAluno()`: `prUser.sexo`, senão o sexo marcado no cadastro, guardado em `pr_sexo`).
- Nova função `_prNomeAluno()`: os três pontos que enviam `entrar_sala` com o nome do perfil passam a usá-la. Um nome feito só de tracinhos (`-`, `–`, `—`) ou vazio conta como "sem nome"; o app tenta então `prUser.name`, depois `pr_nome`, e só no fim usa "Aluno".

**Por quê**
- Foto da TV (26/09): na tela do QR, durante a aula, aparecia um aluno "-" a 0 W. O campo `profNome` começa com "–" (travessão curto), mas o teste comparava com "—" (travessão longo). Sem o nome carregado, o app entrava na sala com o nome "–".

**Como confirmar**
- `/aluno` → F12 → `[ProRider Aluno] BUILD 26/09b`. Entrar numa sala sem o perfil carregado: a TV mostra o nome da conta, ou "Aluno", e nunca "-".

---

## 2026-09-26 · ginasio 26/09b

**O que mudou**
- Lobby (tela antes da aula): a linha branca do PERFIL DA AULA foi removida; ficam só as barras.
- Lobby, coluna 3: o cartão AULA SELECIONADA fica sempre com a altura do próprio conteúdo e quem encolhe é o QR do browser (`.pb-sel` / `.pb-brw` em `ginasio.html`). Resolvido só com CSS; `_fitPreAulaCol3()` virou função vazia.
- Tela do QR durante a aula (`#overlayQR`): o PERFIL DA AULA ganhou agulha de progresso (`#qrAulaAgulha`) e a parte já pedalada escurecida. As barras passaram a ser posicionadas pelo tempo real de cada bloco (`_prSec`), o mesmo eixo da agulha.
- A agulha lê o tempo da aula do loop principal (`window._prDoneSecAgora`), então anda também dentro do bloco, não só na troca de bloco.
- Gráfico 2 (cartões): cabe entre os círculos laterais. Margens reduzidas e nova `_pg2Encaixar()`, que calcula `--pg2k` (multiplicador da altura dos cartões) a partir do círculo do tempo e do cartão mais alto possível (z7).
- Gráfico 2: "INÍCIO" só na tela que mostra o primeiro bloco da aula e "FIM" só na que mostra o último; no meio, só a seta. Os rótulos ficam alinhados pela borda do gráfico, sem invadir o círculo.
- Gráfico 2: a agulha passa a ser medida a partir do topo das zonas (`zl.offsetTop`); antes ignorava o nome do segmento e o "VOCÊ ESTÁ AQUI" caía em cima dele.
- Desafios com tela nova (`_desTelaHTML`), ao vivo e no resultado final, nos três modos: Todos × Todos (colunas 1–10 e 11–20), Homens × Mulheres e Equipes. 10 por coluna, sem rolagem; mais que isso troca de página a cada 5 s, e a última página mostra os 10 últimos. Coluna central estreita, nomes em destaque. Letras encolhem sozinhas se a fonte de reserva for mais larga (`_desAjustar`).
- Desafios equilibrados pelo FTP (decisão do Mario): Gasto calórico passa a contar **pontos** = kcal × 200 / FTP; Potência média vira **% do FTP** médio; Distância continua como está (vem da cadência, não da força); Potência máxima fica **bruta** em W (é o sprint). A regra aparece na tela e vai no `fim_desafio` (`regra`).
- Tela do desafio em **px do desenho 1920×1080** (não vh/vw). O Ginásio já aplica `zoom` no body (`_scaleApp`); com vh/vw, o tamanho era ampliado duas vezes numa TV maior que 1920 px — relógio para fora do anel, "DESAFIO AO VIVO" e "EQUIPE … NA FRENTE" cortados, caixa de baixo sem a segunda linha (foto da TV, 26/09).
- Pódio no resultado final (aprovado pelo Mario, `DES_PODIO_FINAL=true`): em Homens × Mulheres e Equipes, um pódio em cada coluna e a lista do 4º em diante (7 por página); em Todos × Todos, pódio + 4º ao 10º na esquerda e 11º em diante na direita. Ao vivo, 1-2-3 sem dourado/prata/bronze: só o líder de cada coluna tem um brilho.
- **Cabo de guerra** (novo tipo de desafio, `cabo`), para Equipes ou Homens × Mulheres; em Todos × Todos, vira Equipes. A cada segundo, a corda (−100 a +100) anda para o lado com a maior média de esforço **agora** (% do FTP de cada um; quem não pedala conta 0): passo = diferença × 0,17, no máximo 5 por segundo. Chegando à ponta, o desafio acaba sozinho; se o professor encerrar antes, vence quem está com a corda. O anel e a barra da corda mostram o domínio de cada lado; a pontuação individual é o % do FTP médio.
- **Desafio automático no bloco** (construtor): no formulário do bloco, escolhe-se o tipo, o modo e a duração em segundos (padrão: o bloco inteiro). O bloco guarda `desafio: {tipo, modo, seg}`, que é salvo no .json. Na aula, `_desAutoTick` inicia o desafio quando faltam `seg` segundos para o fim do bloco e o encerra no fim dele, mostrando o resultado na TV e no celular. O relógio do centro mostra quanto falta. Com a aula pausada, o desafio pausa junto. O bloco ganha um selo no construtor (clicar remove) e um ícone no cartão do gráfico 2.
- Barra de progresso sob o nome de cada aluno, proporcional ao líder da coluna (ideia das imagens de referência do Mario).
- Equilíbrio: em todo desafio de grupo (Homens × Mulheres e Equipes) vence a maior **média por pessoa** (`_desVencedor`). Equipes antes decidia pela soma.
- `fim_desafio` leva, por aluno, `posGrupo`, `deGrupo`, `genero`, `de`, e no topo `vencedor`, `unidade`, `nomeDesafio`, `duracao` — para o app mostrar o resultado individual.
- Reconexão: ao receber `sala_criada` com a lista de alunos, o Ginásio marca quem ele mostra e o servidor não conhece (`_semSala`). Esse aluno não segura a bike no `sala_info` e sai da tela se não voltar em 90 s; se voltar, mantém os números. O `sala_info` leva `ocupantes`.
- Mini gráfico das telas de cartões (Potência/Rotação/Ranking): barras posicionadas em % do tempo, no mesmo eixo do véu. Antes, vãos de 2 px e separadores deslocavam as barras e o véu ficava alguns pixels (≈5 s) fora do lugar.

**Por quê**
- Fotos da TV (26/09, executável 25/09a): o gráfico de cartões passava acima dos círculos, "INÍCIO" ficava sob o círculo e "FIM" aparecia no meio da aula; o mini gráfico das telas de cartões parecia uns 5 s atrasado; no lobby, a linha ainda aparecia como contorno; Música e Status da sala vazavam por cima do perfil; e a agulha nunca aparecia — ela estava desenhada no lobby, mas só era movida quando o `#overlayQR` estava aberto, que tem outro perfil.

**Como confirmar**
- Tela inicial: `BUILD 26/09b`. Abrir o lobby: perfil só com barras; a coluna da direita não encosta no perfil.
- Iniciar uma aula e apertar Y: no perfil de baixo, risco branco com ponto no ponto da aula, escurecendo o que já passou, andando a cada segundo.
- Gráfico de cartões: do nome do segmento até a faixa de informação, tudo entre o topo e a base dos círculos; "FIM" só no desaquecimento.
- Apertar X: no mini gráfico do topo, a marca laranja cai exatamente na borda do bloco quando o bloco troca.

**Cuidados**
- Só arquivos do Ginásio (`script.js`, `ginasio.html`, `style.css`, `LEIA-ME.txt`). Precisa gerar o executável de novo (`npm run dist`).

---

## 2026-09-26 · app 26/09a

**O que mudou**
- **QR de Minhas Aulas lido pelo app.** A TV diz "escaneie com o app ProRider", mas o leitor do app só reconhecia código de sala: lia o endereço `…/aluno?parear=CODIGO`, não achava sala e respondia "esse é o QR do navegador". O pareamento nunca chegava a `POST /professor/parear`. Agora `processarQRCode` reconhece `parear=` e chama `parearConfirmar()`.
- Sem login, `parearConfirmar()` avisava nada e descartava; agora avisa para entrar na conta e guarda o código, que é usado assim que a pessoa entra.

**A cadeia inteira do Minhas Aulas (para conferir quando der erro)**
1. Ginásio → `POST /ginasio/pareamento` com o token do display. **401** = Ginásio precisa ser reativado (5 toques no logo).
2. Celular do professor lê o QR (pelo app, desde esta versão, ou pela câmera, se já estiver logado no navegador).
3. `POST /professor/parear`: **403** = o professor não está ligado àquela licença (`professor_licencas`); o gestor precisa adicioná-lo. **410** = código expirou (vale 2 min).
4. Ginásio consulta `GET /ginasio/pareamento/:codigo` e recebe as aulas do professor.

**Como confirmar**
- No Ginásio: Minhas Aulas → QR. No app do professor: ler o QR pelo leitor do app → "Ginásio conectado" e as aulas aparecem na TV.

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
