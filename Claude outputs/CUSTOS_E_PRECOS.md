# ProRider — Custos dos serviços novos e preço das aulas gravadas

Levantado em 30/09/2026. Os preços dos fornecedores são cobrados em **dólar**. Aqui está tudo convertido para **reais**, a R$ 5,39 por dólar:
- dólar comercial de R$ 5,21 no fechamento de setembro;
- mais o IOF do cartão internacional (cerca de 3,5%).

Se o dólar mudar, basta refazer a conta com a cotação do dia. **Nada foi contratado nem pago.**

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

## 3. Quanto cobrar: sugestão

Referências de mercado para o aluno comparar:
- Zwift: US$ 19,99 por mês (cerca de R$ 108);
- Peloton App One: US$ 12,99 por mês (cerca de R$ 70).

As duas são de fora, em dólar e sem professor brasileiro.

### Opção A: aula avulsa
| Preço | Loja (15%) | Servidor | **Sobra** | Professor (50%) | ProRider (50%) |
|---|---|---|---|---|---|
| **R$ 9,90** | R$ 1,49 | R$ 0,40 | **R$ 8,01** | R$ 4,00 | R$ 4,00 |
| **R$ 14,90** | R$ 2,24 | R$ 0,40 | **R$ 12,26** | R$ 6,13 | R$ 6,13 |

### Opção B: assinatura mensal (recomendada)
**R$ 39,90 por mês**, aulas à vontade. Um aluno que faz 12 aulas no mês custa ~R$ 3,25 de servidor e R$ 5,99 de loja: **sobra cerca de R$ 30,65 por aluno por mês**. O repasse aos professores sai proporcional ao tempo assistido de cada um.

### Opção C: pela academia
A academia assina e libera as aulas gravadas aos alunos dela (ex.: **R$ 199 por mês** por academia, até 100 alunos) e ganha um benefício para vender no plano dela.

**Sugestão para lançar:**
- **aluno de academia ProRider:** R$ 29,90 por mês;
- **quem não é de academia:** R$ 39,90 por mês;
- **aula avulsa:** R$ 9,90;
- **primeira aula grátis:** para experimentar.

---

## 4. Desafio entre academias (custo por evento)

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

Fontes dos preços: [Cloudflare Stream](https://developers.cloudflare.com/stream/pricing) · [Cloudflare R2](https://developers.cloudflare.com/r2/pricing) · [LiveKit](https://livekit.com/pricing) · [Zwift](https://www.zwift.com/us/news/33635-how-much-does-zwift-cost-and-whats-included-everything-you-need-to-know) · [Peloton App](https://subger.com/en/service/peloton-app) · [dólar em 30/09](https://www.mixvale.com.br/2026/09/30/dolar-a-r-5209-fecha-setembro-e-mexe-com-projecoes-de-inflacao-e-mercado/)
