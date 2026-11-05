import { DOWNLOAD_APPS, downloadFilePath, isDownloadApp } from "@/lib/downloads";
import { serveFile } from "@/lib/files";
import { notFound, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Download direto do APK. Aceita Range (retomar download interrompido) e força o nome/tipo corretos. */
export const GET = route<{ params: Promise<{ app: string }> }>(async (req, { params }) => {
  const app = (await params).app;
  if (!isDownloadApp(app)) throw notFound();
  const file = downloadFilePath(app);
  if (!file || !DOWNLOAD_APPS[app].filename) throw notFound(); // sem APK hospedado: só os links curtos
  return serveFile(req, file, {
    contentType: "application/vnd.android.package-archive",
    cache: "public, max-age=300",
    filename: DOWNLOAD_APPS[app].filename as string,
  });
});
