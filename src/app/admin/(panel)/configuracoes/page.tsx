"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { useMe } from "@/components/admin/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function SettingsPage() {
  const me = useMe();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [hosts, setHosts] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api<any[]>("/api/admin/campaigns").then(setCampaigns).catch(() => {});
    api<any[]>("/api/admin/hosts").then(setHosts).catch(() => {});
    api<any[]>("/api/admin/criteria").then(setCriteria).catch(() => {});
    api<any[]>("/api/admin/models").then(setModels).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn: () => Promise<unknown>) => { setError(null); setNotice(null); try { await fn(); load(); } catch (e) { setError((e as Error).message); } };

  const [camp, setCamp] = useState({ name: "", startsAt: "", requireTechnicalValidation: true });
  const [unit, setUnit] = useState({ campaignId: "", code: "", name: "", city: "", totemModelId: "", painelModelId: "" });
  const [host, setHost] = useState("");
  const [crit, setCrit] = useState({ type: "TOTEM", label: "" });
  const [model, setModel] = useState({ name: "", type: "TOTEM" });
  const admin = !!me?.isAdmin, write = !!me?.canWrite;

  return (
    <div className="stack">
      <h1>Configurações</h1>
      {error && <div className="alert bad" role="alert">{error}</div>}
      {notice && <div className="alert ok" role="status">{notice}</div>}

      <section className="card stack"><h2>Campanhas e unidades elegíveis</h2>
        <div className="tablewrap"><table><thead><tr><th>Campanha</th><th>Início</th><th>Unidades</th><th>Exige validação técnica</th></tr></thead>
          <tbody>{campaigns.map((c) => <tr key={c.id}><td>{c.name}</td><td>{new Date(c.startsAt).toLocaleDateString("pt-BR")}</td><td>{c._count.units}</td><td>{c.requireTechnicalValidation ? "sim" : "não"}</td></tr>)}</tbody></table></div>
        {admin && (<>
          <h3>Nova campanha</h3>
          <div className="filters">
            <label className="field"><span>Nome</span><input type="text" value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} /></label>
            <label className="field"><span>Início</span><input type="date" value={camp.startsAt} onChange={(e) => setCamp({ ...camp, startsAt: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={camp.requireTechnicalValidation} onChange={(e) => setCamp({ ...camp, requireTechnicalValidation: e.target.checked })} /><span>Exigir validação técnica</span></label>
            <button className="btn primary" disabled={!camp.name || !camp.startsAt} onClick={() => act(async () => { await api("/api/admin/campaigns", { body: camp }); setCamp({ name: "", startsAt: "", requireTechnicalValidation: true }); })}>Criar</button>
          </div>
          <h3>Adicionar unidade à campanha</h3>
          <div className="filters">
            <label className="field"><span>Campanha</span><select value={unit.campaignId} onChange={(e) => setUnit({ ...unit, campaignId: e.target.value })}><option value="">Selecione</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="field"><span>Código da unidade</span><input type="text" value={unit.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })} /></label>
            <label className="field"><span>Nome</span><input type="text" value={unit.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} /></label>
            <label className="field"><span>Cidade</span><input type="text" value={unit.city} onChange={(e) => setUnit({ ...unit, city: e.target.value })} /></label>
            <label className="field"><span>Modelo do totem</span><select value={unit.totemModelId} onChange={(e) => setUnit({ ...unit, totemModelId: e.target.value })}><option value="">—</option>{models.filter((m) => m.type === "TOTEM").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label className="field"><span>Modelo do painel</span><select value={unit.painelModelId} onChange={(e) => setUnit({ ...unit, painelModelId: e.target.value })}><option value="">—</option>{models.filter((m) => m.type === "PAINEL").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <button className="btn primary" disabled={!unit.campaignId || !unit.code || !unit.name} onClick={() => act(async () => {
              const r = await api<{ accessCode: string }>(`/api/admin/campaigns/${unit.campaignId}/units`, { body: { code: unit.code, name: unit.name, city: unit.city || undefined, totemModelId: unit.totemModelId || undefined, painelModelId: unit.painelModelId || undefined } });
              setNotice(`Código de acesso da unidade ${unit.name}: ${r.accessCode} — copie agora; ele não será exibido novamente. Link: /#${r.accessCode}`);
              setUnit({ ...unit, code: "", name: "", city: "" });
            })}>Adicionar</button>
          </div></>)}
      </section>

      <section className="card stack"><h2>Fontes de vídeo autorizadas</h2>
        <p className="muted small">Somente URLs https desses domínios (ou subdomínios) podem ser cadastradas em vídeos do tutorial.</p>
        <div className="tablewrap"><table><tbody>{hosts.map((h) => (
          <tr key={h.id}><td>{h.hostname}</td><td>{h.active ? "ativo" : "desativado"}</td>
            <td>{admin && <button className="btn sm" onClick={() => act(() => api("/api/admin/hosts", { method: "PATCH", body: { id: h.id, active: !h.active } }))}>{h.active ? "Desativar" : "Reativar"}</button>}</td></tr>))}
          {hosts.length === 0 && <tr><td className="muted">Nenhum domínio autorizado: nenhum vídeo poderá ser cadastrado.</td></tr>}</tbody></table></div>
        {admin && <div className="row"><input type="text" className="grow" placeholder="videos.intelite.com.br" value={host} onChange={(e) => setHost(e.target.value)} /><button className="btn primary" onClick={() => act(async () => { await api("/api/admin/hosts", { body: { hostname: host } }); setHost(""); })}>Autorizar domínio</button></div>}
      </section>

      <section className="card stack"><h2>Critérios de verificação do enquadramento</h2>
        <p className="muted small">Itens que o cliente confirma. Configuráveis por tipo e, via banco, por modelo de equipamento.</p>
        <div className="tablewrap"><table><thead><tr><th>Equip.</th><th>Critério</th><th>Obrigatório</th><th>Ativo</th><th /></tr></thead>
          <tbody>{criteria.map((c) => (
            <tr key={c.id}><td>{c.type === "TOTEM" ? "Totem" : "Painel"}{c.model ? ` · ${c.model.name}` : ""}</td><td>{c.label}</td><td>{c.required ? "sim" : "não"}</td><td>{c.active ? "sim" : "não"}</td>
              <td>{write && <div className="row" style={{ gap: 6 }}>
                <button className="btn sm" onClick={() => act(() => api(`/api/admin/criteria/${c.id}`, { method: "PATCH", body: { required: !c.required } }))}>{c.required ? "Tornar opcional" : "Tornar obrigatório"}</button>
                <button className="btn sm" onClick={() => act(() => api(`/api/admin/criteria/${c.id}`, { method: "PATCH", body: { active: !c.active } }))}>{c.active ? "Desativar" : "Ativar"}</button></div>}</td></tr>))}</tbody></table></div>
        {write && <div className="row"><select value={crit.type} onChange={(e) => setCrit({ ...crit, type: e.target.value })} style={{ width: 120 }}><option value="TOTEM">Totem</option><option value="PAINEL">Painel</option></select>
          <input type="text" className="grow" placeholder="Novo critério" value={crit.label} onChange={(e) => setCrit({ ...crit, label: e.target.value })} />
          <button className="btn primary" disabled={crit.label.trim().length < 3} onClick={() => act(async () => { await api("/api/admin/criteria", { body: { ...crit, position: 99 } }); setCrit({ ...crit, label: "" }); })}>Adicionar</button></div>}
      </section>

      <section className="card stack"><h2>Modelos de equipamento</h2>
        <div className="row">{models.map((m) => <span key={m.id} className="badge info">{m.type === "TOTEM" ? "Totem" : "Painel"}: {m.name}</span>)}{models.length === 0 && <span className="muted small">Nenhum modelo cadastrado.</span>}</div>
        {write && <div className="row"><select value={model.type} onChange={(e) => setModel({ ...model, type: e.target.value })} style={{ width: 120 }}><option value="TOTEM">Totem</option><option value="PAINEL">Painel</option></select>
          <input type="text" className="grow" placeholder="Nome do modelo" value={model.name} onChange={(e) => setModel({ ...model, name: e.target.value })} />
          <button className="btn primary" disabled={model.name.trim().length < 2} onClick={() => act(async () => { await api("/api/admin/models", { body: model }); setModel({ ...model, name: "" }); })}>Adicionar</button></div>}
      </section>
    </div>
  );
}
