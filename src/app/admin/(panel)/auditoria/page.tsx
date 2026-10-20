"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Dt } from "@/components/admin/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AuditPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [entity, setEntity] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<any[]>(`/api/admin/audit?take=200${entity ? `&entity=${entity}` : ""}`).then(setRows).catch((e) => setError(e.message));
  }, [entity]);
  return (
    <div className="stack">
      <h1>Auditoria</h1>
      <p className="muted">Registro somente-inserção de ações de clientes e da equipe. Não é possível editar ou apagar entradas por esta interface.</p>
      <label className="field" style={{ maxWidth: 280 }}><span>Entidade</span>
        <select value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">Todas</option>
          {["TutorialSession", "FramingCheck", "Evidence", "StepContent", "CorrectionProcedure", "AllowedVideoHost", "FramingCriterion", "Campaign", "CampaignUnit", "AdminUser"].map((x) => <option key={x}>{x}</option>)}</select></label>
      {error && <div className="alert bad">{error}</div>}
      <div className="card tablewrap"><table><thead><tr><th>Quando</th><th>Ator</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead>
        <tbody>{rows?.map((r) => (
          <tr key={r.id}><td><Dt v={r.at} /></td><td>{r.actorType}</td><td>{r.action}</td><td className="small">{r.entity}<div className="muted">{r.entityId}</div></td>
            <td className="small">{r.after ? <code>{JSON.stringify(r.after)}</code> : ""}</td></tr>))}</tbody></table></div>
    </div>
  );
}
