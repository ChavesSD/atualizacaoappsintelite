import { redirect } from "next/navigation";
import { getClientContext } from "@/lib/auth";
import { AccessForm } from "./AccessForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await getClientContext()) redirect("/tutorial");
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <div className="card stack">
        <div>
          <p className="muted small" style={{ margin: 0 }}>Intelite Tecnologia</p>
          <h1>Central de Atualização do Atendimento Inteligente</h1>
        </div>
        <p>Informe o código da sua unidade para atualizar e conferir o totem e o painel de chamadas.</p>
        <AccessForm />
        <p className="muted small">O código foi enviado pela Intelite. Não o encontra? Fale com o seu contato na Intelite.</p>
      </div>
    </main>
  );
}
