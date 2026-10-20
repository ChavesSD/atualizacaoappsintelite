"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { Dt, OP_LABEL, useMe } from "@/components/admin/ui";
import { FRAMING_STATUS_LABEL, ISSUE_LABEL } from "@/domain/framing";
import { STEP_FLOW } from "@/domain/steps";

/* eslint-disable @typescript-eslint/no-explicit-any */
type D = any;

const tone = (s: string) => (s === "CORRETO" ? "ok" : s === "INCORRETO" || s === "PRECISA_SUPORTE" ? "bad" : s === "NAO_VERIFICADO" ? "" : "warn");
const REVIEW: Record<string, string> = { PENDENTE: "A analisar", ACEITA: "Aceita", NOVA_FOTO_SOLICITADA: "Nova foto solicitada" };

export default function UnitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ id: string; label: string } | null>(null);
  const load = useCallback(() => api<D>(`/api/admin/sessions/${id}`).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await load(); } catch (e) { setError((e as Error).message); } };

  if (!d) return error ? <div className="alert bad">{error}</div> : <p className="muted">Carregando…</p>;
  const op = OP_LABEL[d.operational.status];
  const title = (k: string) => STEP_FLOW.find((s) => s.key === k)?.title ?? k;

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 0 }}>{d.campaignUnit.unit.name}</h1>
          <div className="muted">{d.campaignUnit.unit.code} · {d.campaignUnit.campaign.name}</div>
        </div>
        <span className={`badge ${op.tone}`}>{op.t}</span>
      </div>
      {error && <div className="alert bad" role="alert">{error}</div>}
      {d.operational.pending.length > 0 && <div className="alert info"><strong>Pendências:</strong><ul>{d.operational.pending.map((p: string) => <li key={p}>{p}</li>)}</ul></div>}
      <p className="muted small">
        Formato escolhido: <strong>{d.initialFormat ?? "—"}</strong> · em uso: <strong>{d.currentFormat ?? "—"}</strong> · trocas: {d.formatChanges.filter((c: D) => c.fromFormat).length} ·
        sessão iniciada em <Dt v={d.startedAt} /> · {d.completedAt ? <>confirmada pelo cliente em <Dt v={d.completedAt} /></> : "ainda não confirmada pelo cliente"}
      </p>

      {(["TOTEM", "PAINEL"] as const).map((t) => {
        const c = d.checks.find((x: D) => x.type === t);
        if (!c) return null;
        const evs = d.evidences.filter((e: D) => e.type === t);
        return (
          <section className="card stack" key={t}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{t === "TOTEM" ? "Totem" : "Painel de chamadas"}</h2>
              <span><span className={`badge ${tone(c.status)}`}>Declarado: {FRAMING_STATUS_LABEL[c.status as keyof typeof FRAMING_STATUS_LABEL]}</span>{" "}
                <span className={`badge ${c.technicalStatus === "VALIDADO" ? "ok" : c.technicalStatus === "REJEITADO" ? "bad" : ""}`}>Validação técnica: {c.technicalStatus.toLowerCase()}</span></span>
            </div>
            <div className="small muted">
              Verificações: {c.verificationCount} · Última: <Dt v={c.verifiedAt} /> · Cortes: {c.hasCutoff ? "sim" : "não"} · Correção: {c.correctionStatus.toLowerCase().replace("_", " ")}
              {c.customerNotes && <div>Observações do cliente: “{c.customerNotes}”</div>}
              {c.technicalAt && <div>Validação por {c.technicalBy?.name ?? "—"} em <Dt v={c.technicalAt} />{c.technicalNotes ? ` — ${c.technicalNotes}` : ""}</div>}
            </div>
            {c.issues.length > 0 && <div className="row">{c.issues.map((i: D) => <span key={i.id} className={`badge ${i.resolvedAt ? "" : "bad"}`}>{ISSUE_LABEL[i.type]}{i.resolvedAt ? " (resolvido)" : ""}</span>)}</div>}
            {c.adjustments.length > 0 && <div className="small">Ajustes: {c.adjustments.map((a: D) => `${a.adjustmentType ?? "—"}${a.procedure ? ` (${a.procedure.title} v${a.procedure.version})` : ""} em ${new Date(a.performedAt).toLocaleString("pt-BR")}`).join(" · ")}</div>}

            <h3>Fotografias</h3>
            {evs.length === 0 && <p className="muted">Nenhuma foto enviada.</p>}
            <div className="grid2">
              {evs.map((e: D) => (
                <EvidenceCard key={e.id} e={e} canWrite={!!me?.canWrite} onZoom={() => setZoom({ id: e.id, label: `${t} — ${new Date(e.uploadedAt).toLocaleString("pt-BR")}` })}
                  onReview={(decision, reason) => act(() => api(`/api/admin/evidence/${e.id}/review`, { body: { decision, reason } }))} />
              ))}
            </div>

            {me?.canWrite && c.status === "CORRETO" && (
              <ValidationBox onSubmit={(decision, notes) => act(() => api(`/api/admin/framing/${c.id}/validate`, { body: { decision, notes } }))} />
            )}

            <details><summary>Histórico do equipamento ({c.events.length})</summary>
              <table><tbody>{c.events.map((ev: D) => (
                <tr key={ev.id}><td><Dt v={ev.at} /></td><td>{ev.kind}</td><td>{ev.fromStatus ? `${FRAMING_STATUS_LABEL[ev.fromStatus as keyof typeof FRAMING_STATUS_LABEL]} → ` : ""}{ev.toStatus ? FRAMING_STATUS_LABEL[ev.toStatus as keyof typeof FRAMING_STATUS_LABEL] : ""}</td>
                  <td>{ev.actorType}{ev.format ? ` · ${ev.format}` : ""}</td><td>{ev.notes}</td></tr>
              ))}</tbody></table>
            </details>
          </section>
        );
      })}

      <section className="card stack">
        <h2>Progresso e experiência</h2>
        <div className="tablewrap"><table><thead><tr><th>Etapa</th><th>Concluída em</th><th>Formato</th></tr></thead>
          <tbody>{d.stepProgress.map((p: D) => <tr key={p.id}><td>{title(p.stepKey)}</td><td><Dt v={p.completedAt} /></td><td>{p.format ?? "—"}</td></tr>)}</tbody></table></div>
        {d.formatChanges.length > 0 && <p className="small">Trocas de formato: {d.formatChanges.map((c: D) => `${c.fromFormat ?? "início"}→${c.toFormat} (${title(c.stepKey)})`).join(" · ")}</p>}
        {d.supports.length > 0 && <div><h3>Pedidos de suporte</h3>{d.supports.map((s: D) => <p key={s.id} className="small"><Dt v={s.createdAt} /> · {title(s.stepKey)} · {s.format ?? "—"} · {s.message ?? "sem mensagem"}</p>)}</div>}
        {d.evaluation && <p>Avaliação: <strong>{d.evaluation.rating}/5</strong>{d.evaluation.hardestStepKey ? ` · mais difícil: ${title(d.evaluation.hardestStepKey)}` : ""}{d.evaluation.comment ? ` · “${d.evaluation.comment}”` : ""}</p>}
      </section>

      <section className="card"><h2>Trilha de auditoria</h2>
        <div className="tablewrap"><table><thead><tr><th>Quando</th><th>Ator</th><th>Ação</th></tr></thead>
          <tbody>{d.trail.map((a: D) => <tr key={a.id}><td><Dt v={a.at} /></td><td>{a.actorType}</td><td>{a.action}</td></tr>)}</tbody></table></div>
      </section>

      {zoom && <ZoomDialog id={zoom.id} label={zoom.label} onClose={() => setZoom(null)} />}
    </div>
  );
}

function EvidenceCard({ e, canWrite, onZoom, onReview }: { e: D; canWrite: boolean; onZoom: () => void; onReview: (d: "ACEITA" | "NOVA_FOTO_SOLICITADA", r?: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="stack">
      <button type="button" onClick={onZoom} style={{ border: 0, padding: 0, background: "none", cursor: "zoom-in" }} aria-label="Ampliar foto">
        <img className="thumb" src={`/api/admin/evidence/${e.id}`} alt="Foto enviada pelo cliente" loading="lazy" />
      </button>
      <div className="small"><span className={`badge ${e.review === "ACEITA" ? "ok" : e.review === "NOVA_FOTO_SOLICITADA" ? "bad" : "warn"}`}>{REVIEW[e.review]}</span> <Dt v={e.uploadedAt} />
        {e.reviewReason && <div>Motivo informado ao cliente: “{e.reviewReason}”</div>}{e.reviewedBy && <div className="muted">por {e.reviewedBy.name}</div>}</div>
      {canWrite && (
        <div className="stack">
          <div className="row">
            <button className="btn sm" disabled={e.review === "ACEITA"} onClick={() => onReview("ACEITA")}>Aceitar foto</button>
            <button className="btn sm danger" onClick={() => setAsking(!asking)}>Solicitar nova foto</button>
          </div>
          {asking && (
            <div className="stack">
              <label className="field"><span>Motivo (o cliente verá esta mensagem)</span><textarea value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Ex.: a borda direita da tela não aparece na imagem." /></label>
              <button className="btn sm primary" disabled={reason.trim().length < 5} onClick={() => { onReview("NOVA_FOTO_SOLICITADA", reason); setAsking(false); }}>Enviar solicitação</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ValidationBox({ onSubmit }: { onSubmit: (d: "VALIDADO" | "REJEITADO", notes?: string) => void }) {
  const [notes, setNotes] = useState("");
  return (
    <div className="card stack" style={{ background: "var(--surface-2)" }}>
      <h3>Validação técnica do enquadramento</h3>
      <p className="muted small">Só valide após analisar as fotos (aceite ao menos uma). Esta decisão fica registrada com o seu nome.</p>
      <label className="field"><span>Observações (obrigatórias para rejeitar)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="row">
        <button className="btn primary" onClick={() => onSubmit("VALIDADO", notes || undefined)}>Validar enquadramento</button>
        <button className="btn danger" disabled={notes.trim().length < 5} onClick={() => onSubmit("REJEITADO", notes)}>Rejeitar</button>
      </div>
    </div>
  );
}

function ZoomDialog({ id, label, onClose }: { id: string; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={`Foto ampliada: ${label}`}>
      <div className="stack" style={{ padding: 12 }}>
        <div className="row between"><strong>{label}</strong>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => setScale(Math.max(1, scale - 0.5))}>−</button>
            <button className="btn sm" onClick={() => setScale(Math.min(4, scale + 0.5))}>+</button>
            <a className="btn sm" href={`/api/admin/evidence/${id}`} target="_blank" rel="noreferrer">Abrir original</a>
            <button className="btn sm" onClick={() => ref.current?.close()}>Fechar</button></span></div>
        <div style={{ overflow: "auto", maxWidth: "92vw", maxHeight: "80vh" }}>
          <img src={`/api/admin/evidence/${id}`} alt={label} style={{ width: `${scale * 100}%`, maxWidth: "none", display: "block" }} />
        </div>
      </div>
    </dialog>
  );
}
