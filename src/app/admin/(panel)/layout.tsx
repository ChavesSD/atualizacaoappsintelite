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
        <strong style={{ marginRight: 8 }}>Atualização Intelite</strong>
        <Link href="/admin">Envios</Link>
        <Link href="/admin/conteudo">Conteúdo do tutorial</Link>
        <Link href="/" target="_blank">Ver página pública ↗</Link>
        <span className="grow" />
        <span className="muted small">{admin.name}</span>
        <LogoutButton />
      </nav>
      <main className="container wide">{children}</main>
    </>
  );
}
