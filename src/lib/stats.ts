export interface StatRow {
  status: "EM_ANDAMENTO" | "ENVIADO" | "APROVADO" | "PRECISA_AJUSTE";
  initialFormat: "TEXTO" | "VIDEO" | null;
  formatChanges: number;
  totemFraming: string;
  painelFraming: string;
  totemConfirmed: boolean;
  painelConfirmed: boolean;
  helpRequested: boolean;
  helpResolved: boolean;
  pendingPhotos: number;
}

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

/**
 * Indicadores a partir dos envios reais. Cada envio é UM cliente: quem trocou de formato é contado uma vez,
 * no formato inicial (a quantidade de trocas aparece à parte).
 * "Confirmado" = confirmado pela equipe, não apenas declarado pelo cliente.
 */
export function computeStats(rows: StatRow[]) {
  const total = rows.length;
  const done = (r: StatRow) => r.status === "ENVIADO" || r.status === "APROVADO" || r.status === "PRECISA_AJUSTE";
  const byFormat = (f: "TEXTO" | "VIDEO") => {
    const list = rows.filter((r) => r.initialFormat === f);
    const finished = list.filter(done).length;
    const help = list.filter((r) => r.helpRequested).length;
    return { chosen: list.length, finished, finishRate: pct(finished, list.length), help, helpRate: pct(help, list.length) };
  };
  return {
    total,
    emAndamento: rows.filter((r) => r.status === "EM_ANDAMENTO").length,
    enviados: rows.filter((r) => r.status === "ENVIADO").length,
    aprovados: rows.filter((r) => r.status === "APROVADO").length,
    precisaAjuste: rows.filter((r) => r.status === "PRECISA_AJUSTE").length,
    totem: { confirmados: rows.filter((r) => r.totemConfirmed).length, declaradosCorretos: rows.filter((r) => r.totemFraming === "CORRETO").length, comProblema: rows.filter((r) => r.totemFraming === "INCORRETO").length, suporte: rows.filter((r) => r.totemFraming === "PRECISA_SUPORTE").length },
    painel: { confirmados: rows.filter((r) => r.painelConfirmed).length, declaradosCorretos: rows.filter((r) => r.painelFraming === "CORRETO").length, comProblema: rows.filter((r) => r.painelFraming === "INCORRETO").length, suporte: rows.filter((r) => r.painelFraming === "PRECISA_SUPORTE").length },
    fotosParaAnalisar: rows.reduce((s, r) => s + r.pendingPhotos, 0),
    pedidosDeAjuda: rows.filter((r) => r.helpRequested && !r.helpResolved).length, // em aberto
    formato: { TEXTO: byFormat("TEXTO"), VIDEO: byFormat("VIDEO"), trocaram: rows.filter((r) => r.formatChanges > 0).length, semEscolha: rows.filter((r) => !r.initialFormat).length },
  };
}
export type Stats = ReturnType<typeof computeStats>;
