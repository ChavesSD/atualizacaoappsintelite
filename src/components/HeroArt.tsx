/**
 * Ilustração da abertura: a TV do painel de chamadas e o totem de autoatendimento, desenhados em traço.
 * Os dois usam o mesmo aplicativo; é isso que a página atualiza. Decorativa (aria-hidden).
 */
export function HeroArt() {
  return (
    <svg viewBox="0 0 640 520" role="presentation" aria-hidden focusable="false" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* painel de chamadas (TV) */}
      <g className="float">
        <rect x="236" y="34" width="384" height="250" rx="22" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="250" y="48" width="356" height="222" rx="13" fill="#07080b" stroke="var(--border)" />
        <rect x="272" y="70" width="64" height="8" rx="4" fill="var(--border-strong)" />
        <rect x="272" y="86" width="40" height="8" rx="4" fill="var(--surface-3)" />
        <text x="272" y="182" fill="var(--brand)" fontFamily="var(--font)" fontSize="72" fontWeight="650" letterSpacing="-3" style={{ fontVariantNumeric: "tabular-nums" }}>A 047</text>
        <rect x="272" y="204" width="110" height="11" rx="5.5" fill="var(--text-2)" opacity=".85" />
        <rect x="272" y="222" width="72" height="8" rx="4" fill="var(--border-strong)" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${i * 42})`}>
            <rect x="500" y="72" width="88" height="32" rx="9" fill="var(--surface-2)" stroke="var(--border)" />
            <rect x="510" y="84" width="30" height="8" rx="4" fill={i === 0 ? "var(--brand)" : "var(--border-strong)"} />
            <rect x="548" y="84" width="30" height="8" rx="4" fill="var(--surface-3)" />
          </g>
        ))}
        <path d="M398 284 L386 318 H470 L458 284" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M344 318 H520" stroke="var(--border-strong)" strokeWidth="3" />
      </g>

      {/* totem de autoatendimento */}
      <g className="float" style={{ animationDelay: "-2.4s" }}>
        <rect x="46" y="148" width="204" height="336" rx="30" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="64" y="168" width="168" height="226" rx="16" fill="#07080b" stroke="var(--border)" />
        <circle cx="92" cy="196" r="9" fill="var(--brand)" />
        <rect x="108" y="191" width="86" height="10" rx="5" fill="var(--text-2)" opacity=".85" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${i * 58})`}>
            <rect x="80" y="226" width="136" height="44" rx="12" fill={i === 0 ? "var(--brand)" : "var(--surface-2)"} stroke={i === 0 ? "var(--brand)" : "var(--border)"} />
            <rect x="96" y="243" width={i === 0 ? 70 : 54 + i * 12} height="10" rx="5" fill={i === 0 ? "var(--brand-contrast)" : "var(--border-strong)"} />
          </g>
        ))}
        {/* senha saindo da impressora */}
        <rect x="104" y="410" width="88" height="10" rx="5" fill="#07080b" stroke="var(--border-strong)" />
        <path d="M112 416 V446 H184 V416" fill="var(--text)" />
        <rect x="124" y="428" width="48" height="6" rx="3" fill="#07080b" opacity=".75" />
        <rect x="132" y="438" width="32" height="4" rx="2" fill="#07080b" opacity=".4" />
        <path d="M92 484 V500 H204 V484" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M66 500 H230" stroke="var(--border-strong)" strokeWidth="3" />
      </g>

      {/* seta de atualização entre os dois */}
      <g transform="translate(312 408)">
        <circle cx="0" cy="0" r="34" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="2" />
        <path d="M-11 4 A12 12 0 0 1 9 -9 M12 -5 A12 12 0 0 1 -8 9" stroke="var(--brand-text)" strokeWidth="3" />
        <path d="M5 -15 L11 -9 L4 -5 M-5 15 L-11 9 L-4 5" stroke="var(--brand-text)" strokeWidth="3" />
      </g>
    </svg>
  );
}
