# Teste do dia inteiro (aula de 10 horas) — 03/10x

**Objetivo:** deixar uma aula de 10 horas rodando na TV para confirmar três coisas:
- a TV não trava;
- a memória não cresce sem parar;
- a aula não perde a conexão.

Eu acompanho de longe pela Saúde.

## Antes
1. O desenvolvedor sobe o servidor **03/10x** e instala o Ginásio **03/10x** nesse computador.
2. A TV precisa estar **ativada** com o **código da TV** (Admin → Licenças).
   - Sem ativação, a Saúde não recebe os números.
   - Se for um computador a mais na licença, ele conta como mais um computador dela.

## Rodar
1. Copie o **`TESTE_10_HORAS.json`** para a **raiz do pendrive**. A outra opção é abrir no Construtor e salvar.
2. No Ginásio, escolha a aula **TESTE 10 HORAS** e dê **START**.
   - Pode ser sem bike e sem aluno.
   - Se puder, entre com o seu celular em parte do tempo.
3. **Deixe a tela ligada.** Desligue a proteção de tela e o modo de suspensão do Windows.

A aula tem:
- aquecimento de 10 min;
- 10 segmentos de 58 min ("Hora 1" a "Hora 10");
- volta à calma de 10 min.

São 124 blocos, com troca de bloco a cada 1 a 8 minutos.

## Acompanhar
**Admin → Saúde → TVs**, coluna **"Saúde da TV"**. Ela é atualizada a cada minuto e mostra:
- a memória e quanto ela subiu na última hora;
- os quadros por segundo;
- há quanto tempo a TV está ligada e há quanto tempo a aula está rodando;
- as quedas de conexão e os erros.

O link **"histórico"** mostra a memória ao longo das horas, com um ponto a cada 5 minutos.

## O que é normal
| Item | Normal | Problema |
|---|---|---|
| Memória | sobe um pouco na 1ª hora e depois fica estável | cresce sem parar (a Saúde avisa acima de +150 MB/h ou 80% do limite) |
| Quadros por segundo | 50–60 | abaixo de 30 |
| Quedas | 0 | aparecem várias |
| Erros | 0 | aparecem |

Quando terminar, me avise que eu leio o histórico.
