import type { FramingStatus, CorrectionStatus } from "@prisma/client";

export const FRAMING_STATUS_LABEL: Record<FramingStatus, string> = {
  NAO_VERIFICADO: "Não verificado",
  CORRETO: "Enquadramento correto",
  INCORRETO: "Enquadramento incorreto",
  AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO: "Ajuste realizado, aguardando nova verificação",
  PRECISA_SUPORTE: "Precisa de suporte",
};

export const ISSUE_LABEL: Record<string, string> = {
  TEXTO_CORTADO: "Texto cortado",
  BOTAO_CORTADO: "Botão cortado ou fora da área",
  LOGOTIPO_CORTADO: "Logotipo cortado",
  INTERFACE_DESLOCADA: "Interface deslocada / não centralizada",
  BARRAS_OU_MARGENS: "Barras ou margens inesperadas",
  CONTEUDO_FORA_DA_AREA: "Conteúdo fora da área visível",
  PROPORCAO_INCORRETA: "Proporção incorreta",
  SENHA_CORTADA: "Número da senha cortado",
  IDENTIFICACAO_CORTADA: "Nome/identificação do atendimento cortado",
  OUTRO: "Outro problema de exibição",
};

export type VerificationOutcome = "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE";

export interface FramingState {
  status: FramingStatus;
  needsCorrection: boolean;
  hasCutoff: boolean;
  correctionStatus: CorrectionStatus;
}

export class FramingTransitionError extends Error {}

/** Resultado de uma (re)verificação visual feita pelo cliente. Permitida a partir de qualquer estado. */
export function applyVerification(outcome: VerificationOutcome, hasCutoff: boolean): FramingState {
  if (outcome === "CORRETO") {
    if (hasCutoff) throw new FramingTransitionError("Não é possível declarar o enquadramento correto informando cortes ou desalinhamentos.");
    return { status: "CORRETO", needsCorrection: false, hasCutoff: false, correctionStatus: "NAO_APLICAVEL" };
  }
  if (outcome === "INCORRETO") {
    return { status: "INCORRETO", needsCorrection: true, hasCutoff, correctionStatus: "PENDENTE" };
  }
  return { status: "PRECISA_SUPORTE", needsCorrection: true, hasCutoff, correctionStatus: "PENDENTE" };
}

/** Cliente marca que realizou o ajuste: só quando há problema aberto (INCORRETO ou PRECISA_SUPORTE após orientação). */
export function applyAdjustmentDone(current: FramingStatus): FramingState {
  if (current !== "INCORRETO" && current !== "PRECISA_SUPORTE") {
    throw new FramingTransitionError("Só é possível registrar um ajuste quando existe um problema de enquadramento aberto.");
  }
  return {
    status: "AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO",
    needsCorrection: true,
    hasCutoff: true,
    correctionStatus: "REALIZADA",
  };
}

export function applySupportRequest(current: FramingStatus): FramingState {
  if (current === "NAO_VERIFICADO") {
    throw new FramingTransitionError("Faça a verificação visual antes de solicitar suporte.");
  }
  return { status: "PRECISA_SUPORTE", needsCorrection: true, hasCutoff: true, correctionStatus: "PENDENTE" };
}
