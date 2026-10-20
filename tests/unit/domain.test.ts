import { describe, expect, it } from "vitest";
import { applyAdjustmentDone, applySupportRequest, applyVerification, FramingTransitionError } from "@/domain/framing";
import { normalizeHostname, validateVideoUrl } from "@/domain/video-url";
import { sniffImage } from "@/domain/upload";
import { operationalStatus } from "@/domain/completion";
import { computeDashboard } from "@/domain/metrics";
import { nextStepKey, prevStepKey, STEP_FLOW } from "@/domain/steps";

describe("fluxo de etapas", () => {
  it("segue a ordem definida: totem → enquadramento totem → painel → enquadramento painel → fotos → avaliação", () => {
    expect(STEP_FLOW.map((s) => s.key)).toEqual([
      "identificacao", "formato", "atualizar-totem", "enquadramento-totem",
      "atualizar-painel", "enquadramento-painel", "fotos", "avaliacao",
    ]);
    expect(nextStepKey("formato")).toBe("atualizar-totem");
    expect(nextStepKey("avaliacao")).toBeNull();
    expect(prevStepKey("identificacao")).toBeNull();
  });
});

describe("máquina de estados do enquadramento", () => {
  it("correto não admite cortes informados", () => {
    expect(() => applyVerification("CORRETO", true)).toThrow(FramingTransitionError);
    expect(applyVerification("CORRETO", false).status).toBe("CORRETO");
  });
  it("incorreto gera correção pendente", () => {
    const s = applyVerification("INCORRETO", true);
    expect(s).toMatchObject({ status: "INCORRETO", needsCorrection: true, correctionStatus: "PENDENTE" });
  });
  it("ajuste só a partir de problema aberto", () => {
    expect(() => applyAdjustmentDone("CORRETO")).toThrow(FramingTransitionError);
    expect(() => applyAdjustmentDone("NAO_VERIFICADO")).toThrow(FramingTransitionError);
    expect(applyAdjustmentDone("INCORRETO").status).toBe("AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO");
  });
  it("suporte exige verificação prévia", () => {
    expect(() => applySupportRequest("NAO_VERIFICADO")).toThrow(FramingTransitionError);
    expect(applySupportRequest("INCORRETO").status).toBe("PRECISA_SUPORTE");
  });
});

describe("validação de URL de vídeo", () => {
  const allowed = ["videos.intelite.com.br", "player.vimeo.com"];
  it("aceita domínio autorizado e subdomínios", () => {
    expect(validateVideoUrl("https://videos.intelite.com.br/a.mp4", allowed)).toMatchObject({ ok: true, direct: true });
    expect(validateVideoUrl("https://cdn.videos.intelite.com.br/x", allowed)).toMatchObject({ ok: true, direct: false });
  });
  it.each([
    "http://videos.intelite.com.br/a.mp4",
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "https://evil.com/a.mp4",
    "https://videos.intelite.com.br.evil.com/a.mp4",
    "https://evilvideos.intelite.com.br.attacker.io/a",
    "https://user:pw@videos.intelite.com.br/a.mp4",
    "https://videos.intelite.com.br:8443/a.mp4",
    "não é url",
  ])("rejeita %s", (u) => {
    expect(validateVideoUrl(u, allowed).ok).toBe(false);
  });
  it("não trata 'notintelite' como subdomínio", () => {
    expect(validateVideoUrl("https://xvideos.intelite.com.br/a", ["videos.intelite.com.br"]).ok).toBe(false);
  });
  it("normaliza domínios", () => {
    expect(normalizeHostname(" Videos.Intelite.com.br ")).toBe("videos.intelite.com.br");
    expect(normalizeHostname("https://x.com/a")).toBeNull();
  });
});

describe("upload de imagem", () => {
  it("detecta tipo pelos bytes, ignorando o nome", () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });
});

describe("conclusão operacional", () => {
  const ev = (type: "TOTEM" | "PAINEL", review: "PENDENTE" | "ACEITA" | "NOVA_FOTO_SOLICITADA" = "PENDENTE") =>
    ({ type, kind: "ENQUADRAMENTO" as const, review });
  const chk = (type: "TOTEM" | "PAINEL", technical: "PENDENTE" | "VALIDADO" | "REJEITADO", status = "CORRETO" as const) =>
    ({ type, status, technical });

  it("autodeclaração + foto NÃO bastam quando há exigência de validação técnica", () => {
    const r = operationalStatus({
      requireTechnicalValidation: true,
      checks: [chk("TOTEM", "PENDENTE"), chk("PAINEL", "PENDENTE")],
      evidences: [ev("TOTEM"), ev("PAINEL")],
    });
    expect(r.status).toBe("AGUARDANDO_VALIDACAO_TECNICA");
  });
  it("conclui somente com validação técnica dos dois equipamentos", () => {
    const base = { requireTechnicalValidation: true, evidences: [ev("TOTEM"), ev("PAINEL")] };
    expect(operationalStatus({ ...base, checks: [chk("TOTEM", "VALIDADO"), chk("PAINEL", "PENDENTE")] }).status).toBe("AGUARDANDO_VALIDACAO_TECNICA");
    expect(operationalStatus({ ...base, checks: [chk("TOTEM", "VALIDADO"), chk("PAINEL", "VALIDADO")] }).status).toBe("CONCLUIDA_OPERACIONALMENTE");
  });
  it("política sem validação técnica conclui com autodeclaração e fotos", () => {
    const r = operationalStatus({
      requireTechnicalValidation: false,
      checks: [chk("TOTEM", "PENDENTE"), chk("PAINEL", "PENDENTE")],
      evidences: [ev("TOTEM"), ev("PAINEL")],
    });
    expect(r.status).toBe("CONCLUIDA_OPERACIONALMENTE");
  });
  it("foto recusada exige nova foto", () => {
    const r = operationalStatus({
      requireTechnicalValidation: true,
      checks: [chk("TOTEM", "VALIDADO"), chk("PAINEL", "VALIDADO")],
      evidences: [ev("TOTEM", "NOVA_FOTO_SOLICITADA"), ev("PAINEL")],
    });
    expect(r.status).toBe("EM_ANDAMENTO");
    expect(r.pending[0]).toMatch(/nova foto do totem/i);
  });
  it("enquadramento incorreto gera pendência", () => {
    const r = operationalStatus({
      requireTechnicalValidation: true,
      checks: [chk("TOTEM", "PENDENTE", "INCORRETO" as never), chk("PAINEL", "VALIDADO")],
      evidences: [ev("TOTEM"), ev("PAINEL")],
    });
    expect(r.status).toBe("PENDENCIAS");
  });
});

describe("indicadores", () => {
  it("não duplica quem trocou de formato e conta pelo formato inicial", () => {
    const d = computeDashboard({
      eligibleUnits: 10,
      sessions: [
        { sessionId: "a", unitId: "1", initialFormat: "VIDEO", switched: true, status: "CONCLUIDA_PELO_CLIENTE", hasSupport: false },
        { sessionId: "b", unitId: "2", initialFormat: "TEXTO", switched: false, status: "EM_ANDAMENTO", hasSupport: true },
        { sessionId: "c", unitId: "3", initialFormat: null, switched: false, status: "EM_ANDAMENTO", hasSupport: false },
      ],
      checks: [],
      issues: [],
      adjustments: [],
      correctionEvents: [],
      difficulties: [
        // mesma sessão, mesma etapa, 2 eventos → conta 1
        { sessionId: "a", stepKey: "enquadramento-totem", format: "VIDEO" },
        { sessionId: "a", stepKey: "enquadramento-totem", format: "VIDEO" },
        { sessionId: "a", stepKey: "enquadramento-totem", format: "TEXTO" }, // trocou: dificuldade registrada no formato da hora
      ],
    });
    expect(d.usage.byFormat.VIDEO).toMatchObject({ chosen: 1, completed: 1, completionRate: 100, supportRate: 0 });
    expect(d.usage.byFormat.TEXTO).toMatchObject({ chosen: 1, completed: 0, completionRate: 0, supportRate: 100 });
    expect(d.usage.switched).toBe(1);
    expect(d.usage.noFormatYet).toBe(1);
    expect(d.usage.byFormat.VIDEO.chosen + d.usage.byFormat.TEXTO.chosen + d.usage.noFormatYet).toBe(d.startedUnits);
    expect(d.usage.difficultSteps.VIDEO).toEqual([{ stepKey: "enquadramento-totem", sessions: 1 }]);
  });

  it("percentual de enquadramento usa o universo elegível como denominador e distingue validado de autodeclarado", () => {
    const d = computeDashboard({
      eligibleUnits: 4,
      sessions: [],
      checks: [
        { checkId: "1", unitId: "1", type: "TOTEM", status: "CORRETO", technical: "VALIDADO" },
        { checkId: "2", unitId: "2", type: "TOTEM", status: "CORRETO", technical: "PENDENTE" },
        { checkId: "3", unitId: "3", type: "TOTEM", status: "INCORRETO", technical: "PENDENTE" },
        { checkId: "4", unitId: "1", type: "PAINEL", status: "AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO", technical: "PENDENTE" },
        { checkId: "5", unitId: "2", type: "PAINEL", status: "PRECISA_SUPORTE", technical: "PENDENTE" },
      ],
      issues: [{ checkId: "3", type: "TEXTO_CORTADO" }, { checkId: "3", type: "BOTAO_CORTADO" }, { checkId: "5", type: "TEXTO_CORTADO" }],
      adjustments: [{ at: new Date("2026-03-02T10:00:00Z"), adjustmentType: "ESCALA" }],
      correctionEvents: [{ at: new Date("2026-03-02T11:00:00Z") }, { at: new Date("2026-03-03T11:00:00Z") }],
      difficulties: [],
    });
    const f = d.framing;
    expect(f.cards.totensValidados).toBe(1);
    expect(f.cards.totensAutodeclaradosCorretos).toBe(2);
    expect(f.correctPercentByType.TOTEM.percent).toBe(50);
    expect(f.correctPercentByType.PAINEL.percent).toBe(0);
    expect(f.cards.aguardandoNovaVerificacao).toBe(1);
    expect(f.cards.precisamSuporte).toBe(1);
    expect(f.issuesByType[0]).toEqual({ type: "TEXTO_CORTADO", count: 2 });
    expect(f.evolution).toEqual([
      { day: "2026-03-02", adjustments: 1, corrected: 1 },
      { day: "2026-03-03", adjustments: 0, corrected: 1 },
    ]);
  });

  it("devolve null (não 0%) quando não há universo", () => {
    const d = computeDashboard({ eligibleUnits: 0, sessions: [], checks: [], issues: [], adjustments: [], correctionEvents: [], difficulties: [] });
    expect(d.framing.correctPercentByType.TOTEM.percent).toBeNull();
    expect(d.usage.byFormat.TEXTO.completionRate).toBeNull();
  });
});
