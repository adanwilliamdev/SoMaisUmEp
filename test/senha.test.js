// Senhas: formato com parâmetros dentro do hash, compatibilidade com o formato legado e rehash automático no login.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const Module = require('module');

const banco = { consultas: [], resposta: () => [] };
const carregar = Module._load;
Module._load = function (req, ...resto) {
  if (req === '@neondatabase/serverless')
    return {
      neon: () => {
        const sql = (strings, ...vals) => {
          const texto = strings.join('?').replace(/\s+/g, ' ').trim();
          banco.consultas.push({ texto, vals });
          return Promise.resolve(banco.resposta(texto, vals));
        };
        sql.transaction = qs => Promise.all(qs);
        return sql;
      },
    };
  return carregar.call(this, req, ...resto);
};

const { hashSenha, confereSenha, precisaRehash, lerHash, HASH_FALSO, SCRYPT } = require('../api/_lib');

// Hash no formato antigo ("scrypt$salt$hash", N=16384), como os que já existem no banco de quem se cadastrou antes.
const legado = senha => {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(senha.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
};

test('senha: custo atual é o mínimo recomendado pela OWASP (N=2^17, r=8, p=1) e fica gravado no hash', async () => {
  assert.deepEqual(SCRYPT, { N: 131072, r: 8, p: 1 });
  const h = await hashSenha('senha-certa-1');
  assert.match(h, /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await confereSenha('senha-certa-1', h), true);
  assert.equal(await confereSenha('senha-errada', h), false);
  assert.equal(precisaRehash(h), false);
  assert.notEqual(h, await hashSenha('senha-certa-1'), 'cada hash tem o seu salt');
});

test('senha: hash no formato legado continua valendo e é marcado para regravação', async () => {
  const h = legado('senha-antiga-1');
  assert.equal(await confereSenha('senha-antiga-1', h), true);
  assert.equal(await confereSenha('outra', h), false);
  assert.equal(precisaRehash(h), true);
});

test('senha: hash de outro custo também pede regravação; formato inválido não', async () => {
  const salt = crypto.randomBytes(16);
  const k = crypto.scryptSync('x', salt, 64, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const h = `scrypt$32768$8$1$${salt.toString('hex')}$${k.toString('hex')}`;
  assert.equal(await confereSenha('x', h), true);
  assert.equal(precisaRehash(h), true);
  assert.equal(precisaRehash('lixo'), false);
  assert.equal(precisaRehash(null), false);
});

test('senha: parâmetros absurdos ou formato inválido são recusados sem gastar memória', async () => {
  const z = (n = 32) => '0'.repeat(n);
  const ruins = [
    `scrypt$1073741824$8$1$${z()}$${z(128)}`, // N enorme (consumiria gigabytes)
    `scrypt$131072$1024$1$${z()}$${z(128)}`, // r enorme
    `scrypt$131072$8$64$${z()}$${z(128)}`, // p enorme
    `scrypt$100000$8$1$${z()}$${z(128)}`, // N que não é potência de 2
    `scrypt$1024$8$1$${z()}$${z(128)}`, // N abaixo do mínimo
    `scrypt$131072$8$1$zz$${z(128)}`, // salt inválido
    `scrypt$131072$8$1$${z()}$xyz`, // hash inválido
    'scrypt$1$2$3$4', // partes demais/de menos
    'bcrypt$abc$def',
    '',
    null,
    undefined,
  ];
  for (const h of ruins) {
    assert.equal(lerHash(h), null, String(h));
    assert.equal(await confereSenha('qualquer', h), false, String(h));
  }
});

test('senha: o hash de mentira usa o custo atual e nunca confere', async () => {
  assert.notEqual(lerHash(HASH_FALSO), null);
  assert.deepEqual(lerHash(HASH_FALSO).params, SCRYPT);
  assert.equal(await confereSenha('qualquer', HASH_FALSO), false);
  assert.equal(await confereSenha('', HASH_FALSO), false);
});

/* ---------- login ---------- */
const login = async senha => {
  const res = {
    h: {},
    code: 200,
    body: undefined,
    setHeader(k, v) {
      this.h[k.toLowerCase()] = v;
    },
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  await require('../api/_h/login')({ method: 'POST', body: { email: 'ana@exemplo.com', senha }, query: {}, headers: {} }, res);
  return res;
};
const responde = hash => t => {
  if (/select id, nome, email, versao, senha_hash from usuarios/.test(t))
    return [{ id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 3, senha_hash: hash }];
  if (/insert into tentativas/.test(t)) return [{ falhas: 1 }];
  return [];
};

test('login: hash legado é regravado com o custo atual, sem mexer na versão (outras sessões continuam)', async () => {
  const antigo = legado('senha-antiga-1');
  banco.consultas = [];
  banco.resposta = responde(antigo);
  const r = await login('senha-antiga-1');
  assert.equal(r.code, 200);
  assert.match(r.h['set-cookie'], /^sessao=u1\.3\./, 'a sessão nova mantém a mesma versão');
  const up = banco.consultas.find(c => /update usuarios set senha_hash/.test(c.texto));
  assert.ok(up, 'regravou o hash');
  assert.doesNotMatch(up.texto, /versao/, 'não derruba as outras sessões');
  assert.match(up.vals[0], /^scrypt\$131072\$8\$1\$/);
  assert.equal(up.vals[2], antigo, 'só grava se o hash ainda for o que foi conferido (sem sobrescrever troca concorrente)');
  assert.equal(await confereSenha('senha-antiga-1', up.vals[0]), true, 'a mesma senha continua valendo');
});

test('login: hash já no custo atual não é regravado', async () => {
  const atual = await hashSenha('senha-certa-1');
  banco.consultas = [];
  banco.resposta = responde(atual);
  assert.equal((await login('senha-certa-1')).code, 200);
  assert.ok(!banco.consultas.some(c => /update usuarios set senha_hash/.test(c.texto)));
});

test('login: senha errada ou e-mail inexistente continuam respondendo 401, sem regravar nada', async () => {
  banco.consultas = [];
  banco.resposta = responde(legado('senha-antiga-1'));
  assert.equal((await login('errada')).code, 401);
  banco.resposta = t => (/select id, nome, email, versao, senha_hash/.test(t) ? [] : /insert into tentativas/.test(t) ? [{ falhas: 1 }] : []);
  assert.equal((await login('qualquer')).code, 401);
  assert.ok(!banco.consultas.some(c => /update usuarios set senha_hash/.test(c.texto)));
});

test('login: se a regravação falhar, o login continua funcionando', async () => {
  banco.consultas = [];
  banco.resposta = (t, v) => {
    if (/update usuarios set senha_hash/.test(t)) throw new Error('banco indisponível');
    return responde(legado('senha-antiga-1'))(t, v);
  };
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal((await login('senha-antiga-1')).code, 200);
  } finally {
    console.error = orig;
  }
});
