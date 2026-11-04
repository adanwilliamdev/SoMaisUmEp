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
