"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Diálogo de confirmação imperativo — substitui `confirm()` browser
 * com UI consistente com o resto do app.
 *
 * Uso:
 *   const ok = await confirmDialog({
 *     title: "Remover categoria?",
 *     description: "Se tiver contas vinculadas, remoção é bloqueada.",
 *     confirmLabel: "Remover",
 *     variant: "danger",
 *   })
 *   if (!ok) return
 *
 * Pré-requisito: <ConfirmDialogHost /> precisa estar montado em algum
 * layout (admin/layout.tsx já tem). Sem ele, a Promise nunca resolve.
 */

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" pinta o botão de confirmar de vermelho. */
  variant?: "default" | "danger"
}

interface InternalState {
  opts: ConfirmOptions
  resolve: (value: boolean) => void
}

let setStateRef: ((s: InternalState | null) => void) | null = null

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setStateRef) {
      // Host não montado — fallback pro confirm browser (último recurso)
      const ok = window.confirm(
        `${opts.title}${opts.description ? `\n\n${opts.description}` : ""}`,
      )
      resolve(ok)
      return
    }
    setStateRef({ opts, resolve })
  })
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<InternalState | null>(null)

  useEffect(() => {
    setStateRef = setState
    return () => {
      setStateRef = null
    }
  }, [])

  const close = (value: boolean) => {
    state?.resolve(value)
    setState(null)
  }

  if (!state) return null

  const { opts } = state
  const isDanger = opts.variant === "danger"

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close(false)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {isDanger && (
              <div className="w-10 h-10 shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle>{opts.title}</DialogTitle>
              {opts.description && (
                <DialogDescription className="mt-2">
                  {opts.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {opts.cancelLabel || "Cancelar"}
          </Button>
          <Button
            variant={isDanger ? "destructive" : "default"}
            onClick={() => close(true)}
          >
            {opts.confirmLabel || "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
