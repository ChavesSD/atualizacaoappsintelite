import type { EquipmentType, FramingStatus, Prisma } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { badRequest, conflict, notFound } from "../http";
import { generateAccessCode, hashAccessCode } from "../crypto";
import { computeDashboard, type DashboardInput } from "@/domain/metrics";
import { operationalStatus } from "@/domain/completion";

// ───────────── campanhas e unidades ─────────────

export async function createCampaign(adminId: string, input: { name: string; startsAt: Date; endsAt?: Date; requireTechnicalValidation?: boolean }) {
  const c = await db.campaign.create({ data: { ...input, requireTechnicalValidation: input.requireTechnicalValidation ?? true } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: "CAMPANHA_CRIADA", entity: "Campaign", entityId: c.id, after: { name: c.name } });
  return c;
}

/** Cadastra a unidade na campanha. O código de acesso em claro é devolvido UMA vez; só o hash é guardado. */
export async function addUnitToCampaign(
  adminId: string,
  campaignId: string,
  input: { code: string; name: string; city?: string; totemModelId?: string; painelModelId?: string },
) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw notFound("Campanha não encontrada.");
  const accessCode = generateAccessCode();
  const cu = await db.$transaction(async (tx) => {
    const unit = await tx.unit.upsert({ where: { code: input.code }, update: { name: input.name, city: input.city }, create: { code: input.code, name: input.name, city: input.city } });
    for (const [type, modelId] of [["TOTEM", input.totemModelId], ["PAINEL", input.painelModelId]] as const) {
      await tx.unitEquipment.upsert({ where: { unitId_type: { unitId: unit.id, type } }, update: modelId ? { modelId } : {}, create: { unitId: unit.id, type, modelId } });
    }
    const exists = await tx.campaignUnit.findUnique({ where: { campaignId_unitId: { campaignId, unitId: unit.id } } });
    if (exists) throw conflict("Esta unidade já está na campanha.");
    const row = await tx.campaignUnit.create({ data: { campaignId, unitId: unit.id, accessCodeHash: hashAccessCode(accessCode) } });
    await audit({ actorType: "ADMIN", actorId: adminId, action: "UNIDADE_ADICIONADA_A_CAMPANHA", entity: "CampaignUnit", entityId: row.id, after: { unit: input.code } }, tx);
    return row;
  });
  return { campaignUnitId: cu.id, accessCode };
}

export async function regenerateAccessCode(adminId: string, campaignUnitId: string) {
  const accessCode = generateAccessCode();
  await db.campaignUnit.update({ where: { id: campaignUnitId }, data: { accessCodeHash: hashAccessCode(accessCode) } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: "CODIGO_ACESSO_REGENERADO", entity: "CampaignUnit", entityId: campaignUnitId });
  return { accessCode };
}

// ───────────── evidências e validação técnica ─────────────

export async function reviewEvidence(adminId: string, evidenceId: string, decision: "ACEITA" | "NOVA_FOTO_SOLICITADA", reason?: string) {
  if (decision === "NOVA_FOTO_SOLICITADA" && (!reason || reason.trim().length < 5)) {
    throw badRequest("Explique ao cliente por que uma nova foto é necessária.");
  }
  return db.$transaction(async (tx) => {
    const ev = await tx.evidence.findUnique({ where: { id: evidenceId } });
    if (!ev) throw notFound();
    const updated = await tx.evidence.update({
      where: { id: evidenceId },
      data: { review: decision, reviewReason: decision === "NOVA_FOTO_SOLICITADA" ? reason!.trim() : null, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (ev.checkId) {
      await tx.framingEvent.create({
        data: { checkId: ev.checkId, kind: decision === "ACEITA" ? "EVIDENCIA_ACEITA" : "NOVA_FOTO_SOLICITADA", actorType: "ADMIN", actorId: adminId, notes: reason?.trim() },
      });
      // Se a foto que sustentava a validação foi recusada, a validação deixa de valer.
      if (decision === "NOVA_FOTO_SOLICITADA") {
        await tx.framingCheck.update({ where: { id: ev.checkId }, data: { technicalStatus: "PENDENTE", technicalById: null, technicalAt: null } });
      }
    }
    await audit({ actorType: "ADMIN", actorId: adminId, action: decision === "ACEITA" ? "EVIDENCIA_ACEITA" : "NOVA_FOTO_SOLICITADA", entity: "Evidence", entityId: evidenceId, before: { review: ev.review }, after: { review: decision, reason: reason ?? null } }, tx);
    return updated;
  });
}

export async function validateFraming(adminId: string, checkId: string, decision: "VALIDADO" | "REJEITADO", notes?: string) {
  if (decision === "REJEITADO" && (!notes || notes.trim().length < 5)) throw badRequest("Explique o motivo da rejeição.");
  return db.$transaction(async (tx) => {
    const c = await tx.framingCheck.findUnique({ where: { id: checkId }, include: { evidences: true } });
    if (!c) throw notFound();
    if (c.status !== "CORRETO") throw conflict("A validação técnica só se aplica a enquadramento declarado como correto pelo cliente.");
    if (decision === "VALIDADO" && !c.evidences.some((e) => e.review === "ACEITA")) {
      throw conflict("Revise e aceite ao menos uma fotografia que permita avaliar o enquadramento antes de validar.");
    }
    const updated = await tx.framingCheck.update({
      where: { id: checkId },
      data: { technicalStatus: decision, technicalById: adminId, technicalAt: new Date(), technicalNotes: notes?.trim() ?? null },
    });
    await tx.framingEvent.create({ data: { checkId, kind: "VALIDACAO_TECNICA", actorType: "ADMIN", actorId: adminId, notes: `${decision}${notes ? `: ${notes.trim()}` : ""}` } });
    await audit({ actorType: "ADMIN", actorId: adminId, action: decision === "VALIDADO" ? "ENQUADRAMENTO_VALIDADO" : "ENQUADRAMENTO_REJEITADO", entity: "FramingCheck", entityId: checkId, before: { technicalStatus: c.technicalStatus }, after: { technicalStatus: decision, notes: notes ?? null } }, tx);
    return updated;
  });
}

// ───────────── listagem / detalhe ─────────────

export interface SessionFilters { campaignId?: string; unitId?: string; status?: FramingStatus; from?: Date; to?: Date; type?: EquipmentType }

export async function listSessions(f: SessionFilters) {
  const where: Prisma.CampaignUnitWhereInput = {
    ...(f.campaignId && { campaignId: f.campaignId }),
    ...(f.unitId && { unitId: f.unitId }),
  };
  const cus = await db.campaignUnit.findMany({
    where,
    include: {
      unit: true, campaign: true,
      session: { include: { checks: true, evidences: true, supports: true } },
    },
    orderBy: { unit: { name: "asc" } },
  });
  return cus
    .filter((cu) => !f.status || cu.session?.checks.some((c) => c.status === f.status && (!f.type || c.type === f.type)))
    .map((cu) => {
      const s = cu.session;
      const op = s
        ? operationalStatus({
            requireTechnicalValidation: cu.campaign.requireTechnicalValidation,
            checks: s.checks.map((c) => ({ type: c.type, status: c.status, technical: c.technicalStatus })),
            evidences: s.evidences.map((e) => ({ type: e.type, kind: e.kind, review: e.review })),
          }).status
        : null;
      return {
        campaignUnitId: cu.id, sessionId: s?.id ?? null, unit: { id: cu.unit.id, code: cu.unit.code, name: cu.unit.name, city: cu.unit.city },
        started: !!s, format: s?.initialFormat ?? null, clientStatus: s?.status ?? null, operational: op,
        checks: s?.checks.map((c) => ({ type: c.type, status: c.status, technical: c.technicalStatus })) ?? [],
        pendingEvidence: s?.evidences.filter((e) => e.review === "PENDENTE").length ?? 0,
        openSupport: s?.supports.filter((x) => x.status !== "RESOLVIDO").length ?? 0,
      };
    });
}

export async function getSessionDetail(sessionId: string) {
  const s = await db.tutorialSession.findUnique({
    where: { id: sessionId },
    include: {
      campaignUnit: { include: { unit: true, campaign: true } },
      stepProgress: { orderBy: { completedAt: "asc" } },
      formatChanges: { orderBy: { at: "asc" } },
      checks: { include: { issues: true, events: { orderBy: { at: "asc" } }, adjustments: { include: { procedure: { select: { title: true, version: true } } } }, technicalBy: { select: { name: true } } } },
      evidences: { orderBy: { uploadedAt: "asc" }, include: { reviewedBy: { select: { name: true } } } },
      supports: { orderBy: { createdAt: "asc" } },
      evaluation: true,
    },
  });
  if (!s) throw notFound();
  const op = operationalStatus({
    requireTechnicalValidation: s.campaignUnit.campaign.requireTechnicalValidation,
    checks: s.checks.map((c) => ({ type: c.type, status: c.status, technical: c.technicalStatus })),
    evidences: s.evidences.map((e) => ({ type: e.type, kind: e.kind, review: e.review })),
  });
  const trail = await db.auditLog.findMany({
    where: { OR: [{ entity: "TutorialSession", entityId: s.id }, { entity: "FramingCheck", entityId: { in: s.checks.map((c) => c.id) } }, { entity: "Evidence", entityId: { in: s.evidences.map((e) => e.id) } }] },
    orderBy: { at: "desc" }, take: 100,
  });
  return { ...s, operational: op, trail };
}

// ───────────── dashboard ─────────────

export interface DashboardFilters { campaignId?: string; unitId?: string; type?: EquipmentType; status?: FramingStatus; from?: Date; to?: Date }

export async function loadDashboard(f: DashboardFilters) {
  const cuWhere: Prisma.CampaignUnitWhereInput = { ...(f.campaignId && { campaignId: f.campaignId }), ...(f.unitId && { unitId: f.unitId }) };
  const eligibleUnits = await db.campaignUnit.count({ where: cuWhere });
  const range = f.from || f.to ? { gte: f.from, lte: f.to } : undefined;

  const sessions = await db.tutorialSession.findMany({
    where: { campaignUnit: cuWhere, ...(range && { startedAt: range }) },
    select: { id: true, initialFormat: true, status: true, campaignUnit: { select: { unitId: true } }, formatChanges: { select: { fromFormat: true } }, supports: { select: { id: true } } },
  });
  const sessionIds = sessions.map((s) => s.id);

  const checks = await db.framingCheck.findMany({
    where: { sessionId: { in: sessionIds }, ...(f.type && { type: f.type }), ...(f.status && { status: f.status }) },
    select: { id: true, sessionId: true, type: true, status: true, technicalStatus: true, session: { select: { campaignUnit: { select: { unitId: true } } } } },
  });
  const checkIds = checks.map((c) => c.id);
  const dateRange = range ? { gte: f.from, lte: f.to } : undefined;

  const [issues, adjustments, correctionEvents, difficultyEvents, supports] = await Promise.all([
    db.framingIssue.findMany({ where: { checkId: { in: checkIds } }, select: { checkId: true, type: true } }),
    db.framingAdjustment.findMany({ where: { checkId: { in: checkIds }, ...(dateRange && { performedAt: dateRange }) }, select: { performedAt: true, adjustmentType: true } }),
    db.framingEvent.findMany({ where: { checkId: { in: checkIds }, kind: "VERIFICACAO", toStatus: "CORRETO", ...(dateRange && { at: dateRange }) }, select: { at: true } }),
    db.framingEvent.findMany({
      where: { checkId: { in: checkIds }, OR: [{ kind: "VERIFICACAO", toStatus: { in: ["INCORRETO", "PRECISA_SUPORTE"] } }, { kind: "SUPORTE" }] },
      select: { stepKey: true, format: true, check: { select: { sessionId: true } } },
    }),
    db.supportRequest.findMany({ where: { sessionId: { in: sessionIds } }, select: { sessionId: true, stepKey: true, format: true } }),
  ]);

  const input: DashboardInput = {
    eligibleUnits,
    sessions: sessions.map((s) => ({
      sessionId: s.id, unitId: s.campaignUnit.unitId, initialFormat: s.initialFormat,
      switched: s.formatChanges.some((c) => c.fromFormat !== null), status: s.status, hasSupport: s.supports.length > 0,
    })),
    checks: checks.map((c) => ({ checkId: c.id, unitId: c.session.campaignUnit.unitId, type: c.type, status: c.status, technical: c.technicalStatus })),
    issues,
    adjustments: adjustments.map((a) => ({ at: a.performedAt, adjustmentType: a.adjustmentType })),
    correctionEvents,
    difficulties: [
      ...difficultyEvents.filter((e) => e.stepKey).map((e) => ({ sessionId: e.check.sessionId, stepKey: e.stepKey!, format: e.format })),
      ...supports.map((s) => ({ sessionId: s.sessionId, stepKey: s.stepKey, format: s.format })),
    ],
  };
  return computeDashboard(input);
}

export async function listAudit(f: { entity?: string; entityId?: string; take?: number }) {
  return db.auditLog.findMany({
    where: { ...(f.entity && { entity: f.entity }), ...(f.entityId && { entityId: f.entityId }) },
    orderBy: { at: "desc" },
    take: Math.min(f.take ?? 100, 500),
  });
}
