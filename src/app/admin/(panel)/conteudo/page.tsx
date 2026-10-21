"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ConteudoPage() {
  const [steps, setSteps] = useState<any[] | null>(null);
  const [hosts, setHosts] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => {
    api<any[]>("/api/admin/steps").then(setSteps).catch((e) => setMsg({ ok: false, text: e.message }));
    api<{ videoHosts: string }>("/api/admin/settings").then((s) => setHosts(s.videoHosts)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="stack">
      <h1>Conteúdo do tutorial</h1>
      <p className="muted">Edite o texto de cada etapa (um passo por linha), o aviso, uma imagem de referência e o vídeo. As mudanças valem na hora para quem abrir a página pública. Para ver como ficou, abra a página pública em outra aba.</p>
      <div className="alert info small">As etapas de <strong>atualização</strong> e de <strong>correção da tela</strong> estão com “procedimento ainda não cadastrado”: preencha com o procedimento oficial da Intelite.</div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</div>}

      <section className="card stack"><h2>Domínios de vídeo autorizados</h2>
        <p className="muted small">Só links https desses domínios podem ser usados nos vídeos. Um por linha.</p>
        <textarea value={hosts} onChange={(e) => setHosts(e.target.value)} />
        <button className="btn" style={{ alignSelf: "flex-start" }} onClick={async () => { try { const r = await api<{ videoHosts: string }>("/api/admin/settings", { method: "PUT", body: { videoHosts: hosts } }); setHosts(r.videoHosts); setMsg({ ok: true, text: "Domínios salvos." }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } }}>Salvar domínios</button>
      </section>

      {steps?.map((s) => <StepForm key={s.id} step={s} onMsg={setMsg} />)}
    </div>
  );
}

function StepForm({ step, onMsg }: { step: any; onMsg: (m: { ok: boolean; text: string }) => void }) {
  const [f, setF] = useState({ title: step.title, instructions: step.instructions, warning: step.warning ?? "", imagePath: step.imagePath ?? "", videoUrl: step.videoUrl ?? "", videoTitle: step.videoTitle ?? "", active: step.active });
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });
  async function save() {
    try {
      await api(`/api/admin/steps/${step.id}`, { method: "PUT", body: { ...f, warning: f.warning || null, imagePath: f.imagePath || null, videoUrl: f.videoUrl || null, videoTitle: f.videoTitle || null } });
      onMsg({ ok: true, text: `“${f.title}” salvo.` });
    } catch (e) { onMsg({ ok: false, text: (e as Error).message }); }
  }
  async function upload(file: File) {
    try { const form = new FormData(); form.set("file", file); set("imagePath", (await api<{ path: string }>("/api/admin/upload", { form })).path); }
    catch (e) { onMsg({ ok: false, text: (e as Error).message }); }
  }
  return (
    <details className="card">
      <summary><strong>{step.title}</strong> <span className="muted small">({step.key}){!f.active ? " · oculta" : ""}</span></summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <label className="field"><span>Título</span><input type="text" value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="field"><span>Passos (um por linha)</span><textarea rows={6} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} /></label>
        <label className="field"><span>Aviso de atenção (opcional)</span><input type="text" value={f.warning} onChange={(e) => set("warning", e.target.value)} /></label>
        <div className="grid2">
          <label className="field"><span>Link do vídeo (opcional)</span><input type="url" placeholder="https://www.youtube.com/watch?v=…" value={f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} /></label>
          <label className="field"><span>Título do vídeo</span><input type="text" value={f.videoTitle} onChange={(e) => set("videoTitle", e.target.value)} /></label>
        </div>
        <div className="row">
          {f.imagePath && <><img src={`/api/assets/${f.imagePath}`} alt="" style={{ height: 70, borderRadius: 6 }} /><button className="btn sm" onClick={() => set("imagePath", "")}>Remover imagem</button></>}
          <label className="btn sm" style={{ cursor: "pointer" }}>{f.imagePath ? "Trocar imagem" : "Adicionar imagem de referência"}<input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = ""; }} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /><span>Etapa visível na página pública</span></label>
        <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={save}>Salvar</button>
      </div>
    </details>
  );
}
