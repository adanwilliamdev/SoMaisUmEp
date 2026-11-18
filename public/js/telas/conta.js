// Entrar, criar conta, recuperar/redefinir senha, "Minha conta" (trocar senha/e-mail, excluir) e sair.
import { $, html, raw, aviso, confirma } from '../util.js';
import { api } from '../api.js';
import { L, limparSnap, zerar, pendente } from '../loja.js';
import * as V from '../views.js';
import { app, dlg, ctx, gancho, limparOnde } from './ctx.js';
import { limparDescobrir } from './descobrir.js';
import { blocoPush, pintaPush, sairPush } from './notificacoes.js';

// Link de redefinição de senha do e-mail: "/#redefinir=<token>". O token sai da barra de endereço na hora.
let tokenReset = null;
{
  const m = /^#redefinir=([a-f0-9]{64})$/.exec(location.hash);
  if (m) {
    tokenReset = m[1];
    history.replaceState(null, '', location.pathname + location.search);
  }
}
export const temTokenReset = () => !!tokenReset;

export function telaAuth(modo = 'entrar') {
  ctx.logado = false;
  document.body.classList.add('deslogado');
  if (dlg.open) dlg.close();
  app.classList.remove('entra');
  app.innerHTML = modo === 'esqueci' ? V.viewEsqueci() : modo === 'redefinir' ? V.viewRedefinir() : V.viewAuth(modo);
  const campo = { criar: () => $('#fa').nome, redefinir: () => $('#fr').senha, esqueci: () => $('#fe').email }[modo] || (() => $('#fa').email);
  campo().focus();
}

async function enviarEsqueci(f) {
  const m = $('#msg'),
    btn = f.querySelector('[type=submit]');
  m.textContent = '';
  btn.disabled = true;
  try {
    await api('/api/esqueci', { method: 'POST', body: { email: f.email.value } });
    f.innerHTML = raw('<p class="aviso">Se esse e-mail tiver uma conta, o link já está a caminho (olhe também o spam). Ele vale por 1 hora.</p>');
  } catch (e) {
    m.textContent = e.message;
    btn.disabled = false;
  }
}

async function enviarRedefinir(f) {
  const m = $('#msg'),
    btn = f.querySelector('[type=submit]');
  m.textContent = '';
  if (f.senha.value !== f.senha2.value) {
    m.textContent = 'As senhas não são iguais.';
    return;
  }
  btn.disabled = true;
  try {
    await api('/api/redefinir', { method: 'POST', body: { token: tokenReset, senha: f.senha.value } });
    tokenReset = null;
    telaAuth('entrar');
    aviso('Senha alterada! Entre com a nova senha.');
  } catch (e) {
    m.textContent = e.message;
    btn.disabled = false;
  }
}

async function enviarAuth(f) {
  const m = $('#msg'),
    criar = f.dataset.modo === 'criar',
    btn = f.querySelector('[type=submit]');
  m.textContent = '';
  btn.disabled = true;
  try {
    await api(criar ? '/api/cadastro' : '/api/login', { method: 'POST', body: { nome: f.nome && f.nome.value, email: f.email.value, senha: f.senha.value } });
    gancho.iniciar();
  } catch (e) {
    m.textContent = e.message;
    btn.disabled = false;
  }
}

// Apaga tudo o que é da sessão atual (dados, cópia local e caches de tela).
function esquecerSessao() {
  limparSnap();
  zerar();
  limparOnde();
  limparDescobrir();
}

async function sair(todos = false) {
  if (pendente() && !confirm('Há alterações que ainda não foram enviadas. Sair mesmo assim?')) return;
  await sairPush(); // antes de encerrar a sessão (o servidor só aceita cancelar com login)
  try {
    await api('/api/logout', { method: 'POST', body: { todos } });
  } catch {
    if (todos) {
      aviso('Sem conexão: não foi possível encerrar as sessões agora.');
      return;
    }
  }
  esquecerSessao();
  telaAuth('entrar');
}

function conta() {
  ctx.aberta = null;
  dlg.innerHTML = html`<h2>Minha conta</h2>
    <p class="sub topo6"><b>${L.usuario.nome}</b><br />${L.usuario.email}</p>
    ${blocoPush()}
    <p class="aviso">“Sair de todos os dispositivos” encerra a sessão deste e de todos os outros aparelhos onde você entrou.</p>
    <div class="rodape-dlg esq">
      <button class="btn sec" data-act="conta-senha">Trocar senha</button><button class="btn sec" data-act="conta-email">Trocar e-mail</button
      ><button class="btn sec perigo" data-act="conta-excluir">Excluir conta</button>
    </div>
    <div class="rodape-dlg">
      <button class="btn sec perigo" data-act="sair-todos">Sair de todos os dispositivos</button><button class="btn sec" data-act="sair">Sair</button
      ><button class="btn" data-act="fechar">Fechar</button>
    </div>`;
  if (!dlg.open) dlg.showModal();
  pintaPush();
}

function formConta(acao) {
  dlg.innerHTML = V.viewFormConta(acao, L.usuario.email);
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('input').focus();
}

async function enviarConta(f) {
  const m = $('#msgc'),
    btn = f.querySelector('[type=submit]'),
    acao = f.dataset.acao;
  m.textContent = '';
  if (acao === 'senha' && f.nova.value !== f.nova2.value) {
    m.textContent = 'As senhas novas não são iguais.';
    return;
  }
  if (acao === 'excluir' && !confirm('Excluir a conta definitivamente? Isso não pode ser desfeito.')) return;
  btn.disabled = true;
  const body = { acao, senha: f.atual.value, ...(acao === 'senha' ? { nova: f.nova.value } : acao === 'email' ? { email: f.email.value } : {}) };
  try {
    const r = await api('/api/conta', { method: 'POST', body });
    if (acao === 'excluir') {
      dlg.close();
      esquecerSessao();
      telaAuth('criar');
      aviso('Conta excluída.');
    } else if (acao === 'email') {
      L.usuario.email = r.email;
      aviso('E-mail alterado.');
      conta();
    } else {
      aviso('Senha alterada. Os outros aparelhos foram desconectados.');
      conta();
    }
  } catch (e) {
    m.textContent = e.message;
    btn.disabled = false;
  }
}

// Formulários desta tela, pelo id: { id do form: função que o envia }.
export const formularios = { fa: enviarAuth, fe: enviarEsqueci, fr: enviarRedefinir, fc: enviarConta };

export const acoes = {
  'auth-modo': ({ b }) => telaAuth(b.dataset.m),
  sair: () => sair(false),
  'sair-todos': ({ b }) => confirma(b, () => sair(true)),
  conta,
  'conta-senha': () => formConta('senha'),
  'conta-email': () => formConta('email'),
  'conta-excluir': () => formConta('excluir'),
};
