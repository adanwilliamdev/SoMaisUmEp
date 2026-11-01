# Claquete

Meu diário pessoal de séries e filmes: progresso por episódio e temporada, filmes assistidos e tops 10.
Front-end estático + funções serverless da Vercel + banco no Supabase.

```
public/        site (index.html, style.css, app.js)
api/           funções serverless (login, dados, sync, tmdb)
supabase/      schema.sql
```

## Como funciona

- O navegador só fala com `/api/*`. As chaves do TMDb e do Supabase ficam em **variáveis de ambiente** no servidor e nunca chegam ao navegador.
- Os dados ficam no **Supabase** (tabelas `titulos` e `tops`). O site envia ao banco só o que mudou, a cada alteração.
- O acesso é protegido por **uma senha** (`APP_PASSWORD`). Após o login, um cookie assinado (HttpOnly, 30 dias) libera a API.
- A busca do TMDb passa pelo servidor, então a chave não aparece no código nem na rede do navegador.

## 1. Supabase

1. Crie um projeto em supabase.com.
2. Em **SQL Editor**, rode o conteúdo de `supabase/schema.sql`.
3. Em **Project Settings › API**, copie a **Project URL** e a chave **service_role** (ou *secret key*). Essa chave é só do servidor: nunca coloque no front nem no GitHub.

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
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role / secret |
| `TMDB_READ_TOKEN` | token v4 do TMDb (ou use `TMDB_API_KEY`) |

4. Clique em **Deploy**. Se você alterar variáveis depois, faça um **Redeploy**.

Se alguma variável faltar, o site mostra qual é.

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

- Pensado para uso pessoal (uma senha, um usuário). Para várias pessoas, o caminho é Supabase Auth com uma coluna `user_id` e policies de RLS.
- Capas enviadas por você são reduzidas e guardadas no próprio banco. As do TMDb são só links.
- A Vercel limita o corpo de cada requisição a 4,5 MB. O site já envia os dados em lotes pequenos.

## Créditos

Este produto usa a API do TMDB, mas não é endossado nem certificado por ele.
