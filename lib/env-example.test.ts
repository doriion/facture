import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Garde-fou : chaque variable `process.env.X` lue par le code doit être
 * documentée dans .env.example, et inversement (un déploiement fait
 * « selon .env.example » avait des crons morts et des emails muets).
 */
function fichiers(dossier: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom.startsWith(".")) continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, acc);
    else if (/\.(ts|tsx|mjs|js)$/.test(nom) && !/\.test\.ts$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

// Variables posées par la plateforme (Next.js, Vercel), pas par nous.
const IGNOREES = new Set(["NODE_ENV", "NEXT_RUNTIME", "VERCEL_ENV", "VERCEL_URL", "CI"]);

describe(".env.example", () => {
  const racine = join(__dirname, "..");
  const exemple = readFileSync(join(racine, ".env.example"), "utf8");
  const documentees = new Set(
    exemple
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("=")[0]!.trim()),
  );
  const lues = new Set<string>();
  const racines = [
    ...fichiers(join(racine, "app")),
    ...fichiers(join(racine, "lib")),
    ...fichiers(join(racine, "components")),
    join(racine, "middleware.ts"),
    // Sentry lit son DSN dans ses fichiers de configuration à la racine.
    ...readdirSync(racine)
      .filter((n) => /^(sentry\..*\.config|instrumentation.*)\.ts$/.test(n))
      .map((n) => join(racine, n)),
  ];
  for (const f of racines) {
    const src = readFileSync(f, "utf8");
    const re = /process\.env\.([A-Z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      if (!IGNOREES.has(m[1]!)) lues.add(m[1]!);
    }
  }

  it("documente toutes les variables lues par le code", () => {
    const manquantes = Array.from(lues).filter((v) => !documentees.has(v)).sort();
    expect(manquantes).toEqual([]);
  });

  it("ne documente pas de variable que le code ne lit pas", () => {
    const inutiles = Array.from(documentees).filter((v) => !lues.has(v)).sort();
    expect(inutiles).toEqual([]);
  });
});
