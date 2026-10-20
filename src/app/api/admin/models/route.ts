import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return db.equipmentModel.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  const b = z.object({ name: z.string().trim().min(2).max(120), type: z.enum(["TOTEM", "PAINEL"]) }).parse(await readJson(req));
  const m = await db.equipmentModel.create({ data: b });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "MODELO_CRIADO", entity: "EquipmentModel", entityId: m.id, after: b });
  return m;
});
