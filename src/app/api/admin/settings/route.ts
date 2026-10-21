import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { SETTING_HOSTS, videoHosts } from "@/lib/content";
import { db } from "@/lib/db";
import { badRequest, readJson, route } from "@/lib/http";
import { parseHosts } from "@/lib/video";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return { videoHosts: (await videoHosts()).join("\n") };
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const { videoHosts: raw } = z.object({ videoHosts: z.string().max(2000) }).parse(await readJson(req));
  const hosts = parseHosts(raw);
  if (raw.trim() && hosts.length === 0) throw badRequest("Informe domínios válidos, um por linha (ex.: videos.intelite.com.br).");
  await db.setting.upsert({ where: { key: SETTING_HOSTS }, update: { value: hosts.join("\n") }, create: { key: SETTING_HOSTS, value: hosts.join("\n") } });
  return { videoHosts: hosts.join("\n") };
});
