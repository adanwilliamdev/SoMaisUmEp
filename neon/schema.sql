-- ARQUIVO GERADO por "npm run schema" a partir de neon/migracoes/. Não edite aqui: crie uma nova migração.
-- Rode no SQL Editor do Neon. Seguro para rodar de novo e para atualizar um banco antigo.

-- ===== 001_inicial.sql =====
-- 001: tabelas e colunas da versão 4 (usuários, títulos, tops, tentativas). Seguro rodar de novo.

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

-- ===== 002_restricoes_contas_capas.sql =====
-- 002: restrições de integridade, índices, recuperação de senha e controle de capas. Seguro rodar de novo.

-- Episódios e vistos precisam ter o mesmo número de temporadas. "not valid" vale para linhas novas/alteradas
-- e não trava bancos antigos que tenham alguma linha fora do padrão.
alter table titulos drop constraint if exists titulos_eps_vis_tam;
alter table titulos add constraint titulos_eps_vis_tam check (cardinality(eps) >= 1 and cardinality(eps) = cardinality(vis)) not valid;

-- Listagem da estante: filtra por usuário e ordena por criação (o índice composto cobre também só user_id).
create index if not exists titulos_user_criado_idx on titulos (user_id, criado desc);
create index if not exists tops_user_criado_idx on tops (user_id, criado desc);
drop index if exists titulos_user_idx;
drop index if exists tops_user_idx;

-- Limpeza periódica da tabela de tentativas (api/cron.js)
create index if not exists tentativas_ultima_idx on tentativas (ultima);

-- Recuperação de senha: só o hash do token é guardado; vale por 1 hora e uma única vez.
create table if not exists reset_senha (
  token_hash text primary key,
  user_id    text not null references usuarios(id) on delete cascade,
  expira     bigint not null,
  criado     bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists reset_senha_user_idx on reset_senha (user_id);
create index if not exists reset_senha_expira_idx on reset_senha (expira);

-- Capas enviadas ao Vercel Blob: base da cota por usuário e da limpeza de arquivos órfãos.
create table if not exists capas (
  url     text primary key,
  user_id text not null references usuarios(id) on delete cascade,
  criado  bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists capas_user_idx on capas (user_id, criado desc);

-- ===== controle de migrações =====
create table if not exists migracoes (id text primary key, aplicada bigint not null);
insert into migracoes (id, aplicada) values ('001_inicial', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
insert into migracoes (id, aplicada) values ('002_restricoes_contas_capas', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
