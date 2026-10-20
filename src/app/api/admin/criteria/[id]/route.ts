import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";

const patch = z.object({
  label: z.string().trim().min(3).max(300).optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).max(999).optional(),
});

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  const id = (await params).id;
  const b = patch.parse(await readJson(req));
  const before = await db.framingCriterion.findUniqueOrThrow({ where: { id } });
  const after = await db.framingCriterion.update({ where: { id }, data: b });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "CRITERIO_ALTERADO", entity: "FramingCriterion", entityId: id, before: { label: before.label, required: before.required, active: before.active }, after: b });
  return after;
});
