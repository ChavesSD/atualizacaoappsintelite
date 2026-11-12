# Vídeo do tutorial (tela do Mini PC + narração + legendas)

Gera `tutorial.mp4`, `tutorial.vtt`, `tutorial.jpg` e `tutorial.json` (capítulos) para `downloads/videos/`.
Nada de binário vai para o git: `raw/`, `work/` e `out/` são ignorados e tudo se refaz com os scripts.

Requisitos: Python 3, `pip install edge-tts pillow`, `ffmpeg`/`ffprobe` no PATH, `adb` (platform-tools) e o Mini PC com depuração USB.

1. **Texto**: edite `script.json` (um bloco por capítulo; a narração segue o mesmo caminho do passo a passo escrito da página).
2. **Voz**: `python narrate.py` → `work/narration/*.mp3|json` (voz neural pt-BR; só o texto vai ao serviço de voz da Microsoft).
3. **Gravação** (Mini PC): `python record.py prep --old-apk <apk antigo>`, depois `python record.py rec preparar 40`, `baixar`, `instalar`, `abrir`
   (ou `install-flow` para os toques do instalador) e, no fim, `python record.py restore`.
4. **Montagem**: copie `shots.example.json` para `shots.json`, ajuste cortes/zooms e rode
   `python assemble.py --shots shots.json --out out` → copie `out/tutorial.*` para `downloads/videos/`.

A duração de cada capítulo é a da narração + respiros; a gravação é acelerada até 1,4x ou tem o último quadro congelado para casar com a fala.
