import type { ReactNode } from "react";

/**
 * Conjunto único de ícones (SVG, traço 2, pontas arredondadas): substitui emojis e glifos Unicode,
 * que variam de fonte para fonte e não têm alinhamento óptico consistente.
 */
const PATHS: Record<string, ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>,
  play: <><circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4z" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></>,
  xCircle: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  totem: <><rect x="6" y="2" width="12" height="16" rx="2" /><path d="M9 6h6" /><path d="M9 10h6" /><path d="M12 18v3" /><path d="M8 22h8" /></>,
  tv: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 9h4" /><path d="M7 12h2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, title, className, filled }: { name: IconName; size?: number; title?: string; className?: string; filled?: boolean }) {
  return (
    <svg
      className={`icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true, focusable: false })}
    >
      {PATHS[name]}
    </svg>
  );
}

type Tone = "info" | "ok" | "warn" | "bad";
const TONE_ICON: Record<Tone, IconName> = { info: "info", ok: "checkCircle", warn: "alert", bad: "xCircle" };

/** Aviso com ícone + texto: o significado nunca depende só da cor. */
export function Alert({ tone = "info", children, role, className }: { tone?: Tone; children: ReactNode; role?: "alert" | "status" | "note"; className?: string }) {
  return (
    <div className={`alert ${tone} ${className ?? ""}`} role={role}>
      <Icon name={TONE_ICON[tone]} size={18} className="alert-icon" />
      <div className="alert-body">{children}</div>
    </div>
  );
}

/** Esqueleto de carregamento (em vez de "Carregando…" solto). Decorativo: quem usa marca o contêiner com aria-busy. */
export function Skeleton({ h = 16, w = "100%", r = 8 }: { h?: number; w?: string | number; r?: number }) {
  return <span className="skeleton" aria-hidden style={{ height: h, width: w, borderRadius: r }} />;
}
