import fs from "node:fs";
import { Readable } from "node:stream";
import { parseRange } from "./downloads";
import { notFound } from "./http";

/**
 * Serve um arquivo do disco em streaming, com suporte a Range (retomar download / avançar no vídeo).
 * O chamador é responsável por validar o nome do arquivo (lista permitida) antes de chamar.
 */
export async function serveFile(req: Request, file: string, opts: { contentType: string; cache: string; filename?: string }): Promise<Response> {
  let size: number;
  try {
    size = (await fs.promises.stat(file)).size;
  } catch {
    throw notFound("Arquivo indisponível no momento.");
  }
  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });

  const { start, end } = range ?? { start: 0, end: size - 1 };
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control": opts.cache,
    "X-Content-Type-Options": "nosniff",
  };
  if (opts.filename) headers["Content-Disposition"] = `attachment; filename="${opts.filename}"`;
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as unknown as ReadableStream;
  return new Response(stream, { status: range ? 206 : 200, headers });
}
