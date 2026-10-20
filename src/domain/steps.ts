import type { EquipmentType, StepKind } from "@prisma/client";

export interface StepDef {
  key: string;
  position: number;
  kind: StepKind;
  type?: EquipmentType;
  title: string;
  /** Etapa obrigatória para o cliente concluir o procedimento. */
  required: boolean;
}

/** Fluxo oficial: identificação → formato → totem → enquadramento do totem → painel → enquadramento do painel → fotos → avaliação. */
export const STEP_FLOW: StepDef[] = [
  { key: "identificacao", position: 1, kind: "IDENTIFICACAO", title: "Identificar a unidade", required: true },
  { key: "formato", position: 2, kind: "FORMATO", title: "Escolher o formato do tutorial", required: true },
  { key: "atualizar-totem", position: 3, kind: "ATUALIZACAO", type: "TOTEM", title: "Atualizar o totem", required: true },
  { key: "enquadramento-totem", position: 4, kind: "ENQUADRAMENTO", type: "TOTEM", title: "Verificar o enquadramento da tela do totem", required: true },
  { key: "atualizar-painel", position: 5, kind: "ATUALIZACAO", type: "PAINEL", title: "Atualizar o painel de chamadas", required: true },
  { key: "enquadramento-painel", position: 6, kind: "ENQUADRAMENTO", type: "PAINEL", title: "Verificar o enquadramento da tela do painel", required: true },
  { key: "fotos", position: 7, kind: "FOTOS", title: "Enviar as fotos dos equipamentos", required: true },
  { key: "avaliacao", position: 8, kind: "AVALIACAO", title: "Confirmação e avaliação", required: true },
];

export const STEP_KEYS = STEP_FLOW.map((s) => s.key);

export function getStep(key: string): StepDef | undefined {
  return STEP_FLOW.find((s) => s.key === key);
}

export function nextStepKey(key: string): string | null {
  const i = STEP_FLOW.findIndex((s) => s.key === key);
  return i >= 0 && i < STEP_FLOW.length - 1 ? STEP_FLOW[i + 1].key : null;
}

export function prevStepKey(key: string): string | null {
  const i = STEP_FLOW.findIndex((s) => s.key === key);
  return i > 0 ? STEP_FLOW[i - 1].key : null;
}

export function stepIndex(key: string): number {
  return STEP_FLOW.findIndex((s) => s.key === key);
}
