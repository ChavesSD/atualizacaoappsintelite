"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { CRITERIA, FIX_KEYS, STEPS } from "@/lib/flow";
import { BrandBar } from "./Brand";
import { StepContent, type PublicStep } from "./StepContent";
import { Alert, Icon, Skeleton, type IconName } from "./ui";

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
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TutorialApp() {
  const [view, setView] = useState<View | null>(null);
  const [content, setContent] = useState<PublicStep[]>([]);
  const [open, setOpen] = useState(0);
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heads = useRef<(HTMLButtonElement | null)[]>([]);

  const load = useCallback(async () => {
    setBoot("loading");
    try {
      const [c, v] = await Promise.all([api<PublicStep[]>("/api/content"), api<View | null>("/api/submissions/me")]);
      setContent(c);
      if (v) { setView(v); setOpen(Math.min(v.submission.step, v.maxStep)); }
      setBoot("ready");
    } catch (e) {
      setBootError((e as Error).message);
      setBoot("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  /** Abre uma etapa, rola até ela e, quando o avanço foi pelo botão "Continuar", leva o foco ao cabeçalho dela. */
  const openStep = useCallback((i: number, focus = false) => {
    setOpen(i);
    if (i < 0) return;
    requestAnimationFrame(() => {
      const el = heads.current[i];
      el?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      if (focus) el?.focus({ preventScroll: true });
    });
  }, []);

  const run: Run = useCallback(async (fn) => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, []);

  const patch = (body: object, goTo?: number) => run(async () => {
    const v = await api<View>("/api/submissions/me", { method: "PATCH", body: goTo === undefined ? body : { ...body, step: goTo } });
    setView(v);
    if (goTo !== undefined) openStep(goTo, true);
    return v;
  });

  if (boot === "loading") {
    return (
      <>
        <BrandBar />
        <main className="container" aria-busy="true" aria-label="Carregando">
          <div className="intro stack"><Skeleton h={32} w="80%" /><Skeleton h={18} /><Skeleton h={18} w="60%" /></div>
          <div className="stack" style={{ marginTop: 24 }}><Skeleton h={64} r={16} /><Skeleton h={64} r={16} /><Skeleton h={64} r={16} /></div>
        </main>
      </>
    );
  }
  if (boot === "error") {
    return (
      <>
        <BrandBar />
        <main className="container" style={{ paddingTop: 24 }}>
          <Alert tone="bad" role="alert"><strong>Não foi possível abrir o tutorial.</strong><br />{bootError}</Alert>
          <p style={{ marginTop: 16 }}><button type="button" className="btn primary" onClick={load}>Tentar de novo</button></p>
        </main>
      </>
    );
  }

  const maxStep = view?.maxStep ?? 0;
  const s = view?.submission;
  const format: Format = s?.format ?? "TEXTO";
  const submitted = !!s && s.status !== "EM_ANDAMENTO";
  const byKey = (k: string) => content.find((c) => c.key === k);
  const doneCount = !view ? 0 : submitted ? STEPS.length : maxStep;

  const next = (i: number) => (
    <button type="button" className="btn primary block" disabled={busy || i >= maxStep} onClick={() => patch({}, i + 1)}>
      Continuar <Icon name="arrowRight" size={18} />
    </button>
  );

  function body(i: number) {
    if (!view || !s) return <Welcome onCreated={(v) => { setView(v); openStep(1, true); }} />;
    const key = STEPS[i].key;
    switch (key) {
      case "dados":
        return <div className="stack"><p className="user-text"><strong>{s.contactName}</strong><br />{s.company}</p><p className="muted small">Seus dados já foram registrados. Você pode voltar a esta página a qualquer momento neste dispositivo e continuar de onde parou.</p>{next(i)}</div>;
      case "formato":
        return <div className="stack"><FormatChoice current={s.format} busy={busy} onChoose={(f) => patch({ format: f })} />{next(i)}</div>;
      case "atualizar-totem":
      case "atualizar-painel": {
        const field = key === "atualizar-totem" ? "totemUpdated" : "painelUpdated";
        const done = s[field];
        return (
          <div className="stack">
            <StepContent step={byKey(key)} format={format} />
            <label className="check">
              <input type="checkbox" checked={done} disabled={busy} onChange={(e) => patch({ [field]: e.target.checked })} />
              <span>Concluí a atualização do {key === "atualizar-totem" ? "totem" : "painel"}. <span className="hint">Não é preciso assistir ao vídeo inteiro.</span></span>
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
    if (!view) return i === 0 ? { label: "Comece por aqui", tone: "current" } : { label: "Conclua a etapa anterior", tone: "locked" };
    if (i === LAST && submitted) return { label: "Enviado", tone: "done" };
    if (i < maxStep) return { label: "Concluída", tone: "done" };
    if (i === maxStep) return { label: "Em andamento", tone: "current" };
    return { label: "Conclua a etapa anterior", tone: "locked" };
  }

  // Agrupa as etapas pelo nome do grupo, preservando a ordem do fluxo.
  const groups = STEPS.reduce<{ name: string; items: number[] }[]>((acc, st, i) => {
    const last = acc[acc.length - 1];
    if (last && last.name === st.group) last.items.push(i);
    else acc.push({ name: st.group, items: [i] });
    return acc;
  }, []);

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <BrandBar />
      <main id="conteudo" className="container" tabIndex={-1}>
        <header className="intro stack">
          <h1>Atualização do Atendimento Inteligente</h1>
          <p className="muted">Siga as etapas <strong>na ordem</strong>: cada etapa concluída libera a próxima. Seu progresso é salvo automaticamente.</p>
          {view && (
            <>
              <div className="progress" role="progressbar" aria-labelledby="prog-label" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={doneCount}><i style={{ width: `${(doneCount / STEPS.length) * 100}%` }} /></div>
              <div className="row between">
                <span id="prog-label" className="small muted">{doneCount} de {STEPS.length} etapas concluídas</span>
                {s?.format && (
                  <fieldset className="seg">
                    <legend className="visually-hidden">Alternar formato</legend>
                    {(["TEXTO", "VIDEO"] as const).map((f) => (
                      <label key={f} className="opt">
                        <input type="radio" name="formato-topo" value={f} checked={format === f} disabled={busy} onChange={() => patch({ format: f })} />
                        <Icon name={f === "TEXTO" ? "file" : "play"} /> {f === "TEXTO" ? "Texto" : "Vídeo"}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            </>
          )}
        </header>

        {view && view.redo.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Alert tone="warn" role="alert">
              A equipe pediu uma nova foto do {view.redo.map((t) => EQ[t]).join(" e do ")}.{" "}
              <button type="button" className="btn sm" onClick={() => openStep(STEPS.findIndex((x) => x.key === "fotos"), true)}>Enviar agora</button>
            </Alert>
          </div>
        )}
        {error && <div style={{ marginTop: 12 }}><Alert tone="bad" role="alert">{error}</Alert></div>}

        {groups.map((g) => (
          <section key={g.name} className="acc-group" aria-labelledby={`g-${g.items[0]}`}>
            <h2 id={`g-${g.items[0]}`}>{g.name}</h2>
            <ol className="acc" start={g.items[0] + 1}>
              {g.items.map((i) => {
                const st = STEPS[i];
                const stt = status(i);
                const locked = stt.tone === "locked";
                const isOpen = open === i && !locked;
                return (
                  <li key={st.key} className={`acc-item ${stt.tone} ${isOpen ? "open" : ""}`}>
                    <h3 className="acc-h">
                      <button
                        type="button" id={`h-${st.key}`} className="acc-head" ref={(el) => { heads.current[i] = el; }}
                        aria-expanded={isOpen} aria-controls={isOpen ? `p-${st.key}` : undefined} aria-disabled={locked}
                        onClick={() => { if (!locked) openStep(isOpen ? -1 : i); }}
                      >
                        <span className="acc-num" aria-hidden>{stt.tone === "done" ? <Icon name="check" size={18} /> : locked ? <Icon name="lock" size={16} /> : i + 1}</span>
                        <span className="grow"><span className="acc-title">{st.title}</span><span className="acc-status">{stt.label}</span></span>
                        <Icon name="chevron" className="chev" />
                      </button>
                    </h3>
                    {isOpen && <div id={`p-${st.key}`} role="region" aria-labelledby={`h-${st.key}`} className="acc-body">{body(i)}</div>}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <p className="muted small" style={{ textAlign: "center", margin: "32px 0" }}>Intelite Tecnologia</p>
      </main>
    </>
  );
}

// ───────── dados do cliente ─────────

function Welcome({ onCreated }: { onCreated: (v: View) => void }) {
  const [f, setF] = useState({ contactName: "", company: "" });
  const [errors, setErrors] = useState<{ contactName?: string; company?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); if (errors[k]) setErrors({ ...errors, [k]: undefined }); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      contactName: f.contactName.trim().length < 2 ? "Informe o seu nome." : undefined,
      company: f.company.trim().length < 2 ? "Informe o nome da empresa." : undefined,
    };
    setErrors(next);
    if (next.contactName || next.company) {
      (document.getElementById(next.contactName ? "f-nome" : "f-empresa") as HTMLInputElement | null)?.focus();
      return;
    }
    setBusy(true); setError(null);
    try { onCreated(await api<View>("/api/submissions", { body: f })); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p>Vamos atualizar e conferir o <strong>totem</strong> e o <strong>painel de chamadas</strong>. Leva poucos minutos. Primeiro, conte quem você é:</p>
      <div>
        <label className="field"><span>Seu nome</span>
          <input id="f-nome" type="text" value={f.contactName} onChange={set("contactName")} autoComplete="name" maxLength={160} aria-invalid={!!errors.contactName} aria-describedby={errors.contactName ? "e-nome" : undefined} />
        </label>
        {errors.contactName && <p id="e-nome" className="field-error"><Icon name="alert" size={16} />{errors.contactName}</p>}
      </div>
      <div>
        <label className="field"><span>Nome da empresa</span>
          <input id="f-empresa" type="text" value={f.company} onChange={set("company")} autoComplete="organization" maxLength={160} aria-invalid={!!errors.company} aria-describedby={errors.company ? "e-empresa" : undefined} />
        </label>
        {errors.company && <p id="e-empresa" className="field-error"><Icon name="alert" size={16} />{errors.company}</p>}
      </div>
      {error && <Alert tone="bad" role="alert">{error}</Alert>}
      <button type="submit" className="btn primary block" disabled={busy}>{busy ? <><span className="spinner" aria-hidden /> Aguarde…</> : "Começar"}</button>
      <p className="muted small">Usamos esses dados e as fotos enviadas apenas para acompanhar e validar esta atualização.</p>
    </form>
  );
}

function FormatChoice({ current, busy, onChoose }: { current: Format | null; busy: boolean; onChoose: (f: Format) => void }) {
  const cards: { f: Format; icon: IconName; title: string; text: string }[] = [
    { f: "TEXTO", icon: "file", title: "Tutorial por escrito", text: "Siga as instruções passo a passo, com imagens ilustrativas e orientações objetivas." },
    { f: "VIDEO", icon: "play", title: "Tutorial em vídeo", text: "Assista à demonstração e acompanhe o procedimento visualmente, observando cada ação." },
  ];
  return (
    <div className="stack">
      <p>Como você prefere acompanhar? Pode trocar a qualquer momento sem perder o progresso.</p>
      <fieldset className="choice">
        <legend className="visually-hidden">Formato do tutorial</legend>
        {cards.map((c) => (
          <label key={c.f} className="opt">
            <input type="radio" name="formato" value={c.f} checked={current === c.f} disabled={busy} onChange={() => onChoose(c.f)} />
            <Icon name={c.icon} />
            <strong>{c.title}</strong>
            <span className="muted">{c.text}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

// ───────── enquadramento ─────────

const FRAMING_BADGE: Record<Framing, { tone: string; icon: IconName; text: string }> = {
  NAO_VERIFICADO: { tone: "", icon: "clock", text: "Não verificado" },
  CORRETO: { tone: "ok", icon: "checkCircle", text: "Você confirmou: correto" },
  INCORRETO: { tone: "bad", icon: "alert", text: "Ajuste necessário" },
  PRECISA_SUPORTE: { tone: "bad", icon: "alert", text: "Suporte solicitado" },
};

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
  const badge = FRAMING_BADGE[state];
  return (
    <div className="stack">
      <StepContent step={intro} format={format} />
      <div className="row between">
        <h4 style={{ margin: 0 }}>Situação da tela do {EQ[type]}</h4>
        <span className={`badge ${badge.tone}`}><Icon name={badge.icon} />{badge.text}</span>
      </div>
      {state === "CORRETO" && <Alert tone="info">Obrigado! Sua confirmação será conferida pela equipe da Intelite a partir das fotos. {confirmed && <strong>A equipe já confirmou este equipamento.</strong>}</Alert>}

      {mode === "check" && (
        <div className="stack">
          <div className="subcard stack">
            <h4 style={{ margin: 0 }}>O que precisa estar correto na tela do {EQ[type]}</h4>
            <ul className="info-list">{CRITERIA[type].map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <button type="button" className="btn primary block" disabled={busy} onClick={() => send("CORRETO")}>Está tudo certo na tela do {EQ[type]}</button>
          <button type="button" className="btn block" disabled={busy} onClick={() => send("INCORRETO")}>Minha tela está cortada ou desalinhada</button>
        </div>
      )}

      {mode === "fix" && (
        <div className="stack">
          <h4 style={{ margin: 0 }}>Minha tela está cortada ou desalinhada</h4>
          <StepContent step={fix} format={format} />
          <button type="button" className="btn primary block" disabled={busy} onClick={() => setMode("check")}>Já fiz o ajuste. Conferir a tela de novo</button>
          <button type="button" className="btn block" disabled={busy || state === "PRECISA_SUPORTE"} onClick={() => send("PRECISA_SUPORTE")}>{state === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não consegui. Preciso de suporte"}</button>
        </div>
      )}
    </div>
  );
}

// ───────── fotos ─────────

function Photos({ view, content, format, run, onView }: { view: View; content?: PublicStep; format: Format; run: Run; onView: (v: View) => void }) {
  const [uploading, setUploading] = useState<Eq | null>(null);
  const upload = async (type: Eq, file: File) => {
    setUploading(type);
    await run(async () => {
      const form = new FormData(); form.set("type", type); form.set("file", file);
      onView(await api<View>("/api/submissions/me/photos", { form }));
    });
    setUploading(null);
  };
  return (
    <div className="stack">
      <StepContent step={content} format={format} />
      {(["TOTEM", "PAINEL"] as const).map((t) => {
        const list = view.photos.filter((p) => p.type === t);
        const last = list[list.length - 1];
        return (
          <div className="subcard stack" key={t}>
            <h4 style={{ margin: 0 }}>Foto do {EQ[t]}</h4>
            {last?.review === "REFAZER" && <Alert tone="warn" role="alert"><strong>A equipe pediu outra foto: </strong><span className="user-text">{last.reviewNote}</span></Alert>}
            {list.length > 0 && (
              <ul className="row" style={{ listStyle: "none", margin: 0, padding: 0, alignItems: "flex-start" }}>
                {list.map((p) => (
                  <li key={p.id} style={{ width: 110 }}>
                    <figure><img className="refimg" src={`/api/photos/${p.id}`} alt={`Foto do ${EQ[t]} enviada`} /><figcaption>{p.review === "APROVADA" ? "Aprovada" : p.review === "REFAZER" ? "Refazer" : "Em análise"}</figcaption></figure>
                  </li>
                ))}
              </ul>
            )}
            <label className="btn primary" aria-disabled={uploading !== null}>
              {uploading === t ? <><span className="spinner" aria-hidden /> Enviando…</> : <><Icon name="camera" size={18} /> {last && last.review !== "REFAZER" ? "Enviar outra foto" : "Tirar ou escolher foto"}</>}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="visually-hidden" disabled={uploading !== null}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t, f); e.target.value = ""; }} />
            </label>
            <p role="status" className="muted small" style={{ margin: 0 }}>{uploading === t ? "Enviando a foto…" : ""}</p>
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
  const summary = (f: Framing, conf: boolean): { tone: string; icon: IconName; text: string } =>
    conf ? { tone: "ok", icon: "checkCircle", text: "Confirmado pela equipe" }
    : f === "CORRETO" ? { tone: "info", icon: "clock", text: "Declarado correto (aguardando equipe)" }
    : f === "INCORRETO" ? { tone: "bad", icon: "alert", text: "Ajuste necessário" }
    : f === "PRECISA_SUPORTE" ? { tone: "bad", icon: "alert", text: "Suporte solicitado" }
    : { tone: "", icon: "clock", text: "Não verificado" };
  return (
    <div className="stack">
      <div className="stack">
        <h4 style={{ margin: 0 }}>Resumo</h4>
        {([["Totem", summary(s.totemFraming, s.totemConfirmed)], ["Painel", summary(s.painelFraming, s.painelConfirmed)]] as const).map(([name, b]) => (
          <div key={name} className="row between"><span>{name}</span><span className={`badge ${b.tone}`}><Icon name={b.icon} />{b.text}</span></div>
        ))}
      </div>
      {submitted ? (
        <Alert tone="ok" role="status">
          <strong>Recebemos o seu envio. Obrigado!</strong><br />
          {s.status === "APROVADO" ? "A equipe confirmou a atualização." : s.status === "PRECISA_AJUSTE" ? "A equipe pediu um ajuste. Veja o aviso no topo da página." : "A equipe da Intelite vai analisar as fotos e confirmar. Se precisar de algo, avisaremos aqui: guarde este link."}
          <div style={{ marginTop: 12 }}><button type="button" className="btn sm" onClick={() => confirm("Iniciar um novo envio neste aparelho (por exemplo, outra loja)? O envio atual continua registrado.") && run(onNew)}>Iniciar outro envio (outra loja ou equipamento)</button></div>
        </Alert>
      ) : (
        <div className="stack">
          <fieldset className="stars">
            <legend>Como foi a experiência? Nota de 1 a 5</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={`opt ${n <= rating ? "on" : ""}`}>
                <input type="radio" name="nota" value={n} checked={rating === n} onChange={() => setRating(n)} />
                <Icon name="star" filled={n <= rating} />
                <span className="visually-hidden">{n} de 5</span>
              </label>
            ))}
          </fieldset>
          <label className="field"><span>Qual etapa foi mais difícil? (opcional)</span>
            <select value={hardest} onChange={(e) => setHardest(e.target.value)}><option value="">Nenhuma</option>{STEPS.slice(1, LAST).map((st) => <option key={st.key} value={st.title}>{st.title}</option>)}</select></label>
          <label className="field"><span>Comentário (opcional)</span><textarea value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} /></label>
          <button type="button" className="btn primary block" disabled={rating === 0} onClick={() => run(async () => onView(await api<View>("/api/submissions/me/submit", { body: { rating, comment: comment || undefined, hardestStep: hardest || undefined } })))}>Enviar</button>
          {rating === 0 && <p className="hint">Escolha uma nota para habilitar o envio.</p>}
        </div>
      )}
    </div>
  );
}
