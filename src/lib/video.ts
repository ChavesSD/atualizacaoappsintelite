export type VideoSource = { ok: true; kind: "embed" | "file"; src: string } | { ok: false; reason: string };

export const DEFAULT_VIDEO_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com", "vimeo.com", "player.vimeo.com"];

/**
 * Valida a URL de um vídeo e devolve a fonte a ser reproduzida.
 * Só https, sem credenciais/porta, e o domínio precisa estar na lista de autorizados (ou ser subdomínio).
 * Links de YouTube/Vimeo viram URLs de incorporação.
 */
export function resolveVideo(raw: string, allowedHosts: string[]): VideoSource {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "URL inválida." };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "Use um link https." };
  if (u.username || u.password) return { ok: false, reason: "Links com usuário/senha não são permitidos." };
  if (u.port && u.port !== "443") return { ok: false, reason: "Porta não permitida." };
  const host = u.hostname.toLowerCase();
  const allowed = allowedHosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (!allowed.some((a) => host === a || host.endsWith("." + a))) return { ok: false, reason: `Domínio não autorizado: ${host}.` };

  const isHost = (d: string) => host === d || host.endsWith("." + d);
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (/^[\w-]{6,20}$/.test(id)) return { ok: true, kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (isHost("youtube.com") || isHost("youtube-nocookie.com")) {
    const id = u.searchParams.get("v") ?? (u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,20})/)?.[1] ?? null);
    if (id && /^[\w-]{6,20}$/.test(id)) return { ok: true, kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` };
    return { ok: false, reason: "Link do YouTube não reconhecido." };
  }
  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    if (id) return { ok: true, kind: "embed", src: `https://player.vimeo.com/video/${id}` };
    return { ok: false, reason: "Link do Vimeo não reconhecido." };
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { ok: true, kind: "file", src: u.toString() };
  return { ok: true, kind: "embed", src: u.toString() };
}

export function parseHosts(value: string | null | undefined): string[] {
  if (!value) return DEFAULT_VIDEO_HOSTS;
  return value.split(/[\s,;]+/).map((h) => h.trim().toLowerCase()).filter((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h));
}
