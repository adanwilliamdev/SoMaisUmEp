// Tipos e utilitários seguros para uso no cliente e no servidor (sem segredos, sem I/O).

export type Tipo = "movie" | "tv";

export type Resumo = {
  id: number;
  tipo: Tipo;
  titulo: string;
  ano: string;
  poster: string | null;
  nota: number;
};

export type Pessoa = { id: number; nome: string; papel: string; foto: string | null };

export type Provedor = {
  nome: string;
  logo: string | null;
  categoria: "flatrate" | "rent" | "buy";
};

export type Detalhe = {
  tmdb_id: number;
  tipo: Tipo;
  titulo: string;
  titulo_original: string | null;
  tagline: string | null;
  sinopse: string | null;
  ano: string;
  generos: string[];
  duracao: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  nota: number | null;
  votos: number;
  status: string | null;
  idioma: string | null;
  direcao: string[];
  elenco: Pessoa[];
  trailer: string | null; // chave do vídeo no YouTube
  provedores: Provedor[];
  link_assistir: string | null;
  similares: Resumo[];
  temporadas: number | null;
  episodios: number | null;
  imdb_id: string | null;
};

export type Pagina<T> = { itens: T[]; pagina: number; total: number };

export const IMG_BASE = "https://image.tmdb.org/t/p";

export const img = (path: string | null | undefined, tam = "w500") =>
  path ? `${IMG_BASE}/${tam}${path}` : null;

export function formatarDuracao(min: number | null | undefined): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const rotuloTipo = (t: Tipo) => (t === "tv" ? "Série" : "Filme");
