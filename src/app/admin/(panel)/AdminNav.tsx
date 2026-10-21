"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";
import { LogoutButton } from "./LogoutButton";

const LINKS: { href: string; label: string; active: (p: string) => boolean }[] = [
  { href: "/admin", label: "Envios", active: (p) => p === "/admin" || p.startsWith("/admin/envios") },
  { href: "/admin/conteudo", label: "Conteúdo do tutorial", active: (p) => p.startsWith("/admin/conteudo") },
  { href: "/admin/usuarios", label: "Usuários", active: (p) => p.startsWith("/admin/usuarios") },
  { href: "/admin/conta", label: "Conta", active: (p) => p.startsWith("/admin/conta") },
];

export function AdminNav({ name }: { name: string }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Administração">
      <Link href="/admin" aria-label="Intelite Tecnologia: início da administração">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo-intelite.webp" alt="" width={108} height={40} />
      </Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.active(path) ? "page" : undefined}>{l.label}</Link>
      ))}
      <Link href="/" target="_blank" rel="noopener">Página pública <Icon name="external" size={14} /><span className="visually-hidden"> (abre em nova aba)</span></Link>
      <span className="grow" />
      <span className="muted small user-text">{name}</span>
      <LogoutButton />
    </nav>
  );
}
