import type {
  AdjustmentType, EquipmentType, FramingIssueType, FramingStatus, SessionStatus,
  TechnicalValidationStatus, TutorialFormat,
} from "@prisma/client";

/**
 * Cálculo dos indicadores a partir de registros reais.
 * Regras de contagem:
 *  - Universo = unidades elegíveis (CampaignUnit) após os filtros. É o denominador dos percentuais de enquadramento.
 *  - Cada unidade tem UMA sessão. Quem trocou de formato é contado uma única vez, no formato INICIAL escolhido;
 *    `switched` informa quantas trocaram. Assim ninguém é duplicado.
 *  - Dificuldade por formato/etapa conta sessões distintas (não eventos), usando o formato em uso no momento.
 */

export interface SessionRow {
  sessionId: string;
  unitId: string;
  initialFormat: TutorialFormat | null;
  switched: boolean;
  status: SessionStatus;
  hasSupport: boolean;
}
export interface CheckRow {
  checkId: string;
  unitId: string;
  type: EquipmentType;
  status: FramingStatus;
  technical: TechnicalValidationStatus;
}
export interface IssueRow { checkId: string; type: FramingIssueType }
export interface AdjustmentRow { at: Date; adjustmentType: AdjustmentType | null }
export interface CorrectionEventRow { at: Date }
export interface DifficultyRow { sessionId: string; stepKey: string; format: TutorialFormat | null }

export interface DashboardInput {
  eligibleUnits: number;
  sessions: SessionRow[];
  checks: CheckRow[];
  issues: IssueRow[];
  adjustments: AdjustmentRow[];
  correctionEvents: CorrectionEventRow[];
  difficulties: DifficultyRow[];
}

export interface FormatUsage {
  chosen: number;
  completed: number;
  completionRate: number | null;
  withSupport: number;
  supportRate: number | null;
}

export interface Dashboard {
  eligibleUnits: number;
  startedUnits: number;
  framing: {
    cards: {
      totensValidados: number; totensAutodeclaradosCorretos: number;
      paineisValidados: number; paineisAutodeclaradosCorretos: number;
      incorretos: number; ajustesPendentes: number; aguardandoNovaVerificacao: number; precisamSuporte: number;
    };
    correctPercentByType: Record<EquipmentType, { correct: number; validated: number; universe: number; percent: number | null }>;
    issuesByType: { type: FramingIssueType; count: number }[];
    adjustmentsTotal: number;
    adjustmentsByType: { type: AdjustmentType | "NAO_INFORMADO"; count: number }[];
    evolution: { day: string; adjustments: number; corrected: number }[];
  };
  usage: {
    byFormat: Record<TutorialFormat, FormatUsage>;
    noFormatYet: number;
    switched: number;
    difficultSteps: Record<TutorialFormat, { stepKey: string; sessions: number }[]>;
  };
}

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
const day = (d: Date) => d.toISOString().slice(0, 10);

export function computeDashboard(input: DashboardInput): Dashboard {
  const { checks } = input;
  const of = (t: EquipmentType) => checks.filter((c) => c.type === t);
  const correct = (c: CheckRow) => c.status === "CORRETO";
  const validated = (c: CheckRow) => c.status === "CORRETO" && c.technical === "VALIDADO";

  const byType = (t: EquipmentType) => {
    const list = of(t);
    return {
      correct: list.filter(correct).length,
      validated: list.filter(validated).length,
      universe: input.eligibleUnits,
      percent: pct(list.filter(correct).length, input.eligibleUnits),
    };
  };

  const issueCount = new Map<FramingIssueType, number>();
  for (const i of input.issues) issueCount.set(i.type, (issueCount.get(i.type) ?? 0) + 1);

  const adjCount = new Map<AdjustmentType | "NAO_INFORMADO", number>();
  for (const a of input.adjustments) {
    const k = a.adjustmentType ?? "NAO_INFORMADO";
    adjCount.set(k, (adjCount.get(k) ?? 0) + 1);
  }

  const evo = new Map<string, { adjustments: number; corrected: number }>();
  const slot = (k: string) => evo.get(k) ?? evo.set(k, { adjustments: 0, corrected: 0 }).get(k)!;
  for (const a of input.adjustments) slot(day(a.at)).adjustments++;
  for (const e of input.correctionEvents) slot(day(e.at)).corrected++;

  const formats: TutorialFormat[] = ["TEXTO", "VIDEO"];
  const byFormat = {} as Record<TutorialFormat, FormatUsage>;
  const difficultSteps = {} as Record<TutorialFormat, { stepKey: string; sessions: number }[]>;
  for (const f of formats) {
    const ss = input.sessions.filter((s) => s.initialFormat === f);
    const completed = ss.filter((s) => s.status === "CONCLUIDA_PELO_CLIENTE").length;
    const withSupport = ss.filter((s) => s.hasSupport).length;
    byFormat[f] = {
      chosen: ss.length,
      completed,
      completionRate: pct(completed, ss.length),
      withSupport,
      supportRate: pct(withSupport, ss.length),
    };
    const perStep = new Map<string, Set<string>>();
    for (const d of input.difficulties.filter((x) => x.format === f)) {
      (perStep.get(d.stepKey) ?? perStep.set(d.stepKey, new Set()).get(d.stepKey)!).add(d.sessionId);
    }
    difficultSteps[f] = [...perStep.entries()]
      .map(([stepKey, set]) => ({ stepKey, sessions: set.size }))
      .sort((a, b) => b.sessions - a.sessions || a.stepKey.localeCompare(b.stepKey));
  }

  const totens = of("TOTEM");
  const paineis = of("PAINEL");
  return {
    eligibleUnits: input.eligibleUnits,
    startedUnits: input.sessions.length,
    framing: {
      cards: {
        totensValidados: totens.filter(validated).length,
        totensAutodeclaradosCorretos: totens.filter(correct).length,
        paineisValidados: paineis.filter(validated).length,
        paineisAutodeclaradosCorretos: paineis.filter(correct).length,
        incorretos: checks.filter((c) => c.status === "INCORRETO").length,
        ajustesPendentes: checks.filter((c) => c.status === "INCORRETO" || c.status === "PRECISA_SUPORTE").length,
        aguardandoNovaVerificacao: checks.filter((c) => c.status === "AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO").length,
        precisamSuporte: checks.filter((c) => c.status === "PRECISA_SUPORTE").length,
      },
      correctPercentByType: { TOTEM: byType("TOTEM"), PAINEL: byType("PAINEL") },
      issuesByType: [...issueCount.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      adjustmentsTotal: input.adjustments.length,
      adjustmentsByType: [...adjCount.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      evolution: [...evo.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ day: d, ...v })),
    },
    usage: {
      byFormat,
      noFormatYet: input.sessions.filter((s) => s.initialFormat === null).length,
      switched: input.sessions.filter((s) => s.switched).length,
      difficultSteps,
    },
  };
}
