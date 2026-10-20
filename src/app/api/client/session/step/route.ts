import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { getClientState, goToStep } from "@/lib/services/session";

export const POST = route(async (req) => {
  const cu = await requireClient();
  const { stepKey } = z.object({ stepKey: z.string() }).parse(await readJson(req));
  await goToStep(cu.id, stepKey);
  return getClientState(cu.id);
});
