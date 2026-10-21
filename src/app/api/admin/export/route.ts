import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Protege contra injeção de fórmula: células que começam com = + - @ viram texto. Separador ";" e BOM para abrir direto no Excel pt-BR. */
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toLocaleString("pt-BR") : typeof v === "boolean" ? (v ? "sim" : "não") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET = route(async () => {
  await requireAdmin();
  const rows = await db.submission.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { photos: true } } } });
  const head = ["Início", "Nome", "Empresa", "Status", "Formato inicial", "Formato atual", "Trocas de formato", "Totem atualizado", "Painel atualizado", "Totem (cliente)", "Problemas do totem", "Totem confirmado pela equipe", "Painel (cliente)", "Problemas do painel", "Painel confirmado pela equipe", "Fotos", "Pediu ajuda", "Ajuda atendida", "Nota", "Etapa mais difícil", "Comentário", "Enviado em"];
  const lines = [head.map(cell).join(";")];
  for (const r of rows) {
    lines.push(
      [r.createdAt, r.contactName, r.company, r.status, r.initialFormat, r.format, r.formatChanges, r.totemUpdated, r.painelUpdated, r.totemFraming, r.totemIssues.join(", "), r.totemConfirmed, r.painelFraming, r.painelIssues.join(", "), r.painelConfirmed, r._count.photos, r.helpRequested, r.helpResolved, r.rating, r.hardestStep, r.comment, r.submittedAt]
        .map(cell)
        .join(";"),
    );
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="envios-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
