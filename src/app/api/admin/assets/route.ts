import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { badRequest, route } from "@/lib/http";
import { storage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, sniffImage } from "@/domain/upload";

/** Upload de imagem de referência do tutorial (equipe). Tipo verificado pelos bytes. */
export const POST = route(async (req) => {
  const admin = await requireAdmin("ADMIN", "TECNICO");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw badRequest("Envie uma imagem.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw badRequest("Tamanho de imagem inválido (máx. 12 MB).");
  const sniff = sniffImage(bytes);
  if (!sniff) throw badRequest("Envie uma imagem JPEG, PNG ou WebP.");
  const path = `content/${crypto.randomUUID()}.${sniff.ext}`;
  await storage().put(path, bytes);
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "IMAGEM_REFERENCIA_ENVIADA", entity: "Asset", entityId: path });
  return { path, url: `/api/assets/${path}` };
});
