import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { parseFilters } from "@/lib/params";
import { listSessions } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  return listSessions(parseFilters(req.url));
});
