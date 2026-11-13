/** Cabeçalho: logo da Intelite (branca, fundo transparente) centralizada; `children` (a barra de progresso) fica logo abaixo dela. */
export function BrandBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo-intelite.webp" alt="Intelite Tecnologia" width={162} height={60} />
        {children}
      </div>
    </header>
  );
}

/** Rodapé: direitos autorais. */
export function BrandFooter() {
  return (
    <footer className="brandfoot">
      <span>© {new Date().getFullYear()} Intelite Tecnologia. Todos os direitos reservados.</span>
    </footer>
  );
}
