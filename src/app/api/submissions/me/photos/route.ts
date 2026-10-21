import { getSubmissionId } from "@/lib/auth";
import { badRequest, route, unauthorized } from "@/lib/http";
import { addPhoto } from "@/lib/submissions";
import { MAX_UPLOAD_BYTES, sniffImage } from "@/lib/upload";

export const POST = route(async (req) => {
  const id = await getSubmissionId();
  if (!id) throw unauthorized();
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 100_000) throw badRequest("A foto excede 12 MB.");
  const form = await req.formData();
  const type = String(form.get("type") ?? "").toUpperCase();
  const file = form.get("file");
  if (type !== "TOTEM" && type !== "PAINEL") throw badRequest("Informe o equipamento.");
  if (!(file instanceof File)) throw badRequest("Envie o arquivo da foto.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw badRequest("A foto excede 12 MB.");
  const kind = sniffImage(bytes); // tipo real pelos bytes, não pelo nome/Content-Type enviados
  if (!kind) throw badRequest("Envie uma imagem JPEG, PNG ou WebP.");
  return addPhoto(id, type, bytes, kind.mime, kind.ext);
});
