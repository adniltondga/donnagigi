"use client";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-4">Donna Gigi</h3>
            <p className="text-gray-400">
              Capinhas de celular de alta qualidade para todos os estilos.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Lojas</h4>
            <ul className="text-gray-400 space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  Shopee
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  Mercado Livre
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contato</h4>
            <ul className="text-gray-400 space-y-2 text-sm">
              <li>Email: contato@donnagigi.com</li>
              <li>WhatsApp: (11) 9XXXX-XXXX</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Redes Sociais</h4>
            <ul className="text-gray-400 space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  Instagram
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2024 Donna Gigi. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
