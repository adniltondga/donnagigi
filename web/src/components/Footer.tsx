"use client";

/**
 * Ícone de email inline (em vez de <Mail /> do lucide-react).
 *
 * Há um bug conhecido em algumas versões do lucide-react onde o
 * icon renderizado no SSR não bate com o do client (paths
 * diferentes entre versões resolvidas). Como o Footer é puramente
 * estático, manter SVG inline garante hydration consistente.
 */
function MailIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

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
            <h4 className="font-semibold mb-4">Suporte</h4>
            <p className="text-muted-foreground text-sm mb-3">
              Dúvida, sugestão ou problema?
            </p>
            <a
              href="mailto:suporte@dgadigital.com.br"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition border border-white/10"
            >
              <MailIcon size={14} />
              suporte@dgadigital.com.br
            </a>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Empresa</h4>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <a
                  href="https://dgadigital.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition"
                >
                  DGA Digital
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8 text-center text-muted-foreground text-sm space-y-2">
          <p>&copy; 2026 agLivre. Todos os direitos reservados.</p>
          <p>
            Sistema desenvolvido pela{" "}
            <a
              href="https://dgadigital.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white hover:text-primary-400 transition"
            >
              DGA Digital
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
