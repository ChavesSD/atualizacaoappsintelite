"use client";
import { useState } from "react";

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

export function StepContent({ step, format }: { step: PublicStep | undefined; format: "TEXTO" | "VIDEO" }) {
  if (!step) return <div className="alert info">O conteúdo desta etapa ainda está sendo preparado pela equipe da Intelite.</div>;
  return (
    <div className="stack">
      {format === "VIDEO" && step.video && <Video video={step.video} />}
      {format === "VIDEO" && !step.video && <div className="alert info small">Esta etapa ainda não tem vídeo. Siga as instruções escritas.</div>}
      <ol className="steps">
        {step.instructions.map((t, i) => <li key={i}><div className="grow">{t}</div></li>)}
      </ol>
      {step.warning && <div className="alert warn small" role="note"><strong>Atenção: </strong>{step.warning}</div>}
      {step.imagePath && <img className="refimg" loading="lazy" src={`/api/assets/${step.imagePath}`} alt={`Imagem de referência: ${step.title}`} />}
    </div>
  );
}
