import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { PwaInstaller } from "@/components/PwaInstaller";

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
    // images preenchido automaticamente pelo arquivo opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "agLivre — Gestão financeira para vendedores do Mercado Livre",
    description:
      "Lucro real, taxas e liberações do Mercado Pago num só painel.",
    // images preenchido automaticamente pelo arquivo opengraph-image.tsx
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    other: [
      { rel: "icon", url: "/android-chrome-192x192.png", sizes: "192x192" },
      { rel: "icon", url: "/android-chrome-512x512.png", sizes: "512x512" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
          <PwaInstaller />
        </ThemeProvider>
        {plausibleSrc && (
          <>
            <Script
              src={plausibleSrc}
              strategy="afterInteractive"
            />
            <Script id="plausible-init" strategy="afterInteractive">
              {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
