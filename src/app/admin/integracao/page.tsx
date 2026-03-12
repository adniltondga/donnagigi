"use client"

import { Suspense } from "react"
import IntegracaoContent from "./integracao-content"

export default function IntegracaoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <IntegracaoContent />
    </Suspense>
  )
}
