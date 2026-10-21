// Um comando para tudo: `npm run dev`
// Sobe um PostgreSQL local (persistente em .local-db), cria as tabelas, cadastra o conteúdo inicial e abre o app.
// Para usar um banco externo, defina DATABASE_URL e rode `npm run dev:next`.
import EmbeddedPostgres from "embedded-postgres";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";

const DIR = ".local-db";
const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const URL = `postgresql://postgres:postgres@localhost:${PORT}/intelite`;

if (!fs.existsSync(".env")) {
  const example = fs.readFileSync(".env.example", "utf8").replace(/SESSION_SECRET=.*/, `SESSION_SECRET="${crypto.randomBytes(32).toString("hex")}"`);
  fs.writeFileSync(".env", example);
  console.log("• Arquivo .env criado.");
}

const listening = () => new Promise((res) => {
  const c = net.connect({ port: PORT, host: "127.0.0.1" });
  c.once("connect", () => { c.destroy(); res(true); });
  c.once("error", () => res(false));
});

// Se já há um banco ligado na porta (outro terminal), reaproveita em vez de falhar.
let pg = null;
if (await listening()) {
  console.log(`• Reaproveitando o banco que já está rodando em localhost:${PORT}`);
} else {
  fs.rmSync(`${DIR}/postmaster.pid`, { force: true }); // sobra de um encerramento abrupto
  pg = new EmbeddedPostgres({ databaseDir: DIR, user: "postgres", password: "postgres", port: PORT, persistent: true });
  if (!fs.existsSync(`${DIR}/PG_VERSION`)) await pg.initialise();
  await pg.start();
  try { await pg.createDatabase("intelite"); } catch { /* já existe */ }
  console.log(`• Banco pronto em localhost:${PORT}`);
}

const env = { ...process.env, DATABASE_URL: URL };
const run = (args) => spawnSync("npx", args, { env, stdio: "inherit", shell: true }).status === 0;
if (!run(["prisma", "db", "push", "--skip-generate", "--accept-data-loss"]) || !run(["tsx", "--env-file=.env", "prisma/seed.ts"])) {
  await pg?.stop();
  process.exit(1);
}

const APP_PORT = process.env.PORT ?? "3000";
const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
console.log(`• Neste computador: http://localhost:${APP_PORT}`);
for (const ip of lan) console.log(`• Outros computadores da rede: http://${ip}:${APP_PORT}   (libere a porta no firewall; veja o README)`);
// -H 0.0.0.0: escuta em todas as interfaces, não só em localhost.
const app = spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", APP_PORT], { env: { ...env, COOKIE_SECURE: "false" }, stdio: "inherit", shell: true });
const stop = async () => {
  if (process.platform === "win32" && app.pid) spawnSync("taskkill", ["/pid", String(app.pid), "/T", "/F"], { stdio: "ignore" });
  else app.kill();
  await pg?.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", stop);
