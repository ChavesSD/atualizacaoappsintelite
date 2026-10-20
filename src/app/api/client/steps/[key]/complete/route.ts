import { requireClient } from "@/lib/auth";
import { route } from "@/lib/http";
import { completeStep } from "@/lib/services/session";

export const POST = route<{ params: Promise<{ key: string }> }>(async (_req, { params }) => {
  const cu = await requireClient();
  return completeStep(cu.id, (await params).key);
});
