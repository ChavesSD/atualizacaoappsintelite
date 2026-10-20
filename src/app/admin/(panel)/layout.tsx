import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <>
      <nav className="admin-nav" aria-label="Administração">
        <strong style={{ marginRight: 8 }}>Central Intelite</strong>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/unidades">Unidades</Link>
        <Link href="/admin/conteudo">Tutorial</Link>
        <Link href="/admin/procedimentos">Procedimentos de correção</Link>
        <Link href="/admin/configuracoes">Configurações</Link>
        <Link href="/admin/auditoria">Auditoria</Link>
        <span className="grow" />
        <span className="muted small">{admin.name} · {admin.role}</span>
        <LogoutButton />
      </nav>
      <main className="container wide">{children}</main>
    </>
  );
}
