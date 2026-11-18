// Painel de importação (Letterboxd, IMDb, Trakt).
import { html, raw } from '../util.js';

/* ---------- importar ---------- */
export function htmlImportar(fase = {}) {
  if (fase.previa) {
    const r = fase.previa,
      linha = (n, t) => (n ? html`<li><b>${n}</b> ${t}</li>` : '');
    return html`<h2>Importar</h2>
      <p class="sub topo6">Encontrei em ${fase.fontes.join(', ')}:</p>
      <ul class="imp-lista">
        ${linha(r.filmesVistos, r.filmesVistos === 1 ? 'filme assistido' : 'filmes assistidos')}${linha(
          r.filmesFila,
          r.filmesFila === 1 ? 'filme na lista para ver' : 'filmes na lista para ver',
        )}${linha(r.series, r.series === 1 ? 'série' : 'séries')}${linha(r.episodios, r.episodios === 1 ? 'episódio visto' : 'episódios vistos')}
      </ul>
      ${r.seriesSemProgresso
        ? html`<p class="aviso">
            ${r.seriesSemProgresso} ${r.seriesSemProgresso === 1 ? 'série vem' : 'séries vêm'} sem progresso: esse arquivo não informa os episódios vistos. Você
            marca o que já viu depois.
          </p>`
        : ''}
      <p class="aviso">Títulos que já estão na sua estante não são duplicados. As capas, durações e temporadas vêm do TMDb, então pode levar um tempinho.</p>
      <div class="rodape-dlg">
        <button class="btn sec" data-act="fechar">Cancelar</button><button class="btn" data-act="importar-iniciar">Importar tudo</button>
      </div>`;
  }
  if (fase.andamento)
    return html`<h2>Importando…</h2>
      <div class="barra imp-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${fase.andamento.pct}">
        <i data-w="${fase.andamento.pct}"></i>
      </div>
      <p class="sub topo6" id="imp-txt" role="status">${fase.andamento.texto}</p>
      <div class="rodape-dlg"><button class="btn sec" data-act="importar-parar">Parar</button></div>`;
  if (fase.fim) {
    const f = fase.fim;
    return html`<h2>${f.parou ? 'Importação interrompida' : 'Importação concluída'}</h2>
      <ul class="imp-lista">
        ${f.novos
          ? html`<li><b>${f.novos}</b> ${f.novos === 1 ? 'título adicionado' : 'títulos adicionados'}</li>`
          : raw('<li>Nenhum título novo.</li>')}${f.repetidos ? html`<li><b>${f.repetidos}</b> já estavam na estante</li>` : ''}${f.naoAchou.length
          ? html`<li><b>${f.naoAchou.length}</b> não encontrados no TMDb</li>`
          : ''}
      </ul>
      ${f.naoAchou.length
        ? html`<details class="colar">
            <summary>Ver os não encontrados</summary>
            <p class="mut-peq">
              ${f.naoAchou.slice(0, 40).map((nome, i) => html`${i ? raw('<br>') : ''}${nome}`)}${f.naoAchou.length > 40
                ? html`<br />… e mais ${f.naoAchou.length - 40}`
                : ''}
            </p>
          </details>`
        : ''}
      <div class="rodape-dlg"><button class="btn" data-act="fechar">Fechar</button></div>`;
  }
  return html`<h2>Importar de outro app</h2>
    <p class="sub topo6">Traga sua lista de quem você já usa. Escolha o arquivo exportado (pode escolher vários de uma vez):</p>
    <ul class="imp-passos">
      <li><b>Letterboxd</b> (filmes): Settings › Data › Export your data. Envie o .zip inteiro, ou os CSV (watched, ratings, watchlist).</li>
      <li><b>IMDb</b>: na sua lista de avaliações ou na watchlist, menu ⋯ › Export. Envie o .csv.</li>
      <li><b>Trakt</b>: envie os arquivos .json do export (assistidos, avaliações, watchlist).</li>
      <li><b>Backup do SóMaisUmEp</b>: envie o arquivo .json baixado em Backup; ele é restaurado direto.</li>
    </ul>
    <p class="aviso" id="imp-msg" role="alert"></p>
    <div class="rodape-dlg esq">
      <label class="btn arq"
        >Escolher arquivos…<input type="file" id="imparq" accept=".zip,.csv,.json,application/zip,application/json,text/csv" multiple class="sr-input"
      /></label>
    </div>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Cancelar</button></div>`;
}
