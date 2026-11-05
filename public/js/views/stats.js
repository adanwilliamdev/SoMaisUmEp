// Tela de estatísticas.
import { L } from '../loja.js';
import { vis, estatisticas, ultimosMeses, duracaoTexto } from '../regras.js';

/* ---------- estatísticas ---------- */
export function graficoMeses(meses) {
  const max = Math.max(1, ...meses.map(m => m.valor)),
    W = 720,
    H = 220,
    pad = 28,
    bw = (W - pad * 2) / meses.length;
  const barras = meses
    .map((m, i) => {
      const h = Math.round(((H - 56) * m.valor) / max),
        x = pad + i * bw + bw * 0.16,
        w = bw * 0.68,
        y = H - 30 - h;
      return `<g><rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, m.valor ? 3 : 1)}" rx="4" class="${m.valor ? '' : 'vz'}"><title>${m.rotulo}/${m.ano}: ${m.valor}</title></rect>
      ${m.valor ? `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" class="v">${m.valor}</text>` : ''}
      <text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${m.rotulo}</text></g>`;
    })
    .join('');
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Episódios e filmes marcados como vistos, por mês, nos últimos 12 meses"><line x1="${pad}" x2="${W - pad}" y1="${H - 30}" y2="${H - 30}"/>${barras}</svg>`;
}

export function viewStats() {
  const r = estatisticas(L.series),
    meses = ultimosMeses(r.porMes, 12),
    totalAno = meses.reduce((a, m) => a + m.valor, 0);
  const cards = [
    [r.minutos ? duracaoTexto(r.minutos) : '—', 'tempo assistido'],
    [r.episodios, 'episódios vistos'],
    [r.filmes, 'filmes assistidos'],
    [r.concluidas, 'séries concluídas'],
    [r.notaMedia == null ? '—' : r.notaMedia, `nota média (${r.nNotas} ${r.nNotas === 1 ? 'título' : 'títulos'})`],
  ];
  const faltam = L.series.filter(s => s.tmdb && !s.duracao && vis(s) > 0).length;
  return `<div class="cabeca"><div><h1>Estatísticas</h1><p class="sub">Seu histórico de séries e filmes.</p></div></div>
    <div class="stats grande">${cards.map(([n, t]) => `<div class="stat"><b>${n}</b><span>${t}</span></div>`).join('')}</div>
    ${r.semDuracao ? `<p class="aviso">${r.semDuracao} ${r.semDuracao === 1 ? 'título' : 'títulos'} sem duração informada não entram na conta de tempo. ${faltam ? `<button class="btn sec mini" data-act="completar-duracoes">Completar pelo TMDb</button>` : 'Edite o título ou ligue-o ao TMDb para completar.'}</p>` : ''}
    <h2 class="sec-tit">Por mês <small class="mut-leve">· ${totalAno} nos últimos 12 meses</small></h2>
    <div class="graf-caixa">${graficoMeses(meses)}</div>
    <p class="aviso">O gráfico conta episódios e filmes marcados a partir desta versão do app; o que você já tinha marcado antes não tem data.</p>`;
}
