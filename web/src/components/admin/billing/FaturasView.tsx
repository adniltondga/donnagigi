"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FileText } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"

interface Invoice {
  id: string
  asaasPaymentId: string
  value: number
  status: string
  billingType: string | null
  dueDate: string
  paymentDate: string | null
  invoiceUrl: string | null
  bankSlipUrl: string | null
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  CONFIRMED: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  RECEIVED: { label: "Recebida", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  OVERDUE: { label: "Vencida", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  REFUNDED: { label: "Reembolsada", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" },
  CANCELED: { label: "Cancelada", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 line-through" },
  RECEIVED_IN_CASH: { label: "Recebida", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
}

const BILLING_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR")
}

/**
 * Tabela de faturas reutilizável. Usada tanto na página dedicada
 * /admin/billing/faturas quanto inline na aba Assinatura de
 * /admin/configuracoes.
 */
export function FaturasView() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setInvoices(d.data || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="overflow-hidden">
      {loading ? (
        <LoadingState variant="card" />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma fatura ainda"
          description="Assine o plano Pro pra começar a ver seus pagamentos aqui."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const s = STATUS_STYLES[inv.status] || {
                label: inv.status,
                cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
              }
              const url = inv.invoiceUrl || inv.bankSlipUrl
              return (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">{formatDate(inv.dueDate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv.billingType ? BILLING_LABELS[inv.billingType] || inv.billingType : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-right">
                    {formatCurrency(inv.value)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.paymentDate)}</TableCell>
                  <TableCell>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Ver <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
