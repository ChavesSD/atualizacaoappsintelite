import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { addAllowedHost, setAllowedHostActive } from "@/lib/services/content";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return db.allowedVideoHost.findMany({ orderBy: { hostname: "asc" } });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin("ADMIN");
  const { hostname } = z.object({ hostname: z.string().max(253) }).parse(await readJson(req));
  return addAllowedHost(admin.id, hostname);
});

export const PATCH = route(async (req) => {
  const admin = await requireAdmin("ADMIN");
  const b = z.object({ id: z.string(), active: z.boolean() }).parse(await readJson(req));
  return setAllowedHostActive(admin.id, b.id, b.active);
});
