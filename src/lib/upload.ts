export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export type ImageSniff = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" } | null;

/** Detecta o tipo real pelos bytes iniciais; não confia no Content-Type nem no nome do arquivo enviados pelo cliente. */
export function sniffImage(buf: Uint8Array): ImageSniff {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return { mime: "image/png", ext: "png" };
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}
