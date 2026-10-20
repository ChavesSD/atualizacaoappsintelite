"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { OP_LABEL } from "@/components/admin/ui";
import { FRAMING_STATUS_LABEL } from "@/domain/framing";

interface Row {
  campaignUnitId: string; sessionId: string | null; unit: { id: string; code: string; name: string; city: string | null };
  started: boolean; format: "TEXTO" | "VIDEO" | null; clientStatus: string | null; operational: string | null;
  checks: { type: "TOTEM" | "PAINEL"; status: keyof typeof FRAMING_STATUS_LABEL; technical: string }[];
  pendingEvidence: number; openSupport: number;
}
const tone = (s: string) => (s === "CORRETO" ? "ok" : s === "INCORRETO" || s === "PRECISA_SUPORTE" ? "bad" : s === "NAO_VERIFICADO" ? "" : "warn");

export default function UnitsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ unitId: "", status: "", type: "" });
  const [error, setError] = useState<string | null>(null);
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  useEffect(() => { api<Row[]>(`/api/admin/sessions?${qs}`).then(setRows).catch((e) => setError(e.message)); }, [qs]);
  const [allUnits, setAllUnits] = useState<Row["unit"][]>([]);
  useEffect(() => { api<Row[]>("/api/admin/sessions").then((r) => setAllUnits(r.map((x) => x.unit))).catch(() => {}); }, []);

  return (
    <div className="stack">
      <h1>Unidades</h1>
      <div className="card filters">
        <label className="field"><span>Unidade</span><select value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })}><option value="">Todas</option>{allUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label className="field"><span>Situação do enquadramento</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todas</option>{Object.entries(FRAMING_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Equipamento</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">Ambos</option><option value="TOTEM">Totem</option><option value="PAINEL">Painel</option></select></label>
      </div>
      {error && <div className="alert bad">{error}</div>}
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Unidade</th><th>Formato</th><th>Totem</th><th>Painel</th><th>Situação operacional</th><th>Pendências</th><th /></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.campaignUnitId}>
                <td><strong>{r.unit.name}</strong><div className="muted small">{r.unit.code}{r.unit.city ? ` · ${r.unit.city}` : ""}</div></td>
                <td>{r.format === "TEXTO" ? "Texto" : r.format === "VIDEO" ? "Vídeo" : "—"}</td>
                {(["TOTEM", "PAINEL"] as const).map((t) => {
                  const c = r.checks.find((x) => x.type === t);
                  return <td key={t}>{c ? <><span className={`badge ${tone(c.status)}`}>{FRAMING_STATUS_LABEL[c.status]}</span><div className="muted small">Téc.: {c.technical === "VALIDADO" ? "validado" : c.technical === "REJEITADO" ? "rejeitado" : "pendente"}</div></> : "—"}</td>;
                })}
                <td>{r.operational ? <span className={`badge ${OP_LABEL[r.operational].tone}`}>{OP_LABEL[r.operational].t}</span> : <span className="badge">Não iniciada</span>}</td>
                <td className="small">{r.pendingEvidence > 0 && <div>{r.pendingEvidence} foto(s) a analisar</div>}{r.openSupport > 0 && <div>{r.openSupport} suporte(s) aberto(s)</div>}</td>
                <td>{r.sessionId && <Link className="btn sm" href={`/admin/unidades/${r.sessionId}`}>Abrir</Link>}</td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={7} className="muted">Nenhuma unidade encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
