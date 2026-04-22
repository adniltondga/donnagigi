import Link from 'next/link';

interface RelatorioCard {
  href: string;
  emoji: string;
  title: string;
  description: string;
  badge?: string;
  gradient: string;
}

const CARDS: RelatorioCard[] = [
  {
    href: '/admin/relatorios/vendas-ml',
    emoji: '🛒',
    title: 'Vendas Mercado Livre',
    description: 'Listagem de todas as vendas ML com filtros, busca por pedido/pack e drill-down nas notas.',
    gradient: 'from-amber-400 to-yellow-500',
  },
  {
    href: '/admin/relatorios/por-dia',
    emoji: '📈',
    title: 'Vendas por dia',
    description: 'Faturamento bruto, taxas ML, custo e lucro agregados por dia do mês selecionado.',
    gradient: 'from-sky-500 to-indigo-600',
  },
  {
    href: '/admin/relatorios-v2',
    emoji: '📊',
    title: 'Relatório V2',
    description: 'KPIs com comparativo vs período anterior, tendência diária, top produtos e devoluções.',
    badge: 'BETA',
    gradient: 'from-primary-500 to-fuchsia-600',
  },
  {
    href: '/admin/previsao',
    emoji: '💸',
    title: 'Previsão de recebimentos',
    description: 'Quando o ML deve liberar cada venda (paidDate + 30 dias) agrupado por dia do mês.',
    gradient: 'from-emerald-500 to-teal-600',
  },
];

export default function RelatoriosIndexPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">📊 Relatórios</h1>
      <p className="text-gray-600 mb-8">Escolha um relatório para analisar.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden border border-transparent hover:border-primary-200"
          >
            <div className={`h-2 bg-gradient-to-r ${card.gradient}`} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="text-3xl">{card.emoji}</div>
                {card.badge && (
                  <span className="bg-primary-100 text-primary-700 text-xs font-semibold px-2 py-0.5 rounded">
                    {card.badge}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition">
                {card.title}
              </h2>
              <p className="text-sm text-gray-600 mt-1">{card.description}</p>
              <div className="mt-3 text-xs text-primary-600 font-semibold opacity-0 group-hover:opacity-100 transition">
                Abrir →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
