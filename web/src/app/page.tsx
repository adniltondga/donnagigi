"use client";

import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { mockProducts } from "@/lib/mockData";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-700 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">Capinhas Premium para Seu Celular</h1>
          <p className="text-xl text-primary-100 mb-8">
            Qualidade, estilo e proteção em um só lugar. Compre direto da Shopee ou Mercado Livre.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="https://shopee.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-primary-700 px-8 py-3 rounded-lg font-bold hover:bg-primary-100 transition"
            >
              Ir para Shopee
            </a>
            <a
              href="https://mercadolivre.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-primary-900 transition"
            >
              Ir para Mercado Livre
            </a>
          </div>
        </div>
      </section>

      {/* Products Showcase */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-16">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-gray-800 mb-2">Nossos Produtos</h2>
          <p className="text-gray-600">
            Mostruário de todas as capinhas disponíveis para compra
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mockProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Info Section */}
        <section className="mt-20 bg-primary-50 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-primary-900 mb-4">
            📝 Como Comprar?
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-primary-900">
            <div>
              <h4 className="font-bold mb-2">1. Escolha a Capinha</h4>
              <p>
                Visualize nossos modelos acima e escolha o design que mais se adequa ao seu estilo.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-2">2. Compre Online</h4>
              <p>
                Clique em &quot;Ir para Shopee&quot; ou &quot;Mercado Livre&quot; para fazer sua compra de forma segura.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-2">3. Receba em Casa</h4>
              <p>
                Acompanhe o envio e receba sua capinha premium com toda segurança e rapidez.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
