// Painel de compartilhamento de um top (imagem e link público).
import { html } from '../util.js';

/* ---------- compartilhar top ---------- */
export function htmlCompartilhar(t, codigo, url = '') {
  return html`<div data-top="${t.id}">
    <h2>Compartilhar “${t.nome}”</h2>
    <section class="bloco">
      <h3>Imagem</h3>
      <p class="sub topo6">Pronta para postar em stories e no feed.</p>
      <div class="share-prev" id="share-prev" aria-busy="true"><span class="aviso">Montando a imagem…</span></div>
      <div class="rodape-dlg esq"><button class="btn" data-act="img-enviar" disabled>Compartilhar imagem</button></div>
    </section>
    <section class="bloco">
      <h3>Link público</h3>
      ${codigo
        ? html`<p class="sub topo6">Qualquer pessoa com o link vê o nome do top, os títulos e o seu primeiro nome. Você pode desligar quando quiser.</p>
            <div class="linha-busca">
              <input type="text" id="share-url" readonly aria-label="Link público" value="${url}" /><button class="btn mini" data-act="link-copiar">
                Copiar
              </button>
            </div>
            <div class="rodape-dlg esq"><button class="btn sec perigo" data-act="link-desligar">Parar de compartilhar</button></div>`
        : html`<p class="sub topo6">
              Crie um link para mostrar este top a quem não tem o app. Qualquer pessoa com o link vê o nome do top, os títulos e o seu primeiro nome.
            </p>
            <div class="rodape-dlg esq"><button class="btn sec" data-act="link-criar">Criar link público</button></div>`}
      <p class="aviso" id="share-msg" role="status"></p>
    </section>
    <div class="rodape-dlg"><button class="btn" data-act="fechar">Fechar</button></div>
  </div>`;
}
