import { PrismaClient } from "@prisma/client";
import { ensureSteps } from "../src/lib/content";
import { hashPassword } from "../src/lib/crypto";

const db = new PrismaClient();

async function main() {
  await ensureSteps();
  const email = (process.env.ADMIN_EMAIL ?? "admin@intelite.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "trocar-esta-senha-123";
  if (!(await db.adminUser.findUnique({ where: { email } }))) {
    await db.adminUser.create({ data: { email, name: "Administrador", passwordHash: hashPassword(password) } });
    console.log(`Admin criado: ${email} / ${process.env.ADMIN_PASSWORD ? "(senha de ADMIN_PASSWORD)" : password} — troque em produção.`);
  }
}
main().finally(() => db.$disconnect());
