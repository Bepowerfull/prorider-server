# ProRider — Bikes, rolos e sensores por Bluetooth e ANT+ (07/10b)

O ProRider lê os **padrões abertos de Bluetooth** (BLE) que quase todas as marcas usam. Quem segue o padrão funciona, sem código específico por marca. A Keiser tem um formato próprio e público, já implementado.

> **Como usar este documento no teste de cada marca:**
> 1. No celular, instale o app gratuito **nRF Connect** (Nordic).
> 2. Pedale a bike e procure.
> 3. Anote quatro coisas: o **nome** que aparece, os **serviços** (1826, 1818, 1816, 180D), se aparece **"Manufacturer data"** e se ela deixa **conectar**.
> 4. Compare com a tabela da marca. Se bater, o ProRider funciona. Se não bater, a anotação é o meio caminho andado.

## 1. Os padrões

| Padrão | Serviço (UUID) | Dado (UUID) | O que vem | Conexão |
|---|---|---|---|---|
| **Keiser M3i** (próprio, público) | — | anúncio, código do fabricante **0x0102** | watts, cadência, FC, marcha, kcal, nº da bike | **não conecta**: anuncia no ar; **quantos aparelhos quiserem** ouvem ao mesmo tempo |
| **FTMS** (Fitness Machine) | `0x1826` | Indoor Bike Data `0x2AD2`, Control Point `0x2AD9` | watts, cadência, velocidade, às vezes FC; aceita carga (ERG) | conecta; **normalmente 1 celular por bike** |
| **Cycling Power** | `0x1818` | Medição `0x2A63` | watts; cadência pelas voltas do pedivela | conecta; 1 (às vezes 2 ou 3) |
| **CSC** (velocidade e cadência) | `0x1816` | Medição `0x2A5B` | só cadência | conecta |
| **Frequência cardíaca** | `0x180D` | Medição `0x2A37` | FC | conecta |
| **ANT+** (FE-C, Power) | — | — | igual ao FTMS e ao Power | o celular **não** lê ANT+; **a TV lê com o pendrive ANT+ (07/10b)**, sem limite de leitores |

**Regra que decide tudo na academia:**
- **Keiser:** a TV (dongle) e cada celular leem a mesma bike ao mesmo tempo.
- **Bikes que só conectam (FTMS / Power):** quem conecta primeiro "pega" a bike. Por isso, nessas marcas, **o celular do aluno conecta e repassa os números à TV pelo servidor**. Isso já funciona desde a 03/10p.
- **Se a marca também manda ANT+:** a TV pode ler pelo **pendrive ANT+ (07/10b)**, igual à Keiser (todas as bikes ao mesmo tempo). Nesse caso o aluno não precisa conectar a bike no celular.

## 2. Keiser — formato oficial (implementado no dongle e no app das lojas)
Fonte: [dev.keiser.com/mseries/direct](https://dev.keiser.com/mseries/direct)

| Byte (depois de 0x0102) | Campo |
|---|---|
| 0 / 1 | versão do console (maior / menor) |
| 2 | **tipo do dado**: `0x00` e `0x80–0xE3` = ao vivo; `0x01–0x63` e `0xFF` = **resumo depois que parou (ignorar)** |
| 3 | **nº da bike** (0–200, configurado no console; 0 = de fábrica, sem número) |
| 4–5 | cadência × 10 |
| 6–7 | FC × 10 (0 = sem cinta) |
| 8–9 | watts |
| 10–11 | kcal |
| 12 / 13 | minutos / segundos |
| 14–15 | distância × 10 (bit mais alto: 1 = km) |
| 16 | **marcha** (1–24; só a partir da versão 6.21) |

**Detalhes:**
- **Frequência do anúncio:** a cada 0,32 s (versão 6.32 em diante).
- **iPhone:**
  - não mostra o endereço (MAC) da bike, e a própria Keiser avisa que ele não serve para identificar. **Use o nº da bike;**
  - a leitura só funciona com o **app aberto na tela**, porque o iOS não lê esse anúncio em segundo plano;
  - a Keiser recomenda **recomeçar a procura de tempos em tempos**. O ProRider recomeça a cada 60 s.
- **Configurar o nº no console:**
  1. pedale até aparecer **"bid"**;
  2. ajuste com a alavanca: marchas 1–7 diminuem o nº, 8–16 mantêm, 17–24 aumentam (1–200).
- **Recomendação para a academia:** numerar cada Keiser no console igual ao número da bike na sala.
- **Keiser M Connect** (console novo, "M3i#000"): além do anúncio, aceita conexão com **FTMS, Power e CSC**. O ProRider lê pelos dois caminhos.

**Como fica no ProRider (07/10a):**
- **TV:** o dongle lê todas as bikes, como antes. Agora **ignora o "resumo"** depois que o aluno para, que antes podia aparecer como watts ao vivo. A TV também manda ao app qual **nº de Keiser** corresponde a cada bike da sala.
- **App das lojas, na aula da academia:** o celular ouve a **própria Keiser direto** pelo nº dela. O ponteiro mexe na hora, com o FTP do aluno, mesmo com a internet ruim ou fora. Sem anúncio por 2,5 s, volta a usar o número que vem da TV.
- **App das lojas, em casa:** a lista mostra **"Keiser M3 nº 7"**, uma linha por bike, e escolher lê o anúncio, sem tentar conectar.
- **No navegador** (Chrome e Bluefy): a Keiser continua só pelo dongle da TV, porque o navegador não lê anúncios.

## 3. Marcas de academia (spinning)

**Legenda:**
- **C** = confirmado pelo fabricante ou documento oficial.
- **P** = provável (fórum, loja ou dedução).
- **?** = não achei; confirmar com o nRF Connect.

| Marca / modelo | Console com Bluetooth | Bluetooth (BLE) | Leitores ao mesmo tempo / ANT+ | Como achar a bike certa | Funciona no ProRider? | Conf. |
|---|---|---|---|---|---|---|
| **Keiser M3i / M3i-TBT / M5** (console clássico) | de fábrica | **anúncio** 0x0102 (seção 2) | ilimitados; sem ANT+ | nº 1–200 no console (nome "M3") | ✅ TV + celular (app das lojas) | C |
| **Keiser M3i + M Connect** | de fábrica | anúncio + **FTMS + Power + CSC** | ? / ANT+ sim | "M3i#nnn" | ✅ | C |
| **Keiser M3i Studio Plus** | de fábrica | CSC, FTMS, Power e anúncio Keiser | ? / ANT+ | ? | ✅ provável | P |
| **Schwinn AC Performance Plus** ("Carbon Blue" é a correia, não o console) | Echelon2 ou Cadence Pro | **nenhum** | só **ANT+ FE-C** | ANT+ "FEC nnnnn" | ❌ no celular / ✅ TV com pendrive ANT+ | C |
| **Schwinn MPower Echelon2** | opcional | **nenhum** | ANT+ FE-C (potência estimada pelo freio) | idem | ❌ celular / ✅ TV com pendrive ANT+ | C |
| **Schwinn IC4 / IC8 / 800IC / Bowflex C6** (casa) | de fábrica | FTMS (aparece como "IC Bike") | 1 / não | todas chamam "IC Bike" (sem número) | ✅ em casa; na academia confundir bikes iguais | P |
| **Stages SC2 / SC3** | console Bluetooth + ANT+ (opcional) | BLE 4.0; serviços exatos **?** (a Stages avisa que nem todo app aceita o console) | console **?**; pedivela de potência: Gen 1/2 = **1**, Gen 3 = **2** / **ANT+ sim** | console anuncia **"Stages IC \<nº\>"** (1–99 ou 001–999) | ✅ provável (pedivela = Cycling Power) | C/? |
| **Stages SB20** | de fábrica | **FTMS** + ANT+ FE-C | ? | ? | ✅ (+ ERG) | C |
| **Technogym Group Cycle Connect** | de fábrica | Bluetooth + ANT+; perfil **?** | relatos de **1 conexão** / ANT+ sim | ? | 🔎 confirmar (provável Power/FTMS) | P |
| **Technogym Skillbike** | de fábrica | relato: BLE só manda **FC**; potência só por ANT+ | ANT+ | ? | ❌ celular / ✅ TV com pendrive ANT+ | P |
| **Spinner Blade ION** (Star Trac) | de fábrica | **nenhum** | só ANT+ | — | ❌ / ✅ TV com pendrive ANT+ | C |
| **Star Trac Group Cycling Computer** (Pro+/NXT/Blade) | opcional | nenhum (sem potência) | ANT+ FC | — | ❌ | C |
| **Spinning PRO Power / Chrono Power / NXT Power** (SPINPower; também Precor) | de fábrica ou retrofit | "Bluetooth Smart" + ANT+; serviços **?** | ? | ? | ✅ provável. **No Chrono o Bluetooth vem DESLIGADO** (ligar nas configurações) | C/P |
| **Life Fitness / ICG IC5–IC8 com TFT 1.0** (botões de toque) | de fábrica | BLE **travado** (só app ICG) | ANT+ | Bike ID na instalação | ❌ celular / ✅ TV com pendrive ANT+ | C |
| **Life Fitness / ICG IC5–IC8 com TFT 2.0** (botões físicos, 2020 em diante; há kit para as antigas) | de fábrica ou kit | **BLE 5.0 aberto**; relato: Cycling Power / CSC | ? / ANT+ sim | Bike ID | ✅ provável. **Watts só aparecem acima de 40 rpm**; acorda quando o volante gira | C/? |
| **Matrix CXP** (Target Training) | de fábrica | Bluetooth sim; perfil **?** | ? / ANT+ | ? | 🔎 confirmar | P |
| **Matrix CXC / CXM / IC7** | ? | ? | ? | ? | 🔎 | ? |
| **BH Duke Electronic** | — | **nenhum** | — | — | ❌ | C |
| **BH Exercycle Smart / i.Concept** | de fábrica ou Dual Kit | **FTMS** | ? | ? | ✅ | C/P |
| **Wattbike Atom** | de fábrica | **FTMS + Power** + ANT+ FE-C | **3 conexões** | ? | ✅ (+ ERG) | C |
| **Wattbike Pro / Trainer** | monitor Modelo B (2013 em diante) | BLE + ANT+ | ANT+ | ? | ✅ provável | C |
| **Concept2 BikeErg (PM5)** | de fábrica | **Cycling Power** + próprio; FTMS nos firmwares novos | **1 conexão** / ANT+ sim | "PM5 \<série\>" | ✅ | C/P |
| **Peloton** | — | fechado (só com caixa de terceiros) | — | — | ❌ | C |
| **Echelon Connect** | — | protocolo próprio fechado | — | — | ❌ | P |
| **Nacionais de academia** (Movement Tour S, Embreex 344, Kikos Pro F12, Total Health) | sem console Bluetooth | — | — | — | ❌ (dá para pôr um pedivela de potência ou sensor de cadência) | P |
| **Move C5 / C3** (Brudden, uso em casa) | sem console; só app | BLE, perfil **?** | ? | ? | 🔎 | P |

**O que isso significa na prática:**
1. **Keiser** é o melhor caso, já pronto: a TV e o celular leem juntos.
2. **Bikes com FTMS ou Power aberto** (Stages, Wattbike, BH Smart, ICG TFT 2.0, Concept2, Keiser M Connect, provavelmente Spinning Power e Technogym Connect) já funcionam hoje: **cada aluno conecta a sua no celular**, e o app repassa à TV.
   - **Cuidado:** só 1 celular por bike.
   - **Ponto fraco:** achar "a sua" entre 20 bikes iguais. Onde o console anuncia o número ("Stages IC 12", "M3i#012"), a lista do app já mostra. Nas outras, vale a bike **mais perto** (o app mostra "perto / médio / longe").
3. **Bikes só com ANT+** (Schwinn Echelon2, Spinner Blade ION, ICG TFT 1.0, Skillbike) não funcionam no celular, mas **funcionam na TV com o pendrive ANT+ (07/10b)**: a TV lê todas ao mesmo tempo, como a Keiser.
   - **Parear:** tela de pareamento → **ANT+** → gire o pedal → escolha "ANT+ FE-C nnnnn" na lista.
   - Cada aluno vê os números no celular pelo servidor, como na Keiser.
4. **Peloton, Echelon e bikes sem console** ficam fora. Nas bikes sem console, a saída é um sensor ou pedivela de potência por aluno.

## 3b. Pendrive ANT+ na TV (07/10b)
- **Pendrives:** Garmin/Dynastream ANT USB-m, USB2 e compatíveis (fabricante USB 0x0FCF).
- **Como o Windows mostra:**
  - **porta COM** (pendrives com chip Silicon Labs): funciona como o BLED112 (Web Serial);
  - **"ANT USB Stick"**: no computador da TV, instalar uma vez o driver **WinUSB** com o **Zadig**. Depois disso, o Garmin Express e o Zwift desse computador não usam mais o pendrive.
- **O que a TV lê:**
  - **FE-C** (bikes e rolos): watts, cadência e FC;
  - **Potência**: watts e cadência;
  - **Cadência** e **Velocidade + Cadência**;
  - **FC**: a cinta é lida, mas não aparece como bike.
- **Protocolo** ("ANT Message Protocol and Usage"):
  1. reset `4A`;
  2. chave da rede ANT+ `46`;
  3. canal de recepção `42`;
  4. qualquer aparelho `51`;
  5. frequência 2457 MHz `45 39`;
  6. pacote com o nº e o sinal `6E C0`;
  7. escuta contínua `5B`.
- **Teste:** `testes/antplus.test.js`.

## 4. Rolos de treino (em casa)
| Marca / modelo | Padrão | Situação |
|---|---|---|
| Wahoo KICKR, KICKR Core, Snap, Move, KICKR Bike | FTMS + Cycling Power | ✅ (+ ERG) |
| Tacx / Garmin Neo, Flux, Flow, Vortex | FTMS + Cycling Power | ✅ (+ ERG) |
| Elite Suito, Direto, Zumo, Justo | FTMS + Cycling Power | ✅ (+ ERG) |
| Saris H3 / M2 | FTMS + Cycling Power | ✅ (+ ERG) |
| Zwift Hub | FTMS + Cycling Power | ✅ (+ ERG) |
| JetBlack Victory / Volt | FTMS | ✅ |
| Magene T300 / T600, Thinkrider, Van Rysel D100 / D500 | FTMS + Cycling Power | ✅ |
| Kinetic Road Machine Smart | Cycling Power | ✅ |

## 5. Medidores de potência e sensores
| Tipo | Exemplos | Padrão | Situação |
|---|---|---|---|
| Pedal ou pedivela de potência | Favero Assioma, Garmin Rally/Vector, Stages, 4iiii, Quarq, SRM, Shimano, Magene P505 | Cycling Power | ✅ |
| Sensor de cadência | Wahoo RPM, Garmin, Magene S3+, iGPSPORT | CSC | ✅ (só cadência) |
| Cinta / relógio de FC | Polar, Garmin, Wahoo TICKR, Coospo, iGPSPORT | FC | ✅ |

## 6. Limites
- **iPhone no navegador:** o Safari não tem Bluetooth. Até o app estar na App Store, o caminho é o Bluefy.
- **iPhone, app das lojas:** a leitura da Keiser exige a tela do app aberta.
- **ANT+:** o celular não lê. A TV lê com o pendrive ANT+ (07/10b).
- **Uma conexão por bike** nas que conectam (FTMS / Power). A Keiser não tem esse limite.

## 7. Carga automática (ERG, 03/10s)
- **Alvo:** FTP do aluno × meio da faixa de %FTP do bloco (ex.: FTP 200 e bloco 91–105% → 196 W).
- **Comandos:** FTMS Control Point `0x2AD9`.
  - `00` pede o controle;
  - `07` começa;
  - `05` define a potência (int16, W);
  - `08 01` para.
- **Pelo padrão, só um aparelho por vez pode controlar** a bike.
- **Quem aceita:** rolos e bikes com FTMS e controle (KICKR, Tacx, Elite, Saris, Zwift Hub, JetBlack, Magene, Thinkrider, Stages SB20, Wattbike Atom). **Confirmar no 1º teste de cada aparelho.**

## 8. Testes automáticos
- **`testes/bluetooth.test.js`:** pacotes reais de FTMS, Power e CSC.
- **`testes/erg.test.js`:** carga automática.
- **`testes/blenativo.test.js`:** ponte do app das lojas.
- **`testes/keiser.test.js` (07/10a):**
  - anúncio Keiser no formato oficial;
  - resumo ignorado;
  - lista com o nº de cada bike;
  - leitura em casa sem conectar;
  - na aula, o celular ouve a própria Keiser pelo nº que a TV mandou, e volta ao número da TV quando o anúncio some.
- **`testes/aula15.test.js`:** TV ignora o resumo da Keiser.

## Fontes
- **Keiser:** [formato do anúncio](https://dev.keiser.com/mseries/direct), [receptor](https://dev.keiser.com/mseries/receiver/), [manual M3i](https://store.simplifaster.com/wp-content/uploads/2026/02/Keiser-M3i-User-Manual.pdf).
- **Stages:** [nº da bike no SIC2](https://support.stagescycling.com/support/solutions/articles/11000100324-how-to-set-the-bike-number-on-the-sic2-console), [gravar com apps](https://support.stagescycling.com/support/solutions/articles/11000099387-recording-with-fitness-apps), [conexões do medidor](https://support.stagescycling.com/support/solutions/articles/1000162630-i-can-t-find-my-power-meter-on-the-stages-cycling-app), [SB20](https://support.stagescycling.com/support/solutions/articles/11000083120-what-devices-work-with-the-stages-sb20-).
- **Schwinn:** [manual do Echelon2](https://sheldonbrown.com/cyclecomputers/Schwinn/mpower_echelon2.pdf), [Core Health](https://www.corehandf.com/products/schwinn-echelon2-with-power).
- **ICG / Life Fitness:** [suporte ICG](https://www.teamicg.online/en/content/pages/ICGAppSupport), [manual do TFT](https://kb.cybexintl.com/Owners_Manuals/Bike/ICG_Wattrate_TFT_CBC_Computer_Console_Manual_320-00-00010-11.pdf).
- **Spinning:** [PRO Power](https://spinning.com/pro-power), [Studio Computer](https://spinning.com/spinpowerstudiocomputer/).
- **Wattbike:** [Atom (DC Rainmaker)](https://dcrainmaker.com/2019/09/wattbike-announces-availability.html), [conectar no Zwift](https://support.zwift.com/en_us/connecting-a-wattbike-rkMmoNbxS.md).
- **Concept2:** [comunicação do PM5](https://cms.concept2.com/sites/default/files/2024-05/PM5_CSAFECommunicationDefinition_0.pdf).
- **BH:** [i.Concept](https://bhfitness.com/en/?p=10705).
- **Peloton:** [DC Rainmaker](https://www.dcrainmaker.com/2021/04/peloton-power-data-broadcaster-dfc-launches-hands-on-details.html).
- **iOS sem MAC:** [Apple CBPeer.identifier](https://developer.apple.com/documentation/corebluetooth/cbpeer/identifier.md).
- **Plugin do app:** [@capacitor-community/bluetooth-le](https://unpkg.com/@capacitor-community/bluetooth-le@8.2.0/README.md).
