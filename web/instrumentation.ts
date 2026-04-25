// Hook do Next.js (App Router) que registra os SDKs de runtime ao
// iniciar a aplicação. Sentry usa isso pra plugar no Node e no Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export { onRequestError } from "@sentry/nextjs"
