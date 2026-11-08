# SóMaisUmEp

Seu diário de séries e filmes: progresso por episódio e temporada, filmes assistidos, tops 10 e estatísticas.
Front-end estático (PWA instalável) + funções serverless da Vercel + Postgres no Neon. Cada pessoa cria a própria conta e tem a própria biblioteca.

```
public/        site (index.html, style.css, manifest.json, sw.js, icons/ e js/)
  js/            main.js (liga tudo), loja.js (dados + sincronização), regras.js, views.js e os módulos abaixo
  js/views/      HTML de cada tela (estante, detalhe, tops, stats, conta, descobrir, compartilhar, importar)
  js/telas/      eventos de cada tela, um módulo por tela; cada um exporta `acoes` (data-act -> função)
api/           funções serverless (login, cadastro, logout, dados, sync, capa, conta, cron, tmdb, t...); só 12 arquivos públicos
               por causa do limite do plano Hobby. Os que servem mais de um método passam por _roteador.js (veja "API")
neon/          migracoes/ (SQL numerado) e schema.sql (todas juntas, gerado)
scripts/       migrar.js (aplica as migrações no banco), build.js (gera dist/ para o deploy) e vapid.js (chaves dos avisos por push)
docs/          notificacoes.md (avisos por push) e acessibilidade.md (o que está coberto e como conferir)
test/          testes (node --test)
.github/       workflows/ci.yml (lint, formatação, testes e build em Node 20 e 22, mais npm audit) e dependabot.yml (atualizações semanais)
```

## Desenvolvimento

```
npm test              testes (node --test), inclui a sincronização do loja.js com um servidor falso
npm run lint          ESLint (eslint.config.js)
npm run format        Prettier (.prettierrc.json); `npm run format:check` só confere
npm run verificar     lint + formatação + testes, o mesmo que o CI roda
npm run build         gera dist/ (cópia de public/ com a versão do service worker)
npm run vapid         gera o par de chaves dos avisos por push (veja docs/notificacoes.md)
```

- **Telas**: `views/<tela>.js` monta o HTML; `telas/<tela>.js` cuida dos eventos dela. Para criar uma ação nova, exporte-a em `acoes` do módulo da tela e use `data-act="nome"` no HTML. `main.js` junta todas as `acoes` e avisa se um nome se repetir. O estado compartilhado fica em `telas/ctx.js`.
- **Service worker**: o código-fonte tem `VERSAO = 'somaisumep-dev'`. No deploy, `scripts/build.js` (o `buildCommand` do `vercel.json`) grava em `dist/sw.js` o início do `VERCEL_GIT_COMMIT_SHA` e a lista de todos os módulos de `js/` para o cache offline. Não precisa mais trocar número nenhum. `public/` nunca é alterada pelo build.
- **API**: `api/tmdb.js` e `api/t.js` são só roteadores (`api/_roteador.js`, por método HTTP). As consultas do TMDb (`?acao=busca|detalhe|streaming|tendencias|parecidos`) estão em `api/_consultas.js`, a importação em `api/_importar.js`, a página pública do top em `api/_pagina.js` e o liga-desliga do link em `api/_compartilhar.js`. Um teste confere que `api/` não passa de 12 arquivos públicos.
- **ESLint e Prettier** rodam com `npx` (versões fixas nos scripts), então não entram no `package.json` nem no `package-lock.json`. Se preferir tê-los em `devDependencies`, rode `npm i -D eslint@10.1.0 prettier@3.8.1`.

## O que tem (v5.2.1)

- **PWA**: instale pela tela inicial do celular; abre sem barra do navegador, rápido e até sem internet (com a última cópia dos seus dados).
- **Datas de lançamento (v5.1)**: o TMDb informa o próximo episódio (ou a estreia de um filme) e o app mostra "Novo ep sexta" / "Nova temporada em 12 jan" nos cards, no painel e numa fileira "Próximos episódios". Uma vez por dia aparece o aviso "Sai hoje: …", e quando uma série concluída volta com episódios novos o aviso diz quando. Títulos com a data já vencida são reconferidos a cada 6 h (os demais, a cada 24 h). Dentro do app o aviso aparece ao abri-lo; com os avisos por push ativados (veja abaixo) ele também chega como notificação, com o app fechado.
- **Descobrir (v5.1)**: aba com "Em alta esta semana" e "Parecidos com o que você viu" (baseada nos títulos que você já começou e não avaliou mal, melhores notas primeiro), para séries e filmes. Toque no + para adicionar à estante, ou na capa para ver sinopse e onde assistir.
- **Importar (v5.1)**: botão "Importar" no rodapé (e na estante vazia). Letterboxd (o .zip inteiro ou os CSV watched/ratings/diary/reviews/watchlist), IMDb (CSV de avaliações ou watchlist) e Trakt (JSON no formato da API: assistidos, histórico, avaliações, watchlist). Os títulos são localizados no TMDb em lotes de 10 por `POST /api/tmdb`; duplicados são ignorados e dá para desfazer a importação inteira. Limites dos formatos: o Letterboxd só tem filmes; o IMDb não guarda episódios vistos, então séries entram só com a nota; no Trakt o progresso de cada temporada vira "até o maior episódio visto".
- **Tops compartilháveis (v5.1)**: botão "Compartilhar" em cada top. Gera uma imagem 1080×1350 (abre a folha de compartilhamento do celular ou baixa o PNG) e, se você quiser, um **link público** `/t/<código>`, com prévia (Open Graph) em redes e mensageiros. O link mostra o nome do top, os títulos e o seu primeiro nome; "Parar de compartilhar" o desliga na hora (a página pode ficar até 30 s em cache).
- **Desfazer (v5.1)**: o +1 (e marcar filme como visto) nos cards, remover item de um top, excluir um top, adicionar pelo Descobrir e importar mostram um aviso "Desfazer" por alguns segundos (também Ctrl/⌘+Z). Dentro do painel de detalhes o aviso não aparece, pois ficaria atrás dele.
- **Estante**: busca por nome, ordenação (recentes, nome, nota, último visto), filtros e a fileira "Continuar assistindo".
- **TMDb**: busca ao cadastrar, botão "Atualizar do TMDb" e verificação automática (1x por dia por série) de temporadas e episódios novos, sem perder progresso. Em cada título, "Onde assistir" (Brasil).
- **Minha avaliação**: nota e resenha pessoais por título.
- **Estatísticas**: tempo assistido, contagens, nota média e gráfico por mês.
- **Tops 10**: arraste a alça ⋮⋮, use os botões ▲▼ de cada item, ou as setas, Home e End do teclado com a alça selecionada (o foco acompanha o item e a posição nova é anunciada ao leitor de tela).
- **Backup e exportação (v5.2)**: baixar/importar arquivo `.json`; exportar uma **planilha `.csv`** com todos os títulos (abre no Excel e no Google Planilhas; células que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo para não virarem fórmula) e um **`.csv` no formato de importação do Letterboxd** (`tmdbID, Title, Year, WatchedDate, Rating, Review`) com os filmes assistidos, nota em estrelas (0,5 a 5) e resenha. Séries não existem no Letterboxd e ficam de fora desse arquivo. Código em `public/js/exportacao.js`.
- **Layout novo (v5)**: barra lateral no computador e abas embaixo no celular; o título que você viu por último vira o destaque "Só mais um ep" (+1 episódio com um toque); detalhes abrem num painel lateral (folha no celular); o próximo episódio de cada temporada fica marcado.
- **Tema claro/escuro** pelo botão no canto da barra (segue o do aparelho por padrão).
- **Contas**: senha com scrypt, bloqueio temporário após tentativas erradas (por IP e por e-mail, guardado no banco), "Sair de todos os dispositivos", **"Esqueci minha senha"** por e-mail, trocar senha, trocar e-mail e **excluir conta** (apaga tudo, inclusive as capas).
- **Avisos de episódios novos por push (v5.2)**: em Minha conta › Avisos de episódios novos. Uma notificação de manhã nos dias em que sai episódio (ou estreia) de algo da estante, com o app fechado. Opcional: precisa das chaves VAPID (`npm run vapid`) e da migração 005. Detalhes, limites e como configurar em [docs/notificacoes.md](docs/notificacoes.md).
- **Acessibilidade (v5.2)**: contraste AA nos dois temas (conferido por teste), foco visível, "pular para o conteúdo", foco e título da página ao trocar de aba, rótulos em todos os botões só com ícone, diálogos com nome, gráfico com tabela equivalente e reordenação dos tops sem arrastar. Veja [docs/acessibilidade.md](docs/acessibilidade.md).
- **Segurança de dados**: salvamento com nova tentativa automática, aviso de "sem conexão", cópia local, e detecção de edição em dois aparelhos (campo `atualizado`); ao voltar para a aba, os dados são recarregados.

## Identidade visual (v4.4)

Linguagem de cartaz do cinema brasileiro, em duas cores: **grafite** (`--tx`/`--acc`) e **amarelo-sol** (`--sol`, usado só para progresso, episódios vistos e botão +1). Sombras duras de serigrafia nos botões e pôsteres. Tipografia: **Hanken Grotesk** no texto e **Unbounded** nos títulos e na marca (`--corpo` e `--titulo`). Todas as cores e raios são tokens em `:root` no topo de `public/style.css` (claro, escuro automático e `data-theme`). O ícone do app é `public/icons/icon.svg` e os PNGs são gerados a partir dele.

## 1. Neon

1. No Neon Console, crie um projeto.
2. Em **Connect**, copie a connection string *pooled* → `DATABASE_URL`.
3. Crie as tabelas, de um destes jeitos (os dois são seguros de repetir, **inclusive para atualizar um banco antigo**):
   - **Migrações** (recomendado): `DATABASE_URL=... npm run migrar`. Aplica, em ordem, só o que ainda falta (`neon/migracoes/NNN_nome.sql`) e anota na tabela `migracoes`.
   - **SQL Editor** do Neon: rode `neon/schema.sql` (todas as migrações juntas; já marca todas como aplicadas).

Para mudar o banco, crie `neon/migracoes/00N_descricao.sql` (um comando por `;`, sem `;` dentro de texto) e rode `npm run schema` para regenerar o `schema.sql`. Um teste confere se os dois estão em dia.

> **Atualizando da versão de uma senha só?** Defina `ADOTAR_DADOS_ANTIGOS=true` (o cadastro já fica fechado depois da primeira conta, a não ser que você ligue `CADASTRO_ABERTO=true`), rode o novo `schema.sql`, faça o deploy e **crie a sua conta**: só a primeira conta criada herda os dados que já existiam, e só com essa variável ligada. Depois de criar a conta, remova a variável.

> **Atualizando de uma versão anterior?** Rode `npm run migrar` (ou o novo `neon/schema.sql`) **antes** do deploy: a 003 acrescenta `titulos.proximo` e `tops.publico`/`publico_em`, e a 004 troca a chave de títulos e tops para `(user_id, id)`. O código novo depende da 004 (`on conflict (user_id, id)`); sem ela o app para de salvar.

## 2. TMDb

Em themoviedb.org › Configurações › API, copie o **Token de Leitura da API (v4)** → `TMDB_READ_TOKEN` (ou a chave v3 em `TMDB_API_KEY`).

## 3. Vercel

1. Suba o projeto para o GitHub (arquivos na raiz) e importe na Vercel, *Framework Preset* **Other**.
2. Em **Settings › Environment Variables** (veja `.env.example`):

| Variável | Valor |
|---|---|
| `SESSION_SECRET` | texto aleatório longo (`openssl rand -hex 32`) |
| `DATABASE_URL` | connection string do Neon |
| `TMDB_READ_TOKEN` | token v4 do TMDb (ou `TMDB_API_KEY`) |
| `BLOB_READ_WRITE_TOKEN` | *(opcional)* criado ao conectar um **Vercel Blob** (Storage › Create › Blob) |
| `CRON_SECRET` | texto aleatório longo, usado pela faxina e pelos avisos diários (`/api/cron`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | *(opcionais)* ligam os avisos por push; gere com `npm run vapid` (veja `docs/notificacoes.md`) |
| `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM` | *(opcionais)* ligam o "Esqueci minha senha" (veja abaixo) |
| `ADOTAR_DADOS_ANTIGOS` | *(opcional, só para atualizar da versão de uma senha)* `true` faz a primeira conta criada herdar as linhas sem dono; remova depois |
| `CADASTRO_ABERTO` | *(opcional)* depois da primeira conta, os cadastros ficam **fechados**; `true` permite que outras pessoas criem conta |

`APP_PASSWORD` não é mais usada. Se mudar variáveis, faça um **Redeploy**.

### Capas no Vercel Blob (opcional)

Com o Blob conectado, as capas que você envia vão para o Blob e só o link fica no banco, então a lista carrega leve. As capas antigas (base64) são migradas automaticamente, algumas por vez, ao abrir o app. Sem o Blob, tudo continua funcionando como antes (capa pequena no banco).

### Recuperação de senha por e-mail (opcional)

1. Crie uma conta no [Resend](https://resend.com), verifique o seu domínio e gere uma chave de API.
2. Defina `RESEND_API_KEY`, `EMAIL_FROM` (ex.: `SóMaisUmEp <contato@seudominio.com>`) e `APP_URL` (o endereço do site, sem barra no final) e faça um **Redeploy**.

O link enviado vale por 1 hora, funciona uma vez só e encerra as sessões abertas em todos os aparelhos. O banco guarda só o hash do token. O pedido responde sempre igual, exista o e-mail ou não, e é limitado a 3 por e-mail e 10 por IP (a cada 15 min, com bloqueio crescente).

### Faxina diária, avisos e cotas

`/api/cron` roda todo dia às 11:00 UTC, 08:00 em Brasília (veja `crons` no `vercel.json`; precisa de `CRON_SECRET`). Se as chaves VAPID estiverem configuradas, primeiro envia os avisos de lançamento do dia (`api/_notificar.js`); depois apaga: tentativas de login antigas, links de redefinição vencidos e **capas órfãs** do Blob (que nenhum título usa, com mais de 24 h). Cada conta pode enviar até 30 capas por hora e guardar até 1000.

## Se aparecer "Erro no servidor"

1. **Banco desatualizado:** rode `npm run migrar` (ou o `neon/schema.sql` no SQL Editor do Neon).
2. **`DATABASE_URL`:** deve ser a connection string *pooled*, sem espaços ou aspas.
3. **Variáveis em todos os ambientes** (Production/Preview) e **Redeploy** depois de mudar.
4. **Detalhe técnico:** Vercel › Deployments › Functions/Logs.

## Cache e atualização do app

CSS e JS são revalidados a cada abertura (sem precisar mudar `?v=`). O service worker busca o código **na rede primeiro** (todos os módulos do mesmo deploy, sem misturar versões) e só usa a cópia guardada quando está offline; ícones e imagens vêm do cache. O cache offline se renova sozinho a cada deploy: `scripts/build.js` grava o commit em `dist/sw.js` (veja "Service worker" acima), então não precisa trocar `VERSAO` à mão.

As respostas do TMDb (`/api/tmdb`) ficam em cache por 24 h na Vercel (`s-maxage`; 6 h para detalhes de séries, tendências e parecidos, por causa das datas) e 1 h no navegador. O CSP não permite `style=""` no HTML: estilos que dependem de dados usam `data-h`/`data-i`/`data-w`/`data-cover`, aplicados por `aplicarEstilos()` em `public/js/util.js`.

## Rodar localmente

```
npm install
npm test            # testes das regras e da validação da API
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

## Observações

- Edição em dois aparelhos ao mesmo tempo: se o outro aparelho gravou primeiro, o app combina as versões. O progresso nunca regride (vale o maior número de episódios por temporada) e os demais campos seguem a versão do servidor. Um "+1 episódio" feito ao mesmo tempo nos dois lados pode contar uma vez só.
- O limite de tentativas de login usa a tabela `tentativas` no Neon: 5 erros por e-mail (ou 20 por IP) bloqueiam por 15 min, dobrando a cada 3 erros extras (máx. 24 h).
- "Sair de todos os dispositivos" aumenta a versão da conta; trocar `SESSION_SECRET` derruba **todas as contas**.
- `/api/dados` usa ETag: o navegador revalida a cada chamada e, se nada mudou, o servidor responde 304 depois de só duas consultas de contagem (sem ler a biblioteca). Isso vale para a abertura do app e para cada volta à aba.
- **Limites de tentativa (v5.1.2):** o limite por e-mail (5 erros) é a proteção principal contra adivinhar senha; o limite por IP é só uma rede de segurança (100 logins, 30 pedidos de recuperação, 60 redefinições) e fica alto de propósito, porque operadoras móveis põem muita gente atrás do mesmo IP (CGNAT). Cadastro: até 30 por dia (UTC) por IP, em janela fixa com contador próprio, e bloqueio só até a virada do dia. Importação: até 400 lotes de 10 por hora por conta (4000 títulos); no app, cada rodada importa no máximo 3000 (o restante fica para importar de novo; o que já está na estante é pulado antes).
- **Exclusão com checagem de versão (v5.1.2):** apagar um título ou top envia a versão conhecida (`base`). Se outro aparelho o alterou depois, o servidor não apaga, o app recarrega e a edição do outro aparelho vence (o item volta). O arquivo da capa no Blob só é apagado se o título foi mesmo apagado.
- **Sessão renovável (v5.1.2):** o cookie vale 30 dias e é renovado por `/api/dados` quando faltam menos de 7 (abrir o app ou voltar à aba já basta). Só essa rota renova, porque é privada (`no-cache`); rotas com cache público (TMDb) nunca enviam `Set-Cookie`. Quem fica mais de 30 dias sem abrir precisa entrar de novo; "Sair de todos os dispositivos" continua derrubando tudo.
- **Backup importado é saneado (v5.1.2):** ids, números, capas, histórico e textos do arquivo passam pelas mesmas regras do servidor antes de entrar no app (`limparTituloBackup`/`limparTopBackup` em `regras.js`), porque o app desenha os dados antes de salvá-los. Ids e números também são escapados (`esc()`) nos atributos HTML.
- **Cadastro fechado por padrão (v5.2.1):** a primeira conta sempre pode ser criada; depois dela, só com `CADASTRO_ABERTO=true`. Quem já tinha o site aberto e quer manter assim precisa definir essa variável e fazer um Redeploy.
- **Limite do TMDb por conta (v5.2.1):** `/api/tmdb` aceita até 600 consultas por hora por conta (janela fixa, contador `tm` na tabela `tentativas`). Como as respostas têm cache na Vercel, só as que chegam ao TMDb contam, que são as que gastam a cota do token. Passou disso, responde 429.
- **Origem das requisições (v5.2.1):** POST/PUT/DELETE que trazem o cabeçalho `Origin` de outro site recebem 403 (`origemOk` em `api/_lib.js`), além do `SameSite=Strict` do cookie. Sem `Origin` (curl, testes) a requisição segue.
- **Logs de erro (v5.2.1):** erros inesperados saem em uma linha de JSON (`nivel`, `metodo`, `rota`, `usuario`, `msg`, `codigo`, `pilha`), fácil de filtrar em Vercel › Logs.
- **Decisão consciente:** o cadastro avisa quando o e-mail já existe (409). Isso revela quem tem conta, mas num app pessoal a clareza compensa. O login e o "Esqueci minha senha" não revelam nada (mesma resposta sempre).
- Na conta, senha atual errada responde **403** (e não 401, que o app trataria como sessão expirada).
- A imagem do top é desenhada no navegador com as capas do TMDb/Blob, que precisam de CORS. Se o navegador barrar, a imagem sai com letras coloridas no lugar das capas (e o app avisa). Capas enviadas por você em base64 não vão para a página pública.
- A data do TMDb é a de exibição original; no streaming do Brasil o episódio pode sair um dia antes ou depois.
- A Vercel limita o corpo de cada requisição a 4,5 MB. O site já envia os dados em lotes pequenos.
- O gráfico por mês só conta o que for marcado a partir desta versão (o que já estava marcado não tem data).

## Créditos

Este produto usa a API do TMDB, mas não é endossado nem certificado por ele. Dados de streaming: JustWatch, via TMDb.

## Licença

[MIT](LICENSE) © 2026 Adan William Oliveira Santos. Os dados e imagens do TMDB seguem os termos do próprio TMDB.
