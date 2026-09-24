import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";

/**
 * Démarre `next start` sur un port libre avec des variables Supabase
 * factices (le build n'a besoin d'aucune connexion réelle) et attend
 * que la page de connexion réponde. Le navigateur est celui de
 * Playwright ; `PW_CHROMIUM` permet d'en imposer un (poste sans
 * téléchargement des navigateurs).
 */
export const PORT = Number(process.env.E2E_PORT ?? 3461);
export const BASE = `http://localhost:${PORT}`;

let serveur: ChildProcess | null = null;
let navigateur: Browser | null = null;

async function attendreServeur(delaiMs: number): Promise<void> {
  const debut = Date.now();
  while (Date.now() - debut < delaiMs) {
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status === 200) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Le serveur n'a pas répondu en ${delaiMs / 1000} s sur ${BASE}.`);
}

export async function demarrer(): Promise<Browser> {
  if (!serveur) {
    serveur = spawn("npx", ["next", "start", "-p", String(PORT)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Vitest pose NODE_ENV=test : `next start` doit tourner en
        // production (sinon comportement non standard et avertissements).
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://e2e-placeholder.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_e2e_placeholder",
        // Aucune remontée d'erreurs ni requête sortante pendant les tests
        NEXT_PUBLIC_SENTRY_DSN: "",
        SENTRY_DSN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    serveur.stdout?.on("data", () => {});
    serveur.stderr?.on("data", (d: Buffer) => {
      if (process.env.E2E_DEBUG) process.stderr.write(d);
    });
    await attendreServeur(90_000);
  }
  if (!navigateur) {
    navigateur = await chromium.launch({
      executablePath: process.env.PW_CHROMIUM || undefined,
    });
  }
  return navigateur;
}

export async function arreter(): Promise<void> {
  await navigateur?.close();
  navigateur = null;
  if (serveur) {
    serveur.kill("SIGTERM");
    serveur = null;
  }
}
