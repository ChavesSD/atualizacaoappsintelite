// Sobe um PostgreSQL local (binários reais via "embedded-postgres") para desenvolvimento.
// Uso: npm run db:local   (deixe rodando; em outro terminal: npm run db:push && npm run db:seed)
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const dir = process.env.LOCAL_DB_DIR ?? ".local-db";
const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: true });

if (!fs.existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("intelite");
} catch {
  /* já existe */
}
console.log(`PostgreSQL local pronto em postgresql://postgres:postgres@localhost:${port}/intelite`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
