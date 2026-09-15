# Colocar o Compra de Casa online

Você vai usar o **GitHub para guardar os arquivos**, o **Firebase para guardar os dados e controlar o acesso** e a **Vercel para publicar o aplicativo**. Não é necessário contratar um servidor próprio.

## 1. Configurar o Firebase e o login Google

1. Abra o [console do Firebase](https://console.firebase.google.com/) e crie ou abra seu projeto.
2. Registre um aplicativo **Web** pelo ícone **</>**. Copie os campos do objeto firebaseConfig para **config.js**, preservando a estrutura exportada. Não é necessário Firebase Hosting.
3. Em **Authentication → Sign-in method**, habilite **Google**, escolha o e-mail de suporte e salve. Não é necessário habilitar E-mail/senha, criar senha compartilhada nem cadastrar usuários manualmente.
4. Em **Firestore Database → Create database**, escolha **Standard**, banco **(default)** e **modo de produção**.
5. Abra **firestore.rules** nesta pasta, copie o conteúdo completo para **Firestore Database → Rules** e clique em **Publicar**. Não precisa inserir UID ou e-mails nas regras desta versão.

### Escolher quais e-mails têm acesso

No painel **Firestore Database → Data/Dados**:

1. Clique em **Start collection / Iniciar coleção**.
2. Nome da coleção: **allowedEmails** (exatamente assim, respeitando maiúsculas).
3. No **ID do documento**, coloque o e-mail completo da pessoa, por exemplo **nome@gmail.com**. Não use ID automático. Use o endereço exato da conta Google, sem espaços e sem trocar pontos ou adicionar apelidos com +.
4. Adicione o campo **enabled**, selecione tipo **boolean** e valor **true**. Não use o texto "true".
5. Salve. Repita com um documento por familiar autorizado, incluindo você.

Para remover acesso, altere **enabled** para **false** no documento correspondente. As regras consultam essa lista no servidor. O próprio aplicativo não pode ler nem modificar a coleção de permissões.

Todos os e-mails autorizados compartilham **households/casa**. Não crie esse documento vazio: ele será criado automaticamente ao salvar a primeira lista ou produto.

**Authentication → Users não é a lista de permissões.** Uma conta não autorizada pode aparecer ali após autenticar com Google, mas será impedida de ler ou alterar as compras. A autorização dos dados é feita pela coleção **allowedEmails** e pelas regras publicadas. Essas regras exigem e-mail verificado e autenticação pelo provedor Google.

O PIN 2210 foi removido. Cada pessoa entra com sua própria conta Google, sem compartilhar senha.

Referências: [login com Google](https://firebase.google.com/docs/auth/web/google-signin) e [condições das regras do Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions).

## 2. Colocar os arquivos no GitHub

1. Entre no [GitHub](https://github.com/) e clique em **New repository**.
2. Nome sugerido: `compra-de-casa`. Pode ser **Private**.
3. Crie o repositório. Na página inicial dele, use **uploading an existing file** ou **Add file → Upload files**.
4. Envie os arquivos da pasta do projeto diretamente para a raiz do repositório. Inclua `index.html`, `app.js`, `style.css`, `mobile-list.css`, `shopping-flow.css`, `domain.js`, `ocr.js`, `storage.js`, `config.js`, `icon.svg`, `package.json`, `build.mjs`, `vercel.json` e os guias. Pode incluir os testes e as regras também.
5. Não envie pastas `.git`, `node_modules`, `public`, `.vercel`, nem backups pessoais. Confirme em **Commit changes**.

Referência: [começar com repositórios no GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/quickstart-for-repositories).

## 3. Publicar na Vercel

1. Abra a [Vercel](https://vercel.com/) e entre usando sua conta GitHub.
2. Clique em **Add New → Project** e importe o repositório `compra-de-casa`. Autorize acesso a esse repositório quando solicitado.
3. Selecione **Other** como Framework Preset e mantenha a pasta raiz do repositório.
4. O arquivo `vercel.json` já informa o comando de build **node build.mjs** e a pasta de saída **public**. Se o painel pedir esses campos, use esses valores. Não são necessárias variáveis de ambiente para esta versão.
5. Clique em **Deploy** e aguarde a URL gerada, por exemplo `https://seu-projeto.vercel.app`.
6. No Firebase, vá a **Authentication → Settings → Authorized domains** e adicione o domínio fornecido pela Vercel, sem `https://` nem barras. Adicione também seu domínio próprio caso use um.
7. Abra o endereço no celular e toque em **Entrar com Google**, escolhendo uma conta autorizada. O indicador deve mostrar **Sincronizado com a casa**. Se mostrar **Salvo neste aparelho**, confira se `config.js` foi preenchido e enviado.

Quando você editar e salvar arquivos no GitHub, a integração da Vercel publica uma nova versão. Referência: [publicar repositórios Git na Vercel](https://vercel.com/docs/git).

## 4. Conferir antes de ir ao mercado

1. Crie uma lista para um mês anterior. Cadastre um produto com marca, tipo e embalagem, informe o preço, marque-o e finalize a compra.
2. Crie a lista do mês atual e escolha copiar. Verifique preço herdado e quantidade, com a marcação de comprado desativada.
3. Toque na câmera. Fotografe uma etiqueta nítida, confira o preço preenchido automaticamente e confirme. Veja a seta de variação.
4. Toque em **Salvar lista**. Abra o mesmo endereço em outro aparelho. Entre com outra conta Google autorizada e veja se a mesma lista aparece e recebe alterações.
5. Finalize a segunda compra, informe mercado, data e valor real do caixa e confira a aba **Evolução dos gastos**. Se houver itens não comprados, confira a nova lista de pendências. Em **Nossos produtos**, abra o gráfico de um produto e toque nos pontos.
6. No navegador do celular, use **Adicionar à tela inicial** para criar um atalho. O app precisa de internet para sincronizar e carregar a leitura de fotos.

## Dados locais e backup

A prévia local é restrita a localhost/127.0.0.1 e tem o botão **Experimentar neste aparelho**, sem autenticação. Um site publicado sem Firebase configurado fica com o acesso bloqueado. O modo local é separado do Firebase. Configurar o Firebase não transfere automaticamente dados que você criou antes. Use **Baixar backup** antes da mudança e **Importar backup** após entrar no Firebase para transferir os dados; a importação só é permitida em uma casa vazia, evitando sobrescrever compras existentes. Guarde esse arquivo com cuidado, pois contém seu histórico.

### Se já usou a versão com PIN

Antes de atualizar o app e as regras, baixe um backup na versão antiga. Depois de entrar com Google, importe o backup na casa compartilhada vazia. O documento antigo households/UID não é migrado automaticamente nem apagado. Os novos dados ficam em households/casa.

## Se algo não funcionar

- **Login bloqueado:** habilite Google em Authentication, confira o domínio autorizado e permita a janela de login. Prefira abrir diretamente no Chrome ou Safari, em vez do navegador dentro de um aplicativo de mensagens.
- **Acesso negado:** confira as regras publicadas, o banco `(default)` e o documento `allowedEmails/EMAIL_EXATO` com `enabled` do tipo boolean e valor `true`. Confira se escolheu a conta Google correta.
- **Foto sem resultado:** use boa iluminação, aproxime da etiqueta e tente JPG/PNG. Você sempre pode digitar o preço.
- **Não sincroniza:** confira conexão e configuração; o modo local não sincroniza entre aparelhos.
- **Outra pessoa atualizou:** confira os dados recebidos e repita a alteração. O app rejeita conflitos para preservar o que o outro aparelho salvou.

Os planos e limites dos serviços podem mudar. Confira o painel de uso do seu projeto. Esta versão guarda o histórico em um documento de até 1 MiB; um histórico muito grande exigirá dividir o armazenamento por lista.
