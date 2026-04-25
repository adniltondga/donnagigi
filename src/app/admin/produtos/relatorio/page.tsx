import Link from 'next/link'
import { ArrowRight, Package, ShoppingCart, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'

interface RelatorioCard {
  href: string
  icon: LucideIcon
  title: string
  description: string
  badge?: string
  accent: string
}

const CARDS: RelatorioCard[] = [
  {
    href: '/admin/relatorios/vendas-ml',
    icon: ShoppingCart,
    title: 'Vendas Mercado Livre',
    description: 'Listagem de todas as vendas ML com filtros, busca por pedido/pack e drill-down nas notas.',
    accent: 'bg-amber-50 text-amber-700',
  },
  {
    href: '/admin/relatorios/potencial-estoque',
    icon: Package,
    title: 'Potencial de estoque',
    description: 'Faturamento bruto, taxa ML, lucro e ticket médio — o que você receberia se vendesse tudo hoje.',
    accent: 'bg-emerald-50 text-emerald-700',
  },
]

export default function ProdutosRelatorioPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios de Produtos" description="Análises sobre seu catálogo e estoque." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="group block">
              <Card className="hover:shadow-md hover:border-primary-200 transition h-full">
                <CardContent className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${card.accent}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-bold text-foreground group-hover:text-primary-600 transition">
                        {card.title}
                      </h2>
                      {card.badge && (
                        <span className="bg-primary-100 text-primary-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
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
