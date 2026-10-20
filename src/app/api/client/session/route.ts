import { requireClient } from "@/lib/auth";
import { route } from "@/lib/http";
import { getClientState } from "@/lib/services/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const cu = await requireClient();
  return getClientState(cu.id);
});
