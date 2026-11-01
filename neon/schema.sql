-- Rode no SQL Editor do Neon Console. Seguro para rodar de novo.
create table if not exists titulos (
  id       text primary key,
  tipo     text not null default 'tv' check (tipo in ('tv', 'movie')),
  nome     text not null,
  capa     text,
  sinopse  text,
  ano      text,
  nota     numeric(3,1),
  duracao  integer,
  tmdb     integer,
  eps      integer[] not null,   -- episódios de cada temporada
  vis      integer[] not null,   -- episódios vistos em cada temporada
  criado   bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists tops (
  id      text primary key,
  nome    text not null,
  itens   jsonb not null default '[]',   -- [{ "t": "título", "sid": "id do título (opcional)" }]
  criado  bigint not null default (extract(epoch from now()) * 1000)::bigint
);
-- O acesso é só pelo servidor, com a connection string (DATABASE_URL).
