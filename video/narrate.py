"""Gera a narração (edge-tts) de cada capítulo de script.json.

Saída em <work>/narration/: <id>.mp3 e <id>.json ({duration, sentences:[{start,end,text}]}).
Uso:  python narrate.py [--work work] [--script script.json]
Requer: pip install edge-tts   (a voz neural é sintetizada pelo serviço online da Microsoft; só o texto vai pela rede)
"""
import argparse, asyncio, json, pathlib, subprocess, sys
import edge_tts

TICKS = 10_000_000  # 100 ns


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


async def synth(cfg, ch, outdir):
    mp3 = outdir / f"{ch['id']}.mp3"
    com = edge_tts.Communicate(ch["text"], cfg["voice"], rate=cfg.get("rate", "+0%"), pitch=cfg.get("pitch", "+0Hz"), boundary="SentenceBoundary")
    sentences = []
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "SentenceBoundary":
                start = chunk["offset"] / TICKS
                sentences.append({"start": start, "end": start + chunk["duration"] / TICKS, "text": chunk["text"].strip()})
    dur = probe(mp3)
    if sentences:
        sentences[-1]["end"] = min(max(sentences[-1]["end"], sentences[-1]["start"] + 0.5), dur)
    (outdir / f"{ch['id']}.json").write_text(json.dumps({"duration": dur, "sentences": sentences}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{ch['id']}: {dur:.1f}s, {len(sentences)} frases")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", default=str(pathlib.Path(__file__).with_name("script.json")))
    ap.add_argument("--work", default=str(pathlib.Path(__file__).with_name("work")))
    a = ap.parse_args()
    cfg = json.loads(pathlib.Path(a.script).read_text(encoding="utf-8"))
    outdir = pathlib.Path(a.work) / "narration"
    outdir.mkdir(parents=True, exist_ok=True)
    for ch in cfg["chapters"]:
        await synth(cfg, ch, outdir)


if __name__ == "__main__":
    asyncio.run(main())
