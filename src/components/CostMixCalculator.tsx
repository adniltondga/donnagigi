"use client"

import { useEffect, useState } from "react"
import { Calculator } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import CurrencyInput from "@/components/CurrencyInput"
import { formatCurrency } from "@/lib/calculations"

interface CostMixCalculatorProps {
  /** Quantidade atual em estoque (auto pré-preenchido com o stock do ML). */
  currentQty: number
  /** Custo atual cadastrado (auto pré-preenchido com productCost). null = ainda não tem. */
  currentCost: number | null
  /** Label do produto/variação pra contextualizar o popup. */
  itemLabel: string
  /** Chamado quando o user clica em "Aplicar". Recebe o custo médio em reais. */
  onApply: (averageCost: number) => void
  /** Visual do botão gatilho. "icon" = só ícone discreto, "compact" = ícone+label. */
  size?: "icon" | "compact"
  /** Tooltip do gatilho. */
  triggerTitle?: string
}

/**
 * Calculadora de Custo Médio Ponderado (CMP).
 *
 *   custoMédio = (qtdAtual × custoAtual + qtdNova × custoNovo) / (qtdAtual + qtdNova)
 *
 * Use quando o seller compra um lote novo do mesmo produto por preço
 * diferente — em vez de simplesmente sobrescrever o custo, calcula a
 * média ponderada que vai virar o "custo cadastrado" daí pra frente.
 */
export function CostMixCalculator({
  currentQty,
  currentCost,
  itemLabel,
  onApply,
  size = "icon",
  triggerTitle = "Calcular custo médio",
}: CostMixCalculatorProps) {
  const [open, setOpen] = useState(false)
  const [oldQty, setOldQty] = useState(0)
  const [oldCost, setOldCost] = useState(0)
  const [newQty, setNewQty] = useState(0)
  const [newCost, setNewCost] = useState(0)

  // Pré-preenche quando abre.
  useEffect(() => {
    if (open) {
      setOldQty(Math.max(0, currentQty || 0))
      setOldCost(currentCost ?? 0)
      setNewQty(0)
      setNewCost(0)
    }
  }, [open, currentQty, currentCost])

  const totalQty = oldQty + newQty
  const totalCost = oldQty * oldCost + newQty * newCost
  const average = totalQty > 0 ? totalCost / totalQty : 0
  const canApply = newQty > 0 && newCost > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={triggerTitle}
        className={
          size === "icon"
            ? "p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            : "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary-600"
        }
      >
        <Calculator className={size === "icon" ? "w-3.5 h-3.5" : "w-3 h-3"} />
        {size === "compact" && <span>Misturar lotes</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Custo médio ponderado</DialogTitle>
            <DialogDescription className="text-xs">
              Misture o estoque atual com um lote novo de preço diferente.
              O resultado vira o novo custo cadastrado.
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
            Item: <strong className="text-foreground">{itemLabel}</strong>
          </div>

          <div className="space-y-4 mt-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Estoque atual
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Quantidade</label>
                  <input
                    type="number"
                    min="0"
                    value={oldQty}
                    onChange={(e) => setOldQty(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full border border-border rounded px-2 py-1.5 text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Custo unitário</label>
                  <CurrencyInput
                    value={oldCost > 0 ? String(oldCost) : ""}
                    onChange={(v) => setOldCost(v)}
                    placeholder="0,00"
                    className="w-full border border-border rounded px-2 py-1.5 text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Lote novo (compra)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Quantidade</label>
                  <input
                    type="number"
                    min="0"
                    value={newQty || ""}
                    onChange={(e) => setNewQty(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full border border-border rounded px-2 py-1.5 text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Custo unitário</label>
                  <CurrencyInput
                    value={newCost > 0 ? String(newCost) : ""}
                    onChange={(v) => setNewCost(v)}
                    placeholder="0,00"
                    className="w-full border border-border rounded px-2 py-1.5 text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Total de unidades</span>
                <span className="tabular-nums">{totalQty}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Soma investida</span>
                <span className="tabular-nums">{formatCurrency(totalCost)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400 text-base">
                <span>Custo médio /un</span>
                <span className="tabular-nums">{formatCurrency(average)}</span>
              </div>
              {canApply && oldCost > 0 && (
                <p className="text-[11px] text-muted-foreground italic">
                  {average > oldCost
                    ? `+${formatCurrency(average - oldCost)} vs custo atual — lote novo subiu o custo`
                    : average < oldCost
                      ? `−${formatCurrency(oldCost - average)} vs custo atual — lote novo abaixou o custo`
                      : "sem alteração"}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply(average)
                setOpen(false)
              }}
              disabled={!canApply}
            >
              Aplicar {canApply ? formatCurrency(average) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
