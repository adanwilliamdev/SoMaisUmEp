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
