import * as Sentry from "@sentry/nextjs";

import { nettoyerEvenementSentry } from "@/lib/sentry-scrub";

/**
 * Sentry côté serveur (server actions, routes API, crons).
 * Inactif tant que NEXT_PUBLIC_SENTRY_DSN n'est pas définie.
 * PII : jamais de user/request/corps ; emails, montants, téléphones et
 * IBAN masqués dans les messages (lib/sentry-scrub, testé).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    return nettoyerEvenementSentry(event);
  },
});
