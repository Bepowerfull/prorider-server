# ProRider nas lojas (Google Play e App Store) — o que falta e o que o Mario faz

O projeto dos apps está pronto (`app-lojas/`, veja o `LEIA-ME.md` de lá).

- **O app instalado é o mesmo app do aluno**, mas com o **Bluetooth do próprio celular**. O iPhone deixa de precisar do Bluefy.
- **Atualizar o app do aluno continua sendo só subir o servidor.** A loja só recebe nova versão quando muda algo do aparelho (ícone, permissões).

## 1. Contas (só o Mario pode criar: são no nome dele, com documento e cartão)

| | Google Play Console | Apple Developer Program |
|---|---|---|
| Custo | **US$ 25, uma vez só** | **US$ 99 por ano** |
| Pessoa física (hoje, sem CNPJ) | documento com foto, cartão, Gmail com verificação em 2 etapas | ID Apple com verificação em 2 etapas, nome legal completo, endereço (sem caixa postal) |
| Empresa (depois do CNPJ) | precisa do **D-U-N-S** | precisa do **D-U-N-S**, e-mail do domínio (ex.: @prorider.app.br) e site no ar |
| Regra extra | **Conta pessoal nova:** antes de publicar, um **teste fechado com pelo menos 12 testadores por 14 dias seguidos** | — |
| Nome que aparece na loja | o nome de desenvolvedor que você escolher | pessoa física: **seu nome**; empresa: o nome da empresa |

**Sugestão:** criar as duas contas **como pessoa física agora**.
- No Google, os 12 testadores por 14 dias são fáceis: alunos do Clube e das Demos que tenham Android.
- Quando sair o CNPJ, dá para pedir a mudança para empresa (na Apple, pelo suporte). O D-U-N-S para empresa é gratuito, pela Dun & Bradstreet.

## 2. Passo a passo
1. **Mario:** criar a conta do Google Play Console e pagar os US$ 25. Criar a conta Apple Developer e pagar os US$ 99.
2. **Mario:** convidar o desenvolvedor nas duas contas: Play Console → Usuários e permissões; App Store Connect → Usuários, como Admin ou App Manager.
3. **Desenvolvedor:**
   - Android: gerar o app de teste e mandar o link do teste fechado do Play Console;
   - iPhone: gerar o build pelo Mac e mandar o convite do TestFlight.
4. **Mario e alunos:** testar o app de verdade, na academia e em casa. **O primeiro teste com um rolo real** (ERG) entra aqui.
5. **Google:** com 12 testadores por 14 dias, pedir o "acesso à produção" no Play Console e publicar.
6. **Apple:** enviar para revisão (costuma levar de 1 a 3 dias).
7. **Desenvolvedor:** trocar os links do QR da TV ("Ainda não tem o app?") para os das lojas.

## 3. Decisão do Mario antes de publicar: compras dentro do app
A loja do app vende **aulas gravadas, pacotes e assinaturas**, que são bens digitais. As lojas têm regras e cobram comissão sobre isso:
- **Apple no Brasil:** desde **18/06/2026** (acordo com o Cade, iOS 26.5+), aceita pagamento de terceiros lado a lado com o da Apple, mas **cobra comissão** sobre vendas digitais, de até 21% (10% para pequenas empresas e assinaturas renovadas depois do 1º ano).
- **Google:** a regra nova de pagamento alternativo chega ao Brasil só em **30/09/2027**. Até lá vale a regra atual, em que bem digital vendido dentro do app usa o faturamento do Google.

**Opções:**
- **A (mais simples para sair logo):** nas versões das lojas, a "Loja" mostra o que o aluno já tem e **não vende** dentro do app. A compra continua pelo site (app.prorider.app.br). Cuidado: em geral as lojas não deixam o app mandar o aluno comprar fora ("compre no site"), então o app só não mostra a compra.
- **B:** vender pelas lojas (Google Play Billing / Apple In-App Purchase). Dá mais trabalho e a loja fica com a comissão.
- **C (só Apple Brasil):** manter o Asaas lado a lado com a Apple, pagando a comissão.

O que **não** muda:
- **Reserva de bike** e **aula presencial** são serviço no mundo real: ficam fora dessa regra.
- **A licença das academias** é paga pelo Portal, fora do app.

**Recomendação:** começar pela **A**. Quando a loja do app tiver volume, avaliar a B ou a C com o contador. *(Não sou advogado nem contador; confirme com eles antes de decidir.)*

## 4. O que preencher nas lojas (textos prontos)
- **Nome:** ProRider
- **Subtítulo (Apple, até 30):** Spinning com números ao vivo
- **Descrição curta (Google, até 80):** Aulas de spinning com seus números na TV da academia, rankings e desafios.
- **Descrição completa:**
  > O ProRider leva seus números para a aula de ciclismo indoor. Na academia, leia o QR da TV, escolha sua bike e veja potência, cadência, frequência cardíaca, zonas e calorias ao vivo, no seu celular e no telão.
  > • Reserve sua bike na grade da academia.
  > • Rankings, brasões, desafios e campeonatos com a turma e entre academias.
  > • Teste de FTP e zonas de treino calculadas para você.
  > • Em casa: conecte seu rolo inteligente, bike, medidor de potência ou cinta por Bluetooth. Com rolos compatíveis, a carga ajusta sozinha para o alvo de cada bloco.
  > • Aulas gravadas pela sua academia, com seus números.
  > • Exporte seus treinos para o Strava e o Garmin.
- **Palavras-chave (Apple, até 100):** spinning,ciclismo indoor,bike,academia,ftp,potência,cadência,treino,rolo,ranking
- **Categoria:** Saúde e fitness
- **Classificação etária:** Livre (Google) / 4+ (Apple). Os termos dizem "a partir de 18, ou 12 a 17 com responsável", o que não muda a classificação.
- **Política de privacidade:** https://app.prorider.app.br/privacidade.html
- **Site e suporte:** https://app.prorider.app.br · e-mail marioelite@hotmail.com
- **Conta de teste para o revisor** (as duas lojas pedem): criar um aluno de demonstração, por exemplo revisor@prorider.app.br. A senha você cria e informa só no formulário da loja.
- **Imagens:** o ícone já está pronto (`app-lojas/assets/icon-only.png`, 1024×1024). Faltam:
  - **prints do celular** (Google: 2 a 8; Apple: 6,9" e 6,5");
  - **imagem de destaque do Google** (1024×500).

  Posso montar todos a partir das telas do app.

## 5. Formulários de privacidade (respostas, conforme a nossa Política de privacidade)
- **Dados coletados:**
  - nome, e-mail, foto (opcional);
  - dados físicos (peso, altura, idade);
  - **saúde e fitness:** frequência cardíaca, potência, treinos;
  - histórico de compras;
  - IP e dados do aparelho.
- **Localização:** usada **só no momento** ("Perto de mim"), **não é coletada nem guardada**.
- **Uso dos dados:** funcionamento do app e conta; nada de publicidade; **não vendemos nem compartilhamos para propaganda**.
- **Criptografia:** dados em trânsito criptografados (HTTPS).
- **Excluir a conta:** dentro do app (Perfil → Excluir conta). O Google pede também um link na web; usar a página de privacidade, que explica como pedir a exclusão.
- **Bluetooth:** só para ler a bike, o rolo e a cinta e ajustar a carga. A localização **não** é derivada do Bluetooth.

## Fontes
- [Google Play — testes para contas pessoais novas](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
- [Google Play — taxa de US$ 25](https://afkarsoftware.com/en/blog-detail/google-play-console-account-2026-one-time-25-fee/)
- [Apple Developer Program — inscrição e requisitos](https://developer.apple.com/programs/enroll/?product=WM)
- [Apple libera pagamentos externos no Brasil (Poder360)](https://www.poder360.com.br/poder-tech/apple-libera-apps-de-lojas-rivais-e-pagamentos-externos-no-brasil/)
- [Google Play — nova era de escolha e cobrança](https://developer.android.com/blog/posts/a-new-era-for-choice-and-openness?hl=pt-br)
