"use client";
import { Fragment, useState } from "react";
import { TUTORIAL_VIDEOS, isTutorialVideo, videoPoster, videoSrc, type TutorialVideo } from "@/lib/videos";
import { DownloadOptions } from "./DownloadOptions";
import { Alert, Icon } from "./ui";

export interface PublicStep {
  key: string;
  title: string;
  instructions: string[];
  warning: string | null;
  imagePath: string | null;
  video: { kind: "embed" | "file"; src: string; title: string } | null;
}

interface PlayerVideo { kind: "embed" | "file"; src: string; title: string; poster?: string; note?: string }

/** Vídeo sob demanda: nada é baixado até o toque em ▶. Se falhar, o texto continua logo abaixo. */
export function Video({ video }: { video: PlayerVideo }) {
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return <Alert tone="warn" role="alert">Não foi possível reproduzir o vídeo agora. Siga as instruções escritas abaixo.</Alert>;
  return (
    <figure style={{ margin: 0 }}>
      <div className="video">
        {!on ? (
          <button type="button" className="poster" style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined} onClick={() => setOn(true)} aria-label={`Reproduzir vídeo: ${video.title}`}>
            <span className="play" aria-hidden><Icon name="play" /></span>
          </button>
        ) : video.kind === "file" ? (
          <video controls autoPlay playsInline preload="metadata" poster={video.poster} onError={() => setFailed(true)} aria-label={video.title}><source src={video.src} type="video/mp4" /></video>
        ) : (
          <iframe src={video.src} title={video.title} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
        )}
      </div>
      <figcaption style={{ marginTop: 6 }}><strong>{video.title}</strong>{video.note && <span className="muted small"> · {video.note}</span>}</figcaption>
    </figure>
  );
}

/**
 * Formatação do texto dos passos (editado no admin, um passo por linha):
 *  - `## Título`  → começa um bloco com título (a numeração recomeça)
 *  - `**texto**`  → negrito (nomes de botões e menus)
 *  - `https://…`  → link clicável
 *  - `[[downloads:totem]]` / `[[downloads:painel]]` → bloco com as opções de download do app
 *  - `[[video:remover]]` / `[[video:instalar]]` / `[[video:ajustar]]` → vídeo de apoio (só no formato vídeo)
 * Tudo é renderizado como nós React (nunca HTML), então o conteúdo não injeta marcação.
 */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong>
        : /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p.replace(/^https?:\/\//, "")}</a>
        : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

export function toBlocks(lines: string[]): { heading?: string; items: string[] }[] {
  const blocks: { heading?: string; items: string[] }[] = [];
  for (const l of lines) {
    if (l.startsWith("## ")) blocks.push({ heading: l.slice(3).trim(), items: [] });
    else {
      if (blocks.length === 0) blocks.push({ items: [] });
      blocks[blocks.length - 1].items.push(l);
    }
  }
  return blocks.filter((b) => b.items.length > 0 || b.heading);
}

const VIDEO_TOKEN = /^\[\[video:([a-z]+)\]\]$/;
const DOWNLOAD_TOKEN = /^\[\[downloads:(totem|painel)\]\]$/;

export function StepContent({ step, format }: { step: PublicStep | undefined; format: "TEXTO" | "VIDEO" }) {
  if (!step) return <Alert tone="info">O conteúdo desta etapa ainda está sendo preparado pela equipe da Intelite.</Alert>;
  const hasInlineVideo = step.instructions.some((l) => {
    const m = VIDEO_TOKEN.exec(l);
    return !!m && isTutorialVideo(m[1]);
  });
  return (
    <div className="stack">
      {format === "VIDEO" && step.video && <Video video={step.video} />}
      {format === "VIDEO" && !step.video && !hasInlineVideo && <Alert tone="info">Esta etapa ainda não tem vídeo. Siga as instruções escritas.</Alert>}
      {toBlocks(step.instructions).map((b, bi) => (
        <div key={bi} className="stack">
          {b.heading && <h4 style={{ margin: 0 }}>{b.heading}</h4>}
          <ol className="steps">
            {b.items.map((t, i) => {
              const v = VIDEO_TOKEN.exec(t);
              if (v) {
                if (format !== "VIDEO" || !isTutorialVideo(v[1])) return null; // texto: sem vídeo
                const slug: TutorialVideo = v[1];
                return <li key={i} className="free"><Video video={{ kind: "file", src: videoSrc(slug), title: TUTORIAL_VIDEOS[slug].title, note: TUTORIAL_VIDEOS[slug].note, poster: videoPoster(slug) }} /></li>;
              }
              const dl = DOWNLOAD_TOKEN.exec(t);
              return dl
                ? <li key={i} className="free"><DownloadOptions app={dl[1] as "totem" | "painel"} /></li>
                : <li key={i}><div className="grow"><Inline text={t} /></div></li>;
            })}
          </ol>
        </div>
      ))}
      {step.warning && <Alert tone="warn" role="note"><strong>Atenção: </strong><Inline text={step.warning} /></Alert>}
      {step.imagePath && <img className="refimg" loading="lazy" src={`/api/assets/${step.imagePath}`} alt={`Imagem de referência: ${step.title}`} />}
    </div>
  );
}
