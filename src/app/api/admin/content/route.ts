import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { contentInputSchema, createContentDraft } from "@/lib/services/content";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return db.tutorialStep.findMany({
    orderBy: { position: "asc" },
    include: { contents: { orderBy: { version: "desc" }, include: { video: true } } },
  });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  return createContentDraft(admin.id, contentInputSchema.parse(await readJson(req)));
});
