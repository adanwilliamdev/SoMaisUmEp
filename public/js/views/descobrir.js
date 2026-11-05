// Aba Descobrir (em alta e parecidos) e o painel de um título do TMDb.
import { esc } from '../util.js';
import { L } from '../loja.js';
import { tp, naEstante, sementes } from '../regras.js';
import { UI, capa, ICO_MAIS } from './comum.js';
import { htmlOnde } from './detalhe.js';

/* ---------- descobrir ---------- */
// `d` = { alta, parecidos } (cada um: lista, 'carregando', 'erro' ou null quando não se aplica).
function cardDescobrir(x, tipo, porque = '') {
  const tem = naEstante(L.series, tipo, x.id);
  return `<article class="card desc" data-tid="${esc(x.id)}">
    <div class="poster"><button class="capa" data-act="desc-abrir" aria-label="Ver ${esc(x.nome)}">${capa(x.nome, x.poster)}${tem ? '<span class="sel ok">Na estante</span>' : ''}${x.nota ? `<span class="sel dir" title="Nota no TMDb">★ ${x.nota}</span>` : ''}</button>
      ${tem ? '' : `<button class="mais mais-add" data-act="desc-add" aria-label="Adicionar ${esc(x.nome)} à estante" title="Adicionar à estante">${ICO_MAIS}</button>`}</div>
    <h3>${esc(x.nome)}</h3><small>${esc(x.ano || '')}${porque ? (x.ano ? ' · ' : '') + esc(porque) : ''}</small></article>`;
}
function blocoDescobrir(titulo, id, d, tipo, porque) {
  const corpo =
    d === 'carregando'
      ? `<div class="grade">${Array.from({ length: 6 }, () => '<div><div class="sk sk-capa"></div><div class="sk sk-l1"></div></div>').join('')}</div>`
      : d === 'erro'
        ? '<p class="aviso">Não foi possível buscar no TMDb agora. <button class="btn sec mini" data-act="desc-recarregar">Tentar de novo</button></p>'
        : !d.length
          ? '<p class="aviso">Nada novo por aqui: tudo o que o TMDb indicou já está na sua estante.</p>'
          : `<div class="grade">${d.map((x, i) => cardDescobrir(x, tipo, porque ? porque(x) : '')).join('')}</div>`;
  return `<section class="desc-sec" aria-labelledby="${id}"><h2 class="sec-tit" id="${id}">${titulo}</h2>${corpo}</section>`;
}
export function htmlDescobrir(tipo, d) {
  const nomeDe = id => (L.series.find(s => tp(s) === tipo && s.tmdb === id) || {}).nome;
  const semente = sementes(L.series, tipo).length;
  const par =
    d.parecidos === null
      ? ''
      : blocoDescobrir(
          'Parecidos com o que você viu',
          't-par',
          Array.isArray(d.parecidos) ? d.parecidos.filter(x => !naEstante(L.series, tipo, x.id)) : d.parecidos,
          tipo,
          x => {
            const n = (x.porque || []).map(nomeDe).find(Boolean);
            return n ? 'como ' + n : '';
          },
        );
  const alta = blocoDescobrir('Em alta esta semana', 't-alta', d.alta, tipo, null);
  const dica = !semente
    ? `<p class="aviso">Marque alguns episódios ou filmes ligados ao TMDb e aparece aqui uma lista “parecidos com o que você viu”.</p>`
    : '';
  return par + (par ? '' : dica) + alta;
}
export function viewDescobrir(d) {
  const tipo = UI.descTipo,
    fs = [
      ['tv', 'Séries'],
      ['movie', 'Filmes'],
    ];
  return `<div class="cabeca"><div><h1>Descobrir</h1><p class="sub">O que está em alta e o que combina com o seu gosto. Toque no + para adicionar à estante.</p></div></div>
    <div class="ferramentas"><div class="barra-acoes" role="group" aria-label="Tipo">${fs.map(([k, r]) => `<button class="chip" data-act="desc-tipo" data-k="${k}" aria-pressed="${tipo === k}">${r}</button>`).join('')}</div></div>
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
