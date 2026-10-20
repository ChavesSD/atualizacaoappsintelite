"use client";
import { api } from "@/lib/client-api";

export function LogoutButton() {
  return (
    <button className="btn sm" onClick={async () => { await api("/api/admin/logout", { method: "POST" }); window.location.href = "/admin/login"; }}>
      Sair
    </button>
  );
}
