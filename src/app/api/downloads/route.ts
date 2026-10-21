import fs from "node:fs";
import { getDownloadLinks } from "@/lib/content";
import { DOWNLOAD_APPS, downloadFilePath, type DownloadApp } from "@/lib/downloads";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Opções de download exibidas ao cliente: links alternativos + download direto (se o arquivo existir). */
export const GET = route(async () => {
  const links = await getDownloadLinks();
  const out = [];
  for (const app of Object.keys(DOWNLOAD_APPS) as DownloadApp[]) {
    let sizeBytes: number | null = null;
    try {
      sizeBytes = (await fs.promises.stat(downloadFilePath(app))).size;
    } catch { /* sem arquivo: só links */ }
    out.push({
      app,
      label: DOWNLOAD_APPS[app].label,
      version: DOWNLOAD_APPS[app].version,
      links: links[app],
      direct: sizeBytes ? `/api/download/${app}` : null,
      sizeBytes,
    });
  }
  return out;
});
