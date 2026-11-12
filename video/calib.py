"""Relaciona o relógio de take.py com o tempo do vídeo gravado pelo screenrecord.

O comando `input tap` leva ~1 s para chegar ao aparelho e a tela reage ~0,35 s depois. Usamos a primeira troca de tela inteira
(Início → Galeria de apps, causada pelo primeiro toque) como referência:
    tempo_no_video = tempo_do_script - offset      (offset costuma ser negativo, ~ -0,5)
Grava `offset` em raw/take.taps.json.
"""
import json, pathlib, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / "raw"
REACTION = 0.35


def main():
    path = RAW / "take.taps.json"
    d = json.loads(path.read_text(encoding="utf-8"))
    t_tap = d["taps"][0]["t"]
    w, h = 160, 90
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(RAW / "take.mp4"), "-vf", f"fps=10,scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    n = len(out) // (w * h)
    frames = [out[i * w * h:(i + 1) * w * h] for i in range(n)]
    base = frames[0]
    hit = next((i for i, f in enumerate(frames) if sum(abs(a - b) for a, b in zip(base, f)) / (w * h) > 20), None)
    if hit is None:
        sys.exit("não achei a troca de tela do primeiro toque")
    t_change = hit / 10
    off = round(t_tap - (t_change - REACTION), 2)
    d["offset"] = off
    path.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"primeiro toque (script) {t_tap}s -> tela muda no video em {t_change}s -> offset {off}s")


main()
