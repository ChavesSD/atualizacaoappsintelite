"use client";
import { VideoPlayer, type VideoData } from "./VideoPlayer";

export interface Instruction { text: string; warning?: string; highlight?: string; imagePath?: string }
export interface RefImage { path: string; alt: string; caption?: string }
export interface StepPayload {
  content: { id: string; version: number; recommendedFormat: "TEXTO" | "VIDEO"; instructions: Instruction[]; referenceImages: RefImage[] } | null;
  video: VideoData | null;
}

const img = (p: string) => `/api/assets/${p}`;

/** Corpo de uma etapa nos dois formatos. Usado pelo tutorial e pela prévia no celular do admin. */
export function StepBody({ data, format }: { data: StepPayload; format: "TEXTO" | "VIDEO" }) {
  if (!data.content) {
    return <div className="alert info">O conteúdo desta etapa ainda está sendo preparado pela equipe da Intelite. Se precisar avançar, use “Preciso de ajuda”.</div>;
  }
  const showVideo = format === "VIDEO" && data.video;
  return (
    <div className="stack">
      {format === "VIDEO" && !data.video && (
        <div className="alert info">Esta etapa ainda não tem vídeo. Siga as instruções escritas abaixo.</div>
      )}
      {showVideo && <VideoPlayer video={data.video!} />}
      {showVideo && <h3>Resumo das instruções</h3>}
      <ol className="steps">
        {data.content.instructions.map((s, i) => (
          <li key={i}>
            <div className="grow stack">
              <div>
                {s.text}
                {s.highlight && <> <span className="hl">{s.highlight}</span></>}
              </div>
              {s.warning && <div className="alert warn small" role="note"><strong>Atenção: </strong>{s.warning}</div>}
              {s.imagePath && format === "TEXTO" && <img className="refimg" loading="lazy" src={img(s.imagePath)} alt={`Imagem de referência do passo ${i + 1}`} />}
            </div>
          </li>
        ))}
      </ol>
      {data.content.referenceImages.length > 0 && (
        <div>
          <h3>Imagens de referência</h3>
          {data.content.referenceImages.map((r) => (
            <figure key={r.path}>
              <img className="refimg" loading="lazy" src={img(r.path)} alt={r.alt} />
              {r.caption && <figcaption>{r.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
