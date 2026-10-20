"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";

export interface InstrDraft { text: string; warning?: string; highlight?: string; imagePath?: string }

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  return (await api<{ path: string }>("/api/admin/assets", { form })).path;
}

/** Lista editável de passos (texto, aviso, destaque de botão/menu e imagem). */
export function InstructionsEditor({ value, onChange }: { value: InstrDraft[]; onChange: (v: InstrDraft[]) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const upd = (i: number, patch: Partial<InstrDraft>) => onChange(value.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const c = [...value];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  return (
    <div className="stack">
      {err && <div className="alert bad">{err}</div>}
      {value.map((s, i) => (
        <div key={i} className="card stack" style={{ margin: 0 }}>
          <div className="row between"><strong>Passo {i + 1}</strong>
            <span className="row" style={{ gap: 4 }}>
              <button type="button" className="btn sm" onClick={() => move(i, -1)} aria-label="Subir">↑</button>
              <button type="button" className="btn sm" onClick={() => move(i, 1)} aria-label="Descer">↓</button>
              <button type="button" className="btn sm danger" onClick={() => onChange(value.filter((_, k) => k !== i))}>Remover</button></span></div>
          <label className="field"><span>Instrução</span><textarea value={s.text} maxLength={1000} onChange={(e) => upd(i, { text: e.target.value })} /></label>
          <div className="grid2">
            <label className="field"><span>Botão/menu a destacar (opcional)</span><input type="text" value={s.highlight ?? ""} maxLength={120} onChange={(e) => upd(i, { highlight: e.target.value || undefined })} /></label>
            <label className="field"><span>Aviso de atenção (opcional)</span><input type="text" value={s.warning ?? ""} maxLength={500} onChange={(e) => upd(i, { warning: e.target.value || undefined })} /></label>
          </div>
          <div className="row">
            {s.imagePath && <><img src={`/api/assets/${s.imagePath}`} alt="" style={{ height: 60, borderRadius: 6 }} /><button type="button" className="btn sm" onClick={() => upd(i, { imagePath: undefined })}>Remover imagem</button></>}
            <label className="btn sm" style={{ cursor: "pointer" }}>{s.imagePath ? "Trocar imagem" : "Adicionar captura de tela"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { upd(i, { imagePath: await uploadImage(f) }); } catch (x) { setErr((x as Error).message); } e.target.value = ""; }} /></label>
          </div>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...value, { text: "" }])}>+ Adicionar passo</button>
    </div>
  );
}
