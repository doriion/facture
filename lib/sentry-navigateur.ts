/**
 * Remontée d'une erreur à Sentry depuis le navigateur SANS embarquer le
 * SDK (104 ko gzip) dans le JS commun à toutes les pages : il n'est
 * chargé qu'au moment d'une erreur, et seulement si un DSN est configuré
 * (sans DSN, l'appel ne fait rien — l'erreur reste dans la console).
 *
 * Avec un DSN, sentry.client.config.ts (injecté par withSentryConfig)
 * a déjà initialisé le SDK au chargement de la page : l'import ci-dessous
 * renvoie la même instance, l'évènement part nettoyé (beforeSend).
 */
export function signalerErreur(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      /* SDK indisponible (hors ligne) : rien à faire. */
    });
}
