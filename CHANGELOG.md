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
- PUT /admin/users/:id, PUT /admin/licencas/:id address fields
- trancadas: Set, prof_remover_aluno/trocar_bikes/trancar_bike WS cases
- GET /agenda/aula-ativa/:license_id
- JWT_SECRET obrigatório — throw; valor fixo no Railway em 23/09

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
