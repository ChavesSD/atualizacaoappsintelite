"""Grava de uma vez o fluxo completo no Mini PC (Preparar → Baixar → Instalar → Abrir) e registra cada toque.

  python take.py reset                         # volta o aparelho ao ponto de partida (app ANTIGO instalado, Chrome sem permissão de armazenamento)
  python take.py run --url is.gd/aihib19       # grava o fluxo inteiro (~110 s) e salva raw/take.mp4 + raw/take.taps.json
  python take.py split                         # corta raw/take.mp4 em raw/<capítulo>.mp4 e re-base dos toques por capítulo

Os toques usam coordenadas do Proeletronic PROSB5000 (1280x720). Os tempos são do relógio deste script; a calibração com o
vídeo (quando o primeiro círculo de toque aparece) é feita em `split` e vira o deslocamento gravado em taps.json.
"""
import argparse, json, os, pathlib, subprocess, sys, time

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / "raw"
ADB = os.environ.get("ADB", "adb")
PKG = "com.intelite.aihibrido"
OLD_APK = os.environ.get("OLD_APK", "F:/Docs/Hibridos/ai_hibrido_1.5.apk")
LAUNCHER = "com.a.nova.launcher/com.a.nova.launcher.ui.MainActivity"

# (nome, início, fim) em segundos do relógio do script; o corte final é feito pelo nome do capítulo
CHAPTERS = [("preparar", 0, 26), ("baixar", 26, 47), ("instalar", 47, 86), ("abrir", 86, 114)]


def adb(*a, check=True):
    r = subprocess.run([ADB, *a], capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"adb {' '.join(a)} falhou: {r.stderr}")
    return r.stdout.strip().replace("\r", "")


def sh(c, check=True):
    return adb("shell", c, check=check)


def reset(_=None):
    RAW.mkdir(exist_ok=True)
    sh("settings put system show_touches 1")
    sh(f"am force-stop {PKG}", check=False)
    sh(f"pm uninstall {PKG}", check=False)
    print(adb("install", "-r", "-d", OLD_APK))
    sh("rm -f /sdcard/Download/AI_Hibrido_*.apk /sdcard/Download/ai_hibrido_*.apk", check=False)
    for p in ("com.android.chrome", "com.softwinner.TvdFileManager"):
        sh(f"appops set {p} REQUEST_INSTALL_PACKAGES default", check=False)
    for perm in ("WRITE_EXTERNAL_STORAGE", "READ_EXTERNAL_STORAGE"):   # sem pedido de armazenamento no vídeo (o texto cobre o "se pedir")
        sh(f"pm grant com.android.chrome android.permission.{perm}", check=False)
    sh("am force-stop com.android.chrome", check=False)
    # Chrome limpo: uma única guia "Nova guia" (a anterior pode ser a página Downloads da gravação passada)
    sh("am start -n com.android.chrome/com.google.android.apps.chrome.Main", check=False)
    time.sleep(4.5)
    sh("input tap 281 22"); time.sleep(1.8)    # nova guia
    sh("input tap 233 22"); time.sleep(1.8)    # fecha a guia antiga (X da primeira)
    sh(f"am start -n {LAUNCHER}")
    time.sleep(2)
    print("pronto: app antigo", sh(f"dumpsys package {PKG} | grep versionName").strip())


class Clock:
    def __init__(self):
        self.t0 = time.time()
        self.taps = []
        self.marks = {}
        self.events = []

    def now(self):
        return time.time() - self.t0

    def until(self, t):
        d = t - self.now()
        if d > 0:
            time.sleep(d)

    def tap(self, x, y, note=""):
        self.taps.append({"t": round(self.now(), 3), "x": x, "y": y, "note": note})
        sh(f"input tap {x} {y}")

    def wait(self, secs):
        time.sleep(secs)

    def log(self, what):
        self.events.append({"t": round(self.now(), 3), "what": what})

    def mark(self, name):
        self.marks[name] = round(self.now(), 3)

    def key(self, code):
        sh(f"input keyevent {code}")

    KEYS = {"i": 37, "s": 47, ".": 56, "g": 35, "d": 32, "/": 76, "a": 29, "h": 36, "b": 30, "1": 8, "9": 16, "2": 9, "3": 10, "4": 11,
            "5": 12, "6": 13, "7": 14, "8": 15, "0": 7}

    def type(self, text):
        # `input text` leva ~2 s por chamada neste aparelho; `input keyevent` aceita vários códigos numa chamada só.
        # Digita em dois blocos (domínio e código) para dar ritmo de digitação.
        cut = text.index("/") + 1 if "/" in text else len(text)
        for part in (text[:cut], text[cut:]):
            if part:
                sh("input keyevent " + " ".join(str(self.KEYS[ch]) for ch in part))
                time.sleep(0.5)


def wait_focus(name, timeout=45):
    t = time.time()
    while time.time() - t < timeout:
        if name in sh("dumpsys window | grep mCurrentFocus", check=False):
            return True
        time.sleep(0.8)
    return False


def wait_version(v, timeout=60):
    t = time.time()
    while time.time() - t < timeout:
        if f"versionName={v}" in sh(f"dumpsys package {PKG} | grep versionName", check=False):
            return True
        time.sleep(1.0)
    return False


SCRCPY = os.environ.get("SCRCPY", "scrcpy")


def start_recorder(out, limit):
    """scrcpy --record em vez de screenrecord: o screenrecord morre quando o app híbrido abre (ele usa superfície protegida).
    Devolve (processo, evento 'gravando'); o relógio do roteiro começa quando o scrcpy avisa que a gravação começou."""
    import threading
    proc = subprocess.Popen([SCRCPY, "--no-playback", "--no-audio", "--record", str(out), "--time-limit", str(limit), "--max-size", "1280"],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    ready = threading.Event()

    def pump():
        for line in proc.stdout:
            if "Recording started" in line:
                ready.set()
    threading.Thread(target=pump, daemon=True).start()
    return proc, ready


def run(a):
    RAW.mkdir(exist_ok=True)
    out = RAW / "take.mp4"
    if out.exists():
        out.unlink()
    rec, ready = start_recorder(out, a.limit)
    if not ready.wait(40):
        rec.kill(); sys.exit("scrcpy não começou a gravar")
    c = Clock()
    # ── Preparar: tela inicial, depois Galeria de apps → Chrome ──
    c.until(19.0); c.tap(840, 600, "Galeria de apps")
    c.wait(3.6); c.tap(217, 380, "Chrome")
    c.until(26.0); c.mark("preparar")
    # ── Baixar: digita o link curto e abre o arquivo quando o aviso "download concluído" aparece ──
    c.tap(640, 68, "barra de endereço")
    c.wait(1.8); c.type(a.url)
    c.wait(1.0); c.key("KEYCODE_ENTER"); c.log("enter")
    c.wait(a.snack); c.tap(813, 696, "Abrir (download concluído)")
    c.wait(1.0); c.mark("baixar")
    # ── Instalar: aviso de fontes desconhecidas → Configurações → chave do Chrome → voltar → abrir o arquivo de novo →
    #    Aceitar → "instalar uma atualização" → Instalar → App instalado → Abrir ──
    c.wait(4.0); c.tap(833, 447, "Configurações")
    c.wait(3.0); c.tap(1196, 316, "chave do Chrome")
    c.wait(2.5); c.key("KEYCODE_BACK"); c.log("voltar")
    c.wait(2.0); c.tap(1257, 68, "menu do Chrome")
    c.wait(1.5); c.tap(1073, 366, "Downloads")
    c.wait(2.5); c.tap(480, 248, "arquivo baixado")
    c.wait(2.5); c.tap(861, 426, "Aceitar")
    c.wait(5.0); c.tap(857, 412, "Instalar")
    ok = wait_version("1.19", 60)
    c.wait(4.0); c.log(f"instalado={ok}"); c.tap(869, 412, "Abrir (App instalado)")
    c.wait(1.5); c.mark("instalar")
    # ── Abrir: primeira abertura (MAC e versão → "abrir sozinho ao ligar" → permissão de mídia → baixa o conteúdo → conteúdo rodando) ──
    c.wait(5.0); c.tap(654, 494, "Agora não (abrir sozinho ao ligar)")
    wait_focus("GrantPermissionsActivity", 45)
    c.wait(2.5); c.tap(973, 621, "Permitir (fotos e mídia)")
    c.wait(30.0); c.mark("abrir")
    try:
        rec.wait(timeout=max(5, a.limit - c.now() + 25))
    except subprocess.TimeoutExpired:
        rec.terminate()
    time.sleep(1.0)
    (RAW / "take.taps.json").write_text(json.dumps({"taps": c.taps, "marks": c.marks, "log": c.events, "url": a.url}, indent=2, ensure_ascii=False), encoding="utf-8")
    print("salvo raw/take.mp4 e raw/take.taps.json:", len(c.taps), "toques; marcas", c.marks, c.events)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("reset").set_defaults(f=reset)
    p = sp.add_parser("run"); p.add_argument("--url", default="is.gd/aihib19"); p.add_argument("--snack", type=float, default=5.5); p.add_argument("--limit", type=int, default=155); p.set_defaults(f=run)
    a = ap.parse_args()
    a.f(a)
