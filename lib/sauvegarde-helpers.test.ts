import { describe, expect, it } from "vitest";

import {
  cleTri,
  nomArchiveFichiers,
  nomFichierSauvegarde,
  sauvegardeMensuelleDue,
  sauvegardesASupprimer,
} from "./sauvegarde-helpers";

describe("nomFichierSauvegarde", () => {
  it("nom stable par jour (relance le même jour = écrasement, pas de doublon)", () => {
    expect(nomFichierSauvegarde("2026-09-01")).toBe(
      "sauvegarde-facture-ae-2026-09-01.json",
    );
    expect(nomArchiveFichiers("2026-09-01")).toBe(
      "sauvegarde-facture-ae-2026-09-01-fichiers.zip",
    );
  });
});

describe("cleTri", () => {
  it("id par défaut, clés propres aux tables sans id", () => {
    expect(cleTri("factures")).toEqual(["id"]);
    expect(cleTri("numerotation")).toEqual(["annee", "type_document"]);
    expect(cleTri("bareme_entretien_reglages")).toEqual(["user_id"]);
  });
});

describe("sauvegardesASupprimer", () => {
  const nom = (d: string) => `sauvegarde-facture-ae-${d}.json`;
  const zip = (d: string) => `sauvegarde-facture-ae-${d}-fichiers.zip`;

  it("garde les 12 mensuelles les plus récentes, supprime les plus anciennes", () => {
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

  it("les sauvegardes manuelles n'évincent pas les mensuelles (quotas séparés)", () => {
    const mensuelles = ["2026-01-01", "2026-02-01", "2026-03-01"].map(nom);
    const manuelles = [
      "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08",
      "2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12",
    ].map(nom);
    const aSupprimer = sauvegardesASupprimer([...manuelles, ...mensuelles]);
    // 3 mensuelles < 12 : toutes gardées ; 8 manuelles > 6 : 2 plus anciennes supprimées
    expect(aSupprimer).toEqual([nom("2026-03-06"), nom("2026-03-05")]);
  });

  it("traite l'archive de fichiers comme le JSON, séparément", () => {
    const noms = [
      nom("2026-01-01"), nom("2026-02-01"),
      zip("2026-01-01"), zip("2026-02-01"), zip("2026-03-01"),
    ];
    expect(sauvegardesASupprimer(noms, { mensuelles: 2, autres: 6 })).toEqual([
      zip("2026-01-01"),
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

describe("sauvegardeMensuelleDue", () => {
  it("due le 1er, ou tant qu'aucun succès n'existe ce mois-ci (rattrapage)", () => {
    expect(sauvegardeMensuelleDue("2026-10-01", [])).toBe(true);
    expect(sauvegardeMensuelleDue("2026-10-07", [])).toBe(true);
    expect(sauvegardeMensuelleDue("2026-10-07", ["2026-09-01", "2026-09-28"])).toBe(true);
    expect(sauvegardeMensuelleDue("2026-10-07", ["2026-10-01"])).toBe(false);
    // une sauvegarde manuelle du mois compte
    expect(sauvegardeMensuelleDue("2026-10-07", ["2026-10-03"])).toBe(false);
  });

  it("après un échec, réessaie tous les 3 jours seulement (pas un email par jour)", () => {
    expect(sauvegardeMensuelleDue("2026-10-02", [], ["2026-10-01"])).toBe(false);
    expect(sauvegardeMensuelleDue("2026-10-03", [], ["2026-10-01"])).toBe(false);
    expect(sauvegardeMensuelleDue("2026-10-04", [], ["2026-10-01"])).toBe(true);
    expect(sauvegardeMensuelleDue("2026-10-05", [], ["2026-10-01", "2026-10-04"])).toBe(false);
    // le 1er, on tente toujours
    expect(sauvegardeMensuelleDue("2026-11-01", [], ["2026-10-31"])).toBe(true);
  });
});
