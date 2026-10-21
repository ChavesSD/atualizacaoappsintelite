import { serveFile } from "@/lib/files";
import { notFound, route } from "@/lib/http";
import { videoFilePath } from "@/lib/videos-server";

export const dynamic = "force-dynamic";

/** Vídeos e miniaturas do tutorial. Somente nomes da lista permitida; aceita Range para reproduzir/avançar no celular. */
export const GET = route<{ params: Promise<{ file: string }> }>(async (req, { params }) => {
  const f = videoFilePath((await params).file);
  if (!f) throw notFound();
  return serveFile(req, f.path, { contentType: f.contentType, cache: "public, max-age=86400" });
});
