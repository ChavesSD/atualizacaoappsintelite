"use client";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import type { GuideVideo as Guide } from "@/lib/videos";
import { Alert, Icon } from "./ui";

export interface GuidePlayer { seek: (seconds: number) => void }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Vídeo principal do guia, com legendas e capítulos. Informa o capítulo atual (onChapter) conforme o vídeo avança, e
 * `seek()` leva o vídeo a um instante e começa a tocar: é assim que o texto e o vídeo andam juntos.
 * O arquivo só é baixado depois do toque em ▶ (economiza dados no celular).
 */
export const GuideVideo = forwardRef<GuidePlayer, { video: Guide; onChapter: (index: number) => void }>(function GuideVideo({ video, onChapter }, ref) {
  const el = useRef<HTMLVideoElement>(null);
  const pending = useRef<number | null>(null);
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0);

  const chapterAt = useCallback((t: number) => {
    let idx = 0;
    video.chapters.forEach((c, i) => { if (t >= c.start - 0.25) idx = i; });
    return idx;
  }, [video.chapters]);

  const update = useCallback((t: number) => {
    const idx = chapterAt(t);
    setCurrent((prev) => { if (prev !== idx) onChapter(idx); return idx; });
  }, [chapterAt, onChapter]);

  const seek = useCallback((seconds: number) => {
    const v = el.current;
    if (!v) { pending.current = seconds; setOn(true); return; } // ainda não carregou: começa já no capítulo
    v.currentTime = seconds;
    v.play().catch(() => { /* o navegador pode exigir o toque no player */ });
    update(seconds);
  }, [update]);
  useImperativeHandle(ref, () => ({ seek }), [seek]);

  if (failed) return <Alert tone="warn" role="alert">Não foi possível reproduzir o vídeo agora. Siga o passo a passo escrito ao lado.</Alert>;

  return (
    <figure>
      <div className="player">
        {!on ? (
          <button type="button" className="poster" style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined} onClick={() => setOn(true)} aria-label={`Reproduzir vídeo: ${video.title}`}>
            <span className="play" aria-hidden><Icon name="playSolid" /></span>
          </button>
        ) : (
          <video
            ref={(node) => {
              el.current = node;
              if (node && pending.current !== null) { const t = pending.current; pending.current = null; node.addEventListener("loadedmetadata", () => { node.currentTime = t; node.play().catch(() => {}); update(t); }, { once: true }); }
            }}
            controls autoPlay={pending.current === null} playsInline preload="metadata" poster={video.poster ?? undefined}
            onTimeUpdate={(e) => update(e.currentTarget.currentTime)} onSeeked={(e) => update(e.currentTarget.currentTime)} onError={() => setFailed(true)}
            aria-label={video.title}
          >
            <source src={video.src} type="video/mp4" />
            {video.captions && <track kind="captions" src={video.captions} srcLang="pt-BR" label="Português" default />}
          </video>
        )}
      </div>
      <figcaption className="player-cap">
        <span><strong>{video.title}</strong> · {mmss(video.durationSec)} · com narração e legendas</span>
      </figcaption>
      {video.chapters.length > 0 && (
        <ol className="chapters" aria-label="Capítulos do vídeo">
          {video.chapters.map((c, i) => (
            <li key={c.title}>
              <button type="button" aria-current={on && current === i ? "true" : undefined} onClick={() => seek(c.start)}>
                {c.title} <span className="time">{mmss(c.start)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
});
