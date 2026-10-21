import { db } from "./db";
import { DEFAULT_CONTENT, STEPS, FIX_KEYS } from "./flow";
import { parseHosts, resolveVideo } from "./video";

export const SETTING_HOSTS = "videoHosts";

export async function videoHosts(): Promise<string[]> {
  return parseHosts((await db.setting.findUnique({ where: { key: SETTING_HOSTS } }))?.value);
}

/** Garante que todas as etapas editáveis existam (idempotente; usado pelo seed e na primeira leitura). */
export async function ensureSteps() {
  const keys = [...STEPS.map((s) => s.key).filter((k) => k in DEFAULT_CONTENT), FIX_KEYS.TOTEM, FIX_KEYS.PAINEL];
  const order = ["formato", "atualizar-totem", "enquadramento-totem", "correcao-totem", "atualizar-painel", "enquadramento-painel", "correcao-painel", "fotos"];
  for (const key of keys) {
    const d = DEFAULT_CONTENT[key];
    await db.step.upsert({ where: { key }, update: {}, create: { key, position: order.indexOf(key), title: d.title, instructions: d.instructions, warning: d.warning } });
  }
}

/** Conteúdo público das etapas. O vídeo é revalidado a cada leitura: se o domínio deixar de ser autorizado, só o texto aparece. */
export async function publicContent() {
  if ((await db.step.count()) === 0) await ensureSteps();
  const [steps, hosts] = await Promise.all([db.step.findMany({ where: { active: true }, orderBy: { position: "asc" } }), videoHosts()]);
  return steps.map((s) => {
    const v = s.videoUrl ? resolveVideo(s.videoUrl, hosts) : null;
    return {
      key: s.key, title: s.title,
      instructions: s.instructions.split("\n").map((l) => l.trim()).filter(Boolean),
      warning: s.warning, imagePath: s.imagePath,
      video: v && v.ok ? { kind: v.kind, src: v.src, title: s.videoTitle ?? s.title } : null,
    };
  });
}
