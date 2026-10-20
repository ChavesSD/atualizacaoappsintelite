"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Dt, useMe } from "@/components/admin/ui";
import { InstructionsEditor, uploadImage, type InstrDraft } from "@/components/admin/InstructionsEditor";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Draft {
  stepKey: string; hasText: boolean; hasVideo: boolean; recommendedFormat: "TEXTO" | "VIDEO";
  instructions: InstrDraft[]; referenceImages: { path: string; alt: string; caption?: string }[];
  video: { title: string; description: string; url: string; thumbnailUrl: string; captionsUrl: string; transcript: string };
}
const emptyVideo = { title: "", description: "", url: "", thumbnailUrl: "", captionsUrl: "", transcript: "" };
const STATUS: Record<string, string> = { RASCUNHO: "warn", PUBLICADO: "ok", ARQUIVADO: "" };

export default function ContentPage() {
  const me = useMe();
  const [steps, setSteps] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<{ id: string; format: "TEXTO" | "VIDEO" } | null>(null);
  const load = useCallback(() => api<any[]>("/api/admin/content").then(setSteps).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await load(); } catch (e) { setError((e as Error).message); } };

  function newVersion(step: any) {
    const base = step.contents.find((c: any) => c.status === "PUBLICADO") ?? step.contents[0];
    setEdit({
      stepKey: step.key, hasText: true, hasVideo: base?.hasVideo ?? false, recommendedFormat: base?.recommendedFormat ?? "TEXTO",
      instructions: base?.instructions ?? [{ text: "" }], referenceImages: base?.referenceImages ?? [],
      video: base?.video ? { ...emptyVideo, ...Object.fromEntries(Object.entries(base.video).filter(([, v]) => v !== null)) } as any : emptyVideo,
    });
  }

  return (
    <div className="stack">
      <h1>Tutorial: instruções e vídeos por etapa</h1>
      <p className="muted">Cada etapa pode ter texto, vídeo ou ambos. O texto é obrigatório para publicar: é a alternativa acessível quando o vídeo não carrega. Vídeos só podem vir de domínios autorizados (em Configurações).</p>
      {error && <div className="alert bad" role="alert">{error}</div>}
      {edit && <Editor draft={edit} setDraft={setEdit} onCancel={() => setEdit(null)} onSave={() => act(async () => {
        const d = edit;
        await api("/api/admin/content", { body: { stepKey: d.stepKey, hasText: d.hasText, hasVideo: d.hasVideo, recommendedFormat: d.recommendedFormat,
          instructions: d.instructions, referenceImages: d.referenceImages,
          video: d.hasVideo ? clean(d.video) : undefined } });
        setEdit(null);
      })} />}
      {steps?.map((s) => (
        <section className="card stack" key={s.id}>
          <div className="row between"><h2 style={{ margin: 0 }}>{s.position}. {s.title}</h2>
            {me?.canWrite && <button className="btn sm primary" onClick={() => newVersion(s)}>Nova versão</button>}</div>
          <div className="tablewrap"><table><thead><tr><th>Versão</th><th>Situação</th><th>Conteúdo</th><th>Recomendado</th><th>Vídeo</th><th>Publicada</th><th /></tr></thead>
            <tbody>{s.contents.map((c: any) => (
              <tr key={c.id}><td>v{c.version}</td><td><span className={`badge ${STATUS[c.status]}`}>{c.status.toLowerCase()}</span></td>
                <td>{c.hasText ? "texto" : ""}{c.hasText && c.hasVideo ? " + " : ""}{c.hasVideo ? "vídeo" : ""}</td><td>{c.recommendedFormat.toLowerCase()}</td>
                <td className="small">{c.video?.title ?? "—"}</td><td><Dt v={c.publishedAt} /></td>
                <td><div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => setPreview({ id: c.id, format: "TEXTO" })}>Prévia 📱</button>
                  {me?.canWrite && c.status !== "PUBLICADO" && <button className="btn sm" onClick={() => act(() => api(`/api/admin/content/${c.id}/publish`, { method: "POST" }))}>Publicar</button>}
                  {me?.canWrite && c.status === "PUBLICADO" && <button className="btn sm danger" onClick={() => confirm("Retirar do ar? A etapa ficará sem conteúdo publicado.") && act(() => api(`/api/admin/content/${c.id}/unpublish`, { method: "POST" }))}>Retirar</button>}
                </div></td></tr>))}</tbody></table></div>
        </section>
      ))}
      {preview && <PreviewDialog id={preview.id} format={preview.format} setFormat={(f) => setPreview({ ...preview, format: f })} onClose={() => setPreview(null)} />}
    </div>
  );
}

const clean = (v: Draft["video"]) => ({
  title: v.title, url: v.url, description: v.description || undefined, thumbnailUrl: v.thumbnailUrl || undefined,
  captionsUrl: v.captionsUrl || undefined, transcript: v.transcript || undefined,
});

function Editor({ draft, setDraft, onSave, onCancel }: { draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const setVideo = (k: keyof Draft["video"], v: string) => set("video", { ...draft.video, [k]: v });
  return (
    <section className="card stack" aria-label="Editor de versão">
      <h2>Nova versão — {draft.stepKey}</h2>
      <p className="muted small">Salvar cria um rascunho versionado. Só vai ao ar quando publicado.</p>
      {err && <div className="alert bad">{err}</div>}
      <div className="row">
        <label className="check"><input type="checkbox" checked={draft.hasVideo} onChange={(e) => set("hasVideo", e.target.checked)} /><span>Esta etapa tem vídeo</span></label>
        <label className="field"><span>Formato recomendado</span>
          <select value={draft.recommendedFormat} onChange={(e) => set("recommendedFormat", e.target.value as any)}><option value="TEXTO">Texto</option><option value="VIDEO" disabled={!draft.hasVideo}>Vídeo</option></select></label>
      </div>
      {draft.hasVideo && (
        <div className="card stack" style={{ margin: 0 }}>
          <h3>Vídeo</h3>
          <div className="grid2">
            <label className="field"><span>Título</span><input type="text" value={draft.video.title} onChange={(e) => setVideo("title", e.target.value)} /></label>
            <label className="field"><span>URL (https, domínio autorizado)</span><input type="url" value={draft.video.url} onChange={(e) => setVideo("url", e.target.value)} /></label>
            <label className="field"><span>URL da miniatura (opcional)</span><input type="url" value={draft.video.thumbnailUrl} onChange={(e) => setVideo("thumbnailUrl", e.target.value)} /></label>
            <label className="field"><span>URL das legendas .vtt (opcional)</span><input type="url" value={draft.video.captionsUrl} onChange={(e) => setVideo("captionsUrl", e.target.value)} /></label>
          </div>
          <label className="field"><span>Descrição</span><textarea value={draft.video.description} onChange={(e) => setVideo("description", e.target.value)} /></label>
          <label className="field"><span>Transcrição (acessibilidade)</span><textarea value={draft.video.transcript} onChange={(e) => setVideo("transcript", e.target.value)} /></label>
        </div>
      )}
      <h3>Instruções escritas (obrigatórias)</h3>
      <InstructionsEditor value={draft.instructions} onChange={(v) => set("instructions", v)} />
      <h3>Imagens de referência</h3>
      {draft.referenceImages.map((r, i) => (
        <div key={r.path} className="row"><img src={`/api/assets/${r.path}`} alt="" style={{ height: 56, borderRadius: 6 }} />
          <input type="text" className="grow" value={r.alt} placeholder="Texto alternativo (obrigatório)" onChange={(e) => set("referenceImages", draft.referenceImages.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))} />
          <button className="btn sm danger" onClick={() => set("referenceImages", draft.referenceImages.filter((_, k) => k !== i))}>Remover</button></div>
      ))}
      <label className="btn" style={{ cursor: "pointer", alignSelf: "flex-start" }}>+ Adicionar imagem de referência
        <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { set("referenceImages", [...draft.referenceImages, { path: await uploadImage(f), alt: "" }]); } catch (x) { setErr((x as Error).message); } e.target.value = ""; }} /></label>
      <div className="row"><button className="btn primary" onClick={onSave}>Salvar como rascunho</button><button className="btn" onClick={onCancel}>Cancelar</button></div>
    </section>
  );
}

function PreviewDialog({ id, format, setFormat, onClose }: { id: string; format: "TEXTO" | "VIDEO"; setFormat: (f: "TEXTO" | "VIDEO") => void; onClose: () => void }) {
  return (
    <dialog open style={{ position: "fixed", inset: 0, margin: "auto", zIndex: 20, padding: 12 }} aria-label="Prévia no celular">
      <div className="stack" style={{ alignItems: "center" }}>
        <div className="row"><button className={`btn sm ${format === "TEXTO" ? "primary" : ""}`} onClick={() => setFormat("TEXTO")}>Texto</button>
          <button className={`btn sm ${format === "VIDEO" ? "primary" : ""}`} onClick={() => setFormat("VIDEO")}>Vídeo</button>
          <button className="btn sm" onClick={onClose}>Fechar</button></div>
        <div className="phone"><iframe title="Prévia no celular" src={`/admin/preview/${id}?format=${format}`} /></div>
      </div>
    </dialog>
  );
}
