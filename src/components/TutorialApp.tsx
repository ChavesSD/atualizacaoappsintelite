"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { CRITERIA, FIX_KEYS, ISSUES, STEPS } from "@/lib/flow";
import { StepContent, type PublicStep } from "./StepContent";

type Format = "TEXTO" | "VIDEO";
type Eq = "TOTEM" | "PAINEL";
type Framing = "NAO_VERIFICADO" | "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE";

interface View {
  submission: {
    company: string; contactName: string; status: string; step: number; format: Format | null;
    totemUpdated: boolean; painelUpdated: boolean; totemFraming: Framing; painelFraming: Framing;
    totemConfirmed: boolean; painelConfirmed: boolean; rating: number | null;
  };
  photos: { id: string; type: Eq; review: "PENDENTE" | "APROVADA" | "REFAZER"; reviewNote: string | null }[];
  maxStep: number;
  redo: Eq[];
}

const EQ: Record<Eq, string> = { TOTEM: "totem", PAINEL: "painel de chamadas" };

export function TutorialApp() {
  const [view, setView] = useState<View | null>(null);
  const [content, setContent] = useState<PublicStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<PublicStep[]>("/api/content").then(setContent).catch(() => {});
    api<View | null>("/api/submissions/me")
      .then((v) => { if (v) { setView(v); setIdx(Math.min(v.submission.step, v.maxStep)); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, [idx]);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, []);

  const patch = (body: object, goTo?: number) => run(async () => {
    const v = await api<View>("/api/submissions/me", { method: "PATCH", body: goTo === undefined ? body : { ...body, step: goTo } });
    setView(v);
    if (goTo !== undefined) setIdx(goTo);
    return v;
  });

  if (loading) return <main className="container"><p className="muted">Carregando…</p></main>;
  if (!view) return <Welcome onCreated={(v) => { setView(v); setIdx(1); }} />;

  const s = view.submission;
  const format: Format = s.format ?? "TEXTO";
  const step = STEPS[idx];
  const byKey = (k: string) => content.find((c) => c.key === k);
  const go = (n: number) => patch({}, n);
  const submitted = s.status !== "EM_ANDAMENTO";

  return (
    <>
      <div className="topbar">
        <div className="container" style={{ paddingBlock: 10 }}>
          <div className="row between">
            <div className="grow"><strong>{s.company}</strong><div className="muted small">{s.contactName} · Etapa {idx + 1} de {STEPS.length}</div></div>
            <button className="btn sm" onClick={() => setHelp(true)}>Preciso de ajuda</button>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={idx + 1} aria-label="Progresso"><i style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
          <nav className="stepper" aria-label="Etapas">
            {STEPS.map((st, i) => (
              <button key={st.key} disabled={i === 0 || i > view.maxStep || busy} className={i < idx ? "done" : ""} aria-current={i === idx ? "step" : undefined} onClick={() => go(i)}>
                {i < idx ? "✓ " : `${i + 1}. `}{st.title}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="container" style={{ paddingBottom: 110 }}>
        <div ref={top} />
        {view.redo.length > 0 && (
          <div className="alert warn" role="alert" style={{ marginBottom: 12 }}>
            A equipe pediu uma nova foto do {view.redo.map((t) => EQ[t]).join(" e do ")}. <button className="btn sm" onClick={() => go(6)}>Enviar agora</button>
          </div>
        )}
        <h1>{idx === 0 ? "Seus dados" : step.title}</h1>
        {error && <div className="alert bad" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

        {idx >= 2 && idx <= 6 && (
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="muted small">Formato:</span>
            <div role="group" aria-label="Alternar formato" className="row" style={{ gap: 6 }}>
              {(["TEXTO", "VIDEO"] as const).map((f) => (
                <button key={f} className={`btn sm ${format === f ? "primary" : ""}`} aria-pressed={format === f} disabled={busy} onClick={() => format !== f && patch({ format: f })}>{f === "TEXTO" ? "📄 Texto" : "🎬 Vídeo"}</button>
              ))}
            </div>
          </div>
        )}

        {idx === 0 && <div className="card stack"><p><strong>{s.contactName}</strong><br />{s.company}</p><p className="muted small">Seus dados já foram registrados. Você pode voltar a este link a qualquer momento e continuar de onde parou.</p></div>}

        {idx === 1 && <FormatChoice current={s.format} busy={busy} onChoose={(f) => patch({ format: f })} />}

        {(idx === 2 || idx === 4) && (() => {
          const t: Eq = idx === 2 ? "TOTEM" : "PAINEL";
          const done = t === "TOTEM" ? s.totemUpdated : s.painelUpdated;
          const key = t === "TOTEM" ? "totemUpdated" : "painelUpdated";
          return (
            <div className="stack">
              <div className="card"><StepContent step={byKey(step.key)} format={format} /></div>
              <label className={`check ${done ? "on" : ""}`}>
                <input type="checkbox" checked={done} disabled={busy} onChange={(e) => patch({ [key]: e.target.checked })} />
                <span>Concluí a atualização do {EQ[t]}. <span className="muted small">(Não é preciso assistir ao vídeo inteiro.)</span></span>
              </label>
            </div>
          );
        })()}

        {(idx === 3 || idx === 5) && (
          <FramingBlock
            key={idx} type={idx === 3 ? "TOTEM" : "PAINEL"} format={format}
            intro={byKey(step.key)} fix={byKey(idx === 3 ? FIX_KEYS.TOTEM : FIX_KEYS.PAINEL)}
            state={idx === 3 ? s.totemFraming : s.painelFraming} confirmed={idx === 3 ? s.totemConfirmed : s.painelConfirmed}
            busy={busy} onSubmit={(framing) => patch({ framing })}
          />
        )}

        {idx === 6 && <Photos view={view} content={byKey("fotos")} format={format} run={run} onView={setView} />}
        {idx === 7 && <Finish view={view} run={run} onView={setView} submitted={submitted} />}
      </main>

      {idx > 0 && !(idx === 7) && (
        <div className="footer-nav">
          <button className="btn" disabled={busy || idx <= 1} onClick={() => go(idx - 1)}>← Voltar</button>
          <button className="btn primary" disabled={busy || idx + 1 > view.maxStep} onClick={() => go(idx + 1)}>Continuar →</button>
        </div>
      )}
      {idx === 7 && <div className="footer-nav"><button className="btn" onClick={() => go(6)}>← Voltar</button></div>}
      {help && <Help stepTitle={step.title} onClose={() => setHelp(false)} onSend={(message) => patch({ help: { message, step: step.title } })} />}
    </>
  );
}

// ───────── dados do cliente ─────────

function Welcome({ onCreated }: { onCreated: (v: View) => void }) {
  const [f, setF] = useState({ contactName: "", company: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { onCreated(await api<View>("/api/submissions", { body: f })); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }
  return (
    <main className="container" style={{ paddingTop: 32 }}>
      <form className="card stack" onSubmit={submit}>
        <div><p className="muted small" style={{ margin: 0 }}>Intelite Tecnologia</p><h1>Atualização do Atendimento Inteligente</h1></div>
        <p>Vamos atualizar e conferir o <strong>totem</strong> e o <strong>painel de chamadas</strong>. Leva poucos minutos. Primeiro, conte quem você é:</p>
        <label className="field"><span>Seu nome</span><input type="text" required value={f.contactName} onChange={set("contactName")} autoComplete="name" /></label>
        <label className="field"><span>Nome da empresa</span><input type="text" required value={f.company} onChange={set("company")} autoComplete="organization" /></label>
        {error && <div className="alert bad" role="alert">{error}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? "Aguarde…" : "Começar"}</button>
        <p className="muted small">Usamos esses dados apenas para acompanhar esta atualização.</p>
      </form>
    </main>
  );
}

function FormatChoice({ current, busy, onChoose }: { current: Format | null; busy: boolean; onChoose: (f: Format) => void }) {
  return (
    <div className="stack">
      <p>Como você prefere acompanhar? Pode trocar a qualquer momento sem perder o progresso.</p>
      <div className="choice" role="group" aria-label="Formato do tutorial">
        <button type="button" aria-pressed={current === "TEXTO"} disabled={busy} onClick={() => onChoose("TEXTO")}>
          <span className="ico" aria-hidden>📄</span><strong>Tutorial por escrito</strong>
          <span className="muted">Siga as instruções passo a passo, com imagens ilustrativas e orientações objetivas.</span>
        </button>
        <button type="button" aria-pressed={current === "VIDEO"} disabled={busy} onClick={() => onChoose("VIDEO")}>
          <span className="ico" aria-hidden>🎬</span><strong>Tutorial em vídeo</strong>
          <span className="muted">Assista à demonstração e acompanhe o procedimento visualmente, observando cada ação.</span>
        </button>
      </div>
    </div>
  );
}

// ───────── enquadramento ─────────

function FramingBlock({ type, format, intro, fix, state, confirmed, busy, onSubmit }: {
  type: Eq; format: Format; intro?: PublicStep; fix?: PublicStep; state: Framing; confirmed: boolean; busy: boolean;
  onSubmit: (f: { type: Eq; outcome: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE"; issues: string[]; notes?: string }) => void;
}) {
  const [mode, setMode] = useState<"check" | "problem" | "fix">(state === "INCORRETO" || state === "PRECISA_SUPORTE" ? "fix" : "check");
  const [ok, setOk] = useState<Record<number, boolean>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const crit = CRITERIA[type];
  const all = crit.every((_, i) => ok[i]);
  const send = (outcome: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE") => {
    onSubmit({ type, outcome, issues: outcome === "CORRETO" ? [] : issues, notes: notes || undefined });
    setMode(outcome === "CORRETO" ? "check" : "fix");
  };
  return (
    <div className="stack">
      <div className="card"><StepContent step={intro} format={format} /></div>
      <div className="card stack">
        <div className="row between"><h2 style={{ margin: 0 }}>Situação da tela do {EQ[type]}</h2>
          <span className={`badge ${state === "CORRETO" ? "ok" : state === "NAO_VERIFICADO" ? "" : "bad"}`}>{state === "CORRETO" ? "Você confirmou: correto" : state === "INCORRETO" ? "Problema informado" : state === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não verificado"}</span></div>
        {state === "CORRETO" && <div className="alert info small">Obrigado! Sua confirmação será conferida pela equipe da Intelite a partir das fotos. {confirmed && <strong>A equipe já confirmou este equipamento.</strong>}</div>}
      </div>

      {mode === "check" && (
        <div className="card stack">
          <h2>Confira a tela agora</h2>
          {crit.map((c, i) => (
            <label key={c} className={`check ${ok[i] ? "on" : ""}`}><input type="checkbox" checked={!!ok[i]} onChange={(e) => setOk({ ...ok, [i]: e.target.checked })} /><span>{c}</span></label>
          ))}
          <button className="btn primary block" disabled={busy || !all} onClick={() => send("CORRETO")}>Está tudo certo na tela do {EQ[type]}</button>
          <button className="btn block" disabled={busy} onClick={() => setMode("problem")}>Minha tela está cortada ou desalinhada</button>
        </div>
      )}

      {mode === "problem" && (
        <div className="card stack">
          <h2>O que você está vendo?</h2>
          {ISSUES[type].map((i) => (
            <label key={i} className={`check ${issues.includes(i) ? "on" : ""}`}><input type="checkbox" checked={issues.includes(i)} onChange={(e) => setIssues(e.target.checked ? [...issues, i] : issues.filter((x) => x !== i))} /><span>{i}</span></label>
          ))}
          <label className="field"><span>Observações (opcional)</span><textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} /></label>
          <button className="btn primary block" disabled={busy || issues.length === 0} onClick={() => send("INCORRETO")}>Ver como corrigir</button>
          <button className="btn block" onClick={() => setMode("check")}>Voltar</button>
        </div>
      )}

      {mode === "fix" && (
        <div className="card stack">
          <h2>Minha tela está cortada ou desalinhada</h2>
          <StepContent step={fix} format={format} />
          <button className="btn primary block" disabled={busy} onClick={() => { setOk({}); setMode("check"); }}>Já fiz o ajuste. Conferir a tela de novo</button>
          <button className="btn block" disabled={busy || state === "PRECISA_SUPORTE"} onClick={() => send("PRECISA_SUPORTE")}>{state === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não consegui. Preciso de suporte"}</button>
        </div>
      )}
    </div>
  );
}

// ───────── fotos ─────────

function Photos({ view, content, format, run, onView }: { view: View; content?: PublicStep; format: Format; run: <T>(fn: () => Promise<T>) => Promise<T | undefined>; onView: (v: View) => void }) {
  const upload = (type: Eq, file: File) => run(async () => {
    const form = new FormData(); form.set("type", type); form.set("file", file);
    onView(await api<View>("/api/submissions/me/photos", { form }));
  });
  return (
    <div className="stack">
      <div className="card"><StepContent step={content} format={format} /></div>
      {(["TOTEM", "PAINEL"] as const).map((t) => {
        const list = view.photos.filter((p) => p.type === t);
        const last = list[list.length - 1];
        return (
          <div className="card stack" key={t}>
            <h2>Foto do {EQ[t]}</h2>
            {last?.review === "REFAZER" && <div className="alert warn" role="alert"><strong>A equipe pediu outra foto: </strong>{last.reviewNote}</div>}
            <div className="row">{list.map((p) => (
              <figure key={p.id} style={{ width: 110 }}><img className="refimg" src={`/api/photos/${p.id}`} alt={`Foto do ${EQ[t]} enviada`} /><figcaption>{p.review === "APROVADA" ? "Aprovada" : p.review === "REFAZER" ? "Refazer" : "Em análise"}</figcaption></figure>
            ))}</div>
            <label className="btn primary" style={{ cursor: "pointer" }}>{last && last.review !== "REFAZER" ? "Enviar outra foto" : "Tirar ou escolher foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="visually-hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t, f); e.target.value = ""; }} /></label>
          </div>
        );
      })}
    </div>
  );
}

// ───────── envio ─────────

function Finish({ view, run, onView, submitted }: { view: View; run: <T>(fn: () => Promise<T>) => Promise<T | undefined>; onView: (v: View) => void; submitted: boolean }) {
  const [rating, setRating] = useState(view.submission.rating ?? 0);
  const [hardest, setHardest] = useState("");
  const [comment, setComment] = useState("");
  const s = view.submission;
  const label = (f: Framing, conf: boolean) => (conf ? "Confirmado pela equipe" : f === "CORRETO" ? "Declarado correto (aguardando equipe)" : f === "INCORRETO" ? "Com problema informado" : f === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não verificado");
  return (
    <div className="stack">
      <div className="card stack"><h2>Resumo</h2>
        <div className="row between"><span>Totem</span><span className="badge">{label(s.totemFraming, s.totemConfirmed)}</span></div>
        <div className="row between"><span>Painel</span><span className="badge">{label(s.painelFraming, s.painelConfirmed)}</span></div>
      </div>
      {submitted ? (
        <div className="alert ok"><strong>Recebemos o seu envio. Obrigado!</strong><br />
          {s.status === "APROVADO" ? "A equipe confirmou a atualização da sua unidade." : s.status === "PRECISA_AJUSTE" ? "A equipe pediu um ajuste. Veja o aviso no topo da página." : "A equipe da Intelite vai analisar as fotos e confirmar. Se precisar de algo, avisaremos aqui: guarde este link."}</div>
      ) : (
        <div className="card stack">
          <h2>Como foi a experiência?</h2>
          <div className="stars" role="radiogroup" aria-label="Nota de 1 a 5">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} de 5`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>)}</div>
          <label className="field"><span>Qual etapa foi mais difícil? (opcional)</span>
            <select value={hardest} onChange={(e) => setHardest(e.target.value)}><option value="">Nenhuma</option>{STEPS.slice(1, 7).map((st) => <option key={st.key} value={st.title}>{st.title}</option>)}</select></label>
          <label className="field"><span>Comentário (opcional)</span><textarea value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} /></label>
          <button className="btn primary block" disabled={rating === 0} onClick={() => run(async () => onView(await api<View>("/api/submissions/me/submit", { body: { rating, comment: comment || undefined, hardestStep: hardest || undefined } })))}>Enviar</button>
        </div>
      )}
    </div>
  );
}

// ───────── ajuda ─────────

function Help({ stepTitle, onClose, onSend }: { stepTitle: string; onClose: () => void; onSend: (m: string) => void }) {
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="help-title">
      <div className="stack" style={{ padding: 20, minWidth: "min(92vw, 420px)" }}>
        <h2 id="help-title">Preciso de ajuda</h2>
        {sent ? <div className="alert ok">Pedido enviado. A equipe da Intelite vai entrar em contato.</div> : (
          <>
            <p className="muted small">Etapa: {stepTitle}. Conte o que está acontecendo.</p>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} aria-label="Descrição do problema" />
            <button className="btn primary" onClick={() => { onSend(msg); setSent(true); }}>Enviar pedido</button>
          </>
        )}
        <button className="btn" onClick={() => ref.current?.close()}>Fechar</button>
      </div>
    </dialog>
  );
}
