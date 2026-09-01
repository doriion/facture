import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
  experimental: {
    // Requis par instrumentation.ts (Sentry) sur Next 14
    instrumentationHook: true,
  },
};

// withSentryConfig injecte sentry.client.config.ts côté navigateur.
// Pas d'upload de source maps (pas de SENTRY_AUTH_TOKEN nécessaire) :
// l'intégration reste 100 % inactive tant que NEXT_PUBLIC_SENTRY_DSN
// n'est pas définie.
export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  telemetry: false,
  disableLogger: true,
});
