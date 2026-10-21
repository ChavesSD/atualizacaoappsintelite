import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { BrandBar } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <>
      <BrandBar />
      <main className="container" style={{ paddingTop: 32 }}>
        <div className="card stack">
          <h1>Administração</h1>
          <LoginForm />
        </div>
      </main>
    </>
  );
}
