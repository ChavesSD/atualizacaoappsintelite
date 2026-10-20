import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { addUnitToCampaign } from "@/lib/services/admin";

const schema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(200),
  city: z.string().trim().max(120).optional(),
  totemModelId: z.string().optional(),
  painelModelId: z.string().optional(),
});

/** O código de acesso aparece somente nesta resposta. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireAdmin("ADMIN");
  return addUnitToCampaign(admin.id, (await params).id, schema.parse(await readJson(req)));
});
