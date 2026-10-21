import path from "node:path";

/**
 * Aplicativos disponíveis para download. Os APKs ficam no repositório (pasta /downloads) e vão junto no deploy.
 * Para publicar uma nova versão: troque o arquivo, ajuste `version`/`file`/`filename` aqui e faça o deploy.
 * Os links curtos (bit.ly etc.) são editáveis no admin; os abaixo são só o valor inicial.
 */
export type DownloadApp = "totem" | "painel";

export const DOWNLOAD_APPS: Record<DownloadApp, { label: string; version: string; file: string; filename: string; defaultLinks: string[] }> = {
  totem: {
    label: "Totem",
    version: "26.10",
    file: "ai-totem-26.10.apk",
    filename: "AI_Totem_26.10.apk",
    defaultLinks: ["https://bit.ly/aitotem26", "https://shre.ink/aitotem26"],
  },
  painel: {
    label: "Painel de chamadas",
    version: "26.10",
    file: "ai-painel-26.10.apk",
    filename: "AI_Painel_26.10.apk",
    defaultLinks: ["https://bit.ly/aipainel26", "https://shre.ink/aipainel26"],
  },
};

export const isDownloadApp = (v: string): v is DownloadApp => Object.prototype.hasOwnProperty.call(DOWNLOAD_APPS, v);
export const downloadFilePath = (app: DownloadApp) => path.join(process.cwd(), "downloads", DOWNLOAD_APPS[app].file);

/**
 * Interpreta o cabeçalho Range (um único intervalo). Navegadores e gerenciadores de download do Android usam
 * Range para retomar downloads interrompidos, o que evita "não consegui baixar" em conexões instáveis.
 * Retorna null (sem Range → arquivo inteiro), "invalid" (416) ou o intervalo.
 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return header.includes(",") ? null : "invalid"; // vários intervalos: serve o arquivo inteiro
  if (m[1] === "" && m[2] === "") return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const n = Number(m[2]);
    if (n === 0) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

/** Valida os links de download cadastrados no admin: somente https, sem credenciais, até 5 por aplicativo. */
export function sanitizeLinks(input: string[]): { ok: true; links: string[] } | { ok: false; reason: string } {
  const links: string[] = [];
  for (const raw of input.map((l) => l.trim()).filter(Boolean)) {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let u: URL;
    try {
      u = new URL(withScheme);
    } catch {
      return { ok: false, reason: `Link inválido: ${raw}` };
    }
    if (u.protocol !== "https:") return { ok: false, reason: `Use https: ${raw}` };
    if (u.username || u.password) return { ok: false, reason: `Link com usuário/senha não é permitido: ${raw}` };
    if (!links.includes(u.toString())) links.push(u.toString());
  }
  if (links.length > 5) return { ok: false, reason: "No máximo 5 links por aplicativo." };
  return { ok: true, links };
}
