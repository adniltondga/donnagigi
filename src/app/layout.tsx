import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Donna Gigi - Capinhas de Celular Premium",
  description: "Loja online de capinhas de celular de alta qualidade",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
