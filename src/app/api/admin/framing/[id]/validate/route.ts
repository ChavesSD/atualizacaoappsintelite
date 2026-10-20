import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { validateFraming } from "@/lib/services/admin";

const schema = z.object({ decision: z.enum(["VALIDADO", "REJEITADO"]), notes: z.string().max(1000).optional() });

/** Validação técnica: somente equipe (ADMIN/TECNICO). Nunca acionada por ações do cliente. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  const b = schema.parse(await readJson(req));
  await validateFraming(admin.id, (await params).id, b.decision, b.notes);
  return { ok: true };
});
