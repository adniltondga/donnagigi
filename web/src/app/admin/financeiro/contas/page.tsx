"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FolderTree, Wallet } from "lucide-react"
import { BillsTab, CategoriasTab, type BillType } from "../_components"
import { CashPoolsCard } from "@/components/CashPoolsCard"

/**
 * Tela única "Contas" — substitui as 3 antigas (contas-a-pagar,
 * contas-a-receber, categorias). Por padrão exibe entradas e saídas
 * juntas; clicar nos cards "Total a pagar" / "Total a receber" filtra
 * a tabela. O "+" dentro de cada card abre modal de criação.
 *
 * Suporta `?tab=payable|receivable` pra deep-link (legado dos redirects).
 */
export default function ContasPage() {
  const sp = useSearchParams()
  const tabParam = sp.get("tab")
  const initialFilter: BillType | undefined =
    tabParam === "payable" || tabParam === "receivable" ? tabParam : undefined
  const [showCats, setShowCats] = useState(false)
  const [showCaixas, setShowCaixas] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        title="📒 Contas"
        description="Visão consolidada de entradas e saídas. Clique nos cards pra filtrar."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowCaixas(true)}>
              <Wallet className="w-4 h-4 mr-1" />
              Caixas
            </Button>
            <Button variant="outline" onClick={() => setShowCats(true)}>
              <FolderTree className="w-4 h-4 mr-1" />
              Gerenciar categorias
            </Button>
          </div>
        }
      />

      <BillsTab initialFilter={initialFilter} />

      <Dialog open={showCats} onOpenChange={setShowCats}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📂 Categorias</DialogTitle>
          </DialogHeader>
          <CategoriasTab />
        </DialogContent>
      </Dialog>

      <Dialog open={showCaixas} onOpenChange={setShowCaixas}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💰 Caixas virtuais</DialogTitle>
          </DialogHeader>
          <CashPoolsCard />
        </DialogContent>
      </Dialog>
    </div>
  )
}
