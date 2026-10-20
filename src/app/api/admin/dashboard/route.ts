import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { parseFilters } from "@/lib/params";
import { loadDashboard } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  return loadDashboard(parseFilters(req.url));
});
