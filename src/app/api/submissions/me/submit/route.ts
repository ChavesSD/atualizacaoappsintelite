import { z } from "zod";
import { getSubmissionId } from "@/lib/auth";
import { readJson, route, unauthorized } from "@/lib/http";
import { submitFinal } from "@/lib/submissions";

const schema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional(), hardestStep: z.string().max(80).optional() });

export const POST = route(async (req) => {
  const id = await getSubmissionId();
  if (!id) throw unauthorized();
  return submitFinal(id, schema.parse(await readJson(req)));
});
