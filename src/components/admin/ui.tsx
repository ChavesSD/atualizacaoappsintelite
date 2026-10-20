"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

export interface Me { id: string; name: string; role: string; canWrite: boolean; isAdmin: boolean }

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>("/api/admin/me").then(setMe).catch(() => {}); }, []);
  return me;
}

export function Kpi({ n, label, sub, tone }: { n: number | string; label: string; sub?: string; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div className="kpi">
      <div className="n" style={tone ? { color: `var(--${tone})` } : undefined}>{n}</div>
      <div className="l">{label}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export function Bars({ items, max, suffix = "", empty = "Sem dados no período." }: { items: { label: string; value: number }[]; max?: number; suffix?: string; empty?: string }) {
  if (items.length === 0) return <p className="muted small">{empty}</p>;
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div role="list">
      {items.map((i) => (
        <div className="bar" role="listitem" key={i.label}>
          <span>{i.label}</span>
          <span className="track"><span className="fill" style={{ width: `${Math.min(100, (i.value / m) * 100)}%`, display: "block" }} /></span>
          <strong>{i.value}{suffix}</strong>
        </div>
      ))}
    </div>
  );
}

/** Linhas simples (SVG) para ajustes realizados × enquadramentos corrigidos por dia. */
export function Evolution({ data }: { data: { day: string; adjustments: number; corrected: number }[] }) {
  if (data.length === 0) return <p className="muted small">Sem dados no período.</p>;
  const W = 560, H = 160, P = 24;
  const max = Math.max(1, ...data.flatMap((d) => [d.adjustments, d.corrected]));
  const x = (i: number) => (data.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (data.length - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = (k: "adjustments" | "corrected") => data.map((d, i) => `${x(i)},${y(d[k])}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução diária de ajustes realizados e enquadramentos corrigidos" style={{ width: "100%", height: "auto" }}>
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--border)" />
        <polyline points={line("adjustments")} fill="none" stroke="var(--warn)" strokeWidth="2.5" />
        <polyline points={line("corrected")} fill="none" stroke="var(--ok)" strokeWidth="2.5" />
        {data.map((d, i) => (
          <g key={d.day}><circle cx={x(i)} cy={y(d.adjustments)} r="3.5" fill="var(--warn)" /><circle cx={x(i)} cy={y(d.corrected)} r="3.5" fill="var(--ok)" />
            {(data.length <= 8 || i % Math.ceil(data.length / 8) === 0) && <text x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="var(--muted)">{d.day.slice(5)}</text>}</g>
        ))}
      </svg>
      <div className="row small"><span style={{ color: "var(--warn)" }}>● Ajustes realizados</span><span style={{ color: "var(--ok)" }}>● Enquadramentos corrigidos</span></div>
      <details><summary className="small muted">Ver em tabela</summary>
        <table><thead><tr><th>Dia</th><th>Ajustes</th><th>Corrigidos</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.adjustments}</td><td>{d.corrected}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}

export const pctText = (v: number | null) => (v === null ? "—" : `${v}%`);

export function Dt({ v }: { v: string | Date | null | undefined }) {
  return <>{v ? new Date(v).toLocaleString("pt-BR") : "—"}</>;
}

export const OP_LABEL: Record<string, { t: string; tone: string }> = {
  EM_ANDAMENTO: { t: "Em andamento", tone: "" },
  AGUARDANDO_VALIDACAO_TECNICA: { t: "Aguardando validação técnica", tone: "warn" },
  PENDENCIAS: { t: "Com pendências", tone: "bad" },
  CONCLUIDA_OPERACIONALMENTE: { t: "Concluída operacionalmente", tone: "ok" },
};
