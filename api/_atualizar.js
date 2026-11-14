// Verificação diária do próximo lançamento feita pelo servidor (chamada por api/cron.js, ANTES dos avisos por push).
// Antes, titulos.proximo só era atualizado pelo navegador quando o app abria: um episódio anunciado depois da última
// abertura nunca gerava aviso. Aqui o cron consulta o TMDb e grava o resultado para todas as contas.
//
//  - Dedup: a fila agrupa por (tipo, tmdb) entre todas as contas, então um título que 50 pessoas acompanham custa uma
//    consulta só, e o resultado vale para as 50 linhas.
//  - Cursor: titulos.tmdb_verificado (migração 006) diz quando cada título foi consultado. Cada execução pega os mais
//    antigos primeiro, então o que não coube hoje vai amanhã. Funciona em serverless (nada fica na memória).
//  - Lotes e orçamento de tempo: no máximo `max` títulos por execução, em grupos de `paralelo`, parando ao estourar
//    `orcamentoMs` (o cron tem maxDuration limitado e ainda precisa mandar os avisos).
//  - Frequência: séries com data de lançamento a cada 20 h; as sem data (concluídas ou em hiato) a cada 6 dias.
//  - Não mexe no que sai HOJE: o TMDb pode trocar o episódio de hoje pelo seguinte, e isso apagaria o aviso antes de ele
//    ser enviado. No dia seguinte a data já passou e a linha é atualizada normalmente.
const { detalhe, configurado } = require('./_tmdb');
const { dataNoFuso } = require('./_notificar');

const HORA = 36e5,
  DIA = 864e5;
const COM_DATA = 20 * HORA,
  SEM_DATA = 6 * DIA;
const FALHAS_SEGUIDAS = 5; // TMDb fora do ar: para de insistir

async function atualizarProximos(
  sql,
  { agora = Date.now(), hoje = dataNoFuso(agora), buscar = detalhe, max = 60, paralelo = 5, orcamentoMs = 12000, relogio = Date.now } = {},
) {
  if (buscar === detalhe && !configurado()) return { ativo: false };

  // Filmes só entram enquanto têm estreia marcada; séries sempre (uma temporada nova pode ser anunciada a qualquer momento).
  const fila = await sql`
    select tipo, tmdb from titulos
    where tmdb is not null and (tipo = 'tv' or proximo is not null)
    group by tipo, tmdb
    having min(coalesce(tmdb_verificado, 0)) < case when bool_or(proximo is not null) then ${agora - COM_DATA}::bigint else ${agora - SEM_DATA}::bigint end
    order by min(coalesce(tmdb_verificado, 0)), tmdb
    limit ${max}::int`;

  const r = { ativo: true, hoje, candidatos: fila.length, consultados: 0, atualizados: 0, falhas: 0, interrompido: false };
  const inicio = relogio();
  let seguidas = 0;
  for (let i = 0; i < fila.length; i += paralelo) {
    if (relogio() - inicio >= orcamentoMs || seguidas >= FALHAS_SEGUIDAS) {
      r.interrompido = true;
      break;
    }
    const lote = fila.slice(i, i + paralelo);
    const saidas = await Promise.allSettled(lote.map(x => buscar(x.tipo, x.tmdb)));
    for (let j = 0; j < lote.length; j++) {
      const { tipo, tmdb } = lote[j],
        s = saidas[j];
      if (s.status === 'fulfilled') {
        seguidas = 0;
        r.consultados++;
        const novo = (s.value && s.value.proximo) || null;
        // Só grava a data nova se ela não for a de hoje (veja o topo). `atualizado` só sobe quando algo mudou de fato: assim os
        // aparelhos abertos veem a data nova (a ETag da biblioteca muda) e, se tiverem edição pendente, caem no fluxo normal de conflito.
        const linhas = await sql`
          update titulos set
            atualizado = case when coalesce(proximo->>'d', '') <> ${hoje} and proximo is distinct from ${novo ? JSON.stringify(novo) : null}::jsonb then ${agora} else atualizado end,
            proximo = case when coalesce(proximo->>'d', '') = ${hoje} then proximo else ${novo ? JSON.stringify(novo) : null}::jsonb end,
            tmdb_verificado = ${agora}
          where tipo = ${tipo} and tmdb = ${tmdb}
          returning atualizado = ${agora} as mudou`;
        r.atualizados += linhas.filter(l => l.mudou).length;
      } else {
        // Título apagado do TMDb ou erro só dele: marca como verificado (sem mexer na data) para não travar a fila nos mesmos ids todo dia.
        seguidas++;
        r.falhas++;
        await sql`update titulos set tmdb_verificado = ${agora} where tipo = ${tipo} and tmdb = ${tmdb}`;
      }
    }
  }
  return r;
}

module.exports = { atualizarProximos, COM_DATA, SEM_DATA };
