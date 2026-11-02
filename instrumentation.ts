import type { Instrumentation } from "next";

/**
 * Point d'entrée d'instrumentation Next.js (standard depuis Next 15,
 * plus d'option expérimentale à activer).
 * Charge la config Sentry adaptée au runtime et remonte les erreurs
 * des routes/server actions — y compris les échecs de crons et
 * d'envois d'email (console.error + exceptions).
 *
 * SANS DSN, rien n'est chargé : le SDK (et OpenTelemetry qu'il tire)
 * pesait sur chaque démarrage à froid de la fonction serveur, pour ne
 * rien envoyer. Import à la demande seulement.
 */
const sentryActif = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export async function register() {
  if (!sentryActif) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!sentryActif) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
};
