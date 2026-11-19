# Design (v5.6 · "Sofá")

O visual vive em **uma folha só**: `public/style.css`. Antes eram dez camadas (v5 a v10) que se sobrescreviam; agora cada regra aparece uma vez.

## Ideia

A interface é quieta e as capas são a cor. Existe **uma** cor de destaque (`--acc`, um violeta), usada só no que se toca: o botão **+1**, o progresso, o item ativo do menu e os filtros marcados. Nada de degradê, vidro fosco ou brilho.

Outras duas cores têm função fixa, para o violeta não carregar tudo sozinho: **verde menta** (`--ok`) para o que está concluído (selo e barra de progresso cheia) e **ouro** (`--ouro`) para a nota que você deu.

## Tokens (começo do `style.css`)

| Token | Para que serve |
|---|---|
| `--bg`, `--card`, `--card2` | fundo (`#121214` no escuro), superfície e superfície em destaque |
| `--tx`, `--mut` | texto e texto de apoio (cinza-claro `#9ca3af`, com entrelinha de 1,6 a 1,7) |
| `--ctl` | borda de controles (contraste ≥ 3:1) |
| `--acc`, `--on` | destaque e o texto sobre ele |
| `--ok`, `--perigo`, `--ouro` | concluído, ações sem volta e nota pessoal |
| `--bloco`, `--bloco-b` | fundo translúcido e borda fina dos blocos de estatísticas |
| `--r-s`, `--r-m`, `--r-g` | cantos: detalhes, controles/capas, superfícies |
| `--lateral` | largura da barra lateral no computador |

Para trocar a cor, mude só os dois blocos de tokens (claro e escuro) e rode `npm test`: `test/acessibilidade.test.js` confere o contraste.

> O violeta é `#9566fa`, um pouco mais claro que o `#8b5cf6` do Tailwind: com ele o texto sobre o destaque e o destaque sobre o card ficam em ≥ 4,5:1 (AA). Pelo mesmo motivo o texto sobre o violeta é escuro (`--on`), não branco.

## Onde fica cada coisa

- **Computador (≥ 900 px)**: barra lateral à esquerda (`.rail`): marca, abas (Séries, Filmes, Descobrir, Tops, Estatísticas) e, embaixo, status, tema e conta. A estante usa até 4–5 colunas.
- **Celular**: topo com marca, status, tema e conta; abas numa barra fixa embaixo, boa para o polegar.
- **Status de sincronização** (`#status`): só um ícone de nuvem (verde = salvo, pulsando = salvando, aviso = sem conexão ou erro). O texto fica no tooltip e para o leitor de tela.
- **Minha conta** (botão redondo): importar lista, backup e exportação, avisos, trocar senha/e-mail, sair e excluir conta.
- **Rodapé**: só o crédito do TMDB.
- **Estante**: título e números → *Continuar assistindo* → *Próximos episódios* → filtros → grupos por estado.
  - *Continuar assistindo* é um **carrossel horizontal** com rolagem encaixada: o primeiro título (o último que você viu) é o destaque, em tamanho grande e com o botão "Só mais um ep"; os demais são capas menores ao lado.
  - **Filtros** (Todas, Assistindo, Na fila...) são abas compactas que deslizam. No celular só elas ficam coladas abaixo do topo ao rolar; busca e ordem rolam com a página. No computador a barra inteira (abas, busca, ordem) fica colada.
  - O selo de estado só aparece na lista plana (busca ou filtro), porque dentro de um grupo o título da seção já diz o estado.
- **Descobrir**: sob cada título há uma frase curta ("Baseado no seu gosto por Drama") e um "i". O motivo completo aparece num balão ao passar o mouse ou tocar (`Esc` ou clicar fora fecha). A lista de títulos-base do DNA fica recolhida.
- **Estatísticas**: *Curiosidades* (histórias em cartões grandes) separadas de *Em números* (números brutos) e do gráfico, todos em blocos com fundo `rgba(255,255,255,.03)` e borda `rgba(255,255,255,.1)`.

## Gestos e botões de +1 / −1

O **+1** é um botão pequeno e escuro no canto da capa; só ganha o violeta ao passar o mouse ou receber foco. No computador ele (e o −1) só aparece ao passar o mouse sobre a capa. No celular, deslizar a capa na grade:

- **para a direita** (a partir de 72 px): +1 episódio, ou marca o filme como visto (com "Desfazer");
- **para a esquerda**: abre o painel do título, onde ficam as opções e o −1.

O gesto só vale para toque e só na grade (o carrossel rola na horizontal). Ele aciona os mesmos botões de sempre (`.mais` e `abrir`), então histórico, vibração e "Desfazer" seguem iguais. Quem usa mouse ou teclado usa os botões; o −1 direto na capa só existe onde há mouse. Código em `public/js/telas/estante.js`.

## Movimento

Um único movimento de entrada ao trocar de aba. O resto responde a um toque (apertar, abrir o painel, acompanhar o dedo ao deslizar). `prefers-reduced-motion` desliga tudo.
