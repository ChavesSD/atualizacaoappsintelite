import type {
  EquipmentType, FramingIssueType, Prisma, TutorialFormat,
} from "@prisma/client";
import { db, type Tx } from "../db";
import { audit } from "../audit";
import { badRequest, conflict, forbidden, notFound } from "../http";
import { STEP_FLOW, getStep, stepIndex } from "@/domain/steps";
import {
  applyAdjustmentDone, applySupportRequest, applyVerification, type VerificationOutcome,
} from "@/domain/framing";
import { clientPendencies, operationalStatus, usableEvidence } from "@/domain/completion";
import { MAX_UPLOAD_BYTES, sniffImage } from "@/domain/upload";
import { storage } from "../storage";
import crypto from "node:crypto";

const TYPES: EquipmentType[] = ["TOTEM", "PAINEL"];
const checkStep = (t: EquipmentType) => (t === "TOTEM" ? "enquadramento-totem" : "enquadramento-painel");

// ───────────── sessão ─────────────

/** Uma sessão por unidade/campanha. Idempotente: nunca duplica, mesmo com cliques repetidos ou várias abas. */
export async function getOrCreateSession(campaignUnitId: string) {
  const cu = await db.campaignUnit.findUnique({ where: { id: campaignUnitId } });
  if (!cu) throw notFound("Unidade não encontrada nesta campanha.");
  return db.$transaction(async (tx) => {
    let s = await tx.tutorialSession.findUnique({ where: { campaignUnitId } });
    if (!s) {
      s = await tx.tutorialSession.create({ data: { campaignUnitId } });
      await audit({ actorType: "CLIENTE", actorId: campaignUnitId, action: "SESSAO_INICIADA", entity: "TutorialSession", entityId: s.id }, tx);
    }
    for (const type of TYPES) {
      const eq = await tx.unitEquipment.upsert({
        where: { unitId_type: { unitId: cu.unitId, type } },
        update: {},
        create: { unitId: cu.unitId, type },
      });
      await tx.framingCheck.upsert({
        where: { sessionId_unitEquipmentId: { sessionId: s.id, unitEquipmentId: eq.id } },
        update: {},
        create: { sessionId: s.id, unitEquipmentId: eq.id, type },
      });
    }
    return s;
  });
}

async function loadCheck(tx: Tx | typeof db, sessionId: string, type: EquipmentType) {
  const c = await tx.framingCheck.findFirst({
    where: { sessionId, type },
    include: { equipment: true, issues: true },
  });
  if (!c) throw notFound("Equipamento não encontrado na sessão.");
  return c;
}

// ───────────── estado entregue ao cliente ─────────────

export async function getClientState(campaignUnitId: string) {
  const session = await getOrCreateSession(campaignUnitId);
  const full = await db.tutorialSession.findUniqueOrThrow({
    where: { id: session.id },
    include: {
      campaignUnit: { include: { unit: true, campaign: true } },
      stepProgress: true,
      checks: { include: { issues: true, equipment: true } },
      evidences: { orderBy: { uploadedAt: "asc" } },
      evaluation: true,
    },
  });
  const done = new Set(full.stepProgress.map((p) => p.stepKey));
  const reachable = reachableIndex(done);
  const checks = full.checks.map((c) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    hasCutoff: c.hasCutoff,
    needsCorrection: c.needsCorrection,
    correctionStatus: c.correctionStatus,
    customerNotes: c.customerNotes,
    verifiedAt: c.verifiedAt,
    // Autodeclaração (acima) e validação técnica (abaixo) são exibidas separadamente.
    technicalStatus: c.technicalStatus,
    technicalNotes: c.technicalStatus === "REJEITADO" ? c.technicalNotes : null,
    openIssues: c.issues.filter((i) => !i.resolvedAt).map((i) => i.type),
    modelId: c.equipment.modelId,
  }));
  const evidences = full.evidences.map((e) => ({
    id: e.id, type: e.type, kind: e.kind, uploadedAt: e.uploadedAt, review: e.review,
    reviewReason: e.review === "NOVA_FOTO_SOLICITADA" ? e.reviewReason : null,
  }));
  const snapChecks = full.checks.map((c) => ({ type: c.type, status: c.status, technical: c.technicalStatus }));
  const snapEv = full.evidences.map((e) => ({ type: e.type, kind: e.kind, review: e.review }));
  const op = operationalStatus({
    requireTechnicalValidation: full.campaignUnit.campaign.requireTechnicalValidation,
    checks: snapChecks,
    evidences: snapEv,
  });
  const photoRequests = TYPES.filter(
    (t) =>
      usableEvidence(snapEv, t, "ENQUADRAMENTO").length === 0 &&
      snapEv.some((e) => e.type === t && e.review === "NOVA_FOTO_SOLICITADA"),
  );
  return {
    unit: { name: full.campaignUnit.unit.name, code: full.campaignUnit.unit.code, city: full.campaignUnit.unit.city },
    campaign: { name: full.campaignUnit.campaign.name },
    session: {
      id: full.id,
      initialFormat: full.initialFormat,
      currentFormat: full.currentFormat,
      currentStepKey: full.currentStepKey,
      status: full.status,
    },
    steps: STEP_FLOW.map((s, i) => ({
      key: s.key, title: s.title, kind: s.kind, type: s.type ?? null,
      completed: done.has(s.key),
      reachable: i <= reachable || (s.key === "fotos" && photoRequests.length > 0),
    })),
    checks,
    evidences,
    photoRequests,
    pendencies: clientPendencies({ checks: snapChecks, evidences: snapEv }),
    operational: op,
    evaluation: full.evaluation ? { rating: full.evaluation.rating } : null,
  };
}

/** Maior índice acessível: a primeira etapa obrigatória ainda não concluída. */
function reachableIndex(done: Set<string>): number {
  const i = STEP_FLOW.findIndex((s) => s.required && !done.has(s.key));
  return i === -1 ? STEP_FLOW.length - 1 : i;
}

export async function goToStep(campaignUnitId: string, key: string) {
  const step = getStep(key);
  if (!step) throw badRequest("Etapa desconhecida.");
  const state = await getClientState(campaignUnitId);
  const s = state.steps.find((x) => x.key === key)!;
  if (!s.reachable) throw conflict("Conclua as etapas anteriores antes de avançar.");
  await db.tutorialSession.update({ where: { id: state.session.id }, data: { currentStepKey: key } });
  return { currentStepKey: key };
}

// ───────────── formato do tutorial ─────────────

/** Define o formato inicial ou troca de formato sem perder progresso nem criar nova sessão. */
export async function setFormat(campaignUnitId: string, format: TutorialFormat) {
  const session = await getOrCreateSession(campaignUnitId);
  return db.$transaction(async (tx) => {
    const cur = await tx.tutorialSession.findUniqueOrThrow({ where: { id: session.id } });
    if (cur.currentFormat === format) return { initialFormat: cur.initialFormat, currentFormat: format, changed: false };
    await tx.tutorialSession.update({
      where: { id: cur.id },
      data: { currentFormat: format, initialFormat: cur.initialFormat ?? format },
    });
    await tx.formatChange.create({ data: { sessionId: cur.id, fromFormat: cur.currentFormat, toFormat: format, stepKey: cur.currentStepKey } });
    await audit(
      { actorType: "CLIENTE", actorId: campaignUnitId, action: cur.currentFormat ? "FORMATO_ALTERADO" : "FORMATO_ESCOLHIDO", entity: "TutorialSession", entityId: cur.id, before: { format: cur.currentFormat }, after: { format } },
      tx,
    );
    return { initialFormat: cur.initialFormat ?? format, currentFormat: format, changed: true };
  });
}

// ───────────── conclusão de etapas ─────────────

export async function completeStep(campaignUnitId: string, key: string) {
  const step = getStep(key);
  if (!step) throw badRequest("Etapa desconhecida.");
  if (step.kind === "AVALIACAO") throw badRequest("A avaliação é concluída ao enviá-la.");
  const state = await getClientState(campaignUnitId);
  const me = state.steps.find((s) => s.key === key)!;
  if (!me.reachable) throw conflict("Conclua as etapas anteriores antes desta.");

  // A conclusão depende das verificações operacionais, nunca de assistir ao vídeo inteiro.
  if (step.kind === "FORMATO" && !state.session.currentFormat) throw conflict("Escolha o formato do tutorial.");
  if (step.kind === "ENQUADRAMENTO") {
    const c = state.checks.find((x) => x.type === step.type)!;
    if (c.status === "NAO_VERIFICADO") throw conflict("Faça a verificação visual antes de concluir esta etapa.");
    if (c.status === "INCORRETO" || c.status === "AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO")
      throw conflict("Há um problema de enquadramento em aberto. Corrija e verifique novamente, ou peça suporte.");
  }
  if (step.kind === "FOTOS") {
    const missing = clientPendencies({
      checks: state.checks.map((c) => ({ type: c.type, status: c.status, technical: c.technicalStatus })),
      evidences: state.evidences.map((e) => ({ type: e.type, kind: e.kind, review: e.review })),
    }).filter((p) => /foto/i.test(p));
    if (missing.length) throw conflict(missing[0]);
  }

  await db.$transaction(async (tx) => {
    await tx.stepProgress.upsert({
      where: { sessionId_stepKey: { sessionId: state.session.id, stepKey: key } },
      update: {},
      create: { sessionId: state.session.id, stepKey: key, format: state.session.currentFormat },
    });
    const next = STEP_FLOW[stepIndex(key) + 1]?.key;
    if (next) await tx.tutorialSession.update({ where: { id: state.session.id }, data: { currentStepKey: next } });
  });
  return getClientState(campaignUnitId);
}

// ───────────── enquadramento ─────────────

export interface VerificationInput {
  outcome: VerificationOutcome;
  criteria: { criterionId: string; ok: boolean }[];
  issues: { type: FramingIssueType; detail?: string }[];
  notes?: string;
}

export async function submitVerification(campaignUnitId: string, type: EquipmentType, input: VerificationInput) {
  const session = await getOrCreateSession(campaignUnitId);
  const sess = await db.tutorialSession.findUniqueOrThrow({ where: { id: session.id } });
  await db.$transaction(async (tx) => {
    const check = await loadCheck(tx, session.id, type);
    const criteria = await tx.framingCriterion.findMany({
      where: { type, active: true, OR: [{ modelId: null }, { modelId: check.equipment.modelId ?? "__none__" }] },
    });
    const answers = new Map(input.criteria.map((c) => [c.criterionId, c.ok]));
    if (input.outcome === "CORRETO") {
      const failing = criteria.filter((c) => c.required && answers.get(c.id) !== true);
      if (failing.length) throw badRequest("Confirme todos os itens obrigatórios da verificação antes de declarar o enquadramento correto.");
      if (input.issues.length) throw badRequest("Não informe problemas ao declarar o enquadramento correto.");
    } else if (input.issues.length === 0) {
      throw badRequest("Informe ao menos um problema de exibição observado.");
    }

    const hasCutoff = input.outcome !== "CORRETO";
    const next = applyVerification(input.outcome, hasCutoff);
    const attempt = check.verificationCount + 1;

    // problemas: ao declarar correto, encerra os abertos; senão, registra os novos sem duplicar os já abertos
    const now = new Date();
    if (input.outcome === "CORRETO") {
      await tx.framingIssue.updateMany({ where: { checkId: check.id, resolvedAt: null }, data: { resolvedAt: now } });
    } else {
      const open = new Set(check.issues.filter((i) => !i.resolvedAt).map((i) => i.type));
      const submitted = new Set(input.issues.map((i) => i.type));
      await tx.framingIssue.updateMany({
        where: { checkId: check.id, resolvedAt: null, type: { notIn: [...submitted] } },
        data: { resolvedAt: now },
      });
      for (const i of input.issues) {
        if (!open.has(i.type)) await tx.framingIssue.create({ data: { checkId: check.id, type: i.type, detail: i.detail?.slice(0, 500) } });
      }
    }
    if (criteria.length) {
      await tx.framingCriterionResponse.createMany({
        data: criteria.map((c) => ({ checkId: check.id, criterionId: c.id, ok: answers.get(c.id) === true, attempt })),
      });
    }
    await tx.framingCheck.update({
      where: { id: check.id },
      data: {
        ...next,
        customerNotes: input.notes?.slice(0, 1000) ?? null,
        verifiedAt: now,
        verificationCount: attempt,
        // Qualquer nova verificação invalida a validação técnica anterior (o histórico fica nos eventos).
        technicalStatus: "PENDENTE",
        technicalById: null,
        technicalAt: null,
      },
    });
    await tx.framingEvent.create({
      data: {
        checkId: check.id, kind: "VERIFICACAO", fromStatus: check.status, toStatus: next.status,
        actorType: "CLIENTE", actorId: campaignUnitId, notes: input.notes?.slice(0, 1000),
        format: sess.currentFormat, stepKey: checkStep(type),
      },
    });
    if (next.status === "INCORRETO" || next.status === "PRECISA_SUPORTE") {
      await tx.stepProgress.deleteMany({ where: { sessionId: session.id, stepKey: checkStep(type) } });
    }
    if (check.technicalStatus !== "PENDENTE") {
      await audit({ actorType: "SISTEMA", action: "VALIDACAO_TECNICA_INVALIDADA", entity: "FramingCheck", entityId: check.id, before: { technicalStatus: check.technicalStatus } }, tx);
    }
    await audit(
      { actorType: "CLIENTE", actorId: campaignUnitId, action: "ENQUADRAMENTO_VERIFICADO", entity: "FramingCheck", entityId: check.id, before: { status: check.status }, after: { status: next.status, issues: input.issues.map((i) => i.type) } },
      tx,
    );
  });
  return getClientState(campaignUnitId);
}

export async function markAdjustmentDone(campaignUnitId: string, type: EquipmentType, input: { procedureId?: string; notes?: string }) {
  const session = await getOrCreateSession(campaignUnitId);
  const sess = await db.tutorialSession.findUniqueOrThrow({ where: { id: session.id } });
  await db.$transaction(async (tx) => {
    const check = await loadCheck(tx, session.id, type);
    const next = applyAdjustmentDone(check.status);
    let adjustmentType = null;
    if (input.procedureId) {
      const p = await tx.correctionProcedure.findUnique({ where: { id: input.procedureId } });
      if (!p || p.status !== "PUBLICADO" || p.type !== type) throw badRequest("Procedimento inválido para este equipamento.");
      adjustmentType = p.adjustmentType;
    }
    await tx.framingAdjustment.create({
      data: { checkId: check.id, procedureId: input.procedureId, adjustmentType, notes: input.notes?.slice(0, 1000) },
    });
    await tx.framingCheck.update({ where: { id: check.id }, data: { ...next, technicalStatus: "PENDENTE", technicalById: null, technicalAt: null } });
    await tx.framingEvent.create({
      data: {
        checkId: check.id, kind: "AJUSTE", fromStatus: check.status, toStatus: next.status, actorType: "CLIENTE",
        actorId: campaignUnitId, notes: input.notes?.slice(0, 1000), format: sess.currentFormat, stepKey: checkStep(type),
      },
    });
    await tx.stepProgress.deleteMany({ where: { sessionId: session.id, stepKey: checkStep(type) } });
    await audit(
      { actorType: "CLIENTE", actorId: campaignUnitId, action: "AJUSTE_REALIZADO", entity: "FramingCheck", entityId: check.id, before: { status: check.status }, after: { status: next.status, procedureId: input.procedureId ?? null } },
      tx,
    );
  });
  return getClientState(campaignUnitId);
}

// ───────────── suporte ─────────────

export async function requestSupport(campaignUnitId: string, input: { stepKey: string; type?: EquipmentType; message?: string }) {
  if (!getStep(input.stepKey)) throw badRequest("Etapa desconhecida.");
  const session = await getOrCreateSession(campaignUnitId);
  const sess = await db.tutorialSession.findUniqueOrThrow({ where: { id: session.id } });
  await db.$transaction(async (tx) => {
    await tx.supportRequest.create({
      data: { sessionId: session.id, stepKey: input.stepKey, type: input.type, format: sess.currentFormat, message: input.message?.slice(0, 1000) },
    });
    if (input.type) {
      const check = await loadCheck(tx, session.id, input.type);
      if (check.status !== "NAO_VERIFICADO" && check.status !== "CORRETO") {
        const next = applySupportRequest(check.status);
        await tx.framingCheck.update({ where: { id: check.id }, data: next });
        await tx.framingEvent.create({
          data: { checkId: check.id, kind: "SUPORTE", fromStatus: check.status, toStatus: next.status, actorType: "CLIENTE", actorId: campaignUnitId, notes: input.message?.slice(0, 1000), format: sess.currentFormat, stepKey: input.stepKey },
        });
      }
    }
    await audit({ actorType: "CLIENTE", actorId: campaignUnitId, action: "SUPORTE_SOLICITADO", entity: "TutorialSession", entityId: session.id, after: { stepKey: input.stepKey, type: input.type ?? null } }, tx);
  });
  return getClientState(campaignUnitId);
}

// ───────────── evidências ─────────────

export async function uploadEvidence(campaignUnitId: string, type: EquipmentType, bytes: Buffer) {
  if (bytes.length === 0) throw badRequest("Arquivo vazio.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw badRequest("A imagem excede o limite de 12 MB.");
  const sniff = sniffImage(bytes);
  if (!sniff) throw badRequest("Envie uma imagem JPEG, PNG ou WebP.");
  const session = await getOrCreateSession(campaignUnitId);
  const check = await loadCheck(db, session.id, type);
  if (check.status === "NAO_VERIFICADO") throw conflict("Verifique o enquadramento antes de enviar a foto.");
  const count = await db.evidence.count({ where: { sessionId: session.id, type } });
  if (count >= 12) throw conflict("Limite de fotos atingido para este equipamento. Fale com o suporte.");

  const key = `evidence/${session.id}/${crypto.randomUUID()}.${sniff.ext}`;
  await storage().put(key, bytes);
  try {
    const ev = await db.$transaction(async (tx) => {
      const e = await tx.evidence.create({
        data: {
          sessionId: session.id, unitEquipmentId: check.unitEquipmentId, checkId: check.id, type, kind: "ENQUADRAMENTO",
          storageKey: key, mime: sniff.mime, sizeBytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        },
      });
      await audit({ actorType: "CLIENTE", actorId: campaignUnitId, action: "EVIDENCIA_ENVIADA", entity: "Evidence", entityId: e.id, after: { type, mime: sniff.mime, sizeBytes: bytes.length } }, tx);
      return e;
    });
    return { id: ev.id };
  } catch (e) {
    await storage().remove(key);
    throw e;
  }
}

export async function getEvidenceFile(id: string, scope: { campaignUnitId?: string }) {
  const ev = await db.evidence.findUnique({ where: { id }, include: { session: true } });
  if (!ev) throw notFound();
  if (scope.campaignUnitId && ev.session.campaignUnitId !== scope.campaignUnitId) throw forbidden();
  const data = await storage().get(ev.storageKey);
  if (!data) throw notFound("Arquivo não encontrado.");
  return { data, mime: ev.mime };
}

// ───────────── avaliação final ─────────────

export async function submitEvaluation(campaignUnitId: string, input: { rating: number; comment?: string; hardestStepKey?: string }) {
  const state = await getClientState(campaignUnitId);
  if (state.pendencies.length) throw conflict(`Ainda há pendências: ${state.pendencies.join(" ")}`);
  if (input.hardestStepKey && !getStep(input.hardestStepKey)) throw badRequest("Etapa desconhecida.");
  const data: Prisma.EvaluationUncheckedCreateInput = {
    sessionId: state.session.id, rating: input.rating, comment: input.comment?.slice(0, 2000), hardestStepKey: input.hardestStepKey,
  };
  await db.$transaction(async (tx) => {
    await tx.evaluation.upsert({ where: { sessionId: state.session.id }, update: { rating: data.rating, comment: data.comment, hardestStepKey: data.hardestStepKey }, create: data });
    await tx.stepProgress.upsert({
      where: { sessionId_stepKey: { sessionId: state.session.id, stepKey: "avaliacao" } },
      update: {},
      create: { sessionId: state.session.id, stepKey: "avaliacao", format: state.session.currentFormat },
    });
    if (state.session.status !== "CONCLUIDA_PELO_CLIENTE") {
      await tx.tutorialSession.update({ where: { id: state.session.id }, data: { status: "CONCLUIDA_PELO_CLIENTE", completedAt: new Date(), currentStepKey: "avaliacao" } });
    }
    await audit({ actorType: "CLIENTE", actorId: campaignUnitId, action: "AVALIACAO_ENVIADA", entity: "TutorialSession", entityId: state.session.id, after: { rating: input.rating } }, tx);
  });
  return getClientState(campaignUnitId);
}
