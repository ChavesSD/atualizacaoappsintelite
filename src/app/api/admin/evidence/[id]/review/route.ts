import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { reviewEvidence } from "@/lib/services/admin";

const schema = z.object({ decision: z.enum(["ACEITA", "NOVA_FOTO_SOLICITADA"]), reason: z.string().max(1000).optional() });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  const b = schema.parse(await readJson(req));
  await reviewEvidence(admin.id, (await params).id, b.decision, b.reason);
  return { ok: true };
});
