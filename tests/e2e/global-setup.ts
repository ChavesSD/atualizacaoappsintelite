import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PG_PORT = 5546;
const APP_PORT = 3200;

/** Sobe Postgres descartável + seed + app em modo produção (requer `npm run build` prévio). */
export default async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intelite-e2e-"));
  const pg = new EmbeddedPostgres({ databaseDir: path.join(dir, "data"), user: "postgres", password: "postgres", port: PG_PORT, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("intelite_e2e");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/intelite_e2e`,
    SESSION_SECRET: "e2e-secret-0123456789abcdef0123456789",
    STORAGE_DRIVER: "db", // caminho de produção no Render
    STORAGE_LOCAL_DIR: path.join(dir, "storage"),
    ADMIN_EMAIL: "admin@intelite.local",
    ADMIN_PASSWORD: "senha-e2e-123456",
  };
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env, stdio: "pipe" });
  execSync("npx tsx --env-file=.env prisma/seed.ts", { env, stdio: "pipe" });

  const app: ChildProcess = spawn("npx", ["next", "start", "-p", String(APP_PORT)], { env, shell: true, stdio: "pipe" });
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(`http://localhost:${APP_PORT}/`)).ok) break;
    } catch { /* ainda subindo */ }
    if (Date.now() > deadline) throw new Error("O app não subiu a tempo (rode `npm run build` antes).");
    await new Promise((r) => setTimeout(r, 500));
  }

  return async () => {
    if (process.platform === "win32" && app.pid) {
      try { execSync(`taskkill /pid ${app.pid} /T /F`, { stdio: "ignore" }); } catch { /* já encerrado */ }
    } else app.kill();
    await pg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
