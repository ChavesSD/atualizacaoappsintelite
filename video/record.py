"""Grava a tela do Mini PC (Android, via ADB) para o vídeo do tutorial e restaura o aparelho depois.

  python record.py prep    --old-apk F:/Docs/Hibridos/ai_hibrido_1.5.apk   # deixa a versão ANTIGA instalada (o vídeo mostra "atualizar por cima")
  python record.py rec     baixar 60                                       # grava 60 s em raw/baixar.mp4 (você faz os passos no aparelho ou use os atalhos abaixo)
  python record.py install-flow                                            # (opcional) faz sozinho os toques do instalador, na ordem real
  python record.py shot    nome                                            # captura de tela em raw/nome.png
  python record.py restore --package com.intelite.aihibrido                # devolve o aparelho ao estado inicial

ADB: variável de ambiente ADB (caminho do adb.exe) ou `adb` no PATH. Serial opcional: ANDROID_SERIAL.
Os toques usam as coordenadas do aparelho de teste (Proeletronic PROSB5000, 1280x720); confira em outro modelo.
"""
import argparse, json, os, pathlib, subprocess, sys, time

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / "raw"
STATE = RAW / "device-original.json"
ADB = os.environ.get("ADB", "adb")
PKG = "com.intelite.aihibrido"


def adb(*args, check=True, binary=False):
    r = subprocess.run([ADB, *args], capture_output=True, text=not binary)
    if check and r.returncode != 0:
        sys.exit(f"adb {' '.join(args)} falhou: {r.stderr if not binary else r.stderr.decode()}")
    return r.stdout if binary else r.stdout.strip().replace("\r", "")


def sh(cmd):
    return adb("shell", cmd)


def tap(x, y, wait=1.2):
    sh(f"input tap {x} {y}")
    time.sleep(wait)


def prep(a):
    RAW.mkdir(exist_ok=True)
    state = {
        "show_touches": sh("settings get system show_touches"),
        "chrome_install": sh("appops get com.android.chrome REQUEST_INSTALL_PACKAGES"),
        "filemanager_install": sh("appops get com.softwinner.TvdFileManager REQUEST_INSTALL_PACKAGES"),
        "had_app": PKG in sh("pm list packages -3"),
    }
    STATE.write_text(json.dumps(state, indent=2))
    sh("settings put system show_touches 1")                       # os toques aparecem como círculos no vídeo
    for pkg in ("com.android.chrome", "com.softwinner.TvdFileManager"):
        sh(f"appops set {pkg} REQUEST_INSTALL_PACKAGES default")   # para o vídeo mostrar o pedido de "fontes desconhecidas"
    if a.old_apk:
        print(adb("install", "-r", "-d", a.old_apk))
        print("instalado:", sh(f"dumpsys package {PKG} | grep versionName").strip())
    print("pronto. estado original salvo em", STATE)


def rec(a):
    RAW.mkdir(exist_ok=True)
    out = RAW / f"{a.name}.mp4"
    remaining, parts = a.seconds, []
    while remaining > 0:                                           # screenrecord limita cada arquivo a 180 s
        n = min(remaining, 170)
        remote = f"/sdcard/_rec_{a.name}_{len(parts)}.mp4"
        print(f"gravando {n}s... (comece agora)")
        sh(f"screenrecord --size 1280x720 --bit-rate 6000000 --time-limit {n} {remote}")
        local = RAW / f"_{a.name}_{len(parts)}.mp4"
        adb("pull", remote, str(local))
        sh(f"rm {remote}")
        parts.append(local)
        remaining -= n
    if len(parts) == 1:
        parts[0].replace(out)
    else:
        lst = RAW / f"_{a.name}.txt"
        lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)], check=True)
    print("salvo:", out)


def install_flow(a):
    """Toques do instalador, na ordem real observada (PackageInstaller do Android 10 em pt-BR)."""
    steps = [
        ("CONFIGURAÇÕES (fontes desconhecidas)", 833, 447, 3.0),
        (f"liga a chave do app de origem ({a.source})", 1100, {"hibrido": 251, "chrome": 316, "filemanager": 381}[a.source], 2.0),
    ]
    for label, x, y, w in steps:
        print(label); tap(x, y, w)
    sh("input keyevent KEYCODE_BACK"); time.sleep(2.5)
    for label, x, y, w in [("ACEITAR", 861, 426, 3.0), ("INSTALAR (atualização)", 857, 412, 16.0), ("ABRIR", 869, 412, 5.0)]:
        print(label); tap(x, y, w)


def shot(a):
    RAW.mkdir(exist_ok=True)
    (RAW / f"{a.name}.png").write_bytes(adb("exec-out", "screencap", "-p", binary=True))
    print("salvo:", RAW / f"{a.name}.png")


def restore(a):
    st = json.loads(STATE.read_text()) if STATE.exists() else {}
    orig = st.get("show_touches", "null")
    sh("settings delete system show_touches" if orig in ("null", "") else f"settings put system show_touches {orig}")
    for pkg in ("com.android.chrome", "com.softwinner.TvdFileManager"):
        sh(f"appops set {pkg} REQUEST_INSTALL_PACKAGES default")
    if a.package and not st.get("had_app", False):
        sh(f"am force-stop {a.package}"); print(sh(f"pm uninstall {a.package}"))
    sh("rm -f /sdcard/Download/ai_hibrido_*.apk /sdcard/ui.xml")
    print("aparelho restaurado")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("prep"); p.add_argument("--old-apk"); p.set_defaults(f=prep)
    p = sp.add_parser("rec"); p.add_argument("name"); p.add_argument("seconds", type=int); p.set_defaults(f=rec)
    p = sp.add_parser("install-flow"); p.add_argument("--source", default="chrome", choices=["hibrido", "chrome", "filemanager"]); p.set_defaults(f=install_flow)
    p = sp.add_parser("shot"); p.add_argument("name"); p.set_defaults(f=shot)
    p = sp.add_parser("restore"); p.add_argument("--package", default=PKG); p.set_defaults(f=restore)
    a = ap.parse_args()
    a.f(a)
