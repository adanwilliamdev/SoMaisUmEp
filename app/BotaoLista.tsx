"use client";
import type { Resumo } from "@/lib/tipos";
import { useLista } from "./useLista";

export default function BotaoLista({ titulo }: { titulo: Resumo }) {
  const { tem, alternar, pronto } = useLista();
  const salvo = pronto && tem(titulo);
  return (
    <button
      type="button"
      className={`btn-lista${salvo ? " ativo" : ""}`}
      aria-pressed={salvo}
      onClick={() => alternar(titulo)}
    >
      {salvo ? "✓ Na minha lista" : "+ Minha lista"}
    </button>
  );
}
