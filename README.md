# Foto em Partes

Ferramenta para dividir uma foto em várias imagens e imprimi-las para montar uma imagem maior.

## Como usar

1. Abra o arquivo `index.html` no seu navegador.
2. Envie uma imagem.
3. Escolha o número de linhas e colunas (por exemplo, 2 × 2 cria 4 partes).
4. Para o PDF, escolha a orientação das folhas A4: automática, retrato ou paisagem. A prévia mostra exatamente a distribuição das folhas.
5. Clique em **Baixar ZIP** para receber as imagens em PNG, em **Baixar PDF** para gerar um único documento, ou em **Imprimir** para abrir a caixa de impressão do navegador com uma parte por folha A4.
6. Imprima todas as páginas mantendo a mesma escala e monte-as em ordem: a primeira linha vem antes da segunda, da esquerda para a direita.

O aplicativo processa as imagens no próprio navegador: nenhuma imagem é enviada para um servidor.

## Segurança do upload

- Aceita apenas JPG, PNG, WEBP e GIF.
- Confere a assinatura interna do arquivo, não apenas a extensão ou o tipo informado pelo navegador.
- Recusa arquivos maiores que 25 MB e imagens com mais de 40 megapixels, evitando uso excessivo de memória.
