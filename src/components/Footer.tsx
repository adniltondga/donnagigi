"use client";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-4">agLivre</h3>
            <p className="text-muted-foreground">
              Gestão financeira para vendedores do Mercado Livre.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Produto</h4>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>Integração Mercado Livre</li>
              <li>Integração Mercado Pago</li>
              <li>Relatórios e previsão</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contato</h4>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>Email: contato@aglivre.com.br</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Redes</h4>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8 text-center text-muted-foreground text-sm">
          <p>&copy; 2026 agLivre. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
