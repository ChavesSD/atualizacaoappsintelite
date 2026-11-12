import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Quer atualizar seu app Intelite?", template: "%s · Central Intelite" },
  description: "Atualize o aplicativo Atendimento Inteligente (totem e painel de chamadas) com passo a passo em texto e vídeo — Intelite Tecnologia.",
  applicationName: "Atualização do Atendimento Inteligente",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // respeita o entalhe e a barra de gestos (safe-area no CSS)
  themeColor: "#050507",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
