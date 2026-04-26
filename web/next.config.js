const { withSentryConfig } = require("@sentry/nextjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // Habilita instrumentation.ts (necessário em Next 14; default em 15+).
    instrumentationHook: true,
  },
  // Lucide-react: cada ícone vira 1 import individual no bundle.
  // Resolve hydration mismatch causado por module resolution
  // inconsistente entre runtime do servidor e do cliente.
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{ kebabCase member }}",
      preventFullImport: true,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

// withSentryConfig faz upload de source maps em build de produção
// pra stack traces ficarem com nomes originais (não minificados).
// Em dev, é noop.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  // Sem org/project: source map upload fica desligado. Habilita só
  // quando criar SENTRY_AUTH_TOKEN no .env.
});
