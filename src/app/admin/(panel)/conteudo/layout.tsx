import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conteúdo do tutorial" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
