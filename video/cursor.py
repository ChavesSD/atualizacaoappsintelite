"""Desenha um cursor e um anel de clique (azul da marca) sobre a gravação da tela do Mini PC.

Lê raw/take.mp4 e raw/take.taps.json (com `offset`, gerado por calib.py) e grava raw/take.cur.mp4 (30 fps constante, 1280x720):
  - o cursor aparece um pouco antes do primeiro toque e desliza (suavizado) de um toque ao seguinte;
  - em cada toque: o cursor "aperta" e um anel azul se expande e some (ajuda a achar o ponto do clique mesmo em tela cheia);
  - some depois do último toque.
Uso:  python cursor.py [--take raw/take.mp4] [--taps raw/take.taps.json] [--out raw/take.cur.mp4] [--length 130]
"""
import argparse, json, math, pathlib, subprocess, sys

from PIL import Image, ImageDraw, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
W, H, FPS = 1280, 720, 30
BRAND = (76, 155, 255)

APPROACH = 0.65      # s antes do toque em que o cursor começa a deslizar
PRESS = 0.2          # s do "aperto"
RING = 0.75          # s do anel de clique
LEAD_IN = 1.5        # s antes do primeiro toque em que o cursor aparece
HOLD_OUT = 1.4       # s depois do último toque até começar a sumir


def smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def make_cursor(scale=1.0):
    """Ponteiro de seta, branco com contorno escuro e sombra; a ponta fica em (pad, pad)."""
    k = 4
    pts = [(0, 0), (0, 28), (7, 21.5), (12, 33), (17, 30.8), (12.2, 19.6), (21, 19.6)]
    pad = 18
    size = (46 * k, 58 * k)
    big = Image.new("RGBA", (size[0] + pad * 2 * k, size[1] + pad * 2 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    poly = [(pad * k + x * k * 1.5, pad * k + y * k * 1.5) for x, y in pts]
    shadow = Image.new("RGBA", big.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon([(x + 3 * k, y + 5 * k) for x, y in poly], fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(3 * k))
    big.alpha_composite(shadow)
    d.polygon(poly, fill=(14, 16, 22, 255))
    inner = Image.new("RGBA", big.size, (0, 0, 0, 0))
    ImageDraw.Draw(inner).polygon(poly, fill=(255, 255, 255, 255))
    inner = inner.filter(ImageFilter.MinFilter(2 * k + 1))  # encolhe: sobra o contorno escuro
    big.alpha_composite(inner)
    w, h = big.size
    out = big.resize((int(w / k * scale), int(h / k * scale)), Image.LANCZOS)
    return out, int(pad * scale)


def ring_layer(u):
    """Anel de clique: u de 0 a 1. Devolve uma imagem RGBA quadrada centrada no ponto."""
    size = 220
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = 16 + 62 * (1 - (1 - u) ** 3)
    a = int(255 * (1 - u) ** 1.4)
    c = size // 2
    d.ellipse((c - r, c - r, c + r, c + r), fill=BRAND + (int(a * 0.22),), outline=BRAND + (int(a * 0.95),), width=5)
    r2 = r * 0.55
    d.ellipse((c - r2, c - r2, c + r2, c + r2), outline=(255, 255, 255, int(a * 0.7)), width=3)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--take", default=str(HERE / "raw" / "take.mp4"))
    ap.add_argument("--taps", default=str(HERE / "raw" / "take.taps.json"))
    ap.add_argument("--out", default=str(HERE / "raw" / "take.cur.mp4"))
    ap.add_argument("--length", type=float, default=130.0, help="duração total do arquivo de saída (o último quadro é congelado)")
    ap.add_argument("--cover", action="append", default=[], metavar="T0,X,Y,W,H",
                    help="tarja sólida sobre um trecho da tela a partir de T0 (ex.: o letreiro de notícias do aplicativo): 108.5,0,664,1280,56")
    a = ap.parse_args()

    data = json.loads(pathlib.Path(a.taps).read_text(encoding="utf-8"))
    off = float(data.get("offset", 0))
    taps = [(t["t"] - off, t["x"], t["y"]) for t in data["taps"] if t["t"] - off >= 0]
    if not taps:
        sys.exit("nenhum toque dentro do vídeo")
    taps.sort()
    covers = [tuple(float(v) for v in c.split(",")) for c in a.cover]
    cursor, tip = make_cursor(1.0)
    cursor_press, tip_p = make_cursor(0.86)
    n_total = int(a.length * FPS)

    def pos_and_alpha(t):
        first_t, last_t = taps[0][0], taps[-1][0]
        if t < first_t - LEAD_IN or t > last_t + HOLD_OUT + 0.5:
            return None
        # posição
        x0, y0 = min(W - 40, taps[0][1] + 280), min(H - 40, taps[0][2] + 190)
        px, py = x0, y0
        for i, (ti, xi, yi) in enumerate(taps):
            start = ti - APPROACH
            if t < start:
                break
            u = smooth((t - start) / (APPROACH - 0.08))
            px, py = px + (xi - px) * u, py + (yi - py) * u
            if t >= ti:
                px, py = xi, yi
        al = min(1.0, (t - (first_t - LEAD_IN)) / 0.4)
        if t > last_t + HOLD_OUT:
            al = min(al, 1.0 - (t - last_t - HOLD_OUT) / 0.5)
        return px, py, max(0.0, al)

    base = ["ffmpeg", "-v", "error", "-y", "-i", a.take, "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "pipe:0",
            "-filter_complex",
            f"[0:v]fps={FPS},scale={W}:{H},tpad=stop_mode=clone:stop_duration={a.length:.0f},trim=duration={a.length:.3f},setpts=PTS-STARTPTS[b];[b][1:v]overlay=format=auto:shortest=1,format=yuv420p",
            "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-r", str(FPS), a.out]
    proc = subprocess.Popen(base, stdin=subprocess.PIPE)
    blank = bytes(W * H * 4)
    try:
        for n in range(n_total):
            t = n / FPS
            pa = pos_and_alpha(t)
            active = [c for c in covers if t >= c[0]]
            if pa is None and not active:
                proc.stdin.write(blank)
                continue
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            for _, cx, cy, cw, ch in active:
                ImageDraw.Draw(layer).rectangle((cx, cy, cx + cw, cy + ch), fill=(8, 9, 12, 255))
            if pa is None:
                proc.stdin.write(layer.tobytes())
                continue
            x, y, al = pa
            for ti, xi, yi in taps:
                if 0 <= t - ti < RING:
                    ring = ring_layer((t - ti) / RING)
                    layer.paste(ring, (int(xi - ring.width / 2), int(yi - ring.height / 2)), ring)
            pressed = any(0 <= t - ti < PRESS for ti, _, _ in taps)
            cur, tp = (cursor_press, tip_p) if pressed else (cursor, tip)
            layer.paste(cur, (int(x - tp), int(y - tp)), cur)
            if al < 1.0:
                base_layer = layer
                layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                for _, cx, cy, cw, ch in active:
                    ImageDraw.Draw(layer).rectangle((cx, cy, cx + cw, cy + ch), fill=(8, 9, 12, 255))
                fade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                cur_only = base_layer.copy()
                for _, cx, cy, cw, ch in active:
                    ImageDraw.Draw(cur_only).rectangle((cx, cy, cx + cw, cy + ch), fill=(0, 0, 0, 0))
                r, g, b, alpha = cur_only.split()
                fade = Image.merge("RGBA", (r, g, b, alpha.point(lambda v: int(v * al))))
                layer.alpha_composite(fade)
            proc.stdin.write(layer.tobytes())
        proc.stdin.close()
    except BrokenPipeError:
        pass
    proc.wait()
    print("salvo:", a.out)


if __name__ == "__main__":
    main()
