# ProRider — Custos dos serviços novos e preço das aulas gravadas

Levantado em 30/09/2026. Os preços dos fornecedores são cobrados em **dólar**. Aqui está tudo convertido para **reais**, a R$ 5,39 por dólar:
- dólar comercial de R$ 5,21 no fechamento de setembro;
- mais o IOF do cartão internacional (cerca de 3,5%).

Se o dólar mudar, basta refazer a conta com a cotação do dia. **Nada foi contratado nem pago.**

---

## 0. Resumo em uma tabela (01/10: o Mario pediu para ver R$ 29,90, R$ 39,90 e R$ 49,90)

Quanto **sobra por aluno por mês**, depois de tirar tudo: loja ou meio de pagamento, vídeo e imposto. O valor entre parênteses é a parte da ProRider; o resto (40%) vai para os professores.

**Vendendo pelo site (PIX ou cartão):**
| Mensalidade | Uso comum (8 aulas) · imposto 6% | Uso comum · imposto 15,5% | No limite (60 aulas) · imposto 6% | No limite · imposto 15,5% |
|---|---|---|---|---|
| **R$ 29,90** | R$ 25,65 (R$ 15,39) | R$ 22,81 (R$ 13,68) | R$ 11,61 (R$ 6,96) | R$ 8,77 (R$ 5,26) |
| **R$ 39,90** | R$ 34,95 (R$ 20,97) | R$ 31,16 (R$ 18,69) | R$ 20,91 (R$ 12,54) | R$ 17,12 (R$ 10,27) |
| **R$ 49,90** | R$ 44,25 (R$ 26,55) | R$ 39,51 (R$ 23,70) | R$ 30,21 (R$ 18,12) | R$ 25,47 (R$ 15,28) |

**Vendendo dentro do app (Apple e Google ficam com 15%):**
| Mensalidade | Uso comum · imposto 6% | Uso comum · imposto 15,5% | No limite · imposto 6% | No limite · imposto 15,5% |
|---|---|---|---|---|
| **R$ 29,90** | R$ 21,46 (R$ 12,88) | R$ 18,62 (R$ 11,17) | R$ 7,42 (R$ 4,45) | R$ 4,58 (R$ 2,75) |
| **R$ 39,90** | R$ 29,36 (R$ 17,62) | R$ 25,57 (R$ 15,34) | R$ 15,32 (R$ 9,19) | R$ 11,53 (R$ 6,92) |
| **R$ 49,90** | R$ 37,26 (R$ 22,36) | R$ 32,52 (R$ 19,51) | R$ 23,22 (R$ 13,93) | R$ 18,48 (R$ 11,09) |

**Quanto cobra quem já vende no Brasil e lá fora:**
- **CycleGo** (app de bike indoor em português, sem professor ao vivo): **R$ 39,90 por mês** ou R$ 239,90 por ano;
- **Peloton App One:** US$ 12,99 por mês (~R$ 68);
- **Zwift:** US$ 19,99 por mês (~R$ 104).

**Leitura:** R$ 39,90 fica no preço do CycleGo e, com professor brasileiro, aula de verdade e campeonato, tem mais valor. R$ 49,90 cabe como plano "completo". Sugestão:
- R$ 39,90 por mês para aluno de academia ProRider;
- R$ 49,90 por mês para quem não é;
- anual com 2 meses grátis;
- limite de 2 aulas por dia.

---

## 1. Custo de cada serviço

| Serviço | Para quê | Preço do fornecedor | Em reais |
|---|---|---|---|
| **Cloudflare Stream** | Guardar e passar as aulas gravadas | US$ 5 por mês a cada 1.000 min guardados + US$ 1 a cada 1.000 min assistidos | Guardar 1 aula de 50 min: **R$ 1,35 por mês**. Uma pessoa assistir 1 aula de 50 min: **R$ 0,27** |
| **Cloudflare R2** | Link temporário da aula, do MP3 e do vídeo no desafio entre academias (apagado em 24 h) | US$ 0,015 por GB por mês; 10 GB grátis; download grátis | **Praticamente R$ 0** |
| **LiveKit** | Voz e câmera ao vivo do professor para outras academias | US$ 0,0005 por minuto de cada TV conectada; plano grátis com 5.000 min por mês; plano Ship de US$ 50 por mês com 150 mil min | Desafio de 2 academias com 60 min: **R$ 0,32**. Aula com 100 academias: **R$ 16**. Plano Ship: **R$ 270 por mês** (só se passar do grátis) |

A conta é por **TV**, não por aluno: uma sala com 30 bikes custa o mesmo que uma sala com 1.

---

## 2. Custo de uma aula gravada assistida de casa

| Item | Custo por aula de 50 min |
|---|---|
| Passar o vídeo para o aluno (Stream) | R$ 0,27 |
| Guardar a aula no catálogo (R$ 1,35 por mês, dividido entre quem assiste no mês) | com 10 alunos no mês: R$ 0,13 cada |
| **Custo de servidor por aula assistida** | **cerca de R$ 0,40** |

**Custo fixo do catálogo:** 100 aulas de 50 min guardadas = **R$ 135 por mês**.

**O que pesa de verdade não é o servidor:**
- **Loja de aplicativos:** a Apple e o Google cobram **15%** (pequenas empresas, até US$ 1 milhão por ano) ou **30%** sobre conteúdo digital vendido **dentro do app**. Vendendo pelo **site** (PIX ou cartão), a taxa fica entre ~1% (PIX) e ~5% (cartão).
- **Parte do professor:** sugestão de repasse ao professor dono da aula.
- **Impostos:** conferir com o contador (depende do regime da empresa).

---

## 3. Quanto cobrar (revisado com o Mario)

**Regra que protege contra prejuízo:** cada aula assistida custa **R$ 0,27** (50 min). Então todo plano tem:
1. **limite de uso justo: 2 aulas por dia** (60 por mês). Antes era 3 por dia, mas com imposto o 3º caso passaria a dar prejuízo (ver a seção 4);
2. **uma tela por vez** por conta (sem dividir a senha).

Com esses dois limites, o pior aluno possível custa R$ 24,30 no mês.

### Quanto custa cada tipo de aluno (assinatura de R$ 29,90)
| Uso no mês | Custo de vídeo | Sobra, vendendo no app (loja 15%) | Sobra, vendendo no site (PIX ~1%) |
|---|---|---|---|
| 8 aulas (uso comum) | R$ 2,16 | R$ 23,25 | R$ 27,44 |
| 30 aulas (1 por dia) | R$ 8,10 | R$ 17,31 | R$ 21,50 |
| 60 aulas (2 por dia) | R$ 16,20 | R$ 9,21 | R$ 13,40 |
| 90 aulas (3 por dia; fora do limite novo) | R$ 24,30 | R$ 1,11 | R$ 5,30 |

Sem imposto, o empate é de ~94 aulas por mês no app e ~109 no site. **Com imposto (seção 4), o limite seguro é 2 aulas por dia.**

**Repasse ao professor:** 40% do que **sobra** (depois da loja e do vídeo), dividido pelos minutos assistidos de cada professor. Como o repasse sai da sobra, ele nunca gera prejuízo.

### Planos sugeridos
| Plano | Preço | Inclui |
|---|---|---|
| Aluno de academia ProRider | **R$ 29,90 por mês** | Aulas à vontade, até 2 por dia |
| Quem não é de academia | **R$ 39,90 por mês** | Aulas à vontade, até 2 por dia |
| Aula avulsa | **R$ 9,90** | 1 aula, liberada por 7 dias. Sobra ~R$ 8 |
| Primeira aula | **grátis** | Para experimentar |
| Academia | **R$ 199 por mês com 400 aulas assistidas** pelos alunos dela; acima disso, **R$ 0,60 por aula** | 400 aulas custam R$ 108 (sobra ~R$ 91), e cada aula a mais sobra R$ 0,33. A academia acompanha o consumo no Portal |

**Por que a academia não pode ter ilimitado a R$ 199:** 100 alunos fazendo 8 aulas no mês dão 800 aulas, que custam R$ 216. Isso seria **prejuízo de R$ 17**, e ainda pior se usarem mais. Com o pacote de 400 aulas e o excedente cobrado, cada aula a mais continua dando sobra.

**Custo fixo do catálogo:** R$ 1,35 por aula guardada por mês (100 aulas = R$ 135). Uns 6 assinantes no uso comum já pagam isso.

---

## 4. Projeção com imposto (para ter um norte; confirmar com o contador)

Hipótese: empresa no **Simples Nacional**. Software e serviços digitais caem no **Anexo III**, que começa em **6%** sobre o faturamento (até R$ 180 mil por ano) e sobe por faixa (11,2%, 13,5%, 16%…). Se a folha de pagamento, somando o pró-labore, ficar abaixo de 28% do faturamento (o "Fator R"), a empresa vai para o **Anexo V**, que começa em **15,5%**. A tabela mostra os dois casos.

**O que sobra depois de loja/pagamento, custo do vídeo e imposto; depois, a divisão entre ProRider (60%) e professores (40%):**

| Plano | Venda | Imposto 6% → sobra | ProRider / professor | Imposto 15,5% → sobra | ProRider / professor |
|---|---|---|---|---|---|
| R$ 29,90, uso comum (8 aulas) | app | R$ 21,46 | R$ 12,88 / R$ 8,58 | R$ 18,62 | R$ 11,17 / R$ 7,45 |
| R$ 29,90, uso comum (8 aulas) | site | R$ 25,65 | R$ 15,39 / R$ 10,26 | R$ 22,81 | R$ 13,68 / R$ 9,12 |
| R$ 29,90, no limite (60 aulas) | app | R$ 7,42 | R$ 4,45 / R$ 2,97 | R$ 4,58 | R$ 2,75 / R$ 1,83 |
| R$ 39,90, uso comum (8 aulas) | app | R$ 29,36 | R$ 17,62 / R$ 11,74 | R$ 25,57 | R$ 15,34 / R$ 10,23 |
| R$ 39,90, uso comum (8 aulas) | site | R$ 34,95 | R$ 20,97 / R$ 13,98 | R$ 31,16 | R$ 18,69 / R$ 12,46 |
| Aula avulsa R$ 9,90 | app | R$ 7,55 | R$ 4,53 / R$ 3,02 | R$ 6,61 | R$ 3,97 / R$ 2,64 |
| Aula avulsa R$ 9,90 | site | R$ 8,94 | R$ 5,36 / R$ 3,57 | R$ 8,00 | R$ 4,80 / R$ 3,20 |
| Academia R$ 199 (400 aulas) | site | R$ 77,07 | R$ 46,24 / R$ 30,83 | R$ 58,16 | R$ 34,90 / R$ 23,27 |
| Aula excedente da academia R$ 0,60 | site | R$ 0,29 | R$ 0,17 / R$ 0,12 | R$ 0,23 | R$ 0,14 / R$ 0,09 |

**Leitura:**
- Com imposto, **vender pelo site rende 15% a 20% mais** que pelo app.
- O que manda é o **uso comum** (8 a 12 aulas por mês). O limite de 2 por dia só protege contra casos extremos.
- A academia fica mais saudável se o excedente for **R$ 0,70 por aula** em vez de R$ 0,60, para sobrar mais por aula acima do pacote.
- **Faltam nesta conta:** servidor Railway, domínio, e-mail, contador e marketing. São custos fixos da empresa, que se diluem pelo número de assinantes.

---

## 5. Desafio entre academias (custo por evento)

| Evento | Custo |
|---|---|
| 2 academias, 60 min, com voz e câmera | ~R$ 0,32 |
| 10 academias, 60 min | ~R$ 1,62 |
| 100 academias (~3.000 pessoas), 60 min | ~R$ 16 (+ servidor maior no dia; precisa de teste de carga) |
| Arquivos da aula (link 24 h) | ~R$ 0 |

Internet de cada academia:
- **quem transmite a câmera:** 3 a 5 Mbps de envio;
- **transmitindo só a voz:** quase nada;
- **quem recebe:** 2 a 4 Mbps.

---

Fontes dos preços: [Cloudflare Stream](https://developers.cloudflare.com/stream/pricing) · [Cloudflare R2](https://developers.cloudflare.com/r2/pricing) · [LiveKit](https://livekit.com/pricing) · [Zwift](https://www.zwift.com/us/news/33635-how-much-does-zwift-cost-and-whats-included-everything-you-need-to-know) · [Peloton App](https://subger.com/en/service/peloton-app) · [CycleGo na App Store](https://apps.apple.com/br/app/cyclego-spinning-bike-fit/id1395075549) · [Simples Nacional, Anexo III](https://www.contabilizei.com.br/contabilidade-online/anexo-3-simples-nacional/) · [dólar em 30/09](https://www.mixvale.com.br/2026/09/30/dolar-a-r-5209-fecha-setembro-e-mexe-com-projecoes-de-inflacao-e-mercado/)
