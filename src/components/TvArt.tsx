/**
 * Ilustração de uma TV com o painel de chamadas do Atendimento Inteligente aberto.
 *  - `cut`: tela cortada/desalinhada (a imagem passa dos limites do monitor: bordas, relógio e barra de baixo escondidos);
 *  - `ok`: tudo enquadrado, com as quatro bordas visíveis.
 * É um desenho ilustrativo (SVG), usado para o cliente reconhecer o que está vendo na própria tela.
 */
function Panel() {
  // conteúdo do painel em 1600 × 900, com itens encostados nas quatro bordas (para o corte ficar evidente)
  return (
    <g fontFamily="var(--font), system-ui, sans-serif">
      <rect width="1600" height="900" fill="#eef3fa" />
      {/* topo: logo e relógio */}
      <rect width="1600" height="110" fill="#ffffff" />
      <g transform="translate(40 28)">
        <path d="M30 0 L60 54 H44 L30 28 L16 54 H0 Z" fill="#2f5fb3" />
        <path d="M14 40 H46 L40 54 H20 Z" fill="#7cc4ef" />
        <text x="82" y="26" fontSize="30" fill="#1b2433">Atendimento</text>
        <text x="82" y="56" fontSize="30" fontWeight="700" fill="#1b2433">Inteligente</text>
      </g>
      <text x="1560" y="72" fontSize="44" fontWeight="600" fill="#1b2433" textAnchor="end">14:32</text>
      {/* senha atual */}
      <rect x="40" y="140" width="940" height="600" rx="28" fill="#2f6fc4" />
      <text x="80" y="220" fontSize="40" fontWeight="600" fill="#cfe3ff" letterSpacing="3">SENHA ATUAL</text>
      <text x="80" y="480" fontSize="260" fontWeight="800" fill="#ffffff">A 045</text>
      <text x="80" y="640" fontSize="64" fontWeight="600" fill="#ffffff">Guichê 03</text>
      <text x="80" y="710" fontSize="36" fill="#cfe3ff">Atendimento médico</text>
      {/* últimas chamadas */}
      <rect x="1010" y="140" width="550" height="600" rx="28" fill="#ffffff" />
      <text x="1048" y="206" fontSize="34" fontWeight="700" fill="#1b2433">Últimas chamadas</text>
      {[["A 044", "Guichê 02"], ["B 012", "Guichê 01"], ["A 043", "Guichê 04"], ["C 007", "Guichê 05"]].map(([s, g], i) => (
        <g key={s} transform={`translate(1048 ${240 + i * 118})`}>
          <rect width="474" height="98" rx="16" fill="#eef3fa" />
          <text x="24" y="66" fontSize="52" fontWeight="800" fill="#2f6fc4">{s}</text>
          <text x="450" y="64" fontSize="34" fill="#46506a" textAnchor="end">{g}</text>
        </g>
      ))}
      {/* rodapé */}
      <rect y="780" width="1600" height="120" fill="#12315f" />
      <text x="40" y="854" fontSize="40" fill="#ffffff">Bem-vindo! Aguarde ser chamado pelo painel.</text>
      <text x="1560" y="854" fontSize="40" fontWeight="700" fill="#7cc4ef" textAnchor="end">Intelite</text>
    </g>
  );
}

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
        <g transform={cut ? "translate(-30 -22) scale(.46)" : "translate(18 18) scale(.3775)"}><Panel /></g>
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
