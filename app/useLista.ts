"use client";
import { useCallback, useEffect, useState } from "react";
import type { Resumo } from "@/lib/tipos";

const CHAVE = "claquete:lista:v1";

function ler(): Resumo[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

/** "Minha lista" guardada no navegador (localStorage). Sincroniza entre abas. */
export function useLista() {
  const [itens, setItens] = useState<Resumo[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setItens(ler());
    setPronto(true);
    const aoMudar = (e: StorageEvent) => {
      if (e.key === CHAVE) setItens(ler());
    };
    window.addEventListener("storage", aoMudar);
    return () => window.removeEventListener("storage", aoMudar);
  }, []);

  const salvar = useCallback((novos: Resumo[]) => {
    setItens(novos);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novos));
    } catch {
      /* armazenamento indisponível: mantém só em memória */
    }
  }, []);

  const tem = useCallback(
    (t: Pick<Resumo, "id" | "tipo">) => itens.some((i) => i.id === t.id && i.tipo === t.tipo),
    [itens]
  );

  const alternar = useCallback(
    (t: Resumo) => {
      const atual = ler();
      const existe = atual.some((i) => i.id === t.id && i.tipo === t.tipo);
      salvar(
        existe ? atual.filter((i) => !(i.id === t.id && i.tipo === t.tipo)) : [t, ...atual]
      );
    },
    [salvar]
  );

  return { itens, pronto, tem, alternar, limpar: () => salvar([]) };
}
