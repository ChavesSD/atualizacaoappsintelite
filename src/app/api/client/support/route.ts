import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { requestSupport } from "@/lib/services/session";

const schema = z.object({
  stepKey: z.string(),
  type: z.enum(["TOTEM", "PAINEL"]).optional(),
  message: z.string().max(1000).optional(),
});

export const POST = route(async (req) => {
  const cu = await requireClient();
  return requestSupport(cu.id, schema.parse(await readJson(req)));
});
