# Claquete

Seu diário de séries e filmes: progresso por episódio e temporada, filmes assistidos, tops 10 e estatísticas.
Front-end estático (PWA instalável) + funções serverless da Vercel + Postgres no Neon. Cada pessoa cria a própria conta e tem a própria biblioteca.

```
public/        site (index.html, style.css, manifest.json, sw.js, js/ em módulos, icons/)
api/           funções serverless (login, cadastro, logout, dados, sync, capa, tmdb)
neon/          schema.sql
test/          testes (node --test)
```

## O que tem (v4.2)

- **PWA**: instale pela tela inicial do celular; abre sem barra do navegador, rápido e até sem internet (com a última cópia dos seus dados).
- **Estante**: busca por nome, ordenação (recentes, nome, nota, último visto), filtros e a fileira "Continuar assistindo".
- **TMDb**: busca ao cadastrar, botão "Atualizar do TMDb" e verificação automática (1x por dia por série) de temporadas e episódios novos, sem perder progresso. Em cada título, "Onde assistir" (Brasil).
- **Minha avaliação**: nota e resenha pessoais por título.
- **Estatísticas**: tempo assistido, contagens, nota média e gráfico por mês.
- **Tops 10**: arraste a alça ⋮⋮ (ou use as setas do teclado com a alça selecionada).
- **Backup**: baixar/importar arquivo `.json`.
- **Tema claro/escuro** pelo botão no topo.
- **Contas**: senha com scrypt, bloqueio temporário após tentativas erradas (por IP e por e-mail, guardado no banco) e "Sair de todos os dispositivos".
- **Segurança de dados**: salvamento com nova tentativa automática, aviso de "sem conexão", cópia local, e detecção de edição em dois aparelhos (campo `atualizado`); ao voltar para a aba, os dados são recarregados.

## 1. Neon

1. No Neon Console, crie um projeto.
2. Abra o **SQL Editor** e rode `neon/schema.sql` (seguro rodar de novo, **inclusive para atualizar um banco da versão antiga**).
3. Em **Connect**, copie a connection string *pooled* → `DATABASE_URL`.

> **Atualizando da versão de uma senha só?** Rode o novo `schema.sql`, faça o deploy e **crie a sua conta**: a primeira conta criada herda todos os dados que já existiam.

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
| `CADASTRO_ABERTO` | *(opcional)* `false` fecha novos cadastros depois da primeira conta |

`APP_PASSWORD` não é mais usada. Se mudar variáveis, faça um **Redeploy**.

### Capas no Vercel Blob (opcional)

Com o Blob conectado, as capas que você envia vão para o Blob e só o link fica no banco, então a lista carrega leve. As capas antigas (base64) são migradas automaticamente, algumas por vez, ao abrir o app. Sem o Blob, tudo continua funcionando como antes (capa pequena no banco).

## Se aparecer "Erro no servidor"

1. **Banco desatualizado:** rode `neon/schema.sql` no SQL Editor do Neon.
2. **`DATABASE_URL`:** deve ser a connection string *pooled*, sem espaços ou aspas.
3. **Variáveis em todos os ambientes** (Production/Preview) e **Redeploy** depois de mudar.
4. **Detalhe técnico:** Vercel › Deployments › Functions/Logs.

## Cache e atualização do app

CSS e JS são revalidados a cada abertura (sem precisar mudar `?v=`). O service worker busca o código **na rede primeiro** (todos os módulos do mesmo deploy, sem misturar versões) e só usa a cópia guardada quando está offline; ícones e imagens vêm do cache. Para renovar o cache offline em um deploy novo, troque `VERSAO` em `public/sw.js`.

As respostas do TMDb (`/api/tmdb`) ficam em cache por 24 h na Vercel (`s-maxage`) e 1 h no navegador. O CSP não permite `style=""` no HTML: estilos que dependem de dados usam `data-h`/`data-i`/`data-w`/`data-cover`, aplicados por `aplicarEstilos()` em `public/js/util.js`.

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
- A Vercel limita o corpo de cada requisição a 4,5 MB. O site já envia os dados em lotes pequenos.
- O gráfico por mês só conta o que for marcado a partir desta versão (o que já estava marcado não tem data).

## Créditos

Este produto usa a API do TMDB, mas não é endossado nem certificado por ele. Dados de streaming: JustWatch, via TMDb.
