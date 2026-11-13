"""Regrava só o capítulo "Abrir" do tutorial de atualização (primeira abertura do app), agora com "Tornar app inicial".

  python take_abrir.py reset    # desinstala e reinstala o app 1.20 (volta o "app inicial" ao padrão do aparelho) e vai para a tela inicial
  python take_abrir.py run      # grava com o scrcpy: abre o app → "Tornar app inicial" → AI Híbrido → "Definir como padrão" → Permitir → conteúdo
  python take_abrir.py restore  # desinstala o app (o aparelho volta ao Nova Launcher como tela inicial)

Salva raw/abrir.mp4 e raw/abrir.taps.json (toques no relógio do script). Depois: calibre com `python take_abrir.py calib`,
rode o cursor (cursor.py --take raw/abrir.mp4 --taps raw/abrir.taps.json --out raw/abrir.cur.mp4 ...) e aponte "abrir" em shots.json.
"""
import argparse, json, os, pathlib, subprocess, sys, threading, time

import take as base

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / "raw"
ADB = base.ADB
APK = HERE.parent / "downloads" / "ai-hibrido-1.20.apk"
PKG = "com.intelite.aihibrido"
LAT = 1.35      # atraso do `input tap` até o toque chegar ao app
# (instante do toque no relógio do script a partir do `am start`, x, y, nota); o aviso "Abrir sozinho ao ligar" some sozinho ~11,5 s depois de abrir
TAPS = [(9.0, 836, 494, "Tornar app inicial"), (11.4, 874, 314, "AI Híbrido"), (13.8, 810, 502, "Definir como padrão"), (20.8, 973, 621, "Permitir (fotos e mídia)")]
LAUNCH_AT = 2.0
TOTAL = 62.0


def reset(_=None):
    RAW.mkdir(exist_ok=True)
    base.sh("settings put system show_touches 0", check=False)
    base.sh(f"am force-stop {PKG}", check=False)
    base.sh(f"pm uninstall {PKG}", check=False)
    print(base.adb("install", "-r", "-d", str(APK)))
    base.sh("input keyevent KEYCODE_HOME", check=False)
    time.sleep(3)
    print(base.sh("dumpsys window | grep mCurrentFocus", check=False))


def restore(_=None):
    base.sh(f"am force-stop {PKG}", check=False)
    print(base.sh(f"pm uninstall {PKG}", check=False))
    base.sh("input keyevent KEYCODE_HOME", check=False)


def run(_=None):
    out = RAW / "abrir.mp4"
    if out.exists():
        out.unlink()
    rec, ready = base.start_recorder(out, int(TOTAL + 8))
    if not ready.wait(40):
        rec.kill(); sys.exit("scrcpy não começou a gravar")
    t0 = time.time()
    now = lambda: time.time() - t0
    taps, procs = [], []
    time.sleep(LAUNCH_AT)
    launch = now()
    procs.append(subprocess.Popen([ADB, "shell", f"am start -n {PKG}/.RoteadorActivity"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for rel, x, y, note in TAPS:
        d = launch + rel - now()
        if d > 0:
            time.sleep(d)
        taps.append({"t": round(now(), 3), "x": x, "y": y, "note": note})
        procs.append(subprocess.Popen([ADB, "shell", f"input tap {x} {y}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    d = TOTAL - now()
    if d > 0:
        time.sleep(d)
    for p in procs:
        p.wait(timeout=10)
    try:
        rec.wait(timeout=30)
    except subprocess.TimeoutExpired:
        rec.terminate()
    time.sleep(1.0)
    (RAW / "abrir.taps.json").write_text(json.dumps({"taps": taps, "launch": round(launch, 3)}, indent=2, ensure_ascii=False), encoding="utf-8")
    print("salvo", out, taps)


def calib(_=None):
    """Acha no vídeo o instante em que o aviso "Definir como app inicial" escurece a tela (efeito do 1º toque) e grava o offset."""
    path = RAW / "abrir.taps.json"
    d = json.loads(path.read_text(encoding="utf-8"))
    w, h = 160, 90
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(RAW / "abrir.mp4"), "-vf", f"fps=20,scale={w}:{h},format=gray", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    import numpy as np
    n = len(raw) // (w * h)
    a = np.frombuffer(raw, np.uint8).reshape(n, w * h).astype(np.float32)
    diff = np.abs(a[1:] - a[:-1]).mean(1)
    t_tap = d["taps"][0]["t"]
    # primeira mudança forte depois de (toque - 0,5 s): a tela escurece e aparece o aviso do sistema
    start = int(max(0, t_tap - 0.5) * 20)
    hit = next(i for i in range(start, len(diff)) if diff[i] > 8)
    t_change = (hit + 1) / 20
    # a abertura do app (primeira mudança forte do vídeo) marca o início do capítulo
    first = next(i for i in range(len(diff)) if diff[i] > 8)
    d["offset"] = round(t_tap - (t_change - 0.35), 2)
    d["launchEffect"] = round((first + 1) / 20, 2)
    path.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"toque 1 no relógio {t_tap}s → tela muda em {t_change}s → offset {d['offset']}s; app abre no vídeo em {d['launchEffect']}s")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    for name, f in (("reset", reset), ("run", run), ("restore", restore), ("calib", calib)):
        sp.add_parser(name).set_defaults(f=f)
    a = ap.parse_args()
    a.f(a)
