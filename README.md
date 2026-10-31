# Claquete

Sinopses de filmes e séries em português. Next.js 14 + TMDb API + Supabase (cache).

## Como rodar
1. `npm install`
2. Crie uma chave gratuita em themoviedb.org (Configurações > API) e copie `.env.example` para `.env.local`.
3. No Supabase, rode `supabase/schema.sql` no SQL Editor e preencha a URL e a service role key.
4. Baixe o logo oficial do TMDB e salve como `public/tmdb.svg`.
5. `npm run dev` e abra http://localhost:3000

## Como funciona
- Home: tendências da semana ou resultados de busca (`/search/multi`, `language=pt-BR`).
- Página do título: lê do Supabase; se não houver (ou tiver mais de 30 dias), busca no TMDb e salva.
- A service role key só é usada no servidor. Nunca a exponha no cliente.

## Créditos (obrigatório)
This product uses the TMDB API but is not endorsed or certified by TMDB. (já incluso no rodapé)
