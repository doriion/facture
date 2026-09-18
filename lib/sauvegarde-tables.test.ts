import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TABLES_SAUVEGARDE } from "./sauvegarde-helpers";

/**
 * Garde-fou : chaque table créée par une migration doit être exportée
 * par la sauvegarde JSON. Sinon une restauration serait amputée sans
 * que personne ne s'en aperçoive avant le jour où il faut restaurer.
 */
function tablesDesMigrations(): string[] {
  const dossier = join(__dirname, "..", "supabase", "migrations");
  const tables = new Set<string>();
  for (const fichier of readdirSync(dossier)) {
    if (!fichier.endsWith(".sql")) continue;
    const sql = readFileSync(join(dossier, fichier), "utf8");
    const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_]+)"?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) tables.add(m[1]!.toLowerCase());
  }
  return Array.from(tables).sort();
}

describe("TABLES_SAUVEGARDE", () => {
  it("couvre toutes les tables créées par les migrations", () => {
    const attendues = tablesDesMigrations();
    expect(attendues.length).toBeGreaterThan(20);
    const manquantes = attendues.filter(
      (t) => !(TABLES_SAUVEGARDE as readonly string[]).includes(t),
    );
    expect(manquantes).toEqual([]);
  });

  it("ne liste pas de table inconnue des migrations (faute de frappe)", () => {
    const attendues = tablesDesMigrations();
    const inconnues = TABLES_SAUVEGARDE.filter((t) => !attendues.includes(t));
    expect(inconnues).toEqual([]);
  });

  it("sans doublon", () => {
    expect(new Set(TABLES_SAUVEGARDE).size).toBe(TABLES_SAUVEGARDE.length);
  });
});
