"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { Bars, Evolution, Kpi, pctText } from "@/components/admin/ui";
import { FRAMING_STATUS_LABEL, ISSUE_LABEL } from "@/domain/framing";
import { STEP_FLOW } from "@/domain/steps";
import type { Dashboard } from "@/domain/metrics";

interface Campaign { id: string; name: string }
interface UnitRow { unit: { id: string; name: string } }

const ADJ: Record<string, string> = {
  RESOLUCAO: "Resolução", ESCALA: "Escala", DPI: "DPI", ORIENTACAO: "Orientação", PROPORCAO: "Proporção",
  OVERSCAN_ZOOM_MONITOR: "Overscan/zoom", CONFIG_APLICATIVO: "Config. do app", NAO_INFORMADO: "Não informado",
};
const stepTitle = (k: string) => STEP_FLOW.find((s) => s.key === k)?.title ?? k;

export default function DashboardPage() {
  const [f, setF] = useState({ campaignId: "", unitId: "", type: "", status: "", from: "", to: "" });
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [units, setUnits] = useState<UnitRow["unit"][]>([]);

  useEffect(() => {
    api<Campaign[]>("/api/admin/campaigns").then(setCampaigns).catch(() => {});
    api<UnitRow[]>("/api/admin/sessions").then((r) => setUnits(r.map((x) => x.unit))).catch(() => {});
  }, []);

  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  useEffect(() => {
    setError(null);
    api<Dashboard>(`/api/admin/dashboard?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [qs]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const c = data?.framing.cards;
  const u = data?.usage;

  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="card filters" role="search" aria-label="Filtros">
        <label className="field"><span>Campanha</span><select value={f.campaignId} onChange={set("campaignId")}><option value="">Todas</option>{campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="field"><span>Unidade</span><select value={f.unitId} onChange={set("unitId")}><option value="">Todas</option>{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="field"><span>Equipamento</span><select value={f.type} onChange={set("type")}><option value="">Todos</option><option value="TOTEM">Totem</option><option value="PAINEL">Painel</option></select></label>
        <label className="field"><span>Situação</span><select value={f.status} onChange={set("status")}><option value="">Todas</option>{Object.entries(FRAMING_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>De</span><input type="date" value={f.from} onChange={set("from")} /></label>
        <label className="field"><span>Até</span><input type="date" value={f.to} onChange={set("to")} /></label>
        <button className="btn" onClick={() => setF({ campaignId: "", unitId: "", type: "", status: "", from: "", to: "" })}>Limpar</button>
      </div>
      {error && <div className="alert bad">{error}</div>}
      {!data || !c || !u ? <p className="muted">Carregando…</p> : (
        <>
          <p className="muted small">
            Universo: <strong>{data.eligibleUnits}</strong> unidades elegíveis · <strong>{data.startedUnits}</strong> iniciaram o tutorial. Percentuais usam o universo elegível como base.
            O período filtra pela data de início da sessão (e pela data do evento nos gráficos de evolução).
          </p>

          <h2>Qualidade da exibição</h2>
          <div className="kpis">
            <Kpi n={c.totensValidados} tone="ok" label="Totens com enquadramento confirmado" sub={`validação técnica · ${c.totensAutodeclaradosCorretos} declarados corretos pelo cliente`} />
            <Kpi n={c.paineisValidados} tone="ok" label="Painéis com enquadramento confirmado" sub={`validação técnica · ${c.paineisAutodeclaradosCorretos} declarados corretos pelo cliente`} />
            <Kpi n={c.incorretos} tone="bad" label="Equipamentos com enquadramento incorreto" />
            <Kpi n={c.ajustesPendentes} tone="warn" label="Ajustes de exibição pendentes" sub="incorretos + aguardando suporte" />
            <Kpi n={c.aguardandoNovaVerificacao} tone="warn" label="Aguardando nova verificação" sub="ajuste feito pelo cliente" />
            <Kpi n={c.precisamSuporte} tone="bad" label="Precisam de suporte" />
          </div>

          <div className="grid2">
            <section className="card"><h3>Enquadramento correto por tipo de equipamento</h3>
              {(["TOTEM", "PAINEL"] as const).map((t) => {
                const r = data.framing.correctPercentByType[t];
                return (
                  <div key={t} style={{ marginBottom: 10 }}>
                    <Bars max={100} suffix="%" items={[{ label: `${t === "TOTEM" ? "Totem" : "Painel"} (declarado)`, value: r.percent ?? 0 }]} empty="" />
                    <div className="muted small">{r.correct} de {r.universe} unidades · {r.validated} validados tecnicamente{r.percent === null ? " · sem universo" : ""}</div>
                  </div>
                );
              })}
            </section>
            <section className="card"><h3>Problemas de exibição mais frequentes</h3>
              <Bars items={data.framing.issuesByType.map((i) => ({ label: ISSUE_LABEL[i.type], value: i.count }))} />
            </section>
            <section className="card"><h3>Ajustes realizados: {data.framing.adjustmentsTotal}</h3>
              <Bars items={data.framing.adjustmentsByType.map((a) => ({ label: ADJ[a.type] ?? a.type, value: a.count }))} />
            </section>
            <section className="card"><h3>Evolução das correções</h3><Evolution data={data.framing.evolution} /></section>
          </div>

          <h2>Utilização do tutorial</h2>
          <div className="kpis">
            <Kpi n={u.byFormat.TEXTO.chosen} label="Escolheram texto" sub="formato inicial" />
            <Kpi n={u.byFormat.VIDEO.chosen} label="Escolheram vídeo" sub="formato inicial" />
            <Kpi n={u.switched} label="Trocaram de formato" sub="contados uma vez, no formato inicial" />
            <Kpi n={u.noFormatYet} label="Ainda sem escolha" />
          </div>
          <div className="grid2">
            <section className="card"><h3>Taxa de conclusão por formato</h3>
              <Bars max={100} suffix="%" items={(["TEXTO", "VIDEO"] as const).map((k) => ({ label: k === "TEXTO" ? "Texto" : "Vídeo", value: u.byFormat[k].completionRate ?? 0 }))} />
              <p className="muted small">Texto: {u.byFormat.TEXTO.completed}/{u.byFormat.TEXTO.chosen} ({pctText(u.byFormat.TEXTO.completionRate)}) · Vídeo: {u.byFormat.VIDEO.completed}/{u.byFormat.VIDEO.chosen} ({pctText(u.byFormat.VIDEO.completionRate)}). Conclusão = cliente enviou a confirmação final.</p>
            </section>
            <section className="card"><h3>Taxa de solicitações de suporte por formato</h3>
              <Bars max={100} suffix="%" items={(["TEXTO", "VIDEO"] as const).map((k) => ({ label: k === "TEXTO" ? "Texto" : "Vídeo", value: u.byFormat[k].supportRate ?? 0 }))} />
              <p className="muted small">Texto: {u.byFormat.TEXTO.withSupport}/{u.byFormat.TEXTO.chosen} · Vídeo: {u.byFormat.VIDEO.withSupport}/{u.byFormat.VIDEO.chosen} unidades com ao menos um pedido de suporte.</p>
            </section>
            {(["TEXTO", "VIDEO"] as const).map((k) => (
              <section className="card" key={k}><h3>Etapas com mais dificuldade — {k === "TEXTO" ? "texto" : "vídeo"}</h3>
                <Bars items={u.difficultSteps[k].map((s) => ({ label: stepTitle(s.stepKey), value: s.sessions }))} />
                <p className="muted small">Unidades distintas com pedido de suporte ou enquadramento incorreto na etapa, no formato em uso naquele momento.</p>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
