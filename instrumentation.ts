import * as Sentry from "@sentry/nextjs";

/**
 * Point d'entrée d'instrumentation Next.js (nécessite
 * experimental.instrumentationHook, activé dans next.config.mjs).
 * Charge la config Sentry adaptée au runtime et remonte les erreurs
 * des routes/server actions — y compris les échecs de crons et
 * d'envois d'email (console.error + exceptions).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
