import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { badRequest, readJson, route } from "@/lib/http";
import { markAdjustmentDone } from "@/lib/services/session";
import { parseType } from "@/lib/params";

const schema = z.object({ procedureId: z.string().optional(), notes: z.string().max(1000).optional() });

export const POST = route<{ params: Promise<{ type: string }> }>(async (req, { params }) => {
  const cu = await requireClient();
  const type = parseType((await params).type);
  if (!type) throw badRequest("Tipo de equipamento inválido.");
  return markAdjustmentDone(cu.id, type, schema.parse(await readJson(req)));
});
