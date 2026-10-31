import type { Metadata } from "next";
import ListaClient from "./ListaClient";

export const metadata: Metadata = {
  title: "Minha lista",
  robots: { index: false },
};

export default function MinhaLista() {
  return (
    <main>
      <h1 className="frase">Minha lista</h1>
      <p className="vazio" style={{ paddingTop: 0 }}>
        Filmes e séries que você salvou. Ficam guardados só neste navegador.
      </p>
      <ListaClient />
    </main>
  );
}
