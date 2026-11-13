"""Grava no Mini PC o fluxo "ajustar a proporção da tela" (Home → Configurações → Preferências → Exibição → Ajuste de proporção → ajustar → voltar).

  python ajustar/take.py reset      # Chrome aberto na tela de partida e proporção de tela no padrão (100,100,100,100)
  python ajustar/take.py run        # grava ~100 s com o scrcpy e salva ajustar/raw/take.mp4 + take.events.json
  python ajustar/take.py restore    # devolve a proporção de tela ao padrão e a tela inicial

O Android só aceita uma tecla por chamada do `input` a cada ~1,4 s neste aparelho (a JVM sobe a cada chamada), então cada
chamada é disparada LAT segundos ANTES do instante em que o efeito deve aparecer. Os apertos das setas durante o ajuste não
mudam nada na gravação (a captura do scrcpy não sofre o overscan), então vão em rajada e a animação "por fora" os mostra um a um.
"""
import argparse, json, os, pathlib, subprocess, sys, time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import take as base  # noqa: E402  (start_recorder, adb, sh)

RAW = HERE / "raw"
ADB = base.ADB
LAT = float(os.environ.get("KEY_LAT", "1.35"))   # atraso (s) entre disparar `input keyevent` e a tecla chegar ao app
PROP = "persist.disp.margin.hdmi"

K = {"HOME": 3, "BACK": 4, "UP": 19, "DOWN": 20, "LEFT": 21, "RIGHT": 22, "OK": 23}

# Instantes (s) em que o EFEITO deve aparecer no vídeo final: (tempo, [teclas]). Capítulos: 0 / 22,6 / 37,5 / 73,8 / 90,6 s.
SCHEDULE = [
    (16.0, ["HOME"]),                 # "aperte o botão Home"
    (18.6, ["LEFT"] * 5),             # foco até CONFIGURAÇÕES (barra de baixo)
    (20.6, ["OK"]),                   # abre Configurações
    (23.7, ["DOWN"] * 2),             # Rede → Contas → Apps
    (25.0, ["DOWN"]),                 # Preferências do dispositivo
    (26.3, ["OK"]),
    (27.8, ["DOWN"] * 5),             # Sobre … Exibição
    (29.3, ["OK"]),
    (31.0, ["DOWN"]),                 # Ajuste de proporção de tela (HDMI)
    (36.9, ["OK"]),                   # abre a tela verde
    (50.6, ["LEFT"] * 12),            # reduz a largura
    (55.4, ["DOWN"] * 12),            # reduz a altura
    (64.6, ["RIGHT"]),
    (66.0, ["UP"]),
    (76.0, ["BACK"]),                 # voltar até a tela inicial
    (77.5, ["BACK"]),
    (79.0, ["BACK"]),
    (80.5, ["BACK"]),
]
TOTAL = 91.0


def prop():
    return base.sh(f"getprop {PROP}", check=False).strip()


def reset(_=None):
    RAW.mkdir(exist_ok=True)
    base.sh("settings put system show_touches 0", check=False)
    base.sh("am force-stop com.android.chrome", check=False)
    # a tela de partida é a própria página do tutorial no Chrome do Mini PC
    base.sh("am start -a android.intent.action.VIEW -d https://atualizacaoappsintelite.onrender.com/ -p com.android.chrome", check=False)
    time.sleep(12)
    print("margem:", prop())


def restore(_=None):
    """Volta as margens a 100,100,100,100: abre a tela de ajuste e aperta direita/cima até o limite."""
    base.sh("am start -n com.android.tv.settings/com.android.tv.settings.device.display.DisplayPercentageActivity", check=False)
    time.sleep(3)
    base.sh("input keyevent " + " ".join([str(K["RIGHT"])] * 20 + [str(K["UP"])] * 20))
    time.sleep(1.5)
    base.sh("input keyevent 4 3", check=False)
    time.sleep(1.5)
    print("margem:", prop())


def run(a):
    RAW.mkdir(exist_ok=True)
    out = RAW / "take.mp4"
    if out.exists():
        out.unlink()
    base.RAW = RAW
    rec, ready = base.start_recorder(out, int(TOTAL + 12))
    if not ready.wait(40):
        rec.kill(); sys.exit("scrcpy não começou a gravar")
    t0 = time.time()
    now = lambda: time.time() - t0
    log, procs = [], []
    for eff, keys in SCHEDULE:
        issue = eff - LAT
        d = issue - now()
        if d > 0:
            time.sleep(d)
        codes = " ".join(str(K[k]) for k in keys)
        procs.append(subprocess.Popen([ADB, "shell", f"input keyevent {codes}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        log.append({"issue": round(now(), 3), "effect": eff, "keys": keys})
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
    (RAW / "take.events.json").write_text(json.dumps({"lat": LAT, "events": log, "margin": prop()}, indent=2), encoding="utf-8")
    print("salvo", out, "margem final:", prop())


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("reset").set_defaults(f=reset)
    sp.add_parser("run").set_defaults(f=run)
    sp.add_parser("restore").set_defaults(f=restore)
    a = ap.parse_args()
    a.f(a)
