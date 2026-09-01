import { describe, expect, it } from "vitest";

import {
  nomFichierSauvegarde,
  sauvegardesASupprimer,
} from "./sauvegarde-helpers";

describe("nomFichierSauvegarde", () => {
  it("nom stable par jour (relance le même jour = écrasement, pas de doublon)", () => {
    expect(nomFichierSauvegarde("2026-09-01")).toBe(
      "sauvegarde-facture-ae-2026-09-01.json",
    );
  });
});

describe("sauvegardesASupprimer", () => {
  const nom = (d: string) => `sauvegarde-facture-ae-${d}.json`;

  it("garde les 12 plus récentes, supprime les plus anciennes", () => {
    // 15 mois consécutifs : jan 2026 → mars 2027
    const dates = [
      "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01",
      "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01",
      "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01",
      "2027-01-01", "2027-02-01", "2027-03-01",
    ];
    const aSupprimer = sauvegardesASupprimer(dates.map(nom), 12);
    // Les supprimées sont les 3 plus ANCIENNES
    expect(aSupprimer).toEqual([
      nom("2026-03-01"),
      nom("2026-02-01"),
      nom("2026-01-01"),
    ]);
  });

  it("rien à supprimer à 12 ou moins", () => {
    const noms = [nom("2026-01-01"), nom("2026-02-01")];
    expect(sauvegardesASupprimer(noms, 12)).toEqual([]);
  });

  it("ignore les fichiers qui ne sont pas des sauvegardes datées", () => {
    const noms = [
      "note.txt",
      nom("2026-01-01"),
      "sauvegarde-facture-ae-pas-une-date.json",
    ];
    expect(sauvegardesASupprimer(noms, 0)).toEqual([nom("2026-01-01")]);
  });

  it("l'ordre d'entrée n'importe pas", () => {
    const noms = [nom("2026-03-01"), nom("2026-01-01"), nom("2026-02-01")];
    expect(sauvegardesASupprimer(noms, 1)).toEqual([
      nom("2026-02-01"),
      nom("2026-01-01"),
    ]);
  });
});
