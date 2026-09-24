import { describe, expect, it } from "vitest";

import { TABLES_SAUVEGARDE } from "./sauvegarde-helpers";
// Le script de restauration exporte sa logique pour être exercée ici
// sans base de données (client simulé qui enregistre les écritures).
import {
  COLONNES_DIFFEREES,
  misesAJourDifferees,
  ORDRE_RESTAURATION,
  planifierRestauration,
  preparerLignes,
  restaurer,
  verifierSauvegarde,
} from "../scripts/restaurer-sauvegarde.mjs";

const ORIGINE = "11111111-1111-4111-8111-111111111111";
const CIBLE = "22222222-2222-4222-8222-222222222222";

function sauvegarde(data: Record<string, unknown[]> = {}) {
  const complet: Record<string, unknown[]> = {};
  for (const t of TABLES_SAUVEGARDE) complet[t] = data[t] ?? [];
  const tables: Record<string, number> = {};
  for (const [t, rows] of Object.entries(complet)) tables[t] = rows.length;
  return {
    meta: { app: "facture-ae", format_version: 1, exported_at: "2026-09-01T00:00:00Z", user_id: ORIGINE, tables },
    data: complet,
  };
}

type Ecriture = { table: string; type: "insert" | "update"; rows?: unknown[]; valeurs?: unknown; id?: string };

/** Client Supabase simulé : compte par table + journal des écritures. */
function clientSimule(comptes: Record<string, number> = {}) {
  const ecritures: Ecriture[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: async () => ({ count: comptes[table] ?? 0, error: null }),
        }),
        insert: async (rows: unknown[]) => {
          ecritures.push({ table, type: "insert", rows });
          return { error: null };
        },
        update: (valeurs: unknown) => ({
          eq: async (_col: string, id: string) => {
            ecritures.push({ table, type: "update", valeurs, id });
            return { error: null };
          },
        }),
      };
    },
  };
  return { client, ecritures };
}

describe("ordre de restauration", () => {
  it("couvre exactement les tables sauvegardées, sans doublon", () => {
    expect([...ORDRE_RESTAURATION].sort()).toEqual([...TABLES_SAUVEGARDE].sort());
    expect(new Set(ORDRE_RESTAURATION).size).toBe(ORDRE_RESTAURATION.length);
  });

  it("insère chaque table après celles qu'elle référence", () => {
    const avant = (a: string, b: string) =>
      ORDRE_RESTAURATION.indexOf(a) < ORDRE_RESTAURATION.indexOf(b);
    // Relevé des clés étrangères (hors colonnes différées)
    const dependances: Array<[string, string]> = [
      ["contrats", "clients"],
      ["contrats", "contrats_maintenance"],
      ["contrats_maintenance", "clients"],
      ["devis", "clients"],
      ["devis", "factures"],
      ["devis_lignes", "devis"],
      ["external_events_importes", "interventions"],
      ["facture_external_events", "factures"],
      ["factures", "clients"],
      ["factures_lignes", "factures"],
      ["intervention_bons", "interventions"],
      ["intervention_cerfa", "interventions"],
      ["intervention_photos", "interventions"],
      ["intervention_signatures", "interventions"],
      ["interventions", "clients"],
      ["interventions", "factures"],
      ["interventions", "interventions_series"],
      ["paiements", "factures"],
      ["relances", "factures"],
      ["taches", "clients"],
      ["taches", "devis"],
      ["taches", "factures"],
      ["taches", "interventions"],
      ["taches_photos", "taches"],
    ];
    for (const [table, ref] of dependances) {
      expect(avant(ref, table), `${ref} doit précéder ${table}`).toBe(true);
    }
    // Les références circulaires sont différées
    expect(COLONNES_DIFFEREES.factures).toEqual(["devis_id", "facture_parent_id"]);
  });
});

describe("verifierSauvegarde", () => {
  it("accepte une sauvegarde complète", () => {
    expect(verifierSauvegarde(sauvegarde())).toEqual([]);
  });

  it("refuse un fichier étranger, une table manquante, un compte incohérent", () => {
    expect(verifierSauvegarde({ meta: { app: "autre" } }).length).toBeGreaterThan(0);
    const s = sauvegarde();
    delete (s.data as Record<string, unknown>).clients;
    expect(verifierSauvegarde(s).join(" ")).toMatch(/clients absente/);
    const s2 = sauvegarde();
    s2.meta.tables.factures = 3;
    expect(verifierSauvegarde(s2).join(" ")).toMatch(/factures : 0 lignes lues, 3 annoncées/);
    const s3 = sauvegarde();
    (s3.data as Record<string, unknown>).table_future = [];
    expect(verifierSauvegarde(s3).join(" ")).toMatch(/inconnue du script/);
  });
});

describe("préparation des lignes", () => {
  it("remplace user_id et diffère les liens circulaires des factures", () => {
    const rows = [
      { id: "f1", user_id: ORIGINE, numero: "F-2026-0001", devis_id: "d1", facture_parent_id: null },
      { id: "f2", user_id: ORIGINE, numero: "F-2026-0002", devis_id: null, facture_parent_id: "f1" },
    ];
    const prepares = preparerLignes("factures", rows, CIBLE) as Array<Record<string, unknown>>;
    expect(prepares.every((r) => r.user_id === CIBLE)).toBe(true);
    expect(prepares.every((r) => r.devis_id === null && r.facture_parent_id === null)).toBe(true);
    expect(misesAJourDifferees("factures", rows)).toEqual([
      { id: "f1", valeurs: { devis_id: "d1" } },
      { id: "f2", valeurs: { facture_parent_id: "f1" } },
    ]);
    expect(misesAJourDifferees("clients", rows)).toEqual([]);
  });
});

describe("restaurer", () => {
  const donnees = sauvegarde({
    clients: [{ id: "c1", user_id: ORIGINE, nom: "Dupont" }],
    devis: [{ id: "d1", user_id: ORIGINE, client_id: "c1", facture_id: "f1" }],
    factures: [{ id: "f1", user_id: ORIGINE, client_id: "c1", devis_id: "d1", facture_parent_id: null }],
    factures_lignes: [{ id: "l1", user_id: ORIGINE, facture_id: "f1" }],
  });

  it("répétition à blanc : contrôle, plan, aucune écriture", async () => {
    const { client, ecritures } = clientSimule();
    const res = await restaurer(client, donnees, { utilisateur: CIBLE, executer: false });
    expect(ecritures).toEqual([]);
    expect(res.inseres).toBe(0);
    expect(planifierRestauration(donnees).find((p) => p.table === "clients")?.lignes).toBe(1);
  });

  it("refuse un compte cible non vide", async () => {
    const { client } = clientSimule({ factures: 4 });
    await expect(
      restaurer(client, donnees, { utilisateur: CIBLE, executer: true }),
    ).rejects.toThrow(/n'est pas vide : factures \(4\)/);
  });

  it("refuse un identifiant de compte invalide et une sauvegarde incohérente", async () => {
    const { client } = clientSimule();
    await expect(restaurer(client, donnees, { utilisateur: "abc", executer: false })).rejects.toThrow(/uuid/);
    await expect(
      restaurer(client, { meta: { app: "x" } }, { utilisateur: CIBLE, executer: false }),
    ).rejects.toThrow(/Sauvegarde refusée/);
  });

  it("exécution : insère dans l'ordre, remappe user_id, pose les liens différés à la fin", async () => {
    const { client, ecritures } = clientSimule();
    const res = await restaurer(client, donnees, { utilisateur: CIBLE, executer: true });
    const inserts = ecritures.filter((e) => e.type === "insert").map((e) => e.table);
    expect(inserts).toEqual(["clients", "factures", "devis", "factures_lignes"]);
    const facture = (ecritures.find((e) => e.table === "factures" && e.type === "insert")!.rows as Array<Record<string, unknown>>)[0]!;
    expect(facture.user_id).toBe(CIBLE);
    expect(facture.devis_id).toBeNull();
    const maj = ecritures.filter((e) => e.type === "update");
    expect(maj).toEqual([{ table: "factures", type: "update", id: "f1", valeurs: { devis_id: "d1" } }]);
    // Les mises à jour arrivent après TOUTES les insertions
    expect(ecritures.findIndex((e) => e.type === "update")).toBeGreaterThan(
      ecritures.map((e) => e.type).lastIndexOf("insert"),
    );
    expect(res.inseres).toBe(4);
    expect(res.misesAJour).toBe(1);
  });
});
