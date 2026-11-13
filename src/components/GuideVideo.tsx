"use client";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import type { GuideVideo as Guide } from "@/lib/videos";
import { Alert, Icon } from "./ui";

/** `seek(segundos, tocar)`: leva o vídeo a um instante. Com `tocar = false` só posiciona (o passo escolhido no texto não dispara o som). */
export interface GuidePlayer { seek: (seconds: number, play?: boolean) => void }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Vídeo principal do guia, com legendas e capítulos. Informa o capítulo atual (onChapter) conforme o vídeo avança, e
 * `seek()` leva o vídeo a um instante: é assim que o texto e o vídeo andam juntos. `active` é o passo mostrado ao lado
 * (vindo do vídeo ou escolhido no texto) e destaca o capítulo correspondente.
 * O arquivo só é baixado depois do toque em ▶ (economiza dados no celular).
 */
export const GuideVideo = forwardRef<GuidePlayer, { video: Guide; active: number; onChapter: (index: number) => void }>(function GuideVideo({ video, active, onChapter }, ref) {
  const el = useRef<HTMLVideoElement>(null);
  const pending = useRef<number | null>(null);
  const last = useRef(-1);
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);

  const chapterAt = useCallback((t: number) => {
    let idx = 0;
    video.chapters.forEach((c, i) => { if (t >= c.start - 0.25) idx = i; });
    return idx;
  }, [video.chapters]);

  const update = useCallback((t: number) => {
    const idx = chapterAt(t);
    if (idx !== last.current) { last.current = idx; onChapter(idx); }
  }, [chapterAt, onChapter]);

  const seek = useCallback((seconds: number, play = true) => {
    const v = el.current;
    last.current = chapterAt(seconds); // o texto já mostra esse passo: não precisa avisar de volta
    if (!v) { pending.current = seconds; if (play) setOn(true); return; } // ainda não carregou: começa já no capítulo
    v.currentTime = seconds;
    if (play) v.play().catch(() => { /* o navegador pode exigir o toque no player */ });
  }, [chapterAt]);
  useImperativeHandle(ref, () => ({ seek }), [seek]);

  const setNode = useCallback((node: HTMLVideoElement | null) => {
    el.current = node;
    if (node && pending.current !== null) {
      const t = pending.current; pending.current = null;
      node.addEventListener("loadedmetadata", () => { node.currentTime = t; node.play().catch(() => {}); }, { once: true });
    }
  }, []);

  if (failed) return <Alert tone="warn" role="alert">Não foi possível reproduzir o vídeo agora. Siga o passo a passo escrito ao lado.</Alert>;

  return (
    <figure className="vfig">
      <div className="player">
        {!on ? (
          <button type="button" className="poster" style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined} onClick={() => setOn(true)} aria-label={`Reproduzir vídeo: ${video.title}`}>
            <span className="play" aria-hidden><Icon name="playSolid" /></span>
          </button>
        ) : (
          <video
            ref={setNode}
            controls autoPlay playsInline preload="metadata" poster={video.poster ?? undefined}
            onTimeUpdate={(e) => update(e.currentTarget.currentTime)} onSeeked={(e) => update(e.currentTarget.currentTime)} onError={() => setFailed(true)}
            aria-label={video.title}
          >
            <source src={video.src} type="video/mp4" />
            {video.captions && <track kind="captions" src={video.captions} srcLang="pt-BR" label="Português" default />}
          </video>
        )}
      </div>
      {video.chapters.length > 0 && (
        <ol className="chapters" aria-label="Capítulos do vídeo (escolha o passo)">
          {video.chapters.map((c, i) => (
            <li key={c.title}>
              <button type="button" aria-current={active === i ? "step" : undefined} onClick={() => { seek(c.start, true); onChapter(i); }}>
                <span className="n">{i + 1}</span>{c.title} <span className="time">{mmss(c.start)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
});
