import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { listAudit } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams;
  return listAudit({ entity: q.get("entity") ?? undefined, entityId: q.get("entityId") ?? undefined, take: Number(q.get("take") ?? 100) || 100 });
});
