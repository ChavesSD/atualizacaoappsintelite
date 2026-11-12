import fs from "node:fs";
import path from "node:path";
import { isTutorialVideo, type GuideVideo } from "./videos";

const dir = () => path.join(process.cwd(), "downloads", "videos");
const TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", vtt: "text/vtt; charset=utf-8", json: "application/json; charset=utf-8" };

/** Caminho em disco de um arquivo de vídeo; null se o nome não estiver na lista permitida (bloqueia path traversal). */
export function videoFilePath(file: string): { path: string; contentType: string } | null {
  if (file === "tutorial.mouth.json") return { path: path.join(dir(), file), contentType: TYPES.json }; // linha do tempo da boca da Milly
  const m = /^([a-z]+)\.(mp4|jpg|vtt)$/.exec(file);
  if (!m || !(isTutorialVideo(m[1]) || m[1] === "tutorial")) return null;
  return { path: path.join(dir(), file), contentType: TYPES[m[2]] };
}

const exists = (f: string) => fs.existsSync(path.join(dir(), f));

/** Vídeo principal do guia, se já foi gravado (tutorial.mp4 + tutorial.json com título e capítulos). */
export function guideVideo(): GuideVideo | null {
  if (!exists("tutorial.mp4") || !exists("tutorial.json")) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir(), "tutorial.json"), "utf8")) as { title?: string; durationSec?: number; chapters?: { title: string; start: number }[] };
    return {
      title: meta.title ?? "Como atualizar o aplicativo",
      src: "/api/videos/tutorial.mp4",
      poster: exists("tutorial.jpg") ? "/api/videos/tutorial.jpg" : null,
      captions: exists("tutorial.vtt") ? "/api/videos/tutorial.vtt" : null,
      mouth: exists("tutorial.mouth.json") ? "/api/videos/tutorial.mouth.json" : null,
      durationSec: meta.durationSec ?? 0,
      chapters: (meta.chapters ?? []).filter((c) => typeof c.title === "string" && Number.isFinite(c.start)).sort((a, b) => a.start - b.start),
    };
  } catch {
    return null;
  }
}
