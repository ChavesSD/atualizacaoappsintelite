import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { regenerateAccessCode } from "@/lib/services/admin";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const admin = await requireAdmin("ADMIN");
  return regenerateAccessCode(admin.id, (await params).id);
});
