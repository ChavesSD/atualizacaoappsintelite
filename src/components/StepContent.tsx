"use client";
import { Fragment, useState } from "react";
import { DownloadOptions } from "./DownloadOptions";

export interface PublicStep {
  key: string;
  title: string;
  instructions: string[];
  warning: string | null;
  imagePath: string | null;
  video: { kind: "embed" | "file"; src: string; title: string } | null;
}

/** Vídeo sob demanda: nada é baixado até o toque em ▶. Se falhar, o texto continua logo abaixo. */
export function Video({ video }: { video: NonNullable<PublicStep["video"]> }) {
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="alert warn" role="alert">Não foi possível reproduzir o vídeo agora. Siga as instruções escritas abaixo.</div>;
  return (
    <div className="video">
      {!on ? (
        <button type="button" className="poster" onClick={() => setOn(true)} aria-label={`Reproduzir vídeo: ${video.title}`}>
          <span className="play" aria-hidden>▶</span>
        </button>
      ) : video.kind === "file" ? (
        <video controls autoPlay playsInline preload="none" onError={() => setFailed(true)} aria-label={video.title}><source src={video.src} /></video>
      ) : (
        <iframe src={video.src} title={video.title} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
      )}
    </div>
  );
}

/**
 * Formatação do texto dos passos (editado no admin, um passo por linha):
 *  - `## Título`  → começa um bloco com título (a numeração recomeça)
 *  - `**texto**`  → negrito (nomes de botões e menus)
 *  - `https://…`  → link clicável
 *  - `[[downloads:totem]]` / `[[downloads:painel]]` → bloco com as opções de download do app
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

export function StepContent({ step, format }: { step: PublicStep | undefined; format: "TEXTO" | "VIDEO" }) {
  if (!step) return <div className="alert info">O conteúdo desta etapa ainda está sendo preparado pela equipe da Intelite.</div>;
  return (
    <div className="stack">
      {format === "VIDEO" && step.video && <Video video={step.video} />}
      {format === "VIDEO" && !step.video && <div className="alert info small">Esta etapa ainda não tem vídeo. Siga as instruções escritas.</div>}
      {toBlocks(step.instructions).map((b, bi) => (
        <div key={bi} className="stack">
          {b.heading && <h3 style={{ margin: 0 }}>{b.heading}</h3>}
          <ol className="steps">
            {b.items.map((t, i) => {
              const dl = /^\[\[downloads:(totem|painel)\]\]$/.exec(t);
              return dl
                ? <li key={i} className="free"><DownloadOptions app={dl[1] as "totem" | "painel"} /></li>
                : <li key={i}><div className="grow"><Inline text={t} /></div></li>;
            })}
          </ol>
        </div>
      ))}
      {step.warning && <div className="alert warn small" role="note"><strong>Atenção: </strong><Inline text={step.warning} /></div>}
      {step.imagePath && <img className="refimg" loading="lazy" src={`/api/assets/${step.imagePath}`} alt={`Imagem de referência: ${step.title}`} />}
    </div>
  );
}
