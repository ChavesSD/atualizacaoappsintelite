import { z } from "zod";
import { getSubmissionId } from "@/lib/auth";
import { readJson, route, unauthorized } from "@/lib/http";
import { loadView, patchSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

async function me() {
  const id = await getSubmissionId();
  if (!id) throw unauthorized("Nenhum tutorial em andamento neste dispositivo.");
  return id;
}

/** Sem cookie = visitante novo: responde null (não é erro). */
export const GET = route(async () => {
  const id = await getSubmissionId();
  return id ? loadView(id) : null;
});

const patch = z.object({
  step: z.number().int().min(0).max(20).optional(),
  format: z.enum(["TEXTO", "VIDEO"]).optional(),
  totemUpdated: z.boolean().optional(),
  painelUpdated: z.boolean().optional(),
  framing: z
    .object({
      type: z.enum(["TOTEM", "PAINEL"]),
      outcome: z.enum(["CORRETO", "INCORRETO", "PRECISA_SUPORTE"]),
      issues: z.array(z.string().max(80)).max(10).default([]),
      notes: z.string().max(1000).optional(),
    })
    .optional(),
  help: z.object({ message: z.string().max(1000).optional(), step: z.string().max(80) }).optional(),
});

export const PATCH = route(async (req) => patchSubmission(await me(), patch.parse(await readJson(req))));
