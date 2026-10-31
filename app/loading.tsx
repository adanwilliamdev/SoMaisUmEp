export default function Carregando() {
  return (
    <main aria-busy="true" aria-label="Carregando">
      <div className="esqueleto titulo-esq" />
      <div className="grade">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="esqueleto capa-esq" />
        ))}
      </div>
    </main>
  );
}
