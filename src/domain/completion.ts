import type { EquipmentType, EvidenceKind, EvidenceReview, FramingStatus, TechnicalValidationStatus } from "@prisma/client";

export interface CheckSnap {
  type: EquipmentType;
  status: FramingStatus;
  technical: TechnicalValidationStatus;
}
export interface EvidenceSnap {
  type: EquipmentType;
  kind: EvidenceKind;
  review: EvidenceReview;
}

export type OperationalStatus = "EM_ANDAMENTO" | "AGUARDANDO_VALIDACAO_TECNICA" | "PENDENCIAS" | "CONCLUIDA_OPERACIONALMENTE";

export interface CompletionInput {
  requireTechnicalValidation: boolean;
  checks: CheckSnap[];
  evidences: EvidenceSnap[];
}

const TYPES: EquipmentType[] = ["TOTEM", "PAINEL"];
const label = (t: EquipmentType) => (t === "TOTEM" ? "totem" : "painel");

/** Evidências utilizáveis: desconsidera as que a equipe mandou refazer. */
export function usableEvidence(evidences: EvidenceSnap[], type: EquipmentType, kind: EvidenceKind): EvidenceSnap[] {
  return evidences.filter((e) => e.type === type && e.kind === kind && e.review !== "NOVA_FOTO_SOLICITADA");
}

/** O cliente pode encerrar (enviar a avaliação) quando verificou os dois equipamentos e enviou as fotos exigidas. */
export function clientPendencies(input: Pick<CompletionInput, "checks" | "evidences">): string[] {
  const p: string[] = [];
  for (const t of TYPES) {
    const c = input.checks.find((x) => x.type === t);
    if (!c || c.status === "NAO_VERIFICADO") p.push(`Verificar o enquadramento do ${label(t)}.`);
    if (usableEvidence(input.evidences, t, "ENQUADRAMENTO").length === 0) {
      const refused = input.evidences.some((e) => e.type === t && e.kind === "ENQUADRAMENTO" && e.review === "NOVA_FOTO_SOLICITADA");
      p.push(refused ? `Enviar nova foto do ${label(t)} (a equipe solicitou outra imagem).` : `Enviar a foto do ${label(t)}.`);
    }
  }
  return p;
}

/**
 * Conclusão OPERACIONAL: critério da equipe técnica, distinto da autodeclaração do cliente.
 * Com requireTechnicalValidation, só conclui com validação técnica registrada pela equipe.
 */
export function operationalStatus(input: CompletionInput): { status: OperationalStatus; pending: string[] } {
  const pending = clientPendencies(input);
  if (pending.length > 0) return { status: "EM_ANDAMENTO", pending };

  const issues: string[] = [];
  const awaiting: string[] = [];
  for (const t of TYPES) {
    const c = input.checks.find((x) => x.type === t)!;
    if (c.status !== "CORRETO") {
      issues.push(`Enquadramento do ${label(t)}: ${c.status === "PRECISA_SUPORTE" ? "precisa de suporte" : "ainda não está correto"}.`);
      continue;
    }
    if (input.requireTechnicalValidation) {
      if (c.technical === "REJEITADO") issues.push(`Validação técnica do ${label(t)} rejeitada: nova verificação necessária.`);
      else if (c.technical === "PENDENTE") awaiting.push(`Validação técnica do ${label(t)} pendente.`);
    }
  }
  if (issues.length) return { status: "PENDENCIAS", pending: issues };
  if (awaiting.length) return { status: "AGUARDANDO_VALIDACAO_TECNICA", pending: awaiting };
  return { status: "CONCLUIDA_OPERACIONALMENTE", pending: [] };
}
