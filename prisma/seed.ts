import { PrismaClient } from "@prisma/client";
import { ensureSteps } from "../src/lib/content";
import { hashPassword } from "../src/lib/crypto";

const db = new PrismaClient();

async function main() {
  await ensureSteps();
  const email = (process.env.ADMIN_EMAIL ?? "admin@intelite.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "trocar-esta-senha-123";
  const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
  const hasAdmin = (await db.adminUser.count()) > 0;
  if (!hasAdmin && !process.env.ADMIN_PASSWORD && !isLocalDb) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD antes do primeiro deploy: não crio o administrador com a senha padrão em um banco que não é local.");
  }
  if (!(await db.adminUser.findUnique({ where: { email } }))) {
    await db.adminUser.create({ data: { email, name: "Administrador", passwordHash: hashPassword(password) } });
    console.log(`Admin criado: ${email} / ${process.env.ADMIN_PASSWORD ? "(senha de ADMIN_PASSWORD)" : password} — troque em produção.`);
  }
}
main().finally(() => db.$disconnect());
