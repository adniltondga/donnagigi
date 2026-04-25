import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Em dev, manda 100% dos erros (volume baixo). Em prod, 100% também
  // por enquanto — quando volume crescer, abaixa pra 0.1 ou 0.2.
  tracesSampleRate: 1.0,

  // Não envia eventos em dev — evita poluir o dashboard com erros de
  // hot-reload, lint, etc. Comentar essa linha se quiser testar localmente.
  enabled: process.env.NODE_ENV === "production",

  // Replay desativado por enquanto (custa mais quota e não é crítico
  // numa fase inicial).
  integrations: [],
})
