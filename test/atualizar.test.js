// Verificação diária do próximo lançamento pelo servidor (api/_atualizar.js) e sua ordem dentro do cron.
// Banco, TMDb e relógio são falsos: o que se confere é a lógica (dedup, cursor, orçamento, falhas, regra de "hoje").
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const banco = { consultas: [], resposta: () => [] };
const falsos = {
  '@neondatabase/serverless': {
    neon: () => {
      const sql = (strings, ...vals) => {
        const texto = strings.join('?').replace(/\s+/g, ' ').trim();
        banco.consultas.push({ texto, vals });
        return Promise.resolve(banco.resposta(texto, vals));
      };
      sql.transaction = qs => Promise.all(qs);
      return sql;
    },
  },
  '@vercel/blob': { list: async () => ({ blobs: [], hasMore: false }), del: async () => {} },
};
const carregar = Module._load;
Module._load = function (req, ...resto) {
  return falsos[req] || carregar.call(this, req, ...resto);
};

const { atualizarProximos } = require('../api/_atualizar');

const AGORA = Date.UTC(2026, 10, 14, 11, 0, 0); // 14/11/2026 11:00 UTC
const HOJE = '2026-11-14';
const limpar = () => {
  banco.consultas = [];
  banco.resposta = () => [];
};
const selects = () => banco.consultas.filter(c => /group by tipo, tmdb/.test(c.texto));
const updates = () => banco.consultas.filter(c => /^update titulos set/.test(c.texto));
const sql = (strings, ...vals) => falsos['@neondatabase/serverless'].neon()(strings, ...vals);

test('atualizarProximos: sem TMDb configurado não consulta nada (e não falha)', async () => {
  limpar();
  delete process.env.TMDB_READ_TOKEN;
  delete process.env.TMDB_API_KEY;
  assert.deepEqual(await atualizarProximos(sql, { agora: AGORA }), { ativo: false });
  assert.equal(banco.consultas.length, 0);
});

test('atualizarProximos: a fila é agrupada por (tipo, tmdb) entre contas, vai dos mais antigos e respeita o limite', async () => {
  limpar();
  await atualizarProximos(sql, { agora: AGORA, hoje: HOJE, buscar: async () => ({ proximo: null }), max: 25 });
  const [s] = selects();
  assert.ok(s, 'consulta a fila');
  assert.match(s.texto, /group by tipo, tmdb/);
  assert.match(s.texto, /order by min\(coalesce\(tmdb_verificado, 0\)\)/); // cursor: o verificado há mais tempo primeiro
  assert.match(s.texto, /\(tipo = 'tv' or proximo is not null\)/); // filme só com estreia marcada
  assert.match(s.texto, /bool_or\(proximo is not null\)/); // com data: 20 h; sem data: 6 dias
  assert.ok(s.vals.includes(AGORA - 20 * 36e5) && s.vals.includes(AGORA - 6 * 864e5) && s.vals.includes(25));
});

test('atualizarProximos: uma consulta ao TMDb e um update por título, valendo para todas as contas', async () => {
  limpar();
  const fila = [
    { tipo: 'tv', tmdb: 100 },
    { tipo: 'movie', tmdb: 200 },
  ];
  const linhas = [{ mudou: true }, { mudou: true }, { mudou: false }];
  banco.resposta = t => (/group by tipo, tmdb/.test(t) ? fila : /^update titulos set/.test(t) ? linhas : []);
  const chamadas = [];
  const buscar = async (tipo, id) => {
    chamadas.push([tipo, id]);
    return { proximo: tipo === 'tv' ? { d: '2026-11-20', t: 2, e: 3 } : null };
  };
  const r = await atualizarProximos(sql, { agora: AGORA, hoje: HOJE, buscar });
  assert.deepEqual(chamadas, [
    ['tv', 100],
    ['movie', 200],
  ]);
  assert.equal(updates().length, 2); // um por título, não um por conta
  assert.deepEqual(r, { ativo: true, hoje: HOJE, candidatos: 2, consultados: 2, atualizados: 4, falhas: 0, interrompido: false });
  const u = updates()[0];
  assert.ok(u.vals.includes(JSON.stringify({ d: '2026-11-20', t: 2, e: 3 })) && u.vals.includes('tv') && u.vals.includes(100) && u.vals.includes(AGORA));
  assert.ok(updates()[1].vals.includes(null)); // filme sem estreia futura: proximo vira null
});

test('atualizarProximos: não troca a data de quem sai HOJE (o aviso ainda não foi enviado)', async () => {
  limpar();
  banco.resposta = t => (/group by tipo, tmdb/.test(t) ? [{ tipo: 'tv', tmdb: 100 }] : [{ mudou: false }]);
  await atualizarProximos(sql, { agora: AGORA, hoje: HOJE, buscar: async () => ({ proximo: { d: '2026-11-21' } }) });
  const u = updates()[0];
  assert.match(u.texto, /proximo = case when coalesce\(proximo->>'d', ''\) = \? then proximo else/);
  assert.match(u.texto, /atualizado = case when coalesce\(proximo->>'d', ''\) <> \? and proximo is distinct from/);
  assert.equal(u.vals.filter(v => v === HOJE).length, 2);
});

test('atualizarProximos: título que falha é marcado como verificado sem mexer na data, e os outros seguem', async () => {
  limpar();
  const fila = [
    { tipo: 'tv', tmdb: 1 },
    { tipo: 'tv', tmdb: 2 },
  ];
  banco.resposta = t => (/group by tipo, tmdb/.test(t) ? fila : [{ mudou: true }]);
  const buscar = async (tipo, id) => {
    if (id === 1) throw new Error('404');
    return { proximo: { d: '2026-12-01' } };
  };
  const r = await atualizarProximos(sql, { agora: AGORA, hoje: HOJE, buscar });
  assert.equal(r.falhas, 1);
  assert.equal(r.consultados, 1);
  const marca = updates().find(u => u.vals.includes(1));
  assert.ok(marca && !/proximo/.test(marca.texto) && marca.vals.includes(AGORA));
  assert.equal(r.interrompido, false);
});

test('atualizarProximos: cinco falhas seguidas (TMDb fora do ar) interrompem a rodada', async () => {
  limpar();
  const fila = Array.from({ length: 12 }, (_, i) => ({ tipo: 'tv', tmdb: i + 1 }));
  banco.resposta = t => (/group by tipo, tmdb/.test(t) ? fila : []);
  let chamadas = 0;
  const r = await atualizarProximos(sql, {
    agora: AGORA,
    hoje: HOJE,
    paralelo: 5,
    buscar: async () => {
      chamadas++;
      throw new Error('fora do ar');
    },
  });
  assert.equal(chamadas, 5); // só o primeiro grupo
  assert.equal(r.falhas, 5);
  assert.equal(r.interrompido, true);
});

test('atualizarProximos: para ao estourar o orçamento de tempo e deixa o resto para a próxima execução', async () => {
  limpar();
  const fila = Array.from({ length: 10 }, (_, i) => ({ tipo: 'tv', tmdb: i + 1 }));
  banco.resposta = t => (/group by tipo, tmdb/.test(t) ? fila : [{ mudou: false }]);
  let t = 0;
  const relogio = () => (t += 7000); // cada checagem "gasta" 7 s
  const vistos = [];
  const r = await atualizarProximos(sql, {
    agora: AGORA,
    hoje: HOJE,
    paralelo: 2,
    orcamentoMs: 12000,
    relogio,
    buscar: async (tipo, id) => {
      vistos.push(id);
      return { proximo: null };
    },
  });
  assert.ok(vistos.length < fila.length && vistos.length > 0);
  assert.equal(r.interrompido, true);
  assert.equal(r.candidatos, 10);
});

test('atualizarProximos: sem candidatos só faz a consulta da fila', async () => {
  limpar();
  const r = await atualizarProximos(sql, { agora: AGORA, hoje: HOJE, buscar: async () => assert.fail('não deveria consultar') });
  assert.equal(banco.consultas.length, 1);
  assert.equal(r.candidatos, 0);
  assert.equal(r.interrompido, false);
});

test('cron: atualiza as datas ANTES dos avisos e uma falha nessa etapa não impede o resto', async () => {
  const cron = require('../api/cron');
  process.env.CRON_SECRET = 'segredo-do-cron';
  process.env.TMDB_READ_TOKEN = 'eyJteXRva2Vu';
  const fetchOriginal = global.fetch;
  const detalheTmdb = {
    id: 100,
    name: 'Série',
    seasons: [{ season_number: 1, episode_count: 8 }],
    next_episode_to_air: { air_date: '2099-01-01', season_number: 1, episode_number: 2 },
  };
  global.fetch = async () => ({ ok: true, json: async () => detalheTmdb });
  const novoRes = () => ({
    h: {},
    code: 200,
    setHeader(k, v) {
      this.h[k] = v;
    },
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  });
  const req = { method: 'GET', headers: { authorization: 'Bearer segredo-do-cron' }, query: {} };
  try {
    limpar();
    banco.resposta = t => {
      if (/with d as \(delete/.test(t)) return [{ n: 0 }];
      if (/group by tipo, tmdb/.test(t)) return [{ tipo: 'tv', tmdb: 100 }];
      return /^update titulos set/.test(t) ? [{ mudou: true }] : [];
    };
    const res = novoRes();
    await cron(req, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.proximos.ativo, true);
    assert.equal(res.body.proximos.candidatos, 1);
    assert.equal(res.body.proximos.atualizados, 1);
    assert.ok(updates()[0].vals.includes(JSON.stringify({ d: '2099-01-01', t: 1, e: 2 })));

    // Falha na etapa das datas (banco recusa o update): o cron continua e responde 200.
    limpar();
    const erroErr = console.error;
    console.error = () => {};
    banco.resposta = t => {
      if (/group by tipo, tmdb/.test(t)) throw new Error('boom');
      return /with d as \(delete/.test(t) ? [{ n: 0 }] : [];
    };
    const res2 = novoRes();
    await cron(req, res2);
    console.error = erroErr;
    assert.equal(res2.code, 200);
    assert.deepEqual(res2.body.proximos, { ativo: true, erro: true });
    assert.deepEqual(res2.body.push, { ativo: false });
  } finally {
    global.fetch = fetchOriginal;
    delete process.env.CRON_SECRET;
    delete process.env.TMDB_READ_TOKEN;
  }
});

test('vercel.json: o cron tem tempo para as datas, os avisos e a faxina; o schema inclui a migração 006', () => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.ok(v.functions['api/cron.js'].maxDuration >= 60);
  const schema = fs.readFileSync(path.join(__dirname, '..', 'neon', 'schema.sql'), 'utf8');
  assert.match(schema, /add column if not exists tmdb_verificado bigint/);
  assert.match(schema, /'006_verificacao_proximo'/);
});
