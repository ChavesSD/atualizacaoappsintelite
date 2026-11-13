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
  if (failed) return <Alert tone="warn" role="alert">Não foi possível reproduzir o vídeo agora. Siga as instruções escritas.</Alert>;
  return (
    <figure>
      <div className="player">
        {!on ? (
          <button type="button" className="poster" style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined} onClick={() => setOn(true)} aria-label={`Reproduzir vídeo: ${video.title}`}>
            <span className="play" aria-hidden><Icon name="playSolid" /></span>
          </button>
        ) : video.kind === "file" ? (
          <video controls autoPlay playsInline preload="metadata" poster={video.poster} onError={() => setFailed(true)} aria-label={video.title}><source src={video.src} type="video/mp4" /></video>
        ) : (
          <iframe src={video.src} title={video.title} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
        )}
      </div>
      <figcaption><strong>{video.title}</strong>{video.note && <span> · {video.note}</span>}</figcaption>
    </figure>
  );
}

/**
 * Formatação do texto dos passos (editado no admin, um passo por linha):
 *  - `## Título`  → começa um bloco com título (a numeração recomeça; na etapa "Atualizar" cada bloco é um capítulo do vídeo)
 *  - `**texto**`  → negrito (nomes de botões e menus)
 *  - `https://…`  → link clicável
 *  - `[[downloads]]` → bloco com as opções de download do aplicativo
 *  - `[[video:ajustar]]` → vídeo de apoio de ajuste da tela
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
const DOWNLOAD_TOKEN = /^\[\[downloads(?::[a-z]+)?\]\]$/; // aceita o formato antigo ([[downloads:totem]]): o app é o mesmo

/** Linhas numeradas de um bloco, com os itens especiais (vídeo de apoio e opções de download). */
export function Lines({ items, className = "lines", active }: { items: string[]; className?: "lines" | "steps"; active?: number[] }) {
  return (
    <ol className={className}>
      {items.map((t, i) => {
        const v = VIDEO_TOKEN.exec(t);
        if (v) {
          if (!isTutorialVideo(v[1])) return null;
          const slug: TutorialVideo = v[1];
          return <li key={i} className="free"><Video video={{ kind: "file", src: videoSrc(slug), title: TUTORIAL_VIDEOS[slug].title, note: TUTORIAL_VIDEOS[slug].note, poster: videoPoster(slug) }} /></li>;
        }
        return DOWNLOAD_TOKEN.test(t)
          ? <li key={i} className="free"><DownloadOptions /></li>
          : <li key={i} className={active?.includes(i) ? "on" : undefined}><div className="grow"><Inline text={t} /></div></li>;
      })}
    </ol>
  );
}

/** Conteúdo genérico de uma etapa: blocos com título opcional, aviso e imagem de referência. */
export function StepContent({ step }: { step: PublicStep | undefined }) {
  if (!step) return <Alert tone="info">O conteúdo desta etapa ainda está sendo preparado pela equipe da Intelite.</Alert>;
  return (
    <div className="stack">
      {toBlocks(step.instructions).map((b, bi) => (
        <div key={bi} className="stack">
          {b.heading && <h2 style={{ margin: 0, fontSize: "var(--fs-2)" }}>{b.heading}</h2>}
          <Lines items={b.items} className="steps" />
        </div>
      ))}
      {step.warning && <Alert tone="warn" role="note"><strong>Atenção: </strong><Inline text={step.warning} /></Alert>}
      {step.imagePath && <img className="refimg" loading="lazy" src={`/api/assets/${step.imagePath}`} alt={`Imagem de referência: ${step.title}`} />}
    </div>
  );
}
