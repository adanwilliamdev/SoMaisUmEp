# Design (v6.0 · "Bilheteria")

O visual vive em **uma folha só**: `public/style.css`. Cada regra aparece uma vez, na ordem: tokens, base, estrutura, componentes, telas, telas pequenas, movimento.

## Ideia

Tudo é **papel e tinta**, como um ingresso de cinema. De dia, fundo creme (`#f2ecdf`) e texto em tinta quase preta; à noite, carvão quente (`#13100c`) e texto creme. Cartões, capas, botões e campos têm **borda de 2px** e **sombra dura** (sem desfoque) deslocada para baixo e para a direita. De dia a sombra é de tinta; à noite, de coral (`--sd`).

Existe **uma** cor de ação, o **vermelhão** (`--acc`: `#c7321a` de dia, coral `#ff7a55` à noite), usada só no que se toca: o botão **+1**, o progresso, a aba ativa do celular, o botão principal e os números 1 a 3 dos tops. Duas cores têm função fixa: **verde** (`--ok`) para o que está concluído e **ouro** (`--ouro`) para a nota que você deu.

A tipografia tem duas vozes: **serifa editorial** (`--serifa`, a pilha do sistema Iowan Old Style / Palatino / Georgia) nos títulos e nas histórias, e **Inter** (hospedada em `public/fonts/`) no resto, com números sempre em Inter pesada. O fundo tem uma grade de pontos feita só de CSS (`radial-gradient`), então não pede imagem nem relaxa a CSP.

## Tokens (começo do `style.css`)

| Token | Para que serve |
|---|---|
| `--bg`, `--card`, `--card2` | papel (fundo), superfície e superfície em destaque |
| `--tx`, `--mut` | tinta e texto de apoio |
| `--ctl` | borda de controles (contraste ≥ 3:1) |
| `--acc`, `--on` | vermelhão e o texto sobre ele (branco de dia, escuro à noite) |
| `--ok`, `--perigo`, `--ouro` | concluído, ações sem volta e nota pessoal |
| `--sd`, `--duro`, `--duro-p`, `--sombra` | cor da sombra e as três sombras duras (média, pequena, grande) |
| `--bloco`, `--bloco-b` | fundo e borda dos cartões de estatística |
| `--r-s`, `--r-m`, `--r-g` | cantos: selos, controles/capas, superfícies |
| `--serifa`, `--corpo` | as duas famílias de letra |
| `--topo` | altura da barra superior |

Para trocar a cor, mude só os dois blocos de tokens (claro e escuro) e rode `npm test`: `test/acessibilidade.test.js` confere o contraste (texto ≥ 4,5:1, bordas de controles ≥ 3:1). O texto sobre o vermelhão é branco de dia e escuro à noite, pelo mesmo motivo.

## Onde fica cada coisa

- **Computador (≥ 900 px)**: **barra superior** (`.rail`) em três colunas: marca à esquerda, abas (Séries, Filmes, Descobrir, Tops, Estatísticas) numa pílula ao centro, e status, tema e conta à direita. A aba atual fica em tinta cheia. A estante usa 4–5 colunas.
- **Celular**: topo com marca, status, tema e conta; as abas viram um **dock flutuante** embaixo (`.menu`), com borda e sombra dura, e a aba ativa em vermelhão.
- **Status de sincronização** (`#status`): só um ícone de nuvem (verde = salvo, pulsando = salvando, aviso = sem conexão ou erro). O texto fica no tooltip e para o leitor de tela.
- **Minha conta** (botão redondo): importar lista, backup e exportação, avisos, trocar senha/e-mail, sair e excluir conta.
- **Rodapé**: só o crédito do TMDB.
- **Estante**: título e números (chips) → *Continuar assistindo* → *Próximos episódios* → filtros → grupos por estado.
  - *Continuar assistindo* é um **carrossel de ingressos**: o primeiro título (o último que você viu) é o destaque, com borda de tinta, costura pontilhada por dentro, a capa levemente inclinada, o episódio em uma etiqueta (`T4 E5`) e o botão grande "Só mais um ep"; os demais são capas menores ao lado.
  - *Próximos episódios*: cada lançamento tem uma "folha de calendário" (dia grande, mês em maiúsculas); a de hoje fica em vermelhão.
  - **Filtros** (Todas, Assistindo, Na fila...) são pílulas; a marcada fica em tinta cheia. No celular só elas ficam coladas abaixo do topo ao rolar; busca e ordem rolam com a página. No computador a barra inteira (abas, busca, ordem) fica colada abaixo da barra superior.
  - O selo de estado (sempre tinta escura com letra clara, nos dois temas) só aparece na lista plana (busca ou filtro), porque dentro de um grupo o título da seção já diz o estado.
- **Painel de um título**: gaveta lateral no computador, folha no celular. Episódios são "carimbos": vistos em tinta cheia, o próximo com contorno vermelho.
- **Tops (Hall da Fama)**: cada ranking é um cartão com sombra grande; números grandes em Inter pesada, os três primeiros em vermelhão; a nota de rodapé de cada item aparece em itálico serifado, entre aspas.
- **Descobrir**: sob cada título há uma frase curta ("Baseado no seu gosto por Drama") e um "i". O motivo completo aparece num balão ao passar o mouse ou tocar (`Esc` ou clicar fora fecha). A lista de títulos-base do DNA fica recolhida.
- **Estatísticas**: *Curiosidades* são **cartões de cor sólida**: tempo total em vermelhão, mês mais ativo em tinta, jeito de avaliar em papel, título campeão em papel escuro. *Em números* são cartões menores, seguidos do gráfico.
- **Entrar / criar conta**: um ingresso na tela (borda, sombra e costura pontilhada).
- **Imagem de compartilhar um Top** (`public/js/compartilhar.js`, canvas 1080×1350) usa a mesma identidade: papel com grade de pontos, moldura de tinta, etiqueta "TOP 10" em vermelhão e cada posição num cartão com sombra dura. As cores ficam em `COR`, no topo do arquivo.
- **Ícone**: um ingresso inclinado com "+1" e um play sobre fundo vermelhão (`public/icons/icon.svg`; os PNGs seguem a mesma geometria).

## Gestos e botões de +1 / −1

O **+1** é um botão vermelhão com borda de tinta no canto da capa. No computador ele (e o −1) só aparece ao passar o mouse sobre a capa ou receber foco. No celular, deslizar a capa na grade:

- **para a direita** (a partir de 72 px): +1 episódio, ou marca o filme como visto (com "Desfazer");
- **para a esquerda**: abre o painel do título, onde ficam as opções e o −1.

O gesto só vale para toque e só na grade (o carrossel rola na horizontal). Ele aciona os mesmos botões de sempre (`.mais` e `abrir`), então histórico, vibração e "Desfazer" seguem iguais. Quem usa mouse ou teclado usa os botões; o −1 direto na capa só existe onde há mouse. Código em `public/js/telas/estante.js`.

## Movimento

Um único movimento de entrada ao trocar de aba. O resto responde a um toque: botões e cartões "afundam" ao serem apertados (a sombra dura some e o elemento desce 2px) e sobem 2–3px ao passar o mouse. `prefers-reduced-motion` desliga tudo.

## O que não mudou

Só o visual foi refeito. As classes e os `data-act` que o JavaScript usa, a API, o banco e o service worker continuam como eram, então o redesenho não toca em regra de negócio nem em sincronização.
