# ProRider — app das lojas (Android e iPhone) · 03/10u

Projeto **Capacitor 8**. O app instalado abre o app do aluno que já está no servidor (`https://app.prorider.app.br/aluno/`) e usa o **Bluetooth nativo** do celular. O iPhone deixa de precisar do Bluefy.

- **Atualizar o app do aluno não exige nova versão na loja:** basta subir o servidor, como hoje.
- **Nova versão na loja** só é preciso para mudar algo nativo: permissões, ícone, versão do Capacitor ou do plugin.

## Como funciona
- `capacitor.config.json` → `server.url` aponta para o app no servidor. `www/erro.html` aparece quando não há internet.
- **Bluetooth:** o plugin `@capacitor-community/bluetooth-le` fica no app nativo. No `aluno.html` existe a ponte "BLUETOOTH NO APP DAS LOJAS", que cria um `navigator.bluetooth` igual ao do Chrome por cima do plugin.
  - O resto do app não mudou: Keiser, FTMS, potência, cadência, cinta e carga automática (ERG).
  - No navegador comum a ponte não faz nada.
- **A escolha do aparelho** é uma lista do próprio app, com o mesmo filtro do Chrome. Na bike, só aparecem bikes, rolos e sensores.
- **Câmera** (QR da aula) e **localização** ("Perto de mim") funcionam pelo WebView, com as permissões já declaradas.
- **Teste automático:** `testes/blenativo.test.js` abre o app com um plugin simulado e confere procurar, escolher, conectar, números, ERG, cancelar e queda.

## Identidade
| | |
|---|---|
| Nome | ProRider |
| ID do app (Android `applicationId` / iOS Bundle ID) | `br.app.prorider` |
| Versão | 1.0 (Android `versionCode 1`) |
| Ícone e abertura | raio do logo sobre fundo `#0d0d0f` (`assets/` → `npm run icones` gera todos os tamanhos) |
| Android mínimo / alvo | API 24 (Android 7) / API 36 |

## Gerar o Android (Windows, Mac ou Linux)
Precisa de **Android Studio** (com o SDK) e **JDK 21**.
```
cd app-lojas
npm ci
npx cap sync android
npx cap open android
```
1. **Teste rápido:** no Android Studio, ligue um celular com depuração USB e clique em ▶ Run. Confira:
   - procurar a bike e a cinta;
   - o QR da aula;
   - "Perto de mim".
2. **Para a loja:** Build → Generate Signed App Bundle → **AAB**.
   - Crie a **chave de envio (keystore)** e **guarde o arquivo e as senhas com o Mario**, fora do computador.
   - Sem ela não se publica atualização. O Play App Signing permite trocar a chave de envio, mas dá trabalho.
3. Envie o `.aab` no Play Console, primeiro no **teste fechado** (veja `APPS_NAS_LOJAS.md`).
4. **A cada versão nova na loja:** subam o `versionCode` (+1) e o `versionName` em `android/app/build.gradle`.

## Gerar o iPhone (só num Mac)
Precisa de **Xcode** (atual) e da conta Apple Developer do Mario (Account Holder ou Admin).
```
cd app-lojas
npm ci
npx cap sync ios
npx cap open ios
```
1. **Xcode → target App → Signing & Capabilities:** marque "Automatically manage signing" e escolha o Team.
2. **Teste num iPhone de verdade** (cabo ou TestFlight): Bluetooth, câmera e localização.
3. **Para enviar:** Product → Archive → Distribute App → App Store Connect. Depois, TestFlight → revisão.
4. **A cada versão:** subam o Version e o Build.
- As permissões com os textos já estão no `ios/App/App/Info.plist`: Bluetooth, câmera, localização e criptografia isenta.

## Permissões declaradas
- **Android:**
  - `BLUETOOTH_SCAN` (sem localização) e `BLUETOOTH_CONNECT`;
  - `BLUETOOTH`/`BLUETOOTH_ADMIN` até o Android 11;
  - localização aproximada e precisa ("Perto de mim" e a procura de Bluetooth no Android ≤ 11);
  - câmera;
  - `bluetooth_le` obrigatório.
- **iOS:** `NSBluetoothAlwaysUsageDescription`, `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `ITSAppUsesNonExemptEncryption = false`.

## Cuidados
- **Não troquem o `server.url`** sem trocar também o `allowNavigation`.
- **Compras dentro do app** (aulas gravadas, pacotes, assinaturas) seguem as regras das lojas para bens digitais. Antes de publicar, o Mario decide como fica (veja `APPS_NAS_LOJAS.md`).
- **O QR da TV** "Ainda não tem o app?" ainda aponta para `/prorider.apk`, que não existe, e o link do iPhone é provisório. Quando os apps estiverem nas lojas, troquem para os links das lojas (`gin/script.js`: `_ANDROID_APK_URL`, `_IOS_APP_URL`).
