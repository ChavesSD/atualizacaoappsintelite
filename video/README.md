# Vídeo do tutorial (tela do Mini PC + narração + legendas + cursor)

Gera `tutorial.mp4`, `tutorial.vtt`, `tutorial.jpg` e `tutorial.json` (capítulos) para `downloads/videos/`.
Nada de binário vai para o git: `raw/`, `work/` e `out/` são ignorados e tudo se refaz com os scripts.

Requisitos: Python 3, `pip install edge-tts pillow`, `ffmpeg`/`ffprobe` no PATH, `adb` (platform-tools) e `scrcpy`
(variáveis de ambiente `ADB` e `SCRCPY` com o caminho dos executáveis) e o Mini PC com depuração USB.

1. **Texto**: edite `script.json` (um bloco por capítulo; a narração segue o mesmo caminho do passo a passo escrito da página)
   e rode `python narrate.py` → `work/narration/*` (voz neural pt-BR; só o texto vai ao serviço de voz da Microsoft).
2. **Gravação** (Mini PC): `python take.py reset` deixa a VERSÃO ANTIGA instalada e o Chrome limpo; `python take.py run --url <link curto>`
   grava o fluxo inteiro (Preparar → Baixar → Instalar → Abrir) com o scrcpy e registra cada toque em `raw/take.taps.json`.
   (O `screenrecord` do Android não serve: ele para quando o app híbrido abre.) Depois `python record.py restore` devolve o aparelho.
   Os toques usam coordenadas do Proeletronic PROSB5000 (1280x720): confira em outro modelo.
3. **Cursor**: `python calib.py` alinha o relógio dos toques com o vídeo; `python cursor.py --length 148 --cover 113,0,664,1280,56`
   desenha o cursor e o anel de clique (e uma tarja sobre o letreiro de notícias do app) em `raw/take.cur.mp4`.
4. **Montagem**: ajuste os cortes/zooms em `shots.json` e rode `python assemble.py --shots shots.json --out out`; copie `out/tutorial.*`
   para `downloads/videos/`. A duração de cada capítulo é a da narração + respiros; a gravação é acelerada até 1,4x ou tem o último quadro congelado.

