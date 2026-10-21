"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { CRITERIA, FIX_KEYS, STEPS } from "@/lib/flow";
import { BrandBar } from "./Brand";
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
type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>;

const EQ: Record<Eq, string> = { TOTEM: "totem", PAINEL: "painel de chamadas" };
const LAST = STEPS.length - 1;

export function TutorialApp() {
  const [view, setView] = useState<View | null>(null);
  const [content, setContent] = useState<PublicStep[]>([]);
  const [open, setOpen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    api<PublicStep[]>("/api/content").then(setContent).catch(() => {});
    api<View | null>("/api/submissions/me")
      .then((v) => { if (v) { setView(v); setOpen(Math.min(v.submission.step, v.maxStep)); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openStep = useCallback((i: number) => {
    setOpen(i);
    if (i >= 0) setTimeout(() => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, []);

  const run: Run = useCallback(async (fn) => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, []);

  const patch = (body: object, goTo?: number) => run(async () => {
    const v = await api<View>("/api/submissions/me", { method: "PATCH", body: goTo === undefined ? body : { ...body, step: goTo } });
    setView(v);
    if (goTo !== undefined) openStep(goTo);
    return v;
  });

  const maxStep = view?.maxStep ?? 0;
  const s = view?.submission;
  const format: Format = s?.format ?? "TEXTO";
  const submitted = !!s && s.status !== "EM_ANDAMENTO";
  const byKey = (k: string) => content.find((c) => c.key === k);
  const doneCount = !view ? 0 : submitted ? STEPS.length : maxStep;

  const next = (i: number) => (
    <button className="btn primary block" disabled={busy || i >= maxStep} onClick={() => patch({}, i + 1)}>
      Continuar →
    </button>
  );

  function body(i: number) {
    if (!view || !s) return <Welcome onCreated={(v) => { setView(v); openStep(1); }} />;
    const key = STEPS[i].key;
    switch (key) {
      case "dados":
        return <div className="stack"><p><strong>{s.contactName}</strong><br />{s.company}</p><p className="muted small">Seus dados já foram registrados. Você pode voltar a esta página a qualquer momento neste dispositivo e continuar de onde parou.</p>{next(i)}</div>;
      case "formato":
        return <div className="stack"><FormatChoice current={s.format} busy={busy} onChoose={(f) => patch({ format: f })} />{next(i)}</div>;
      case "atualizar-totem":
      case "atualizar-painel": {
        const field = key === "atualizar-totem" ? "totemUpdated" : "painelUpdated";
        const done = s[field];
        const label = key === "atualizar-totem" ? "Concluí a atualização do totem." : "Concluí a atualização do painel.";
        return (
          <div className="stack">
            <StepContent step={byKey(key)} format={format} />
            <label className={`check ${done ? "on" : ""}`}>
              <input type="checkbox" checked={done} disabled={busy} onChange={(e) => patch({ [field]: e.target.checked })} />
              <span>{label} <span className="muted small">(Não é preciso assistir ao vídeo inteiro.)</span></span>
            </label>
            {next(i)}
          </div>
        );
      }
      case "enquadramento-totem":
      case "enquadramento-painel": {
        const t: Eq = key === "enquadramento-totem" ? "TOTEM" : "PAINEL";
        return (
          <div className="stack">
            <FramingBlock key={t} type={t} format={format} intro={byKey(key)} fix={byKey(t === "TOTEM" ? FIX_KEYS.TOTEM : FIX_KEYS.PAINEL)}
              state={t === "TOTEM" ? s.totemFraming : s.painelFraming} confirmed={t === "TOTEM" ? s.totemConfirmed : s.painelConfirmed}
              busy={busy} onSubmit={(framing) => patch({ framing })} />
            {next(i)}
          </div>
        );
      }
      case "fotos":
        return <div className="stack"><Photos view={view} content={byKey("fotos")} format={format} run={run} onView={setView} />{next(i)}</div>;
      default:
        return <Finish view={view} run={run} onView={setView} submitted={submitted} onNew={async () => { await api("/api/submissions/reset", { method: "POST" }); setView(null); openStep(0); }} />;
    }
  }

  function status(i: number): { label: string; tone: "done" | "current" | "locked" } {
    if (!view) return i === 0 ? { label: "Comece por aqui", tone: "current" } : { label: "Bloqueada", tone: "locked" };
    if (i === LAST && submitted) return { label: "Enviado", tone: "done" };
    if (i < maxStep) return { label: "Concluída", tone: "done" };
    if (i === maxStep) return { label: "Em andamento", tone: "current" };
    return { label: "Bloqueada", tone: "locked" };
  }

  if (loading) return <><BrandBar /><main className="container"><p className="muted">Carregando…</p></main></>;

  return (
    <>
      <BrandBar>
        {view && <button className="btn sm brand-help" onClick={() => setHelp(true)}>Preciso de ajuda</button>}
      </BrandBar>
      <main className="container">
        <div className="intro stack">
          <h1>Atualização do Atendimento Inteligente</h1>
          <p className="muted">Siga as etapas <strong>na ordem</strong>: cada etapa concluída libera a próxima. Seu progresso é salvo automaticamente.</p>
          {view && (
            <>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={doneCount} aria-label="Progresso"><i style={{ width: `${(doneCount / STEPS.length) * 100}%` }} /></div>
              <div className="row between small muted"><span>{doneCount} de {STEPS.length} etapas concluídas</span>
                {s?.format && (
                  <span className="row" style={{ gap: 6 }} role="group" aria-label="Alternar formato">Formato:
                    {(["TEXTO", "VIDEO"] as const).map((f) => (
                      <button key={f} className={`btn sm ${format === f ? "primary" : ""}`} aria-pressed={format === f} disabled={busy} onClick={() => format !== f && patch({ format: f })}>{f === "TEXTO" ? "📄 Texto" : "🎬 Vídeo"}</button>
                    ))}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {view && view.redo.length > 0 && (
          <div className="alert warn" role="alert" style={{ marginBottom: 12 }}>
            A equipe pediu uma nova foto do {view.redo.map((t) => EQ[t]).join(" e do ")}. <button className="btn sm" onClick={() => openStep(STEPS.findIndex((x) => x.key === "fotos"))}>Enviar agora</button>
          </div>
        )}
        {error && <div className="alert bad" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

        <ol className="acc">
          {STEPS.map((st, i) => {
            const stt = status(i);
            const locked = stt.tone === "locked";
            const isOpen = open === i && !locked;
            const newGroup = i === 0 || STEPS[i - 1].group !== st.group;
            return (
              <li key={st.key} ref={(el) => { refs.current[i] = el; }} className={`acc-item ${stt.tone} ${isOpen ? "open" : ""}`}>
                {newGroup && <div className="acc-group">{st.group}</div>}
                <button type="button" className="acc-head" aria-expanded={isOpen} aria-controls={`acc-${st.key}`} disabled={locked}
                  onClick={() => openStep(isOpen ? -1 : i)}>
                  <span className="acc-num" aria-hidden>{stt.tone === "done" ? "✓" : stt.tone === "locked" ? "🔒" : i + 1}</span>
                  <span className="grow"><span className="acc-title">{st.title}</span><small className="acc-status">{stt.label}</small></span>
                  <span className="chev" aria-hidden>▾</span>
                </button>
                {isOpen && <div id={`acc-${st.key}`} role="region" aria-label={st.title} className="acc-body">{body(i)}</div>}
              </li>
            );
          })}
        </ol>
        <p className="muted small" style={{ textAlign: "center", margin: "24px 0" }}>Intelite Tecnologia</p>
      </main>
      {help && <Help stepTitle={STEPS[Math.max(open, 0)].title} onClose={() => setHelp(false)} onSend={(message) => patch({ help: { message, step: STEPS[Math.max(open, 0)].title } })} />}
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
    <form className="stack" onSubmit={submit}>
      <p>Vamos atualizar e conferir o <strong>totem</strong> e o <strong>painel de chamadas</strong>. Leva poucos minutos. Primeiro, conte quem você é:</p>
      <label className="field"><span>Seu nome</span><input type="text" required value={f.contactName} onChange={set("contactName")} autoComplete="name" /></label>
      <label className="field"><span>Nome da empresa</span><input type="text" required value={f.company} onChange={set("company")} autoComplete="organization" /></label>
      {error && <div className="alert bad" role="alert">{error}</div>}
      <button className="btn primary block" disabled={busy || f.contactName.trim().length < 2 || f.company.trim().length < 2}>{busy ? "Aguarde…" : "Começar"}</button>
      <p className="muted small">Usamos esses dados e as fotos enviadas apenas para acompanhar e validar esta atualização.</p>
    </form>
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
  // Com problema aberto, o cliente já vê o tutorial de ajuste; senão, vê a lista do que precisa estar correto.
  const [mode, setMode] = useState<"check" | "fix">(state === "INCORRETO" || state === "PRECISA_SUPORTE" ? "fix" : "check");
  const send = (outcome: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE") => {
    onSubmit({ type, outcome, issues: [] });
    setMode(outcome === "CORRETO" ? "check" : "fix");
  };
  return (
    <div className="stack">
      <StepContent step={intro} format={format} />
      <div className="row between">
        <strong>Situação da tela do {EQ[type]}</strong>
        <span className={`badge ${state === "CORRETO" ? "ok" : state === "NAO_VERIFICADO" ? "" : "bad"}`}>{state === "CORRETO" ? "Você confirmou: correto" : state === "INCORRETO" ? "Ajuste necessário" : state === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não verificado"}</span>
      </div>
      {state === "CORRETO" && <div className="alert info small">Obrigado! Sua confirmação será conferida pela equipe da Intelite a partir das fotos. {confirmed && <strong>A equipe já confirmou este equipamento.</strong>}</div>}

      {mode === "check" && (
        <div className="stack">
          <div className="subcard stack">
            <h3 style={{ margin: 0 }}>O que precisa estar correto na tela do {EQ[type]}</h3>
            <ul className="info-list">{CRITERIA[type].map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <button className="btn primary block" disabled={busy} onClick={() => send("CORRETO")}>Está tudo certo na tela do {EQ[type]}</button>
          <button className="btn block" disabled={busy} onClick={() => send("INCORRETO")}>Minha tela está cortada ou desalinhada</button>
        </div>
      )}

      {mode === "fix" && (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Minha tela está cortada ou desalinhada</h3>
          <StepContent step={fix} format={format} />
          <button className="btn primary block" disabled={busy} onClick={() => setMode("check")}>Já fiz o ajuste. Conferir a tela de novo</button>
          <button className="btn block" disabled={busy || state === "PRECISA_SUPORTE"} onClick={() => send("PRECISA_SUPORTE")}>{state === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não consegui. Preciso de suporte"}</button>
        </div>
      )}
    </div>
  );
}

// ───────── fotos ─────────

function Photos({ view, content, format, run, onView }: { view: View; content?: PublicStep; format: Format; run: Run; onView: (v: View) => void }) {
  const upload = (type: Eq, file: File) => run(async () => {
    const form = new FormData(); form.set("type", type); form.set("file", file);
    onView(await api<View>("/api/submissions/me/photos", { form }));
  });
  return (
    <div className="stack">
      <StepContent step={content} format={format} />
      {(["TOTEM", "PAINEL"] as const).map((t) => {
        const list = view.photos.filter((p) => p.type === t);
        const last = list[list.length - 1];
        return (
          <div className="subcard stack" key={t}>
            <h3 style={{ margin: 0 }}>Foto do {EQ[t]}</h3>
            {last?.review === "REFAZER" && <div className="alert warn" role="alert"><strong>A equipe pediu outra foto: </strong>{last.reviewNote}</div>}
            <div className="row">{list.map((p) => (
              <figure key={p.id} style={{ width: 110, margin: 0 }}><img className="refimg" src={`/api/photos/${p.id}`} alt={`Foto do ${EQ[t]} enviada`} /><figcaption>{p.review === "APROVADA" ? "Aprovada" : p.review === "REFAZER" ? "Refazer" : "Em análise"}</figcaption></figure>
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

function Finish({ view, run, onView, submitted, onNew }: { view: View; run: Run; onView: (v: View) => void; submitted: boolean; onNew: () => Promise<void> }) {
  const [rating, setRating] = useState(view.submission.rating ?? 0);
  const [hardest, setHardest] = useState("");
  const [comment, setComment] = useState("");
  const s = view.submission;
  const label = (f: Framing, conf: boolean) => (conf ? "Confirmado pela equipe" : f === "CORRETO" ? "Declarado correto (aguardando equipe)" : f === "INCORRETO" ? "Com problema informado" : f === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não verificado");
  return (
    <div className="stack">
      <div className="stack"><h3 style={{ margin: 0 }}>Resumo</h3>
        <div className="row between"><span>Totem</span><span className="badge">{label(s.totemFraming, s.totemConfirmed)}</span></div>
        <div className="row between"><span>Painel</span><span className="badge">{label(s.painelFraming, s.painelConfirmed)}</span></div>
      </div>
      {submitted ? (
        <div className="alert ok"><strong>Recebemos o seu envio. Obrigado!</strong><br />
          {s.status === "APROVADO" ? "A equipe confirmou a atualização." : s.status === "PRECISA_AJUSTE" ? "A equipe pediu um ajuste. Veja o aviso no topo da página." : "A equipe da Intelite vai analisar as fotos e confirmar. Se precisar de algo, avisaremos aqui: guarde este link."}
          <div style={{ marginTop: 12 }}><button className="btn sm" onClick={() => confirm("Iniciar um novo envio neste aparelho (por exemplo, outra loja)? O envio atual continua registrado.") && run(onNew)}>Iniciar outro envio (outra loja ou equipamento)</button></div></div>
      ) : (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Como foi a experiência?</h3>
          <div className="stars" role="radiogroup" aria-label="Nota de 1 a 5">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} de 5`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>)}</div>
          <label className="field"><span>Qual etapa foi mais difícil? (opcional)</span>
            <select value={hardest} onChange={(e) => setHardest(e.target.value)}><option value="">Nenhuma</option>{STEPS.slice(1, LAST).map((st) => <option key={st.key} value={st.title}>{st.title}</option>)}</select></label>
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
