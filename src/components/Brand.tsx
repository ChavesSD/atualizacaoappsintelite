/** Faixa de marca no topo. A logo é branca com fundo transparente, então vive sobre o azul institucional. */
export function BrandBar({ children, wide }: { children?: React.ReactNode; wide?: boolean }) {
  return (
    <header className="brandbar">
      <div className={`container brandbar-in ${wide ? "wide" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo-intelite.webp" alt="Intelite Tecnologia" width={141} height={52} />
        {children}
      </div>
    </header>
  );
}
