"""Gera a linha do tempo da boca e dos gestos da Milly a partir do áudio do vídeo.
Uso: python video/lipsync.py downloads/videos/tutorial.mp4 downloads/videos/tutorial.mouth.json
Saída (50 quadros por segundo): "o" = abertura da boca (0-9), "w" = formato (0 arredondada ... 9 aberta de lado),
"beats" = instantes de ênfase (balançar a cabeça), "pauses" = pausas entre frases."""
import json, subprocess, sys
import numpy as np

src, out = sys.argv[1], sys.argv[2]
SR, FPS = 16000, 50
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
hop, win = SR // FPS, int(SR * 0.04)
n = len(x) // hop
win_f = np.hanning(win)
freqs = np.fft.rfftfreq(win, 1 / SR)
band = lambda lo, hi: (freqs >= lo) & (freqs < hi)
b1, b2, b3 = band(250, 900), band(1200, 3000), band(4000, 8000)
rms = np.zeros(n); f1 = np.zeros(n); f2 = np.zeros(n); hf = np.zeros(n)
for i in range(n):
    seg = x[i * hop:i * hop + win]
    if len(seg) < win: seg = np.pad(seg, (0, win - len(seg)))
    s = np.abs(np.fft.rfft(seg * win_f)) ** 2
    rms[i] = np.sqrt(np.mean(seg ** 2)); f1[i] = s[b1].sum(); f2[i] = s[b2].sum(); hf[i] = s[b3].sum()
db = 20 * np.log10(rms + 1e-5)
top = np.percentile(db, 95)
voiced = np.clip((db - (top - 30)) / 24, 0, 1)
sm = lambda v, k: np.convolve(v, np.ones(k) / k, mode="same")
o = sm(voiced, 3) ** 0.9
# consoantes fricativas (s, f, x): pouca abertura, boca de lado
fric = hf / (f1 + f2 + hf + 1e-9)
o = np.where(fric > 0.35, np.minimum(o, 0.3), o)
w = np.clip(f2 / (f1 + f2 + 1e-9) * 1.4, 0, 1)          # F2 alto (i, e) = largo; baixo (u, o) = arredondado
w = np.where(fric > 0.35, 0.85, sm(w, 5))
o = np.clip(o, 0, 1); w = np.clip(w, 0, 1)
# ênfases: picos de energia depois de queda, com pelo menos 0.9 s entre eles
beats, last = [], -9
env = sm(voiced, 9)
for i in range(5, n - 5):
    t = i / FPS
    if env[i] > 0.55 and env[i] >= env[i - 5:i + 6].max() and t - last > 0.9:
        beats.append(round(t, 2)); last = t
# pausas: silêncio de pelo menos 0.2 s (marca o início da pausa)
pauses, run = [], 0
for i in range(n):
    if env[i] < 0.2: run += 1
    else:
        if run >= int(0.2 * FPS): pauses.append(round((i - run) / FPS, 2))
        run = 0
q = lambda v: "".join(str(int(round(min(max(a, 0), 1) * 9))) for a in v)
json.dump({"fps": FPS, "o": q(o), "w": q(w), "beats": beats, "pauses": pauses}, open(out, "w"), separators=(",", ":"))
print(f"{n} quadros, {len(beats)} ênfases, {len(pauses)} pausas, duração {n / FPS:.1f}s")
