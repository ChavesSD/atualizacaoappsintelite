import { z } from "zod";
import { db } from "@/lib/db";
import { hashAccessCode, setClientSession } from "@/lib/auth";
import { clientIp, HttpError, rateLimit, readJson, resetRateLimit, route } from "@/lib/http";
import { getOrCreateSession } from "@/lib/services/session";

const schema = z.object({ code: z.string().trim().min(6).max(40) });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`access:${ip}`, 10, 10 * 60_000);
  const { code } = schema.parse(await readJson(req));
  const cu = await db.campaignUnit.findUnique({ where: { accessCodeHash: hashAccessCode(code) }, include: { unit: true } });
  if (!cu) throw new HttpError(404, "Código não encontrado. Confira o código recebido da Intelite.");
  resetRateLimit(`access:${ip}`);
  await getOrCreateSession(cu.id);
  await setClientSession(cu.id);
  return { ok: true, unit: cu.unit.name };
});
