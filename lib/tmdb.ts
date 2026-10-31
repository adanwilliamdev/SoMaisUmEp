import { supabase } from "./supabase";

const BASE = "https://api.themoviedb.org/3";
const CACHE_DIAS = 30;

export type Tipo = "movie" | "tv";
export type Resumo = {
  id: number; tipo: Tipo; titulo: string; ano: string; poster: string | null; nota: number;
};
export type Titulo = {
  tmdb_id: number; tipo: Tipo; titulo: string; sinopse: string | null; ano: string;
  generos: string[]; duracao: number | null; poster_path: string | null;
  backdrop_path: string | null; nota: number | null;
};

async function tmdb(path: string, params: Record<string, string> = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY!);
  url.searchParams.set("language", "pt-BR");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDb respondeu ${res.status}`);
  return res.json();
}

export const img = (path: string | null, tam = "w500") =>
  path ? `https://image.tmdb.org/t/p/${tam}${path}` : null;

function paraResumo(r: any): Resumo | null {
  const tipo = r.media_type ?? (r.title ? "movie" : "tv");
  if (tipo !== "movie" && tipo !== "tv") return null;
  return {
    id: r.id, tipo,
    titulo: r.title ?? r.name,
    ano: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
    poster: r.poster_path, nota: Math.round((r.vote_average ?? 0) * 10) / 10,
  };
}

export async function emAlta(): Promise<Resumo[]> {
  const d = await tmdb("/trending/all/week");
  return d.results.map(paraResumo).filter(Boolean);
}

export async function buscar(q: string): Promise<Resumo[]> {
  const d = await tmdb("/search/multi", { query: q, include_adult: "false" });
  return d.results.map(paraResumo).filter(Boolean);
}

// Busca no Supabase primeiro; se não houver (ou estiver velho), vai ao TMDb e salva.
export async function detalhes(tipo: Tipo, id: number): Promise<Titulo> {
  const { data: cache } = await supabase
    .from("titulos").select("*").eq("tipo", tipo).eq("tmdb_id", id).maybeSingle();

  const idadeDias = cache
    ? (Date.now() - new Date(cache.atualizado_em).getTime()) / 86400000
    : Infinity;
  if (cache && idadeDias < CACHE_DIAS) return cache as Titulo;

  const d = await tmdb(`/${tipo}/${id}`);
  const registro: Titulo = {
    tmdb_id: id, tipo,
    titulo: d.title ?? d.name,
    sinopse: d.overview || null,
    ano: (d.release_date ?? d.first_air_date ?? "").slice(0, 4),
    generos: (d.genres ?? []).map((g: any) => g.name),
    duracao: d.runtime ?? d.episode_run_time?.[0] ?? null,
    poster_path: d.poster_path, backdrop_path: d.backdrop_path,
    nota: Math.round((d.vote_average ?? 0) * 10) / 10,
  };
  await supabase.from("titulos").upsert({ ...registro, atualizado_em: new Date().toISOString() });
  return registro;
}
