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
