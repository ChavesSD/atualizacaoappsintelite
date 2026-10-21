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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo-intelite.webp" alt="Intelite Tecnologia" width={108} height={40} />
        <Link href="/admin">Envios</Link>
        <Link href="/admin/conteudo">Conteúdo do tutorial</Link>
        <Link href="/" target="_blank">Ver página pública ↗</Link>
        <span className="grow" />
        <Link href="/admin/usuarios">Usuários</Link>
        <Link href="/admin/conta">Conta</Link>
        <span className="muted small">{admin.name}</span>
        <LogoutButton />
      </nav>
      <main className="container wide">{children}</main>
    </>
  );
}
