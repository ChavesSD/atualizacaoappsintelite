import path from "node:path";

/**
 * Aplicativos disponíveis para download. O aplicativo atual é híbrido: o mesmo APK serve para o totem e para o painel,
 * então as duas entradas usam os mesmos links.
 * Download direto (opcional): coloque o APK na pasta /downloads e informe `file`/`filename`/`version` aqui; sem `file`,
 * só os links curtos aparecem. Os links curtos são editáveis no admin; os abaixo são só o valor inicial.
 */
export type DownloadApp = "totem" | "painel";

interface AppInfo { label: string; version: string | null; file: string | null; filename: string | null; defaultLinks: string[]; legacyLinks: string[][] }

const HIBRIDO = ["https://bit.ly/aihib15", "https://shre.ink/aihib15"];

export const DOWNLOAD_APPS: Record<DownloadApp, AppInfo> = {
  totem: {
    label: "Atendimento Inteligente (totem)",
    version: null,
    file: null,
    filename: null,
    defaultLinks: HIBRIDO,
    // padrões anteriores: se o banco ainda tiver exatamente estes, passam para o novo (edições da equipe são preservadas)
    legacyLinks: [["https://bit.ly/aitotem26", "https://shre.ink/aitotem26"], ["https://bit.ly/totem2026"]],
  },
  painel: {
    label: "Atendimento Inteligente (painel de chamadas)",
    version: null,
    file: null,
    filename: null,
    defaultLinks: HIBRIDO,
    legacyLinks: [["https://bit.ly/aipainel26", "https://shre.ink/aipainel26"], ["https://bit.ly/painel26"]],
  },
};

export const isDownloadApp = (v: string): v is DownloadApp => Object.prototype.hasOwnProperty.call(DOWNLOAD_APPS, v);
export const downloadFilePath = (app: DownloadApp) => {
  const file = DOWNLOAD_APPS[app].file;
  return file ? path.join(process.cwd(), "downloads", file) : null;
};

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
