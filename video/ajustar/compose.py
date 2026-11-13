"""Monta o vídeo "Como ajustar a proporção da tela": gravação do Mini PC + narração + legenda + elementos animados "por fora" da gravação.

A captura do scrcpy não sofre o overscan (a tela do Mini PC aparece sempre inteira), então o resultado do ajuste é mostrado numa TV desenhada
ao lado, que reage a cada aperto de seta; ao lado dela, o controle remoto acende a tecla apertada; embaixo, a ação em texto; e um cursor
com anel de clique mostra onde está o OK na gravação.

  python ajustar/compose.py            # lê ajustar/raw/take.mp4 e ajustar/work/narration/*; escreve ajustar/out/ajustar.{mp4,vtt,json,jpg}
"""
import json, math, pathlib, subprocess, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from assemble import font, run, probe_duration, cues_for, ts, LOGO, BG, SURFACE, BORDER, BRAND, BRAND_SOFT, BRAND_TEXT, MUTED, TEXT  # noqa: E402

ROOT = HERE.parent.parent
W, H, FPS = 1920, 1080, 30
SX, SY, SW, SH, RAD = 48, 56, 1224, 688, 24          # tela do Mini PC
RX, RW = 1308, 564                                    # coluna da direita
TVY, TVH = 56, 470                                    # cartão da TV
RMY, RMH = 546, 384                                   # cartão do controle remoto
ACY, ACH = 768, 162                                   # cartão da ação (embaixo da tela)
BAR_X, BAR_Y, BAR_W, BAR_H = 48, 962, 1824, 84
OK_C, WARN_C, BAD_C = (74, 222, 128), (251, 191, 36), (255, 138, 128)
PANEL_IMG = ROOT / "public" / "painel-tela.webp"

# ── linha do tempo (s do vídeo final), medida nos quadros da gravação ──
PRESSES = [(19.6, "HOME"), (23.9, "DOWN"), (24.05, "DOWN"), (24.2, "DOWN"), (25.85, "OK"),
           (28.4, "DOWN"), (28.55, "DOWN"), (29.8, "DOWN"), (31.2, "OK"),
           *[(32.5 + 0.09 * i, "DOWN") for i in range(5)], (34.0, "OK"), (35.7, "DOWN"), (41.3, "OK"),
           *[(55.1 + 0.33 * i, "LEFT") for i in range(12)], *[(59.9 + 0.5 * i, "DOWN") for i in range(12)],
           (69.1, "RIGHT"), (70.5, "UP"), (80.05, "BACK"), (81.8, "BACK"), (83.45, "BACK"), (84.8, "BACK")]
# toques/cliques mostrados com cursor e anel (coordenadas da tela do Mini PC, 1280x720): instante do efeito → posição
OK_POS = {21.35: (640, 290), 85.8: (840, 600), 87.65: (724, 220)}
CURSOR_WINDOWS = {21.35: (-1.6, 0.5), 85.8: (-1.6, 0.5), 87.65: (-1.6, 0.5)}
# trechos em que o letreiro de notícias do painel (barra de baixo da gravação) é coberto
TICKER_COVER = [(0.0, 19.5), (89.5, 120.0)]
# texto da ação (a partir de t): (título, subtítulo, tecla do ícone)
ACTIONS = [
    (0.0, "Painel aberto na TV", "Comece com o painel do Atendimento Inteligente em execução.", None),
    (19.0, "Aperte HOME", "Mostra \"Voltando ao painel…\" por alguns segundos.", "HOME"),
    (21.0, "Toque no logo da Intelite", "Sai do painel e vai para a tela inicial do sistema.", None),
    (23.6, "Abra CONFIGURAÇÕES", "Seta para baixo até Configurações e aperte OK.", "OK"),
    (28.0, "Vá até PREFERÊNCIAS DO DISPOSITIVO", "Use a seta para baixo e aperte OK.", "DOWN"),
    (32.2, "Vá até EXIBIÇÃO", "Seta para baixo até Exibição e aperte OK.", "DOWN"),
    (35.4, "Escolha AJUSTE DE PROPORÇÃO DE TELA", "A primeira opção, em Configurações HDMI. Aperte OK.", "OK"),
    (42.0, "Ajuste as bordas da imagem", "Acompanhe o resultado na TV, aqui ao lado.", None),
    (54.8, "Seta para a esquerda", "Reduz a largura da imagem, aos poucos.", "LEFT"),
    (59.6, "Seta para baixo", "Reduz a altura. Pare quando as bordas pretas aparecerem.", "DOWN"),
    (68.8, "Pequenos ajustes", "Seta para a direita e seta para cima aumentam a imagem.", "RIGHT"),
    (72.0, "Pare quando tudo estiver visível", "Sem cortes em nenhuma das quatro bordas.", None),
    (79.7, "Aperte VOLTAR", "Repita até voltar à tela inicial.", "BACK"),
    (85.4, "Abra a Galeria de apps e o AI Híbrido", "O painel volta para a tela.", None),
    (91.5, "Confira a tela", "Deve aparecer inteira, com as quatro bordas visíveis.", None),
]
KEY_LABEL = {"HOME": "Home", "BACK": "Voltar", "OK": "OK", "UP": "Seta para cima", "DOWN": "Seta para baixo", "LEFT": "Seta para a esquerda", "RIGHT": "Seta para a direita"}
CUT_K, CUT_STEP = 1.25, 0.02273          # imagem 25% maior que a tela; cada aperto de 1% = 2,27% do tamanho (11 apertos = encaixe exato)


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


# ───────── imagens estáticas ─────────

def card(size, title=None):
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rr(d, (0, 0, w - 1, h - 1), 26, fill=SURFACE + (255,), outline=(38, 42, 54, 255), width=2)
    if title:
        d.text((24, 20), title, font=font("SemiBold", 22), fill=MUTED + (255,), anchor="lm")
    return im


def make_assets(d, chapters, title):
    d.mkdir(parents=True, exist_ok=True)
    logo = Image.open(LOGO).convert("RGBA")
    bg = Image.new("RGBA", (W, H), BG + (255,))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((SX - 120, SY - 100, SX + SW + 120, SY + SH + 140), fill=62)
    ImageDraw.Draw(glow).ellipse((RX - 80, TVY - 60, RX + RW + 80, TVY + TVH + 80), fill=40)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg.alpha_composite(Image.composite(Image.new("RGBA", (W, H), BRAND + (255,)), Image.new("RGBA", (W, H), (0, 0, 0, 0)), glow))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for box in ((SX, SY + 10, SX + SW, SY + SH + 10), (RX, TVY + 10, RX + RW, TVY + TVH + 10), (RX, RMY + 10, RX + RW, RMY + RMH + 10), (SX, ACY + 10, SX + SW, ACY + ACH + 10)):
        sd.rounded_rectangle(box, 26, fill=(0, 0, 0, 170))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))
    d0 = ImageDraw.Draw(bg)
    rr(d0, (SX - 2, SY - 2, SX + SW + 1, SY + SH + 1), RAD + 2, outline=BORDER + (255,), width=2)
    bg.alpha_composite(card((RW, TVH), "Como a imagem aparece na TV"), (RX, TVY))
    bg.alpha_composite(card((RW, RMH), "Controle remoto"), (RX, RMY))
    bg.alpha_composite(card((SW, ACH)), (SX, ACY))
    bg.convert("RGB").save(d / "bg.png")
    mask = Image.new("L", (SW, SH), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SW - 1, SH - 1), RAD, fill=255)
    mask.save(d / "mask.png")

    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for i, ch in enumerate(chapters):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        rr(dr, (BAR_X, BAR_Y, BAR_X + BAR_W, BAR_Y + BAR_H), 24, fill=SURFACE + (240,), outline=(32, 35, 44, 255), width=2)
        cx, cy = BAR_X + 46, BAR_Y + BAR_H // 2
        dr.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=BRAND + (255,))
        dr.text((cx, cy), f"{i + 1:02d}", font=font("Bold", 26), fill=(4, 17, 31, 255), anchor="mm")
        dr.text((cx + 50, cy), ch["title"], font=font("Bold", 38), fill=TEXT + (255,), anchor="lm")
        x = BAR_X + 520
        for j, c in enumerate(chapters):
            label = f"{j + 1}  {c['title']}"
            f = font("SemiBold" if j == i else "Medium", 24)
            w = int(tmp.textlength(label, font=f)) + 40
            if j == i:
                rr(dr, (x, cy - 24, x + w, cy + 24), 24, fill=BRAND_SOFT + (255,), outline=BRAND + (255,), width=2)
            dr.text((x + w // 2, cy), label, font=f, fill=(BRAND_TEXT if j == i else MUTED) + (255,), anchor="mm")
            x += w + 14
        lh = 40
        lg = logo.resize((int(logo.width * lh / logo.height), lh), Image.LANCZOS)
        im.alpha_composite(lg, (BAR_X + BAR_W - lg.width - 34, cy - lh // 2))
        im.save(d / f"bar_{ch['id']}.png")

    im = Image.new("RGBA", (W, H), BG + (232,))
    dr = ImageDraw.Draw(im)
    lg = logo.resize((int(logo.width * 96 / logo.height), 96), Image.LANCZOS)
    im.alpha_composite(lg, ((W - lg.width) // 2, 300))
    dr.text((W // 2, 520), title, font=font("Bold", 92), fill=TEXT + (255,), anchor="mm")
    dr.text((W // 2, 616), "Atendimento Inteligente · totem e painel de chamadas", font=font("Regular", 38), fill=MUTED + (255,), anchor="mm")
    rr(dr, (W // 2 - 60, 690, W // 2 + 60, 696), 3, fill=BRAND + (255,))
    im.save(d / "intro.png")


# ───────── segmentos (tela do Mini PC + moldura + barra + narração) ─────────

def build_segment(ch, start, dur, assets, work, total, offset, lead, intro, clip, hold):
    covers = "".join(f",drawbox=x=16:y=514:w=990:h=48:color=0x05060f:t=fill:enable='between(t,{max(a - offset, 0):.2f},{b - offset:.2f})'" for a, b in TICKER_COVER if b > offset and a < offset + dur)
    seg = work / f"seg_{ch['id']}.mp4"
    inputs = ["-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(clip)]
    for f in ("bg.png", "mask.png", f"bar_{ch['id']}.png", "intro.png"):
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(assets / f)]
    inputs += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", f"color=c=0x4c9bff:s={W}x6:r={FPS}", "-i", str(work / "narration" / f"{ch['id']}.mp3")]
    g = [f"[0:v]fps={FPS},tpad=stop_mode=clone:stop_duration={hold:.2f},trim=duration={dur:.3f},setpts=PTS-STARTPTS{covers},scale={SW}:{SH}:flags=lanczos,format=yuv420p[scr]",
         "[scr][2:v]alphamerge[scra]",
         f"[1:v][scra]overlay=x={SX}:y={SY}:format=auto[c1]",
         f"[3:v]format=rgba,fade=t=in:st={max(lead - 0.1, 0.1):.2f}:d=0.45:alpha=1[bar]",
         f"[c1][bar]overlay=x=0:y='18*pow(1-clip((t-{max(lead - 0.1, 0.1):.2f})/0.5,0,1),3)':format=auto[c2]"]
    last = "c2"
    if intro:
        g += [f"[4:v]format=rgba,fade=t=out:st={max(lead - 0.9, 0.5):.2f}:d=0.8:alpha=1[intro]", "[c2][intro]overlay=x=0:y=0:format=auto[c3]"]
        last = "c3"
    g += [f"[{last}][5:v]overlay=x='-overlay_w+main_w*({offset:.3f}+t)/{total:.3f}':y={H - 6}:format=auto,format=yuv420p[v]",
          f"[6:a]loudnorm=I=-16:TP=-1.5:LRA=11,adelay={int(lead * 1000)}:all=1,apad=whole_dur={dur:.3f},aresample=48000[a]"]
    gs = work / f"graph_{ch['id']}.txt"
    gs.write_text(";\n".join(g), encoding="utf-8")
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex_script", str(gs), "-map", "[v]", "-map", "[a]", "-t", f"{dur:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", str(seg)])
    return seg


# ───────── elementos animados ─────────

class Scene:
    def __init__(self, work):
        self.panel = Image.open(PANEL_IMG).convert("RGB")
        self.bg = Image.open(work / "assets" / "bg.png").convert("RGB")
        self.tv_card = self.bg.crop((RX, TVY, RX + RW, TVY + TVH)).convert("RGBA")
        self.rm_card = self.bg.crop((RX, RMY, RX + RW, RMY + RMH)).convert("RGBA")
        self.ac_card = self.bg.crop((SX, ACY, SX + SW, ACY + ACH)).convert("RGBA")
        self.tv_static = self._tv_static()
        self.remote_static = self._remote_static()
        self.presses = sorted(PRESSES)
        self.cut_events = [(t, k) for t, k in self.presses if 55 <= t < 72 and k in ("LEFT", "RIGHT", "UP", "DOWN")]

    # --- TV ---
    TVW, TVHH, BEZ = 520, 304, 12

    def _tv_static(self):
        im = Image.new("RGBA", (RW, TVH), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x0, y0 = (RW - self.TVW) // 2, 58
        d.polygon([(x0 + 200, y0 + self.TVHH), (x0 + 320, y0 + self.TVHH), (x0 + 336, y0 + self.TVHH + 18), (x0 + 184, y0 + self.TVHH + 18)], fill=(26, 29, 38, 255))
        rr(d, (x0 + 130, y0 + self.TVHH + 18, x0 + 390, y0 + self.TVHH + 28), 5, fill=(42, 46, 59, 255))
        rr(d, (x0, y0, x0 + self.TVW, y0 + self.TVHH), 16, fill=(10, 11, 16, 255), outline=(52, 57, 71, 255), width=2)
        return im

    def n_cut(self, t):
        nh = nv = 0.0
        for te, k in self.cut_events:
            u = smooth((t - te) / 0.22)
            if k == "LEFT": nh += u
            elif k == "RIGHT": nh -= u
            elif k == "DOWN": nv += u
            elif k == "UP": nv -= u
        return nh, nv

    def tv_frame(self, t):
        nh, nv = self.n_cut(t)
        sx, sy = CUT_K - CUT_STEP * nh, CUT_K - CUT_STEP * nv
        im = self.tv_card.copy()
        im.alpha_composite(self.tv_static)
        d = ImageDraw.Draw(im)
        x0, y0 = (RW - self.TVW) // 2, 58
        scw, sch = self.TVW - 2 * self.BEZ, self.TVHH - 2 * self.BEZ
        screen = Image.new("RGB", (scw, sch), (0, 0, 0))
        iw, ih = max(2, int(scw * sx)), max(2, int(sch * sy))
        img = self.panel.resize((iw, ih), Image.BILINEAR)
        screen.paste(img, ((scw - iw) // 2, (sch - ih) // 2))
        mask = Image.new("L", (scw, sch), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, scw - 1, sch - 1), 5, fill=255)
        im.paste(screen, (x0 + self.BEZ, y0 + self.BEZ), mask)
        fit = abs(sx - 1) < 0.006 and abs(sy - 1) < 0.006
        bars = (sx < 0.994 or sy < 0.994) and not (sx > 1.006 or sy > 1.006)
        if fit:                                            # tudo enquadrado: cantos verdes (como na tela "Está tudo certo")
            L = 30
            for (cx, cy, dx, dy) in ((0, 0, 1, 1), (scw, 0, -1, 1), (0, sch, 1, -1), (scw, sch, -1, -1)):
                X, Y = x0 + self.BEZ + cx, y0 + self.BEZ + cy
                d.line([(X, Y + dy * L), (X, Y), (X + dx * L, Y)], fill=OK_C + (255,), width=5, joint="curve")
        label, color = ("Cortada: bordas escondidas", WARN_C)
        if fit: label, color = "Ajustada: tudo visível", OK_C
        elif bars: label, color = "Passou um pouco: bordas pretas", WARN_C
        elif sx < 1.006 and sy < 1.006: label, color = "Ajustando…", BRAND_TEXT
        elif t > 41.5: label, color = "Ajustando…", BRAND_TEXT
        if t < 41.3: label, color = "Cortada: bordas escondidas", WARN_C
        f = font("SemiBold", 24)
        w = int(d.textlength(label, font=f)) + 56
        bx, by = (RW - w) // 2, 58 + self.TVHH + 54
        rr(d, (bx, by, bx + w, by + 44), 22, fill=tuple(int(c * 0.18) for c in color) + (255,), outline=color + (255,), width=2)
        cxd, cyd = bx + 24, by + 22
        if fit:
            d.line([(cxd - 7, cyd), (cxd - 2, cyd + 6), (cxd + 8, cyd - 6)], fill=color + (255,), width=3)
        else:
            d.ellipse((cxd - 5, cyd - 5, cxd + 5, cyd + 5), fill=color + (255,))
        d.text((bx + 38, by + 22), label, font=f, fill=color + (255,), anchor="lm")
        return im

    # --- controle remoto (Proeletronic / Mini PC SmartPRO: desenhado a partir da foto do controle) ---
    # coordenadas da foto (508x889), recortadas até o botão do mouse e levadas ao cartão
    RS, RX0, RY0 = 0.56, 40, 52

    def T(self, x, y):
        return (self.RX0 + (x - 125) * self.RS, self.RY0 + (y - 30) * self.RS)

    def _remote_static(self):
        S = 4                                              # supersampling para bordas suaves
        im = Image.new("RGBA", (RW * S, RMH * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        T = lambda x, y: tuple(v * S for v in self.T(x, y))
        r = lambda v: v * self.RS * S
        x0, y0 = T(125, 30)
        x1, y1 = T(345, 640)
        d.rounded_rectangle((x0, y0, x1, y1), r(40), fill=(16, 16, 19, 255), outline=(44, 45, 52, 255), width=int(2.5 * S))
        hl = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(hl).rounded_rectangle((x0 + 3 * S, y0 + 3 * S, x1 - 3 * S, y0 + 60 * S), r(36), outline=(255, 255, 255, 18), width=2 * S)
        im.alpha_composite(hl)

        def circ(c, rad, fill, outline=None):
            cx, cy = T(*c)
            d.ellipse((cx - r(rad), cy - r(rad), cx + r(rad), cy + r(rad)), fill=fill, outline=outline, width=2 * S if outline else 0)

        BTN = (27, 27, 31, 255)
        circ((235, 283), 90, (24, 24, 28, 255), (40, 41, 48, 255))              # anel do direcional
        circ((235, 283), 40, (14, 14, 17, 255), (46, 47, 54, 255))              # OK
        circ((180, 155), 29, BTN, (44, 45, 52, 255))                            # home
        circ((290, 155), 29, BTN, (44, 45, 52, 255))                            # mudo
        circ((178, 82), 26, (222, 36, 36, 255), (150, 20, 20, 255))             # liga/desliga (vermelho)
        circ((180, 494), 29, BTN, (44, 45, 52, 255))                            # menos
        circ((288, 494), 29, BTN, (44, 45, 52, 255))                            # mais
        circ((234, 566), 34, BTN, (44, 45, 52, 255))                            # mouse
        bx0, by0 = T(152, 400)
        bx1, by1 = T(316, 448)
        d.rounded_rectangle((bx0, by0, bx1, by1), r(24), fill=BTN, outline=(44, 45, 52, 255), width=2 * S)   # voltar | apps | set
        W2, G, WH = int(2.6 * S), (200, 202, 210, 255), (240, 241, 245, 255)
        px, py = T(178, 82)
        d.arc((px - r(11), py - r(11), px + r(11), py + r(11)), -60, 240, fill=WH, width=W2)
        d.line([(px, py - r(14)), (px, py - r(2))], fill=WH, width=W2)
        hx, hy = T(180, 156)
        d.line([(hx - r(13), hy), (hx, hy - r(11)), (hx + r(13), hy), (hx + r(11), hy), (hx + r(11), hy + r(10)), (hx - r(11), hy + r(10)), (hx - r(11), hy)], fill=G, width=W2, joint="curve")
        mx, my = T(288, 155)
        d.polygon([(mx - r(14), my - r(5)), (mx - r(7), my - r(5)), (mx, my - r(11)), (mx, my + r(11)), (mx - r(7), my + r(5)), (mx - r(14), my + r(5))], outline=G, width=W2)
        d.line([(mx + r(6), my - r(6)), (mx + r(15), my + r(6))], fill=G, width=W2)
        d.line([(mx + r(15), my - r(6)), (mx + r(6), my + r(6))], fill=G, width=W2)
        ax, ay = T(180, 494)
        d.line([(ax - r(15), ay), (ax + r(15), ay)], fill=G, width=W2)
        ax, ay = T(288, 494)
        d.line([(ax - r(15), ay), (ax + r(15), ay)], fill=G, width=W2)
        d.line([(ax, ay - r(15)), (ax, ay + r(15))], fill=G, width=W2)
        ux, uy = T(234, 566)
        d.rounded_rectangle((ux - r(8), uy - r(13), ux + r(8), uy + r(13)), r(8), outline=G, width=W2)
        d.line([(ux, uy - r(13)), (ux, uy - r(3))], fill=G, width=W2)
        f1 = font("SemiBold", int(r(15)))
        d.text(T(234, 424), "APPS", font=f1, fill=WH, anchor="mm")
        d.text(T(286, 424), "SET", font=f1, fill=WH, anchor="mm")
        kx, ky = T(181, 424)
        d.arc((kx - r(11), ky - r(8), kx + r(11), ky + r(10)), 180, 70, fill=G, width=W2)
        d.polygon([(kx - r(14), ky - r(3)), (kx - r(5), ky - r(9)), (kx - r(5), ky + r(3))], fill=G)
        d.text(T(235, 283), "OK", font=font("Bold", int(r(24))), fill=WH, anchor="mm")
        for k, (dx, dy) in {"UP": (0, -1), "DOWN": (0, 1), "LEFT": (-1, 0), "RIGHT": (1, 0)}.items():
            cx, cy = T(235 + dx * 68, 283 + dy * 66)
            L = r(9)
            if dy:
                pts = [(cx - L, cy - dy * L * 0.5), (cx, cy + dy * L * 0.5), (cx + L, cy - dy * L * 0.5)]
            else:
                pts = [(cx - dx * L * 0.5, cy - L), (cx + dx * L * 0.5, cy), (cx - dx * L * 0.5, cy + L)]
            d.line(pts, fill=G, width=W2, joint="curve")
        return im.resize((RW, RMH), Image.LANCZOS)

    def _pos(self, k):
        return {"OK": self.T(235, 283), "HOME": self.T(180, 155), "BACK": self.T(181, 424),
                "UP": self.T(235, 217), "DOWN": self.T(235, 349), "LEFT": self.T(167, 283), "RIGHT": self.T(303, 283)}[k]

    def remote_frame(self, t):
        im = self.rm_card.copy()
        im.alpha_composite(self.remote_static)
        act = {}
        for te, k in self.presses:
            if 0 <= (t - te) <= 0.42:
                act[k] = max(act.get(k, 0.0), 1.0 if (t - te) < 0.08 else 1.0 - (t - te) / 0.42)
        glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for k, v in act.items():
            cx, cy = self._pos(k)
            rad = 24 if k == "OK" else 17
            gd.ellipse((cx - rad - 7, cy - rad - 7, cx + rad + 7, cy + rad + 7), fill=BRAND + (int(70 * v),))
            gd.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=BRAND + (int(235 * v),), outline=(255, 255, 255, int(200 * v)), width=2)
        im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(1.2)))
        d = ImageDraw.Draw(im, "RGBA")
        for k, v in act.items():
            cx, cy = self._pos(k)
            if k == "OK":
                d.text((cx, cy), "OK", font=font("Bold", 21), fill=(255, 255, 255, 255), anchor="mm")
            elif k in ("UP", "DOWN", "LEFT", "RIGHT"):
                dx, dy = {"UP": (0, -1), "DOWN": (0, 1), "LEFT": (-1, 0), "RIGHT": (1, 0)}[k]
                L = 5.4
                pts = [(cx - L, cy - dy * L * 0.5), (cx, cy + dy * L * 0.5), (cx + L, cy - dy * L * 0.5)] if dy else [(cx - dx * L * 0.5, cy - L), (cx + dx * L * 0.5, cy), (cx - dx * L * 0.5, cy + L)]
                d.line(pts, fill=(255, 255, 255, 255), width=3, joint="curve")
            elif k == "HOME":
                d.line([(cx - 7.5, cy), (cx, cy - 6.5), (cx + 7.5, cy), (cx + 6.5, cy), (cx + 6.5, cy + 6), (cx - 6.5, cy + 6), (cx - 6.5, cy)], fill=(255, 255, 255, 255), width=3, joint="curve")
            elif k == "BACK":
                d.arc((cx - 7, cy - 5, cx + 7, cy + 6), 180, 70, fill=(255, 255, 255, 255), width=3)
                d.polygon([(cx - 9, cy - 2), (cx - 3, cy - 6), (cx - 3, cy + 2)], fill=(255, 255, 255, 255))
        # rótulo da última tecla (à direita)
        last = None
        for te, k in self.presses:
            if te <= t + 0.05 and t - te < 2.4:
                last = (te, k)
        f1, f2 = font("Bold", 27), font("Regular", 22)
        if last:
            te, k = last
            u = smooth((t - te) / 0.12)
            n = sum(1 for tt, kk in self.presses if kk == k and te - 6 <= tt <= te and (55 <= te < 72) == (55 <= tt < 72)) if 55 <= te < 72 else 1
            d.text((232, 150), KEY_LABEL[k], font=f1, fill=TEXT + (int(255 * u),), anchor="lm")
            sub = {"HOME": "Volta à tela inicial", "BACK": "Volta uma tela", "OK": "Confirma a opção", "UP": "Desce/sobe na lista", "DOWN": "Desce na lista", "LEFT": "Move para a esquerda", "RIGHT": "Move para a direita"}[k]
            if 55 <= te < 72:
                sub = {"LEFT": "Reduz a largura da imagem", "RIGHT": "Aumenta a largura da imagem", "DOWN": "Reduz a altura da imagem", "UP": "Aumenta a altura da imagem"}[k]
            elif k == "UP":
                sub = "Sobe na lista"
            d.text((232, 192), sub, font=f2, fill=MUTED + (int(255 * u),), anchor="lm")
            if 55 <= te < 72:
                cnt = sum(1 for tt, kk in self.presses if 55 <= tt <= te and kk == k and tt > te - 8)
                d.text((232, 236), f"{cnt}×", font=font("Bold", 28), fill=BRAND_TEXT + (int(255 * u),), anchor="lm")
        else:
            d.text((232, 168), "Use as teclas", font=f1, fill=MUTED + (255,), anchor="lm")
            d.text((232, 208), "do controle remoto", font=f2, fill=MUTED + (255,), anchor="lm")
        return im

    # --- ação (embaixo da tela) ---
    def action_frame(self, t):
        im = self.ac_card.copy()
        d = ImageDraw.Draw(im, "RGBA")
        idx = max(i for i, a in enumerate(ACTIONS) if a[0] <= t + 1e-6)
        t0, title, sub, key = ACTIONS[idx]
        u = smooth((t - t0) / 0.3)
        a = int(255 * u)
        off = int(14 * (1 - u))
        cx, cy = 98, ACH // 2
        rr(d, (cx - 56, cy - 56 + off, cx + 56, cy + 56 + off), 22, fill=BRAND_SOFT + (a,), outline=BRAND + (a,), width=3)
        if key in ("LEFT", "RIGHT", "UP", "DOWN"):
            dx, dy = {"UP": (0, -1), "DOWN": (0, 1), "LEFT": (-1, 0), "RIGHT": (1, 0)}[key]
            tri = [(cx + dx * 24, cy + dy * 24 + off), (cx - dy * 24 - dx * 16, cy + dx * 24 - dy * 16 + off), (cx + dy * 24 - dx * 16, cy - dx * 24 - dy * 16 + off)]
            d.polygon(tri, fill=(255, 255, 255, a))
        elif key in ("OK", "HOME", "BACK"):
            d.text((cx, cy + off), {"OK": "OK", "HOME": "HOME", "BACK": "VOLTAR"}[key], font=font("Bold", 30 if key == "OK" else 22), fill=(255, 255, 255, a), anchor="mm")
        else:                                              # sem tecla: ícone de TV
            rr(d, (cx - 28, cy - 20 + off, cx + 28, cy + 12 + off), 6, outline=(255, 255, 255, a), width=4)
            d.line([(cx - 14, cy + 24 + off), (cx + 14, cy + 24 + off)], fill=(255, 255, 255, a), width=4)
        d.text((196, cy - 22 + off), title, font=font("Bold", 42), fill=TEXT + (a,), anchor="lm")
        d.text((196, cy + 30 + off), sub, font=font("Regular", 28), fill=MUTED + (a,), anchor="lm")
        return im

    # --- cursor e anel de clique sobre a tela do Mini PC ---
    def cursor_layer(self, t):
        best = None
        for te, (x, y) in OK_POS.items():
            lo, hi = CURSOR_WINDOWS.get(te, (-0.9, 0.55))
            if lo <= t - te <= hi:
                best = (te, x, y)
        if not best:
            return None
        te, x, y = best
        X, Y = SX + x / 1280 * SW, SY + y / 720 * SH
        dt = t - te
        S = 220
        lay = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        c = S // 2
        appear = smooth((dt + 1.6) / 0.6)
        fade = 1 - smooth((dt - 0.1) / 0.35)
        a = max(0.0, min(appear, fade))
        if dt > 0:                                         # anel de clique
            u = min(dt / 0.55, 1.0)
            r = 22 + 50 * u
            d.ellipse((c - r, c - r, c + r, c + r), outline=BRAND + (int(255 * (1 - u)),), width=6)
            d.ellipse((c - 20, c - 20, c + 20, c + 20), fill=BRAND + (int(120 * (1 - u)),))
        # seta do cursor (apontando de cima/esquerda para o item)
        px, py = c - 4 - 26 * (1 - appear), c - 4 - 26 * (1 - appear)
        arrow = [(px, py), (px, py + 46), (px + 12, py + 35), (px + 21, py + 54), (px + 29, py + 50), (px + 20, py + 32), (px + 36, py + 32)]
        sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(sh).polygon([(a + 3, b + 4) for a, b in arrow], fill=(0, 0, 0, int(120 * a)))
        lay.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3)))
        d.polygon(arrow, fill=(255, 255, 255, int(255 * a)), outline=(8, 9, 12, int(255 * a)))
        return lay, int(X - c), int(Y - c)


def render_overlay(base, out_video, scene, total):
    n = int(round(total * FPS))
    rd = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(base), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    wr = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(base),
                           "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(out_video)],
                          stdin=subprocess.PIPE)
    size = W * H * 3
    for i in range(n):
        buf = rd.stdout.read(size)
        if len(buf) < size:
            break
        t = i / FPS
        arr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        appear = smooth((t - 1.45) / 0.8)                  # os cartões entram quando o cartão de abertura sai
        if appear > 0:
            for (x, y, im) in ((RX, TVY, scene.tv_frame(t)), (RX, RMY, scene.remote_frame(t)), (SX, ACY, scene.action_frame(t))):
                new = np.asarray(im.convert("RGB"))
                reg = arr[y:y + im.height, x:x + im.width]
                arr[y:y + im.height, x:x + im.width] = new if appear >= 1 else (reg * (1 - appear) + new * appear).astype(np.uint8)
        cur = scene.cursor_layer(t)
        if cur:
            lay, ox, oy = cur
            x0, y0 = max(ox, 0), max(oy, 0)
            x1, y1 = min(ox + lay.width, W), min(oy + lay.height, H)
            reg = Image.fromarray(arr[y0:y1, x0:x1]).convert("RGBA")
            reg.alpha_composite(lay.crop((x0 - ox, y0 - oy, x1 - ox, y1 - oy)))
            arr[y0:y1, x0:x1] = np.asarray(reg.convert("RGB"))
        wr.stdin.write(arr.tobytes())
        if i % 300 == 0:
            print(f"  quadro {i}/{n}", flush=True)
    wr.stdin.close()
    wr.wait()
    rd.stdout.close()
    rd.wait()


def main():
    cfg = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    work, out = HERE / "work", HERE / "out"
    work.mkdir(exist_ok=True)
    out.mkdir(exist_ok=True)
    chapters = cfg["chapters"]
    assets = work / "assets"
    make_assets(assets, chapters, cfg["title"])
    narr = {ch["id"]: json.loads((work / "narration" / f"{ch['id']}.json").read_text(encoding="utf-8")) for ch in chapters}
    leads = [cfg["introLead"] if i == 0 else cfg["lead"] for i in range(len(chapters))]
    durs = [leads[i] + narr[ch["id"]]["duration"] + cfg["tail"] for i, ch in enumerate(chapters)]
    offsets = [sum(durs[:i]) for i in range(len(chapters))]
    total = sum(durs)
    clip = HERE / "raw" / "take.mp4"
    clip_len = probe_duration(clip)
    print(f"gravação: {clip_len:.1f}s; vídeo final: {total:.1f}s")

    segs, cues = [], []
    for i, ch in enumerate(chapters):
        start = offsets[i]
        avail = max(0.0, clip_len - start)
        hold = max(0.0, durs[i] - avail) + 0.1
        print(f"{i + 1}/{len(chapters)} {ch['title']}: {durs[i]:.1f}s (congela {hold:.1f}s)")
        segs.append(build_segment(ch, start, durs[i], assets, work, total, offsets[i], leads[i], i == 0, clip, hold))
        cues += cues_for(narr[ch["id"]]["sentences"], offsets[i] + leads[i])
    lst = work / "concat.txt"
    lst.write_text("".join(f"file '{s.as_posix()}'\n" for s in segs), encoding="utf-8")
    base = work / "base.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(base)])

    final = out / "ajustar.mp4"
    print("animações por fora da gravação…")
    render_overlay(base, final, Scene(work), total)

    vtt = ["WEBVTT", ""]
    for n, (s, e, text) in enumerate(cues):
        nxt = cues[n + 1][0] if n + 1 < len(cues) else e + 1
        vtt += [f"{ts(s)} --> {ts(min(e + 0.2, nxt))}", text, ""]
    (out / "ajustar.vtt").write_text("\n".join(vtt), encoding="utf-8")
    info = {"title": cfg["title"], "durationSec": round(probe_duration(final)), "chapters": [{"title": ch["title"], "start": round(offsets[i], 2)} for i, ch in enumerate(chapters)]}
    (out / "ajustar.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    at = offsets[2] + durs[2] * 0.62
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at:.2f}", "-i", str(final), "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "3", str(out / "ajustar.jpg")])
    print(f"\nOK: {final} ({info['durationSec']}s, {final.stat().st_size / 1048576:.1f} MB)")


if __name__ == "__main__":
    main()
