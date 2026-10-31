"use client";
import { useState } from "react";

/** Só carrega o player do YouTube depois do clique (página mais leve e sem rastreio prévio). */
export default function Trailer({ chave, titulo }: { chave: string; titulo: string }) {
  const [tocando, setTocando] = useState(false);

  return (
    <div className="trailer">
      {tocando ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(chave)}?autoplay=1&rel=0`}
          title={`Trailer de ${titulo}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setTocando(true)} aria-label={`Assistir ao trailer de ${titulo}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${encodeURIComponent(chave)}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="play" aria-hidden>▶</span>
        </button>
      )}
    </div>
  );
}
