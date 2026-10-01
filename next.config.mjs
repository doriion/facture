import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Hôte Supabase du projet, pour n'autoriser l'optimiseur d'images que
 * sur NOTRE stockage (le motif *.supabase.co laissait n'importe quel
 * projet tiers faire traiter ses fichiers par /_next/image).
 */
const hoteSupabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

/**
 * En-têtes de sécurité sur toutes les réponses. Pas de CSP complète :
 * Next 14 injecte des scripts en ligne, une CSP stricte casserait
 * l'application ; frame-ancestors suffit contre le clickjacking.
 */
const ENTETES_SECURITE = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: hoteSupabase,
        pathname: "/storage/v1/**",
      },
    ],
  },
  experimental: {
    // Requis par instrumentation.ts (Sentry) sur Next 14
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: ENTETES_SECURITE }];
  },
  webpack(config) {
    // Avertissement « Critical dependency » de require-in-the-middle
    // (OpenTelemetry, chargé par @sentry/nextjs côté serveur) : sans
    // effet, et withSentryConfig le masquait déjà quand il enveloppait
    // la config. Même silence sans DSN.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /require-in-the-middle/ },
    ];
    return config;
  },
};

// withSentryConfig injecte sentry.client.config.ts côté navigateur : le
// SDK pesait 104 ko gzip (65 % du JS commun à toutes les pages) alors
// qu'il reste inactif sans NEXT_PUBLIC_SENTRY_DSN. Sans DSN au moment
// du build, la config n'est donc pas enveloppée : le téléphone ne
// télécharge rien, seule l'instrumentation serveur (instrumentation.ts)
// subsiste. Avec un DSN : intégration complète, sans upload de source
// maps (pas de SENTRY_AUTH_TOKEN nécessaire).
const sentryNavigateur = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default sentryNavigateur
  ? withSentryConfig(nextConfig, {
      silent: true,
      sourcemaps: { disable: true },
      telemetry: false,
      webpack: { treeshake: { removeDebugLogging: true } },
    })
  : nextConfig;
