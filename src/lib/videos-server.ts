import fs from "node:fs";
import path from "node:path";
import { isTutorialVideo, type GuideVideo } from "./videos";

const dir = () => path.join(process.cwd(), "downloads", "videos");
const TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", vtt: "text/vtt; charset=utf-8" };

/** Caminho em disco de um arquivo de vídeo; null se o nome não estiver na lista permitida (bloqueia path traversal). */
export function videoFilePath(file: string): { path: string; contentType: string } | null {
  const m = /^([a-z]+)\.(mp4|jpg|vtt)$/.exec(file);
  if (!m || !(isTutorialVideo(m[1]) || m[1] === "tutorial")) return null;
  return { path: path.join(dir(), file), contentType: TYPES[m[2]] };
}

const exists = (f: string) => fs.existsSync(path.join(dir(), f));

/**
 * Vídeo com capítulos e legenda, se já foi gravado (<nome>.mp4 + <nome>.json com título e capítulos).
 * "tutorial" é o vídeo de atualização; "ajustar" é o de ajuste da proporção da tela.
 */
export function guideVideo(name: "tutorial" | "ajustar" = "tutorial"): GuideVideo | null {
  if (!exists(`${name}.mp4`) || !exists(`${name}.json`)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir(), `${name}.json`), "utf8")) as { title?: string; durationSec?: number; chapters?: { title: string; start: number }[] };
    return {
      title: meta.title ?? (name === "ajustar" ? "Como ajustar a proporção da tela" : "Como atualizar o aplicativo"),
      src: `/api/videos/${name}.mp4`,
      poster: exists(`${name}.jpg`) ? `/api/videos/${name}.jpg` : null,
      captions: exists(`${name}.vtt`) ? `/api/videos/${name}.vtt` : null,
      durationSec: meta.durationSec ?? 0,
      chapters: (meta.chapters ?? []).filter((c) => typeof c.title === "string" && Number.isFinite(c.start)).sort((a, b) => a.start - b.start),
    };
  } catch {
    return null;
  }
}
