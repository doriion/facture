import * as Sentry from "@sentry/nextjs";

import { nettoyerEvenementSentry } from "@/lib/sentry-scrub";

/** Sentry pour le runtime edge (middleware). Mêmes règles PII que le serveur. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    return nettoyerEvenementSentry(event);
  },
});
