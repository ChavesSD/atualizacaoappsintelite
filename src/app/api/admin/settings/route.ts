import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { SETTING_HOSTS, getDownloadLinks, setDownloadLinks, videoHosts } from "@/lib/content";
import { db } from "@/lib/db";
import { badRequest, readJson, route } from "@/lib/http";
import { parseHosts } from "@/lib/video";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return { videoHosts: (await videoHosts()).join("\n"), downloadLinks: await getDownloadLinks() };
});

const schema = z.object({
  videoHosts: z.string().max(2000).optional(),
  downloadLinks: z.object({ totem: z.array(z.string().max(500)).max(10), painel: z.array(z.string().max(500)).max(10) }).optional(),
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const b = schema.parse(await readJson(req));
  if (b.videoHosts !== undefined) {
    const hosts = parseHosts(b.videoHosts);
    if (b.videoHosts.trim() && hosts.length === 0) throw badRequest("Informe domínios válidos, um por linha (ex.: videos.intelite.com.br).");
    await db.setting.upsert({ where: { key: SETTING_HOSTS }, update: { value: hosts.join("\n") }, create: { key: SETTING_HOSTS, value: hosts.join("\n") } });
  }
  if (b.downloadLinks) {
    try {
      await setDownloadLinks(b.downloadLinks);
    } catch (e) {
      throw badRequest((e as Error).message);
    }
  }
  return { videoHosts: (await videoHosts()).join("\n"), downloadLinks: await getDownloadLinks() };
});
