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

-- ===== 003_lancamentos_e_compartilhar.sql =====
-- 003: próximo lançamento de cada título (datas do TMDb) e link público dos tops. Seguro rodar de novo.

-- Próximo episódio ou estreia: { "d": "2026-11-06", "t": 3, "e": 1 } (t e e são opcionais; filmes só têm "d")
alter table titulos add column if not exists proximo jsonb;

-- Link público: "publico" é o código secreto da URL /t/<código>; nulo = top privado.
alter table tops add column if not exists publico    text;
alter table tops add column if not exists publico_em bigint;
create unique index if not exists tops_publico_idx on tops (publico) where publico is not null;

-- ===== 004_chave_por_usuario.sql =====
-- 004: a chave de títulos e tops passa a ser (user_id, id): o id só precisa ser único dentro da conta de cada pessoa.
-- Antes, um id igual ao de outra conta fazia o sync tratar a gravação como "conflito" para sempre. Seguro rodar de novo.
-- (Nenhuma outra tabela referencia titulos.id ou tops.id.)

alter table titulos drop constraint if exists titulos_pkey;
alter table tops drop constraint if exists tops_pkey;

-- Índice único (e não primary key) porque linhas antigas sem dono ainda podem ter user_id nulo até a primeira conta adotá-las.
create unique index if not exists titulos_user_id_uidx on titulos (user_id, id);
create unique index if not exists tops_user_id_uidx on tops (user_id, id);

-- ===== 005_avisos_push.sql =====
-- 005: assinaturas de notificação push (Web Push), uma linha por aparelho/navegador. Seguro rodar de novo.
-- "endpoint" é o endereço que o serviço de push do navegador dá a este aparelho; p256dh e auth são as chaves que ele
-- gera para cifrar as mensagens. "ultimo_dia" (AAAA-MM-DD) evita avisar duas vezes no mesmo dia.
create table if not exists push_assinaturas (
  endpoint   text primary key,
  user_id    text not null references usuarios(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  criado     bigint not null default (extract(epoch from now()) * 1000)::bigint,
  ultimo_dia text
);
create index if not exists push_assinaturas_user_idx on push_assinaturas (user_id);

-- Os avisos procuram títulos pela data do próximo lançamento (titulos.proximo->>'d').
create index if not exists titulos_proximo_idx on titulos ((proximo->>'d')) where proximo is not null;

-- ===== 006_verificacao_proximo.sql =====
-- 006: verificação diária do próximo lançamento feita pelo servidor (api/_atualizar.js, chamado pelo cron).
-- "tmdb_verificado" (ms) guarda quando o servidor consultou o TMDb pela última vez para aquele título. Serve de cursor da fila:
-- a cada execução vão primeiro os títulos verificados há mais tempo (ou nunca). Seguro rodar de novo.
alter table titulos add column if not exists tmdb_verificado bigint;

-- A fila agrupa os títulos de todas as contas pelo id do TMDb.
create index if not exists titulos_tmdb_idx on titulos (tmdb) where tmdb is not null;

-- ===== controle de migrações =====
create table if not exists migracoes (id text primary key, aplicada bigint not null);
insert into migracoes (id, aplicada) values ('001_inicial', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
insert into migracoes (id, aplicada) values ('002_restricoes_contas_capas', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
insert into migracoes (id, aplicada) values ('003_lancamentos_e_compartilhar', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
insert into migracoes (id, aplicada) values ('004_chave_por_usuario', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
insert into migracoes (id, aplicada) values ('005_avisos_push', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
insert into migracoes (id, aplicada) values ('006_verificacao_proximo', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing;
