import { APP, appFilePath } from "@/lib/downloads";
import { serveFile } from "@/lib/files";
import { notFound, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Download direto do APK. Aceita Range (retomar download interrompido) e força o nome/tipo corretos. */
export const GET = route(async (req) => {
  const file = appFilePath();
  if (!file || !APP.filename) throw notFound(); // sem APK hospedado: só os links curtos
  return serveFile(req, file, {
    contentType: "application/vnd.android.package-archive",
    cache: "public, max-age=300",
    filename: APP.filename,
  });
});
