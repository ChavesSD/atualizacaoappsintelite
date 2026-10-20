import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const a = await requireAdmin();
  return { id: a.id, name: a.name, role: a.role, canWrite: a.role === "ADMIN" || a.role === "TECNICO", isAdmin: a.role === "ADMIN" };
});
