import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <div className="card stack">
        <h1>Área da equipe Intelite</h1>
        <LoginForm />
      </div>
    </main>
  );
}
