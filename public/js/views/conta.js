// Telas de entrada (entrar, criar conta, recuperar senha) e formulários da conta.
import { html, raw } from '../util.js';

// Alterna a visibilidade dos campos de senha do mesmo formulário (telas/conta.js, ação `ver-senha`).
const MOSTRAR = raw('<p class="mostrar-linha"><button type="button" class="link" data-act="ver-senha" aria-pressed="false">Mostrar senha</button></p>');

/* ---------- entrar / criar conta ---------- */
// Um cartão centralizado: logotipo na horizontal no topo e o formulário; a frase de apoio fica abaixo.
const casca = corpo => html`<div class="auth"><div class="auth-form">
    <div class="auth-marca"><span class="auth-logo" aria-hidden="true"></span><p class="auth-nome">Só<b>MaisUm</b><em>Ep</em></p></div>
    ${corpo}</div>
    <p class="auth-frase">Marque cada episódio e saiba sempre qual é o próximo.</p></div>`;

export function viewAuth(modo = 'entrar') {
  const nova = modo === 'criar';
  return casca(html`<h1>${nova ? 'Criar conta' : 'Entrar'}</h1>
    <p class="sub">${nova ? 'Cada pessoa tem a própria estante de séries e filmes.' : 'Entre para acessar sua estante.'}</p>
    <div class="abas" role="group" aria-label="Entrar ou criar conta">
      <button class="chip" data-act="auth-modo" data-m="entrar" aria-pressed="${!nova}" type="button">Entrar</button>
      <button class="chip" data-act="auth-modo" data-m="criar" aria-pressed="${nova}" type="button">Criar conta</button></div>
    <form id="fa" data-modo="${modo}" novalidate>
      ${nova ? raw('<label>Nome<input type="text" name="nome" maxlength="60" autocomplete="name" required></label>') : ''}
      <label>E-mail<input type="text" name="email" inputmode="email" autocapitalize="off" spellcheck="false" autocomplete="${nova ? 'email' : 'username'}" required></label>
      <label>Senha${nova ? ' (mínimo 8 caracteres)' : ''}<input type="password" name="senha" autocomplete="${nova ? 'new-password' : 'current-password'}" required></label>
      ${MOSTRAR}
      <p class="aviso" id="msg" role="alert"></p>
      <button class="btn" type="submit">${nova ? 'Criar conta e entrar' : 'Entrar'}</button>
    </form>
    ${nova ? '' : raw('<p class="auth-rodape"><button type="button" class="link" data-act="auth-modo" data-m="esqueci">Esqueci minha senha</button></p>')}`);
}

export const viewEsqueci = () =>
  casca(html`<h1>Recuperar senha</h1>
    <p class="sub">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
    <form id="fe" novalidate>
      <label>E-mail<input type="text" name="email" inputmode="email" autocapitalize="off" spellcheck="false" autocomplete="username" required></label>
      <p class="aviso" id="msg" role="alert"></p>
      <button class="btn" type="submit">Enviar link</button>
    </form>
    <p class="auth-rodape"><button type="button" class="link" data-act="auth-modo" data-m="entrar">Voltar para entrar</button></p>`);

export const viewRedefinir = () =>
  casca(html`<h1>Nova senha</h1>
    <p class="sub">Escolha uma nova senha para a sua conta. Você será desconectado dos outros aparelhos.</p>
    <form id="fr" novalidate>
      <label>Nova senha (mínimo 8 caracteres)<input type="password" name="senha" autocomplete="new-password" required></label>
      <label>Repita a nova senha<input type="password" name="senha2" autocomplete="new-password" required></label>
      ${MOSTRAR}
      <p class="aviso" id="msg" role="alert"></p>
      <button class="btn" type="submit">Salvar nova senha</button>
    </form>`);

// Formulários da conta (dentro do diálogo "Minha conta"): trocar senha, trocar e-mail, excluir conta.
export function viewFormConta(acao, email = '') {
  const senhaAtual = raw('<label>Senha atual<input type="password" name="atual" autocomplete="current-password" required></label>');
  const campos =
    acao === 'senha'
      ? html`${senhaAtual}<label>Nova senha (mínimo 8 caracteres)<input type="password" name="nova" autocomplete="new-password" required></label>
       <label>Repita a nova senha<input type="password" name="nova2" autocomplete="new-password" required></label>
       <p class="aviso">Os outros aparelhos serão desconectados.</p>`
      : acao === 'email'
        ? html`<label>Novo e-mail<input type="text" name="email" inputmode="email" autocapitalize="off" spellcheck="false" autocomplete="email" value="${email}" required></label>${senhaAtual}`
        : html`<p class="aviso">Isto apaga a sua conta, todas as séries, filmes, tops e capas. <b>Não dá para desfazer.</b> Baixe um backup antes, se quiser guardar seus dados.</p>${senhaAtual}`;
  const titulo = { senha: 'Trocar senha', email: 'Trocar e-mail', excluir: 'Excluir conta' }[acao];
  return html`<h2>${titulo}</h2><form id="fc" data-acao="${acao}" novalidate>${campos}${MOSTRAR}
    <p class="aviso" id="msgc" role="alert"></p>
    <div class="rodape-dlg"><button type="button" class="btn sec" data-act="conta">Voltar</button><button class="btn${acao === 'excluir' ? ' perigo' : ''}" type="submit">${acao === 'excluir' ? 'Excluir minha conta' : 'Salvar'}</button></div></form>`;
}
