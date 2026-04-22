import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "agLivre — Gestão financeira para vendedores do Mercado Livre",
  description: "Controle de vendas, custos, taxas do ML e liberação de caixa via Mercado Pago em um só painel.",
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
