import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="estado">
      <h1 className="frase">Cena não encontrada</h1>
      <p className="vazio">Esse título não existe ou foi removido do TMDb.</p>
      <Link href="/" className="voltar">Voltar para o início</Link>
    </main>
  );
}
