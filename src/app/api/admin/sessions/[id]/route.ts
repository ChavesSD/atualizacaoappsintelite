import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { getSessionDetail } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  return getSessionDetail((await params).id);
});
