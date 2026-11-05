// Painel de detalhes de um título (temporadas, onde assistir, avaliação).
import { esc, hue } from '../util.js';
import { tp, tot, vis, pct, rotulo, lancamento } from '../regras.js';
import { capa } from './comum.js';

/* ---------- detalhe ---------- */
export function htmlOnde(d) {
  if (d === 'carregando') return '<p class="aviso">Procurando onde assistir…</p>';
  if (d === 'erro') return '<p class="aviso">Não foi possível consultar os serviços de streaming agora.</p>';
  if (!d) return '<p class="aviso">Ligue este título ao TMDb (Editar › Buscar no TMDb) para ver onde assistir.</p>';
  const grupo = (rot, a) =>
    a && a.length
      ? `<div class="prov"><span>${rot}</span>${a.map(p => `<span class="prov-i" title="${esc(p.nome)}">${p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy" width="28" height="28">` : ''}${esc(p.nome)}</span>`).join('')}</div>`
      : '';
  const g = grupo('Assinatura', d.assinatura) + grupo('Grátis', d.gratis) + grupo('Alugar', d.alugar) + grupo('Comprar', d.comprar);
  return g
    ? `${g}<p class="aviso">Disponibilidade no Brasil. Dados: JustWatch via TMDb.${d.link ? ` <a href="${esc(d.link)}" target="_blank" rel="noopener noreferrer">Ver detalhes</a>` : ''}</p>`
    : '<p class="aviso">Não consta em nenhum serviço de streaming no Brasil agora.</p>';
}

export function htmlDetalhe(s, onde) {
  const p = pct(s),
    mv = tp(s) === 'movie';
  const temps = mv
    ? `<div class="temp"><button class="btn${vis(s) ? ' sec' : ''}" data-act="visto">${vis(s) ? 'Desmarcar como visto' : 'Marcar como visto'}</button></div>`
    : s.eps
        .map((n, i) => {
          let c = '';
          for (let e = 1; e <= n; e++)
            c += `<button class="ep" data-act="ep" data-s="${i}" data-e="${e}" aria-pressed="${s.vis[i] >= e}" aria-label="Temporada ${i + 1}, episódio ${e}">${e}</button>`;
          return `<div class="temp"><div class="temp-cab"><b>Temporada ${i + 1} <span class="mut-leve">· ${s.vis[i]}/${n}</span></b>
      <button class="btn sec mini" data-act="temp-tudo" data-s="${i}" aria-label="Marcar toda a temporada ${i + 1}">Marcar toda</button>
      <button class="btn sec mini" data-act="temp-zero" data-s="${i}" aria-label="Zerar temporada ${i + 1}">Zerar</button></div><div class="eps">${c}</div></div>`;
        })
        .join('');
  const urlHero = s.capa && /^https:\/\/[\w./:+=%?&,~@-]+$/.test(s.capa);
  const l = lancamento(s),
    pilulas = [
      mv ? 'Filme' : 'Série',
      s.ano,
      s.nota ? '★ ' + s.nota : '',
      s.duracao ? s.duracao + (mv ? ' min' : ' min/ep') : '',
      l ? `${l.texto}${l.t && l.e ? ` · T${l.t} E${l.e}` : ''}` : '',
    ]
      .filter(Boolean)
      .map(x => `<span class="pilula">${esc(x)}</span>`)
      .join('');
  return `<div data-id="${esc(s.id)}">
    <div class="hero" ${urlHero ? `data-cover="${esc(s.capa)}"` : `data-h="${hue(s.nome)}"`}></div>
    <div class="cab"><div class="mini-capa">${capa(s.nome, s.capa, true)}</div>
      <div class="cab-info"><h2>${esc(s.nome)}</h2><div class="pilulas">${pilulas}</div><div class="barra"><i data-w="${p}"></i></div>
      <small>${mv ? rotulo(s) : vis(s) + ' de ' + tot(s) + ' episódios · ' + rotulo(s)}</small></div></div>
    ${s.sinopse ? `<p class="sin">${esc(s.sinopse)}</p>` : ''}
    ${temps}
    <section class="bloco"><h3>Onde assistir</h3><div id="onde">${htmlOnde(onde)}</div></section>
    <section class="bloco"><h3>Minha avaliação</h3>
      <label>Minha nota (0 a 10)<input type="number" id="mnota" min="0" max="10" step="0.5" inputmode="decimal" value="${s.nota_pessoal == null ? '' : s.nota_pessoal}" placeholder="Sem nota"></label>
      <label>Resenha<textarea id="mres" maxlength="4000" rows="3" placeholder="O que você achou?">${esc(s.resenha || '')}</textarea></label>
    </section>
    <div class="rodape-dlg">
      <button class="btn sec perigo mini" data-act="del">Excluir ${mv ? 'filme' : 'série'}</button>
      ${s.tmdb ? `<button class="btn sec" data-act="atualizar-tmdb">Atualizar do TMDb</button>` : ''}
      <button class="btn sec" data-act="editar">Editar</button>
      <button class="btn" data-act="fechar">Fechar</button></div></div>`;
}
