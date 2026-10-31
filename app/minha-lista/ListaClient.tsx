"use client";
import Link from "next/link";
import Cards from "../Cards";
import { useLista } from "../useLista";

export default function ListaClient() {
  const { itens, pronto, alternar, limpar } = useLista();

  if (!pronto) return <p className="vazio" aria-live="polite">Carregando…</p>;
  if (!itens.length)
    return (
      <p className="vazio">
        Sua lista está vazia. <Link href="/" className="voltar">Descubra algo para assistir</Link>
      </p>
    );

  return (
    <>
      <div className="acoes-lista">
        <span>{itens.length} {itens.length === 1 ? "título" : "títulos"}</span>
        <button type="button" className="btn-sec" onClick={() => confirm("Remover todos os títulos da lista?") && limpar()}>
          Limpar lista
        </button>
      </div>
      <Cards itens={itens} acao={{ rotulo: "Remover", onClick: alternar }} />
    </>
  );
}
