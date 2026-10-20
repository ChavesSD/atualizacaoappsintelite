import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { archiveProcedure } from "@/lib/services/content";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  await archiveProcedure(admin.id, (await params).id);
  return { ok: true };
});
