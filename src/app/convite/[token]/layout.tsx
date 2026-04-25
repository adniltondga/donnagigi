import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aceitar convite",
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
