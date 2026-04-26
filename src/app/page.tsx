import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/Footer";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Package,
  CheckCircle2,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";

const SITE_URL = "https://aglivre.dgadigital.com.br";

// Catálogo de planos exibido no marketing. O backend ainda só tem
// FREE/PRO (src/lib/plans.ts) — os tiers Pro/Business/Enterprise abaixo
// refletem o roadmap e serão plugados ao schema no Sprint 1 de billing.
interface MarketingPlan {
  id: "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE";
  name: string;
  tagline: string;
  /** Em BRL, ou "custom" para "sob consulta". */
  priceBRL: number | "custom";
  popular?: boolean;
  ctaLabel: string;
  /** Override do link de CTA. Default = /admin/login?register=1. */
  ctaHref?: string;
  features: string[];
}

const MARKETING_PLANS: MarketingPlan[] = [
  {
    id: "FREE",
    name: "Free",
    tagline: "Pra começar e enxergar seu lucro real",
    priceBRL: 0,
    ctaLabel: "Começar grátis",
    features: [
      "Até 30 vendas/mês sincronizadas",
      "Sincronização com Mercado Livre",
      "Dashboard, vendas por dia e listagem de vendas ML",
      "Custos por anúncio e variação (lucro real)",
      "Relatórios",
      "Pró-labore seguro",
      "Contas a pagar / a receber + categorias",
      "Top produtos e potencial de estoque",
      "Export CSV",
      "Histórico de 6 meses",
      "1 usuário",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    tagline: "Conecte com o Mercado Pago e cresça",
    priceBRL: 49,
    popular: true,
    ctaLabel: "Assinar Pro",
    features: [
      "Até 300 vendas/mês sincronizadas",
      "Tudo do Free",
      "Mercado Pago — saldo a liberar e cronograma diário",
      "Retidos por reclamação separados",
      "Previsão de recebimentos",
      "Histórico ilimitado",
      "Multi-usuário (até 3)",
      "Suporte via ticket — resposta em 24h",
    ],
  },
  {
    id: "BUSINESS",
    name: "Business",
    tagline: "Mobile + Chrome pra operação séria",
    priceBRL: 99,
    ctaLabel: "Assinar Business",
    features: [
      "Até 1.000 vendas/mês sincronizadas",
      "Tudo do Pro",
      "Extensão Chrome — sync 1-click direto do anúncio (em breve)",
      "App mobile (PWA) com push de vendas e devoluções",
      "Multi-usuário (até 5)",
      "Suporte via ticket — prioridade alta",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    tagline: "Operação grande com volume customizado",
    priceBRL: "custom",
    ctaLabel: "Falar com a gente",
    ctaHref: "mailto:comercial@dgadigital.com.br?subject=Plano%20Enterprise%20agLivre",
    features: [
      "Vendas ilimitadas",
      "Tudo do Business",
      "Multi-usuário ilimitado",
      "Webhooks e API customizados",
      "SLA com suporte dedicado",
    ],
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Como o agLivre se conecta com o Mercado Livre e Mercado Pago?",
    a: "Via OAuth oficial — o mesmo fluxo que o ML e MP usam pra apps verificados. Você é redirecionado pro site do ML/MP, autoriza o acesso e volta pro agLivre. A gente nunca pede nem armazena sua senha.",
  },
  {
    q: "Vocês armazenam minha senha do Mercado Livre?",
    a: "Não. Só guardamos os tokens de acesso que o ML/MP nos dá no fluxo OAuth — esses tokens podem ser revogados por você a qualquer momento na sua conta do ML/MP, sem precisar trocar senha.",
  },
  {
    q: "Quanto custa o agLivre? Tem trial?",
    a: "Sim, 14 dias grátis sem cartão de crédito. Depois disso, quatro planos: Free (R$ 0, até 30 vendas/mês), Pro (R$ 49, até 300 vendas/mês com Mercado Pago), Business (R$ 99, até 1.000 vendas/mês com app mobile e extensão Chrome) e Enterprise (sob consulta, vendas ilimitadas e suporte dedicado). Veja a seção Planos acima.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Não há fidelidade nem multa. Cancela direto pelo painel e a cobrança para no fim do ciclo atual.",
  },
  {
    q: "O agLivre calcula a taxa real do Mercado Livre por venda?",
    a: "Sim. A gente puxa o sale_fee real de cada pedido (não estimado), além da taxa de envio quando aplicável. Pedidos recém-criados que ainda não liquidaram aparecem com estimativa marcada como '(est.)' e são corrigidos automaticamente quando o ML liquida.",
  },
  {
    q: "Funciona pra MEI, ME ou empresa de qualquer porte?",
    a: "Sim. O agLivre é agnóstico de regime tributário — a integração depende só de você ter conta de seller no Mercado Livre. Vendedor pessoa física, MEI, ME, EIRELI, LTDA, todos funcionam igual.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "agLivre",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      description:
        "Painel financeiro para vendedores do Mercado Livre. Lucro real, taxas e liberações do Mercado Pago num só lugar.",
      foundingDate: "2026",
      parentOrganization: {
        "@type": "Organization",
        name: "DGA Digital",
        url: "https://dgadigital.com.br",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "agLivre",
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "agLivre",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Gestão financeira para vendedores do Mercado Livre: controle de vendas, taxas, lucro real, devoluções e liberações do Mercado Pago.",
      url: SITE_URL,
      inLanguage: "pt-BR",
      offers: MARKETING_PLANS.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.priceBRL,
        priceCurrency: "BRL",
        category: p.tagline,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Topbar */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white">aL</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              ag<span className="text-primary-600">Livre</span>
            </span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-3">
            <Link
              href="#planos"
              className="hidden sm:inline text-sm text-gray-700 hover:text-primary-600 font-medium px-3 py-2 transition"
            >
              Planos
            </Link>
            <Link
              href="#faq"
              className="hidden sm:inline text-sm text-gray-700 hover:text-primary-600 font-medium px-3 py-2 transition"
            >
              FAQ
            </Link>
            <Link
              href="/admin/login"
              className="text-sm text-gray-700 hover:text-primary-600 font-medium px-3 py-2 transition"
            >
              Entrar
            </Link>
            <Link
              href="/admin/login?register=1"
              className="text-sm bg-primary-600 hover:bg-primary-700 text-white font-semibold px-3 sm:px-4 py-2 rounded-lg transition"
            >
              <span className="hidden sm:inline">Criar conta grátis</span>
              <span className="sm:hidden">Criar conta</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-fuchsia-700 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Coluna esquerda — texto */}
            <div className="text-center lg:text-left">
              <div className="inline-block bg-white/10 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-6 border border-white/20">
                🔒 Feito para vendedores do Mercado Livre
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Tudo do seu Mercado Livre, <br />
                com lucro real na ponta.
              </h1>
              <p className="text-lg lg:text-xl text-white/90 mb-10 max-w-xl mx-auto lg:mx-0">
                Veja quando cada venda libera, quanto fica de lucro real depois das taxas
                e acompanhe o dinheiro do seu Mercado Pago — tudo num painel só.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/admin/login?register=1"
                  className="bg-white text-primary-700 px-8 py-3 rounded-lg font-bold hover:bg-primary-50 transition inline-flex items-center justify-center gap-2"
                >
                  Criar conta grátis
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/admin/login"
                  className="bg-white/10 backdrop-blur border border-white/30 text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/20 transition text-center"
                >
                  Já tenho conta
                </Link>
              </div>
              <p className="text-sm text-white/70 mt-6">
                Cadastro com email e senha · 14 dias grátis · Sem cartão de crédito
              </p>
            </div>

            {/* Coluna direita — screenshot do produto */}
            <div className="relative lg:scale-110 lg:translate-x-4">
              <div className="absolute -inset-4 bg-white/5 blur-3xl rounded-3xl" aria-hidden />
              <div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20">
                <Image
                  src="/screenshots/dashboard.png"
                  alt="Painel do agLivre mostrando vendas, lucro e liberações do Mercado Pago"
                  width={1600}
                  height={900}
                  priority
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto w-full px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Tudo num lugar só
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            Conecte sua conta do Mercado Livre e do Mercado Pago em 2 cliques. O agLivre cuida do resto.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<TrendingUp />}
            title="Lucro real, não bruto"
            desc="Tx de venda, envio, custo da mercadoria — tudo descontado automaticamente em cada pedido."
          />
          <FeatureCard
            icon={<Calendar />}
            title="Previsão de caixa"
            desc="Saiba quanto o Mercado Livre vai te pagar nos próximos 30 dias, por dia, com data exata."
          />
          <FeatureCard
            icon={<DollarSign />}
            title="Sincroniza com Mercado Pago"
            desc="O que o Mercado Livre libera pro seu Mercado Pago aparece aqui — sem precisar conferir manualmente."
          />
          <FeatureCard
            icon={<Package />}
            title="Relatórios que fazem sentido"
            desc="Top produtos por lucro, comparativo mês anterior, taxa de devolução. Sem Excel."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Começa em 3 passos
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Step
              n={1}
              title="Cria sua conta"
              desc="Email, senha e nome do seu negócio. Cadastro próprio do agLivre — sem login social."
            />
            <Step
              n={2}
              title="Conecta Mercado Livre e Mercado Pago"
              desc="OAuth oficial das duas plataformas. Não armazenamos sua senha — só os tokens necessários."
            />
            <Step
              n={3}
              title="Acompanha tudo"
              desc="Pedidos, lucros, taxas e liberações do Mercado Pago aparecem no painel em segundos."
            />
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-20 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Planos simples, sem fidelidade
            </h2>
            <p className="text-gray-600">
              Comece grátis por 14 dias. Cancele quando quiser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
            {MARKETING_PLANS.map((p) => {
              const ctaHref = p.ctaHref ?? "/admin/login?register=1";
              const isExternal = ctaHref.startsWith("mailto:") || ctaHref.startsWith("http");
              const ctaClass = `w-full py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                p.popular
                  ? "bg-white text-primary-700 hover:bg-primary-50"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              }`;
              const ctaContent = (
                <>
                  {p.ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </>
              );
              return (
                <div
                  key={p.id}
                  className={`relative rounded-2xl p-6 flex flex-col border ${
                    p.popular
                      ? "bg-gradient-to-br from-primary-600 to-fuchsia-700 text-white border-primary-600 shadow-xl lg:scale-[1.02]"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Mais popular
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className={`text-xl font-bold ${p.popular ? "text-white" : "text-gray-900"}`}>
                      {p.name}
                    </h3>
                    <p className={`text-sm mt-1 ${p.popular ? "text-primary-100" : "text-gray-500"}`}>
                      {p.tagline}
                    </p>
                  </div>
                  <div className="mb-6">
                    <span className={`text-4xl font-bold ${p.popular ? "text-white" : "text-gray-900"}`}>
                      {p.priceBRL === "custom"
                        ? "Sob consulta"
                        : p.priceBRL === 0
                        ? "Grátis"
                        : formatCurrency(p.priceBRL)}
                    </span>
                    {typeof p.priceBRL === "number" && p.priceBRL > 0 && (
                      <span className={`text-sm ml-1 ${p.popular ? "text-primary-100" : "text-gray-500"}`}>
                        /mês
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            p.popular ? "text-primary-200" : "text-primary-600"
                          }`}
                        />
                        <span className={p.popular ? "text-primary-50" : "text-gray-700"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isExternal ? (
                    <a href={ctaHref} className={ctaClass}>
                      {ctaContent}
                    </a>
                  ) : (
                    <Link href={ctaHref} className={ctaClass}>
                      {ctaContent}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            Todos os planos incluem 14 dias de trial grátis. Sem cartão de crédito.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-gray-50 py-20 scroll-mt-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Perguntas frequentes
            </h2>
            <p className="text-gray-600">
              Não achou o que procurava? Manda um email pra{" "}
              <a
                href="mailto:suporte@dgadigital.com.br"
                className="text-primary-600 hover:text-primary-700 underline underline-offset-2"
              >
                suporte@dgadigital.com.br
              </a>
              .
            </p>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details
                key={i}
                className="group bg-white border border-gray-200 rounded-xl p-5 open:shadow-md transition"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-gray-900">
                  <span>{f.q}</span>
                  <span className="shrink-0 w-6 h-6 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center text-lg leading-none group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Pronto pra ver seu lucro real?
          </h2>
          <p className="text-gray-600 mb-8">
            Leva 1 minuto pra criar conta e conectar Mercado Livre e Mercado Pago.
          </p>
          <Link
            href="/admin/login?register=1"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-8 py-3 rounded-lg transition"
          >
            Criar conta grátis
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-md transition">
      <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm">
          {n}
        </div>
        <CheckCircle2 className="text-primary-600" size={18} />
      </div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </div>
  );
}
