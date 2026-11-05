-- 003: próximo lançamento de cada título (datas do TMDb) e link público dos tops. Seguro rodar de novo.

-- Próximo episódio ou estreia: { "d": "2026-11-06", "t": 3, "e": 1 } (t e e são opcionais; filmes só têm "d")
alter table titulos add column if not exists proximo jsonb;

-- Link público: "publico" é o código secreto da URL /t/<código>; nulo = top privado.
alter table tops add column if not exists publico    text;
alter table tops add column if not exists publico_em bigint;
create unique index if not exists tops_publico_idx on tops (publico) where publico is not null;
