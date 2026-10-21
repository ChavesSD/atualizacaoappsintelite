import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { videoHosts } from "@/lib/content";
import { db } from "@/lib/db";
import { badRequest, readJson, route } from "@/lib/http";
import { resolveVideo } from "@/lib/video";

const schema = z.object({
  title: z.string().trim().min(2).max(200),
  instructions: z.string().trim().min(1).max(8000), // um passo por linha
  warning: z.string().trim().max(500).nullish(),
  imagePath: z.string().trim().max(200).nullish(),
  videoUrl: z.string().trim().max(1000).nullish(),
  videoTitle: z.string().trim().max(200).nullish(),
  active: z.boolean().default(true),
});

export const PUT = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireAdmin();
  const b = schema.parse(await readJson(req));
  if (b.videoUrl) {
    const v = resolveVideo(b.videoUrl, await videoHosts());
    if (!v.ok) throw badRequest(`Vídeo: ${v.reason}`);
  }
  return db.step.update({
    where: { id: (await params).id },
    data: { title: b.title, instructions: b.instructions, warning: b.warning || null, imagePath: b.imagePath || null, videoUrl: b.videoUrl || null, videoTitle: b.videoTitle || null, active: b.active },
  });
});
