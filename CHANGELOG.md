# ProRider — Registro de mudanças

## A regra

**Toda atualização gera uma entrada aqui, no mesmo commit.**

- Quem muda o código escreve a entrada — nunca depois.
- Se a mudança altera **como o sistema funciona** (uma rota nova, uma tabela, um fluxo), atualiza também o `ARQUITETURA.md`.
- A entrada responde a três perguntas: **o que mudou, por quê, e como confirmar que funciona.**
- Os dois arquivos ficam na raiz do `prorider-server` e vão para o GitHub junto com o código.

O `ARQUITETURA.md` diz **como o sistema é hoje**. Este arquivo diz **como chegou até aqui**. Quando algo quebrar, o primeiro responde *onde olhar*; o segundo, *o que mudou desde que funcionava*.

### Modelo

```markdown
## AAAA-MM-DD · componente · versão ou commit

**O que mudou**
- …

**Por quê**
- …

**Como confirmar**
- …

**Cuidados**
- (o que pode quebrar, dependências, ordem de publicação)
```

Componentes: `servidor` · `app` · `ginasio` · `portal` · `banco`.

---

## 2026-09-22 · servidor · d31da68

**O que mudou**
- Fix: migração `licenses` legacy isolada em try/catch — já não bloqueia as migrações seguintes.

**Por quê**
- `ALTER TABLE licenses` falhava porque a tabela não existe neste banco; o erro interrompia o bloco e as novas tabelas nunca eram criadas.

**Como confirmar**
- Logs do Railway: `Migração licenca_computadores OK`, `Migração treinos_professor + pareamentos_ginasio OK`.

---

## 2026-09-22 · servidor · 44683d5

**O que mudou**
- `JWT_SECRET`: remove fallback inseguro; só aviso no log se não definida.
- `POST /display/ativar`: aceita `device_id` e `nome_computador`; token passa a expirar em 15 dias.
- `POST /display/renovar` (novo): aceita token vencido há < 30 dias; migração automática dos tokens permanentes antigos.
- `displayAuth`: verifica `device_id` em `licenca_computadores`; tokens sem `device_id` aceites provisoriamente.
- Migrações: `licenca_computadores`, `max_computadores`, `pagamento_ok_ate` em `licencas`.
- Migrações: campos de endereço e contacto em `licencas` (`email_financeiro`, `logradouro`, `cep`, `lat`, `lng`, …).
- Migrações: `treinos_professor`, `pareamentos_ginasio`.
- Rotas CRUD `POST/GET/PUT/DELETE /professor/treinos`.
- `POST /professor/parear`: confirma pareamento; valida acesso à licença via `professor_licencas`.
- `POST /ginasio/pareamento`: Ginásio gera código de 6 hex, válido 120 s.
- `GET /ginasio/pareamento/:codigo`: devolve status e token de sessão ao confirmar.
- `GET /ginasio/treinos` e `GET /ginasio/treinos/:id`: leitura dos treinos do professor pareado (token `prof_session`, 4 h).
- `app 20/09f` deployado em `public/aluno/index.html`.

**Por quê**
- Documento-mestre de 22/09: todas as decisões tomadas desde 19/09.

**Como confirmar**
- `POST /display/renovar` devolve `{ token }` com prazo de 15 dias.
- `GET /professor/treinos` com token de aluno autenticado devolve `{ treinos: [] }`.
- App em aba anónima: frase "Qual é a sua bike".

**Cuidados**
- `JWT_SECRET` já está definida no Railway (`prorider2026mario`). Não trocar — desfaria todos os tokens activos.

---

## 2026-09-22 · documentação

**O que mudou**
- Criados `ARQUITETURA.md` e este `CHANGELOG.md`.

**Por quê**
- Boa parte do conhecimento do sistema só existia em conversas. O incidente de 19/09 e o deploy no repositório errado levaram horas a diagnosticar por falta de um registro assim.

---

## 2026-09-20 · ginasio · 20/09c

**O que mudou**
- Identidade do computador (`device_id`), enviada em `/display/ativar`.
- Renovação automática do token do display: ao abrir e a cada 6 h, quando faltam menos de 3 dias.
- 401 → pede o código de novo, com aviso se foi outro computador. 403 → tela LICENÇA SUSPENSA.

**Por quê**
- Licença vendida roda num computador só; o pagamento é conferido a cada 15 dias.

**Como confirmar**
- Console: `licenca renovada — valida ate dd/mm/aaaa`.

**Cuidados**
- Nada interrompe uma aula em curso. Tolera o servidor antigo: sem `/display/renovar` (404), segue com o token atual.

---

## 2026-09-20 · ginasio · 20/09b

**O que mudou**
- Ao receber 401 em `/display/*`, descarta o token e abre a tela de ativação.

**Por quê**
- O 401 aparecia desde 14/09 e era ignorado; o Ginásio guardava um token morto para sempre.

---

## 2026-09-20 · ginasio · 20/09a

**O que mudou**
- *Carregar aula* pergunta a origem: *Do pendrive* ou *Minhas aulas*.
- *Minhas aulas*: QR de pareamento; as aulas da nuvem entram na mesma lista do pendrive.

**Cuidados**
- Depende das rotas `/ginasio/*` e `/professor/parear` — especificadas no documento-mestre de 22/09.

---

## 2026-09-20 · app · 20/09f

**O que mudou**
- Construtor: digitar números, editar blocos, recado do treinador, vídeo e música pelo nome, marcar chegada, exportar no formato 1.1, salvar na conta, baixar `.json`.
- Card comprido *Construtor de Treino* na home do professor.
- *Vista da Sala* na gaveta: grelha de bikes, bike 99, estados, `NÃO VEIO` / `LIBERAR`.
- Professor reconhecido pela lista de unidades, não pelo `role`.
- Confirmação de pareamento por `?parear=CODIGO`.

**Correções**
- Corrida no login: a decisão era tomada antes de a lista de unidades chegar.
- Rotação exibida como "8-0 rpm" no *Revisar o treino*.

**Como confirmar**
- Frase "Qual é a sua bike" em aba anônima.

---

## 2026-09-22 · app · 7aa3bee

**O que mudou**
- `phInit`: aceita `professor|gestor|admin|super_admin` (antes só `professor`).
- `profTemAcesso`: verifica `l.codigo` (campo real da resposta do servidor).
- `_salaEhProfessor`: retorna `false` quando `_profLicencas` é `null`.

**Por quê**
- Gestor e super_admin não conseguiam aceder à interface de professor.

**Como confirmar**
- Login com `marioelite@hotmail.com` → interface de professor visível.

---

## 2026-09-20 · servidor · 299c73c

- `GET /professor/licencas` sem filtro de `role`.
- `POST /gestor/professores` aceita qualquer conta.

## 2026-09-20 · servidor · 8f33946

- Tabela `professor_licencas`; `professorAuth` confere acesso por unidade.
- Rotas `/gestor/professores`.

## 2026-09-20 · servidor · 38b391c

- `professorAuth`; `bike_numero` em `aulas_reservas`; timer de 10 min.

---

## 2026-09-19 · servidor · c1e80cc, 2edbaf6

**O que mudou**
- `CREATE TABLE IF NOT EXISTS` para `aulas_completadas` e `shared_aulas`, antes dos `ALTER`.

**Por quê**
- O `ALTER` numa tabela inexistente derrubava o servidor no arranque. O Railway reiniciava em laço desde as 22:59 de 18/09 — foi o que derrubou os 13 alunos em duas aulas.

**Como confirmar**
- Logs do Railway sem `Starting Container` repetido.

---

## 2026-09-19 · ginasio · 19/09c

**O que mudou**
- O gráfico paginado usa o **trecho contínuo** do segmento atual, não todos os blocos com o mesmo `segmentId`.

**Por quê**
- Em aulas com segmentos intercalados, o gráfico repetia trechos e a página não virava.

---

## 2026-09-19 · deploy

**O que mudou**
- O app passou a ser publicado em `prorider-server/public/aluno/index.html`.

**Por quê**
- Os commits anteriores iam para o repositório `prorider-aluno`, que o Railway não usa. Nenhuma correção do app chegava ao celular.
