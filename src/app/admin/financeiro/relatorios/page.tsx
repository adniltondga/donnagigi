import Link from "next/link"
import { ArrowRight, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"

interface Item {
  href: string
  icon: LucideIcon
  title: string
  description: string
  accent: string
}

const CARDS: Item[] = [
  {
    href: "/admin/financeiro/relatorios/recebimentos",
    icon: TrendingUp,
    title: "Previsão de recebimentos",
    description: "Gráfico diário do dinheiro a entrar — liberações do Mercado Pago + contas a receber manuais.",
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    href: "/admin/financeiro/relatorios/pagamentos",
    icon: TrendingDown,
    title: "Previsão de pagamentos",
    description: "Gráfico diário das contas a pagar pendentes no período.",
    accent: "bg-rose-50 text-rose-700",
  },
]

export default function FinanceiroRelatoriosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="📈 Relatórios financeiros"
        description="Fluxo de entradas e saídas por dia, com filtros por período."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="group block">
              <Card className="hover:shadow-md hover:border-primary-200 transition h-full">
                <CardContent className="flex items-start gap-4 pt-5">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${card.accent}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-900 group-hover:text-primary-600 transition mb-1">
                      {card.title}
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 font-semibold opacity-0 group-hover:opacity-100 transition">
                      Abrir <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
