import Link from "next/link";
import { Footer } from "@/components/Footer";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Package,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
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
          <nav className="flex items-center gap-3">
            <Link
              href="/admin/login"
              className="text-sm text-gray-700 hover:text-primary-600 font-medium px-3 py-2 transition"
            >
              Entrar
            </Link>
            <Link
              href="/admin/login?register=1"
              className="text-sm bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg transition"
            >
              Criar conta grátis
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-fuchsia-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-24 text-center">
          <div className="inline-block bg-white/10 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-6 border border-white/20">
            🔒 Feito para vendedores do Mercado Livre
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            O painel financeiro <br />
            que o ML não te dá.
          </h1>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Veja quando cada venda libera, quanto fica de lucro real depois das taxas
            e sincronize automaticamente o dinheiro que pinga no seu Mercado Pago.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/admin/login?register=1"
              className="bg-white text-primary-700 px-8 py-3 rounded-lg font-bold hover:bg-primary-50 transition inline-flex items-center justify-center gap-2"
            >
              Criar conta grátis
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/admin/login"
              className="bg-white/10 backdrop-blur border border-white/30 text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/20 transition"
            >
              Já tenho conta
            </Link>
          </div>
          <p className="text-sm text-white/70 mt-6">
            Sem cartão de crédito · 1 minuto pra conectar seu ML
          </p>
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
            desc="Saiba quanto o ML vai te pagar nos próximos 30 dias, por dia, com data exata."
          />
          <FeatureCard
            icon={<DollarSign />}
            title="Sincroniza com MP"
            desc="O que o ML libera pro seu Mercado Pago aparece aqui — sem precisar conferir manualmente."
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
              desc="Email, senha e nome do seu negócio. Sem cartão."
            />
            <Step
              n={2}
              title="Conecta o Mercado Livre"
              desc="OAuth oficial do ML — não armazenamos sua senha."
            />
            <Step
              n={3}
              title="Acompanha tudo"
              desc="Seus pedidos, lucros e recebimentos aparecem em segundos."
            />
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
            Leva 1 minuto pra criar conta e conectar seu ML.
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
