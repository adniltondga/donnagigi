"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  PENDING: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Confirmada", cls: "bg-green-100 text-green-800" },
  RECEIVED: { label: "Recebida", cls: "bg-green-100 text-green-800" },
  OVERDUE: { label: "Vencida", cls: "bg-red-100 text-red-800" },
  REFUNDED: { label: "Reembolsada", cls: "bg-gray-100 text-gray-800" },
  CANCELED: { label: "Cancelada", cls: "bg-gray-100 text-gray-700 line-through" },
  RECEIVED_IN_CASH: { label: "Recebida", cls: "bg-green-100 text-green-800" },
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

export default function FaturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setInvoices(d.data || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Faturas</h1>
          <p className="text-gray-600 mt-1">Histórico de cobranças da sua assinatura.</p>
        </div>
        <Link
          href="/admin/billing/assinatura"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          ← Voltar
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma fatura ainda</p>
            <p className="text-gray-400 text-xs mt-1">
              Assine o plano Pro pra começar a ver seus pagamentos aqui.
            </p>
          </div>
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
                const s = STATUS_STYLES[inv.status] || { label: inv.status, cls: "bg-gray-100 text-gray-700" }
                const url = inv.invoiceUrl || inv.bankSlipUrl
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
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
                    <TableCell className="text-sm text-gray-600">{formatDate(inv.paymentDate)}</TableCell>
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
      </div>
    </div>
  )
}
