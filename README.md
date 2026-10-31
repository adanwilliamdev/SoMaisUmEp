# Claquete

Descubra filmes e séries e leia a sinopse em português — com elenco, trailer, onde assistir (Brasil) e títulos parecidos.
Next.js 14 (App Router) + TMDb API + Supabase (cache opcional).

## O que tem

- **Home** com abas *Em alta / Filmes / Séries*, ordenação (populares, mais bem avaliados, lançamentos), filtro por gênero e paginação — tudo por URL, funciona até sem JavaScript.
- **Busca** de filmes e séries com paginação.
- **Página do título**: sinopse, tagline, nota, duração, direção/criação, elenco, trailer (YouTube, só carrega após o clique), **onde assistir no Brasil** (JustWatch), títulos parecidos, link para o IMDb.
- **Minha lista**: salve títulos para ver depois (fica no navegador, sincroniza entre abas).
- **SEO**: metadados por título, Open Graph, JSON-LD (`Movie`/`TVSeries`), `sitemap.xml`, `robots.txt`.
- **Robustez**: timeout + retry com backoff no TMDb, páginas de erro/404/loading, cache *stale-if-error* (se o TMDb cair, serve o cache antigo), Supabase **opcional**.
- **Segurança**: validação de todos os parâmetros de URL, headers de segurança, service role só no servidor (`server-only`).
- **Qualidade**: testes (Vitest), checagem de tipos e CI no GitHub Actions.

## Como rodar

1. `npm install`
2. Crie uma conta em themoviedb.org (Configurações › API) e copie `.env.example` para `.env.local`. Use `TMDB_API_KEY` (v3) **ou** `TMDB_READ_TOKEN` (token v4).
3. *(Opcional)* Para cache persistente, rode `supabase/schema.sql` no SQL Editor do Supabase e preencha `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Se já usava a v1, rode o arquivo de novo: ele só adiciona a coluna `dados`.
4. Baixe o logo oficial do TMDB e salve como `public/tmdb.svg`.
5. `npm run dev` e abra http://localhost:3000

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e execução de produção |
| `npm run typecheck` | checagem de tipos (TypeScript strict) |
| `npm test` | testes unitários |
| `npm run check` | typecheck + testes |

## Como funciona

- `lib/tipos.ts` — tipos e utilitários seguros para cliente e servidor.
- `lib/mapeamento.ts` — funções puras que transformam as respostas do TMDb (testadas).
- `lib/params.ts` — leitura/validação dos parâmetros de URL.
- `lib/tmdb.ts` — acesso ao TMDb (servidor) + cache. O título é lido do Supabase; se não existir ou tiver mais de `CACHE_DIAS` (padrão 7), busca no TMDb com **uma única chamada** (`append_to_response`) e grava.
- `app/` — páginas, componentes e estilos.

## Créditos (obrigatório)

This product uses the TMDB API but is not endorsed or certified by TMDB. Dados de streaming por JustWatch. (já incluso no rodapé)
