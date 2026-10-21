import { db } from "./db";
import { DOWNLOAD_APPS, sanitizeLinks, type DownloadApp } from "./downloads";
import { DEFAULT_CONTENT, PENDENTE, STEPS, FIX_KEYS } from "./flow";
import { LEGACY_INSTRUCTIONS } from "./legacy-content";
import { parseHosts, resolveVideo } from "./video";

export const SETTING_HOSTS = "videoHosts";
const SETTING_DOWNLOADS = "downloadLinks";

export async function videoHosts(): Promise<string[]> {
  return parseHosts((await db.setting.findUnique({ where: { key: SETTING_HOSTS } }))?.value);
}

// ───────── links de download (editáveis no admin) ─────────

export async function getDownloadLinks(): Promise<Record<DownloadApp, string[]>> {
  const defaults = { totem: DOWNLOAD_APPS.totem.defaultLinks, painel: DOWNLOAD_APPS.painel.defaultLinks };
  const row = await db.setting.findUnique({ where: { key: SETTING_DOWNLOADS } });
  if (!row) return defaults;
  try {
    const v = JSON.parse(row.value) as Partial<Record<DownloadApp, string[]>>;
    return { totem: Array.isArray(v.totem) ? v.totem : defaults.totem, painel: Array.isArray(v.painel) ? v.painel : defaults.painel };
  } catch {
    return defaults;
  }
}

export async function setDownloadLinks(input: Record<DownloadApp, string[]>): Promise<Record<DownloadApp, string[]>> {
  const out = {} as Record<DownloadApp, string[]>;
  for (const app of Object.keys(DOWNLOAD_APPS) as DownloadApp[]) {
    const r = sanitizeLinks(input[app] ?? []);
    if (!r.ok) throw new Error(`${DOWNLOAD_APPS[app].label}: ${r.reason}`);
    out[app] = r.links;
  }
  const value = JSON.stringify(out);
  await db.setting.upsert({ where: { key: SETTING_DOWNLOADS }, update: { value }, create: { key: SETTING_DOWNLOADS, value } });
  return out;
}

// ───────── etapas editáveis ─────────

/**
 * Ajustes de conteúdo para bancos já populados. Cada um só atua sobre o texto antigo exato,
 * preservando qualquer edição feita no admin.
 */
async function migrateContent() {
  // Etapa e aviso da Síntese de Voz foram retirados do tutorial.
  await db.step.deleteMany({ where: { key: "sintese-voz" } });
  await db.step.updateMany({
    where: { key: "atualizar-painel", warning: "Não abra o aplicativo ainda. Primeiro deve ser feita a instalação da Síntese de Voz." },
    data: { warning: "Faça o procedimento na ordem indicada." },
  });

  // Conferir a tela deixou de ter itens para marcar: agora é uma lista informativa.
  const frase = "Confirme cada item abaixo somente se estiver realmente correto.";
  const nova = "Todos os itens da lista abaixo precisam estar corretos na tela. Se algum não estiver, siga o tutorial de ajuste.";
  for (const st of await db.step.findMany({ where: { instructions: { contains: frase } } })) {
    await db.step.update({ where: { id: st.id }, data: { instructions: st.instructions.replaceAll(frase, nova) } });
  }

  // O link único de download virou um bloco de opções (links alternativos + download direto).
  for (const [key, app, antigos] of [
    ["atualizar-totem", "totem", "totem2026|ai-totem"],
    ["atualizar-painel", "painel", "painel26|ai-painel"],
  ] as const) {
    const re = new RegExp(`Abra o navegador do Mini PC e acesse https://bit\\.ly/(?:${antigos})\\nClique em \\*\\*Download\\*\\* e aguarde a conclusão\\.`);
    const st = await db.step.findUnique({ where: { key } });
    if (st && re.test(st.instructions)) {
      const novo = `Abra o navegador do Mini PC e baixe o aplicativo por uma destas opções. Se uma não funcionar, use outra.\n[[downloads:${app}]]`;
      await db.step.update({ where: { key }, data: { instructions: st.instructions.replace(re, novo) } });
    }
  }
}

/** Troca o texto padrão antigo pelo atual (alinhado aos vídeos) apenas se a equipe não o editou. */
async function upgradeDefaultContent() {
  for (const [key, antigos] of Object.entries(LEGACY_INSTRUCTIONS)) {
    const st = await db.step.findUnique({ where: { key } });
    if (st && antigos.includes(st.instructions)) {
      await db.step.update({ where: { key }, data: { instructions: DEFAULT_CONTENT[key].instructions } });
    }
  }
}

/** Garante que todas as etapas editáveis existam (idempotente; usado pelo seed e na primeira leitura). */
export async function ensureSteps() {
  await migrateContent();
  await upgradeDefaultContent();
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
