# ProRider — Pendências e ideias futuras

Lista do que foi combinado com o Mario e ainda não foi feito. Quem fizer um item move a entrada para o CHANGELOG, no mesmo commit.

---

## Feito na 29/09a (aprovado em 29/09)
- [x] Faixa verde "Entrar na aula ao vivo" no app, também para aula fora da grade.
- [x] Aulas do dia na tela de espera da TV em cartões grandes.
- [x] Entrada do site e do Portal (arte "Ride with Purpose" + contadores ao vivo).
- [x] Brasões: 7 escudos com degraus I–III.
- [x] Página pública da academia.
- [x] Totem no tablet.

## Feito na 29/09c
- [x] Localização: "Perto de mim" na lupinha do app (GPS do celular) e localização da academia no Portal.

## Feito na 30/09e
- [x] Telas de preparar a aula no visual do Portal (início, Minhas aulas, aulas do sistema, lista, configurar aula, QR com dois códigos grandes).
- [x] Ginásio toca o YouTube gravado na aula, sincronizado e sem som.
- [x] Contagem 3·2·1 com o play do Spotify.
- [x] Tela final com jornada, zonas maiores e destaques.
- [x] E-mails editáveis no Portal.
- [x] Login de professor vale em qualquer academia (Minhas aulas).
- [x] Construtor do celular = Construtor online, com a dica de virar o celular.
- [x] Logo original em todas as telas.

## Feito na 02/10a
- [x] **Desafio entre academias:** por período (média por aluno: WPP, kcal, km ou alunos por bike) e ao vivo (placar entre as TVs). Convite por código no Portal.
- [x] **Gravar a aula** no computador da TV (câmera + faixa da aula) e **transmitir** no app (WebRTC) e no YouTube Live (ffmpeg + chave da academia).
- [x] **Lista de espera**, bike liberada de quem não chegou (5 min) e e-mail de lembrete 1 h antes.
- [x] **Arquivo .tcx** da aula para Strava/Garmin.
- [x] **Painel do gestor:** ocupação por dia e horário e alunos sumidos (com e-mail na hora).

## Feito na 03/10c
- [x] Loja: venda de aulas (avulsa, pacotes, assinatura) com Asaas; admin abastece; repasse por professor.
- [x] Desafios reais: 21 dias, Quebra FTP, ranking do mês, grupos no servidor.
- [x] Pré-treino do celular igual ao da TV; botões laranja; tela de Bluetooth refeita.

## Feito na 03/10b
- [x] Demo 2: faturas no dia certo, só a 1ª com "Pagar"; financeiro sempre cai no pagamento.

## Feito na 03/10a
- [x] Revisão do pagamento: vencimento certo no Asaas, situação única, livro-caixa, desfazer, e-mail com motivo e senha nova.

## Pendências abertas
- [ ] **Volume no Railway para as gravações** (`GRAVACOES_TESTE_DIR` num Volume): sem isso, cada deploy apaga os vídeos enviados pela TV. Alternativa: link do Dropbox/Drive na aula da loja.
- [ ] **Keiser M3i no celular:** a M3i só transmite por anúncio Bluetooth; testar na bike se o app conecta (a TV continua lendo pelo dongle).
- [ ] **Percentual de repasse** de cada professor (hoje o relatório mostra o valor bruto por professor).
- [ ] **Resend com domínio verificado** (prorider.com.br) e `EMAIL_FROM` no Railway — sem isso o e-mail com a senha só chega no dono da conta Resend.
- [ ] **Trocar o cartão da cobrança automática** pela página do financeiro (hoje: falar com a ProRider).
- [ ] **Pagamento da licença: testar no sandbox do Asaas** antes da 1ª cobrança real (feito na 02/10h com Asaas simulado). Conferir se a assinatura guarda o cartão pago pela página do Asaas para os meses seguintes, e como trocar o cartão.
- [ ] **Desafio ao vivo: "convite" com a aula já no Portal** (hoje a aula vai às outras academias quando a TV da mãe abre a tela do QR).
- [ ] **Músicas pela conta do Dropbox** (escolher direto da conta, como o Spivi): precisa criar um app gratuito no Dropbox e usar a chave dele. Hoje é colar o link (02/10f).
- [ ] **Nuvem para as aulas gravadas:** a tela do app já existe (02/10b) e hoje toca do servidor de TESTE (5 por academia, 72 h). Falta contratar o armazenamento de vídeo (ex.: Cloudflare R2/Stream) para guardar de vez e aguentar muita gente.
- [ ] **Envio automático ao Strava:** hoje o aluno baixa o .tcx e envia. Para mandar sozinho, falta registrar o app ProRider no Strava (gratuito, mas exige conta e aprovação) e o login com Strava.
- [ ] **Transmissão no app para muita gente / redes difíceis:** WebRTC direto da TV aguenta ~15 pessoas e usa só STUN (grátis). Em algumas redes de celular o vídeo não chega sem um servidor TURN (pago). Para 3 mil pessoas (Guinness): YouTube Live, ou um serviço de vídeo (LiveKit/Cloudflare) quando for contratar.
- [ ] **ffmpeg junto no instalador do Ginásio** (hoje o LEIA-ME manda baixar e pôr em C:\ProRider\ffmpeg).
- [ ] **YouTube na TV: teste numa TV de verdade** (feito no 30/09e; falta conferir, com a internet da academia, o anúncio com e sem YouTube Premium e vídeos que não deixam incorporar).
- [ ] **Mapa na lupinha** (ver as academias num mapa, além da lista). Dá para fazer com o OpenStreetMap, sem custo.
- [ ] **Localização também no totem e na página pública** (link "como chegar").
- [ ] **Vídeo de apresentação:** o Mario manda o link do YouTube e ele entra em `PR_VIDEO_URL`, em index.html e academia.html.
- [ ] **Histórico de quem pedala pelo totem sem app:** a TV mostra os números, mas a aula não é gravada no histórico da pessoa. Caminho: no `fim_aula`, o Ginásio manda os resultados dos alunos `_totem` e o servidor grava em `aula_historico` (quem tem conta).
- [ ] **Brasão também nos cartões de potência e na tela final da aula** (hoje aparece só no Ranking B).
- [ ] **Recuperar senha pelo e-mail** (hoje "Esqueci a senha" orienta falar com o gestor).
- [ ] **Arte da entrada em alta resolução:** a arte recebida tem 1586×992 e fica um pouco suave em telas grandes. Se o Mario tiver o arquivo original maior (≥ 2560 px de largura), é só trocar `img/entrada-arte.jpg`, que as posições são proporcionais.
- [ ] **Portal com versão de celular** (barra de menu embaixo, uma coluna).

## Atualização futura — CAMPEONATO (estilo Tour de France / Giro d'Italia)
Pedido do Mario em 29/09. Depende dos brasões e da gravação dos resultados por bloco.

**Ideia:** o gestor ou o professor cria no Portal um campeonato com nome e escolhe as aulas (etapas) que fazem parte dele. Cada aula vale como etapa. A classificação é atualizada ao fim de cada etapa, e quem lidera veste a camisa.

| Camisa | Quem veste | Como o sistema calcula |
|---|---|---|
| 🟡 **Amarela** | Líder da classificação geral | Soma dos pontos de cada etapa pela posição no WPP (ex.: 1º = 25, 2º = 20, 3º = 16…), para não premiar só quem veio a mais aulas |
| 🟢 **Verde** | Melhor sprinter | Pontos nos blocos de sprint e nos desafios de potência (tiros, potência máx.), pela posição em cada sprint, equilibrado pelo FTP (%FTP) como nos desafios |
| 🔴⚪ **Bolinhas** | Rei da montanha | Blocos marcados como **montanha** no Construtor, com categoria 4ª/3ª/2ª/1ª/HC, que multiplica os pontos. Sem marcação, o sistema sugere: em pé + cadência baixa + %FTP alto. Vence quem sustenta mais %FTP na subida |
| ⚪ **Branca** | A definir com o Mario | Opção A: **melhor estreante** (primeiro campeonato ou conta com menos de 6 meses). Opção B: **melhor jovem** (até 25 anos, pela idade do perfil) |

**Onde aparece:**
- TV: ícone da camisa ao lado do nome nos cartões, no ranking e no fim da aula, mais a tela "classificação do campeonato".
- App: classificação e as camisas de cada um.
- Página pública da academia: classificação e líderes.
- Portal: criar, editar e encerrar o campeonato, e ver os resultados por etapa.

**Regra de pontos (Mario, 30/09):** a classificação é a soma das etapas em que o aluno pedalou; etapa que ele faltou vale 0 (não trava o campeonato). Depois de CADA etapa o sistema recalcula a classificação inteira e redistribui as camisas: quem voltou numa etapa posterior soma só o que fez e pode recuperar ou perder a camisa.
**Status 01/10a:** FEITO (Portal, servidor, TV e app), com Tour, Giro, Vuelta e Mundial. Falta: marcar bloco de sprint/montanha no Construtor (hoje é automático), camisa nos cartões da aula ao vivo, classificação na página pública e na tela de espera.

**O que precisa antes:**
1. Guardar os resultados por bloco de cada aula no servidor (hoje só vai o resumo da aula).
2. Marcar os blocos no Construtor (sprint / montanha + categoria).
3. Brasões e gamificação prontos.

## Atualização futura — DESAFIO ENTRE ACADEMIAS (Mario, 30/09)
**Ideia:** uma academia desafia outra para uma aula no mesmo dia e hora. As duas salas fazem a mesma aula ao mesmo tempo, com um placar Academia A x Academia B (e, no futuro, várias academias ao mesmo tempo, com a ideia de um recorde de aula coletiva).

**Fluxo:**
1. Portal → Grade → criar a aula → botão **Desafio** → lupinha para buscar a academia.
2. A academia desafiada recebe o convite no **sininho de avisos do Portal** (novo) e por e-mail. Aceita ou recusa.
3. Aceito, a aula entra na grade das duas academias. Se já houver aula no mesmo horário, a grade mostra as duas lado a lado (ninguém precisa apagar a aula normal).
4. Antes da aula, o Ginásio de cada academia baixa sozinho a aula, a música e o vídeo por um link temporário (apagados 24 h depois).
5. No horário, quem desafiou aperta START. O servidor manda "começar às HH:MM:SS" para as duas TVs, que começam juntas pelo relógio do servidor (diferença esperada: menos de meio segundo). Pausa e avanço de bloco vão para as duas.
6. Placar ao vivo e ranking das duas salas juntos; resultado vai para o app e para o e-mail.
**Plano B:** se a ligação cair ou o anfitrião não der START, a outra TV pode começar a mesma aula sozinha; o resultado vale como desafio "no mesmo dia".
**Voz e câmera do professor (fase 2):** microfone e câmera no mini PC, enviados por um serviço de vídeo em tempo real (ex.: LiveKit), com atraso de menos de 1 s. A música e o vídeo continuam tocando do arquivo local em cada academia, sincronizados, para não perder qualidade.
**Fases:** 1) convite, sininho, grade e início sincronizado; 2) voz do professor; 3) câmera do professor; 4) muitas academias ao mesmo tempo.

## Atualização futura — CÂMERA: GRAVAR E TRANSMITIR (Mario, 30/09)
- **Feito (30/09f):** a câmera virou um cartão próprio, "Câmera ao vivo", na tela de configurar a aula.
- **Gravar a aula:** gravar a tela da aula (câmera, gráfico e música) e guardar no app com o nome do professor, para fazer depois de casa com o gráfico sincronizado.
- **Transmitir ao vivo:** para o YouTube, pelo OBS (programa gratuito) capturando a tela. Transmissão própria para o app entra junto com a fase 3 do desafio entre academias.
