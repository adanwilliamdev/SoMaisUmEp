// TMDb: temporadas novas, durações e "onde assistir".
import { tmdb } from './api.js';
import { L, save } from './loja.js';
import { aplicarEps, tp, estado, lancamentoVencido } from './regras.js';
import { guardar, lerJSON } from './util.js';

// Atualiza uma série/filme a partir do TMDb sem perder progresso. Devolve o que mudou.
export async function atualizarDoTmdb(s) {
  if (!s.tmdb) return { erro: 'Este título não está ligado ao TMDb. Use Editar › Buscar no TMDb.' };
  const d = await tmdb({ acao: 'detalhe', tipo: tp(s), id: s.tmdb });
  const antes = estado(s), mudou = [];
  if (tp(s) === 'tv' && d.eps.length && aplicarEps(s, d.eps)) mudou.push('episódios');
  if (!s.duracao && d.duracao) { s.duracao = d.duracao; mudou.push('duração'); }
  if (d.nota != null && d.nota !== s.nota) { s.nota = d.nota; mudou.push('nota'); }
  if (!s.sinopse && d.sinopse) { s.sinopse = d.sinopse; mudou.push('sinopse'); }
  if (!s.capa && d.poster) { s.capa = d.poster; mudou.push('capa'); }
  // Próximo lançamento: atualizado em silêncio (muda toda semana nas séries semanais; avisar a cada vez seria barulho).
  const ant = s.proximo || null, novo = d.proximo || null, mudouProximo = JSON.stringify(ant) !== JSON.stringify(novo);
  if (mudouProximo) s.proximo = novo;
  if (mudou.length || mudouProximo) save();
  return {
    mudou, voltouAssistir: antes === 'fim' && estado(s) === 'assistindo',
    agendou: antes === 'fim' && !ant && !!novo,   // série concluída que ganhou data de volta
  };
}

// Verificação automática: no máximo a cada 24 h por série (6 h quando a data do próximo episódio já chegou), algumas por vez.
const CHAVE = 'claq:upd', DIA = 864e5, HORAS6 = 216e5;
export async function atualizarAutomatico({ max = 4, aoMudar } = {}) {
  if (!navigator.onLine) return;
  const feitos = lerJSON(CHAVE, {}), agora = Date.now();
  const precisa = s => s.tmdb && (agora - (feitos[s.id] || 0) > (lancamentoVencido(s, agora) ? HORAS6 : DIA));
  const fila = L.series.filter(precisa)
    .sort((a, b) => (lancamentoVencido(b, agora) - lancamentoVencido(a, agora))                       // data de lançamento chegou: primeiro
      || (!a.duracao === !b.duracao ? (feitos[a.id] || 0) - (feitos[b.id] || 0) : a.duracao ? 1 : -1))
    .slice(0, max);
  for (const s of fila) {
    try {
      const r = await atualizarDoTmdb(s);
      feitos[s.id] = Date.now(); guardar(CHAVE, feitos);
      if (((r.mudou && r.mudou.length) || r.agendou) && aoMudar) aoMudar(s, r);
    } catch (e) { if (e.auth || e.rede) return; }
  }
}

// Completa a duração de todos os títulos que ainda não têm (para a conta de horas).
export async function completarDuracoes(aoProgresso) {
  const fila = L.series.filter(s => s.tmdb && !s.duracao);
  let ok = 0;
  for (let i = 0; i < fila.length; i++) {
    try { const r = await atualizarDoTmdb(fila[i]); if (r.mudou && r.mudou.includes('duração')) ok++; } catch (e) { if (e.auth || e.rede) break; }
    if (aoProgresso) aoProgresso(i + 1, fila.length);
  }
  return { total: fila.length, ok };
}

const cache = new Map();
export async function ondeAssistir(s) {
  if (!s.tmdb) return null;
  const k = tp(s) + ':' + s.tmdb;
  if (!cache.has(k)) cache.set(k, tmdb({ acao: 'streaming', tipo: tp(s), id: s.tmdb }).catch(e => { cache.delete(k); throw e; }));
  return cache.get(k);
}

/* ---------- descobrir ---------- */
export const emAlta = tipo => tmdb({ acao: 'tendencias', tipo }).then(d => d.resultados);
export const parecidos = (tipo, ids) => tmdb({ acao: 'parecidos', tipo, ids: ids.join(',') }).then(d => d.resultados);
export const detalheTmdb = (tipo, id) => tmdb({ acao: 'detalhe', tipo, id });
