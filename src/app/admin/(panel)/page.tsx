"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { FRAMING_LABEL, STATUS_LABEL } from "@/lib/flow";
import type { Stats } from "@/lib/stats";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TONE: Record<string, string> = { EM_ANDAMENTO: "", ENVIADO: "warn", APROVADO: "ok", PRECISA_AJUSTE: "bad" };
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

function Kpi({ n, label, sub, tone }: { n: number | string; label: string; sub?: string; tone?: string }) {
  return <div className="kpi"><div className="n" style={tone ? { color: `var(--${tone})` } : undefined}>{n}</div><div className="l">{label}</div>{sub && <div className="s">{sub}</div>}</div>;
}

export default function EnviosPage() {
  const [f, setF] = useState({ q: "", status: "", format: "", from: "", to: "" });
  const [data, setData] = useState<{ items: any[]; stats: Stats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  useEffect(() => {
    const t = setTimeout(() => api<{ items: any[]; stats: Stats }>(`/api/admin/submissions?${qs}`).then(setData).catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [qs]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const st = data?.stats;

  return (
    <div className="stack">
      <div className="row between"><h1 style={{ margin: 0 }}>Envios</h1><a className="btn sm" href="/api/admin/export">Exportar CSV</a></div>
      {error && <div className="alert bad">{error}</div>}
      {st && (
        <>
          <div className="kpis">
            <Kpi n={st.total} label="Clientes que iniciaram" sub={`${st.emAndamento} em andamento`} />
            <Kpi n={st.enviados} tone="warn" label="Aguardando a equipe" sub={`${st.fotosParaAnalisar} foto(s) para analisar`} />
            <Kpi n={st.aprovados} tone="ok" label="Aprovados" />
            <Kpi n={st.precisaAjuste} tone="bad" label="Precisam de ajuste" />
            <Kpi n={st.totem.confirmados} tone="ok" label="Totens confirmados" sub={`confirmados pela equipe · ${st.totem.declaradosCorretos} declarados corretos`} />
            <Kpi n={st.painel.confirmados} tone="ok" label="Painéis confirmados" sub={`confirmados pela equipe · ${st.painel.declaradosCorretos} declarados corretos`} />
            <Kpi n={st.totem.comProblema + st.painel.comProblema} tone="bad" label="Telas com problema" sub={`totem ${st.totem.comProblema} · painel ${st.painel.comProblema}`} />
            <Kpi n={st.pedidosDeAjuda} tone="warn" label="Pedidos de ajuda em aberto" />
          </div>
          <div className="grid2">
            <section className="card"><h3>Texto × vídeo</h3>
              <div className="tablewrap"><table><thead><tr><th>Formato inicial</th><th>Escolheram</th><th>Concluíram</th><th>Pediram ajuda</th></tr></thead><tbody>
                {(["TEXTO", "VIDEO"] as const).map((k) => <tr key={k}><td>{k === "TEXTO" ? "Texto" : "Vídeo"}</td><td>{st.formato[k].chosen}</td><td>{st.formato[k].finished} ({pct(st.formato[k].finishRate)})</td><td>{st.formato[k].help} ({pct(st.formato[k].helpRate)})</td></tr>)}
              </tbody></table></div>
              <p className="muted small">Cada cliente conta uma vez, no formato inicial. {st.formato.trocaram} trocaram de formato durante o tutorial; {st.formato.semEscolha} ainda não escolheram.</p>
            </section>
          </div>
        </>
      )}

      <div className="card filters" role="search">
        <label className="field"><span>Buscar</span><input type="text" placeholder="Nome ou empresa" value={f.q} onChange={set("q")} /></label>
        <label className="field"><span>Status</span><select value={f.status} onChange={set("status")}><option value="">Todos</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Formato</span><select value={f.format} onChange={set("format")}><option value="">Todos</option><option value="TEXTO">Texto</option><option value="VIDEO">Vídeo</option></select></label>
        <label className="field"><span>De</span><input type="date" value={f.from} onChange={set("from")} /></label>
        <label className="field"><span>Até</span><input type="date" value={f.to} onChange={set("to")} /></label>
      </div>

      <div className="card tablewrap">
        <table>
          <thead><tr><th>Cliente</th><th>Status</th><th>Totem</th><th>Painel</th><th>Fotos</th><th>Início</th><th /></tr></thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.contactName}</strong><div className="muted small">{r.company}</div>{r.helpRequested && !r.helpResolved && <span className="badge warn">pediu ajuda</span>}</td>
                <td><span className={`badge ${TONE[r.status]}`}>{STATUS_LABEL[r.status as keyof typeof STATUS_LABEL]}</span><div className="muted small">{r.initialFormat === "VIDEO" ? "vídeo" : r.initialFormat === "TEXTO" ? "texto" : ""}</div></td>
                <td className="small">{FRAMING_LABEL[r.totemFraming as keyof typeof FRAMING_LABEL]}{r.totemConfirmed && <div><span className="badge ok">confirmado</span></div>}</td>
                <td className="small">{FRAMING_LABEL[r.painelFraming as keyof typeof FRAMING_LABEL]}{r.painelConfirmed && <div><span className="badge ok">confirmado</span></div>}</td>
                <td className="small">{r.photoCount}{r.pendingPhotos > 0 && <div><span className="badge warn">{r.pendingPhotos} a analisar</span></div>}</td>
                <td className="small">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</td>
                <td><Link className="btn sm" href={`/admin/envios/${r.id}`}>Abrir</Link></td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan={7} className="muted">Nenhum envio encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
