"""Monta o vídeo final do tutorial: gravação da tela do Mini PC + narração + capítulos + legenda.

Entradas
  script.json   textos e títulos dos capítulos (usados também por narrate.py)
  shots.json    qual gravação (mp4 do screenrecord ou imagem) entra em cada capítulo, recorte e zooms
  work/narration/<id>.mp3|.json   gerados por narrate.py

Saídas (em --out): tutorial.mp4, tutorial.vtt, tutorial.jpg (poster 1280x720), tutorial.json (título, duração, capítulos)

Uso:  python assemble.py --shots shots.json --work work --out out
Requer: ffmpeg/ffprobe no PATH e Pillow (pip install pillow). Fontes Geist e logo vêm do próprio repositório.
"""
import argparse, json, pathlib, subprocess, sys, textwrap

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
FONTS = ROOT / "node_modules" / "geist" / "dist" / "fonts" / "geist-sans"
LOGO = ROOT / "public" / "logo-intelite.webp"

W, H, FPS = 1920, 1080, 30
SW, SH, SX, SY, RAD = 1600, 900, 160, 36, 26          # tela do Mini PC dentro do quadro
BAR_Y, BAR_H = 962, 84                                # faixa de capítulo
BG, SURFACE, BORDER = (5, 5, 7), (12, 13, 17), (52, 57, 71)
BRAND, BRAND_SOFT, BRAND_TEXT, MUTED, TEXT = (76, 155, 255), (12, 29, 56), (142, 192, 255), (154, 161, 178), (242, 244, 248)
MAX_SPEED = 1.4


def font(weight, size):
    return ImageFont.truetype(str(FONTS / f"Geist-{weight}.ttf"), size)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"ffmpeg falhou:\n{' '.join(map(str, cmd))}\n{r.stderr[-2500:]}")
    return r


def probe_duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(r.stdout.strip())


# ───────── imagens estáticas (Pillow) ─────────

def make_assets(d, chapters, title):
    d.mkdir(parents=True, exist_ok=True)
    logo = Image.open(LOGO).convert("RGBA")

    # fundo: preto com luz azul atrás da tela e moldura fina
    bg = Image.new("RGBA", (W, H), BG + (255,))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((SX - 140, SY - 120, SX + SW + 140, SY + SH + 160), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg.alpha_composite(Image.composite(Image.new("RGBA", (W, H), BRAND + (255,)), Image.new("RGBA", (W, H), (0, 0, 0, 0)), glow))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((SX, SY + 10, SX + SW, SY + SH + 10), RAD, fill=(0, 0, 0, 200))
    bg.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26)))
    ImageDraw.Draw(bg).rounded_rectangle((SX - 2, SY - 2, SX + SW + 1, SY + SH + 1), RAD + 2, outline=BORDER + (255,), width=2)
    bg.convert("RGB").save(d / "bg.png")

    mask = Image.new("L", (SW, SH), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SW - 1, SH - 1), RAD, fill=255)
    mask.save(d / "mask.png")

    # faixa de capítulo: número + título + os 4 capítulos (o atual em destaque) + logo
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for i, ch in enumerate(chapters):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        dr.rounded_rectangle((SX, BAR_Y, SX + SW, BAR_Y + BAR_H), 24, fill=SURFACE + (240,), outline=(32, 35, 44, 255), width=2)
        cx, cy = SX + 46, BAR_Y + BAR_H // 2
        dr.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=BRAND + (255,))
        num = f"{i + 1:02d}"
        fnum = font("Bold", 26)
        dr.text((cx, cy), num, font=fnum, fill=(4, 17, 31, 255), anchor="mm")
        dr.text((cx + 50, cy), ch["title"], font=font("Bold", 38), fill=TEXT + (255,), anchor="lm")
        x = SX + 520
        for j, c in enumerate(chapters):
            label = f"{j + 1}  {c['title']}"
            f = font("SemiBold" if j == i else "Medium", 24)
            w = int(tmp.textlength(label, font=f)) + 40
            if j == i:
                dr.rounded_rectangle((x, cy - 24, x + w, cy + 24), 24, fill=BRAND_SOFT + (255,), outline=BRAND + (255,), width=2)
            dr.text((x + w // 2, cy), label, font=f, fill=(BRAND_TEXT if j == i else MUTED) + (255,), anchor="mm")
            x += w + 14
        lh = 40
        lg = logo.resize((int(logo.width * lh / logo.height), lh), Image.LANCZOS)
        im.alpha_composite(lg, (SX + SW - lg.width - 34, cy - lh // 2))
        im.save(d / f"bar_{ch['id']}.png")

    # cartão de abertura
    im = Image.new("RGBA", (W, H), BG + (232,))
    dr = ImageDraw.Draw(im)
    lg = logo.resize((int(logo.width * 96 / logo.height), 96), Image.LANCZOS)
    im.alpha_composite(lg, ((W - lg.width) // 2, 300))
    dr.text((W // 2, 520), title, font=font("Bold", 92), fill=TEXT + (255,), anchor="mm")
    dr.text((W // 2, 616), "Atendimento Inteligente · totem e painel de chamadas", font=font("Regular", 38), fill=MUTED + (255,), anchor="mm")
    dr.rounded_rectangle((W // 2 - 60, 690, W // 2 + 60, 696), 3, fill=BRAND + (255,))
    im.save(d / "intro.png")


# ───────── expressões de zoom ─────────

TV = f"(on/{FPS})"  # tempo (s) dentro do zoompan: nº do quadro de saída / fps


def smooth(a, b, t0, t1):
    u = f"clip(({TV}-{t0:.3f})/{max(t1 - t0, 0.001):.3f},0,1)"
    s = f"({u}*{u}*(3-2*{u}))"
    return f"({a:.4f}+({b:.4f}-{a:.4f})*{s})"


def keyframe_expr(keys, field):
    """keys: [(t, z, cx, cy)] ordenado; interpola com suavização entre pares consecutivos."""
    idx = {"z": 1, "cx": 2, "cy": 3}[field]
    expr = f"{keys[-1][idx]:.4f}"
    for k0, k1 in reversed(list(zip(keys, keys[1:]))):
        expr = f"if(lt({TV},{k1[0]:.3f}),{smooth(k0[idx], k1[idx], k0[0], k1[0])},{expr})"
    return f"if(lt({TV},{keys[0][0]:.3f}),{keys[0][idx]:.4f},{expr})"


def zoom_keys(zooms, dur):
    keys = [(0.0, 1.0, 0.5, 0.5)]
    for z in zooms or []:
        t = float(z["t"])
        keys.append((t, keys[-1][1], keys[-1][2], keys[-1][3]))
        keys.append((t + float(z.get("in", 0.7)), float(z["z"]), float(z["cx"]), float(z["cy"])))
        keys.append((t + float(z.get("in", 0.7)) + float(z.get("hold", 2.0)), float(z["z"]), float(z["cx"]), float(z["cy"])))
        keys.append((t + float(z.get("in", 0.7)) + float(z.get("hold", 2.0)) + float(z.get("out", 0.8)), 1.0, 0.5, 0.5))
    keys = [k for k in sorted(keys, key=lambda k: k[0])]
    # remove tempos repetidos
    out = []
    for k in keys:
        if out and abs(k[0] - out[-1][0]) < 1e-3:
            out[-1] = k
        else:
            out.append(k)
    return out if len(out) > 1 else [(0.0, 1.0, 0.5, 0.5), (dur, 1.0, 0.5, 0.5)]


# ───────── legenda ─────────

def ts(sec):
    sec = max(sec, 0)
    h, r = divmod(sec, 3600)
    m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def cues_for(sentences, offset):
    cues = []
    for s in sentences:
        lines = textwrap.wrap(s["text"], 42)
        chunks = [lines[i:i + 2] for i in range(0, len(lines), 2)]
        total = sum(len(" ".join(c)) for c in chunks) or 1
        t = s["start"]
        for c in chunks:
            share = len(" ".join(c)) / total * (s["end"] - s["start"])
            cues.append((offset + t, offset + t + share, "\n".join(c)))
            t += share
    return cues


# ───────── montagem ─────────

def build_segment(i, ch, cfg, shot, narr, assets, work, total, offset, lead, dur, intro):
    seg = work / f"seg_{ch['id']}.mp4"
    src = pathlib.Path(shot["file"])
    if not src.is_absolute():
        src = (pathlib.Path(shot["_base"]) / src).resolve()
    is_img = src.suffix.lower() in (".png", ".jpg", ".jpeg")
    start, end = float(shot.get("start", 0)), shot.get("end")
    if is_img:
        clip_len = float(shot.get("duration", 8))
        start, end = 0.0, clip_len
    else:
        end = float(end) if end is not None else probe_duration(src)
        clip_len = end - start
    speed = min(max(1.0, clip_len / max(dur - 0.3, 1.0)), MAX_SPEED)
    if clip_len / speed > dur + 0.2:
        print(f"  aviso: {ch['id']}: a gravação tem {clip_len:.0f}s e só cabem {dur * speed:.0f}s; o final será cortado (grave menos tempo ocioso)")
    keys = zoom_keys(shot.get("zoom"), dur)
    zexpr, cxexpr, cyexpr = (keyframe_expr(keys, f) for f in ("z", "cx", "cy"))

    inputs = []
    if is_img:
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(src)]
    else:
        inputs += ["-ss", f"{start:.3f}", "-t", f"{clip_len:.3f}", "-i", str(src)]
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(assets / "bg.png")]
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(assets / "mask.png")]
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(assets / f"bar_{ch['id']}.png")]
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(assets / "intro.png")]
    inputs += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", f"color=c=0x4c9bff:s={W}x6:r={FPS}"]
    inputs += ["-i", str(work / "narration" / f"{ch['id']}.mp3")]

    g = []
    g.append(f"[0:v]setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS},tpad=stop_mode=clone:stop_duration={dur:.2f},trim=duration={dur:.3f},setpts=PTS-STARTPTS,"
             # sobe para 4K uma vez e deixa o zoompan recortar: sem tremor de arredondamento e sem perder nitidez no zoom
             f"scale=3840:2160:flags=lanczos,"
             f"zoompan=z='{zexpr}':x='max(0,min(iw-iw/({zexpr}),({cxexpr})*iw-iw/({zexpr})/2))':y='max(0,min(ih-ih/({zexpr}),({cyexpr})*ih-ih/({zexpr})/2))':d=1:s={SW}x{SH}:fps={FPS},format=yuv420p[scr]")
    g.append("[scr][2:v]alphamerge[scra]")
    g.append(f"[1:v][scra]overlay=x={SX}:y={SY}:format=auto[c1]")
    g.append(f"[3:v]format=rgba,fade=t=in:st={max(lead - 0.1, 0.1):.2f}:d=0.45:alpha=1[bar]")
    g.append(f"[c1][bar]overlay=x=0:y='18*pow(1-clip((t-{max(lead - 0.1, 0.1):.2f})/0.5,0,1),3)':format=auto[c2]")
    last = "c2"
    if intro:
        g.append(f"[4:v]format=rgba,fade=t=out:st={max(lead - 0.9, 0.5):.2f}:d=0.8:alpha=1[intro]")
        g.append(f"[c2][intro]overlay=x=0:y=0:format=auto[c3]")
        last = "c3"
    g.append(f"[{last}][5:v]overlay=x='-overlay_w+main_w*({offset:.3f}+t)/{total:.3f}':y={H - 6}:format=auto,format=yuv420p[v]")
    g.append(f"[6:a]loudnorm=I=-16:TP=-1.5:LRA=11,adelay={int(lead * 1000)}:all=1,apad=whole_dur={dur:.3f},aresample=48000[a]")
    gs = work / f"graph_{ch['id']}.txt"
    gs.write_text(";\n".join(g), encoding="utf-8")
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex_script", str(gs), "-map", "[v]", "-map", "[a]", "-t", f"{dur:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", str(seg)])
    return seg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", default=str(HERE / "script.json"))
    ap.add_argument("--shots", required=True, help="JSON: capítulo -> {file, start, end, zoom:[{t,z,cx,cy,in,hold,out}]}")
    ap.add_argument("--work", default=str(HERE / "work"))
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--poster-at", type=float, default=None, help="segundo do vídeo final para o poster (padrão: meio do capítulo Instalar)")
    a = ap.parse_args()

    cfg = json.loads(pathlib.Path(a.script).read_text(encoding="utf-8"))
    shots_path = pathlib.Path(a.shots).resolve()
    shots = json.loads(shots_path.read_text(encoding="utf-8"))
    work, out = pathlib.Path(a.work).resolve(), pathlib.Path(a.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    chapters = cfg["chapters"]
    assets = work / "assets"
    make_assets(assets, chapters, cfg["title"])

    narr = {ch["id"]: json.loads((work / "narration" / f"{ch['id']}.json").read_text(encoding="utf-8")) for ch in chapters}
    leads = [cfg["introLead"] if i == 0 else cfg["lead"] for i in range(len(chapters))]
    durs = [leads[i] + narr[ch["id"]]["duration"] + cfg["tail"] for i, ch in enumerate(chapters)]
    offsets = [sum(durs[:i]) for i in range(len(chapters))]
    total = sum(durs)

    segs, cues = [], []
    for i, ch in enumerate(chapters):
        print(f"{i + 1}/{len(chapters)} {ch['title']}: {durs[i]:.1f}s")
        shot = dict(shots[ch["id"]])
        shot["_base"] = str(shots_path.parent)
        segs.append(build_segment(i, ch, cfg, shot, narr[ch["id"]], assets, work, total, offsets[i], leads[i], durs[i], i == 0))
        cues += cues_for(narr[ch["id"]]["sentences"], offsets[i] + leads[i])

    lst = work / "concat.txt"
    lst.write_text("".join(f"file '{s.as_posix()}'\n" for s in segs), encoding="utf-8")
    final = out / "tutorial.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(final)])

    vtt = ["WEBVTT", ""]
    for n, (s, e, text) in enumerate(cues):
        nxt = cues[n + 1][0] if n + 1 < len(cues) else e + 1
        vtt += [f"{ts(s)} --> {ts(min(e + 0.2, nxt))}", text, ""]
    (out / "tutorial.vtt").write_text("\n".join(vtt), encoding="utf-8")

    info = {"title": cfg["title"], "durationSec": round(probe_duration(final)), "chapters": [{"title": ch["title"], "start": round(offsets[i], 2)} for i, ch in enumerate(chapters)]}
    (out / "tutorial.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")

    pi = next(i for i, ch in enumerate(chapters) if ch["id"] == "instalar") if any(ch["id"] == "instalar" for ch in chapters) else 0
    at = a.poster_at if a.poster_at is not None else offsets[pi] + durs[pi] * 0.55
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at:.2f}", "-i", str(final), "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "3", str(out / "tutorial.jpg")])
    size = final.stat().st_size / 1048576
    print(f"\nOK: {final} ({info['durationSec']}s, {size:.1f} MB)")


if __name__ == "__main__":
    main()
