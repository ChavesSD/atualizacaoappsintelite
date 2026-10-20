import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 5544;

/** Sobe um PostgreSQL real e descartável só para os testes de integração. */
export default async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intelite-pg-"));
  const pg = new EmbeddedPostgres({ databaseDir: path.join(dir, "data"), user: "postgres", password: "postgres", port: PORT, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("intelite_test");

  const url = `postgresql://postgres:postgres@localhost:${PORT}/intelite_test`;
  process.env.DATABASE_URL = url;
  process.env.SESSION_SECRET = "integration-test-secret-0123456789abcdef";
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_LOCAL_DIR = path.join(dir, "storage");
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: process.env, stdio: "pipe" });

  return async () => {
    await pg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
