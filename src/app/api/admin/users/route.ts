import { z } from "zod";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict, HttpError, readJson, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return db.adminUser.findMany({ orderBy: { email: "asc" }, select: { id: true, email: true, name: true, active: true } });
});

const create = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, "A senha precisa ter ao menos 10 caracteres.").max(200),
});

export const POST = route(async (req) => {
  await requireAdmin();
  const b = create.parse(await readJson(req));
  if (await db.adminUser.findUnique({ where: { email: b.email } })) throw conflict("Já existe um usuário com este e-mail.");
  const u = await db.adminUser.create({ data: { name: b.name, email: b.email, passwordHash: hashPassword(b.password) }, select: { id: true, email: true, name: true, active: true } });
  return u;
});

const patch = z.object({ id: z.string(), active: z.boolean() });

export const PATCH = route(async (req) => {
  const me = await requireAdmin();
  const { id, active } = patch.parse(await readJson(req));
  if (id === me.id && !active) throw new HttpError(400, "Você não pode desativar o seu próprio usuário.");
  if (!active && (await db.adminUser.count({ where: { active: true, id: { not: id } } })) === 0) throw new HttpError(400, "Mantenha ao menos um usuário ativo.");
  return db.adminUser.update({ where: { id }, data: { active }, select: { id: true, email: true, name: true, active: true } });
});
