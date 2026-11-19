# Design (v5.5 · "Sofá")

O visual vive em **uma folha só**: `public/style.css`. Antes eram dez camadas (v5 a v10) que se sobrescreviam; agora cada regra aparece uma vez.

## Ideia

A interface é quieta e as capas são a cor. Existe **uma** cor de destaque (`--acc`), usada só no que se toca: o botão **+1**, o progresso, o item ativo do menu e os filtros marcados. Nada de degradê, vidro fosco ou brilho.

## Tokens (começo do `style.css`)

| Token | Para que serve |
|---|---|
| `--bg`, `--card`, `--card2` | fundo, superfície e superfície em destaque |
| `--tx`, `--mut` | texto e texto de apoio |
| `--ctl` | borda de controles (contraste ≥ 3:1) |
| `--acc`, `--on` | destaque e o texto sobre ele |
| `--ok`, `--perigo` | concluído e ações sem volta |
| `--r-s`, `--r-m`, `--r-g` | cantos: detalhes, controles/capas, superfícies |

Para trocar a cor, mude só os dois blocos de tokens (claro e escuro) e rode `npm test`: `test/acessibilidade.test.js` confere o contraste.

## Onde fica cada coisa

- **Topo** (`.rail`): marca, status de sincronização, tema e conta. No computador as abas ficam no centro; no celular, numa barra embaixo.
- **Minha conta** (botão redondo no topo): importar lista, backup e exportação, avisos, trocar senha/e-mail, sair e excluir conta. Antes, Importar/Backup/Sair ficavam soltos no rodapé.
- **Rodapé**: só o crédito do TMDB.
- **Estante**: título e números → *Continuar assistindo* → *Próximos episódios* → filtros → grupos por estado. O selo de estado só aparece na lista plana (busca ou filtro), porque dentro de um grupo o título da seção já diz o estado.

## Movimento

Um único movimento de entrada ao trocar de aba. O resto responde a um toque (apertar, abrir o painel). `prefers-reduced-motion` desliga tudo.
