import Link from "next/link";
import { BrandBar } from "@/components/Brand";

export default function NotFound() {
  return (
    <>
      <BrandBar />
      <main className="container" style={{ paddingTop: 32 }}>
        <div className="card stack">
          <h1>Página não encontrada</h1>
          <p className="muted">O endereço não existe ou foi alterado.</p>
          <Link className="btn primary" href="/">Ir para o tutorial</Link>
        </div>
      </main>
    </>
  );
}
