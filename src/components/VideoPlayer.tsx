"use client";
import { useState } from "react";

export interface VideoData {
  title: string;
  description: string | null;
  url: string;
  direct: boolean;
  thumbnailUrl: string | null;
  captionsUrl: string | null;
  transcript: string | null;
}

/**
 * Carregamento sob demanda: nada do vídeo é baixado até o usuário tocar em reproduzir
 * (preload="none" + miniatura). Em falha, o tutorial escrito continua disponível.
 */
export function VideoPlayer({ video, onFail }: { video: VideoData; onFail?: () => void }) {
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="alert warn" role="alert">
        Não foi possível reproduzir o vídeo agora. Use as instruções escritas abaixo: elas trazem o mesmo procedimento.
      </div>
    );
  }
  const fail = () => {
    setFailed(true);
    onFail?.();
  };
  return (
    <div className="stack">
      <div className="video">
        {!started ? (
          <button
            type="button"
            className="poster"
            style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : undefined}
            onClick={() => setStarted(true)}
            aria-label={`Reproduzir vídeo: ${video.title}`}
          >
            <span className="play" aria-hidden>▶</span>
          </button>
        ) : video.direct ? (
          <video controls autoPlay playsInline preload="none" poster={video.thumbnailUrl ?? undefined} onError={fail} aria-label={video.title}>
            <source src={video.url} />
            {video.captionsUrl && <track kind="captions" src={video.captionsUrl} srcLang="pt-BR" label="Português" default />}
          </video>
        ) : (
          <iframe
            src={video.url}
            title={video.title}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        )}
      </div>
      <strong>{video.title}</strong>
      {video.description && <p className="muted small">{video.description}</p>}
      {video.transcript && (
        <details>
          <summary>Ler a transcrição do vídeo</summary>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}>{video.transcript}</p>
        </details>
      )}
    </div>
  );
}
