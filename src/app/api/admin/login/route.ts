import { z } from "zod";
import { db } from "@/lib/db";
import { setAdminSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp, HttpError, rateLimit, readJson, resetRateLimit, route } from "@/lib/http";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

// Hash fictício para igualar o tempo de resposta quando o e-mail não existe.
const DUMMY = "scrypt$00000000000000000000000000000000$" + "00".repeat(64);

export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`admin:${ip}`, 8, 10 * 60_000);
  const { email, password } = schema.parse(await readJson(req));
  const user = await db.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  const ok = verifyPassword(password, user?.passwordHash ?? DUMMY) && !!user?.active;
  if (!ok || !user) {
    await audit({ actorType: "SISTEMA", action: "LOGIN_ADMIN_FALHOU", entity: "AdminUser", after: { email: email.toLowerCase(), ip } });
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }
  resetRateLimit(`admin:${ip}`);
  await setAdminSession(user.id);
  await audit({ actorType: "ADMIN", actorId: user.id, action: "LOGIN_ADMIN", entity: "AdminUser", entityId: user.id });
  return { ok: true, name: user.name, role: user.role };
});
