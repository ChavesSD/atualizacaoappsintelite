import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import {
  addUnitToCampaign, createCampaign, loadDashboard, reviewEvidence, validateFraming, getSessionDetail,
} from "@/lib/services/admin";
import {
  completeStep, getClientState, getEvidenceFile, goToStep, markAdjustmentDone, requestSupport,
  setFormat, submitEvaluation, submitVerification, uploadEvidence,
} from "@/lib/services/session";
import {
  addAllowedHost, createContentDraft, getPublishedStep, publishContent, unpublishContent,
  createProcedureDraft, publishProcedure, getApplicableProcedures,
} from "@/lib/services/content";
import { STEP_FLOW } from "@/domain/steps";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

let adminId: string;
let cuA: string;
let cuB: string;
let criteriaTotem: string[] = [];

beforeAll(async () => {
  const admin = await db.adminUser.create({ data: { email: "t@x.com", name: "Téc", role: "TECNICO", passwordHash: hashPassword("x") } });
  adminId = admin.id;
  for (const s of STEP_FLOW) {
    await db.tutorialStep.create({ data: { key: s.key, position: s.position, title: s.title, kind: s.kind, type: s.type ?? null } });
  }
  for (const type of ["TOTEM", "PAINEL"] as const) {
    for (const [i, label] of ["Nada cortado", "Centralizado"].entries()) {
      const c = await db.framingCriterion.create({ data: { type, label, position: i } });
      if (type === "TOTEM") criteriaTotem.push(c.id);
    }
  }
  const camp = await createCampaign(adminId, { name: "Camp", startsAt: new Date("2026-01-01"), requireTechnicalValidation: true });
  cuA = (await addUnitToCampaign(adminId, camp.id, { code: "A", name: "Unidade A" })).campaignUnitId;
  cuB = (await addUnitToCampaign(adminId, camp.id, { code: "B", name: "Unidade B" })).campaignUnitId;
});

const allOk = (ids: string[]) => ids.map((criterionId) => ({ criterionId, ok: true }));

describe("fluxo completo do cliente e da equipe", () => {
  it("não cria sessões duplicadas", async () => {
    await getClientState(cuA);
    await getClientState(cuA);
    expect(await db.tutorialSession.count({ where: { campaignUnitId: cuA } })).toBe(1);
    expect(await db.framingCheck.count({ where: { session: { campaignUnitId: cuA } } })).toBe(2);
  });

  it("bloqueia pular etapas", async () => {
    await expect(goToStep(cuA, "enquadramento-painel")).rejects.toThrow(/anteriores/);
    await expect(completeStep(cuA, "formato")).rejects.toThrow(/anteriores/);
  });

  it("alterna texto ↔ vídeo preservando progresso, sem duplicar registros", async () => {
    await completeStep(cuA, "identificacao");
    await setFormat(cuA, "VIDEO");
    await completeStep(cuA, "formato");
    await completeStep(cuA, "atualizar-totem");
    await setFormat(cuA, "TEXTO"); // troca no meio do procedimento
    await setFormat(cuA, "TEXTO"); // idempotente
    const s = await getClientState(cuA);
    expect(s.session.initialFormat).toBe("VIDEO");
    expect(s.session.currentFormat).toBe("TEXTO");
    expect(s.session.currentStepKey).toBe("enquadramento-totem");
    expect(s.steps.filter((x) => x.completed).map((x) => x.key)).toEqual(["identificacao", "formato", "atualizar-totem"]);
    expect(await db.tutorialSession.count({ where: { campaignUnitId: cuA } })).toBe(1);
    expect(await db.formatChange.count({ where: { session: { campaignUnitId: cuA } } })).toBe(2);
  });

  it("exige itens obrigatórios para declarar enquadramento correto", async () => {
    await expect(submitVerification(cuA, "TOTEM", { outcome: "CORRETO", criteria: [], issues: [] })).rejects.toThrow(/obrigatórios/);
    await expect(submitVerification(cuA, "TOTEM", { outcome: "INCORRETO", criteria: [], issues: [] })).rejects.toThrow(/ao menos um problema/);
  });

  it("problema gera registro rastreável, reabre a etapa e permite fluxo de correção e nova verificação", async () => {
    let s = await submitVerification(cuA, "TOTEM", { outcome: "INCORRETO", criteria: [], issues: [{ type: "TEXTO_CORTADO" }, { type: "BOTAO_CORTADO" }], notes: "Cortado à direita" });
    expect(s.checks.find((c) => c.type === "TOTEM")).toMatchObject({ status: "INCORRETO", needsCorrection: true, correctionStatus: "PENDENTE" });
    expect(s.checks.find((c) => c.type === "TOTEM")!.openIssues.sort()).toEqual(["BOTAO_CORTADO", "TEXTO_CORTADO"]);
    await expect(completeStep(cuA, "enquadramento-totem")).rejects.toThrow(/em aberto/);

    // procedimento oficial só aparece após cadastro e publicação pela equipe técnica
    expect(await getApplicableProcedures("TOTEM", null, ["TEXTO_CORTADO"])).toEqual([]);
    const draft = await createProcedureDraft(adminId, { type: "TOTEM", adjustmentType: "ESCALA", appliesTo: ["TEXTO_CORTADO"], title: "Ajustar escala", steps: [{ text: "Passo oficial cadastrado" }] });
    expect(await getApplicableProcedures("TOTEM", null, ["TEXTO_CORTADO"])).toEqual([]); // rascunho não aparece
    await publishProcedure(adminId, draft.id);
    const procs = await getApplicableProcedures("TOTEM", null, ["TEXTO_CORTADO"]);
    expect(procs).toHaveLength(1);
    expect(await getApplicableProcedures("TOTEM", null, ["SENHA_CORTADA"])).toEqual([]);

    s = await markAdjustmentDone(cuA, "TOTEM", { procedureId: procs[0].id });
    expect(s.checks.find((c) => c.type === "TOTEM")!.status).toBe("AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO");
    await expect(completeStep(cuA, "enquadramento-totem")).rejects.toThrow(/em aberto/);

    s = await submitVerification(cuA, "TOTEM", { outcome: "CORRETO", criteria: allOk(criteriaTotem), issues: [] });
    expect(s.checks.find((c) => c.type === "TOTEM")).toMatchObject({ status: "CORRETO", openIssues: [] });
    await completeStep(cuA, "enquadramento-totem");

    const adj = await db.framingAdjustment.findMany({ where: { check: { session: { campaignUnitId: cuA }, type: "TOTEM" } } });
    expect(adj).toHaveLength(1);
    expect(adj[0].adjustmentType).toBe("ESCALA");
    const issues = await db.framingIssue.findMany({ where: { check: { session: { campaignUnitId: cuA } } } });
    expect(issues.every((i) => i.resolvedAt)).toBe(true);
  });

  it("painel: verificação correta, fotos validadas pelos bytes", async () => {
    await completeStep(cuA, "atualizar-painel");
    const crit = (await db.framingCriterion.findMany({ where: { type: "PAINEL" } })).map((c) => c.id);
    await submitVerification(cuA, "PAINEL", { outcome: "CORRETO", criteria: allOk(crit), issues: [] });
    await completeStep(cuA, "enquadramento-painel");

    await expect(uploadEvidence(cuA, "TOTEM", Buffer.from("<html>não sou imagem</html>"))).rejects.toThrow(/JPEG, PNG ou WebP/);
    await expect(completeStep(cuA, "fotos")).rejects.toThrow(/foto/i);
    const t = await uploadEvidence(cuA, "TOTEM", PNG);
    await uploadEvidence(cuA, "PAINEL", PNG);
    await completeStep(cuA, "fotos");

    // isolamento: outra unidade não acessa a foto
    await expect(getEvidenceFile(t.id, { campaignUnitId: cuB })).rejects.toThrow();
    expect((await getEvidenceFile(t.id, { campaignUnitId: cuA })).mime).toBe("image/png");
  });

  it("autodeclaração + foto NÃO equivalem a validação técnica", async () => {
    const s = await submitEvaluation(cuA, { rating: 5, hardestStepKey: "enquadramento-totem" });
    expect(s.session.status).toBe("CONCLUIDA_PELO_CLIENTE");
    expect(s.operational.status).toBe("AGUARDANDO_VALIDACAO_TECNICA");
    expect(s.checks.every((c) => c.technicalStatus === "PENDENTE")).toBe(true);
  });

  it("equipe: valida somente após aceitar uma foto; pode pedir nova foto com motivo", async () => {
    const detail = await getSessionDetail((await getClientState(cuA)).session.id);
    const totem = detail.checks.find((c) => c.type === "TOTEM")!;
    const painel = detail.checks.find((c) => c.type === "PAINEL")!;
    await expect(validateFraming(adminId, totem.id, "VALIDADO")).rejects.toThrow(/aceite ao menos uma fotografia/);

    const evT = detail.evidences.find((e) => e.type === "TOTEM")!;
    const evP = detail.evidences.find((e) => e.type === "PAINEL")!;
    await expect(reviewEvidence(adminId, evT.id, "NOVA_FOTO_SOLICITADA", "")).rejects.toThrow(/Explique/);

    await reviewEvidence(adminId, evT.id, "ACEITA");
    await validateFraming(adminId, totem.id, "VALIDADO");
    await reviewEvidence(adminId, evP.id, "ACEITA");
    await validateFraming(adminId, painel.id, "VALIDADO");
    expect((await getClientState(cuA)).operational.status).toBe("CONCLUIDA_OPERACIONALMENTE");

    // nova foto solicitada: perde a validação e o cliente é avisado
    await reviewEvidence(adminId, evP.id, "NOVA_FOTO_SOLICITADA", "A borda direita não aparece na foto.");
    const s = await getClientState(cuA);
    expect(s.operational.status).toBe("EM_ANDAMENTO");
    expect(s.photoRequests).toEqual(["PAINEL"]);
    expect(s.evidences.find((e) => e.id === evP.id)!.reviewReason).toMatch(/borda direita/);
    expect(s.steps.find((x) => x.key === "fotos")!.reachable).toBe(true);
    expect(s.checks.find((c) => c.type === "PAINEL")!.technicalStatus).toBe("PENDENTE");

    await uploadEvidence(cuA, "PAINEL", PNG);
    expect((await getClientState(cuA)).photoRequests).toEqual([]);
  });

  it("nova verificação do cliente invalida a validação técnica anterior", async () => {
    const d = await getSessionDetail((await getClientState(cuA)).session.id);
    const totem = d.checks.find((c) => c.type === "TOTEM")!;
    expect(totem.technicalStatus).toBe("VALIDADO");
    await submitVerification(cuA, "TOTEM", { outcome: "CORRETO", criteria: allOk(criteriaTotem), issues: [] });
    expect((await db.framingCheck.findUniqueOrThrow({ where: { id: totem.id } })).technicalStatus).toBe("PENDENTE");
  });

  it("registra auditoria e histórico imutável", async () => {
    const actions = (await db.auditLog.findMany()).map((a) => a.action);
    for (const a of ["SESSAO_INICIADA", "FORMATO_ESCOLHIDO", "FORMATO_ALTERADO", "ENQUADRAMENTO_VERIFICADO", "AJUSTE_REALIZADO", "EVIDENCIA_ENVIADA", "AVALIACAO_ENVIADA", "ENQUADRAMENTO_VALIDADO", "NOVA_FOTO_SOLICITADA", "VALIDACAO_TECNICA_INVALIDADA"]) {
      expect(actions, a).toContain(a);
    }
    const events = await db.framingEvent.findMany({ where: { check: { session: { campaignUnitId: cuA }, type: "TOTEM" } }, orderBy: { at: "asc" } });
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(["VERIFICACAO", "AJUSTE", "VALIDACAO_TECNICA"]));
    // o evento da primeira verificação guarda o formato em uso (texto/vídeo) para análise de experiência
    expect(events[0].format).toBe("TEXTO");
  });

  it("suporte registra formato em uso e marca equipamento", async () => {
    await getClientState(cuB);
    await completeStep(cuB, "identificacao");
    await setFormat(cuB, "TEXTO");
    await completeStep(cuB, "formato");
    await completeStep(cuB, "atualizar-totem");
    await submitVerification(cuB, "TOTEM", { outcome: "INCORRETO", criteria: [], issues: [{ type: "INTERFACE_DESLOCADA" }] });
    const s = await requestSupport(cuB, { stepKey: "enquadramento-totem", type: "TOTEM", message: "Não consegui" });
    expect(s.checks.find((c) => c.type === "TOTEM")!.status).toBe("PRECISA_SUPORTE");
    const sr = await db.supportRequest.findMany({ where: { session: { campaignUnitId: cuB } } });
    expect(sr[0].format).toBe("TEXTO");
  });

  it("dashboard: universo elegível, sem duplicar quem trocou de formato", async () => {
    const d = await loadDashboard({});
    expect(d.eligibleUnits).toBe(2);
    expect(d.startedUnits).toBe(2);
    expect(d.usage.byFormat.VIDEO.chosen).toBe(1); // A começou em vídeo e trocou
    expect(d.usage.byFormat.TEXTO.chosen).toBe(1);
    expect(d.usage.switched).toBe(1);
    expect(d.usage.byFormat.VIDEO).toMatchObject({ completed: 1, completionRate: 100 });
    expect(d.usage.byFormat.TEXTO).toMatchObject({ completed: 0, withSupport: 1, supportRate: 100 });
    expect(d.framing.cards.precisamSuporte).toBe(1);
    expect(d.framing.cards.totensValidados).toBe(0); // validação do totem foi invalidada pela re-verificação
    expect(d.framing.cards.paineisValidados).toBe(0);
    expect(d.framing.cards.paineisAutodeclaradosCorretos).toBe(1);
    expect(d.framing.correctPercentByType.TOTEM.percent).toBe(50);
    expect(d.framing.issuesByType.map((i) => i.type)).toEqual(expect.arrayContaining(["TEXTO_CORTADO", "INTERFACE_DESLOCADA"]));
    expect(d.framing.adjustmentsTotal).toBe(1);
    // A (que já havia trocado para texto) e B tiveram dificuldade nessa etapa em formato texto: 2 sessões distintas
    expect(d.usage.difficultSteps.TEXTO[0]).toEqual({ stepKey: "enquadramento-totem", sessions: 2 });
    expect(d.usage.difficultSteps.VIDEO).toEqual([]);

    const only = await loadDashboard({ type: "PAINEL" });
    expect(only.framing.cards.totensAutodeclaradosCorretos).toBe(0);
    const byStatus = await loadDashboard({ status: "PRECISA_SUPORTE" });
    expect(byStatus.framing.cards.precisamSuporte).toBe(1);
    const future = await loadDashboard({ from: new Date("2099-01-01") });
    expect(future.startedUnits).toBe(0);
    expect(future.eligibleUnits).toBe(2);
  });
});

describe("conteúdo e vídeos", () => {
  it("rejeita vídeo fora dos domínios autorizados e exige texto para publicar", async () => {
    const base = { stepKey: "atualizar-totem", hasText: true, hasVideo: true, recommendedFormat: "VIDEO" as const, instructions: [{ text: "Passo 1" }], referenceImages: [], video: { title: "V", url: "https://evil.com/a.mp4" } };
    await expect(createContentDraft(adminId, base)).rejects.toThrow(/não autorizado/);
    await addAllowedHost(adminId, "videos.intelite.com.br");
    await expect(createContentDraft(adminId, { ...base, video: { title: "V", url: "http://videos.intelite.com.br/a.mp4" } })).rejects.toThrow(/https/);
    await expect(createContentDraft(adminId, { ...base, hasText: false, video: { title: "V", url: "https://videos.intelite.com.br/a.mp4" } })).resolves.toBeTruthy();
    const noText = await db.stepContent.findFirstOrThrow({ where: { hasText: false } });
    await expect(publishContent(adminId, noText.id)).rejects.toThrow(/instruções escritas/);
  });

  it("publica com versionamento, arquiva a anterior e some o vídeo se o domínio for desautorizado", async () => {
    const mk = (title: string) =>
      createContentDraft(adminId, { stepKey: "atualizar-painel", hasText: true, hasVideo: true, recommendedFormat: "VIDEO", instructions: [{ text: title }], referenceImages: [], video: { title, url: "https://videos.intelite.com.br/p.mp4", thumbnailUrl: "https://videos.intelite.com.br/p.jpg" } });
    const v1 = await mk("v1");
    const v2 = await mk("v2");
    expect([v1.version, v2.version]).toEqual([1, 2]);
    await publishContent(adminId, v1.id);
    await publishContent(adminId, v2.id);
    expect((await db.stepContent.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe("ARQUIVADO");
    let p = await getPublishedStep("atualizar-painel");
    expect(p.content!.version).toBe(2);
    expect(p.video!.direct).toBe(true);

    await db.allowedVideoHost.updateMany({ data: { active: false } });
    p = await getPublishedStep("atualizar-painel");
    expect(p.video).toBeNull(); // texto continua
    expect(p.content!.instructions).toHaveLength(1);

    await unpublishContent(adminId, v2.id);
    expect((await getPublishedStep("atualizar-painel")).content).toBeNull();
  });
});
