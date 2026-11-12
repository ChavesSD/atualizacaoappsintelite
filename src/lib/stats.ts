export interface StatRow {
  status: "EM_ANDAMENTO" | "ENVIADO" | "APROVADO" | "PRECISA_AJUSTE";
  installed: boolean;
  framing: string;
  confirmed: boolean;
  helpRequested: boolean;
  helpResolved: boolean;
  pendingPhotos: number;
  photoCount: number;
  createdAt?: Date | string;
  submittedAt?: Date | string | null;
}

/**
 * Funil: quantos clientes chegaram a cada etapa, derivado dos campos do envio (nada é estimado).
 * Mostra onde o tutorial perde gente (ex.: muita gente atualiza o app mas não confere a tela).
 */
export function computeFunnel(rows: StatRow[]): { label: string; count: number }[] {
  const stages: [string, (r: StatRow) => boolean][] = [
    ["Iniciaram", () => true],
    ["Atualizaram o aplicativo", (r) => r.installed],
    ["Conferiram a tela", (r) => r.framing !== "NAO_VERIFICADO"],
    ["Enviaram a foto", (r) => r.photoCount >= 1],
    ["Concluíram o envio", (r) => r.status !== "EM_ANDAMENTO"],
  ];
  return stages.map(([label, ok]) => ({ label, count: rows.filter(ok).length }));
}

/** Mediana, em minutos, entre iniciar e concluir (quem ainda não concluiu não entra). null sem dados. */
export function medianMinutes(rows: StatRow[]): number | null {
  const mins = rows
    .filter((r) => r.createdAt && r.submittedAt)
    .map((r) => (new Date(r.submittedAt as string).getTime() - new Date(r.createdAt as string).getTime()) / 60000)
    .filter((m) => m >= 0)
    .sort((a, b) => a - b);
  if (mins.length === 0) return null;
  const mid = Math.floor(mins.length / 2);
  return Math.round(mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2);
}

/** Indicadores a partir dos envios reais. "Confirmado" = confirmado pela equipe, não apenas declarado pelo cliente. */
export function computeStats(rows: StatRow[]) {
  return {
    total: rows.length,
    funil: computeFunnel(rows),
    emAndamento: rows.filter((r) => r.status === "EM_ANDAMENTO").length,
    enviados: rows.filter((r) => r.status === "ENVIADO").length,
    aprovados: rows.filter((r) => r.status === "APROVADO").length,
    precisaAjuste: rows.filter((r) => r.status === "PRECISA_AJUSTE").length,
    tela: {
      confirmadas: rows.filter((r) => r.confirmed).length,
      declaradasCorretas: rows.filter((r) => r.framing === "CORRETO").length,
      comProblema: rows.filter((r) => r.framing === "INCORRETO").length,
      suporte: rows.filter((r) => r.framing === "PRECISA_SUPORTE").length,
    },
    fotosParaAnalisar: rows.reduce((s, r) => s + r.pendingPhotos, 0),
    pedidosDeAjuda: rows.filter((r) => r.helpRequested && !r.helpResolved).length, // em aberto
    tempoMedianoMin: medianMinutes(rows),
  };
}
export type Stats = ReturnType<typeof computeStats>;
