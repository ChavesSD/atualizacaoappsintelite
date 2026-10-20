import { z } from "zod";
import type { AdjustmentType, EquipmentType, FramingIssueType, Prisma } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { badRequest, conflict, notFound } from "../http";
import { getStep } from "@/domain/steps";
import { normalizeHostname, validateVideoUrl } from "@/domain/video-url";

// ───────────── schemas ─────────────

export const instructionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  warning: z.string().trim().max(500).optional(),
  highlight: z.string().trim().max(120).optional(), // ex.: nome do botão/menu a destacar
  imagePath: z.string().trim().max(200).optional(),
});
export const imageSchema = z.object({
  path: z.string().trim().min(1).max(200),
  alt: z.string().trim().min(1).max(200),
  caption: z.string().trim().max(300).optional(),
});
export const contentInputSchema = z.object({
  stepKey: z.string(),
  hasText: z.boolean().default(true),
  hasVideo: z.boolean().default(false),
  recommendedFormat: z.enum(["TEXTO", "VIDEO"]).default("TEXTO"),
  instructions: z.array(instructionSchema).max(40),
  referenceImages: z.array(imageSchema).max(40).default([]),
  video: z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(1000).optional(),
      url: z.string().trim().max(1000),
      thumbnailUrl: z.string().trim().max(1000).optional(),
      captionsUrl: z.string().trim().max(1000).optional(),
      transcript: z.string().trim().max(20000).optional(),
      durationSec: z.number().int().positive().max(7200).optional(),
    })
    .optional(),
});
export type ContentInput = z.infer<typeof contentInputSchema>;

export const procedureInputSchema = z.object({
  key: z.string().trim().min(2).max(80).optional(), // se informado, cria nova versão do mesmo procedimento
  type: z.enum(["TOTEM", "PAINEL"]),
  modelId: z.string().optional().nullable(),
  adjustmentType: z.enum(["RESOLUCAO", "ESCALA", "DPI", "ORIENTACAO", "PROPORCAO", "OVERSCAN_ZOOM_MONITOR", "CONFIG_APLICATIVO"]),
  appliesTo: z.array(z.string()).max(20),
  title: z.string().trim().min(3).max(200),
  steps: z.array(instructionSchema).min(1).max(40),
  parameters: z.record(z.string().max(100), z.string().max(300)).optional(),
});

// ───────────── vídeos: domínios autorizados ─────────────

export async function allowedHosts(): Promise<string[]> {
  return (await db.allowedVideoHost.findMany({ where: { active: true } })).map((h) => h.hostname);
}

export async function addAllowedHost(adminId: string, raw: string) {
  const hostname = normalizeHostname(raw);
  if (!hostname) throw badRequest("Informe apenas o domínio (ex.: videos.intelite.com.br).");
  const h = await db.allowedVideoHost.upsert({ where: { hostname }, update: { active: true }, create: { hostname } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: "DOMINIO_VIDEO_AUTORIZADO", entity: "AllowedVideoHost", entityId: h.id, after: { hostname } });
  return h;
}
export async function setAllowedHostActive(adminId: string, id: string, active: boolean) {
  const h = await db.allowedVideoHost.update({ where: { id }, data: { active } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: active ? "DOMINIO_VIDEO_REATIVADO" : "DOMINIO_VIDEO_DESATIVADO", entity: "AllowedVideoHost", entityId: id, after: { hostname: h.hostname } });
  return h;
}

async function assertVideoUrls(v: NonNullable<ContentInput["video"]>) {
  const hosts = await allowedHosts();
  const main = validateVideoUrl(v.url, hosts);
  if (!main.ok) throw badRequest(`Vídeo: ${main.reason}`);
  for (const [label, u] of [["Miniatura", v.thumbnailUrl], ["Legendas", v.captionsUrl]] as const) {
    if (u) {
      const r = validateVideoUrl(u, hosts);
      if (!r.ok) throw badRequest(`${label}: ${r.reason}`);
    }
  }
}

// ───────────── conteúdo versionado ─────────────

export async function createContentDraft(adminId: string, input: ContentInput) {
  if (!getStep(input.stepKey)) throw badRequest("Etapa desconhecida.");
  if (!input.hasText && !input.hasVideo) throw badRequest("A etapa precisa ter texto, vídeo ou ambos.");
  if (input.hasVideo && !input.video) throw badRequest("Informe os dados do vídeo.");
  if (input.recommendedFormat === "VIDEO" && !input.hasVideo) throw badRequest("Formato recomendado é vídeo, mas a etapa não tem vídeo.");
  if (input.video) await assertVideoUrls(input.video);

  return db.$transaction(async (tx) => {
    const step = await tx.tutorialStep.findUnique({ where: { key: input.stepKey } });
    if (!step) throw notFound("Etapa não cadastrada.");
    const last = await tx.stepContent.aggregate({ where: { stepId: step.id }, _max: { version: true } });
    const version = (last._max.version ?? 0) + 1;
    const c = await tx.stepContent.create({
      data: {
        stepId: step.id, version, hasText: input.hasText, hasVideo: input.hasVideo, recommendedFormat: input.recommendedFormat,
        instructions: input.instructions as Prisma.InputJsonValue, referenceImages: input.referenceImages as Prisma.InputJsonValue,
        createdById: adminId,
        video: input.video && input.hasVideo ? { create: input.video } : undefined,
      },
    });
    await audit({ actorType: "ADMIN", actorId: adminId, action: "CONTEUDO_RASCUNHO_CRIADO", entity: "StepContent", entityId: c.id, after: { stepKey: input.stepKey, version } }, tx);
    return c;
  });
}

/** Publica uma versão (arquivando a anterior). O texto é sempre exigido: é a alternativa acessível quando o vídeo falha. */
export async function publishContent(adminId: string, contentId: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.stepContent.findUnique({ where: { id: contentId }, include: { video: true, step: true } });
    if (!c) throw notFound();
    if (c.status === "PUBLICADO") throw conflict("Esta versão já está publicada.");
    const instr = z.array(instructionSchema).safeParse(c.instructions);
    if (!c.hasText || !instr.success || instr.data.length === 0)
      throw badRequest("Para publicar, a etapa precisa de instruções escritas (alternativa acessível quando o vídeo não carrega).");
    if (c.hasVideo) {
      if (!c.video) throw badRequest("Etapa marcada com vídeo, mas sem vídeo cadastrado.");
      await assertVideoUrls({ title: c.video.title, url: c.video.url, thumbnailUrl: c.video.thumbnailUrl ?? undefined, captionsUrl: c.video.captionsUrl ?? undefined });
    }
    const prev = await tx.stepContent.findFirst({ where: { stepId: c.stepId, status: "PUBLICADO" } });
    if (prev) await tx.stepContent.update({ where: { id: prev.id }, data: { status: "ARQUIVADO" } });
    const pub = await tx.stepContent.update({ where: { id: c.id }, data: { status: "PUBLICADO", publishedAt: new Date() } });
    await audit({ actorType: "ADMIN", actorId: adminId, action: "CONTEUDO_PUBLICADO", entity: "StepContent", entityId: c.id, before: { replaced: prev?.version ?? null }, after: { stepKey: c.step.key, version: c.version } }, tx);
    return pub;
  });
}

export async function unpublishContent(adminId: string, contentId: string) {
  const c = await db.stepContent.findUnique({ where: { id: contentId }, include: { step: true } });
  if (!c) throw notFound();
  if (c.status !== "PUBLICADO") throw conflict("A versão não está publicada.");
  await db.stepContent.update({ where: { id: c.id }, data: { status: "ARQUIVADO" } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: "CONTEUDO_RETIRADO", entity: "StepContent", entityId: c.id, after: { stepKey: c.step.key, version: c.version } });
}

// ───────────── leitura para o cliente ─────────────

/**
 * Conteúdo publicado da etapa. A URL do vídeo é revalidada na leitura: se o domínio tiver sido
 * desautorizado depois, o vídeo some e o texto continua disponível.
 */
export async function getPublishedStep(stepKey: string) {
  const step = await db.tutorialStep.findUnique({
    where: { key: stepKey },
    include: { contents: { where: { status: "PUBLICADO" }, include: { video: true }, take: 1 } },
  });
  if (!step) throw notFound("Etapa não encontrada.");
  const content = step.contents[0] ?? null;
  let video: null | { title: string; description: string | null; url: string; direct: boolean; thumbnailUrl: string | null; captionsUrl: string | null; transcript: string | null; durationSec: number | null } = null;
  if (content?.hasVideo && content.video) {
    const hosts = await allowedHosts();
    const v = validateVideoUrl(content.video.url, hosts);
    if (v.ok) {
      const ok = (u: string | null) => (u && validateVideoUrl(u, hosts).ok ? u : null);
      video = {
        title: content.video.title, description: content.video.description, url: v.url, direct: v.direct,
        thumbnailUrl: ok(content.video.thumbnailUrl), captionsUrl: ok(content.video.captionsUrl),
        transcript: content.video.transcript, durationSec: content.video.durationSec,
      };
    }
  }
  return {
    step: { key: step.key, title: step.title, kind: step.kind, type: step.type },
    content: content && {
      id: content.id, version: content.version, recommendedFormat: content.recommendedFormat,
      instructions: content.instructions as unknown[], referenceImages: content.referenceImages as unknown[],
    },
    video,
  };
}

export async function getCriteria(type: EquipmentType, modelId: string | null) {
  return db.framingCriterion.findMany({
    where: { type, active: true, OR: [{ modelId: null }, ...(modelId ? [{ modelId }] : [])] },
    orderBy: [{ position: "asc" }, { label: "asc" }],
    select: { id: true, label: true, required: true },
  });
}

/** Procedimentos oficiais publicados aplicáveis aos problemas abertos. Nada é inventado: sem cadastro, a lista vem vazia. */
export async function getApplicableProcedures(type: EquipmentType, modelId: string | null, openIssues: FramingIssueType[]) {
  const all = await db.correctionProcedure.findMany({
    where: { status: "PUBLICADO", type, OR: [{ modelId: null }, ...(modelId ? [{ modelId }] : [])] },
    orderBy: [{ title: "asc" }],
  });
  const fits = all.filter((p) => p.appliesTo.length === 0 || p.appliesTo.some((i) => openIssues.includes(i)));
  return fits.map((p) => ({
    id: p.id, key: p.key, version: p.version, title: p.title, adjustmentType: p.adjustmentType,
    modelSpecific: p.modelId !== null, steps: p.steps as unknown[], parameters: p.parameters as Record<string, string> | null,
  }));
}

// ───────────── procedimentos de correção (equipe técnica) ─────────────

export async function createProcedureDraft(adminId: string, raw: z.infer<typeof procedureInputSchema>) {
  const input = procedureInputSchema.parse(raw);
  const valid = new Set<string>(["TEXTO_CORTADO", "BOTAO_CORTADO", "LOGOTIPO_CORTADO", "INTERFACE_DESLOCADA", "BARRAS_OU_MARGENS", "CONTEUDO_FORA_DA_AREA", "PROPORCAO_INCORRETA", "SENHA_CORTADA", "IDENTIFICACAO_CORTADA", "OUTRO"]);
  const appliesTo = input.appliesTo.filter((x) => valid.has(x)) as FramingIssueType[];
  if (appliesTo.length !== input.appliesTo.length) throw badRequest("Tipo de problema inválido.");
  return db.$transaction(async (tx) => {
    const key = input.key ?? `proc-${Date.now().toString(36)}`;
    const last = await tx.correctionProcedure.aggregate({ where: { key }, _max: { version: true } });
    const p = await tx.correctionProcedure.create({
      data: {
        key, version: (last._max.version ?? 0) + 1, type: input.type, modelId: input.modelId ?? null,
        adjustmentType: input.adjustmentType as AdjustmentType, appliesTo, title: input.title,
        steps: input.steps as Prisma.InputJsonValue, parameters: (input.parameters ?? undefined) as Prisma.InputJsonValue | undefined,
        createdById: adminId,
      },
    });
    await audit({ actorType: "ADMIN", actorId: adminId, action: "PROCEDIMENTO_RASCUNHO_CRIADO", entity: "CorrectionProcedure", entityId: p.id, after: { key, version: p.version } }, tx);
    return p;
  });
}

/** Publicar = aprovar. O aprovador fica registrado. Apenas perfis ADMIN/TECNICO (checado na rota). */
export async function publishProcedure(adminId: string, id: string) {
  return db.$transaction(async (tx) => {
    const p = await tx.correctionProcedure.findUnique({ where: { id } });
    if (!p) throw notFound();
    if (p.status === "PUBLICADO") throw conflict("Já publicado.");
    await tx.correctionProcedure.updateMany({ where: { key: p.key, status: "PUBLICADO" }, data: { status: "ARQUIVADO" } });
    const r = await tx.correctionProcedure.update({ where: { id }, data: { status: "PUBLICADO", approvedById: adminId, approvedAt: new Date() } });
    await audit({ actorType: "ADMIN", actorId: adminId, action: "PROCEDIMENTO_PUBLICADO", entity: "CorrectionProcedure", entityId: id, after: { key: p.key, version: p.version } }, tx);
    return r;
  });
}

export async function archiveProcedure(adminId: string, id: string) {
  const p = await db.correctionProcedure.update({ where: { id }, data: { status: "ARQUIVADO" } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: "PROCEDIMENTO_ARQUIVADO", entity: "CorrectionProcedure", entityId: id, after: { key: p.key, version: p.version } });
}
