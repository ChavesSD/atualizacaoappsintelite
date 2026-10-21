import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Central de Atualização do Atendimento Inteligente", template: "%s · Central Intelite" },
  description: "Atualize e confira o totem e o painel de chamadas da sua unidade — Intelite Tecnologia.",
  applicationName: "Atualização do Atendimento Inteligente",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // respeita o entalhe e a barra de gestos (safe-area no CSS)
  themeColor: "#0a2f73",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
