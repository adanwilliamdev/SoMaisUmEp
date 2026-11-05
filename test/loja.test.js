// Testes de public/js/loja.js: fila de envio, nova tentativa, conflito entre aparelhos e a cópia local (reaplicar).
// O servidor é falso (um Map por tipo, com a mesma regra de versão do api/sync.js); o relógio também (mock.timers).
globalThis.localStorage = (() => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
})();
const barraStatus = { textContent: '', style: {} };
globalThis.document = { querySelector: sel => (sel === '#status' ? barraStatus : null), querySelectorAll: () => [] };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const USUARIO = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com' };
let contador = 0;
let relogioAtivo = null;

/* ---------- servidor falso ---------- */
function criarServidor() {
  const srv = { t: new Map(), p: new Map(), relogio: 100, chamadas: 0, posts: [], falhas: 0, status: 0, usuario: USUARIO };
  const resp = (status, j) => ({ status, ok: status < 400, json: async () => j });
  srv.semear = (...series) => series.forEach(s => srv.t.set(s.id, { ...s, atualizado: ++srv.relogio }));
  srv.semearTop = (...tops) => tops.forEach(p => srv.p.set(p.id, { ...p, atualizado: ++srv.relogio }));
  srv.editar = (id, mudanca) => srv.t.set(id, { ...srv.t.get(id), ...mudanca, atualizado: ++srv.relogio });
  srv.editarTop = (id, mudanca) => srv.p.set(id, { ...srv.p.get(id), ...mudanca, atualizado: ++srv.relogio });
  srv.apagar = id => srv.t.delete(id);
  srv.versao = id => srv.t.get(id).atualizado;
  const lista = m => [...m.values()].sort((a, b) => b.criado - a.criado);

  globalThis.fetch = async (url, opt = {}) => {
    srv.chamadas++;
    if (srv.falhas > 0) {
      srv.falhas--;
      throw new TypeError('fetch failed');
    }
    if (srv.status) return resp(srv.status, { erro: 'erro de teste' });
    const caminho = new URL(url, 'http://x').pathname;
    if (caminho === '/api/dados') return resp(200, { usuario: srv.usuario, blob: false, series: lista(srv.t), tops: lista(srv.p), links: {} });
    if (caminho === '/api/sync') {
      const corpo = JSON.parse(opt.body);
      srv.posts.push(corpo);
      const versoes = {},
        conflitos = [];
      for (const [tipo, mapa] of [
        ['titulos', srv.t],
        ['tops', srv.p],
      ]) {
        for (const x of corpo[tipo] || []) {
          const { base, ...resto } = x,
            atual = mapa.get(x.id);
          if (!atual || base == null || atual.atualizado === base) {
            mapa.set(x.id, { ...resto, atualizado: ++srv.relogio });
            versoes[x.id] = srv.relogio;
          } else conflitos.push(x.id);
        }
        for (const d of (corpo.del || {})[tipo] || []) {
          const atual = mapa.get(d.id);
          if (!atual) continue;
          if (d.base == null || atual.atualizado === d.base) mapa.delete(d.id);
          else conflitos.push(d.id);
        }
      }
      return resp(200, { ok: true, versoes, conflitos });
    }
    return resp(404, {});
  };
  return srv;
}

const serie = (id, vis = [0], extra = {}) => ({ id, tipo: 'tv', nome: id, eps: [3], vis, criado: 1000 - ++contador, hist: {}, capa: null, ...extra });
const top = (id, itens = []) => ({ id, nome: id, itens, criado: 500 - ++contador });

/* ---------- ambiente de cada teste ---------- */
// Cada "sessão" é uma cópia nova do módulo (como abrir a página de novo); o servidor e o localStorage continuam.
async function sessao() {
  const M = await import('../public/js/loja.js?s=' + ++contador);
  const eventos = { render: 0, login: 0 };
  M.ligar({ render: () => eventos.render++, login: () => eventos.login++ });
  return { ...M, eventos };
}
// Avança o relógio falso e deixa as promessas pendentes terminarem.
async function avancar(ms) {
  relogioAtivo.tick(ms);
  for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r));
}
const ambiente = (nome, fn) =>
  test(nome, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    relogioAtivo = t.mock.timers;
    localStorage.clear();
    const srv = criarServidor();
    await fn(srv);
  });

// Primeira sessão: carrega, aplica `editar`, perde a rede e fecha. A cópia local (claq:snap) guarda as alterações.
async function sessaoQueFicouOffline(srv, editar) {
  const A = await sessao();
  await A.carregar();
  editar(A);
  srv.falhas = Infinity;
  A.save();
  await avancar(300);
  assert.ok(A.pendente(), 'a sessão offline ficou com alterações pendentes');
  A.zerar(); // para o timer de nova tentativa; a cópia local continua no localStorage
  srv.falhas = 0;
  srv.chamadas = 0;
  srv.posts.length = 0;
}

/* ---------- fila de envio ---------- */
ambiente('save: envia só o que mudou, com a versão conhecida (base), e não repete', async srv => {
  srv.semear(serie('a', [0]), serie('b', [0]));
  const M = await sessao();
  await M.carregar();
  M.achar('a').vis = [2];
  M.save();
  await avancar(300);
  assert.equal(srv.posts.length, 1);
  assert.deepEqual(
    srv.posts[0].titulos.map(t => [t.id, t.vis, t.base]),
    [['a', [2], 101]],
  );
  assert.equal(M.pendente(), false);
  assert.equal(srv.t.get('a').vis[0], 2);
  M.save(); // nada mudou desde o último envio
  await avancar(300);
  assert.equal(srv.posts.length, 1);
});

ambiente('save: títulos em lotes de 15, tops à parte e exclusão com a versão conhecida', async srv => {
  srv.semear(serie('velho'));
  srv.semearTop(top('t-velho'));
  const M = await sessao();
  await M.carregar();
  for (let i = 0; i < 40; i++) M.L.series.push(serie('n' + i));
  M.L.tops.push(top('t-novo'));
  M.L.series = M.L.series.filter(s => s.id !== 'velho');
  M.save();
  await avancar(300);
  const lotes = srv.posts.filter(p => p.titulos).map(p => p.titulos.length);
  assert.deepEqual(lotes, [15, 15, 10]);
  assert.equal(srv.posts.filter(p => p.tops).length, 1);
  const exclusao = srv.posts.find(p => p.del);
  assert.deepEqual(exclusao.del.titulos, [{ id: 'velho', base: 101 }]);
  assert.equal(srv.t.has('velho'), false);
  assert.equal(srv.t.size, 40);
  assert.equal(M.pendente(), false);
});

ambiente('save: sem rede, tenta de novo com espera crescente (2 s, 4 s, ...) e guarda cópia local', async srv => {
  srv.semear(serie('a', [0]));
  const M = await sessao();
  await M.carregar();
  srv.falhas = 2;
  srv.chamadas = 0;
  M.achar('a').vis = [2];
  M.save();
  await avancar(300);
  assert.equal(srv.chamadas, 1, '1ª tentativa falha');
  assert.ok(M.pendente());
  const snap = JSON.parse(localStorage.getItem('claq:snap'));
  assert.deepEqual(snap.series[0].vis, [2], 'a alteração está salva no aparelho');
  await avancar(1999);
  assert.equal(srv.chamadas, 1, 'ainda esperando os 2 s');
  await avancar(1);
  assert.equal(srv.chamadas, 2, '2ª tentativa após 2 s (falha)');
  await avancar(3999);
  assert.equal(srv.chamadas, 2, 'ainda esperando os 4 s');
  await avancar(1);
  assert.equal(srv.chamadas, 3, '3ª tentativa após 4 s (funciona)');
  assert.equal(M.pendente(), false);
  assert.equal(srv.t.get('a').vis[0], 2);
});

ambiente('save: erro 5xx tenta de novo; erro 4xx não; 401 pede login e não perde a alteração', async srv => {
  srv.semear(serie('a', [0]));
  const M = await sessao();
  await M.carregar();
  M.achar('a').vis = [1];

  srv.status = 503;
  srv.chamadas = 0;
  M.save();
  await avancar(300);
  await avancar(2000);
  assert.equal(srv.chamadas, 2, '5xx: nova tentativa');

  srv.status = 400;
  await avancar(4000);
  const depois400 = srv.chamadas;
  await avancar(120000);
  assert.equal(srv.chamadas, depois400, '4xx: não insiste');
  assert.ok(M.pendente(), 'continua pendente para a próxima alteração');

  srv.status = 401;
  M.save();
  await avancar(300);
  assert.equal(M.eventos.login, 1, '401 volta para a tela de entrada');
  assert.deepEqual(JSON.parse(localStorage.getItem('claq:snap')).series[0].vis, [1]);
});

/* ---------- vários aparelhos: conflito ---------- */
ambiente('conflito: outro aparelho gravou antes; o progresso maior vence e o resto vem do servidor', async srv => {
  srv.semear(serie('a', [1]));
  const M = await sessao();
  await M.carregar();
  M.achar('a').vis = [3]; // aqui: até o ep 3
  srv.editar('a', { vis: [2], nome: 'Nome do outro aparelho' }); // lá: ep 2 e nome novo
  M.save();
  await avancar(300);
  assert.equal(M.eventos.render, 1, 'avisou a tela da mesclagem');
  assert.equal(M.pendente(), false);
  assert.deepEqual(srv.t.get('a').vis, [3], 'o maior progresso foi para o servidor');
  assert.equal(srv.t.get('a').nome, 'Nome do outro aparelho', 'metadados: vale o servidor');
  assert.equal(M.achar('a').nome, 'Nome do outro aparelho');
  assert.equal(srv.posts.length, 2, 'uma tentativa recusada e um reenvio');
});

ambiente('conflito: o servidor tem mais episódios vistos que o aparelho: nada regride', async srv => {
  srv.semear(serie('a', [1]));
  const M = await sessao();
  await M.carregar();
  M.achar('a').nota_pessoal = 7;
  srv.editar('a', { vis: [3] });
  M.save();
  await avancar(300);
  assert.deepEqual(srv.t.get('a').vis, [3]);
  assert.equal(srv.t.get('a').nota_pessoal, 7, 'a nota daqui entra porque o servidor não tinha');
});

ambiente('conflito: excluir um título que outro aparelho alterou não apaga; a edição vence e ele volta', async srv => {
  srv.semear(serie('a'), serie('b'));
  const M = await sessao();
  await M.carregar();
  M.L.series = M.L.series.filter(s => s.id !== 'b');
  srv.editar('b', { nome: 'Editado lá' });
  M.save();
  await avancar(300);
  assert.ok(srv.t.has('b'), 'o servidor manteve o título');
  assert.equal(M.achar('b').nome, 'Editado lá', 'voltou para a estante com a edição do outro aparelho');
  assert.equal(M.pendente(), false);
});

ambiente('conflito: excluir sem alteração em outro aparelho apaga normalmente', async srv => {
  srv.semear(serie('a'), serie('b'));
  const M = await sessao();
  await M.carregar();
  M.L.series = M.L.series.filter(s => s.id !== 'b');
  M.save();
  await avancar(300);
  assert.equal(srv.t.has('b'), false);
  assert.equal(M.achar('b'), undefined);
});

ambiente('conflito: top editado nos dois aparelhos fica com a versão deste aparelho', async srv => {
  srv.semearTop(top('p', [{ t: 'X' }]));
  const M = await sessao();
  await M.carregar();
  M.L.tops[0].itens = [{ t: 'Meu' }];
  srv.editarTop('p', { itens: [{ t: 'Do outro' }] });
  M.save();
  await avancar(300);
  assert.deepEqual(srv.p.get('p').itens, [{ t: 'Meu' }]);
});

ambiente('conflito: mesclagem que não fecha em 2 voltas mostra o erro, mantém o pendente e não perde o progresso', async srv => {
  srv.semear(serie('a', [1]));
  const M = await sessao();
  await M.carregar();
  M.achar('a').vis = [2];
  // todo envio encontra o título já alterado por outro aparelho
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    if (String(url).includes('/api/sync')) srv.editar('a', { nome: 'n' + ++contador });
    return original(url, opt);
  };
  M.save();
  await avancar(300);
  assert.ok(M.pendente(), 'continua pendente');
  assert.match(barraStatus.textContent, /Não foi possível combinar/);
  assert.equal(M.achar('a').vis[0] >= 2, true, 'o progresso local não se perdeu');
});

/* ---------- cópia local (reaplicar) ---------- */
ambiente('reaplicar: título intocado no servidor recebe a alteração que ficou sem enviar', async srv => {
  srv.semear(serie('a', [0]), serie('b', [0]));
  await sessaoQueFicouOffline(srv, A => {
    A.achar('a').vis = [2];
  });
  const B = await sessao();
  const r = await B.carregar();
  assert.equal(r.offline, false);
  assert.deepEqual(B.achar('a').vis, [2]);
  assert.ok(B.pendente(), 'precisa enviar');
  await avancar(300);
  assert.deepEqual(srv.t.get('a').vis, [2]);
  assert.equal(B.pendente(), false);
});

ambiente('reaplicar: servidor mudou nesse meio tempo: combina (maior progresso, nome do servidor, nota local)', async srv => {
  srv.semear(serie('a', [0]));
  await sessaoQueFicouOffline(srv, A => {
    A.achar('a').vis = [2];
    A.achar('a').nota_pessoal = 9;
  });
  srv.editar('a', { vis: [3], nome: 'Novo nome' });
  const B = await sessao();
  await B.carregar();
  const s = B.achar('a');
  assert.deepEqual(s.vis, [3]);
  assert.equal(s.nome, 'Novo nome');
  assert.equal(s.nota_pessoal, 9);
  await avancar(300);
  assert.equal(srv.t.get('a').nota_pessoal, 9);
});

ambiente('reaplicar: título criado offline entra na lista e é enviado', async srv => {
  srv.semear(serie('a'));
  await sessaoQueFicouOffline(srv, A => A.L.series.unshift(serie('novo', [1])));
  const B = await sessao();
  await B.carregar();
  assert.ok(B.achar('novo'));
  await avancar(300);
  assert.ok(srv.t.has('novo'));
});

ambiente('reaplicar: título apagado só neste aparelho continua apagado e é excluído no servidor', async srv => {
  srv.semear(serie('a'), serie('b'));
  await sessaoQueFicouOffline(srv, A => {
    A.L.series = A.L.series.filter(s => s.id !== 'b');
  });
  const B = await sessao();
  await B.carregar();
  assert.equal(B.achar('b'), undefined);
  await avancar(300);
  assert.equal(srv.t.has('b'), false);
});

ambiente('reaplicar: título apagado em outro aparelho não ressuscita, mesmo com edição local', async srv => {
  srv.semear(serie('a'), serie('b'));
  await sessaoQueFicouOffline(srv, A => {
    A.achar('b').vis = [2];
  });
  srv.apagar('b');
  const B = await sessao();
  await B.carregar();
  assert.equal(B.achar('b'), undefined);
  await avancar(300);
  assert.equal(srv.t.has('b'), false, 'e não foi reenviado');
});

ambiente('reaplicar: top editado offline vence a versão do servidor', async srv => {
  srv.semearTop(top('p', [{ t: 'X' }]));
  await sessaoQueFicouOffline(srv, A => {
    A.L.tops[0].itens = [{ t: 'Meu' }];
  });
  srv.editarTop('p', { itens: [{ t: 'Do outro' }] });
  const B = await sessao();
  await B.carregar();
  assert.deepEqual(B.L.tops[0].itens, [{ t: 'Meu' }]);
});

ambiente('reaplicar: cópia de outro usuário é descartada', async srv => {
  srv.semear(serie('a', [0]));
  await sessaoQueFicouOffline(srv, A => {
    A.achar('a').vis = [2];
  });
  srv.usuario = { id: 'u2', nome: 'Bia', email: 'bia@exemplo.com' };
  const B = await sessao();
  await B.carregar();
  assert.deepEqual(B.achar('a').vis, [0]);
  assert.equal(B.pendente(), false);
  assert.equal(JSON.parse(localStorage.getItem('claq:snap')).uid, 'u2');
});

ambiente('carregar sem rede: abre a cópia local com a alteração pendente e envia quando a rede volta', async srv => {
  srv.semear(serie('a', [0]));
  await sessaoQueFicouOffline(srv, A => {
    A.achar('a').vis = [2];
  });
  srv.falhas = Infinity;
  const B = await sessao();
  const r = await B.carregar();
  assert.equal(r.offline, true);
  assert.deepEqual(B.achar('a').vis, [2]);
  assert.ok(B.pendente());
  srv.falhas = 0;
  await avancar(5000);
  assert.deepEqual(srv.t.get('a').vis, [2]);
  assert.equal(B.pendente(), false);
});

ambiente('carregar sem rede e sem cópia local: o erro sobe para a tela', async srv => {
  srv.falhas = Infinity;
  const B = await sessao();
  await assert.rejects(B.carregar(), e => e.rede === true);
});

/* ---------- recarregar ao voltar para a aba ---------- */
ambiente('recarregarSuave: traz o que mudou em outro aparelho e não mexe enquanto há envio pendente', async srv => {
  srv.semear(serie('a', [0]));
  const M = await sessao();
  await M.carregar();
  srv.editar('a', { vis: [2] });
  await M.recarregarSuave();
  assert.deepEqual(M.achar('a').vis, [2]);
  assert.equal(M.eventos.render, 1);

  // com alteração ainda não enviada, não recarrega (não atropela o que a pessoa acabou de fazer)
  M.achar('a').vis = [3];
  M.save();
  srv.editar('a', { vis: [1], nome: 'outro' });
  const antes = srv.chamadas;
  await M.recarregarSuave();
  assert.equal(srv.chamadas, antes);
  assert.deepEqual(M.achar('a').vis, [3]);
});
