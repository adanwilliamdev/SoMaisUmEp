// Aplica o tema salvo antes de a página aparecer (evita o "flash" de tema errado).
(function () {
  try { var t = localStorage.getItem('claq:tema'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* sem armazenamento */ }
})();
