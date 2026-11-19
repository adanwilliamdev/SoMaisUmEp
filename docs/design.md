# Design (v6.1 · "Cinema escuro")

O visual vive em **uma folha só**: `public/style.css`. Cada regra aparece uma vez, na ordem: tokens, base, estrutura, componentes, telas, telas pequenas, movimento.

## Ideia

**Profundidade por contraste de superfície, não por contorno** (a linha de Apple TV+, Letterboxd e Linear). O fundo é liso (`#0b0c0e`, preto azulado), sem textura nenhuma, para que a arte dos pôsteres seja a protagonista. Cartões e barras ficam um tom acima (`#14161a`); as divisórias são quase invisíveis (`1px solid rgba(255,255,255,.08)`, token `--line`). Barras flutuantes (cabeçalho, dock do celular, setas dos carrosséis) usam **vidro fosco**: `--vidro` (`rgba(20,22,26,.7)`) com `backdrop-filter: blur(12px)`.

O **coral** (`--acc`: `#ff7a59` no escuro, `#c2410c` no claro) é o único acento e fica restrito a pouca área: o botão "Nova série", o fio de progresso, a marca da aba ativa, a data dos próximos episódios (em fundo suave, `--acc-suave`), o +1 ao passar o mouse e os números 1 a 3 dos tops. Duas cores têm função fixa: **verde** (`--ok`) para concluído e **ouro** (`--ouro`) para a nota que você deu.

Tudo em **Inter** (hospedada em `public/fonts/`). Títulos em 600/700 na cor `--tx` (`#f8fafc`); metadados (temporada, episódio, datas) em `--mut` (`#94a3b8`, cinza ardósia), peso 400/500, para reduzir ruído.

O tema escuro é o da especificação. O tema claro segue a mesma lógica (superfícies brancas sobre `#f6f7f9`, texto `#0f172a`, coral `#c2410c`) e entra quando o sistema ou o botão de tema pedem.

## Tokens (começo do `style.css`)

| Token | Para que serve |
|---|---|
| `--bg`, `--card`, `--card2` | fundo, superfície e superfície em destaque (hover, painéis internos) |
| `--tx`, `--mut` | texto principal e metadados |
| `--ctl` | borda de campos de formulário e botões secundários (contraste ≥ 3:1) |
| `--acc`, `--on`, `--acc-suave` | coral, o texto sobre ele e o coral a 15% (etiqueta de data) |
| `--ok`, `--perigo`, `--ouro` | concluído, ações sem volta e nota pessoal |
| `--line`, `--line2` | divisórias e bordas decorativas (8% e 14% de branco) |
| `--vidro` | fundo semitransparente das barras de vidro fosco |
| `--duro`, `--sombra` | sombras suaves (média e grande), só em elementos que flutuam |
| `--r-s`, `--r-m`, `--r-g` | cantos: selos (6px), controles (10px), superfícies e capas (16px) |
| `--max`, `--gut` | largura máxima do conteúdo (1280px) e margem lateral (24px no celular, 48px a partir de 900px) |
| `--h-ctl` | altura única dos controles da barra de filtros (40px; 44px em telas de toque) |
| `--corpo`, `--topo` | família de letra e altura da barra superior |

Para trocar uma cor, mude só os blocos de tokens (claro e escuro) e rode `npm test`: `test/acessibilidade.test.js` confere o contraste nos dois temas (texto ≥ 4,5:1, `--ctl` ≥ 3:1). O teste só lê cores em `#hex`; por isso `--line`, `--vidro` e `--acc-suave` são `rgba(...)`.

## Onde fica cada coisa

- **Contêiner**: o conteúdo fica centralizado em `max-width: 1280px`, com `--gut` de margem. A barra superior usa a mesma largura e a mesma margem, então logo e conteúdo alinham.
- **Cabeçalho** (`.rail`): fixo no topo, com vidro fosco. Marca à esquerda; no centro, **só texto** (Séries, Filmes, Descobrir, Tops, Estatísticas) sem caixa em volta; a aba ativa fica em branco com um sublinhado coral curto. Status, tema e conta à direita (a conta é um botão redondo neutro).
- **Celular**: topo com marca, status, tema e conta; as abas viram um **dock flutuante** de vidro embaixo (`.menu`), com ícones; a ativa fica em branco com uma barrinha coral.
- **Status de sincronização** (`#status`): só um ícone de nuvem (verde = salvo, pulsando = salvando, aviso = sem conexão ou erro). O texto fica no tooltip e para o leitor de tela.
- **Minha conta**: importar lista, backup e exportação, avisos, trocar senha/e-mail, sair e excluir conta.
- **Estante**: título → números em linha → *Continuar assistindo* → *Próximos episódios* → filtros → grupos por estado.
  - **Números**: `300 séries • 2757 episódios vistos • 215 concluídas`, sem pílulas. O número vai em branco e a descrição em cinza; o ponto médio vem de CSS (`.stat + .stat::before`).
  - **Grade**: `repeat(auto-fill, minmax(180px, 1fr))` com `gap: 24px` (a partir de 640px; abaixo disso a coluna mínima é 140px para manter duas colunas no celular). Nenhum cartão é cortado na lateral.
  - **Cartão**: capa 2:3 com cantos de 16px; o **fio de progresso de 3px** fica colado na base da imagem; o **+1** é um botão redondo de vidro no canto inferior direito que vira coral ao passar o mouse (no computador, dentro da grade, ele só aparece ao passar o mouse sobre a capa).
  - **Carrosséis** (*Continuar assistindo* e *Próximos episódios*, classe `.carrossel`): todos os itens de uma faixa têm a mesma largura e proporção, sem card gigante. Setas flutuantes discretas nas pontas (só com mouse, ao passar por cima) e um véu de esmaecimento na borda indicam que há mais itens. O JS (`marcaCarrosseis`, em `telas/ctx.js`) marca `.m-esq` / `.m-dir` conforme a rolagem; a seta de um lado some quando não há para onde rolar. No celular a faixa vai até a borda da tela e rola com o dedo.
  - *Continuar assistindo*: os títulos usam a capa vertical 2:3 (os dados só têm pôster, sem imagem de cena), com `T5 · E10` e `55/62` embaixo do título.
  - *Próximos episódios*: cartões compactos de superfície com borda sutil; a etiqueta de data (`19 NOV`) tem fundo coral suave e texto coral; a de hoje fica em coral cheio.
  - **Barra de filtros**: filtros, busca e ordenação têm a mesma altura (`--h-ctl`), fundo de superfície e borda quase invisível. O filtro ativo fica em fundo claro com texto escuro. No celular só os filtros ficam colados abaixo do topo ao rolar; no computador a barra inteira cola abaixo do cabeçalho.
  - O selo de estado (vidro escuro com letra clara, nos dois temas) só aparece na lista plana (busca ou filtro), porque dentro de um grupo o título da seção já diz o estado.
- **Painel de um título**: gaveta lateral no computador, folha no celular. Episódios são botões quadrados: vistos em branco cheio, o próximo com contorno coral.
- **Tops (Hall da Fama)**: cada ranking é um cartão de superfície; números em Inter, os três primeiros em coral.
- **Descobrir**: sob cada título há uma frase curta ("Baseado no seu gosto por Drama") e um "i". O motivo completo aparece num balão ao passar o mouse ou tocar (`Esc` ou clicar fora fecha).
- **Estatísticas**: *Curiosidades* são cartões de superfície; o tempo total ganha o número grande em coral (texto, não bloco). *Em números* são cartões menores, seguidos do gráfico.
- **Imagem de compartilhar um Top** (`public/js/compartilhar.js`, canvas 1080×1350) usa a mesma paleta: fundo liso, etiqueta "TOP 10" em coral e cada posição num cartão de superfície. As cores ficam em `COR`, no topo do arquivo.

## Gestos e botões de +1 / −1

No celular, deslizar a capa na grade:

- **para a direita** (a partir de 72 px): +1 episódio, ou marca o filme como visto (com "Desfazer");
- **para a esquerda**: abre o painel do título, onde ficam as opções e o −1.

O gesto só vale para toque e só na grade (os carrosséis rolam na horizontal). Ele aciona os mesmos botões de sempre (`.mais` e `abrir`), então histórico, vibração e "Desfazer" seguem iguais. Quem usa mouse ou teclado usa os botões; o −1 direto na capa só existe onde há mouse. Código em `public/js/telas/estante.js`.

## Movimento

Um único movimento de entrada ao trocar de aba. O resto responde a um toque: botões e capas reduzem de leve ao serem apertados, e as capas sobem 3px ao passar o mouse. `prefers-reduced-motion` desliga tudo (inclusive a rolagem suave das setas).

## Acessibilidade das bordas sutis

As bordas quase invisíveis (`--line`) valem para o que se identifica pelo texto ou pelo ícone: filtros, busca e ordenação da estante. Campos de formulário (login, edição, painéis) e botões secundários mantêm a borda `--ctl` (≥ 3:1). O foco visível segue em coral nos dois temas.

## O que não mudou

Só o visual (e a marcação dos carrosséis) foi refeito. Os `data-act` que o JavaScript usa, a API, o banco e o service worker continuam como eram; a única ação nova é `rolar`, das setas dos carrosséis.

## Ajustes de encaixe (cartões)

- **Linha de apoio do cartão** (`.meta`): o rótulo (`Próximo: T5 · E10`) fica à esquerda e corta com reticências; o andamento (`55/62`) fica fixo à direita (`.meta-n`, com "episódios vistos" só para leitor de tela).
- **Aviso de lançamento** (`.lanc`): ponto alinhado à primeira linha e quebra equilibrada (`text-wrap:balance`).
- **Texto só para leitor de tela** (`.sr`): `<table class="sr">` vira bloco, senão alargava a página no celular sem perder a semântica de tabela.
- **Top 10**: no celular pequeno os cartões de estatística têm menos respiro lateral.
