"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

export function AccessForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Links podem trazer o código no fragmento (#CODIGO): ele não é enviado ao servidor nem a logs/referrers.
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h) setCode(decodeURIComponent(h));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/client/access", { body: { code } });
      history.replaceState(null, "", "/");
      window.location.href = "/tutorial";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <label className="field">
        <span>Código da unidade</span>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXXX-XXXXX" required />
      </label>
      {error && <div className="alert bad" role="alert">{error}</div>}
      <button className="btn primary block" disabled={busy || code.trim().length < 6}>{busy ? "Verificando…" : "Entrar"}</button>
    </form>
  );
}
