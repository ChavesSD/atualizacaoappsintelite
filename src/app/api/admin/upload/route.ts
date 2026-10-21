import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { badRequest, route } from "@/lib/http";
import { storage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, sniffImage } from "@/lib/upload";

/** Imagem de referência de uma etapa do tutorial. */
export const POST = route(async (req) => {
  await requireAdmin();
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw badRequest("Envie uma imagem.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw badRequest("Tamanho inválido (máx. 12 MB).");
  const kind = sniffImage(bytes);
  if (!kind) throw badRequest("Envie uma imagem JPEG, PNG ou WebP.");
  const path = `content/${crypto.randomUUID()}.${kind.ext}`;
  await storage().put(path, bytes);
  return { path };
});
