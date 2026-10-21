import fs from "node:fs";
import { Readable } from "node:stream";
import { notFound, route } from "@/lib/http";
import { DOWNLOAD_APPS, downloadFilePath, isDownloadApp, parseRange } from "@/lib/downloads";

export const dynamic = "force-dynamic";

/** Download direto do APK. Aceita Range (retomar download interrompido) e força o nome/tipo corretos. */
export const GET = route<{ params: Promise<{ app: string }> }>(async (req, { params }) => {
  const app = (await params).app;
  if (!isDownloadApp(app)) throw notFound();
  const file = downloadFilePath(app);
  let size: number;
  try {
    size = (await fs.promises.stat(file)).size;
  } catch {
    throw notFound("Arquivo indisponível no momento. Use um dos links de download.");
  }
  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });

  const { start, end } = range ?? { start: 0, end: size - 1 };
  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${DOWNLOAD_APPS[app].filename}"`,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as unknown as ReadableStream;
  return new Response(stream, { status: range ? 206 : 200, headers });
});
