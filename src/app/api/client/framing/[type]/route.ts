import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { badRequest, readJson, route } from "@/lib/http";
import { submitVerification } from "@/lib/services/session";
import { parseType } from "@/lib/params";

const schema = z.object({
  outcome: z.enum(["CORRETO", "INCORRETO", "PRECISA_SUPORTE"]),
  criteria: z.array(z.object({ criterionId: z.string(), ok: z.boolean() })).max(50).default([]),
  issues: z
    .array(z.object({
      type: z.enum(["TEXTO_CORTADO", "BOTAO_CORTADO", "LOGOTIPO_CORTADO", "INTERFACE_DESLOCADA", "BARRAS_OU_MARGENS", "CONTEUDO_FORA_DA_AREA", "PROPORCAO_INCORRETA", "SENHA_CORTADA", "IDENTIFICACAO_CORTADA", "OUTRO"]),
      detail: z.string().max(500).optional(),
    }))
    .max(10)
    .default([]),
  notes: z.string().max(1000).optional(),
});

export const POST = route<{ params: Promise<{ type: string }> }>(async (req, { params }) => {
  const cu = await requireClient();
  const type = parseType((await params).type);
  if (!type) throw badRequest("Tipo de equipamento inválido.");
  return submitVerification(cu.id, type, schema.parse(await readJson(req)));
});
