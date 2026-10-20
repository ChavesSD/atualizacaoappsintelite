import type { EquipmentType } from "@prisma/client";

/** Aceita "totem"/"painel" (URL) e devolve o enum do banco. */
export function parseType(v: string): EquipmentType | null {
  const u = v.toUpperCase();
  return u === "TOTEM" || u === "PAINEL" ? u : null;
}


/** Filtros do dashboard/listagens a partir da query string. Valores inválidos são ignorados. */
export function parseFilters(url: string) {
  const q = new URL(url).searchParams;
  const date = (k: string, end = false) => {
    const v = q.get(k);
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    const d = new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const status = q.get("status") as import("@prisma/client").FramingStatus | null;
  const valid = ["NAO_VERIFICADO", "CORRETO", "INCORRETO", "AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO", "PRECISA_SUPORTE"];
  return {
    campaignId: q.get("campaignId") || undefined,
    unitId: q.get("unitId") || undefined,
    type: parseType(q.get("type") ?? "") ?? undefined,
    status: status && valid.includes(status) ? status : undefined,
    from: date("from"),
    to: date("to", true),
  };
}
