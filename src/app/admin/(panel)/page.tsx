"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { FRAMING_LABEL, STATUS_LABEL } from "@/lib/flow";
import type { Stats } from "@/lib/stats";
import { Alert, Icon, Skeleton, type IconName } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TONE: Record<string, string> = { EM_ANDAMENTO: "", ENVIADO: "warn", APROVADO: "ok", PRECISA_AJUSTE: "bad" };
const STATUS_ICON: Record<string, IconName> = { EM_ANDAMENTO: "clock", ENVIADO: "clock", APROVADO: "checkCircle", PRECISA_AJUSTE: "alert" };
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

type Flag = { tone: "ok" | "warn" | "bad"; text: string };

/** Indicador: o número é texto comum (nunca colorido pelo estado); o estado vem em marca com ícone + palavra. */
function Kpi({ n, label, sub, flag }: { n: number | string; label: string; sub?: string; flag?: Flag | null }) {
  const icon: IconName = flag?.tone === "ok" ? "checkCircle" : flag?.tone === "bad" ? "xCircle" : "alert";
  return (
    <li className="kpi">
      <span className="l">{label}</span>
      <span className="n">{n}</span>
      {sub && <span className="s">{sub}</span>}
      {flag && <span className={`flag ${flag.tone}`}><Icon name={icon} />{flag.text}</span>}
    </li>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="row">
      <code className="user-text">{url}</code>
      <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão de área de transferência */ } }}>
        {copied ? <><Icon name="check" size={16} /> Copiado</> : "Copiar link"}
      </button>
    </div>
  );
}

export default function EnviosPage() {
  const [f, setF] = useState({ q: "", status: "", format: "", from: "", to: "" });
  const [data, setData] = useState<{ items: any[]; stats: Stats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const filtered = Object.values(f).some(Boolean);

  const load = useCallback(() => {
    setError(null);
    return api<{ items: any[]; stats: Stats }>(`/api/admin/submissions?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [qs]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const st = data?.stats;
  const max = Math.max(1, ...(st?.funil.map((x) => x.count) ?? [1]));

  return (
    <div className="stack">
      <div className="row between"><h1 style={{ margin: 0 }}>Envios</h1><a className="btn sm" href="/api/admin/export"><Icon name="download" size={16} /> Exportar CSV</a></div>
      {error && <Alert tone="bad" role="alert">{error} <button type="button" className="btn sm" onClick={load}>Tentar de novo</button></Alert>}

      {!st && !error && <div aria-busy="true" aria-label="Carregando indicadores" className="kpis"><Skeleton h={96} r={12} /><Skeleton h={96} r={12} /><Skeleton h={96} r={12} /><Skeleton h={96} r={12} /></div>}
      {st && (
        <>
          <ul className="kpis" aria-label="Indicadores">
            <Kpi n={st.total} label="Clientes que iniciaram" sub={`${st.emAndamento} em andamento`} />
            <Kpi n={st.enviados} label="Aguardando a equipe" sub={`${st.fotosParaAnalisar} foto(s) para analisar`} flag={st.enviados > 0 ? { tone: "warn", text: "Ação da equipe" } : null} />
            <Kpi n={st.aprovados} label="Aprovados" />
            <Kpi n={st.precisaAjuste} label="Precisam de ajuste" flag={st.precisaAjuste > 0 ? { tone: "bad", text: "Atenção" } : null} />
            <Kpi n={st.totem.confirmados} label="Totens confirmados" sub={`${st.totem.declaradosCorretos} declarados corretos pelo cliente`} />
            <Kpi n={st.painel.confirmados} label="Painéis confirmados" sub={`${st.painel.declaradosCorretos} declarados corretos pelo cliente`} />
            <Kpi n={st.totem.comProblema + st.painel.comProblema} label="Telas com problema" sub={`totem ${st.totem.comProblema} · painel ${st.painel.comProblema}`} flag={st.totem.comProblema + st.painel.comProblema > 0 ? { tone: "bad", text: "Atenção" } : null} />
            <Kpi n={st.pedidosDeAjuda} label="Pedidos de ajuda em aberto" flag={st.pedidosDeAjuda > 0 ? { tone: "warn", text: "Ação da equipe" } : null} />
          </ul>

          <div className="grid2">
            <section className="card" aria-labelledby="h-funil">
              <h2 id="h-funil">Onde os clientes avançam</h2>
              <p className="muted small">Quantos clientes chegaram a cada etapa. Uma queda grande entre duas etapas mostra onde o tutorial perde gente.</p>
              <ol className="funnel">
                {st.funil.map((x, i) => (
                  <li key={x.label}>
                    <span>{x.label}</span>
                    <span className="track" aria-hidden><span className="fill" style={{ width: `${(x.count / max) * 100}%` }} /></span>
                    <span className="val">{x.count}{i > 0 && st.funil[0].count > 0 ? ` (${Math.round((x.count / st.funil[0].count) * 100)}%)` : ""}</span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="card" aria-labelledby="h-formato">
              <h2 id="h-formato">Texto × vídeo</h2>
              <div className="tablewrap"><table>
                <caption className="visually-hidden">Comparação entre os formatos do tutorial</caption>
                <thead><tr><th scope="col">Formato inicial</th><th scope="col">Escolheram</th><th scope="col">Concluíram</th><th scope="col">Pediram ajuda</th></tr></thead>
                <tbody>
                  {(["TEXTO", "VIDEO"] as const).map((k) => <tr key={k}><th scope="row">{k === "TEXTO" ? "Texto" : "Vídeo"}</th><td>{st.formato[k].chosen}</td><td>{st.formato[k].finished} ({pct(st.formato[k].finishRate)})</td><td>{st.formato[k].help} ({pct(st.formato[k].helpRate)})</td></tr>)}
                </tbody>
              </table></div>
              <p className="muted small" style={{ marginTop: 12 }}>Cada cliente conta uma vez, no formato inicial. {st.formato.trocaram} trocaram de formato durante o tutorial; {st.formato.semEscolha} ainda não escolheram.</p>
            </section>
          </div>
        </>
      )}

      <form className="card filters" role="search" aria-label="Filtrar envios" onSubmit={(e) => e.preventDefault()}>
        <label className="field"><span>Buscar</span><input type="text" placeholder="Nome ou empresa" value={f.q} onChange={set("q")} autoComplete="off" /></label>
        <label className="field"><span>Status</span><select value={f.status} onChange={set("status")}><option value="">Todos</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Formato</span><select value={f.format} onChange={set("format")}><option value="">Todos</option><option value="TEXTO">Texto</option><option value="VIDEO">Vídeo</option></select></label>
        <label className="field"><span>De</span><input type="date" value={f.from} onChange={set("from")} /></label>
        <label className="field"><span>Até</span><input type="date" value={f.to} onChange={set("to")} /></label>
        {filtered && <button type="button" className="btn" onClick={() => setF({ q: "", status: "", format: "", from: "", to: "" })}>Limpar filtros</button>}
      </form>

      <div className="card tablewrap" aria-live="polite">
        {!data && !error && <div className="stack" aria-busy="true"><Skeleton h={20} /><Skeleton h={20} /><Skeleton h={20} /></div>}
        {data && data.items.length === 0 && (
          filtered ? (
            <div className="stack"><p><strong>Nenhum envio encontrado com esses filtros.</strong></p><button type="button" className="btn" onClick={() => setF({ q: "", status: "", format: "", from: "", to: "" })}>Limpar filtros</button></div>
          ) : (
            <div className="stack">
              <p><strong>Ainda não há envios.</strong></p>
              <p className="muted">Compartilhe o link da página pública com seus clientes. Cada cliente que iniciar o tutorial aparece aqui, com as fotos e o andamento.</p>
              <CopyLink />
            </div>
          )
        )}
        {data && data.items.length > 0 && (
          <table className="cards">
            <caption className="visually-hidden">Lista de envios</caption>
            <thead><tr><th scope="col">Cliente</th><th scope="col">Status</th><th scope="col">Totem</th><th scope="col">Painel</th><th scope="col">Fotos</th><th scope="col">Início</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="cell-main user-text"><strong>{r.contactName}</strong><div className="muted small">{r.company}</div>{r.helpRequested && !r.helpResolved && <span className="badge warn"><Icon name="alert" />pediu ajuda</span>}</td>
                  <td data-label="Status"><span><span className={`badge ${TONE[r.status]}`}><Icon name={STATUS_ICON[r.status]} />{STATUS_LABEL[r.status as keyof typeof STATUS_LABEL]}</span><span className="muted small" style={{ display: "block" }}>{r.initialFormat === "VIDEO" ? "vídeo" : r.initialFormat === "TEXTO" ? "texto" : ""}</span></span></td>
                  <td data-label="Totem"><span>{FRAMING_LABEL[r.totemFraming as keyof typeof FRAMING_LABEL]}{r.totemConfirmed && <span className="badge ok" style={{ marginLeft: 6 }}><Icon name="check" />confirmado</span>}</span></td>
                  <td data-label="Painel"><span>{FRAMING_LABEL[r.painelFraming as keyof typeof FRAMING_LABEL]}{r.painelConfirmed && <span className="badge ok" style={{ marginLeft: 6 }}><Icon name="check" />confirmado</span>}</span></td>
                  <td data-label="Fotos"><span>{r.photoCount}{r.pendingPhotos > 0 && <span className="badge warn" style={{ marginLeft: 6 }}>{r.pendingPhotos} a analisar</span>}</span></td>
                  <td data-label="Início">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td><Link className="btn sm" href={`/admin/envios/${r.id}`}>Abrir<span className="visually-hidden"> envio de {r.contactName}</span></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
