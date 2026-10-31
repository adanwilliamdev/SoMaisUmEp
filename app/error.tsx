"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="estado">
      <h1 className="frase">Corta! Algo deu errado.</h1>
      <p className="vazio">Não conseguimos carregar esta página agora. Tente novamente em instantes.</p>
      <button type="button" className="btn-lista" onClick={reset}>Tentar de novo</button>
    </main>
  );
}
