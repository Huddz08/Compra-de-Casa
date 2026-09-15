# Compra de Casa

Aplicativo doméstico em HTML, CSS e JavaScript. Listas mensais, cadastro por marca/tipo/embalagem, leitura de etiquetas com Tesseract.js, comparação de preços e gráficos mensais.

## Experimentar

Com Node.js instalado, abra o terminal nesta pasta e execute `node server.mjs --demo`. Acesse http://localhost:4174 e clique em **Experimentar neste aparelho**. Essa prévia usa dados separados e não conecta ao Firebase. Para usar sua configuração real localmente, execute `node server.mjs` e abra http://localhost:4173. Não abra o HTML por duplo clique: módulos JavaScript precisam de um servidor.

Na prévia local, os dados ficam neste navegador. No site publicado, o acesso fica bloqueado até configurar o Firebase. O acesso online usa Google, com e-mails autorizados em allowedEmails no Firestore. Nenhum dado de exemplo é colocado automaticamente. Não limpe os dados do navegador sem baixar um backup.

## Publicar

Siga [GUIA-PUBLICACAO.md](GUIA-PUBLICACAO.md). A configuração da Vercel já está incluída. O comando de publicação copia apenas os arquivos do app para `public/`.

## Fluxo no mercado

1. Escolha a lista na tela Listas de compras.
2. Em Editar dados, informe nome, mercado, data e observações, depois salve.
3. Toque no produto, fotografe a etiqueta, confira o preço automático e marque o carrinho.
4. Toque em Salvar lista durante a compra para registrar seu progresso entre aparelhos.
5. Em Finalizar compra, informe o total real do caixa. A diferença vira desconto ou acréscimo geral.
6. Se faltaram itens, abra a nova lista de pendências para continuar em outro mercado.
7. Em Nossos produtos, toque em um produto para abrir seu gráfico de linha; cada ponto informa preço, data, lista e mercado.

## Regras do app

- Quantidade significa número inteiro de embalagens; peso/volume pertence ao cadastro. Produtos vendidos a granel com pesos diferentes devem ter cadastros distintos nesta versão.
- Identidade de produto é fixa para preservar as comparações. Uma marca, tipo ou embalagem diferente precisa de novo cadastro.
- Os preços são herdados de compras concluídas anteriores à data da lista (ou dentro do mês de referência, quando não há data), apenas de itens comprados. Compras do mesmo mês são somadas pela data da compra; registros antigos sem data usam o mês de referência.
- Ao aplicar o preço, você pode marcar Já coloquei no carrinho. Também é possível marcar diretamente na tabela. Toque em Salvar lista para persistir as alterações.
- Finalizar salva a lista, registra o valor real do caixa e preserva os itens comprados. Itens não marcados geram uma nova lista de pendências vinculada à original. Dados como nome, mercado, data e total pago podem ser corrigidos depois em Editar dados e Salvar lista; itens concluídos ficam preservados.
- Total pago é o valor real do caixa, incluindo ajustes. O histórico de produtos mantém o preço unitário informado; descontos/acréscimos gerais não são rateados pelos itens.
- Variação na lista usa o preço histórico guardado ao incluir o item. Nos gráficos, o preço médio mensal é ponderado pela quantidade. Alterações de quantidades também afetam o gasto total.
- A foto não vai ao Firebase e não integra o backup. A imagem temporária é descartada ao aplicar o preço ou fechar o formulário. OCR roda no navegador; bibliotecas/modelos precisam de internet. O preço sugerido preenche o campo automaticamente. Em etiquetas com vários valores, confira a sugestão ou toque em uma alternativa antes de salvar.
- Firebase usa autenticação Google e regras por e-mail verificado autorizado no Firestore, assinatura em tempo real e transações com controle de versão. Se dois aparelhos alterarem a mesma versão, uma alteração será rejeitada e poderá ser repetida; não sobrescreve silenciosamente.
- No modo Firebase, salvar requer conexão. Não existe fila de gravação offline nesta versão.
- O histórico doméstico usa um documento Firestore; existe limite de 1 MiB por documento. Para históricos muito extensos, será necessário dividir os dados por lista. Fotos não entram nesse documento.

## Verificação

`node --test` verifica o fluxo de autenticação com serviços simulados (conta negada, cache, cancelamento, revogação e casa compartilhada), identidade de produtos, herança de preço, totais, filtros do histórico, virada de ano, extração de candidatos de OCR, finalização com desconto/acréscimo, criação de pendências, compatibilidade com registros antigos e conflitos na edição. `node build.mjs` prepara a publicação.

O Firebase real depende de configuração da conta. Teste o acesso em dois aparelhos depois de publicar. Confirme também uma foto real no celular que será usado no mercado.

## Acesso da família

Publique firestore.rules e crie um documento allowedEmails/EMAIL para cada conta autorizada, com enabled (boolean) = true. Todos usam households/casa. A lista Authentication → Users não concede permissão aos dados. O app não pode administrar a lista de e-mails. Consulte o guia para ativação e migração do PIN.
