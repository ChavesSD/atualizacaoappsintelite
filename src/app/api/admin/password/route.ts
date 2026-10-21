import { z } from "zod";
import { requireAdmin, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";

const schema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(10, "A nova senha precisa ter ao menos 10 caracteres.").max(200),
});

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { current, next } = schema.parse(await readJson(req));
  if (!verifyPassword(current, admin.passwordHash)) throw new HttpError(400, "A senha atual não confere.");
  if (current === next) throw new HttpError(400, "Escolha uma senha diferente da atual.");
  await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: hashPassword(next) } });
  return { ok: true };
});
