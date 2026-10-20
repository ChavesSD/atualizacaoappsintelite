"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { FRAMING_STATUS_LABEL, ISSUE_LABEL } from "@/domain/framing";
import { StepBody, type StepPayload } from "@/components/StepBody";

type Format = "TEXTO" | "VIDEO";
type EqType = "TOTEM" | "PAINEL";
type Status = keyof typeof FRAMING_STATUS_LABEL;

interface Check {
  id: string; type: EqType; status: Status; technicalStatus: "PENDENTE" | "VALIDADO" | "REJEITADO";
  technicalNotes: string | null; openIssues: string[]; verifiedAt: string | null;
}
interface Evidence { id: string; type: EqType; review: "PENDENTE" | "ACEITA" | "NOVA_FOTO_SOLICITADA"; reviewReason: string | null; uploadedAt: string }
interface State {
  unit: { name: string; code: string; city: string | null };
  session: { initialFormat: Format | null; currentFormat: Format | null; currentStepKey: string; status: string };
  steps: { key: string; title: string; kind: string; type: EqType | null; completed: boolean; reachable: boolean }[];
  checks: Check[]; evidences: Evidence[]; photoRequests: EqType[]; pendencies: string[];
  operational: { status: string; pending: string[] };
  evaluation: { rating: number } | null;
}
interface Procedure { id: string; title: string; adjustmentType: string; steps: { text: string; warning?: string; highlight?: string }[]; parameters: Record<string, string> | null }
type Content = StepPayload & { framing: { criteria: { id: string; label: string; required: boolean }[]; procedures: Procedure[] } | null };

const EQ_LABEL: Record<EqType, string> = { TOTEM: "totem", PAINEL: "painel de chamadas" };
const ISSUES: Record<EqType, string[]> = {
  TOTEM: ["TEXTO_CORTADO", "BOTAO_CORTADO", "LOGOTIPO_CORTADO", "INTERFACE_DESLOCADA", "BARRAS_OU_MARGENS", "CONTEUDO_FORA_DA_AREA", "PROPORCAO_INCORRETA", "OUTRO"],
  PAINEL: ["SENHA_CORTADA", "IDENTIFICACAO_CORTADA", "INTERFACE_DESLOCADA", "CONTEUDO_FORA_DA_AREA", "PROPORCAO_INCORRETA", "BARRAS_OU_MARGENS", "OUTRO"],
};
const ADJ_LABEL: Record<string, string> = {
  RESOLUCAO: "Resolução de tela", ESCALA: "Escala de exibição", DPI: "Ajuste de DPI", ORIENTACAO: "Orientação da tela",
  PROPORCAO: "Proporção da imagem", OVERSCAN_ZOOM_MONITOR: "Overscan / zoom do monitor", CONFIG_APLICATIVO: "Configuração do aplicativo",
};
const STATUS_TONE: Record<Status, string> = {
  NAO_VERIFICADO: "", CORRETO: "ok", INCORRETO: "bad", AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO: "warn", PRECISA_SUPORTE: "bad",
};

export function TutorialApp() {
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState<string>("identificacao");
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const apply = useCallback((s: State, jump = true) => {
    setState(s);
    if (jump) setView(s.session.currentStepKey);
  }, []);

  useEffect(() => {
    api<State>("/api/client/session").then((s) => apply(s)).catch((e) => {
      if (/identificado/i.test(e.message)) window.location.href = "/";
      else setError(e.message);
    });
  }, [apply]);

  // Conteúdo da etapa em exibição (recarrega ao trocar de etapa e quando o estado do equipamento muda).
  const stepStateKey = state ? JSON.stringify(state.checks.map((c) => [c.status, c.openIssues])) : "";
  useEffect(() => {
    if (!state) return;
    let live = true;
    setContent(null);
    api<Content>(`/api/client/steps/${view}/content`).then((c) => live && setContent(c)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [view, stepStateKey, !!state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, [view]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!state) return <main className="container">{error ? <div className="alert bad">{error}</div> : <p>Carregando…</p>}</main>;

  const idx = state.steps.findIndex((s) => s.key === view);
  const step = state.steps[idx];
  const format: Format = state.session.currentFormat ?? "TEXTO";
  const done = state.steps.filter((s) => s.completed).length;
  const finished = state.session.status === "CONCLUIDA_PELO_CLIENTE";

  const go = (key: string) => run(async () => { apply(await api<State>("/api/client/session/step", { body: { stepKey: key } })); });
  const complete = () => run(async () => apply(await api<State>(`/api/client/steps/${view}/complete`, { method: "POST" })));
  const setFormat = (f: Format) => run(async () => apply(await api<State>("/api/client/session/format", { body: { format: f } }), false));
  const refresh = (s: State) => apply(s, false);
  const prev = idx > 0 && state.steps[idx - 1].reachable ? state.steps[idx - 1].key : null;

  return (
    <>
      <div className="topbar">
        <div className="container" style={{ paddingBlock: 10 }}>
          <div className="row between">
            <div className="grow">
              <strong>{state.unit.name}</strong>
              <div className="muted small">Etapa {idx + 1} de {state.steps.length}: {step.title}</div>
            </div>
            <button className="btn sm" onClick={() => setHelp(true)}>Preciso de ajuda</button>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={state.steps.length} aria-valuenow={done} aria-label="Progresso"><i style={{ width: `${(done / state.steps.length) * 100}%` }} /></div>
          <nav className="stepper" aria-label="Etapas">
            {state.steps.map((s, i) => (
              <button key={s.key} disabled={!s.reachable || busy} className={s.completed ? "done" : ""} aria-current={s.key === view ? "step" : undefined} onClick={() => go(s.key)}>
                {s.completed ? "✓ " : `${i + 1}. `}{shortTitle(s)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="container" style={{ paddingBottom: 110 }}>
        <div ref={top} />
        {state.photoRequests.length > 0 && view !== "fotos" && (
          <div className="alert warn" role="alert" style={{ marginBottom: 12 }}>
            A equipe da Intelite pediu uma nova foto do {state.photoRequests.map((t) => EQ_LABEL[t]).join(" e do ")}.{" "}
            <button className="btn sm" onClick={() => go("fotos")}>Enviar agora</button>
          </div>
        )}
        {state.checks.some((c) => c.technicalStatus === "REJEITADO") && view !== "enquadramento-totem" && view !== "enquadramento-painel" && (
          <div className="alert bad" role="alert" style={{ marginBottom: 12 }}>
            A equipe técnica não validou o enquadramento de um equipamento. Abra a etapa correspondente para ver o motivo e verificar novamente.
          </div>
        )}
        <h1>{step.title}</h1>
        {error && <div className="alert bad" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

        {step.kind !== "FORMATO" && step.kind !== "IDENTIFICACAO" && (
          <FormatSwitch format={format} disabled={busy} onChange={setFormat} />
        )}

        {step.kind === "IDENTIFICACAO" && (
          <div className="card stack">
            <div><span className="muted small">Unidade</span><div><strong>{state.unit.name}</strong></div></div>
            <div className="row"><div><span className="muted small">Código</span><div><strong>{state.unit.code}</strong></div></div>
              {state.unit.city && <div><span className="muted small">Cidade</span><div><strong>{state.unit.city}</strong></div></div>}</div>
          </div>
        )}

        {step.kind === "FORMATO" && <FormatChoice current={state.session.currentFormat} disabled={busy} onChoose={setFormat} />}

        {step.kind !== "FORMATO" && (
          <div className="card">{content ? <StepBody data={content} format={format} /> : <p className="muted">Carregando instruções…</p>}</div>
        )}

        {step.kind === "ATUALIZACAO" && <p className="muted small">Quando terminar a atualização, toque em “Concluí esta etapa”. Não é necessário assistir ao vídeo inteiro.</p>}

        {step.kind === "ENQUADRAMENTO" && step.type && content?.framing && (
          <FramingPanel
            key={step.type}
            type={step.type}
            stepKey={step.key}
            check={state.checks.find((c) => c.type === step.type)!}
            framing={content.framing}
            busy={busy}
            run={run}
            onState={refresh}
          />
        )}

        {step.kind === "FOTOS" && <PhotosPanel state={state} run={run} onState={refresh} />}
        {step.kind === "AVALIACAO" && <EvaluationPanel state={state} run={run} onState={refresh} />}
      </main>

      {step.kind !== "AVALIACAO" && (
        <div className="footer-nav">
          <button className="btn" disabled={!prev || busy} onClick={() => prev && go(prev)}>← Voltar</button>
          <button className="btn primary" disabled={busy || !canContinue(state, step.kind, step.type)} onClick={complete}>
            {step.kind === "ATUALIZACAO" ? "Concluí esta etapa →" : "Continuar →"}
          </button>
        </div>
      )}
      {finished && step.kind === "AVALIACAO" && <div className="footer-nav"><button className="btn" onClick={() => prev && go(prev)}>← Voltar</button></div>}

      {help && <HelpDialog stepKey={view} type={step.type} onClose={() => setHelp(false)} run={run} onState={refresh} />}
    </>
  );
}

const shortTitle = (s: { kind: string; type: EqType | null; title: string }) =>
  s.kind === "IDENTIFICACAO" ? "Unidade" : s.kind === "FORMATO" ? "Formato"
  : s.kind === "ATUALIZACAO" ? `Atualizar ${s.type === "TOTEM" ? "totem" : "painel"}`
  : s.kind === "ENQUADRAMENTO" ? `Tela do ${s.type === "TOTEM" ? "totem" : "painel"}`
  : s.kind === "FOTOS" ? "Fotos" : "Avaliação";

function canContinue(state: State, kind: string, type: EqType | null): boolean {
  if (kind === "FORMATO") return !!state.session.currentFormat;
  if (kind === "ENQUADRAMENTO" && type) {
    const c = state.checks.find((x) => x.type === type)!;
    return c.status === "CORRETO" || c.status === "PRECISA_SUPORTE";
  }
  if (kind === "FOTOS") return !state.pendencies.some((p) => /foto/i.test(p));
  return true;
}

// ───────────── formato ─────────────

function FormatChoice({ current, disabled, onChoose }: { current: Format | null; disabled: boolean; onChoose: (f: Format) => void }) {
  return (
    <div className="stack">
      <p>Como você prefere acompanhar o procedimento? Você pode trocar a qualquer momento sem perder o progresso.</p>
      <div className="choice" role="group" aria-label="Formato do tutorial">
        <button type="button" aria-pressed={current === "TEXTO"} disabled={disabled} onClick={() => onChoose("TEXTO")}>
          <span className="ico" aria-hidden>📄</span>
          <strong>Tutorial por escrito</strong>
          <span className="muted">Siga as instruções passo a passo, com imagens ilustrativas e orientações objetivas.</span>
        </button>
        <button type="button" aria-pressed={current === "VIDEO"} disabled={disabled} onClick={() => onChoose("VIDEO")}>
          <span className="ico" aria-hidden>🎬</span>
          <strong>Tutorial em vídeo</strong>
          <span className="muted">Assista à demonstração e acompanhe o procedimento visualmente, observando cada ação.</span>
        </button>
      </div>
    </div>
  );
}

function FormatSwitch({ format, disabled, onChange }: { format: Format; disabled: boolean; onChange: (f: Format) => void }) {
  return (
    <div className="row" style={{ marginBottom: 12 }}>
      <span className="muted small">Formato:</span>
      <div role="group" aria-label="Alternar formato" className="row" style={{ gap: 6 }}>
        {(["TEXTO", "VIDEO"] as const).map((f) => (
          <button key={f} className={`btn sm ${format === f ? "primary" : ""}`} aria-pressed={format === f} disabled={disabled} onClick={() => format !== f && onChange(f)}>
            {f === "TEXTO" ? "📄 Texto" : "🎬 Vídeo"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────── enquadramento ─────────────

type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>;

function FramingPanel({ type, stepKey, check, framing, busy, run, onState }: {
  type: EqType; stepKey: string; check: Check; framing: NonNullable<Content["framing"]>; busy: boolean; run: Run; onState: (s: State) => void;
}) {
  const [mode, setMode] = useState<"check" | "problem" | "fix">(
    check.status === "NAO_VERIFICADO" || check.status === "CORRETO" ? "check" : check.status === "AJUSTE_REALIZADO_AGUARDANDO_VERIFICACAO" ? "check" : "fix",
  );
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [proc, setProc] = useState<string | undefined>();
  const allOk = framing.criteria.filter((c) => c.required).every((c) => ok[c.id]);
  const criteria = framing.criteria.map((c) => ({ criterionId: c.id, ok: !!ok[c.id] }));
  const send = (outcome: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE") =>
    run(async () => {
      const s = await api<State>(`/api/client/framing/${type}`, { body: { outcome, criteria, issues: outcome === "CORRETO" ? [] : (issues.length ? issues : check.openIssues).map((t) => ({ type: t })), notes: notes || undefined } });
      onState(s);
      setOk({}); setIssues([]);
      setMode(outcome === "CORRETO" ? "check" : "fix");
    });

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Situação do {EQ_LABEL[type]}</h2>
          <span className={`badge ${STATUS_TONE[check.status]}`}>{FRAMING_STATUS_LABEL[check.status]}</span>
        </div>
        <div className="small muted">
          Sua verificação: <strong>{FRAMING_STATUS_LABEL[check.status]}</strong> · Validação técnica da Intelite:{" "}
          <strong>{check.technicalStatus === "VALIDADO" ? "validado" : check.technicalStatus === "REJEITADO" ? "não validado" : "pendente"}</strong>
        </div>
        {check.status === "CORRETO" && check.technicalStatus !== "VALIDADO" && (
          <div className="alert info small">Obrigado! O enquadramento será confirmado pela equipe técnica a partir das fotos que você enviar. Sua confirmação não substitui essa validação.</div>
        )}
        {check.technicalStatus === "REJEITADO" && (
          <div className="alert bad small" role="alert"><strong>A equipe técnica não validou: </strong>{check.technicalNotes}. Verifique novamente abaixo.</div>
        )}
      </div>

      {mode === "check" && (
        <div className="card stack">
          <h2>Verificar o enquadramento</h2>
          <p className="muted">Olhe para a tela do {EQ_LABEL[type]} agora e confirme cada item.</p>
          {framing.criteria.map((c) => (
            <label key={c.id} className={`check ${ok[c.id] ? "on" : ""}`}>
              <input type="checkbox" checked={!!ok[c.id]} onChange={(e) => setOk({ ...ok, [c.id]: e.target.checked })} />
              <span>{c.label}</span>
            </label>
          ))}
          <button className="btn primary block" disabled={busy || !allOk} onClick={() => send("CORRETO")}>Está tudo certo na tela do {EQ_LABEL[type]}</button>
          <button className="btn block" disabled={busy} onClick={() => setMode("problem")}>Minha tela está cortada ou desalinhada</button>
        </div>
      )}

      {mode === "problem" && (
        <div className="card stack">
          <h2>Minha tela está cortada ou desalinhada</h2>
          <p className="muted">O que você observa? Marque todos os que se aplicam.</p>
          {ISSUES[type].map((i) => (
            <label key={i} className={`check ${issues.includes(i) ? "on" : ""}`}>
              <input type="checkbox" checked={issues.includes(i)} onChange={(e) => setIssues(e.target.checked ? [...issues, i] : issues.filter((x) => x !== i))} />
              <span>{ISSUE_LABEL[i]}</span>
            </label>
          ))}
          <label className="field"><span>Observações (opcional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></label>
          <button className="btn primary block" disabled={busy || issues.length === 0} onClick={() => send("INCORRETO")}>Ver instruções de correção</button>
          <button className="btn block" disabled={busy} onClick={() => setMode("check")}>Voltar à verificação</button>
        </div>
      )}

      {mode === "fix" && (
        <div className="card stack">
          <h2>Minha tela está cortada ou desalinhada</h2>
          {check.openIssues.length > 0 && <p>Problemas registrados: {check.openIssues.map((i) => ISSUE_LABEL[i]).join(", ")}.</p>}
          {framing.procedures.length === 0 ? (
            <div className="alert warn">
              Ainda não há um procedimento oficial cadastrado para este caso. Para evitar ajustes incorretos, não altere configurações por conta própria: use “Preciso de ajuda” para falar com o suporte.
            </div>
          ) : (
            framing.procedures.map((p) => (
              <details key={p.id} open={framing.procedures.length === 1} className="card" style={{ margin: 0 }}>
                <summary><strong>{p.title}</strong> <span className="badge info">{ADJ_LABEL[p.adjustmentType] ?? p.adjustmentType}</span></summary>
                <div className="stack" style={{ marginTop: 12 }}>
                  {p.parameters && (
                    <div className="tablewrap"><table><tbody>
                      {Object.entries(p.parameters).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
                    </tbody></table></div>
                  )}
                  <ol className="steps">
                    {p.steps.map((s, i) => (
                      <li key={i}><div className="grow stack"><div>{s.text}{s.highlight && <> <span className="hl">{s.highlight}</span></>}</div>
                        {s.warning && <div className="alert warn small"><strong>Atenção: </strong>{s.warning}</div>}</div></li>
                    ))}
                  </ol>
                  <label className="check"><input type="radio" name={`proc-${type}`} checked={proc === p.id} onChange={() => setProc(p.id)} /><span>Segui este procedimento</span></label>
                </div>
              </details>
            ))
          )}
          <button className="btn primary block" disabled={busy || (framing.procedures.length > 0 && !proc)} onClick={() => run(async () => {
            onState(await api<State>(`/api/client/framing/${type}/adjustment`, { body: { procedureId: proc } }));
            setMode("check");
          })}>
            Já fiz o ajuste — verificar novamente
          </button>
          <button className="btn block" disabled={busy} onClick={() => setMode("problem")}>Corrigir os problemas informados</button>
          <button className="btn block" disabled={busy || check.status === "PRECISA_SUPORTE"} onClick={() => send("PRECISA_SUPORTE")}>
            {check.status === "PRECISA_SUPORTE" ? "Suporte solicitado" : "Não consegui — preciso de suporte"}
          </button>
        </div>
      )}

      {mode === "check" && check.status !== "NAO_VERIFICADO" && check.status !== "CORRETO" && (
        <p><button className="btn sm" onClick={() => setMode("fix")}>Consultar novamente as instruções de correção</button></p>
      )}
      {mode === "check" && check.status === "CORRETO" && check.openIssues.length === 0 && <p className="muted small">Você pode refazer a verificação a qualquer momento.</p>}
      <span className="visually-hidden">{stepKey}</span>
    </div>
  );
}

// ───────────── fotos ─────────────

function PhotosPanel({ state, run, onState }: { state: State; run: Run; onState: (s: State) => void }) {
  const upload = (type: EqType, file: File) =>
    run(async () => {
      const form = new FormData();
      form.set("type", type);
      form.set("file", file);
      await api("/api/client/evidence", { form });
      onState(await api<State>("/api/client/session"));
    });
  return (
    <div className="stack">
      {(["TOTEM", "PAINEL"] as const).map((t) => {
        const list = state.evidences.filter((e) => e.type === t);
        const latest = list[list.length - 1];
        const requested = state.photoRequests.includes(t);
        return (
          <div className="card stack" key={t}>
            <h2>Foto do {EQ_LABEL[t]}</h2>
            {requested && latest?.reviewReason && <div className="alert warn" role="alert"><strong>A equipe pediu outra foto: </strong>{latest.reviewReason}</div>}
            <p className="muted small">Mostre a tela inteira, de frente, com as bordas visíveis e sem cortar a interface.</p>
            <div className="row">
              {list.map((e) => (
                <figure key={e.id} style={{ width: 120 }}>
                  <img className="refimg" src={`/api/client/evidence/${e.id}`} alt={`Foto do ${EQ_LABEL[t]} enviada`} />
                  <figcaption>{e.review === "NOVA_FOTO_SOLICITADA" ? "Nova foto solicitada" : e.review === "ACEITA" ? "Aceita pela equipe" : "Aguardando análise"}</figcaption>
                </figure>
              ))}
            </div>
            <label className="btn primary" style={{ cursor: "pointer" }}>
              {latest && !requested ? "Enviar outra foto" : "Tirar ou escolher foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="visually-hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t, f); e.target.value = ""; }} />
            </label>
          </div>
        );
      })}
    </div>
  );
}

// ───────────── avaliação ─────────────

function EvaluationPanel({ state, run, onState }: { state: State; run: Run; onState: (s: State) => void }) {
  const [rating, setRating] = useState(state.evaluation?.rating ?? 0);
  const [hardest, setHardest] = useState("");
  const [comment, setComment] = useState("");
  const finished = state.session.status === "CONCLUIDA_PELO_CLIENTE";
  const op = state.operational.status;

  if (finished) {
    return (
      <div className="stack">
        <div className="alert ok"><strong>Recebemos a sua confirmação. Obrigado!</strong></div>
        <div className={`alert ${op === "CONCLUIDA_OPERACIONALMENTE" ? "ok" : "info"}`}>
          {op === "CONCLUIDA_OPERACIONALMENTE" && "A equipe técnica validou os dois equipamentos. A atualização está concluída."}
          {op === "AGUARDANDO_VALIDACAO_TECNICA" && "Agora a equipe técnica da Intelite vai analisar as fotos e validar o enquadramento. Se precisar de outra foto, avisaremos aqui."}
          {op === "PENDENCIAS" && "Há pendências nos equipamentos. A equipe da Intelite entrará em contato ou você pode voltar às etapas para ajustar."}
          {op === "EM_ANDAMENTO" && "A equipe pediu uma nova informação ou foto. Veja o aviso no topo da tela."}
          <ul>{state.operational.pending.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <Summary state={state} />
      </div>
    );
  }
  return (
    <div className="stack">
      <Summary state={state} />
      {state.pendencies.length > 0 && <div className="alert warn"><strong>Antes de enviar:</strong><ul>{state.pendencies.map((p) => <li key={p}>{p}</li>)}</ul></div>}
      <div className="card stack">
        <h2>Como foi a experiência?</h2>
        <div className="stars" role="radiogroup" aria-label="Nota de 1 a 5">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} de 5`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>)}
        </div>
        <label className="field"><span>Qual etapa foi mais difícil? (opcional)</span>
          <select value={hardest} onChange={(e) => setHardest(e.target.value)}>
            <option value="">Nenhuma</option>
            {state.steps.filter((s) => s.kind !== "AVALIACAO").map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
        </label>
        <label className="field"><span>Comentário (opcional)</span><textarea value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} /></label>
        <button className="btn primary block" disabled={rating === 0 || state.pendencies.length > 0}
          onClick={() => run(async () => onState(await api<State>("/api/client/evaluation", { body: { rating, comment: comment || undefined, hardestStepKey: hardest || undefined } })))}>
          Enviar confirmação e avaliação
        </button>
      </div>
    </div>
  );
}

function Summary({ state }: { state: State }) {
  return (
    <div className="card stack">
      <h2>Resumo</h2>
      {state.checks.map((c) => (
        <div key={c.id} className="row between">
          <span>Tela do {EQ_LABEL[c.type]}</span>
          <span><span className={`badge ${STATUS_TONE[c.status]}`}>{FRAMING_STATUS_LABEL[c.status]}</span>{" "}
            <span className={`badge ${c.technicalStatus === "VALIDADO" ? "ok" : c.technicalStatus === "REJEITADO" ? "bad" : ""}`}>
              Validação técnica: {c.technicalStatus === "VALIDADO" ? "ok" : c.technicalStatus === "REJEITADO" ? "não validado" : "pendente"}</span></span>
        </div>
      ))}
    </div>
  );
}

// ───────────── ajuda ─────────────

function HelpDialog({ stepKey, type, onClose, run, onState }: { stepKey: string; type: EqType | null; onClose: () => void; run: Run; onState: (s: State) => void }) {
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
            <p className="muted small">Descreva o que está acontecendo nesta etapa.</p>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} aria-label="Descrição do problema" />
            <button className="btn primary" onClick={() => run(async () => {
              onState(await api<State>("/api/client/support", { body: { stepKey, type: type ?? undefined, message: msg || undefined } }));
              setSent(true);
            })}>Enviar pedido de suporte</button>
          </>
        )}
        <button className="btn" onClick={() => ref.current?.close()}>Fechar</button>
      </div>
    </dialog>
  );
}
