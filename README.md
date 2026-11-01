# Claquete

Meu diário pessoal de séries e filmes: progresso por episódio e temporada, filmes assistidos e tops 10.
Front-end estático + funções serverless da Vercel + banco Postgres no Neon.

```
public/        site (index.html, style.css, app.js)
api/           funções serverless (login, dados, sync, tmdb)
neon/          schema.sql
```

## Como funciona

- O navegador só fala com `/api/*`. A chave do TMDb e a connection string do banco ficam em **variáveis de ambiente** no servidor e nunca chegam ao navegador.
- Os dados ficam no **Neon** (tabelas `titulos` e `tops`). O site envia ao banco só o que mudou, a cada alteração, numa transação.
- O acesso é protegido por **uma senha** (`APP_PASSWORD`). Após o login, um cookie assinado (HttpOnly, 30 dias) libera a API.
- A busca do TMDb passa pelo servidor, então a chave não aparece no código nem na rede do navegador.

## 1. Neon

1. No Neon Console (console.neon.tech), crie um projeto.
2. Abra o **SQL Editor** e rode o conteúdo de `neon/schema.sql`.
3. Clique em **Connect**, escolha a opção *pooled connection* e copie a connection string. Ela é o valor de `DATABASE_URL` e é segredo: não coloque no GitHub.

Atalho: na Vercel, em **Storage** (ou Marketplace), a integração com o Neon cria o banco e já define `DATABASE_URL` no projeto. Nesse caso, falta só rodar o `schema.sql`.

## 2. TMDb

Em themoviedb.org › Configurações › API, copie o **Token de Leitura da API (v4)**. A chave v3 também funciona (`TMDB_API_KEY`).

## 3. Vercel

1. Suba este projeto para um repositório no GitHub (os arquivos precisam estar na raiz do repositório).
2. Na Vercel, importe o repositório. Deixe o *Framework Preset* como **Other**.
3. Antes de publicar, em **Settings › Environment Variables**, crie as variáveis abaixo (veja também `.env.example`):

| Variável | Valor |
|---|---|
| `APP_PASSWORD` | a senha para entrar no site (use uma frase longa) |
| `SESSION_SECRET` | texto aleatório longo (`openssl rand -hex 32`) |
| `DATABASE_URL` | connection string do Neon |
| `TMDB_READ_TOKEN` | token v4 do TMDb (ou use `TMDB_API_KEY`) |

4. Clique em **Deploy**. Se você alterar variáveis depois, faça um **Redeploy**.

Se alguma variável faltar, o site mostra qual é.

## Se aparecer "Erro no servidor"

O app mostra a causa quando é um problema conhecido. Confira, nesta ordem:

1. **Tabelas:** rode `neon/schema.sql` no SQL Editor do Neon (é seguro rodar de novo).
2. **`DATABASE_URL`:** em Vercel › Settings › Environment Variables, deve ser a connection string *pooled* do Neon, sem espaços ou aspas.
3. **Variáveis em todos os ambientes:** marque Production (e Preview, se usar) e faça um **Redeploy** depois de mudar qualquer valor.
4. **Detalhe técnico:** Vercel › Deployments › Functions/Logs mostra o erro completo.

## Cache de `style.css` e `app.js`

`vercel.json` manda a CDN e o navegador guardarem `.css` e `.js` por 1 ano (`immutable`). Para o navegador buscar a versão nova depois de mudar um deles, **troque o número em `?v=` no `index.html`** (ex.: `style.css?v=3.2.1`).

## Rodar localmente

```
npm i -g vercel
npm install
vercel link
vercel env pull .env.local
vercel dev
```

## Trazer os dados da versão antiga

Na versão antiga (que salvava no navegador), abra **Backup** no rodapé e copie o texto.
No site novo, abra **Backup**, cole o texto e clique em **Importar**. Itens com o mesmo id são substituídos e os demais são mantidos.

## Observações

- Pensado para uso pessoal (uma senha, um usuário). Para várias pessoas, o caminho é trocar a senha por login de usuários (por exemplo Auth.js) e acrescentar uma coluna `user_id` nas tabelas.
- Capas enviadas por você são reduzidas e guardadas no próprio banco. As do TMDb são só links.
- A Vercel limita o corpo de cada requisição a 4,5 MB. O site já envia os dados em lotes pequenos.

## Créditos

Este produto usa a API do TMDB, mas não é endossado nem certificado por ele.
