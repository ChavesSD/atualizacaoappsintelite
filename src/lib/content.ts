import { db } from "./db";
import { APP, sanitizeLinks } from "./downloads";
import { DEFAULT_CONTENT, FIX_KEY, PENDENTE, PREVIOUS_DEFAULTS, STEPS } from "./flow";
import { parseHosts, resolveVideo } from "./video";
import { guideVideo } from "./videos-server";

export const SETTING_HOSTS = "videoHosts";
const SETTING_LINKS = "appLinks";
const SETTING_LINKS_LEGACY = "downloadLinks";

export async function videoHosts(): Promise<string[]> {
  return parseHosts((await db.setting.findUnique({ where: { key: SETTING_HOSTS } }))?.value);
}

// ───────── links de download (editáveis no admin) ─────────

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export async function getAppLinks(): Promise<string[]> {
  const row = await db.setting.findUnique({ where: { key: SETTING_LINKS } });
  if (row) {
    try {
      const v = JSON.parse(row.value);
      if (Array.isArray(v)) return v;
    } catch { /* valor corrompido: volta ao padrão */ }
  }
  // Antes da unificação os links eram salvos por equipamento ({ totem, painel }). Edições da equipe são aproveitadas;
  // os padrões antigos passam para o aplicativo atual.
  const legacy = await db.setting.findUnique({ where: { key: SETTING_LINKS_LEGACY } });
  if (legacy) {
    try {
      const v = JSON.parse(legacy.value) as { totem?: string[]; painel?: string[] };
      const edited = [v.totem, v.painel].find((l): l is string[] => Array.isArray(l) && l.length > 0 && !APP.legacyLinks.some((d) => sameList(d, l)));
      if (edited) return edited;
    } catch { /* ignora */ }
  }
  return APP.defaultLinks;
}

export async function setAppLinks(input: string[]): Promise<string[]> {
  const r = sanitizeLinks(input);
  if (!r.ok) throw new Error(r.reason);
  const value = JSON.stringify(r.links);
  await db.setting.upsert({ where: { key: SETTING_LINKS }, update: { value }, create: { key: SETTING_LINKS, value } });
  return r.links;
}

// ───────── etapas editáveis ─────────

/** Etapas do tutorial anterior (totem e painel separados, com desinstalação). Foram substituídas pelo fluxo único. */
const RETIRED_KEYS = ["formato", "atualizar-totem", "enquadramento-totem", "correcao-totem", "atualizar-painel", "enquadramento-painel", "correcao-painel", "sintese-voz"];

/** Garante que todas as etapas editáveis existam (idempotente; usado pelo seed e na primeira leitura). */
export async function ensureSteps() {
  await db.step.deleteMany({ where: { key: { in: RETIRED_KEYS } } });
  const keys = [...STEPS.map((s) => s.key).filter((k) => k in DEFAULT_CONTENT), FIX_KEY];
  const order = ["atualizar", "conferir", FIX_KEY, "fotos"];
  for (const key of keys) {
    const d = DEFAULT_CONTENT[key];
    await db.step.upsert({ where: { key }, update: {}, create: { key, position: order.indexOf(key), title: d.title, instructions: d.instructions, warning: d.warning } });
    // Conteúdo oficial entra no lugar do placeholder, mas nunca sobrescreve texto que a equipe já editou no admin.
    if (d.instructions !== PENDENTE) {
      await db.step.updateMany({ where: { key, instructions: PENDENTE }, data: { instructions: d.instructions, warning: d.warning ?? null } });
      // Texto padrão de uma versão anterior, nunca editado no admin: passa para o texto atual.
      const antigos = PREVIOUS_DEFAULTS[key];
      if (antigos?.length) await db.step.updateMany({ where: { key, instructions: { in: antigos } }, data: { instructions: d.instructions, warning: d.warning ?? null } });
    }
  }
}

/**
 * Conteúdo público: textos das etapas e o vídeo principal do guia. O vídeo de uma etapa (link do YouTube/Vimeo cadastrado
 * no admin) é revalidado a cada leitura: se o domínio deixar de ser autorizado, só o texto aparece.
 */
export async function publicContent() {
  if ((await db.step.count()) === 0) await ensureSteps();
  const [steps, hosts] = await Promise.all([db.step.findMany({ where: { active: true }, orderBy: { position: "asc" } }), videoHosts()]);
  return {
    steps: steps.map((s) => {
      const v = s.videoUrl ? resolveVideo(s.videoUrl, hosts) : null;
      return {
        key: s.key, title: s.title,
        instructions: s.instructions.split("\n").map((l) => l.trim()).filter(Boolean),
        warning: s.warning, imagePath: s.imagePath,
        video: v && v.ok ? { kind: v.kind, src: v.src, title: s.videoTitle ?? s.title } : null,
      };
    }),
    guideVideo: guideVideo(),
  };
}
