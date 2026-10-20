import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { createProcedureDraft, procedureInputSchema } from "@/lib/services/content";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return db.correctionProcedure.findMany({
    orderBy: [{ key: "asc" }, { version: "desc" }],
    include: { approvedBy: { select: { name: true } }, model: { select: { name: true } } },
  });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  return createProcedureDraft(admin.id, procedureInputSchema.parse(await readJson(req)));
});
