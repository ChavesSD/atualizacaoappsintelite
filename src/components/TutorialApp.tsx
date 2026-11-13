"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { CRITERIA, DEFAULT_SOLUTION, FIX_KEY, SOLUTIONS, STEPS } from "@/lib/flow";
import type { GuideVideo as Guide } from "@/lib/videos";
import { BrandBar, BrandFooter } from "./Brand";
import { GuideVideo, type GuidePlayer } from "./GuideVideo";
import { Totem3D } from "./Totem3D";
import { TvArt } from "./TvArt";
import { Inline, Lines, StepContent, toBlocks, type PublicStep } from "./StepContent";
import { Alert, Icon, Skeleton, type IconName } from "./ui";

type Framing = "NAO_VERIFICADO" | "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE";

interface View {
  submission: {
    company: string; contactName: string; status: string; step: number; installed: boolean;
    framing: Framing; confirmed: boolean; rating: number | null;
  };
  photos: { id: string; review: "PENDENTE" | "APROVADA" | "REFAZER"; reviewNote: string | null }[];
  done: boolean[];
  unlocked: boolean[];
  redo: boolean;
}
interface Content { steps: PublicStep[]; guideVideo: Guide | null }
type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>;

const LAST = STEPS.length - 1;
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const firstOpen = (v: View) => (v.unlocked[v.submission.step] ? v.submission.step : Math.max(0, v.unlocked.findIndex((u, i) => u && !v.done[i])));

export function TutorialApp() {
  const [view, setView] = useState<View | null>(null);
  const [content, setContent] = useState<Content>({ steps: [], guideVideo: null });
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState("");
  const [phase, setPhase] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const load = useCallback(async () => {
    setBoot("loading");
    try {
      const [c, v] = await Promise.all([api<Content>("/api/content"), api<View | null>("/api/submissions/me")]);
      setContent(c);
      if (v) { setView(v); setPhase(firstOpen(v)); }
      setBoot("ready");
    } catch (e) {
      setBootError((e as Error).message);
      setBoot("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Ao trocar de fase: rola ao topo e leva o foco ao título (leitor de tela anuncia onde está). Não roda na abertura.
  useEffect(() => {
    if (!moved.current) return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    headRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const run: Run = useCallback(async (fn) => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, []);

  const patch = useCallback((body: object, goTo?: number) => run(async () => {
    const v = await api<View>("/api/submissions/me", { method: "PATCH", body: goTo === undefined ? body : { ...body, step: goTo } });
    setView(v);
    if (goTo !== undefined) { moved.current = true; setPhase(goTo); }
    return v;
  }), [run]);

  const byKey = useCallback((k: string) => content.steps.find((c) => c.key === k), [content.steps]);

  if (boot === "loading") {
    return (
      <>
        <BrandBar />
        <main className="shell" aria-busy="true" aria-label="Carregando">
          <div className="stack" style={{ maxWidth: 560, paddingTop: 48 }}><Skeleton h={64} r={12} /><Skeleton h={64} w="70%" r={12} /><Skeleton h={20} w="50%" /><Skeleton h={220} r={28} /></div>
        </main>
        <BrandFooter />
      </>
    );
  }
  if (boot === "error") {
    return (
      <>
        <BrandBar />
        <main className="shell">
          <div className="narrow stack" style={{ paddingTop: 32 }}>
            <Alert tone="bad" role="alert"><strong>Não foi possível abrir a página.</strong><br />{bootError}</Alert>
            <button type="button" className="btn primary" onClick={load}>Tentar de novo</button>
          </div>
        </main>
        <BrandFooter />
      </>
    );
  }

  if (!view) {
    return <Hero onCreated={(v) => { setView(v); setPhase(0); moved.current = false; window.scrollTo({ top: 0 }); }} />;
  }

  const s = view.submission;
  const submitted = s.status !== "EM_ANDAMENTO";
  const first = s.contactName.trim().split(/\s+/)[0];

  const go = (i: number) => { if (view.unlocked[i] && i !== phase) void patch({}, i); };

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <BrandBar />
      <main id="conteudo" className={`shell ${phase === 0 ? "fit-page" : "cards-page"}`} tabIndex={-1}>
        <nav aria-label="Etapas" className="steps-nav">
          <ol className="stepper">
            {STEPS.map((st, i) => {
              const locked = !view.unlocked[i];
              const isDone = submitted || (view.done[i] && i !== phase);
              const reached = (k: number) => submitted || !!view.done[k];
              return (
                <li key={st.key} className={`${i === phase ? "current" : ""} ${isDone ? "done" : ""}`}>
                  <button type="button" aria-current={i === phase ? "step" : undefined} aria-disabled={locked} onClick={() => !locked && go(i)}>
                    <span className="stp-row" aria-hidden>
                      <span className={`stp-line ${i === 0 ? "hide" : reached(i - 1) ? "on" : ""}`} />
                      <span className="stp-dot"><Icon name={STEP_ICONS[i]} size={20} /></span>
                      <span className={`stp-line ${i === STEPS.length - 1 ? "hide" : reached(i) ? "on" : ""}`} />
                    </span>
                    <span className="t">{st.short}</span>
                    <span className="visually-hidden">{locked ? " (bloqueada: conclua a etapa anterior)" : isDone ? " (concluída)" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {view.redo && phase !== 2 && (
          <div style={{ marginBottom: 20 }}><Alert tone="warn" role="alert">A equipe pediu uma nova foto da tela. <button type="button" className="btn sm" onClick={() => go(2)}>Enviar agora</button></Alert></div>
        )}
        {error && <div style={{ marginBottom: 20 }}><Alert tone="bad" role="alert">{error}</Alert></div>}

        {phase === 0 && <UpdatePhase key="p0" head={headRef} first={first} step={byKey("atualizar")} video={content.guideVideo} installed={s.installed} busy={busy} onInstalled={(v) => patch({ installed: v })} onNext={() => patch({}, 1)} />}
        {phase === 1 && <CheckPhase key="p1" head={headRef} intro={byKey("conferir")} fix={byKey(FIX_KEY)} state={s.framing} confirmed={s.confirmed} busy={busy} onFraming={(outcome) => patch({ framing: { outcome, issues: [] } })} onBack={() => go(0)} onNext={() => patch({}, 2)} canNext={view.unlocked[2]} />}
        {phase === 2 && <PhotoPhase key="p2" head={headRef} content={byKey("fotos")} view={view} run={run} onView={setView} onBack={() => go(1)} onNext={() => patch({}, 3)} />}
        {phase === 3 && <FinishPhase key="p3" head={headRef} view={view} run={run} onView={setView} submitted={submitted} onBack={() => go(2)} onNew={async () => { await api("/api/submissions/reset", { method: "POST" }); setView(null); setError(null); }} />}

      </main>
      <BrandFooter />
    </>
  );
}

// ───────── padrão de todas as etapas ─────────

/** Ícone de cada etapa na barra de progresso. */
const STEP_ICONS: IconName[] = ["download", "tv", "camera", "flag"];

/** Título e subtítulo da etapa (sempre na mesma posição); `aside` fica à direita (ex.: situação da tela). */
function PhaseHead({ head, title, sub, aside }: { head: React.RefObject<HTMLHeadingElement | null>; title: string; sub: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <header className="phase-head">
      <div className="phase-titles">
        <h1 id="h-phase" ref={head} tabIndex={-1}>{title}</h1>
        <p>{sub}</p>
      </div>
      {aside}
    </header>
  );
}

/** Barra de navegação da etapa: Voltar à esquerda; dica e botão principal à direita, sempre no mesmo lugar. */
function NavRow({ onBack, backDisabled, hint, nextLabel, onNext, nextDisabled, nextPrimary = true, nextIcon = true }: {
  onBack?: () => void; backDisabled?: boolean; hint?: React.ReactNode; nextLabel: string; onNext: () => void; nextDisabled?: boolean; nextPrimary?: boolean; nextIcon?: boolean;
}) {
  return (
    <div className="nav-row">
      {onBack ? <button type="button" className="btn ghost" disabled={backDisabled} onClick={onBack}><Icon name="arrowLeft" size={18} /> Voltar</button> : <span />}
      <span className="grow" />
      {hint && <span className="why" role="status">{hint}</span>}
      <button type="button" className={`btn ${nextPrimary ? "primary" : ""}`} disabled={nextDisabled} onClick={onNext}>{nextLabel}{nextIcon && <> <Icon name="arrowRight" size={18} /></>}</button>
    </div>
  );
}

// ───────── abertura: pergunta, solução e dados ─────────

function Hero({ onCreated }: { onCreated: (v: View) => void }) {
  const [solution, setSolution] = useState<string>(DEFAULT_SOLUTION);
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
    try { onCreated(await api<View>("/api/submissions", { body: { ...f, solution } })); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <BrandBar />
      <main id="conteudo" className="shell" tabIndex={-1}>
        <div className="hero">
          <div>
            <h1 className="display rise" style={{ "--i": 0 } as React.CSSProperties}>Quer atualizar seu app <em>Intelite</em>?</h1>
            <p className="lead rise" style={{ "--i": 1 } as React.CSSProperties}>Escolha a solução e siga o passo a passo em texto e vídeo. Leva poucos minutos.</p>
            <form className="start rise" style={{ "--i": 2 } as React.CSSProperties} onSubmit={submit} noValidate>
              <fieldset className="solutions">
                <legend className="visually-hidden">Qual solução você quer atualizar?</legend>
                <h2 aria-hidden>Qual solução?</h2>
                {SOLUTIONS.map((sol) => (
                  <label key={sol.id} className="opt sol">
                    <input type="radio" name="solucao" value={sol.id} checked={solution === sol.id} onChange={() => setSolution(sol.id)} />
                    <span className="sol-body">
                      <img className="sol-logo" src="/logo-atendimento-inteligente.png" alt={sol.name} width={298} height={76} />
                      <span className="sol-sub">{sol.description}</span>
                    </span>
                    {solution === sol.id && <span className="tick" aria-hidden><Icon name="check" /></span>}
                  </label>
                ))}
              </fieldset>
              <div className="two">
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
              </div>
              {error && <Alert tone="bad" role="alert">{error}</Alert>}
              <button type="submit" className="btn primary lg block" disabled={busy}>{busy ? <><span className="spinner" aria-hidden /> Aguarde…</> : <>Ver o passo a passo <Icon name="arrowRight" size={20} /></>}</button>
              <p className="muted small" style={{ margin: 0 }}>Usamos seu nome, sua empresa e a foto da tela só para acompanhar esta atualização.</p>
            </form>
          </div>
          <div className="hero-art rise" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="orbits" aria-hidden>
              <svg className="orbit orbit-ext" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="orbit-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200"><stop offset="0" stopColor="#2f7bff" /><stop offset=".5" stopColor="#7cc4ff" /><stop offset="1" stopColor="#3b8cff" /></linearGradient>
                </defs>
                <path d="M105.00,12.14 A88,88 0 0 1 186.66,115.28" />
                <path d="M173.59,148.26 A88,88 0 0 1 43.43,167.41" />
                <path d="M21.41,139.60 A88,88 0 0 1 69.90,17.31" />
                <circle cx="100.00" cy="12.00" r="5" />
                <circle cx="176.21" cy="144.00" r="5" />
                <circle cx="23.79" cy="144.00" r="5" />
              </svg>
              <svg className="orbit orbit-int" viewBox="0 0 200 200">
                <path d="M100.00,32.00 A68,68 0 0 1 134.00,158.89" />
                <path d="M100.00,168.00 A68,68 0 0 1 66.00,41.11" />
              </svg>
            </div>
            <Totem3D />
          </div>
        </div>
      </main>
      <BrandFooter />
    </>
  );
}

// ───────── fase 1: atualizar (vídeo + passo a passo juntos) ─────────

function UpdatePhase({ head, first, step, video, installed, busy, onInstalled, onNext }: {
  head: React.RefObject<HTMLHeadingElement | null>; first: string; step?: PublicStep; video: Guide | null; installed: boolean; busy: boolean;
  onInstalled: (v: boolean) => void; onNext: () => void;
}) {
  const player = useRef<GuidePlayer>(null);
  const [active, setActive] = useState(0);
  const blocks = useMemo(() => toBlocks(step?.instructions ?? []), [step]);
  const chapters = video?.chapters ?? [];
  const total = blocks.length;
  const cur = Math.min(active, Math.max(0, total - 1));
  const block = blocks[cur];
  const lastStep = cur === total - 1;

  // O texto mostra só o passo em andamento: o do capítulo que está tocando ou o que o cliente escolheu.
  const select = (i: number) => {
    const n = Math.max(0, Math.min(total - 1, i));
    setActive(n);
    if (chapters[n]) player.current?.seek(chapters[n].start, false);
  };

  return (
    <section className="phase fit" aria-labelledby="h-phase">
      <PhaseHead head={head} title="Atualizar o aplicativo" sub={<>Oi, <span className="user-text">{first}</span>! Assista ao vídeo ou leia: o passo ao lado acompanha o que está passando.</>} />
      <div className="fit-grid">
        <div className="fit-video">
          {video
            ? <GuideVideo ref={player} video={video} active={cur} onChapter={setActive} />
            : step?.video
              ? <div className="player"><iframe src={step.video.src} title={step.video.title} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" /></div>
              : <div className="player-empty"><div><Icon name="play" size={32} /><p style={{ margin: "8px 0 0" }}><strong>O vídeo completo está sendo preparado.</strong><br />Enquanto isso, siga o passo a passo escrito.</p></div></div>}
        </div>

        <section className="stepbox" aria-label={block ? `Passo ${cur + 1} de ${total}: ${block.heading ?? ""}` : "Passo a passo"}>
          {!step && <Alert tone="info">O conteúdo desta etapa ainda está sendo preparado pela equipe da Intelite.</Alert>}
          {block && (
            <>
              <div className="stepbox-head">
                <span className="sub-num" aria-hidden>{cur + 1}</span>
                <div className="grow">
                  <span className="stepbox-count">Passo {cur + 1} de {total}</span>
                  <h2>{block.heading ?? `Passo ${cur + 1}`}</h2>
                </div>
              </div>
              <div className="stepbox-body" key={cur} tabIndex={0} role="region" aria-label={`Instruções do passo ${cur + 1}`}>
                <Lines items={block.items} />
                {lastStep && step?.warning && <Alert tone="info" role="note"><Inline text={step.warning} /></Alert>}
                {lastStep && step?.imagePath && <img className="refimg" loading="lazy" src={`/api/assets/${step.imagePath}`} alt={`Imagem de referência: ${step.title}`} />}
              </div>
              <div className="stepbox-nav">
                {!video && total > 1 && (
                  <ol className="dots" aria-label="Passos">
                    {blocks.map((b, i) => <li key={i}><button type="button" aria-current={i === cur ? "step" : undefined} aria-label={`Passo ${i + 1}: ${b.heading ?? ""}`} onClick={() => select(i)}>{i + 1}</button></li>)}
                  </ol>
                )}
                {lastStep ? (
                  <label className="check">
                    <input type="checkbox" checked={installed} disabled={busy} onChange={(e) => onInstalled(e.target.checked)} />
                    <span>Terminei a atualização e o aplicativo abriu.</span>
                  </label>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
      <NavRow onBack={() => select(cur - 1)} backDisabled={cur === 0}
        hint={lastStep && !installed ? "Marque “Terminei a atualização” para continuar." : undefined}
        nextLabel={lastStep ? "Continuar" : "Próximo passo"} onNext={() => (lastStep ? onNext() : select(cur + 1))} nextDisabled={lastStep ? busy || !installed : false} />
    </section>
  );
}

// ───────── fase 2: conferir a tela ─────────

const FRAMING_BADGE: Record<Framing, { tone: string; icon: IconName; text: string }> = {
  NAO_VERIFICADO: { tone: "", icon: "clock", text: "Ainda não conferida" },
  CORRETO: { tone: "ok", icon: "checkCircle", text: "Você confirmou: está correta" },
  INCORRETO: { tone: "warn", icon: "alert", text: "Ajuste necessário" },
  PRECISA_SUPORTE: { tone: "bad", icon: "alert", text: "Suporte solicitado" },
};

function CheckPhase({ head, intro, fix, state, confirmed, busy, onFraming, onBack, onNext, canNext }: {
  head: React.RefObject<HTMLHeadingElement | null>; intro?: PublicStep; fix?: PublicStep; state: Framing; confirmed: boolean; busy: boolean;
  onFraming: (o: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE") => void; onBack: () => void; onNext: () => void; canNext: boolean;
}) {
  // Com problema aberto, o cliente já vê o tutorial de ajuste; senão, vê a lista do que precisa estar correto.
  const [mode, setMode] = useState<"check" | "fix">(state === "INCORRETO" || state === "PRECISA_SUPORTE" ? "fix" : "check");
  const send = (outcome: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE") => { onFraming(outcome); setMode(outcome === "CORRETO" ? "check" : "fix"); };
  const badge = FRAMING_BADGE[state];
  return (
    <section className="phase" aria-labelledby="h-phase">
      <PhaseHead head={head} title={mode === "fix" ? "Minha tela está cortada ou desalinhada" : "Como sua tela está?"}
        sub={mode === "fix" ? "Siga o tutorial de ajuste e depois confira a tela de novo." : "Olhe para a tela do equipamento e escolha a imagem que mais se parece com ela."}
        aside={<span className={`badge ${badge.tone}`}><Icon name={badge.icon} />{badge.text}</span>} />

      {mode === "check" && (
        <>
          <div className="tvchoices" role="group" aria-label="Como sua tela está?">
            <button type="button" className="tvchoice bad" aria-pressed={state === "INCORRETO" || state === "PRECISA_SUPORTE"} disabled={busy} onClick={() => send("INCORRETO")}>
              <TvArt variant="cut" />
              <span className="tvchoice-text"><Icon name="alert" /><strong>Cortada ou desalinhada</strong><span className="d">Bordas escondidas, textos cortados ou a imagem fora do lugar. Mostramos como ajustar.</span></span>
            </button>
            <button type="button" className="tvchoice good" aria-pressed={state === "CORRETO"} disabled={busy} onClick={() => send("CORRETO")}>
              <TvArt variant="ok" />
              <span className="tvchoice-text"><Icon name="checkCircle" /><strong>Está tudo certo</strong><span className="d">Tudo aparece dentro da tela, com as quatro bordas visíveis. Siga para a foto.</span></span>
            </button>
          </div>
        </>
      )}
      <div className="duo">
        {mode === "fix" && (
          <>
            <div className="stack duo-card" tabIndex={0} role="region" aria-label="Tutorial de ajuste da tela">
              <StepContent step={fix} />
            </div>
            <div className="stack duo-card" tabIndex={0} role="region" aria-label="Depois de ajustar">
              <h2 className="duo-title">Depois de ajustar</h2>
              <p className="muted" style={{ margin: 0 }}>Volte e confira se agora a tela aparece inteira, com as quatro bordas visíveis. Se não conseguir ajustar, a equipe da Intelite ajuda.</p>
              <button type="button" className="btn primary lg block" disabled={busy} onClick={() => setMode("check")}>Já fiz o ajuste. Conferir a tela de novo</button>
              <button type="button" className="btn block" disabled={busy || state === "PRECISA_SUPORTE"} onClick={() => send("PRECISA_SUPORTE")}>{state === "PRECISA_SUPORTE" ? "Suporte solicitado: a equipe vai ajudar" : "Não consegui. Preciso de suporte"}</button>
            </div>
          </>
        )}
      </div>

      <NavRow onBack={mode === "fix" ? () => setMode("check") : onBack}
        hint={mode === "fix" ? "Termine o ajuste e confira a tela de novo." : state === "CORRETO" ? <>Obrigado! A equipe da Intelite vai conferir pela foto.{confirmed && <strong> A equipe já confirmou.</strong>}</> : !canNext ? "Escolha uma opção para continuar." : undefined}
        nextLabel="Continuar" onNext={onNext} nextDisabled={busy || !canNext} />
    </section>
  );
}

// ───────── fase 3: foto ─────────

function PhotoPhase({ head, content, view, run, onView, onBack, onNext }: {
  head: React.RefObject<HTMLHeadingElement | null>; content?: PublicStep; view: View; run: Run; onView: (v: View) => void; onBack: () => void; onNext: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    setUploading(true);
    await run(async () => {
      const form = new FormData(); form.set("file", file);
      onView(await api<View>("/api/submissions/me/photos", { form }));
    });
    setUploading(false);
  };
  const redo = view.photos.filter((p) => p.review === "REFAZER").at(-1);
  return (
    <section className="phase" aria-labelledby="h-phase">
      <PhaseHead head={head} title="Enviar uma foto" sub="A equipe confere o enquadramento pela foto da tela." />
      <div className="duo">
        <div className="stack duo-card" tabIndex={0} role="region" aria-label="Orientações para a foto">
          <StepContent step={content} />
          {view.redo && redo && <Alert tone="warn" role="alert"><strong>A equipe pediu outra foto: </strong><span className="user-text">{redo.reviewNote}</span></Alert>}
        </div>
        <div className="stack duo-card" tabIndex={0} role="region" aria-label="Enviar a foto">
          <label className="drop" aria-disabled={uploading}>
            {uploading ? <span className="spinner" aria-hidden /> : <Icon name="camera" />}
            <strong>{uploading ? "Enviando…" : view.photos.length > 0 ? "Enviar outra foto" : "Tirar ou escolher uma foto"}</strong>
            <span className="muted small">JPG, PNG ou WebP, até 12 MB</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="visually-hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
          <p role="status" className="muted small" style={{ margin: 0 }}>{uploading ? "Enviando a foto…" : ""}</p>
          {view.photos.length > 0 && (
            <ul className="shots" aria-label="Fotos enviadas">
              {view.photos.map((p, i) => (
                <li key={p.id} className="shot">
                  <img src={`/api/photos/${p.id}`} alt={`Foto ${i + 1} da tela enviada`} />
                  <span className={`badge ${p.review === "APROVADA" ? "ok" : p.review === "REFAZER" ? "warn" : ""}`}>{p.review === "APROVADA" ? "Aprovada" : p.review === "REFAZER" ? "Refazer" : "Em análise"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <NavRow onBack={onBack} hint={!view.unlocked[3] ? "Envie uma foto para continuar." : undefined} nextLabel="Continuar" onNext={onNext} nextDisabled={!view.unlocked[3]} />
    </section>
  );
}

// ───────── fase 4: finalizar ─────────

function FinishPhase({ head, view, run, onView, submitted, onBack, onNew }: {
  head: React.RefObject<HTMLHeadingElement | null>; view: View; run: Run; onView: (v: View) => void; submitted: boolean; onBack: () => void; onNew: () => Promise<void>;
}) {
  const [rating, setRating] = useState(view.submission.rating ?? 0);
  const [hardest, setHardest] = useState("");
  const [comment, setComment] = useState("");
  const s = view.submission;
  const framing = s.confirmed ? { tone: "ok", icon: "checkCircle" as IconName, text: "Confirmada pela equipe" }
    : s.framing === "CORRETO" ? { tone: "info", icon: "clock" as IconName, text: "Declarada correta (a equipe vai conferir)" }
    : s.framing === "PRECISA_SUPORTE" ? { tone: "bad", icon: "alert" as IconName, text: "Suporte solicitado" }
    : { tone: "", icon: "clock" as IconName, text: "Ainda não conferida" };

  const sendRating = () => run(async () => onView(await api<View>("/api/submissions/me/submit", { body: { rating, comment: comment || undefined, hardestStep: hardest || undefined } })));

  if (submitted) {
    return (
      <section className="phase" aria-labelledby="h-phase">
        <PhaseHead head={head} title="Recebemos o seu envio. Obrigado!" sub="Seu envio foi registrado." />
        <div className="duo" role="status">
          <div className="duo-card done-card">
            <span className="big" aria-hidden><Icon name="check" /></span>
            <p style={{ margin: 0 }}>{s.status === "APROVADO" ? "A equipe confirmou a atualização." : s.status === "PRECISA_AJUSTE" ? "A equipe pediu um ajuste. Veja o aviso no topo da página." : "A equipe da Intelite vai analisar a foto e confirmar. Se precisar de algo, avisaremos aqui: guarde este link."}</p>
          </div>
          <div className="duo-card stack" tabIndex={0} role="region" aria-label="Resumo">
            <h2 className="duo-title">Resumo</h2>
            <ul className="recap">
              <li><span>Aplicativo atualizado</span><span className="badge ok"><Icon name="checkCircle" />Feito</span></li>
              <li><span>Tela</span><span className={`badge ${framing.tone}`}><Icon name={framing.icon} />{framing.text}</span></li>
            </ul>
          </div>
        </div>
        <NavRow nextLabel="Atualizar outra loja ou equipamento" nextPrimary={false} nextIcon={false} onNext={() => confirm("Iniciar um novo envio neste aparelho (por exemplo, outra loja)? O envio atual continua registrado.") && run(onNew)} />
      </section>
    );
  }
  return (
    <section className="phase" aria-labelledby="h-phase">
      <PhaseHead head={head} title="Finalizar" sub="Falta só avaliar. Conte como foi, em um toque." />
      <div className="duo">
        <div className="duo-card" tabIndex={0} role="region" aria-label="Resumo">
          <h2 className="duo-title">Resumo</h2>
          <ul className="recap">
            <li><span>Aplicativo atualizado</span><span className="badge ok"><Icon name="checkCircle" />Feito</span></li>
            <li><span>Tela</span><span className={`badge ${framing.tone}`}><Icon name={framing.icon} />{framing.text}</span></li>
            <li><span>Foto enviada</span><span className="badge ok"><Icon name="checkCircle" />{view.photos.length} foto{view.photos.length === 1 ? "" : "s"}</span></li>
          </ul>
        </div>
        <div className="stack duo-card" tabIndex={0} role="region" aria-label="Avaliação">
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
            <select value={hardest} onChange={(e) => setHardest(e.target.value)}><option value="">Nenhuma</option>{STEPS.slice(0, LAST).map((st) => <option key={st.key} value={st.title}>{st.title}</option>)}</select></label>
          <label className="field"><span>Comentário (opcional)</span><textarea value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} /></label>
        </div>
      </div>
      <NavRow onBack={onBack} hint={rating === 0 ? "Escolha uma nota para habilitar o envio." : undefined} nextLabel="Enviar" nextIcon={false} onNext={sendRating} nextDisabled={rating === 0} />
    </section>
  );
}
