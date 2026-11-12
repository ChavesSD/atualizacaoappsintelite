import fs from "node:fs";
import { getAppLinks } from "@/lib/content";
import { APP, appFilePath } from "@/lib/downloads";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Opções de download exibidas ao cliente: links alternativos + download direto (se o arquivo existir). */
export const GET = route(async () => {
  let sizeBytes: number | null = null;
  const file = appFilePath();
  if (file) {
    try {
      sizeBytes = (await fs.promises.stat(file)).size;
    } catch { /* sem arquivo: só links */ }
  }
  return {
    label: APP.label,
    version: APP.version,
    links: await getAppLinks(),
    direct: sizeBytes ? "/api/download" : null,
    sizeBytes,
  };
});
