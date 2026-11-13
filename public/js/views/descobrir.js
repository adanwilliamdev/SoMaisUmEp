// Aba Descobrir: radar de afinidade pessoal (só cruza com o seu histórico) e o painel de um título do TMDb.
import { esc } from '../util.js';
import { L } from '../loja.js';
import { naEstante, sementesRadar, frasePorque, rotulosDna } from '../regras.js';
import { UI, capa, ICO_MAIS } from './comum.js';
import { htmlOnde } from './detalhe.js';

/* ---------- descobrir ---------- */
// `d` = { radar }: radar é { dna, resultados }, 'carregando', 'erro' ou null (ainda não há o que cruzar).
const nomeTipo = tipo => (tipo === 'movie' ? 'filmes' : 'séries');

function itemRadar(x, tipo, sementes) {
  const tem = naEstante(L.series, tipo, x.id);
  // Um motivo por semente; a frase usa o que você realmente fez com aquele título (concluiu, nota).
  const frases = [];
  for (const m of x.porque || []) {
    const f = frasePorque(
      m,
      sementes.find(s => s.tmdb === m.seed),
    );
    if (f && frases.length < 2) frases.push(f);
  }
  const servicos = (x.onde || []).join(' · ');
  const onde = servicos ? `<span class="onde-selo" title="Onde assistir no Brasil">▶ ${esc(servicos)}</span>` : '';
  return `<article class="radar-item" data-tid="${esc(x.id)}">
    <button class="capa" data-act="desc-abrir" aria-label="Ver ${esc(x.nome)}">${capa(x.nome, x.poster)}${tem ? '<span class="sel ok">Na estante</span>' : ''}</button>
    <div class="radar-info">
      <h3>${esc(x.nome)}</h3>
      <small>${esc([x.ano, x.nota ? '★ ' + x.nota + ' no TMDb' : ''].filter(Boolean).join(' · '))}</small>
      ${frases.map(f => `<p class="porque">${esc(f)}</p>`).join('')}
      <div class="radar-acoes">${onde}${tem ? '' : `<button class="btn mini" data-act="desc-add" aria-label="Adicionar ${esc(x.nome)} à estante">${ICO_MAIS} Estante</button>`}</div>
    </div></article>`;
}

function blocoDna(dna, sementes, tipo) {
  const rotulos = rotulosDna(dna);
  const rot = s => esc(s.nome + (s.nota_pessoal != null ? ` (${String(s.nota_pessoal).replace('.', ',')})` : ''));
  const base = sementes.map(rot).join(', ');
  const chips = rotulos.length
    ? `<ul class="dna" aria-label="Padrões nos seus ${nomeTipo(tipo)} favoritos">${rotulos.map(r => `<li><small>${esc(r.rot)}</small> ${esc(r.nome)}${r.n > 1 ? ` <span class="mut-leve">×${esc(r.n)}</span>` : ''}</li>`).join('')}</ul>`
    : `<p class="mut-peq">Ainda não há padrões repetidos entre os seus favoritos. Quanto mais você avalia, mais o radar aprende.</p>`;
  return `<section class="desc-sec" aria-labelledby="t-dna"><h2 class="sec-tit" id="t-dna">Seu DNA em ${nomeTipo(tipo)}</h2>${chips}
    <p class="mut-peq">Baseado no que você concluiu ou avaliou com nota 7 ou mais: ${base}.</p></section>`;
}

export function htmlDescobrir(tipo, d) {
  const sementes = sementesRadar(L.series, tipo);
  const r = d && d.radar;
  if (!r || !sementes.length) {
    return `<div class="vazio">O radar ainda não tem de onde partir.<br><small>Conclua ou avalie com nota 7 ou mais ao menos um ${tipo === 'movie' ? 'filme' : 'título'} ligado ao TMDb e as sugestões aparecem aqui, sempre dizendo por quê.</small></div>`;
  }
  if (r === 'carregando') {
    return `<div class="radar-lista" aria-busy="true">${Array.from({ length: 4 }, () => '<div class="radar-item"><div class="sk sk-capa"></div><div class="radar-info"><div class="sk sk-l1"></div><div class="sk sk-l1"></div></div></div>').join('')}</div>`;
  }
  if (r === 'erro') {
    return '<p class="aviso">Não foi possível montar o radar agora. <button class="btn sec mini" data-act="desc-recarregar">Tentar de novo</button></p>';
  }
  const lista = (r.resultados || []).filter(x => !naEstante(L.series, tipo, x.id));
  const corpo = lista.length
    ? `<div class="radar-lista">${lista.map(x => itemRadar(x, tipo, sementes)).join('')}</div>`
    : '<p class="aviso">Nada novo por aqui: tudo o que combina com o seu gosto já está na sua estante.</p>';
  return `${blocoDna(r.dna, sementes, tipo)}<section class="desc-sec" aria-labelledby="t-rad"><h2 class="sec-tit" id="t-rad">Talvez você curta</h2>${corpo}</section>`;
}
export function viewDescobrir(d) {
  const tipo = UI.descTipo,
    fs = [
      ['tv', 'Séries'],
      ['movie', 'Filmes'],
    ];
  return `<div class="cabeca"><div><h1>Descobrir</h1><p class="sub">Seu radar de afinidade: sugestões tiradas só do que você já viu e avaliou, com o motivo de cada uma.</p></div></div>
    <div class="ferramentas centro"><div class="barra-acoes" role="group" aria-label="Tipo">${fs.map(([k, r]) => `<button class="chip" data-act="desc-tipo" data-k="${k}" aria-pressed="${tipo === k}">${r}</button>`).join('')}</div></div>
    <div id="desc">${htmlDescobrir(tipo, d)}</div>`;
}
export function htmlDescDetalhe(x, tipo, onde) {
  const tem = naEstante(L.series, tipo, x.id);
  const pilulas = [tipo === 'movie' ? 'Filme' : 'Série', x.ano, x.nota ? '★ ' + x.nota : '']
    .filter(Boolean)
    .map(p => `<span class="pilula">${esc(p)}</span>`)
    .join('');
  return `<div data-tid="${esc(x.id)}"><div class="cab"><div class="mini-capa">${capa(x.nome, x.poster, true)}</div>
    <div class="cab-info"><h2>${esc(x.nome)}</h2><div class="pilulas">${pilulas}</div></div></div>
    ${x.sinopse ? `<p class="sin">${esc(x.sinopse)}${x.sinopse.length >= 300 ? '…' : ''}</p>` : ''}
    <section class="bloco"><h3>Onde assistir</h3><div id="onde">${htmlOnde(onde)}</div></section>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Fechar</button>${tem ? '<span class="sel ok est">Na sua estante</span>' : '<button class="btn" data-act="desc-add">+ Adicionar à estante</button>'}</div></div>`;
}
