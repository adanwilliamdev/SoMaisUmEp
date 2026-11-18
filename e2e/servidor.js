// Servidor de teste para o e2e: serve public/ com os MESMOS cabeçalhos do vercel.json (inclusive a CSP) e simula a API
// com a regra de versões do servidor real (campo `atualizado` + `base`: quem grava sem a versão atual recebe conflito).
// Tudo fica na memória; cada teste sobe o seu próprio servidor.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PUBLIC = path.join(RAIZ, 'public');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};
const REGRAS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8')).headers.map(h => ({
  re: new RegExp('^' + h.source + '$'),
  headers: h.headers,
}));

const USUARIO = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com' };
const SENHA = 'senha-certa-1';

function iniciar() {
  const estado = { series: new Map(), tops: new Map(), relogio: 100, pedidos: [], respostasSync: [] };
  const proxima = () => ++estado.relogio;
  const logado = req => /(?:^|;\s*)sessao=ok/.test(req.headers.cookie || '');
  const json = (res, code, corpo, extra = {}) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra });
    res.end(JSON.stringify(corpo));
  };
  const lerCorpo = req =>
    new Promise(ok => {
      let t = '';
      req.on('data', c => (t += c));
      req.on('end', () => ok(t ? JSON.parse(t) : {}));
    });

  // Mesma regra do servidor: gravar linha que já existe exige a versão atual; sem ela (ou com versão velha) vira conflito.
  function gravar(mapa, itens, versoes, conflitos) {
    for (const x of itens) {
      const atual = mapa.get(x.id);
      if (atual && atual.atualizado !== x.base) {
        conflitos.push(x.id);
        continue;
      }
      const { base, ...linha } = x;
      const v = proxima();
      mapa.set(x.id, { ...linha, atualizado: v });
      versoes[x.id] = v;
    }
  }
  function apagar(mapa, itens, conflitos) {
    for (const x of itens) {
      const atual = mapa.get(x.id);
      if (!atual) continue;
      if (atual.atualizado !== x.base) conflitos.push(x.id);
      else mapa.delete(x.id);
    }
  }

  async function api(req, res, url) {
    const rota = url.pathname;
    if (rota === '/api/login' && req.method === 'POST') {
      const b = await lerCorpo(req);
      if (b.email === USUARIO.email && b.senha === SENHA)
        return json(res, 200, { ok: true, usuario: USUARIO }, { 'Set-Cookie': 'sessao=ok; Path=/; HttpOnly; SameSite=Strict' });
      return json(res, 401, { erro: 'E-mail ou senha incorretos' });
    }
    if (!logado(req)) return json(res, 401, { erro: 'Não autorizado' });
    if (rota === '/api/dados') {
      if (url.searchParams.get('r') === 'push') return json(res, 200, { chave: null, inscrito: false });
      return json(res, 200, { usuario: USUARIO, blob: false, series: [...estado.series.values()], tops: [...estado.tops.values()], links: {} });
    }
    if (rota === '/api/sync' && req.method === 'POST') {
      const b = await lerCorpo(req);
      estado.pedidos.push(b);
      const versoes = {},
        conflitos = [];
      gravar(estado.series, b.titulos || [], versoes, conflitos);
      gravar(estado.tops, b.tops || [], versoes, conflitos);
      if (b.del) {
        apagar(estado.series, b.del.titulos || [], conflitos);
        apagar(estado.tops, b.del.tops || [], conflitos);
      }
      const resposta = { ok: true, versoes, conflitos };
      estado.respostasSync.push(resposta);
      return json(res, 200, resposta);
    }
    if (rota === '/api/logout') return json(res, 200, { ok: true }, { 'Set-Cookie': 'sessao=; Path=/; Max-Age=0' });
    return json(res, 404, { erro: 'Fora do escopo do e2e: ' + rota });
  }

  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      const rel = url.pathname === '/' ? '/index.html' : url.pathname;
      const arquivo = path.normalize(path.join(PUBLIC, rel));
      if (!arquivo.startsWith(PUBLIC + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404');
      }
      const cab = { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' };
      for (const r of REGRAS) if (r.re.test(url.pathname)) for (const h of r.headers) cab[h.key] = h.value;
      res.writeHead(200, cab);
      res.end(fs.readFileSync(arquivo));
    } catch (e) {
      json(res, 500, { erro: String(e && e.message) });
    }
  });
  return new Promise(ok =>
    servidor.listen(0, '127.0.0.1', () =>
      ok({ url: 'http://127.0.0.1:' + servidor.address().port, estado, USUARIO, SENHA, fechar: () => new Promise(f => servidor.close(f)) }),
    ),
  );
}

module.exports = { iniciar, USUARIO, SENHA };
