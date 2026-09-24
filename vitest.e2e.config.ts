import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests de bout en bout « publics » : l'application construite (`next
 * build`) est démarrée avec des variables Supabase factices et pilotée
 * dans Chromium (bibliothèque Playwright). Aucune connexion réelle,
 * aucune donnée : on vérifie ce qu'un visiteur non connecté obtient
 * (connexion, redirections, pages publiques, PWA, robots).
 *
 *   npm run build && npm run test:e2e
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
