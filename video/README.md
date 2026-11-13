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


## Vídeo de ajuste da proporção da tela (`ajustar/`)

Mesmo padrão do tutorial (voz neural, legenda, capítulos, cursor e animações), mas a captura do scrcpy **não mostra o efeito do ajuste**
(o overscan não aparece no que o scrcpy grava). Por isso o resultado é mostrado "por fora", numa TV desenhada que reage a cada aperto
de seta (com a tela real do painel, `public/painel-tela.webp`), ao lado de um controle remoto que acende a tecla apertada.

1. `python narrate.py --script ajustar/script.json --work ajustar/work` → narração (mesma voz de `script.json`).
2. `python ajustar/take.py reset` e `python ajustar/take.py run` → grava `ajustar/raw/take.mp4` (Home → Configurações → Preferências do
   dispositivo → Exibição → Ajuste de proporção de tela → setas → Voltar). O `input keyevent` do aparelho leva ~1,4 s por chamada, então
   cada tecla é disparada `KEY_LAT` s antes do instante desejado. `python ajustar/take.py restore` devolve a proporção a 100,100,100,100.
3. Meça nos quadros gravados quando cada efeito apareceu e ajuste `PRESSES`, `OK_POS` e `ACTIONS` em `ajustar/compose.py`
   (a gravação é VFR; o instante 0 é o início da gravação).
4. `python ajustar/compose.py` → `ajustar/out/ajustar.{mp4,vtt,json,jpg}`; copie para `downloads/videos/`.

### Atualização (13/11): capítulo "Abrir" e vídeo de ajuste
- `video/take_abrir.py` regrava só o capítulo "Abrir" (primeira abertura: **Tornar app inicial** → AI Híbrido → **Definir como padrão** → Permitir);
  depois `calib`, `cursor.py --take raw/abrir.mp4 ...` e `assemble.py`. Ao terminar, `python take_abrir.py restore` desinstala o app (o aparelho volta ao Nova Launcher).
- O vídeo de ajuste (`ajustar/`) agora começa com o **painel aberto**: Home mostra "Voltando ao painel…" (5 s); toque no logo da Intelite leva à tela inicial
  do sistema; ao final, Galeria de apps → AI Híbrido reabre o painel. O controle remoto desenhado é o do SmartPRO (foto do equipamento).
  Requer o app 1.19 instalado (`python take_abrir.py reset`) e, depois, `python ajustar/take.py restore` + `python take_abrir.py restore`.
