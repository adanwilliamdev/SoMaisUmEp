-- 004: a chave de títulos e tops passa a ser (user_id, id): o id só precisa ser único dentro da conta de cada pessoa.
-- Antes, um id igual ao de outra conta fazia o sync tratar a gravação como "conflito" para sempre. Seguro rodar de novo.
-- (Nenhuma outra tabela referencia titulos.id ou tops.id.)

alter table titulos drop constraint if exists titulos_pkey;
alter table tops drop constraint if exists tops_pkey;

-- Índice único (e não primary key) porque linhas antigas sem dono ainda podem ter user_id nulo até a primeira conta adotá-las.
create unique index if not exists titulos_user_id_uidx on titulos (user_id, id);
create unique index if not exists tops_user_id_uidx on tops (user_id, id);
