import { db } from "./db";
import { DEFAULT_CONTENT, PENDENTE, STEPS, FIX_KEYS } from "./flow";
import { parseHosts, resolveVideo } from "./video";

export const SETTING_HOSTS = "videoHosts";

export async function videoHosts(): Promise<string[]> {
  return parseHosts((await db.setting.findUnique({ where: { key: SETTING_HOSTS } }))?.value);
}

/** Garante que todas as etapas editáveis existam (idempotente; usado pelo seed e na primeira leitura). */
/** Etapas/avisos que existiram e foram retirados do tutorial (OBSOLETOS): limpa de bancos já populados. */
/** Links de download que foram substituídos (LINKS_ANTIGOS): troca só o link, preservando qualquer edição feita no admin. */
const LINKS_ANTIGOS: Record<string, string> = {
  "https://bit.ly/ai-totem": "https://bit.ly/totem2026",
  "https://bit.ly/ai-painel": "https://bit.ly/painel26",
};

async function removeObsolete() {
  for (const [antigo, novo] of Object.entries(LINKS_ANTIGOS)) {
    const steps = await db.step.findMany({ where: { instructions: { contains: antigo } } });
    for (const st of steps) await db.step.update({ where: { id: st.id }, data: { instructions: st.instructions.replaceAll(antigo, novo) } });
  }
  await db.step.deleteMany({ where: { key: "sintese-voz" } });
  await db.step.updateMany({
    where: { key: "atualizar-painel", warning: "Não abra o aplicativo ainda. Primeiro deve ser feita a instalação da Síntese de Voz." },
    data: { warning: "Faça o procedimento na ordem indicada." },
  });
}

export async function ensureSteps() {
  await removeObsolete();
  const keys = [...STEPS.map((s) => s.key).filter((k) => k in DEFAULT_CONTENT), FIX_KEYS.TOTEM, FIX_KEYS.PAINEL];
  const order = ["formato", "atualizar-totem", "enquadramento-totem", "correcao-totem", "atualizar-painel", "enquadramento-painel", "correcao-painel", "fotos"];
  for (const key of keys) {
    const d = DEFAULT_CONTENT[key];
    await db.step.upsert({ where: { key }, update: {}, create: { key, position: order.indexOf(key), title: d.title, instructions: d.instructions, warning: d.warning } });
    // Conteúdo oficial entra no lugar do placeholder, mas nunca sobrescreve texto que a equipe já editou no admin.
    if (d.instructions !== PENDENTE) {
      await db.step.updateMany({ where: { key, instructions: PENDENTE }, data: { instructions: d.instructions, warning: d.warning ?? null } });
    }
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
