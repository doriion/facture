import { describe, expect, it } from "vitest";

import { dateDansTexte, heureDansTexte, parserTournee, separerVilleMajuscules } from "./tournee";

describe("dates et heures écrites", () => {
  it("formats usuels, année déduite vers l'avenir", () => {
    expect(dateDansTexte("Lundi 12/11", "2026-11-09")).toBe("2026-11-12");
    expect(dateDansTexte("12/11/2026", "2026-11-09")).toBe("2026-11-12");
    expect(dateDansTexte("3 janvier", "2026-11-09")).toBe("2027-01-03");
    expect(dateDansTexte("mardi 3 novembre", "2026-11-09")).toBe("2026-11-03");
    expect(dateDansTexte("jeudi 12", "2026-11-09")).toBe("2026-11-12");
    expect(dateDansTexte("OMOBONI Nicole", "2026-11-09")).toBeNull();
  });
  it("heures : 9h, 9h30, 09:30, 14 h 00", () => {
    expect(heureDansTexte("RDV 9h")).toBe("09:00");
    expect(heureDansTexte("à 9h30 chez")).toBe("09:30");
    expect(heureDansTexte("09:30")).toBe("09:30");
    expect(heureDansTexte("14 h 00")).toBe("14:00");
    expect(heureDansTexte("448 avenue Aristide Briand")).toBeNull();
  });
});

describe("parser une tournée collée", () => {
  it("titres de date, entrées sur deux lignes, téléphone et heure", () => {
    const texte = `Jeudi 12/11
OMOBONI Nicole
448 avenue Aristide Briand, 38600 Fontaine
9h

BENIC Guy 06 12 34 56 78
41 Rue Casimir Périer VIZILLE
10h30

Vendredi 13/11
FAIVRE Karine, 455 Chemin des Rioux, 38560 Jarrie, 8h`;
    const rdv = parserTournee(texte, { dateParDefaut: "2026-11-09" });
    expect(rdv.map((r) => [r.date, r.heure, r.nom, r.adresse, r.code_postal, r.ville, r.telephone])).toEqual([
      ["2026-11-12", "09:00", "OMOBONI Nicole", "448 avenue Aristide Briand", "38600", "Fontaine", null],
      ["2026-11-12", "10:30", "BENIC Guy", "41 Rue Casimir Périer", null, "VIZILLE", "06 12 34 56 78"],
      ["2026-11-13", "08:00", "FAIVRE Karine", "455 Chemin des Rioux", "38560", "Jarrie", null],
    ]);
    expect(rdv[0]!.texte).toContain("OMOBONI Nicole");
  });
  it("sans date ni heure : date par défaut, journée", () => {
    const rdv = parserTournee("POLANO Janine\n28 Rue Paul Langevin ECHIROLLES", { dateParDefaut: "2026-11-09" });
    expect(rdv).toHaveLength(1);
    expect(rdv[0]).toMatchObject({ date: "2026-11-09", heure: null, nom: "POLANO Janine", adresse: "28 Rue Paul Langevin" });
  });
  it("une ligne sans nom reconnaissable est ignorée", () => {
    expect(parserTournee("448 avenue Aristide Briand\n06 12 34 56 78", { dateParDefaut: "2026-11-09" })).toEqual([]);
  });
});

describe("ville en majuscules en fin d'adresse", () => {
  it("sépare la ville quand la voie est en minuscules, pas quand tout est en capitales", () => {
    expect(separerVilleMajuscules({ adresse_ligne1: "5 rue de la bourgeat ST MARIE D'ALLOIX", code_postal: null, ville: null })).toEqual({ adresse_ligne1: "5 rue de la bourgeat", code_postal: null, ville: "ST MARIE D'ALLOIX" });
    expect(separerVilleMajuscules({ adresse_ligne1: "12 RUE DE LA PAIX", code_postal: null, ville: null })).toEqual({ adresse_ligne1: "12 RUE DE LA PAIX", code_postal: null, ville: null });
    expect(separerVilleMajuscules({ adresse_ligne1: "12 rue des Alpes", code_postal: "38000", ville: "Grenoble" })).toEqual({ adresse_ligne1: "12 rue des Alpes", code_postal: "38000", ville: "Grenoble" });
  });
});
