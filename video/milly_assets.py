"""Prepara os arquivos da Milly (avatar animado): imagem base e "chapas limpas" (rosto sem boca e sem olhos) em public/milly.
Uso: python video/milly_assets.py <imagem-original.webp>
As chapas são o rosto pintado sem boca/olhos; a animação desenha boca e pálpebras por cima delas (src/components/Milly.tsx)."""
import sys
import cv2
import numpy as np
from PIL import Image

src = sys.argv[1]
im = Image.open(src).convert("RGBA")
a = np.array(im)
rgb = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2BGR)
H, W = rgb.shape[:2]

def plate(name, box, mask_fn, feather=7):
    x0, y0, x1, y1 = box
    m = np.zeros((H, W), np.uint8)
    mask_fn(m)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    out = cv2.inpaint(rgb, m, 9, cv2.INPAINT_TELEA)
    crop = out[y0:y1, x0:x1]
    # suaviza o miolo pintado (o inpaint deixa o miolo um pouco áspero)
    blur = cv2.GaussianBlur(crop, (0, 0), 3)
    mc = m[y0:y1, x0:x1]
    mc = cv2.GaussianBlur(mc, (0, 0), 3)[..., None] / 255.0
    crop = (crop * (1 - mc) + blur * mc).astype(np.uint8)
    al = np.zeros((y1 - y0, x1 - x0), np.float32)
    cv2.rectangle(al, (feather, feather), (x1 - x0 - feather, y1 - y0 - feather), 1.0, -1)
    al = cv2.GaussianBlur(al, (0, 0), feather / 2)
    rgba = np.dstack([cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (al * 255).astype(np.uint8)])
    Image.fromarray(rgba).save(f"public/milly/{name}.png", optimize=True)
    print(name, box)

# boca: lábios + cantos
def mouth(m):
    pts = np.array([[652, 450], [690, 445], [722, 449], [756, 445], [795, 441], [800, 452], [770, 474], [740, 494], [722, 498], [700, 494], [672, 474]], np.int32)
    cv2.fillPoly(m, [pts], 255)
plate("boca", (620, 415, 830, 530), mouth)

def eye(cx, cy, rx, ry):
    def f(m): cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    return f
plate("olho-e", (560, 285, 710, 395), eye(634, 336, 60, 40))
plate("olho-d", (725, 280, 895, 390), eye(812, 334, 70, 40))

# imagem base: busto (corta o que está fora), webp com transparência
base = im.crop((270, 0, 1210, 1000))
base.save("public/milly/milly.webp", quality=90, method=6)
print("base", base.size)

# ───────── lábios reais do desenho, em duas peças (superior e inferior) ─────────
# A boca animada reaproveita os próprios lábios da Milly: o inferior desce em faixas verticais (acompanhando a curva do sorriso)
# e o vão entre eles é preenchido por dentro da boca desenhado em Milly.tsx. Assim o acabamento 3D (brilho, sombra) é o do original.
x0, y0, x1, y1 = 620, 415, 830, 530
clean = cv2.inpaint(rgb, (lambda m: (mouth(m), m)[1])(np.zeros((H, W), np.uint8)), 9, cv2.INPAINT_TELEA)
dist = np.sqrt(((rgb.astype(np.float32) - clean.astype(np.float32)) ** 2).sum(-1))
from scipy.ndimage import binary_fill_holes
alpha = np.clip((dist - 30) / 26, 0, 1)
_b, _g, _r = [rgb[..., i].astype(np.float32) for i in range(3)]
lipish = np.maximum(np.clip((_r - _g - 85) / 35, 0, 1), np.clip((90 - (_r + _g + _b) / 3) / 30, 0, 1))  # vermelho dos lábios ou o escuro da linha (sem a sombra bege em volta)
alpha = alpha * lipish
solid = binary_fill_holes(cv2.morphologyEx((alpha > 0.5).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool))  # tapa o brilho do lábio
solid = cv2.erode(solid.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
alpha = cv2.GaussianBlur(np.maximum(alpha, solid), (0, 0), 0.8)
gray = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY).astype(np.float32)
xs = list(range(652, 797))
line = []
for x in xs:
    col = [(gray[y, x] + (0 if alpha[y, x] > 0.5 else 999), y) for y in range(436, 486)]
    line.append(min(col)[1])
line = np.array(line, np.float32)
# só vale onde há lábio sobre a linha (nos cantos a busca pega ruído): usa o trecho contínuo em volta do centro
has = np.array([alpha[int(y), x] > 0.5 for x, y in zip(xs, line)])
c = len(xs) // 2
lo = c
while lo > 0 and has[lo - 1]: lo -= 1
hi = c
while hi < len(xs) - 1 and has[hi + 1]: hi += 1
xs = xs[lo + 4:hi - 3]; line = line[lo + 4:hi - 3]
k = np.ones(9) / 9
line = np.convolve(np.pad(line, 4, mode="edge"), k, mode="valid")
ys = np.arange(H)[:, None]
lx = np.full(W, 1e4, np.float32); lx[xs[0]:xs[-1] + 1] = line  # fora do trecho da linha, só vale o lábio superior (acima de tudo)
upper_m = (ys <= lx[None, :] + 1.5) * alpha
lower_m = (ys >= lx[None, :] - 1.5) * alpha
for name, m in (("labio-sup", upper_m), ("labio-inf", lower_m)):
    m = m.copy()
    rgba = np.dstack([cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB), (m * 255).astype(np.uint8)])[y0:y1, x0:x1]
    Image.fromarray(rgba).save(f"public/milly/{name}.png", optimize=True)
# curva da linha entre os lábios, em coordenadas da imagem recortada (x - 270): usada pelo vão da boca
open("src/components/milly-lips.ts", "w", encoding="utf8").write(
    "// Gerado por video/milly_assets.py: y da linha entre os lábios, para x = X0 ... X0 + length - 1 (coordenadas da imagem recortada).\n"
    f"export const LIP_X0 = {xs[0] - 270};\nexport const LIP_LINE = [{', '.join(f'{v:.1f}' for v in line)}];\n")
print("lábios", line.min(), line.max())
