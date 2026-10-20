import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { getClientState, setFormat } from "@/lib/services/session";

export const POST = route(async (req) => {
  const cu = await requireClient();
  const { format } = z.object({ format: z.enum(["TEXTO", "VIDEO"]) }).parse(await readJson(req));
  await setFormat(cu.id, format);
  return getClientState(cu.id);
});
