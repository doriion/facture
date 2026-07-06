import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config Vitest — tests unitaires PURS uniquement : aucun accès réseau,
 * aucune connexion Supabase. Les modules testés (lib/format,
 * lib/ical-parser, lib/external-event-key, lib/exports/urssaf-helpers)
 * sont des fonctions synchrones sans effet de bord.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
