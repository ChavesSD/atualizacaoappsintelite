import { DOWNLOAD_APPS, downloadFilePath, isDownloadApp } from "@/lib/downloads";
import { serveFile } from "@/lib/files";
import { notFound, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Download direto do APK. Aceita Range (retomar download interrompido) e força o nome/tipo corretos. */
export const GET = route<{ params: Promise<{ app: string }> }>(async (req, { params }) => {
  const app = (await params).app;
  if (!isDownloadApp(app)) throw notFound();
  return serveFile(req, downloadFilePath(app), {
    contentType: "application/vnd.android.package-archive",
    cache: "public, max-age=300",
    filename: DOWNLOAD_APPS[app].filename,
  });
});
