-- Rode no SQL Editor do Neon Console. Seguro para rodar de novo e para atualizar um banco da versão antiga.

-- Usuários (cada um tem a própria biblioteca)
create table if not exists usuarios (
  id          text primary key,
  email       text not null unique,
  nome        text not null,
  senha_hash  text not null,
  versao      integer not null default 1,   -- incrementar encerra todas as sessões do usuário
  criado      bigint not null default (extract(epoch from now()) * 1000)::bigint
);

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

-- Colunas novas (v4). Em bancos antigos, as linhas existentes ficam sem dono (user_id nulo)
-- e são adotadas pela PRIMEIRA conta criada no site.
alter table titulos add column if not exists user_id      text references usuarios(id) on delete cascade;
alter table titulos add column if not exists atualizado   bigint not null default (extract(epoch from now()) * 1000)::bigint;
alter table titulos add column if not exists nota_pessoal numeric(3,1);          -- minha nota (0 a 10)
alter table titulos add column if not exists resenha      text;                  -- minha resenha
alter table titulos add column if not exists visto_em     bigint;                -- último progresso marcado
alter table titulos add column if not exists hist         jsonb not null default '{}';  -- { "2026-11": episódios/filmes marcados no mês }

alter table tops add column if not exists user_id    text references usuarios(id) on delete cascade;
alter table tops add column if not exists atualizado bigint not null default (extract(epoch from now()) * 1000)::bigint;

create index if not exists titulos_user_idx on titulos (user_id);
create index if not exists tops_user_idx on tops (user_id);

-- Controle de tentativas de login/cadastro (bloqueio temporário por IP e por e-mail)
create table if not exists tentativas (
  chave   text primary key,
  falhas  integer not null default 0,
  ate     bigint not null default 0,    -- bloqueado até (ms)
  ultima  bigint not null default 0
);
-- O acesso é só pelo servidor, com a connection string (DATABASE_URL).
