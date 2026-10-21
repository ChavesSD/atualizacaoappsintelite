import { notFound, route } from "@/lib/http";
import { storage } from "@/lib/storage";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Somente imagens de referência do tutorial (prefixo content/). Fotos de clientes nunca passam por aqui. */
export const GET = route<{ params: Promise<{ key: string[] }> }>(async (_req, { params }) => {
  const key = (await params).key.join("/");
  if (!/^content\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw notFound();
  const data = await storage().get(key);
  if (!data) throw notFound();
  return new Response(new Uint8Array(data), { headers: { "Content-Type": MIME[key.split(".").pop()!], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
});
