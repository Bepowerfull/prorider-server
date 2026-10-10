Oi! O servidor 03/10n está no ar, obrigado! Segue o **pacote 03/10o**, com os **Termos de uso e a Política de privacidade (LGPD)**. Ele substitui o 03/10n.

## 1. Subir
- **`server.js`.**
- **Site (`public/`):**
  - **novos:** `termos.html` e `privacidade.html`;
  - **atualizados:** `pr-suporte.js`, `academia.html`, `financeiro.html`, `aluno.html`, `aluno/index.html` (app do aluno) e `index.html`.
  - O mais simples é substituir a pasta `public/` inteira pela `2_SITE_pasta_public/` do pacote.
- **Na raiz do repositório:**
  - **novo:** `testes/termos.test.js`;
  - **atualizados:** `testes/rodar.js`, `testes/loja.test.js`, `testes/desafios.test.js` e `testes/seguranca.test.js`.
- **Nada para mudar no Railway.** Ao subir, o servidor cria sozinho as colunas `users.termos_versao` e `users.termos_aceitos_em` e a tabela `termos_aceites`.

## 2. Antes do deploy
```
TEST_DATABASE_URL=postgres://postgres:SENHA@localhost:5432/prorider_teste node testes/rodar.js
```
Agora são **9 grupos** (novo: **termos**). Só suba com **"TUDO OK — pode subir."**

## 3. Depois de subir (3 minutos)
1. Abra `/termos.html` e `/privacidade.html` no celular: as duas páginas têm que abrir.
2. No app do aluno, em **Criar conta**, têm que aparecer as 2 caixas, e a conta só é criada com as duas marcadas.
3. Entre no app com uma conta antiga de aluno: tem que aparecer a tela **"Antes de continuar"**. Aceite e confira que ela não aparece de novo.

## 4. Ginásio
- Se as TVs **já estão na 03/10n**, não precisa reinstalar: a 03/10o é o mesmo programa.
- Se ainda estão na **03/10m**, instale a **03/10o** nas 3 (Clube, Demo 01 e Demo 02), seguindo o `ATUALIZAR_AS_TVS.md`.

## 5. Ainda pendente
- **UptimeRobot** chamando `/ping` a cada 5 min.
- **Railway Pro:** prioridade do Mario, contratar ao concluir o projeto. Até lá vale o backup do servidor (o Mario baixa toda semana).

Obrigado!
