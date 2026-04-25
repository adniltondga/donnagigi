import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 1.0,

  // Em dev, console.error é suficiente. Em prod, manda pro Sentry.
  enabled: process.env.NODE_ENV === "production",
})
