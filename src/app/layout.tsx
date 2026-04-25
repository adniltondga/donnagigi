import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const SITE_URL = "https://aglivre.dgadigital.com.br";
const SITE_NAME = "agLivre";
const SITE_DESCRIPTION =
  "Painel financeiro pra vendedores do Mercado Livre: lucro real, taxas, devoluções e liberações do Mercado Pago num lugar só. 14 dias grátis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "agLivre — Gestão financeira para vendedores do Mercado Livre",
    template: "%s · agLivre",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "DGA Digital", url: "https://dgadigital.com.br" }],
  creator: "DGA Digital",
  publisher: "DGA Digital",
  category: "business",
  keywords: [
    "gestão financeira mercado livre",
    "controle de vendas mercado livre",
    "lucro real mercado livre",
    "taxa mercado livre",
    "previsão liberação mercado pago",
    "ERP mercado livre",
    "agLivre",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: "agLivre — Gestão financeira para vendedores do Mercado Livre",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "agLivre — painel financeiro para vendedores do Mercado Livre",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "agLivre — Gestão financeira para vendedores do Mercado Livre",
    description:
      "Lucro real, taxas e liberações do Mercado Pago num só painel.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
