#!/usr/bin/env python3
"""Gera os PNGs do ícone do app (public/icons/*.png) a partir da mesma geometria de public/icons/icon.svg.

Uso:  python3 scripts/gerar-icones.py      (precisa de Pillow e numpy; é só para quem mexe na marca, o app não depende disto)

Se mudar o desenho ou as cores, altere icon.svg e as constantes abaixo juntos. Tamanhos: 192 e 512 (cantos arredondados,
fundo transparente), maskable 512 (quadrado, ingresso menor para caber na zona segura) e apple-touch-icon 180 (quadrado, sem transparência).
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw

CORAL_A, CORAL_B = (0xFF, 0x84, 0x60), (0xE0, 0x3D, 0x1F)
TINTA, CREME, PLAY = (0x14, 0x16, 0x1A), (0xFB, 0xF3, 0xE2), (0xE8, 0x45, 0x2A)
ANG = math.radians(-8)
SS = 4  # supersampling

def quad(p0, p1, p2, n=14):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(1, n + 1)]]

def arco(cx, cy, r, a0, a1, n=24):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

def ingresso():
    # Mesmo contorno do <path> do icon.svg: retângulo de cantos arredondados com um entalhe semicircular em cada lado.
    p = [(100, 160), (412, 160)]
    p += quad((412, 160), (436, 160), (436, 184))
    p += [(436, 228)]
    p += [(436 - 28 * math.sin(math.pi * i / 24), 256 - 28 * math.cos(math.pi * i / 24)) for i in range(25)]
    p += [(436, 328)]
    p += quad((436, 328), (436, 352), (412, 352))
    p += [(100, 352)]
    p += quad((100, 352), (76, 352), (76, 328))
    p += [(76, 284)]
    p += [(76 + 28 * math.sin(math.pi * i / 24), 256 + 28 * math.cos(math.pi * i / 24)) for i in range(25)]
    p += [(76, 184)]
    p += quad((76, 184), (76, 160), (100, 160))
    return p

def rrect(x, y, w, h, r, n=8):
    pts = []
    for cx, cy, a in [(x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)]:
        pts += arco(cx, cy, r, math.radians(a), math.radians(a + 90), n)
    return pts

def gradiente(n):
    t = (np.add.outer(np.arange(n), np.arange(n)) / (2.0 * (n - 1))).astype(np.float32)[..., None]
    a, b = np.array(CORAL_A, np.float32), np.array(CORAL_B, np.float32)
    rgb = a + (b - a) * t
    return Image.fromarray(np.dstack([rgb, np.full((n, n, 1), 255, np.float32)]).astype(np.uint8), 'RGBA')

def desenhar(tam, arredondado=True, escala=1.0, simples=False):
    n = tam * SS
    k = n / 512.0
    img = gradiente(n)
    if arredondado:
        m = Image.new('L', (n, n), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, n - 1, n - 1], radius=118 * k, fill=255)
        img.putalpha(m)

    def T(pts, dx=0, dy=0, esc=1.0):
        out = []
        for x, y in pts:
            x, y = (x + dx - 256) * esc, (y + dy - 256) * esc
            xr, yr = x * math.cos(ANG) - y * math.sin(ANG), x * math.sin(ANG) + y * math.cos(ANG)
            out.append(((256 + xr * escala) * k, (256 + yr * escala) * k))
        return out

    def camada(fn):
        c = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        fn(ImageDraw.Draw(c))
        return Image.alpha_composite(img, c)

    ing = ingresso()
    es = 1.12 if simples else 1.0
    cont = 14 if simples else 10
    if not simples:
        img = camada(lambda d: d.polygon(T(ing, 12, 12), fill=TINTA + (82,)))
    img = camada(lambda d: d.polygon(T(ing, esc=es), fill=CREME + (255,)))
    img = camada(lambda d: d.line(T(ing + ing[:2], esc=es), fill=TINTA + (255,), width=round(cont * escala * es * k), joint='curve'))
    if not simples:
        def perfura(d):
            y = 178
            while y < 334:
                d.polygon(T([(337, y), (343, y), (343, min(y + 10, 334)), (337, min(y + 10, 334))]), fill=TINTA + (255,))
                y += 22
        img = camada(perfura)
    dx = 41 if simples else 0
    mais = [(140, 243 if simples else 247, 64, 26 if simples else 18, 12 if simples else 9), (159 if simples else 163, 224, 26 if simples else 18, 64, 12 if simples else 9)]
    um = (268, 206 if simples else 210, 34 if simples else 26, 100 if simples else 92, 12 if simples else 9)
    flag = [(268, 212 if simples else 214), (232 if simples else 238, 240), (232 if simples else 238, 266 if simples else 262), (268, 242 if simples else 242)]
    def glifos(d):
        for r in mais + [um]:
            d.polygon(T(rrect(r[0], r[1], r[2], r[3], r[4]), dx, 0, es), fill=TINTA + (255,))
        d.polygon(T(flag, dx, 0, es), fill=TINTA + (255,))
    img = camada(glifos)
    if not simples:
        tri = [(366, 226), (366, 286), (406, 256)]
        img = camada(lambda d: d.polygon(T(tri), fill=PLAY + (255,)))
        img = camada(lambda d: d.line(T(tri + tri[:2]), fill=TINTA + (255,), width=round(6 * escala * k), joint='curve'))
    return img.resize((tam, tam), Image.LANCZOS)

if __name__ == '__main__':
    saida = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
    desenhar(512).save(os.path.join(saida, 'icon-512.png'), optimize=True)
    desenhar(192).save(os.path.join(saida, 'icon-192.png'), optimize=True)
    desenhar(512, arredondado=False, escala=0.88).save(os.path.join(saida, 'icon-maskable-512.png'), optimize=True)
    desenhar(180, arredondado=False).convert('RGB').save(os.path.join(saida, 'apple-touch-icon.png'), optimize=True)
    print('ícones gerados em', os.path.abspath(saida))
