"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";

export default function ContaPage() {
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.again) return setMsg({ ok: false, text: "A confirmação da nova senha não confere." });
    try {
      await api("/api/admin/password", { body: { current: f.current, next: f.next } });
      setMsg({ ok: true, text: "Senha alterada." });
      setF({ current: "", next: "", again: "" });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }
  return (
    <div className="stack" style={{ maxWidth: 460 }}>
      <h1>Minha conta</h1>
      <form className="card stack" onSubmit={submit}>
        <h2>Alterar senha</h2>
        <label className="field"><span>Senha atual</span><input type="password" value={f.current} onChange={set("current")} autoComplete="current-password" required /></label>
        <label className="field"><span>Nova senha (mín. 10 caracteres)</span><input type="password" value={f.next} onChange={set("next")} autoComplete="new-password" minLength={10} required /></label>
        <label className="field"><span>Repita a nova senha</span><input type="password" value={f.again} onChange={set("again")} autoComplete="new-password" required /></label>
        {msg && <div className={`alert ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</div>}
        <button className="btn primary">Salvar</button>
      </form>
    </div>
  );
}
