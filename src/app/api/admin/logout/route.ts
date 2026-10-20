import { clearSessions } from "@/lib/auth";
import { route } from "@/lib/http";

export const POST = route(async () => {
  await clearSessions();
  return { ok: true };
});
