// Testes do backend novo: ETag, migrações, recuperação de senha, conta, cota de capas e cron.
// O banco e o Blob são substituídos por versões falsas (nada de rede): o que se confere é a lógica dos endpoints.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

/* ---------- banco e Blob falsos ---------- */
const banco = { consultas: [], resposta: () => [] };
const blob = { enviados: [], apagados: [] };
const falsos = {
  '@neondatabase/serverless': {
    neon: () => {
      const sql = (strings, ...vals) => {
        const texto = strings.join('?').replace(/\s+/g, ' ').trim();
        banco.consultas.push({ texto, vals });
        try {
          return Promise.resolve(banco.resposta(texto, vals));
        } catch (e) {
          return Promise.reject(e);
        }
      };
      sql.transaction = qs => Promise.all(qs);
      return sql;
    },
  },
  '@vercel/blob': {
    put: async p => {
      blob.enviados.push(p);
      return { url: 'https://abc.public.blob.vercel-storage.com/' + p };
    },
    del: async u => {
      blob.apagados.push(...[].concat(u));
    },
    list: async () => ({ blobs: [], hasMore: false }),
  },
};
const carregar = Module._load;
Module._load = function (req, ...resto) {
  return falsos[req] || carregar.call(this, req, ...resto);
};

const { assinar, hashSenha } = require('../api/_lib');
const { etagDe, confere } = require('../api/_etag');
const T = require('../api/_token');
const M = require('../scripts/migrar');

const USER = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 1 };
const cookie = () => {
  const v = `${USER.id}.${USER.versao}.${Date.now() + 864e5}`;
  return `sessao=${v}.${assinar(v)}`;
};
const novoRes = () => {
  const h = {};
  return {
    h,
    code: 200,
    body: undefined,
    ended: false,
    setHeader(k, v) {
      h[k.toLowerCase()] = v;
    },
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
};
async function chamar(arquivo, { metodo = 'POST', body, headers = {}, logado = false } = {}) {
  const res = novoRes();
  await require('../api/' + arquivo)({ method: metodo, body, query: {}, headers: { ...(logado ? { cookie: cookie() } : {}), ...headers } }, res);
  return res;
}
const limpar = () => {
  banco.consultas = [];
  blob.enviados = [];
  blob.apagados = [];
};
// Respostas padrão: sessão válida e contadores de tentativas vazios; cada teste acrescenta as suas.
const base = extra => (t, v) => {
  if (/select id, nome, email, versao from usuarios/.test(t)) return [USER];
  if (/select ate from tentativas/.test(t)) return [];
  if (/insert into tentativas/.test(t)) return [{ falhas: 1 }];
  return extra ? extra(t, v) || [] : [];
};
const envEmail = () =>
  Object.assign(process.env, { RESEND_API_KEY: 're_teste', EMAIL_FROM: 'SóMaisUmEp <oi@somaisumep.test>', APP_URL: 'https://somaisumep.test/' });

/* ---------- ETag ---------- */
test('etag: igual para os mesmos dados, diferente quando algo muda', () => {
  assert.equal(etagDe('a', 1, 2), etagDe('a', 1, 2));
  assert.notEqual(etagDe('a', 1, 2), etagDe('a', 1, 3));
  assert.match(etagDe('x'), /^W\/"[\w-]{24}"$/);
});
test('etag: If-None-Match aceita lista, "*" e ignora o prefixo W/', () => {
  const t = etagDe('x');
  assert.ok(confere({ headers: { 'if-none-match': t } }, t));
  assert.ok(confere({ headers: { 'if-none-match': t.replace('W/', '') } }, t));
  assert.ok(confere({ headers: { 'if-none-match': `"outro", ${t}` } }, t));
  assert.ok(confere({ headers: { 'if-none-match': '*' } }, t));
  assert.ok(!confere({ headers: {} }, t));
  assert.ok(!confere({ headers: { 'if-none-match': 'W/"outro"' } }, t));
});

test('/api/dados: devolve 304 sem ler a biblioteca quando nada mudou', async () => {
  let m = '100';
  banco.resposta = base(t => (/count\(\*\)::int as n/.test(t) ? [{ n: 2, m }] : []));
  const a = await chamar('dados', { metodo: 'GET', logado: true });
  assert.equal(a.code, 200);
  assert.ok(a.h.etag && a.h['cache-control'] === 'private, no-cache');
  assert.ok(banco.consultas.some(c => /select \* from titulos/.test(c.texto)));

  limpar();
  banco.resposta = base(t => (/count\(\*\)::int as n/.test(t) ? [{ n: 2, m }] : []));
  const b = await chamar('dados', { metodo: 'GET', logado: true, headers: { 'if-none-match': a.h.etag } });
  assert.equal(b.code, 304);
  assert.ok(b.ended);
  assert.ok(!banco.consultas.some(c => /select \* from titulos/.test(c.texto)), 'não pode ler os títulos num 304');

  m = '101';
  limpar();
  const c = await chamar('dados', { metodo: 'GET', logado: true, headers: { 'if-none-match': a.h.etag } });
  assert.equal(c.code, 200);
  assert.notEqual(c.h.etag, a.h.etag);
});

/* ---------- token de redefinição ---------- */
test('token: 64 hex, só o hash é guardado, vale 1 hora', () => {
  const t = T.novo(1000);
  assert.match(t.token, /^[a-f0-9]{64}$/);
  assert.equal(t.hash, T.hashToken(t.token));
  assert.notEqual(t.hash, t.token);
  assert.equal(t.expira, 1000 + 36e5);
  assert.ok(T.valido(t.token));
  assert.ok(!T.valido('abc'));
  assert.ok(!T.valido(null));
  assert.notEqual(T.novo().token, T.novo().token);
});

/* ---------- migrações ---------- */
test('migrações: numeração contínua a partir de 001 e arquivos não vazios', () => {
  const l = M.listar();
  assert.ok(l.length >= 2);
  l.forEach((f, i) => assert.equal(f.slice(0, 3), String(i + 1).padStart(3, '0')));
  l.forEach(f => assert.ok(M.comandos(M.ler(f)).length > 0, f));
});
test('migrações: comandos ignora comentários e divide por ";"', () => {
  assert.deepEqual(M.comandos('-- x; y\ncreate table a (id int); -- fim\n\ninsert into a values (1);\n'), [
    'create table a (id int)',
    'insert into a values (1)',
  ]);
});
test('neon/schema.sql está em dia com as migrações (rode "npm run schema")', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'neon', 'schema.sql'), 'utf8'), M.schemaCompleto());
});

/* ---------- esqueci a senha ---------- */
test('esqueci: responde igual para e-mail existente e inexistente; só o existente recebe o link', async () => {
  envEmail();
  const enviados = [];
  const fetchOrig = global.fetch;
  global.fetch = async (url, opt) => {
    enviados.push({ url, body: JSON.parse(opt.body) });
    return { ok: true };
  };
  try {
    limpar();
    banco.resposta = base(t => (/select id, nome from usuarios where email/.test(t) ? [] : []));
    const a = await chamar('_h/esqueci', { body: { email: 'ninguem@exemplo.com' } });
    assert.deepEqual(a.body, { ok: true });
    assert.equal(enviados.length, 0);
    assert.ok(!banco.consultas.some(c => /insert into reset_senha/.test(c.texto)));

    limpar();
    banco.resposta = base(t => (/select id, nome from usuarios where email/.test(t) ? [{ id: 'u1', nome: 'Ana' }] : []));
    const b = await chamar('_h/esqueci', { body: { email: 'ANA@exemplo.com ' } });
    assert.deepEqual(b.body, { ok: true });
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].url, 'https://api.resend.com/emails');
    assert.deepEqual(enviados[0].body.to, ['ana@exemplo.com']);
    const token = /https:\/\/somaisumep\.test\/#redefinir=([a-f0-9]{64})/.exec(enviados[0].body.text)[1];
    const ins = banco.consultas.find(c => /insert into reset_senha/.test(c.texto));
    assert.ok(ins.vals.includes(T.hashToken(token)) && !ins.vals.includes(token), 'o banco guarda só o hash');
  } finally {
    global.fetch = fetchOrig;
  }
});
test('esqueci: sem e-mail configurado avisa (501) e e-mail inválido é recusado', async () => {
  envEmail();
  banco.resposta = base();
  assert.equal((await chamar('_h/esqueci', { body: { email: 'sem-arroba' } })).code, 400);
  delete process.env.RESEND_API_KEY;
  assert.equal((await chamar('_h/esqueci', { body: { email: 'ana@exemplo.com' } })).code, 501);
});
test('esqueci: bloqueia depois de muitos pedidos para o mesmo e-mail', async () => {
  envEmail();
  const padrao = base();
  banco.resposta = (t, v) => (/select ate from tentativas/.test(t) ? [{ ate: Date.now() + 6e5 }] : padrao(t, v));
  const r = await chamar('_h/esqueci', { body: { email: 'ana@exemplo.com' } });
  assert.equal(r.code, 429);
});

/* ---------- redefinir ---------- */
test('redefinir: token malformado, desconhecido e senha curta são recusados', async () => {
  banco.resposta = base();
  assert.equal((await chamar('_h/redefinir', { body: { token: 'xyz', senha: 'senha-boa-123' } })).code, 400);
  assert.equal((await chamar('_h/redefinir', { body: { token: 'a'.repeat(64), senha: 'senha-boa-123' } })).code, 400); // não achou no banco
  assert.equal((await chamar('_h/redefinir', { body: { token: 'a'.repeat(64), senha: '123' } })).code, 400);
});
test('redefinir: troca a senha, encerra as sessões (versao + 1) e consome o token', async () => {
  const token = 'b'.repeat(64);
  limpar();
  banco.resposta = base(t => (/with t as \(delete from reset_senha/.test(t) ? [{ id: 'u1', email: 'ana@exemplo.com' }] : []));
  const r = await chamar('_h/redefinir', { body: { token, senha: 'senha-boa-123' } });
  assert.deepEqual(r.body, { ok: true });
  const q = banco.consultas.find(c => /with t as \(delete from reset_senha/.test(c.texto));
  assert.match(q.texto, /versao = versao \+ 1/);
  assert.ok(q.vals.includes(T.hashToken(token)) && !q.vals.includes(token));
  assert.ok(
    banco.consultas.some(c => /delete from reset_senha where user_id/.test(c.texto)),
    'apaga os outros links pendentes',
  );
});

/* ---------- conta ---------- */
test('conta: senha errada dá 403 (nunca 401, que derrubaria a sessão no app)', async () => {
  const senha_hash = await hashSenha('senha-certa-1');
  banco.resposta = base(t => (/select senha_hash from usuarios/.test(t) ? [{ senha_hash }] : []));
  const r = await chamar('_h/conta', { logado: true, body: { acao: 'excluir', senha: 'errada' } });
  assert.equal(r.code, 403);
  assert.equal((await chamar('_h/conta', { body: { acao: 'excluir', senha: 'x' } })).code, 401); // sem sessão
  assert.equal((await chamar('_h/conta', { logado: true, body: { acao: 'hackear', senha: 'x' } })).code, 400); // ação inexistente
});
test('conta: trocar senha mantém este aparelho logado com a nova versão da sessão', async () => {
  const senha_hash = await hashSenha('senha-certa-1');
  limpar();
  banco.resposta = base(t => (/select senha_hash from usuarios/.test(t) ? [{ senha_hash }] : /update usuarios set senha_hash/.test(t) ? [{ versao: 2 }] : []));
  const r = await chamar('_h/conta', { logado: true, body: { acao: 'senha', senha: 'senha-certa-1', nova: 'outra-senha-2' } });
  assert.deepEqual(r.body, { ok: true });
  assert.match(r.h['set-cookie'], /^sessao=u1\.2\./);
  assert.equal((await chamar('_h/conta', { logado: true, body: { acao: 'senha', senha: 'senha-certa-1', nova: 'curta' } })).code, 400);
});
test('conta: trocar e-mail normaliza e avisa quando já está em uso (409)', async () => {
  const senha_hash = await hashSenha('senha-certa-1');
  limpar();
  banco.resposta = base(t => (/select senha_hash from usuarios/.test(t) ? [{ senha_hash }] : []));
  const ok = await chamar('_h/conta', { logado: true, body: { acao: 'email', senha: 'senha-certa-1', email: ' NOVO@Exemplo.com' } });
  assert.deepEqual(ok.body, { ok: true, email: 'novo@exemplo.com' });
  banco.resposta = base(t => {
    if (/select senha_hash from usuarios/.test(t)) return [{ senha_hash }];
    if (/update usuarios set email/.test(t)) throw Object.assign(new Error('duplicate key'), { code: '23505' });
    return [];
  });
  assert.equal((await chamar('_h/conta', { logado: true, body: { acao: 'email', senha: 'senha-certa-1', email: 'outro@exemplo.com' } })).code, 409);
});
test('conta: excluir apaga o usuário, as capas do Blob (só as dele) e encerra a sessão', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teste';
  const senha_hash = await hashSenha('senha-certa-1'),
    meu = 'https://abc.public.blob.vercel-storage.com/capas/u1/capa-1.jpg';
  limpar();
  banco.resposta = base(t =>
    /select senha_hash from usuarios/.test(t)
      ? [{ senha_hash }]
      : /select capa as url from titulos/.test(t)
        ? [{ url: meu }, { url: 'https://image.tmdb.org/t/p/w342/a.jpg' }, { url: 'https://abc.public.blob.vercel-storage.com/capas/outro/capa.jpg' }]
        : /select url from capas/.test(t)
          ? [{ url: meu }]
          : [],
  );
  const r = await chamar('_h/conta', { logado: true, body: { acao: 'excluir', senha: 'senha-certa-1' } });
  assert.deepEqual(r.body, { ok: true });
  assert.match(r.h['set-cookie'], /Max-Age=0/);
  assert.ok(banco.consultas.some(c => /delete from usuarios where id/.test(c.texto)));
  assert.ok(blob.apagados.length && blob.apagados.every(u => u.includes('/capas/u1/')), 'só apaga arquivos do próprio usuário');
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

/* ---------- capas: cota ---------- */
test('capa: respeita a cota por hora e por total, e registra o envio', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teste';
  const imagem = 'data:image/jpeg;base64,/9j/4AAQ';
  banco.resposta = base(t => (/from capas where user_id/.test(t) ? [{ hora: 30, total: 30 }] : []));
  assert.equal((await chamar('_h/capa', { logado: true, body: { imagem } })).code, 429);
  banco.resposta = base(t => (/from capas where user_id/.test(t) ? [{ hora: 0, total: 1000 }] : []));
  assert.equal((await chamar('_h/capa', { logado: true, body: { imagem } })).code, 429);
  limpar();
  banco.resposta = base(t => (/from capas where user_id/.test(t) ? [{ hora: 1, total: 5 }] : []));
  const r = await chamar('_h/capa', { logado: true, body: { imagem } });
  assert.equal(r.code, 200);
  assert.match(r.body.url, /capas\/u1\/capa\.jpg$/);
  assert.ok(banco.consultas.some(c => /insert into capas/.test(c.texto) && c.vals.includes(r.body.url)));
  assert.equal((await chamar('_h/capa', { logado: true, body: { imagem: 'data:text/html;base64,AAAA' } })).code, 400);
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

/* ---------- cron ---------- */
test('cron: exige o CRON_SECRET e devolve o que limpou', async () => {
  process.env.CRON_SECRET = 'segredo-do-cron';
  banco.resposta = base(t => (/with d as \(delete/.test(t) ? [{ n: 3 }] : []));
  assert.equal((await chamar('cron', { metodo: 'GET' })).code, 401);
  assert.equal((await chamar('cron', { metodo: 'GET', headers: { authorization: 'Bearer errado' } })).code, 401);
  const r = await chamar('cron', { metodo: 'GET', headers: { authorization: 'Bearer segredo-do-cron' } });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { ok: true, tentativas: 3, links: 3, capasBlob: 0, capasRegistro: 3, proximos: { ativo: false }, push: { ativo: false } });
  delete process.env.CRON_SECRET;
  assert.equal((await chamar('cron', { metodo: 'GET', headers: { authorization: 'Bearer x' } })).code, 500);
});

/* ---------- v5.1.1: chave por usuário e adoção de dados antigos ---------- */
test('sync: o upsert usa a chave (user_id, id), então o mesmo id em outra conta não vira conflito', async () => {
  limpar();
  banco.resposta = base(t => (/insert into (titulos|tops)/.test(t) ? [{ id: 'x', atualizado: 1 }] : []));
  const r = await chamar('_h/sync', { logado: true, body: { titulos: [{ id: 'a1', nome: 'Teste', eps: [3], vis: [1] }], tops: [{ id: 'p1', nome: 'Top' }] } });
  assert.equal(r.code, 200);
  const ups = banco.consultas.filter(c => /insert into (titulos|tops)/.test(c.texto));
  assert.equal(ups.length, 2);
  for (const c of ups) {
    assert.match(c.texto, /on conflict \(user_id, id\)/);
    assert.doesNotMatch(c.texto, /on conflict \(id\)/);
  }
});

test('migração 004: troca a chave primária por índice único (user_id, id) e é segura de repetir', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'neon', 'migracoes', '004_chave_por_usuario.sql'), 'utf8');
  for (const t of ['titulos', 'tops']) {
    assert.match(sql, new RegExp(`alter table ${t} drop constraint if exists ${t}_pkey`));
    assert.match(sql, new RegExp(`create unique index if not exists ${t}_user_id_uidx on ${t} \\(user_id, id\\)`));
  }
});

test('cadastro: primeira conta só adota dados sem dono com ADOTAR_DADOS_ANTIGOS=true', async () => {
  const rodar = async adotar => {
    limpar();
    if (adotar) process.env.ADOTAR_DADOS_ANTIGOS = 'true';
    else delete process.env.ADOTAR_DADOS_ANTIGOS;
    banco.resposta = base(t => (/count\(\*\)::int as n from usuarios/.test(t) ? [{ n: 0 }] : /insert into usuarios/.test(t) ? [{ id: 'novo' }] : []));
    const r = await chamar('_h/cadastro', { body: { nome: 'Ana', email: 'ana@exemplo.com', senha: 'senha-bem-longa' } });
    assert.equal(r.code, 200);
    return banco.consultas.filter(c => /set user_id = \?\s+where user_id is null/.test(c.texto)).length;
  };
  assert.equal(await rodar(false), 0, 'sem a variável, nada é adotado');
  assert.equal(await rodar(true), 2, 'com a variável, títulos e tops são adotados');
  delete process.env.ADOTAR_DADOS_ANTIGOS;
});

/* ---------- v5.1.2: limites, exclusão com versão, sessão renovável ---------- */
const Lim = require('../api/_limite');
const reqIp = ip => ({ headers: { 'x-forwarded-for': ip } });

test('limites: por IP é folgado (CGNAT) e o limite por e-mail continua sendo o principal', () => {
  const [ip, em] = Lim.chaves(reqIp('10.0.0.1'), 'ana@exemplo.com');
  assert.equal(ip.limite, 100);
  assert.equal(em.limite, 5);
  assert.equal(Lim.chavesDe(reqIp('10.0.0.1'), 'rs').find(c => c.k.startsWith('rs-ip:')).limite, Lim.LIMITE_IP);
});

test('janela fixa: chave muda a cada janela e o bloqueio vai até o fim dela', async () => {
  const dia = 864e5,
    agora = 5 * dia + 3 * 36e5;
  const a = Lim.janela('cad-ip', '10.0.0.1', 30, dia, agora),
    b = Lim.janela('cad-ip', '10.0.0.1', 30, dia, agora + 2 * 36e5);
  const c = Lim.janela('cad-ip', '10.0.0.1', 30, dia, agora + dia);
  assert.equal(a.k, b.k, 'mesmo dia, mesma chave');
  assert.notEqual(a.k, c.k, 'dia seguinte, contador novo');
  assert.equal(a.fixoAte, 6 * dia);

  const gravados = [];
  const sqlFalso = n => {
    const s = (st, ...v) => {
      const t = st.join('?');
      if (/insert into tentativas/.test(t)) return Promise.resolve([{ falhas: n }]);
      gravados.push({ t, v });
      return Promise.resolve([]);
    };
    return s;
  };
  const antes = Date.now;
  Date.now = () => agora;
  try {
    await Lim.registrarFalha(sqlFalso(29), [a]);
    assert.equal(gravados.length, 0, 'abaixo do limite não bloqueia');
    await Lim.registrarFalha(sqlFalso(30), [a]);
    assert.equal(gravados.length, 1, 'no limite bloqueia');
    assert.equal(gravados[0].v[0], a.fixoAte, 'até o fim da janela (sem bloqueio crescente)');
  } finally {
    Date.now = antes;
  }
});

test('cadastro: contador diário próprio por IP, separado das falhas de login', async () => {
  limpar();
  banco.resposta = base(t => (/count\(\*\)::int as n from usuarios/.test(t) ? [{ n: 1 }] : /insert into usuarios/.test(t) ? [{ id: 'novo' }] : []));
  const r = await chamar('_h/cadastro', {
    body: { nome: 'Ana', email: 'nova@exemplo.com', senha: 'senha-bem-longa' },
    headers: { 'x-forwarded-for': '10.9.9.9' },
  });
  assert.equal(r.code, 200);
  const chaves = banco.consultas.filter(c => /insert into tentativas/.test(c.texto)).map(c => String(c.vals[0]));
  assert.equal(chaves.length, 1);
  assert.match(chaves[0], /^cad-ip:[a-f0-9]{32}:\d+$/);
  assert.ok(!chaves.some(k => k.startsWith('ip:')), 'não pode gastar o limite de login do IP');
});

test('sync: exclusão leva a versão (base) e só apaga se ninguém alterou depois', async () => {
  limpar();
  banco.resposta = base(t => (/delete from titulos/.test(t) ? [{ id: 'a1' }] : []));
  const r = await chamar('_h/sync', { logado: true, body: { del: { titulos: [{ id: 'a1', base: 123 }, 'b2'], tops: [] } } });
  assert.equal(r.code, 200);
  const d = banco.consultas.find(c => /delete from titulos t using unnest/.test(c.texto));
  assert.ok(d, 'usa unnest com as versões');
  assert.match(d.texto, /\(x\.b is null or t\.atualizado = x\.b\)/);
  assert.deepEqual(
    d.vals.slice(0, 2),
    [
      ['a1', 'b2'],
      [123, null],
    ],
    'ids e bases em paralelo; id solto (formato antigo) fica sem base',
  );
  assert.equal(d.vals[2], 'u1', 'sempre restrito ao dono');
});

test('sync: exclusão recusada porque outro aparelho editou vira conflito e preserva o arquivo do Blob', async () => {
  limpar();
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teste';
  const capa = 'https://abc.public.blob.vercel-storage.com/capas/u1/capa-x.jpg';
  banco.resposta = base(t => {
    if (/select id, capa from titulos/.test(t)) return [{ id: 'a1', capa }];
    if (/delete from titulos t using unnest/.test(t)) return []; // nada apagado: versão mudou
    if (/select id from titulos where user_id/.test(t)) return [{ id: 'a1' }]; // e a linha ainda existe
    return [];
  });
  try {
    const r = await chamar('_h/sync', { logado: true, body: { del: { titulos: [{ id: 'a1', base: 1 }] } } });
    assert.equal(r.code, 200);
    assert.deepEqual(r.body.conflitos, ['a1']);
    assert.deepEqual(blob.apagados, [], 'a capa não pode ser apagada se o título não foi');
  } finally {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});

test('sync: excluir algo que já não existe não é conflito (resultado é o mesmo)', async () => {
  limpar();
  banco.resposta = base(() => []);
  const r = await chamar('_h/sync', { logado: true, body: { del: { titulos: [{ id: 'sumiu', base: 5 }], tops: [{ id: 'top-sumiu', base: 7 }] } } });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.conflitos, []);
});

test('sessão: renova o cookie perto do fim (só em /api/dados) e não renova quando falta bastante', async () => {
  const comValidade = ms => {
    const v = `${USER.id}.${USER.versao}.${Date.now() + ms}`;
    return `sessao=${v}.${assinar(v)}`;
  };
  const dados = async ms => {
    limpar();
    banco.resposta = base(t => (/count\(\*\)::int as n/.test(t) ? [{ n: 0, m: '0' }] : []));
    return chamar('dados', { metodo: 'GET', headers: { cookie: comValidade(ms) } });
  };
  const perto = await dados(3 * 864e5);
  assert.match(perto.h['set-cookie'] || '', /^sessao=u1\.1\.\d+\.[a-f0-9]{64}; HttpOnly; Secure; SameSite=Strict/);
  assert.equal(perto.h['cache-control'], 'private, no-cache', 'resposta privada: o cookie nunca vai para cache público');
  const novaValidade = Number((perto.h['set-cookie'].match(/sessao=u1\.1\.(\d+)\./) || [])[1]);
  assert.ok(novaValidade > Date.now() + 29 * 864e5, 'volta a valer ~30 dias');
  const longe = await dados(20 * 864e5);
  assert.equal(longe.h['set-cookie'], undefined);
});

test('sessão: rotas com cache público (TMDb) nunca emitem Set-Cookie', async () => {
  const v = `${USER.id}.${USER.versao}.${Date.now() + 864e5}`;
  limpar();
  banco.resposta = base();
  const antes = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) });
  process.env.TMDB_READ_TOKEN = 'eyJ' + 'a'.repeat(80);
  try {
    const res = novoRes();
    await require('../api/tmdb')(
      { method: 'GET', body: undefined, query: { acao: 'busca', tipo: 'tv', q: 'x' }, headers: { cookie: `sessao=${v}.${assinar(v)}` } },
      res,
    );
    assert.equal(res.h['set-cookie'], undefined);
  } finally {
    global.fetch = antes;
    delete process.env.TMDB_READ_TOKEN;
  }
});
