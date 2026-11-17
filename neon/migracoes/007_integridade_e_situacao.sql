-- 007: integridade dos dados e situação (pausada/abandonada) dos títulos. Seguro rodar de novo.
-- Linhas sem dono (user_id nulo) vieram da versão de uma só senha e ninguém consegue vê-las (toda consulta filtra por user_id).
-- Só são apagadas quando já existe alguma conta; num banco ainda sem contas elas ficam (e o NOT NULL abaixo falha, de propósito,
-- até a primeira conta adotá-las com ADOTAR_DADOS_ANTIGOS=true ou você apagá-las).
delete from titulos where user_id is null and exists (select 1 from usuarios);
delete from tops where user_id is null and exists (select 1 from usuarios);

alter table titulos alter column user_id set not null;
alter table tops alter column user_id set not null;

-- Chave primária (user_id, id) no lugar dos índices únicos criados na 004.
alter table titulos drop constraint if exists titulos_pkey;
alter table tops drop constraint if exists tops_pkey;
alter table titulos add primary key (user_id, id);
alter table tops add primary key (user_id, id);
drop index if exists titulos_user_id_uidx;
drop index if exists tops_user_id_uidx;

-- Notas de 0 a 10 (o servidor já valida; aqui o banco também garante). "not valid": não trava linhas antigas fora do padrão.
alter table titulos drop constraint if exists titulos_nota_faixa;
alter table titulos add constraint titulos_nota_faixa check ((nota is null or nota between 0 and 10) and (nota_pessoal is null or nota_pessoal between 0 and 10)) not valid;

-- Situação escolhida pela pessoa: nulo = normal.
alter table titulos add column if not exists situacao text;
alter table titulos drop constraint if exists titulos_situacao_valida;
alter table titulos add constraint titulos_situacao_valida check (situacao is null or situacao in ('pausada', 'abandonada'));
