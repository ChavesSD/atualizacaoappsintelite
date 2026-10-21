"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";

interface User { id: string; email: string; name: string; active: boolean }

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => api<User[]>("/api/admin/users").then(setUsers).catch((e) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await api("/api/admin/users", { body: f }); setMsg({ ok: true, text: `Usuário ${f.email} criado. Peça para trocar a senha em “Conta”.` }); setF({ name: "", email: "", password: "" }); load(); }
    catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }
  async function toggle(u: User) {
    try { await api("/api/admin/users", { method: "PATCH", body: { id: u.id, active: !u.active } }); setMsg(null); load(); }
    catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }

  return (
    <div className="stack">
      <h1>Usuários do admin</h1>
      {msg && <div className={`alert ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</div>}
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className={`badge ${u.active ? "ok" : ""}`}>{u.active ? "ativo" : "desativado"}</span></td>
                <td><button className="btn sm" onClick={() => toggle(u)}>{u.active ? "Desativar" : "Reativar"}</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card stack" onSubmit={add} style={{ maxWidth: 460 }}>
        <h2>Novo usuário</h2>
        <label className="field"><span>Nome</span><input type="text" value={f.name} onChange={set("name")} required /></label>
        <label className="field"><span>E-mail</span><input type="email" value={f.email} onChange={set("email")} required /></label>
        <label className="field"><span>Senha inicial (mín. 10 caracteres)</span><input type="password" value={f.password} onChange={set("password")} minLength={10} autoComplete="new-password" required /></label>
        <button className="btn primary">Criar usuário</button>
      </form>
    </div>
  );
}
