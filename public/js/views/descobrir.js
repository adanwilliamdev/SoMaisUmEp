// Aba Descobrir: radar de afinidade pessoal (só cruza com o seu histórico) e o painel de um título do TMDb.
import { esc } from '../util.js';
import { L } from '../loja.js';
import { jaNaEstante, sementesRadar, frasePorque, rotulosDna, estado } from '../regras.js';
import { UI, capa, ICO_MAIS } from './comum.js';
import { htmlOnde } from './detalhe.js';

/* ---------- descobrir ---------- */
// `d` = { radar }: radar é { dna, resultados }, 'carregando', 'erro' ou null (ainda não há o que cruzar).
const nomeTipo = tipo => (tipo === 'movie' ? 'filmes' : 'séries');

function itemRadar(x, tipo, sementes) {
  const tem = jaNaEstante(L.series, tipo, x);
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
      <div class="radar-acoes">${onde}${tem ? '' : `<button class="btn mini" data-act="desc-add" aria-label="Adicionar ${esc(x.nome)} à estante">${ICO_MAIS} Estante</button>`}${tem ? '' : `<button class="btn sec mini" data-act="desc-dispensar" aria-label="Não tenho interesse em ${esc(x.nome)}">Dispensar</button>`}</div>
    </div></article>`;
}

function blocoDna(dna, sementes, tipo) {
  const rotulos = rotulosDna(dna);
  const marca = s => (s.nota_pessoal != null ? ` (${String(s.nota_pessoal).replace('.', ',')})` : estado(s) === 'assistindo' ? ' (assistindo)' : '');
  const rot = s => esc(s.nome + marca(s));
  const base = sementes.map(rot).join(', ');
  const chips = rotulos.length
    ? `<ul class="dna" aria-label="Padrões nos seus ${nomeTipo(tipo)} favoritos">${rotulos.map(r => `<li><small>${esc(r.rot)}</small> ${esc(r.nome)}${r.n > 1 ? ` <span class="mut-leve">×${esc(r.n)}</span>` : ''}</li>`).join('')}</ul>`
    : `<p class="mut-peq">Ainda não há padrões repetidos entre os seus favoritos. Quanto mais você avalia, mais o radar aprende.</p>`;
  return `<section class="desc-sec" aria-labelledby="t-dna"><h2 class="sec-tit" id="t-dna">Seu DNA em ${nomeTipo(tipo)}</h2>${chips}
    <p class="mut-peq">Baseado no que você está assistindo, concluiu ou avaliou com nota 7 ou mais: ${base}.</p></section>`;
}

function secao(id, titulo, itens, tipo, sementes) {
  return `<section class="desc-sec" aria-labelledby="${id}"><h2 class="sec-tit" id="${id}">${titulo}</h2><div class="radar-lista">${itens.map(x => itemRadar(x, tipo, sementes)).join('')}</div></section>`;
}

export function htmlDescobrir(tipo, d) {
  const sementes = (d && d.sementes) || sementesRadar(L.series, tipo);
  const r = d && d.radar;
  if (r === 'carregando') {
    const aviso = d.procurando ? '<p class="mut-peq" role="status">Procurando no TMDb os títulos que você está assistindo…</p>' : '';
    return `${aviso}<div class="radar-lista" aria-busy="true">${Array.from({ length: 4 }, () => '<div class="radar-item"><div class="sk sk-capa"></div><div class="radar-info"><div class="sk sk-l1"></div><div class="sk sk-l1"></div></div></div>').join('')}</div>`;
  }
  if (r === 'erro') {
    const motivo = d.erro ? ` <small>(${esc(d.erro)})</small>` : '';
    return `<p class="aviso">Não foi possível montar o radar agora.${motivo} <button class="btn sec mini" data-act="desc-recarregar">Tentar de novo</button></p>`;
  }
  if (!r || !sementes.length) {
    const sem = (d && d.semLigacao) || [];
    const dica = sem.length
      ? `<br><small>Não achei no TMDb: ${esc(sem.slice(0, 3).join(', '))}${sem.length > 3 ? '…' : ''}. Abra o título, toque em Editar › Buscar no TMDb e ligue-o para entrar no radar.</small>`
      : '';
    return `<div class="vazio">O radar ainda não tem de onde partir.<br><small>Comece a assistir, conclua ou avalie com nota 7 ou mais ao menos um ${tipo === 'movie' ? 'filme' : 'título'} e as sugestões aparecem aqui, sempre dizendo por quê.</small>${dica}</div>`;
  }
  const nao = new Set((d.dispensados || []).map(String));
  const lista = (r.resultados || []).filter(x => !jaNaEstante(L.series, tipo, x) && !nao.has(String(x.id)));
  const lanc = lista.filter(x => x.novo).slice(0, 6),
    resto = lista.filter(x => !lanc.includes(x));
  const novidades = lanc.length ? secao('t-nov', 'Novidades na sua vibe', lanc, tipo, sementes) : '';
  const demais = resto.length ? secao('t-rad', lanc.length ? 'Também combina com você' : 'Talvez você curta', resto, tipo, sementes) : '';
  const corpo = lista.length
    ? novidades + demais
    : '<section class="desc-sec"><p class="aviso">Nada novo por aqui: tudo o que combina com o seu gosto já está na sua estante ou foi dispensado.</p></section>';
  return `${atualizado(d.quando)}${blocoDna(r.dna, sementes, tipo)}${corpo}`;
}
// "Atualizado há 5 min" + botão para refazer o radar agora.
function atualizado(quando) {
  const min = quando ? Math.max(0, Math.round((Date.now() - quando) / 6e4)) : 0;
  const txt = min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
  return `<p class="desc-quando mut-peq">Atualizado ${txt} <button class="btn sec mini" data-act="desc-recarregar">Atualizar</button></p>`;
}
export function viewDescobrir(d) {
  const tipo = UI.descTipo,
    fs = [
      ['tv', 'Séries'],
      ['movie', 'Filmes'],
    ];
  return `<div class="cabeca"><div><h1>Descobrir</h1><p class="sub">Seu radar: séries e filmes na mesma vibe do que você está assistindo e curtiu, sempre com novidades e com o motivo de cada sugestão.</p></div></div>
    <div class="ferramentas centro"><div class="barra-acoes" role="group" aria-label="Tipo">${fs.map(([k, r]) => `<button class="chip" data-act="desc-tipo" data-k="${k}" aria-pressed="${tipo === k}">${r}</button>`).join('')}</div></div>
    <div id="desc">${htmlDescobrir(tipo, d)}</div>`;
}
export function htmlDescDetalhe(x, tipo, onde) {
  const tem = jaNaEstante(L.series, tipo, x);
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
