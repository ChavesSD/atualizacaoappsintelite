import { requireClient } from "@/lib/auth";
import { badRequest, route } from "@/lib/http";
import { uploadEvidence } from "@/lib/services/session";
import { parseType } from "@/lib/params";
import { MAX_UPLOAD_BYTES } from "@/domain/upload";

export const POST = route(async (req) => {
  const cu = await requireClient();
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 100_000) throw badRequest("A imagem excede o limite de 12 MB.");
  const form = await req.formData();
  const type = parseType(String(form.get("type") ?? ""));
  const file = form.get("file");
  if (!type) throw badRequest("Informe o equipamento (totem ou painel).");
  if (!(file instanceof File)) throw badRequest("Envie o arquivo da foto.");
  return uploadEvidence(cu.id, type, Buffer.from(await file.arrayBuffer()));
});
