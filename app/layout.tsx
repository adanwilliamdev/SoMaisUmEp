import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claquete — sinopses de filmes e séries",
  description: "Descubra filmes e séries e leia a sinopse em português.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;800&family=Instrument+Sans:wght@400;600;700&display=swap"
        />
      </head>
      <body>
        <div className="wrap">
          <header className="topo">
            <Link href="/" className="marca"><i aria-hidden /> Claquete</Link>
          </header>
          {children}
          <footer className="rodape">
            <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
            {/* Baixe o logo oficial em themoviedb.org/about/logos-attribution e salve em /public/tmdb.svg */}
            <img src="/tmdb.svg" alt="TMDB" />
          </footer>
        </div>
      </body>
    </html>
  );
}
