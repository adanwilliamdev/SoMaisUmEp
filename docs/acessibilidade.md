# Acessibilidade

Meta: WCAG 2.2 nível AA. O que está coberto e como conferir.

## Cores e contraste

- Todas as cores são tokens em `:root` no topo de `public/style.css`, nos dois temas (claro e escuro).
- Texto: pelo menos **4,5:1** com o fundo em que aparece. Bordas de campos, botões secundários e chips (`--ctl`): pelo menos **3:1**. `--line` e `--line2` são só divisórias decorativas.
- `test/acessibilidade.test.js` lê os tokens do CSS e falha se alguma combinação cair abaixo disso. Ao mudar uma cor, rode `npm test`.

## Teclado e foco

- Foco visível em tudo (`:focus-visible`, 3 px). Nos campos de texto o foco troca a borda para a cor de destaque e mantém um contorno transparente, que o modo de alto contraste do Windows mostra.
- "Pular para o conteúdo" é o primeiro item da tabulação.
- Ao trocar de aba o foco vai para o título (`h1`) e o `document.title` muda, para o leitor de tela anunciar a página nova.
- Os botões "Importar arquivo…" e "Escolher arquivos…" usam um campo de arquivo escondido só para a vista (`.sr-input`), que continua focável: antes, com `hidden`, não dava para acioná-los pelo teclado.

## Leitores de tela

- Todo botão só com ícone tem `aria-label`; os botões de episódio dizem a temporada ("Temporada 2, episódio 3") e os de temporada, qual temporada ("Zerar temporada 2").
- O diálogo recebe o nome do seu primeiro `h2` (`aria-labelledby`, em `telas/ctx.js`).
- O gráfico por mês é decorativo para o leitor de tela; os mesmos números estão numa tabela escondida (`.sr`).
- Mensagens que não aparecem como texto (ex.: "X movido para a posição 3 de 10") vão para uma região `aria-live` (`anunciar()` em `util.js`).

## Reordenar os tops sem arrastar

Arrastar não é a única forma (WCAG 2.5.7): cada item tem os botões **subir** e **descer**, e a alça ⋮⋮ também aceita as setas, Home e End. Depois de mover, o foco volta para o mesmo item e a nova posição é anunciada.

## Para conferir à mão

Tab por todas as telas; zoom de 200%; leitor de tela (NVDA ou VoiceOver) nas abas, nos tops e no painel de detalhes; modo de alto contraste do Windows; `prefers-reduced-motion` já desliga as animações.
