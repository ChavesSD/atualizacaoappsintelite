import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const create = z.object({
  type: z.enum(["TOTEM", "PAINEL"]),
  modelId: z.string().nullable().optional(),
  label: z.string().trim().min(3).max(300),
  required: z.boolean().default(true),
  position: z.number().int().min(0).max(999).default(0),
});

export const GET = route(async () => {
  await requireAdmin();
  return db.framingCriterion.findMany({ orderBy: [{ type: "asc" }, { position: "asc" }], include: { model: { select: { name: true } } } });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  const b = create.parse(await readJson(req));
  const c = await db.framingCriterion.create({ data: { ...b, modelId: b.modelId ?? null } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "CRITERIO_CRIADO", entity: "FramingCriterion", entityId: c.id, after: { label: c.label, type: c.type } });
  return c;
});
