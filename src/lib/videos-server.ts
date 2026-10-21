import path from "node:path";
import { isTutorialVideo } from "./videos";

/** Caminho em disco de `<slug>.mp4` ou `<slug>.jpg`; null se o nome não estiver na lista permitida (bloqueia path traversal). */
export function videoFilePath(file: string): { path: string; contentType: string } | null {
  const m = /^([a-z]+)\.(mp4|jpg)$/.exec(file);
  if (!m || !isTutorialVideo(m[1])) return null;
  return { path: path.join(process.cwd(), "downloads", "videos", file), contentType: m[2] === "mp4" ? "video/mp4" : "image/jpeg" };
}
