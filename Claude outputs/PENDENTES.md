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

## Pendências abertas
- [ ] **Ginásio tocar o vídeo do YouTube gravado na aula** (`video.fonte='youtube'`, `youtubeId`, `syncOffset` = ponto de chegada, como no vídeo local). O Construtor já grava o link (30/09d). Falta, no Ginásio: player do YouTube (IFrame API) no lugar do `#backgroundVideo`, sem som, começando em `syncOffset − (aquecimento + principal)` e acompanhando pausa/avanço da aula. Cuidados: precisa de internet na academia; alguns vídeos não deixam ser incorporados; pode haver anúncio no começo. Testar numa TV de verdade antes de liberar.
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

**O que precisa antes:**
1. Guardar os resultados por bloco de cada aula no servidor (hoje só vai o resumo da aula).
2. Marcar os blocos no Construtor (sprint / montanha + categoria).
3. Brasões e gamificação prontos.
