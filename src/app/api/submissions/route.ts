import { z } from "zod";
import { setSubmissionCookie } from "@/lib/auth";
import { clientIp, rateLimit, readJson, route } from "@/lib/http";
import { createSubmission, loadView } from "@/lib/submissions";

const schema = z.object({
  company: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
});

/** Início do tutorial: cria o envio e guarda um cookie assinado para o cliente retomar de onde parou. */
export const POST = route(async (req) => {
  rateLimit(`new:${clientIp(req)}`, 20, 60 * 60_000);
  const s = await createSubmission(schema.parse(await readJson(req)));
  await setSubmissionCookie(s.id);
  return loadView(s.id);
});
