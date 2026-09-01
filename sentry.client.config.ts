import * as Sentry from "@sentry/nextjs";

import { nettoyerEvenementSentry } from "@/lib/sentry-scrub";

/**
 * Sentry côté navigateur. Inactif sans NEXT_PUBLIC_SENTRY_DSN.
 * PII : pas de replay (il capturerait l'écran, donc les noms de
 * clients), pas de user, textes masqués.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    return nettoyerEvenementSentry(event);
  },
});
