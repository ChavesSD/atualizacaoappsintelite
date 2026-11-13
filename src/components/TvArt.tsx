/**
 * Ilustração de uma TV com a tela real do painel de chamadas do Atendimento Inteligente (/painel-tela.webp).
 *  - `cut`: tela cortada/desalinhada (a imagem passa dos limites do monitor: bordas, relógio e barra de baixo escondidos);
 *  - `ok`: tudo enquadrado, com as quatro bordas visíveis.
 * A TV é um desenho (SVG); a imagem da tela é a captura real do painel, para o cliente reconhecer o que vê na própria tela.
 */
export function TvArt({ variant }: { variant: "cut" | "ok" }) {
  const cut = variant === "cut";
  const id = `tv-${variant}`;
  return (
    <svg className={`tvart ${variant}`} viewBox="0 0 640 420" aria-hidden focusable="false">
      <defs>
        <clipPath id={`${id}-screen`}><rect x="18" y="18" width="604" height="340" rx="4" /></clipPath>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".1" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      {/* base e pé */}
      <path d="M270 372 H370 L384 396 H256 Z" fill="#1a1d26" />
      <rect x="206" y="396" width="228" height="10" rx="5" fill="#2a2e3b" />
      {/* moldura da TV */}
      <rect x="2" y="2" width="636" height="368" rx="16" fill="#0a0b10" stroke="#343947" strokeWidth="2" />
      <g clipPath={`url(#${id}-screen)`}>
        <rect x="18" y="18" width="604" height="340" fill="#000" />
        {/* a tela tem 16:9 (604 × 340); o painel cabe inteiro ou passa dos limites */}
        <image href="/painel-tela.webp" x="18" y="18" width="604" height="340" preserveAspectRatio="none" transform={cut ? "translate(-34 -22) scale(1.16)" : undefined} />
        <rect x="18" y="18" width="604" height="340" fill={`url(#${id}-glow)`} />
      </g>
      <circle cx="320" cy="364" r="2.5" fill="#4c9bff" />
      {/* cantos verdes: as quatro bordas aparecem */}
      {!cut && (
        <g fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round">
          <path d="M22 40 V22 H40 M600 22 H618 V40 M618 336 V354 H600 M40 354 H22 V336" />
        </g>
      )}
    </svg>
  );
}
