/** Barra de topo: logo da Intelite (branca, fundo transparente) sobre o preto. `children` fica à direita. */
export function BrandBar({ children, wide }: { children?: React.ReactNode; wide?: boolean }) {
  return (
    <header className="topbar">
      <div className={`topbar-in ${wide ? "wide" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo-intelite.webp" alt="Intelite Tecnologia" width={108} height={40} />
        {children}
      </div>
    </header>
  );
}
