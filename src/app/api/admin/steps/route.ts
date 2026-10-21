import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSteps } from "@/lib/content";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  if ((await db.step.count()) === 0) await ensureSteps();
  return db.step.findMany({ orderBy: { position: "asc" } });
});
