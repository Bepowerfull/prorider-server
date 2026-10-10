Oi! O 03/10m está no ar, e as 3 TVs também estão na 03/10m. Obrigado!

Segue o **pacote 03/10n**, com duas mudanças:
1. **Ginásio:** a TV parada volta sozinha para a tela de espera (logo + aulas de hoje) depois de 10 min sem ninguém mexer.
   - Antes, com o controle (joystick) ligado, o contador zerava o tempo todo e a TV ficava parada no menu ou no fim de aula.
   - Ela **nunca** volta sozinha com a aula rodando ou pausada, na contagem 3-2-1, gravando, na sessão livre ou na tela do QR.
   - Na tela do QR ela não volta nem vazia: o professor deixa a aula preparada 20–30 min antes e sai, e os alunos vão chegando.
2. **Admin:** o botão **"✓ Resolvido"** dos avisos agora confere se o problema acabou antes de fechar o aviso.

## 1. Subir
- **`server.js`** e o **`index.html`** do site (página do admin).
- Na raiz do repositório: `testes/vigia.test.js`, `testes/conferencia.test.js` e `testes/rodar.js`.
- Nada muda no Railway nem no banco.

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
São **8 grupos**. Só suba com **"TUDO OK — pode subir."**

## 3. TVs: instalar o Ginásio 03/10n nas 3 (Clube, Demo 01 e Demo 02)
- Siga o `ATUALIZAR_AS_TVS.md`.
- Para conferir:
  - na Saúde do sistema, as 3 TVs devem mostrar **BUILD 03/10n**;
  - deixe uma TV no menu, com o controle ligado, por 10 min: ela deve ir para a tela de espera.

## 4. Ainda pendente
- **UptimeRobot** chamando `/ping` a cada 5 min.
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto. Até lá vale o backup do servidor (o Mario baixa toda semana).

Obrigado!
