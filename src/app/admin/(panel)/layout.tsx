import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Envios" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <AdminNav name={admin.name} />
      <main id="conteudo" className="container wide" tabIndex={-1}>{children}</main>
    </>
  );
}
