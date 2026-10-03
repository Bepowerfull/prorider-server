# ProRider · 23/09 · o que preciso de você

**Anexos deste pacote:**

| Arquivo | Versão | Vai para |
|---|---|---|
| `aluno.html` | BUILD 23/09d | Railway, servido em `/aluno` |
| `CHANGELOG.md` | entradas 23/09b, 23/09c e 23/09d | raiz do `prorider-server` |
| `ProRider_1_GINASIO_23-09c.zip` | BUILD 23/09c | executável do Ginásio (item 4); **não** vai para o Railway |
| `PERGUNTAS_DESENVOLVEDOR_23-09.md` | — | responder e devolver ao Mario |

Estes arquivos substituem os anexos da 23/09b.

## 1. URGENTE: o Ginásio está a ser recusado pelo servidor (401)

Na TV, `/display/agenda`, `/display/proxima-aula` e `POST /ginasio/pareamento` respondem **401**. Por isso, em *Minhas Aulas*, o QR do pareamento não aparece e a tela mostra "Sem ligação".

O `server.js` da pasta local já exige `JWT_SECRET` e não tem chave de reserva. Ótimo. Mesmo assim, o `displayAuth` devolve 401 em dois casos diferentes:
- `{"error":"Token inválido"}`: o token foi assinado com outro `JWT_SECRET`. A chave foi trocada, ou o código publicado não é o da pasta local;
- `{"motivo":"outro_computador"}`: a licença foi ativada noutro computador (`licenca_computadores`).

**O que fazer:**
1. Confirmar no Railway que `JWT_SECRET` está definido e dizer se ele foi criado ou trocado depois de 14/09.
2. Confirmar que o commit publicado é o mesmo da pasta local (pergunta 2 do documento).
3. Não trocar a chave nunca mais.
4. Me avisar. Depois disso, o Mario reativa o Ginásio uma vez com o código da licença.

**Como confirmar:** depois da reativação, as três rotas devolvem **200** e o QR de Minhas Aulas aparece. Faça **mais um redeploy** e confirme que continuam 200.

## 2. Publicar o app do aluno 23/09d

- **Pré-requisito:** o Railway tem de estar no commit `1263390` ou mais novo (`prof_remover_aluno`, `prof_trocar_bikes`, `prof_trancar_bike` e `GET /agenda/aula-ativa/:license_id`).
- Substituir o `aluno.html` servido em `/aluno` pelo anexo.
- **Como confirmar:** abrir `/aluno`, F12, e ver `[ProRider Aluno] BUILD 23/09d`.
- Não precisa de nenhuma mudança no `server.js`.

## 3. CHANGELOG

Substituir o `CHANGELOG.md` da raiz do `prorider-server` pelo anexo e fazer o commit junto com o item 2.

## 4. O executável do Ginásio está parado na 20/09c

Na TV, o Console mostra `[ProRider] BUILD 20/09c` (script.js:9072) e `[BLED112] Electron requestPort falhou…`. Essa mensagem não existe no `bled112.js` das pastas. Ou seja, a TV roda o **executável** com os arquivos empacotados nele, e nada do que foi instalado nas pastas desde 20/09 chegou à tela.

**Primeiro, só verificar e me mandar** (perguntas 5 a 9 do documento):
- o diff entre o `bled112.js` do executável e o do zip 23/09c;
- como o executável é gerado e de que pasta tira os arquivos.

**Não mude nada na leitura das bikes.** Não gere um executável novo sobrescrevendo o `bled112.js` dele com o do zip: o do executável tem o caminho Electron para a porta serial, e as bikes conectam normalmente com ele. Com o diff na mão, o Mario me manda e eu junto os dois num `bled112.js` só.

**Depois disso:** gerar o executável com os arquivos da 23/09c mais o `bled112.js` unificado.

**Como confirmar:** na TV, F12 → Console → filtro `BUILD` → `[ProRider] BUILD 23/09c`.

## Ordem

1 → Mario reativa o Ginásio → 2 + 3 no mesmo deploy → 4 (diff primeiro, executável depois) → devolver o documento de perguntas respondido.
