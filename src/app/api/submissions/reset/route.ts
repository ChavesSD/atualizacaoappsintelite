import { clearSubmissionCookie } from "@/lib/auth";
import { route } from "@/lib/http";

/** Encerra a sessão neste aparelho para o cliente começar outro envio (ex.: outra loja). Nada é apagado. */
export const POST = route(async () => {
  await clearSubmissionCookie();
  return { ok: true };
});
