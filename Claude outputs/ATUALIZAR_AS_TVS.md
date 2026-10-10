# Atualizar o Ginásio nas TVs (Clube, Demo 01 e Demo 02) — BUILD 03/10r

> **Instalar a 03/10r nas 3 TVs** (hoje estão na 03/10m; a 03/10r já inclui a n, p e q). Novidades para a TV:
> - **a TV passa a falar com o servidor pelo endereço novo `app.prorider.app.br`** (o login da TV continua; não precisa reativar);
> - a TV parada no menu ou no fim de aula volta sozinha para a tela de espera depois de 10 min;
> - aluno com bike de outra marca ligada no celular aparece no cartão;
> - música e vídeo do Dropbox baixados pelo endereço direto do arquivo.



## Parte 1 — gerar o programa novo (uma vez só, no computador onde fica `C:\ProRider\Executavel`)

1. Feche o ProRider, se estiver aberto.
2. Descompacte `3_GINASIO/ProRider_1_GINASIO_03-10r.zip` dentro de **`C:\ProRider\Executavel\app\`** e escolha **substituir** os arquivos.
3. Abra o **Prompt de Comando** nessa pasta (`C:\ProRider\Executavel`) e rode: `npm run dist`
4. Quando terminar, o programa novo fica em **`C:\ProRider\Executavel\dist\`** (o arquivo `.exe`).

## Parte 2 — instalar em cada TV (Clube, Demo 01 e Demo 02)

1. Copie o `.exe` novo para o computador da TV (pendrive, OneDrive ou rede) e coloque **no mesmo lugar** do programa antigo, substituindo-o.
2. Abra o ProRider.
3. Confira, na tela inicial (canto de baixo, à direita): **BUILD 03/10r**.
4. A ativação da licença continua (não pede o código de novo). Se pedir, use o código da licença dessa academia (Portal → Licenças).
5. Abra **uma aula de teste** até a tela do QR e feche — isso faz a TV aparecer como online na Saúde do sistema.

## Parte 3 — conferir no admin

Admin → **Saúde do sistema** → tabela **TVs (Ginásio)**: as três devem mostrar **BUILD 03/10r** e "● online" (enquanto o programa estiver aberto).

## Se algo der errado

- Volte a usar o `.exe` antigo (guarde uma cópia antes de substituir).
- Tire foto da tela e mande para o Mario/Claude. Se aparecer um código **E-XXXX** pequeno no canto da TV, anote: ele acha o erro na lupinha da Saúde do sistema.
