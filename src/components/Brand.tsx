/** Barra de topo: só a barra de progresso (`children`), centralizada. Sem `children` não mostra nada. */
export function BrandBar({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <header className="topbar">
      <div className="topbar-in">{children}</div>
    </header>
  );
}

/** Rodapé: logo da Intelite (branca, fundo transparente) centralizada; `compact` esconde o texto. */
export function BrandFooter({ compact }: { compact?: boolean }) {
  return (
    <footer className="brandfoot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo" src="/logo-intelite.webp" alt="Intelite Tecnologia" width={162} height={60} />
      {!compact && <span>Seu progresso fica salvo neste aparelho.</span>}
    </footer>
  );
}
