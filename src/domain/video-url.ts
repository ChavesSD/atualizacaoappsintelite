export type VideoUrlResult = { ok: true; url: string; host: string; direct: boolean } | { ok: false; reason: string };

const DIRECT_EXT = /\.(mp4|webm|m3u8)$/i;

/**
 * Valida a URL de um vídeo cadastrado por um administrador.
 * Regras: somente https, sem credenciais, sem porta customizada, host igual a um domínio autorizado
 * ou subdomínio dele. Nunca aceita javascript:, data:, http: etc.
 */
export function validateVideoUrl(raw: string, allowedHosts: string[]): VideoUrlResult {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "URL inválida." };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "Somente URLs https são permitidas." };
  if (u.username || u.password) return { ok: false, reason: "URLs com credenciais não são permitidas." };
  if (u.port && u.port !== "443") return { ok: false, reason: "Portas customizadas não são permitidas." };
  const host = u.hostname.toLowerCase();
  const allowed = allowedHosts.map((h) => h.toLowerCase().trim()).filter(Boolean);
  const ok = allowed.some((a) => host === a || host.endsWith("." + a));
  if (!ok) return { ok: false, reason: `Domínio não autorizado pela Intelite: ${host}.` };
  return { ok: true, url: u.toString(), host, direct: DIRECT_EXT.test(u.pathname) };
}

/** Normaliza o cadastro de um domínio autorizado (apenas hostname, sem esquema/caminho). */
export function normalizeHostname(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)) return null;
  return h;
}
