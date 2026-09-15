# Atualizar o Compra de Casa publicado

1. Extraia o arquivo **atualizacao-fluxo-compras.zip**.
2. No GitHub, abra seu repositório e escolha **Add file → Upload files**.
3. Envie os arquivos extraídos diretamente para a raiz do repositório, substituindo os existentes. Inclua **shopping-flow.css**, o novo arquivo de layout.
4. Confirme em **Commit changes** e aguarde a Vercel concluir a publicação.
5. Recarregue o app no celular. A nova página inicial de compras mostrará as listas para escolher.

O pacote preserva seu **config.js** e suas regras atuais: não é necessário recriar o Firebase, alterar os e-mails autorizados ou apagar dados.

## Como usar a nova versão

- Abra uma lista e use **Editar dados** para mudar nome, mercado, data e observações. Toque em **Salvar lista**.
- Toque no produto, fotografe a etiqueta e confira o preço preenchido. Marque **Já coloquei no carrinho** se desejar e toque em **Aplicar preço à lista**. A foto é descartada do app.
- Use **Salvar lista** para guardar o progresso. O app avisa se você tentar sair com alterações não salvas.
- Em **Finalizar compra**, confira os itens do carrinho e informe o valor real do caixa. O app registra a diferença como desconto ou acréscimo e salva a compra.
- Os itens que ficaram sem marcar serão copiados automaticamente para uma lista de **Pendências**, vinculada à compra original. Informe o próximo mercado ao continuar as compras.
- Em **Nossos produtos**, toque no produto e depois em um ponto do gráfico para ver preço, data, lista e mercado.

Os gráficos de gastos usam o total efetivamente pago no caixa. O histórico de cada produto usa seu preço por embalagem, sem distribuir descontos gerais entre produtos.

Compras antigas permanecem disponíveis. Quando não houver mercado ou data exata registrados, o app sinaliza a ausência; você pode preencher esses dados na lista e salvar.
