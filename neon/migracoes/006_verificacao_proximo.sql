-- 006: verificação diária do próximo lançamento feita pelo servidor (api/_atualizar.js, chamado pelo cron).
-- "tmdb_verificado" (ms) guarda quando o servidor consultou o TMDb pela última vez para aquele título. Serve de cursor da fila:
-- a cada execução vão primeiro os títulos verificados há mais tempo (ou nunca). Seguro rodar de novo.
alter table titulos add column if not exists tmdb_verificado bigint;

-- A fila agrupa os títulos de todas as contas pelo id do TMDb.
create index if not exists titulos_tmdb_idx on titulos (tmdb) where tmdb is not null;
