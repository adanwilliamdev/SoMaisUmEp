# Claquete

Meu diário pessoal de séries e filmes: acompanhe temporadas e episódios, marque o que já viu e monte seus tops 10.
Site estático (HTML + CSS + JS), sem build e sem servidor.

## Recursos

- **Séries**: progresso por episódio e por temporada, próximo episódio, botão "+1 episódio".
- **Filmes**: lista com "na fila" e "assistidos".
- **Tops 10**: quantos rankings quiser, com reordenação.
- **TMDb (opcional)**: busca o nome, a capa, a sinopse, o ano, a nota e o número real de episódios de cada temporada.
- Tema claro/escuro automático e capa própria como alternativa ao TMDb.

## Hospedar na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Em vercel.com, clique em **Add New › Project** e importe o repositório.
3. Em *Framework Preset* deixe **Other**. Não precisa de build command nem de output directory.
4. Clique em **Deploy**.

Alternativa pelo terminal: `npm i -g vercel` e depois `vercel` dentro desta pasta.

Para testar localmente: `npx serve .` (ou abra o `index.html` no navegador).

## Configurar o TMDb

1. Crie uma conta em themoviedb.org e gere uma chave em *Configurações › API*.
2. No site, clique em **Configurar TMDb** (rodapé) e cole a chave v3 ou o token de leitura v4.
3. Ao adicionar uma série ou filme, use o campo **Buscar no TMDb**.

A chave fica só no navegador, nunca no código.

## Seus dados

Tudo é salvo no `localStorage` do navegador, então cada aparelho tem a sua própria lista.
Use o botão **Backup** no rodapé para copiar seus dados e **Importar** para restaurar ou levar para outro aparelho.

## Créditos

Este produto usa a API do TMDB, mas não é endossado nem certificado por ele.
