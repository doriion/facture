import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TABLES_SAUVEGARDE } from "./sauvegarde-helpers";

/**
 * Garde-fou : chaque COLONNE des tables sauvegardées (d'après
 * types/database.ts, synchronisé avec la production) doit être créée
 * par une migration du dépôt. Sinon un projet reconstruit depuis
 * `supabase/migrations` refuse les lignes de la sauvegarde (colonne
 * inconnue) — c'est arrivé avec agenda_couleurs et external_calendar_url,
 * créées à la main sur le projet.
 *
 * Reconnaît : les colonnes des blocs `create table … ( … )` et les
 * `add column [if not exists] nom`. Un simple mot dans un commentaire
 * ne compte pas.
 */
const RACINE = join(__dirname, "..");
const TYPES_SQL = /^(uuid|text|numeric|decimal|integer|int|int4|int8|bigint|smallint|boolean|bool|date|timestamptz|timestamp|jsonb|json|time|serial|bigserial|double|real|interval|bytea|inet|citext|varchar|char)\b/i;

function colonnesDesMigrations(): Map<string, Set<string>> {
  const dossier = join(RACINE, "supabase", "migrations");
  const parTable = new Map<string, Set<string>>();
  const ajouter = (table: string, col: string) => {
    if (!parTable.has(table)) parTable.set(table, new Set());
    parTable.get(table)!.add(col.toLowerCase());
  };
  for (const fichier of readdirSync(dossier).sort()) {
    if (!fichier.endsWith(".sql")) continue;
    const sql = readFileSync(join(dossier, fichier), "utf8")
      // commentaires SQL retirés : un nom cité en commentaire ne compte pas
      .replace(/--[^\n]*/g, "");

    // create table … ( … );
    const reCreate = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_]+)"?\s*\(([\s\S]*?)\);/gi;
    let m: RegExpExecArray | null;
    while ((m = reCreate.exec(sql)) !== null) {
      const table = m[1]!.toLowerCase();
      for (const ligneBrute of m[2]!.split("\n")) {
        const ligne = ligneBrute.trim().replace(/^,/, "").trim();
        const mc = /^"?([a-z_]+)"?\s+(.+)$/i.exec(ligne);
        if (!mc) continue;
        if (!TYPES_SQL.test(mc[2]!)) continue;
        ajouter(table, mc[1]!);
      }
    }
    // alter table … add column [if not exists] nom …
    const reAlter = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z_]+)"?([\s\S]*?);/gi;
    while ((m = reAlter.exec(sql)) !== null) {
      const table = m[1]!.toLowerCase();
      const reAdd = /add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_]+)"?/gi;
      let ma: RegExpExecArray | null;
      while ((ma = reAdd.exec(m[2]!)) !== null) ajouter(table, ma[1]!);
    }
  }
  return parTable;
}

function colonnesDesTypes(): Map<string, string[]> {
  const src = readFileSync(join(RACINE, "types", "database.ts"), "utf8");
  const debutTables = src.indexOf("Tables: {");
  const debutViews = src.indexOf("Views: {", debutTables);
  const zone = src.slice(debutTables, debutViews);
  const parTable = new Map<string, string[]>();
  const reTable = /^\s{6}([a-z_]+): \{\s*\n\s{8}Row: \{([\s\S]*?)\n\s{8}\}/gm;
  let m: RegExpExecArray | null;
  while ((m = reTable.exec(zone)) !== null) {
    const cols = Array.from(m[2]!.matchAll(/^\s{10}([a-z_]+)\??:/gm)).map((x) => x[1]!);
    parTable.set(m[1]!, cols);
  }
  return parTable;
}

describe("colonnes des tables sauvegardées", () => {
  it("chaque colonne de types/database.ts est créée par une migration du dépôt", () => {
    const migrations = colonnesDesMigrations();
    const types = colonnesDesTypes();
    expect(types.size).toBeGreaterThan(20);
    const manquantes: string[] = [];
    for (const table of TABLES_SAUVEGARDE) {
      const cols = types.get(table);
      expect(cols, `table ${table} absente de types/database.ts`).toBeDefined();
      const creees = migrations.get(table) ?? new Set<string>();
      for (const c of cols ?? []) {
        if (!creees.has(c)) manquantes.push(`${table}.${c}`);
      }
    }
    expect(manquantes).toEqual([]);
  });
});
