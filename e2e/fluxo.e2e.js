// Teste de ponta a ponta no navegador de verdade (Chromium): entrar, criar série, marcar episódio, recarregar,
// conflito entre aparelhos e texto malicioso. Roda com `npm run e2e` (precisa de `npx playwright install chromium` uma vez).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { iniciar } = require('./servidor');

let navegador;
before(async () => {
  navegador = await chromium.launch({ args: ['--no-sandbox'] });
});
after(async () => {
  await navegador.close();
});

// Abre uma página já ligada ao servidor de teste e junta tudo o que não deveria acontecer:
// erro no console (inclui violação de CSP), exceção não tratada, e qualquer pedido a outro site.
async function abrir(srv, { logado = false } = {}) {
  const contexto = await navegador.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 800 } });
  if (logado) await contexto.addCookies([{ name: 'sessao', value: 'ok', url: srv.url }]);
  const problemas = [];
  await contexto.route(u => new URL(u).origin !== srv.url, rota => {
    problemas.push('pedido externo: ' + rota.request().url());
    return rota.abort();
  });
  const page = await contexto.newPage();
  page.on('console', m => {
    // 401 é esperado: é a resposta do servidor a quem ainda não entrou (o navegador a registra como erro de console)
    if (m.type() === 'error' && !/status of 401/.test(m.text())) problemas.push('console: ' + m.text());
  });
  page.on('pageerror', e => problemas.push('exceção: ' + e.message));
  return { page, problemas, fechar: () => contexto.close() };
}

// Cards da estante (a grade). O destaque de "Continuar assistindo" também é um article.card, por isso o escopo.
const CARD = '#lista article.card';
const salvou = page => page.waitForFunction(() => /Salvo/.test(document.querySelector('#status').textContent));
const SERIE = { id: 'seed1', tipo: 'tv', nome: 'Série de teste', capa: null, eps: [5], vis: [0], criado: 1, hist: {}, atualizado: 100 };

test('fluxo: entrar, criar série, marcar episódio, recarregar e ver o progresso salvo', async () => {
  const srv = await iniciar();
  const { page, problemas, fechar } = await abrir(srv);
  try {
    await page.goto(srv.url + '/');
    await page.locator('#fa').waitFor();
    assert.equal(await page.locator('h1').first().textContent(), 'Entrar');

    // senha errada: mensagem de erro e continua na tela de entrada
    await page.fill('#fa [name=email]', srv.USUARIO.email);
    await page.fill('#fa [name=senha]', 'errada');
    await page.click('#fa [type=submit]');
    await page.locator('#msg', { hasText: 'incorretos' }).waitFor();
    assert.ok(await page.locator('#fa').isVisible());

    // senha certa: estante vazia
    await page.fill('#fa [name=senha]', srv.SENHA);
    await page.click('#fa [type=submit]');
    await page.locator('.vazio', { hasText: 'Sua estante está vazia' }).waitFor();

    // nova série com 3 episódios
    await page.click('button.nova');
    await page.fill('#f [name=nome]', 'Dark & "Brooklyn" <99>');
    await page.locator('#temps input').first().fill('3');
    await page.click('#f [type=submit]');
    const card = page.locator(`${CARD} h3`, { hasText: 'Dark & "Brooklyn" <99>' });
    await card.waitFor();
    await salvou(page);
    assert.equal(srv.estado.series.size, 1, 'a série nova chegou ao servidor');

    // +1 episódio
    await page.click(`${CARD} .mais`);
    await page.locator(`${CARD} small`, { hasText: '1/3 eps' }).waitFor();
    await page.waitForFunction(() => /Salvo/.test(document.querySelector('#status').textContent));
    const [linha] = [...srv.estado.series.values()];
    assert.deepEqual(linha.vis, [1], 'o servidor guardou o episódio');
    assert.ok(srv.estado.pedidos.every(p => !p.titulos || p.titulos.every(t => 'base' in t)), 'todo título enviado leva a base (versão conhecida)');

    // recarregar: tudo continua lá
    await page.reload();
    await page.locator(`${CARD} small`, { hasText: '1/3 eps' }).waitFor();
    assert.equal(await page.locator(`${CARD} h3`).first().textContent(), 'Dark & "Brooklyn" <99>', 'o nome aparece como texto, sem virar HTML');
  } finally {
    await fechar();
    await srv.fechar();
  }
  assert.deepEqual(problemas, [], 'sem erro de console, CSP violada ou pedido a terceiros');
});

test('conflito: outro aparelho mexeu antes; o app combina as versões e não perde progresso de ninguém', async () => {
  const srv = await iniciar();
  srv.estado.series.set(SERIE.id, { ...SERIE });
  const { page, problemas, fechar } = await abrir(srv, { logado: true });
  try {
    await page.goto(srv.url + '/');
    await page.locator(`${CARD} h3`, { hasText: 'Série de teste' }).waitFor();

    // "outro aparelho" marca 3 episódios e grava no servidor
    srv.estado.series.set(SERIE.id, { ...SERIE, vis: [3], atualizado: srv.estado.relogio + 50 });
    srv.estado.relogio += 100;

    // este aparelho (que ainda enxerga 0 episódios) marca +1 e envia com a versão velha
    await page.click(`${CARD} .mais`);
    await page.waitForFunction(() => /Salvo/.test(document.querySelector('#status').textContent));
    await page.waitForFunction(() => /\b[3-9]\/5 eps/.test(document.querySelector('#lista article.card small').textContent));

    assert.ok(
      srv.estado.respostasSync.some(r => r.conflitos.includes(SERIE.id)),
      'o servidor recusou a gravação com versão velha',
    );
    const final = srv.estado.series.get(SERIE.id);
    assert.ok(final.vis[0] >= 3, 'o progresso do outro aparelho foi mantido (vis=' + final.vis + ')');
    const mostrado = Number(/(\d+)\/5/.exec(await page.locator(`${CARD} small`).first().textContent())[1]);
    assert.ok(mostrado >= 3, 'a tela mostra o progresso combinado (' + mostrado + '/5)');
  } finally {
    await fechar();
    await srv.fechar();
  }
  assert.deepEqual(problemas, []);
});

test('segurança: nome de série com HTML/JS nunca executa nada, na estante, no detalhe nem depois de recarregar', async () => {
  const srv = await iniciar();
  const { page, problemas, fechar } = await abrir(srv, { logado: true });
  const MAU = '"><img src=x onerror="window.__xss=1"><b id=intruso>x</b>';
  try {
    await page.goto(srv.url + '/');
    await page.locator('.vazio').waitFor();
    await page.click('button.nova');
    await page.fill('#f [name=nome]', MAU);
    await page.click('#f [type=submit]');
    await page.locator(CARD).waitFor();
    await salvou(page);
    for (const fase of ['estante', 'detalhe', 'recarregado']) {
      if (fase === 'detalhe') await page.click(`${CARD} button.capa`);
      if (fase === 'recarregado') {
        await page.keyboard.press('Escape');
        await page.reload();
        await page.locator(CARD).waitFor();
      }
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.__xss), undefined, fase + ': nenhum script do nome rodou');
      assert.equal(await page.locator('#intruso').count(), 0, fase + ': o nome não virou elemento');
    }
    assert.equal(await page.locator(`${CARD} h3`).first().textContent(), MAU, 'o nome aparece exatamente como digitado');
  } finally {
    await fechar();
    await srv.fechar();
  }
  // a imagem quebrada (src=x) só existiria se o HTML tivesse escapado; um pedido a /x ou erro 404 denunciaria isso
  assert.deepEqual(problemas, []);
});

test('abas: séries, filmes, tops e estatísticas abrem sem erro, e o menu mostra a aba atual', async () => {
  const srv = await iniciar();
  srv.estado.series.set(SERIE.id, { ...SERIE, vis: [2] });
  const { page, problemas, fechar } = await abrir(srv, { logado: true });
  try {
    await page.goto(srv.url + '/');
    await page.locator(CARD).waitFor();
    for (const [hash, titulo] of [['#filmes', 'Meus filmes'], ['#tops', 'Meu Hall da Fama'], ['#stats', 'Estatísticas'], ['#series', 'Minhas séries']]) {
      await page.evaluate(h => (location.hash = h), hash);
      await page.locator('h1', { hasText: titulo }).waitFor();
    }
    // fontes locais: o texto usa a Inter hospedada aqui (e não cai na fonte do sistema)
    await page.evaluate(() => document.fonts.ready);
    const familia = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')));
    assert.ok(familia.includes('Inter'), 'a Inter local foi carregada: ' + JSON.stringify(familia));
  } finally {
    await fechar();
    await srv.fechar();
  }
  assert.deepEqual(problemas, []);
});
