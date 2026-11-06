// Migra as chaves antigas do localStorage e aplica o tema salvo antes de a página aparecer (evita o "flash" de tema errado).
(function () {
  try {
    // Migração única: as chaves antigas (prefixo "claq:", do nome Claquete) viram "smue:" sem perder tema, ordem nem cópia offline.
    ['snap', 'tema', 'ordem', 'push', 'upd', 'hoje'].forEach(k => {
      const antigo = localStorage.getItem('claq:' + k);
      if (antigo === null) return;
      if (localStorage.getItem('smue:' + k) === null) localStorage.setItem('smue:' + k, antigo);
      localStorage.removeItem('claq:' + k);
    });
    const t = localStorage.getItem('smue:tema');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    /* sem armazenamento */
  }
})();
