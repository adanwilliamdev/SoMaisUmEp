// Avisos de lançamento por push: uma vez por dia (api/cron.js) procura os títulos de cada pessoa cujo próximo episódio
// (ou estreia) é HOJE e manda uma notificação para cada aparelho que ela ativou. A data vem de titulos.proximo, que o app
// atualiza com o TMDb quando é aberto: se o app ficar muito tempo sem abrir, um lançamento anunciado depois não é visto aqui.
const W = require('./_webpush');

// "Hoje" é a data no fuso do público (padrão Brasília, UTC-3 o ano todo). FUSO_AVISOS muda isso (ex.: America/Manaus).
function dataNoFuso(agora = Date.now(), fuso = process.env.FUSO_AVISOS || 'America/Sao_Paulo') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora); // AAAA-MM-DD
  } catch {
    return new Date(agora - 3 * 36e5).toISOString().slice(0, 10);
  }
}

const curto = (t, n = 60) => (String(t).length > n ? String(t).slice(0, n - 1) + '…' : String(t));
const lista = nomes => {
  const n = nomes.map(x => curto(x)),
    m = n.slice(0, 3);
  return n.length > 3 ? `${m.join(', ')} e mais ${n.length - 3}` : m.length > 1 ? `${m.slice(0, -1).join(', ')} e ${m[m.length - 1]}` : m[0];
};

// itens: [{ nome, tipo, t, e }]. Mesmas palavras do aviso dentro do app ("Novo ep", "Nova temporada", "Estreia").
function montarMensagem(itens) {
  const quem = i => (i.tipo === 'movie' ? 'Estreia' : i.e === 1 && i.t > 1 ? 'Nova temporada' : 'Novo ep');
  if (itens.length === 1) {
    const i = itens[0];
    return { titulo: `Sai hoje: ${curto(i.nome)}`, corpo: `${quem(i)}${i.t && i.e ? ` · T${i.t} E${i.e}` : ''}`, url: '/#series', tag: 'lancamentos' };
  }
  return { titulo: `Sai hoje: ${itens.length} títulos`, corpo: lista(itens.map(i => i.nome)), url: '/#series', tag: 'lancamentos' };
}

// Envia os avisos de hoje. `enviar` e `vapid` podem ser trocados nos testes. Nunca lança por falha de um aparelho.
async function enviarLancamentos(sql, { agora = Date.now(), vapid = W.chaves(), enviar = W.enviar } = {}) {
  if (!vapid) return { ativo: false };
  const hoje = dataNoFuso(agora);
  // Só entram aparelhos de quem tem algo para hoje: sem esse filtro, quem não tem lançamento nunca recebe "ultimo_dia" e os mesmos
  // 500 aparelhos ocupariam o limite todo dia, deixando os demais sem aviso quando houver muitas assinaturas.
  const subs = await sql`select endpoint, p256dh, auth, user_id from push_assinaturas where ultimo_dia is distinct from ${hoje}
    and user_id in (select user_id from titulos where proximo->>'d' = ${hoje}) limit 500`;
  const r = { ativo: true, hoje, aparelhos: subs.length, enviados: 0, removidos: 0, falhas: 0 };
  if (!subs.length) return r;

  const donos = [...new Set(subs.map(s => s.user_id))];
  const titulos = await sql`select user_id, nome, tipo, vis, proximo from titulos where user_id = any(${donos}) and proximo->>'d' = ${hoje}`;
  const porDono = new Map();
  for (const t of titulos) {
    if (t.tipo === 'movie' && (t.vis || [])[0] > 0) continue; // filme que já foi marcado como visto não precisa de aviso
    const p = t.proximo || {};
    if (!porDono.has(t.user_id)) porDono.set(t.user_id, []);
    porDono.get(t.user_id).push({ nome: t.nome, tipo: t.tipo, t: p.t || null, e: p.e || null });
  }

  const ok = [],
    mortos = [],
    fila = subs.filter(s => porDono.has(s.user_id));
  for (let i = 0; i < fila.length; i += 10) {
    const lote = fila.slice(i, i + 10);
    const res = await Promise.allSettled(
      lote.map(s =>
        enviar(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          montarMensagem(porDono.get(s.user_id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))),
          vapid,
          { agora },
        ),
      ),
    );
    res.forEach((x, j) => {
      if (x.status === 'fulfilled' && x.value.ok) ok.push(lote[j].endpoint);
      else if (x.status === 'fulfilled' && x.value.gone) mortos.push(lote[j].endpoint);
      else r.falhas++;
    });
  }
  if (ok.length) await sql`update push_assinaturas set ultimo_dia = ${hoje} where endpoint = any(${ok})`;
  if (mortos.length) await sql`delete from push_assinaturas where endpoint = any(${mortos})`;
  r.enviados = ok.length;
  r.removidos = mortos.length;
  return r;
}

module.exports = { dataNoFuso, montarMensagem, enviarLancamentos };
