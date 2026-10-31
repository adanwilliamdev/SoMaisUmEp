import "server-only";
import { cache } from "react";
import { getSupabase } from "./supabase";
import { paraDetalhe, paraResumos } from "./mapeamento";
import type { Parametros } from "./params";
import { MAX_PAGINAS } from "./params";
import type { Detalhe, Pagina, Resumo, Tipo } from "./tipos";

export * from "./tipos";

const BASE = "https://api.themoviedb.org/3";
const CACHE_DIAS = Number(process.env.CACHE_DIAS) || 7;
const TIMEOUT_MS = 8000;

export class NaoEncontrado extends Error {
  constructor() {
    super("Título não encontrado");
  }
}
export class ConfigError extends Error {}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdb<T = any>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  revalidate = 3600
): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  const chave = process.env.TMDB_API_KEY;
  if (!token && !chave) {
    throw new ConfigError(
      "Configure TMDB_API_KEY (ou TMDB_READ_TOKEN) no arquivo .env.local para carregar os títulos."
    );
  }

  const url = new URL(BASE + path);
  if (!token) url.searchParams.set("api_key", chave!);
  url.searchParams.set("language", "pt-BR");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let erro: unknown;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const res = await fetch(url, {
        headers,
        next: { revalidate },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) throw new NaoEncontrado();
      if (res.status === 401) throw new ConfigError("Chave do TMDb inválida (401).");
      erro = new Error(`TMDb respondeu ${res.status}`);
      if (res.status !== 429 && res.status < 500) throw erro;
    } catch (e) {
      if (e instanceof NaoEncontrado || e instanceof ConfigError) throw e;
      erro = e;
    }
    await dormir(300 * 2 ** tentativa); // 300ms, 600ms, 1200ms
  }
  throw erro instanceof Error ? erro : new Error("Falha ao consultar o TMDb");
}

// ---------- Listagens ----------

const hoje = () => new Date().toISOString().slice(0, 10);

export async function listar(
  p: Pick<Parametros, "tipo" | "ordem" | "genero" | "pagina">
): Promise<Pagina<Resumo>> {
  if (p.tipo === "all") {
    const d = await tmdb("/trending/all/week", { page: p.pagina });
    return {
      itens: paraResumos(d.results),
      pagina: p.pagina,
      total: Math.min(d.total_pages ?? 1, MAX_PAGINAS),
    };
  }

  const tv = p.tipo === "tv";
  const campoData = tv ? "first_air_date" : "primary_release_date";
  const params: Record<string, string | number | undefined> = {
    page: p.pagina,
    include_adult: "false",
    with_genres: p.genero,
  };
  if (p.ordem === "popular") {
    params.sort_by = "popularity.desc";
  } else if (p.ordem === "avaliados") {
    params.sort_by = "vote_average.desc";
    params["vote_count.gte"] = tv ? 300 : 1000; // evita títulos obscuros com nota 10 e 3 votos
  } else {
    params.sort_by = `${campoData}.desc`;
    params[`${campoData}.lte`] = hoje();
    params["vote_count.gte"] = 10;
  }
  const d = await tmdb(`/discover/${p.tipo}`, params);
  return {
    itens: paraResumos(d.results, p.tipo),
    pagina: p.pagina,
    total: Math.min(d.total_pages ?? 1, MAX_PAGINAS),
  };
}

export async function buscar(q: string, pagina = 1): Promise<Pagina<Resumo>> {
  const d = await tmdb("/search/multi", { query: q, include_adult: "false", page: pagina }, 600);
  return {
    itens: paraResumos(d.results),
    pagina,
    total: Math.min(d.total_pages ?? 1, MAX_PAGINAS),
  };
}

export const generos = cache(async (tipo: Tipo): Promise<{ id: number; name: string }[]> => {
  const d = await tmdb(`/genre/${tipo}/list`, {}, 86400);
  return d.genres ?? [];
});

// ---------- Detalhes (com cache no Supabase) ----------

async function lerCache(tipo: Tipo, id: number) {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("titulos")
      .select("dados, atualizado_em")
      .eq("tipo", tipo)
      .eq("tmdb_id", id)
      .maybeSingle();
    if (!data?.dados) return null;
    const idadeDias = (Date.now() - new Date(data.atualizado_em).getTime()) / 86400000;
    return { dados: data.dados as Detalhe, idadeDias };
  } catch {
    return null; // cache fora do ar nunca derruba a página
  }
}

async function gravarCache(r: Detalhe) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("titulos").upsert({
      tmdb_id: r.tmdb_id,
      tipo: r.tipo,
      titulo: r.titulo,
      sinopse: r.sinopse,
      ano: r.ano,
      generos: r.generos,
      duracao: r.duracao,
      poster_path: r.poster_path,
      backdrop_path: r.backdrop_path,
      nota: r.nota,
      dados: r,
      atualizado_em: new Date().toISOString(),
    });
  } catch {
    /* melhor esforço */
  }
}

/**
 * Supabase primeiro; se não houver (ou estiver velho), consulta o TMDb e grava.
 * Se o TMDb falhar e existir cache velho, devolve o cache velho (stale-if-error).
 * `cache()` do React evita consultar duas vezes na mesma requisição (metadata + página).
 */
export const detalhes = cache(async (tipo: Tipo, id: number): Promise<Detalhe> => {
  const guardado = await lerCache(tipo, id);
  if (guardado && guardado.idadeDias < CACHE_DIAS) return guardado.dados;

  try {
    const d = await tmdb(
      `/${tipo}/${id}`,
      {
        append_to_response: "credits,videos,watch/providers,similar,external_ids",
        include_video_language: "pt,en,null",
      },
      3600
    );
    const registro = paraDetalhe(d, tipo);
    await gravarCache(registro);
    return registro;
  } catch (e) {
    if (guardado && !(e instanceof NaoEncontrado)) return guardado.dados;
    throw e;
  }
});
