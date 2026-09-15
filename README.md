# Compra de Casa

Aplicativo doméstico em HTML, CSS e JavaScript. Listas mensais, cadastro por marca/tipo/embalagem, leitura de etiquetas com Tesseract.js, comparação de preços e gráficos mensais.

## Experimentar

Com Node.js instalado, abra o terminal nesta pasta e execute `node server.mjs`. Acesse http://localhost:4173 e clique em **Experimentar neste aparelho**. Não abra o HTML por duplo clique: módulos JavaScript precisam de um servidor.

Na prévia local, os dados ficam neste navegador. No site publicado, o acesso fica bloqueado até configurar o Firebase. O acesso online usa Google, com e-mails autorizados em allowedEmails no Firestore. Nenhum dado de exemplo é colocado automaticamente. Não limpe os dados do navegador sem baixar um backup.

## Publicar

Siga [GUIA-PUBLICACAO.md](GUIA-PUBLICACAO.md). A configuração da Vercel já está incluída. O comando de publicação copia apenas os arquivos do app para `public/`.

## Regras do app

- Quantidade significa número inteiro de embalagens; peso/volume pertence ao cadastro. Produtos vendidos a granel com pesos diferentes devem ter cadastros distintos nesta versão.
- Identidade de produto é fixa para preservar as comparações. Uma marca, tipo ou embalagem diferente precisa de novo cadastro.
- Os preços são herdados da última lista concluída anterior ao mês da nova lista, apenas de itens realmente comprados. Listas do mesmo mês são somadas nos gráficos.
- Confirmar um preço não marca o item como comprado. Use a caixa de seleção.
- A conclusão preserva o histórico e bloqueia alterações. Confira os valores antes de confirmar.
- Variação na lista usa o preço histórico guardado ao incluir o item. Nos gráficos, o preço médio mensal é ponderado pela quantidade. Alterações de quantidades também afetam o gasto total.
- A foto não é armazenada. OCR roda no navegador; bibliotecas/modelos precisam de internet. Etiquetas com vários valores exigem seleção e confirmação humana.
- Firebase usa autenticação Google e regras por e-mail verificado autorizado no Firestore, assinatura em tempo real e transações com controle de versão. Se dois aparelhos alterarem a mesma versão, uma alteração será rejeitada e poderá ser repetida; não sobrescreve silenciosamente.
- No modo Firebase, salvar requer conexão. Não existe fila de gravação offline nesta versão.
- O histórico doméstico usa um documento Firestore; existe limite de 1 MiB por documento. Para históricos muito extensos, será necessário dividir os dados por lista. Fotos não entram nesse documento.

## Verificação

`node --test` verifica o fluxo de autenticação com serviços simulados (conta negada, cache, cancelamento, revogação e casa compartilhada), identidade de produtos, herança de preço, totais, filtros do histórico, virada de ano e extração de candidatos de OCR. `node build.mjs` prepara a publicação.

O Firebase real depende de configuração da conta. Teste o acesso em dois aparelhos depois de publicar. Confirme também uma foto real no celular que será usado no mercado.

## Acesso da família

Publique firestore.rules e crie um documento allowedEmails/EMAIL para cada conta autorizada, com enabled (boolean) = true. Todos usam households/casa. A lista Authentication → Users não concede permissão aos dados. O app não pode administrar a lista de e-mails. Consulte o guia para ativação e migração do PIN.
