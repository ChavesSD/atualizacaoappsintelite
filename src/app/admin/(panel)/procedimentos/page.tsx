"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Dt, useMe } from "@/components/admin/ui";
import { InstructionsEditor, type InstrDraft } from "@/components/admin/InstructionsEditor";
import { ISSUE_LABEL } from "@/domain/framing";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ADJ: Record<string, string> = {
  RESOLUCAO: "Resolução de tela", ESCALA: "Escala de exibição", DPI: "Ajuste de DPI", ORIENTACAO: "Orientação da tela",
  PROPORCAO: "Proporção da imagem", OVERSCAN_ZOOM_MONITOR: "Overscan / zoom do monitor", CONFIG_APLICATIVO: "Configuração do aplicativo",
};
interface Form { key?: string; type: "TOTEM" | "PAINEL"; modelId: string; adjustmentType: string; appliesTo: string[]; title: string; steps: InstrDraft[]; params: { k: string; v: string }[] }
const blank = (): Form => ({ type: "TOTEM", modelId: "", adjustmentType: "ESCALA", appliesTo: [], title: "", steps: [{ text: "" }], params: [] });

export default function ProceduresPage() {
  const me = useMe();
  const [list, setList] = useState<any[] | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<any[]>("/api/admin/procedures").then(setList).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); api<any[]>("/api/admin/models").then(setModels).catch(() => {}); }, [load]);
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await load(); } catch (e) { setError((e as Error).message); } };

  const issueKeys = Object.keys(ISSUE_LABEL);
  const save = () => act(async () => {
    const f = form!;
    await api("/api/admin/procedures", { body: {
      key: f.key, type: f.type, modelId: f.modelId || null, adjustmentType: f.adjustmentType, appliesTo: f.appliesTo, title: f.title, steps: f.steps,
      parameters: f.params.filter((p) => p.k.trim() && p.v.trim()).length ? Object.fromEntries(f.params.filter((p) => p.k.trim() && p.v.trim()).map((p) => [p.k.trim(), p.v.trim()])) : undefined,
    } });
    setForm(null);
  });

  return (
    <div className="stack">
      <div className="row between"><h1>Procedimentos de correção do enquadramento</h1>{me?.canWrite && <button className="btn primary" onClick={() => setForm(blank())}>Novo procedimento</button>}</div>
      <div className="alert info">Cadastre aqui somente instruções e parâmetros (resolução, escala, DPI, comandos…) aprovados pela equipe técnica. O sistema não inventa valores: o cliente só vê procedimentos <strong>publicados</strong>, filtrados por tipo de equipamento, modelo e problema relatado. <strong>Publicar equivale a aprovar</strong> e registra o seu nome.</div>
      {error && <div className="alert bad" role="alert">{error}</div>}

      {form && (
        <section className="card stack">
          <h2>{form.key ? `Nova versão de ${form.key}` : "Novo procedimento"}</h2>
          <div className="grid2">
            <label className="field"><span>Equipamento</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any, modelId: "" })}><option value="TOTEM">Totem</option><option value="PAINEL">Painel</option></select></label>
            <label className="field"><span>Modelo (vazio = todos)</span><select value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })}><option value="">Todos os modelos</option>{models.filter((m) => m.type === form.type).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label className="field"><span>Tipo de ajuste</span><select value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}>{Object.entries(ADJ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="field"><span>Título</span><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          </div>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend><strong>Aplica-se aos problemas (nenhum marcado = qualquer problema)</strong></legend>
            <div className="row">{issueKeys.map((k) => (
              <label key={k} className={`check ${form.appliesTo.includes(k) ? "on" : ""}`}><input type="checkbox" checked={form.appliesTo.includes(k)} onChange={(e) => setForm({ ...form, appliesTo: e.target.checked ? [...form.appliesTo, k] : form.appliesTo.filter((x) => x !== k) })} /><span>{ISSUE_LABEL[k]}</span></label>
            ))}</div>
          </fieldset>
          <h3>Parâmetros oficiais (opcional)</h3>
          {form.params.map((p, i) => (
            <div className="row" key={i}><input type="text" className="grow" placeholder="Parâmetro (ex.: Escala)" value={p.k} onChange={(e) => setForm({ ...form, params: form.params.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)) })} />
              <input type="text" className="grow" placeholder="Valor validado pela equipe técnica" value={p.v} onChange={(e) => setForm({ ...form, params: form.params.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)) })} />
              <button className="btn sm danger" onClick={() => setForm({ ...form, params: form.params.filter((_, j) => j !== i) })}>Remover</button></div>
          ))}
          <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setForm({ ...form, params: [...form.params, { k: "", v: "" }] })}>+ Parâmetro</button>
          <h3>Passos</h3>
          <InstructionsEditor value={form.steps} onChange={(steps) => setForm({ ...form, steps })} />
          <div className="row"><button className="btn primary" onClick={save}>Salvar rascunho</button><button className="btn" onClick={() => setForm(null)}>Cancelar</button></div>
        </section>
      )}

      <div className="card tablewrap"><table>
        <thead><tr><th>Procedimento</th><th>Equipamento / modelo</th><th>Ajuste</th><th>Problemas</th><th>Situação</th><th>Aprovado por</th><th /></tr></thead>
        <tbody>
          {list?.map((p) => (
            <tr key={p.id}><td><strong>{p.title}</strong><div className="muted small">{p.key} · v{p.version}</div></td>
              <td>{p.type === "TOTEM" ? "Totem" : "Painel"}<div className="muted small">{p.model?.name ?? "todos os modelos"}</div></td><td>{ADJ[p.adjustmentType]}</td>
              <td className="small">{p.appliesTo.length ? p.appliesTo.map((i: string) => ISSUE_LABEL[i]).join(", ") : "qualquer"}</td>
              <td><span className={`badge ${p.status === "PUBLICADO" ? "ok" : p.status === "RASCUNHO" ? "warn" : ""}`}>{p.status.toLowerCase()}</span></td>
              <td className="small">{p.approvedBy?.name ?? "—"}<div className="muted"><Dt v={p.approvedAt} /></div></td>
              <td><div className="row" style={{ gap: 6 }}>
                {me?.canWrite && p.status !== "PUBLICADO" && <button className="btn sm" onClick={() => confirm("Publicar e aprovar este procedimento? Ele passará a ser exibido aos clientes.") && act(() => api(`/api/admin/procedures/${p.id}/publish`, { method: "POST" }))}>Aprovar e publicar</button>}
                {me?.canWrite && p.status === "PUBLICADO" && <button className="btn sm danger" onClick={() => act(() => api(`/api/admin/procedures/${p.id}/archive`, { method: "POST" }))}>Arquivar</button>}
                {me?.canWrite && <button className="btn sm" onClick={() => setForm({ key: p.key, type: p.type, modelId: p.modelId ?? "", adjustmentType: p.adjustmentType, appliesTo: p.appliesTo, title: p.title, steps: p.steps, params: Object.entries(p.parameters ?? {}).map(([k, v]) => ({ k, v: String(v) })) })}>Nova versão</button>}
              </div></td></tr>
          ))}
          {list?.length === 0 && <tr><td colSpan={7} className="muted">Nenhum procedimento cadastrado. Sem procedimentos publicados, o cliente é orientado a falar com o suporte.</td></tr>}
        </tbody></table></div>
    </div>
  );
}
