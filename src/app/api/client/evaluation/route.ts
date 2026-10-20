import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { submitEvaluation } from "@/lib/services/session";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  hardestStepKey: z.string().optional(),
});

export const POST = route(async (req) => {
  const cu = await requireClient();
  return submitEvaluation(cu.id, schema.parse(await readJson(req)));
});
