// Tela de estatísticas: conta a sua história como espectador (estilo "Wrapped") e depois traz os números.
import { esc } from '../util.js';
import { L } from '../loja.js';
import { vis, estatisticas, ultimosMeses, duracaoTexto, perfilEspectador } from '../regras.js';

/* ---------- estatísticas ---------- */
export function graficoMeses(meses, compacto = typeof matchMedia === 'function' && matchMedia('(max-width:600px)').matches) {
  // No celular o gráfico usa uma área menor (mesmo tamanho de letra na tela), para caber na largura sem rolagem lateral.
  const max = Math.max(1, ...meses.map(m => m.valor)),
    W = compacto ? 360 : 720,
    H = compacto ? 200 : 220,
    pad = compacto ? 8 : 28,
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
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><line x1="${pad}" x2="${W - pad}" y1="${H - 30}" y2="${H - 30}"/>${barras}</svg>
    <table class="sr"><caption>Episódios e filmes marcados como vistos, por mês, nos últimos 12 meses</caption>
      <thead><tr><th scope="col">Mês</th><th scope="col">Marcados</th></tr></thead>
      <tbody>${meses.map(m => `<tr><th scope="row">${m.rotulo}/${m.ano}</th><td>${m.valor}</td></tr>`).join('')}</tbody></table>`;
}

const num1 = n => String(n).replace('.', ',');
const maiuscula = t => t.charAt(0).toUpperCase() + t.slice(1);

// Cada cartão da história: título pequeno, destaque grande e uma frase. Só aparece o que tem dados.
const cartao = (cls, kicker, destaque, texto) => `<article class="w-card ${cls}"><small>${kicker}</small><b>${destaque}</b><p>${texto}</p></article>`;
const nomeJeito = { rigoroso: 'Crítico rigoroso', equilibrado: 'Olhar equilibrado', generoso: 'Coração generoso' };
const pontos = n => `${num1(n)} ponto${n <= 1 ? '' : 's'}`;

function cartaoTempo(tempo) {
  const dias = tempo.dias === 1 ? 'dia inteiro' : 'dias inteiros';
  const grande = tempo.dias >= 1 ? `${num1(tempo.dias)} ${dias}` : tempo.texto;
  const iguais = tempo.comparacoes.length ? `Dá ${tempo.comparacoes.join(', ou ')}.` : 'É só o começo da sua história.';
  return cartao('w-tempo', 'Tempo dedicado a histórias', grande, `Sem piscar, sem dormir. ${iguais}`);
}

function cartaoMes(mes) {
  const marcados = mes.valor === 1 ? 'episódio ou filme marcado' : 'episódios e filmes marcados';
  const fim = mes.atual ? '. E o mês ainda não acabou.' : '.';
  return cartao('w-mes', 'Seu mês mais ativo', esc(maiuscula(mes.rotulo)), `${mes.valor} ${marcados}${fim}`);
}

function cartaoNota(j) {
  const base = `Média ${num1(j.media)} em ${j.n} ${j.n === 1 ? 'título' : 'títulos'}`;
  if (!j.perfil) {
    const aviso = `${base}. Avalie pelo menos 3 para descobrir que tipo de crítico você é.`;
    return cartao('w-nota', 'Seu jeito de avaliar', `Média ${num1(j.media)}`, aviso);
  }
  const dez = j.dezes === 1 ? 'virou 10' : 'viraram 10';
  const dezes = j.dezes ? ` e ${j.dezes} ${dez}` : '';
  let dif = '';
  if (j.dif != null && Math.abs(j.dif) < 0.3) dif = ' Você anda alinhado com a nota média do TMDb.';
  else if (j.dif != null) dif = ` Você dá, em média, ${pontos(Math.abs(j.dif))} ${j.dif > 0 ? 'a mais' : 'a menos'} que o TMDb.`;
  return cartao('w-nota', 'Seu jeito de avaliar', nomeJeito[j.perfil], `${base}: ${j.pctAltas}% das notas são 8 ou mais${dezes}.${dif}`);
}

function cartaoCampeao(c) {
  const tempo = `${duracaoTexto(c.minutos)} da sua vida, e valeu cada minuto.`;
  return cartao('w-campeao', 'Onde você mais investiu tempo', esc(c.nome), tempo);
}

export function historiaEspectador(series) {
  const { mesAtivo, jeito, tempo, campeao } = perfilEspectador(series);
  const dica = 'Dê notas aos títulos que você viu para descobrir se é um crítico rigoroso ou de coração generoso.';
  const out = [];
  if (tempo) out.push(cartaoTempo(tempo));
  if (mesAtivo) out.push(cartaoMes(mesAtivo));
  out.push(jeito ? cartaoNota(jeito) : cartao('w-nota', 'Seu jeito de avaliar', 'Ainda sem notas', dica));
  if (campeao) out.push(cartaoCampeao(campeao));
  return `<section class="wrapped" aria-label="Sua história como espectador">${out.join('')}</section>`;
}

export function viewStats() {
  const r = estatisticas(L.series),
    meses = ultimosMeses(r.porMes, 12),
    totalAno = meses.reduce((a, m) => a + m.valor, 0);
  const cards = [
    [r.episodios, 'episódios vistos'],
    [r.filmes, 'filmes assistidos'],
    [r.concluidas, 'séries concluídas'],
    [r.notaMedia == null ? '—' : num1(r.notaMedia), `nota média (${r.nNotas} ${r.nNotas === 1 ? 'título' : 'títulos'})`],
  ];
  const faltam = L.series.filter(s => s.tmdb && !s.duracao && vis(s) > 0).length;
  return `<div class="cabeca"><div><h1>Estatísticas</h1><p class="sub">A sua história como espectador.</p></div></div>
    ${historiaEspectador(L.series)}
    <h2 class="sec-tit">Em números</h2>
    <div class="stats numeros">${cards.map(([n, t]) => `<div class="stat"><b>${n}</b><span>${t}</span></div>`).join('')}</div>
    ${r.semDuracao ? `<p class="aviso">${r.semDuracao} ${r.semDuracao === 1 ? 'título' : 'títulos'} sem duração informada não entram na conta de tempo. ${faltam ? `<button class="btn sec mini" data-act="completar-duracoes">Completar pelo TMDb</button>` : 'Edite o título ou ligue-o ao TMDb para completar.'}</p>` : ''}
    <h2 class="sec-tit">Por mês <small class="mut-leve">· ${totalAno} nos últimos 12 meses</small></h2>
    <div class="graf-caixa">${graficoMeses(meses)}</div>
    <p class="aviso">O gráfico conta episódios e filmes marcados a partir desta versão do app; o que você já tinha marcado antes não tem data.</p>`;
}
