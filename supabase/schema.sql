-- Cache dos dados do TMDb (rode no SQL Editor do Supabase). Seguro para rodar de novo.
create table if not exists titulos (
  tmdb_id integer not null,
  tipo text not null check (tipo in ('movie','tv')),
  titulo text not null,
  sinopse text,
  ano text,
  generos text[] default '{}',
  duracao integer,
  poster_path text,
  backdrop_path text,
  nota numeric(3,1),
  atualizado_em timestamptz not null default now(),
  primary key (tipo, tmdb_id)
);

-- v2: guarda o payload completo (elenco, trailer, onde assistir, similares...)
alter table titulos add column if not exists dados jsonb;

create index if not exists titulos_atualizado_em_idx on titulos (atualizado_em);

alter table titulos enable row level security;
-- Acesso apenas via service role (servidor). Sem policies = ninguém acessa pelo cliente.
