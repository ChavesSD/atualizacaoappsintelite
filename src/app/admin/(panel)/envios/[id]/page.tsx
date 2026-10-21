"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { FRAMING_LABEL, STATUS_LABEL } from "@/lib/flow";

/* eslint-disable @typescript-eslint/no-explicit-any */
const REVIEW: Record<string, string> = { PENDENTE: "A analisar", APROVADA: "Aprovada", REFAZER: "Nova foto solicitada" };
const dt = (v: string) => new Date(v).toLocaleString("pt-BR");

export default function EnvioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [s, setS] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const load = useCallback(() => api<any>(`/api/admin/submissions/${id}`).then((d) => { setS(d); setNotes(d.adminNotes ?? ""); }).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await load(); } catch (e) { setError((e as Error).message); } };
  const patch = (body: object) => act(() => api(`/api/admin/submissions/${id}`, { method: "PATCH", body }));

  if (!s) return error ? <div className="alert bad">{error}</div> : <p className="muted">Carregando…</p>;

  return (
    <div className="stack">
      <p><Link href="/admin">← Envios</Link></p>
      <div className="row between"><div><h1 style={{ marginBottom: 0 }}>{s.contactName}</h1><div className="muted">{s.company}</div></div>
        <span className="badge info">{STATUS_LABEL[s.status as keyof typeof STATUS_LABEL]}</span></div>
      {error && <div className="alert bad" role="alert">{error}</div>}
      {s.helpRequested && <div className="alert warn"><strong>Pediu ajuda</strong> na etapa “{s.helpStep}” ({s.helpFormat === "VIDEO" ? "vídeo" : "texto"}){s.helpMessage ? `: ${s.helpMessage}` : "."}</div>}
      <p className="muted small">Início {dt(s.createdAt)} · formato inicial {s.initialFormat ?? "—"}, atual {s.format ?? "—"}, {s.formatChanges} troca(s){s.submittedAt ? ` · enviado em ${dt(s.submittedAt)}` : ""}{s.rating ? ` · avaliação ${s.rating}/5` : ""}{s.hardestStep ? ` · mais difícil: ${s.hardestStep}` : ""}{s.comment ? ` · “${s.comment}”` : ""}</p>

      {(["TOTEM", "PAINEL"] as const).map((t) => {
        const k = t === "TOTEM" ? "totem" : "painel";
        const photos = s.photos.filter((p: any) => p.type === t);
        return (
          <section className="card stack" key={t}>
            <div className="row between"><h2 style={{ margin: 0 }}>{t === "TOTEM" ? "Totem" : "Painel de chamadas"}</h2>
              <span>
                <span className="badge">Cliente: {FRAMING_LABEL[s[`${k}Framing`] as keyof typeof FRAMING_LABEL]}</span>{" "}
                <span className={`badge ${s[`${k}Confirmed`] ? "ok" : ""}`}>Equipe: {s[`${k}Confirmed`] ? "confirmado" : "não confirmado"}</span></span></div>
            <p className="small muted">Atualização {s[`${k}Updated`] ? "marcada como feita" : "não marcada"}.
              {s[`${k}Issues`].length > 0 && <> Problemas informados: <strong>{s[`${k}Issues`].join(", ")}</strong>.</>}
              {s[`${k}Notes`] && <> Obs.: “{s[`${k}Notes`]}”.</>}</p>
            {photos.length === 0 && <p className="muted">Nenhuma foto enviada.</p>}
            <div className="grid2">{photos.map((p: any) => <Photo key={p.id} p={p} onZoom={() => setZoom(p.id)} onReview={(review, note) => act(() => api(`/api/admin/photos/${p.id}`, { body: { review, note } }))} />)}</div>
            <div className="row">
              {!s[`${k}Confirmed`]
                ? <button className="btn primary" onClick={() => patch({ [`${k}Confirmed`]: true })}>Confirmar enquadramento do {k}</button>
                : <button className="btn" onClick={() => patch({ [`${k}Confirmed`]: false })}>Remover confirmação</button>}
              <span className="muted small">A confirmação exige uma foto aprovada.</span>
            </div>
          </section>
        );
      })}

      <section className="card stack"><h2>Decisão</h2>
        <div className="row">
          <button className="btn primary" disabled={s.status === "APROVADO"} onClick={() => patch({ status: "APROVADO" })}>Aprovar envio</button>
          <button className="btn danger" disabled={s.status === "PRECISA_AJUSTE"} onClick={() => patch({ status: "PRECISA_AJUSTE" })}>Marcar “precisa de ajuste”</button>
        </div>
        <label className="field"><span>Observações internas</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => patch({ adminNotes: notes })}>Salvar observações</button>
      </section>

      <section className="card"><h2>Linha do tempo</h2>
        <div className="tablewrap"><table><tbody>{s.activities.map((a: any) => <tr key={a.id}><td className="small" style={{ whiteSpace: "nowrap" }}>{dt(a.at)}</td><td><span className={`badge ${a.actor === "EQUIPE" ? "info" : ""}`}>{a.actor === "EQUIPE" ? "equipe" : "cliente"}</span></td><td>{a.text}</td></tr>)}</tbody></table></div>
      </section>
      {zoom && <Zoom id={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function Photo({ p, onZoom, onReview }: { p: any; onZoom: () => void; onReview: (r: "APROVADA" | "REFAZER", note?: string) => void }) {
  const [ask, setAsk] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="stack">
      <button type="button" onClick={onZoom} style={{ border: 0, padding: 0, background: "none", cursor: "zoom-in" }} aria-label="Ampliar foto"><img className="thumb" src={`/api/photos/${p.id}`} alt="Foto enviada pelo cliente" loading="lazy" /></button>
      <div className="small"><span className={`badge ${p.review === "APROVADA" ? "ok" : p.review === "REFAZER" ? "bad" : "warn"}`}>{REVIEW[p.review]}</span> {dt(p.createdAt)}{p.reviewNote && <div>Motivo: “{p.reviewNote}”</div>}</div>
      <div className="row"><button className="btn sm" disabled={p.review === "APROVADA"} onClick={() => onReview("APROVADA")}>Aprovar foto</button><button className="btn sm danger" onClick={() => setAsk(!ask)}>Pedir nova foto</button></div>
      {ask && <div className="stack"><label className="field"><span>Motivo (o cliente verá)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: a borda direita da tela não aparece." /></label>
        <button className="btn sm primary" disabled={note.trim().length < 5} onClick={() => { onReview("REFAZER", note); setAsk(false); }}>Enviar pedido</button></div>}
    </div>
  );
}

function Zoom({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-label="Foto ampliada">
      <div className="stack" style={{ padding: 12 }}>
        <div className="row between"><strong>Foto</strong><span className="row" style={{ gap: 6 }}>
          <button className="btn sm" onClick={() => setScale(Math.max(1, scale - 0.5))}>−</button><button className="btn sm" onClick={() => setScale(Math.min(4, scale + 0.5))}>+</button>
          <a className="btn sm" href={`/api/photos/${id}`} target="_blank" rel="noreferrer">Original</a><button className="btn sm" onClick={() => ref.current?.close()}>Fechar</button></span></div>
        <div style={{ overflow: "auto", maxWidth: "92vw", maxHeight: "80vh" }}><img src={`/api/photos/${id}`} alt="Foto ampliada" style={{ width: `${scale * 100}%`, maxWidth: "none", display: "block" }} /></div>
      </div>
    </dialog>
  );
}
