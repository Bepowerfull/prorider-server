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

## Feito na 07/10c
- [x] E-mails do aluno no modelo novo (arte do Mario) + gráfico minuto a minuto no fim de aula.
- [x] E-mails novos: camisa conquistada e desafio concluído.
- [x] Relatório da aula na Saúde; indicador do atualizador da TV; Keiser sem nome no Android.
- [ ] Mario: print do APK de diagnóstico da Keiser; depois reinstalar o APK do aluno 07-10b.
- [ ] Mario: aprovar o e-mail real (fazer uma aula com o e-mail ligado e conferir no celular).

## Feito na 07/10b
- [x] **Pendrive ANT+ na TV**, para as bikes que só falam ANT+. **Falta:** teste com o pendrive ANT+ do Mario e uma bike ANT+ de verdade. Antes, conferir no Gerenciador de Dispositivos do Windows como o pendrive aparece (porta COM ou "ANT USB Stick").

## SEGURANÇA — lista de conferência (o Mario marca; checar juntos depois)
**GitHub**
- [ ] Settings → Code security: ligar **Secret scanning** e **Dependabot alerts** *antes* de fechar. Ver se aparece algum alerta e mandar print.
- [ ] Settings → General → Danger Zone → **Make private**.
- [ ] Ver se há **forks** (cópias públicas) do repositório.
- [ ] Fazer um deploy de teste no Railway depois de fechar.
- [ ] Trocar qualquer chave que o Secret scanning tenha achado.
- [ ] Proteger o ramo principal: ninguém sobe direto sem os testes passarem.

**Verificação em 2 etapas (2FA), com app autenticador e não SMS, e senha única em cada um:**
- [ ] GitHub
- [ ] Railway
- [ ] Asaas
- [ ] Resend
- [ ] Dropbox
- [ ] Google (Gmail e Play Console)
- [ ] Apple ID
- [ ] Registro.br (o domínio)
- [ ] UptimeRobot
- [ ] E-mail principal do Mario: é a chave de recuperação de todos os outros

**Senhas e chaves**
- [ ] Gerenciador de senhas (Bitwarden, 1Password ou outro) e o documento de senhas preenchido pelo próprio Mario.
- [ ] Chave privada da atualização das TVs guardada em 2 lugares: pendrive + gerenciador de senhas.
- [ ] Chaves do Asaas e do Resend só nas variáveis do Railway. Ninguém manda chave por WhatsApp, e-mail ou chat.
- [ ] Revisar quem tem acesso a cada conta (Railway, GitHub, Asaas). Tirar quem não precisa.

**Sistema**
- [ ] Senha do super admin forte e única. Cada pessoa com o próprio login (nada de login compartilhado).
- [ ] Backup semanal no HD externo e um teste de restaurar por mês (`restaurar-teste.sh`).
- [ ] TVs: Windows atualizado, sem TeamViewer gratuito; usar licença comercial ou RustDesk.
- [ ] Antes do lançamento: rodar de novo a revisão de segurança (`testes/invasao.test.js` + revisão manual).

## Feito na 07/10f
- [x] Toda forma de terminar grava a aula e manda o resumo: professor encerra na TV, aluno sai pelo "Encerrar Aula", teste de FTP do app, aula gravada.
- [x] Totem (sem celular, identificado pelo e-mail): aula gravada (histórico e pontos) e resumo por e-mail com os números da TV.
- [x] Sem login: o fim da aula convida a criar a conta; ao criar ou entrar (até 24 h), a aula vai para a conta e o resumo chega.
- [x] App: botão CONTROLES laranja, de um toque (no iPhone com o app na tela de início, arrastar de baixo fechava o app).
- [x] Tela de fim da aula nova e compartilhar com 2 modelos (foto do aluno de fundo).
- [x] Saúde: "última consulta" de cada TV (por que não atualizou).
- [ ] Totem sem e-mail (só o nome) e "entrar sem login" sem criar conta: não há para quem mandar — fica só na TV.

## Feito na 07/10e
- [x] **Corrigido:** na aula da TV (entrando pelo QR) o app não gravava a aula no servidor — sem histórico, sem pontos, sem e-mail do resumo, para qualquer conta. Teste novo `fimaula` (app de verdade, aluno e super admin).

## Feito na 07/10d
- [x] Diagnóstico da sala: LB+RB 2 s na tela do QR (B fecha; teclado Ctrl+Shift+D). Sinal de cada bike, atraso de cada celular, internet.
- [x] Alunos demo ficam ligados (voltar ao início ou reabrir o programa não desliga).
- [x] Nota da aula (1 a 5 estrelas no app) e "Nota das aulas" no Portal (Ocupação), por professor e por horário.
- [x] E-mail "O seu mês" para o aluno no dia 1º (o gestor desliga no Portal).
- [x] "Atualizar agora" com o automático desligado + textos claros em Licenças.
- [ ] **Etapa 2 (aprovada, depois):** aulas automáticas (grade do gestor, aviso 10 min antes com cronômetro na tela de espera, começa sozinha); painel do professor (o gestor liga por professor); convide um amigo (o gestor liga por academia).

## Feito na 07/10a
- [x] Atualização automática das TVs pelo servidor (assinada, de madrugada, volta sozinha). **Falta:**
  - **Mario + desenvolvedor:** criar as chaves;
  - **desenvolvedor:** pôr o módulo no `main.js` e instalar uma última vez pelo `.bat`;
  - ligar a atualização na academia de teste e depois nas outras.
- [x] Keiser lida direto no celular (app das lojas) e o resumo da Keiser ignorado na TV. **Falta:** o teste com Keiser de verdade no app instalado.
- [x] Documentação das marcas (`MARCAS_BLUETOOTH.md`). **Falta:** passar o nRF Connect nas marcas marcadas com 🔎 quando houver acesso.
- [ ] **Pareamento das bikes pelo Admin, de longe** — **num lugar escondido** (ex.: dentro do "detalhes" de cada TV na Saúde), para não poluir o Admin (ver e numerar as bikes que o dongle está ouvindo, sem TeamViewer): ideia para depois.

## Feito na 03/10z
- [x] Testes de internet ruim no celular e de internet da academia caindo. 6 falhas encontradas e corrigidas.
- [ ] **Modo local** (o celular fala direto com o mini PC pela rede da academia): avaliar depois dos apps nas lojas.

## Feito na 03/10y
- [x] "Aulas ao vivo agora" na Saúde e em `/status/ao-vivo`. Pacote só de servidor não exige reinstalar as TVs.
- [ ] Relatório da aula do 17/10 (sinal do dongle por bike, atraso por celular): combinado para depois.
- [ ] Roteiro do dia 17/10: combinado para depois.

## Feito na 03/10x
- [x] Ensaio do 17/10 (15 bikes no dongle + 15 celulares): %FTP e zona certos para todos, atraso ~0,3 s.
- [x] Teste de carga com TV ativada: 30 academias × 20 bikes sem perda.
- [x] Servidor caindo no meio da aula: o aluno não é mais expulso (falha corrigida).
- [x] Saúde da TV (memória, fps, tempo ligada) e teste de aula longa. **Falta:** Mario rodar a `TESTE_10_HORAS.json` em casa (8–10 h) e eu ler o histórico.
- [x] Auditoria de dependências.
- [ ] **17/10:** aula real com 15 bikes Keiser no dongle e 15 celulares.
- [ ] Tradução (inglês/espanhol): adiada pelo Mario.

## Feito na 03/10w
- [x] Revisão de segurança antes do lançamento (13 falhas corrigidas, com teste de invasão).
- [x] App sem números simulados; imagens das lojas prontas.

## Feito na 03/10v
- [x] Verificação da versão antes de gerar o programa da TV (`GERAR_PROGRAMA_DA_TV.bat`) e aviso na Saúde para TV em versão diferente do servidor. **Falta:** reinstalar as 3 TVs (estão na 03/10n) com a 03/10v.

## Feito na 03/10u
- [x] Projeto dos apps das lojas (Android e iPhone) com Bluetooth nativo. **Falta:**
  - **Mario:** criar as contas (Google US$ 25 uma vez; Apple US$ 99/ano) e decidir sobre as compras dentro do app;
  - **desenvolvedor:** gerar e testar no celular de verdade;
  - **teste fechado do Google:** 12 testadores por 14 dias;
  - trocar os links do QR da TV para os das lojas.

## Feito na 03/10t
- [x] Horário de Brasília no banco (reserva da noite sumia depois das 21h; minutos até a próxima aula errados em horas).
- [x] Teste automático das telas do Portal (gestor, financeiro, admin) e do app (conta, reserva, entrar na aula).

## Feito na 03/10s
- [x] Teste automático das telas da TV (aula inteira, num navegador de verdade) + correções que ele achou (aviso falso de queda depois de toda aula, resumo sem sala, cartões cortados).
- [x] Carga automática (ERG) para rolos e bikes inteligentes. **Falta:** testar com um rolo real (Wahoo, Tacx, Elite…).

## Feito na 03/10r
- [x] Domínio próprio **app.prorider.app.br** (antigo continua valendo). **Falta (Mario, depois do deploy):** Redirect URI no Dropbox, URL do webhook no Asaas e URL do monitor no UptimeRobot; conferir `PORTAL_URL` no Railway (desenvolvedor).

## Feito na 03/10q
- [x] Dropbox conectado no Construtor (pasta Aplicativos/ProRider Cycling, escolher músicas e vídeo, link criado sozinho); link colado à mão mais confiável. **Falta:** teste real com a conta do Mario e de um professor.

## Infraestrutura (fora do código)
- [x] **UptimeRobot** (06/10): monitor "ProRider servidor" em `https://prorider-server-production-5784.up.railway.app/ping`, a cada 5 min, com aviso por e-mail para marioelite@hotmail.com se cair. Conta grátis do Mario.
- [x] Webhook do Asaas conferido em 06/10 (pagamento da Demo 01 chegou na hora; eventos de estorno e de cartão recusado marcados).
- [x] Backup semanal: o Mario baixa da Saúde do sistema e guarda no HD externo (1º em 06/10).
- [x] App do Dropbox "ProRider Cycling" criado (06/10), com até 500 contas liberadas.
- [x] **Domínio** `app.prorider.app.br` (06/10): CNAME `app` → `416c6tdi.up.railway.app` + TXT `_railway-verify.app` no Registro.br; validado no Railway (porta 8080). Registros do Resend mantidos.
- [ ] Railway Pro (prioridade, ao concluir o projeto).

## Feito na 03/10p
- [x] Bikes, rolos e sensores de outras marcas por Bluetooth padrão (FTMS, potência, cadência) no app; na academia, os números do celular aparecem na TV. **Falta:** testar com cada aparelho real conforme aparecer (ver `MARCAS_BLUETOOTH.md`).

## Feito na 03/10o
- [x] Termos de uso e Política de privacidade (páginas), aceite obrigatório no cadastro e no próximo acesso de quem já tem conta, registro do aceite (LGPD). **Falta: revisão do texto pelo advogado.**

## Feito na 03/10n
- [x] TV parada volta sozinha para a tela de espera em 10 min, mesmo com o controle ligado (nunca durante a aula nem na tela do QR).
- [x] "✓ Resolvido" confere se o problema acabou antes de fechar o aviso (senão mostra o que falta; dá para fechar mesmo assim, registrado).

## Feito na 03/10m
- [x] Pausar avisos por academia até uma data, botão "✓ Resolvido" nos avisos, recusa de data do Asaas (cartão) como aviso, contador de e-mails da Saúde certo.

## Feito na 03/10l
- [x] Desligamento limpo no deploy (SIGTERM → saída 0) + start command `node server.js`: acabam os falsos "Deployment crashed".

## Feito na 03/10k
- [x] Conferência diária dos pagamentos com o Asaas (registra o que o webhook não trouxe, desfaz estornos, loja) + botão "Conferir agora" na Saúde.

## Feito na 03/10j
- [x] Backup do banco feito pelo próprio servidor toda madrugada, botão Baixar na Saúde e ferramenta de restauração testada.

## Feito na 03/10i
- [x] Queda e volta normal da TV não aparece mais como erro na Saúde.
- [x] E-mail ligado em produção (prorider.app.br verificado no Resend, 05/10).

## Feito na 03/10h
- [x] Semáforo das academias, painel por academia com linha do tempo, lupinha e código do erro na tela (E-XXXX); e-mail só dos vermelhos.

## Feito na 03/10g
- [x] Vigia: avisos automáticos por e-mail (TV desligada perto da aula, TV caiu na aula, picos de erro, Asaas recusado, disco, memória, banco).

## Feito na 03/10f
- [x] Erros e avisos da TV, do app, do Portal, do financeiro e do admin chegam sozinhos na Saúde do sistema.
- [x] TV sem internet guarda o resumo da aula, o campeonato e a ficha da gravação e envia sozinha depois.
- [x] Teste de carga (`ferramentas/teste-carga.js`): 100 academias × 20 bikes aprovado no servidor local.
- [x] Trocou a senha (perfil, esqueci a senha, "Nova senha" do admin) → as outras sessões caem.

## Feito na 03/10e
- [x] Limite de tentativas, esqueci a senha, reportar problema, excluir conta, Saúde do sistema, testes automáticos, scripts de backup.

## Feito na 03/10c
- [x] Loja: venda de aulas (avulsa, pacotes, assinatura) com Asaas; admin abastece; repasse por professor.
- [x] Desafios reais: 21 dias, Quebra FTP, ranking do mês, grupos no servidor.
- [x] Pré-treino do celular igual ao da TV; botões laranja; tela de Bluetooth refeita.

## Feito na 03/10b
- [x] Demo 2: faturas no dia certo, só a 1ª com "Pagar"; financeiro sempre cai no pagamento.

## Feito na 03/10a
- [x] Revisão do pagamento: vencimento certo no Asaas, situação única, livro-caixa, desfazer, e-mail com motivo e senha nova.

## Pendências abertas
- [ ] **⚠️ PRIORIDADE: contratar o Railway Pro** (cerca de US$ 20/mês) ao concluir o projeto / antes das primeiras academias pagantes — liga os backups automáticos do Railway (diário, semanal, mensal) e a restauração até o minuto. Até lá: backup do próprio servidor (03/10j) + cópia semanal baixada pelo Mario.
- [ ] **Revisão diária pelo Claude** (tarefa agendada que lê a Saúde do sistema no navegador do Mario e manda um resumo) — criar depois que o 03/10g estiver no ar.
- [ ] **Aviso por WhatsApp** além do e-mail (precisa de um serviço pago de WhatsApp).
- [ ] **Teste de carga na homologação do Railway** (o local passou; falta medir com a internet e a máquina do Railway).
- [ ] **Testes das telas dentro do `testes/rodar.js`** (TV, app e Portal num navegador de teste; hoje rodam à parte).
- [ ] **Termos de uso e privacidade:** páginas e aceite prontos na 03/10o — falta o advogado revisar o texto (trocar só o texto das páginas).
- [ ] **Volume no Railway para as gravações** (`GRAVACOES_TESTE_DIR` num Volume): sem isso, cada deploy apaga os vídeos enviados pela TV. Alternativa: link do Dropbox/Drive na aula da loja.
- [ ] **Keiser M3i no celular:** a M3i só transmite por anúncio Bluetooth; testar na bike se o app conecta (a TV continua lendo pelo dongle).
- [ ] **Percentual de repasse** de cada professor (hoje o relatório mostra o valor bruto por professor).
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
