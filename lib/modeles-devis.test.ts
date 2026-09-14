import { describe, expect, it } from "vitest";

import {
  NOM_MODELE_MAX,
  modeleSansNom,
  nomModeleAffiche,
  normaliserNomModele,
  trierModeles,
} from "./modeles-devis";

describe("normaliserNomModele", () => {
  it("accepte un nom simple tel quel", () => {
    expect(normaliserNomModele("Pose monosplit")).toEqual({
      ok: true,
      nom: "Pose monosplit",
    });
  });

  it("rogne et dédouble les espaces (saisie mobile)", () => {
    expect(normaliserNomModele("  Entretien   PAC \n")).toEqual({
      ok: true,
      nom: "Entretien PAC",
    });
  });

  it("refuse le vide, les espaces seuls, null et undefined", () => {
    for (const saisie of ["", "   ", null, undefined]) {
      const r = normaliserNomModele(saisie);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/nom/i);
    }
  });

  it("borne la longueur à NOM_MODELE_MAX (même limite que la base)", () => {
    expect(normaliserNomModele("a".repeat(NOM_MODELE_MAX)).ok).toBe(true);
    const trop = normaliserNomModele("a".repeat(NOM_MODELE_MAX + 1));
    expect(trop.ok).toBe(false);
    if (!trop.ok) expect(trop.error).toContain(String(NOM_MODELE_MAX));
  });

  it("mesure la longueur APRÈS nettoyage des espaces", () => {
    const saisie = "a".repeat(NOM_MODELE_MAX) + "     ";
    expect(normaliserNomModele(saisie).ok).toBe(true);
  });
});

describe("nomModeleAffiche / modeleSansNom", () => {
  it("affiche le nom choisi quand il existe", () => {
    const m = { numero: "DEV-2026-0012", nom_modele: "Pose multisplit" };
    expect(nomModeleAffiche(m)).toBe("Pose multisplit");
    expect(modeleSansNom(m)).toBe(false);
  });

  it("retombe sur le numéro pour un modèle d'avant la migration (NULL)", () => {
    const m = { numero: "DEV-2026-0012", nom_modele: null };
    expect(nomModeleAffiche(m)).toBe("Modèle DEV-2026-0012");
    expect(modeleSansNom(m)).toBe(true);
    expect(nomModeleAffiche({ numero: "DEV-2026-0013" })).toBe(
      "Modèle DEV-2026-0013",
    );
  });

  it("un nom fait d'espaces compte comme absent", () => {
    const m = { numero: "DEV-2026-0012", nom_modele: "   " };
    expect(nomModeleAffiche(m)).toBe("Modèle DEV-2026-0012");
    expect(modeleSansNom(m)).toBe(true);
  });
});

describe("trierModeles", () => {
  it("alphabétique, insensible à la casse et aux accents, sans-nom en dernier", () => {
    const modeles = [
      { numero: "DEV-2026-0030", nom_modele: null },
      { numero: "DEV-2026-0010", nom_modele: "remplacement chauffe-eau" },
      { numero: "DEV-2026-0020", nom_modele: "Entretien PAC" },
      { numero: "DEV-2026-0005", nom_modele: null },
      { numero: "DEV-2026-0015", nom_modele: "Pose monosplit" },
      { numero: "DEV-2026-0016", nom_modele: "Pose multisplit" },
      { numero: "DEV-2026-0017", nom_modele: "Épuration circuit chauffage" },
    ];
    expect(trierModeles(modeles).map((m) => m.numero)).toEqual([
      "DEV-2026-0020", // Entretien PAC
      "DEV-2026-0017", // Épuration (É trié comme E)
      "DEV-2026-0015", // Pose monosplit
      "DEV-2026-0016", // Pose multisplit
      "DEV-2026-0010", // remplacement chauffe-eau (minuscule, pas relégué)
      "DEV-2026-0005", // sans nom → par numéro
      "DEV-2026-0030",
    ]);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const modeles = [
      { numero: "B", nom_modele: "B" },
      { numero: "A", nom_modele: "A" },
    ];
    const copie = [...modeles];
    trierModeles(modeles);
    expect(modeles).toEqual(copie);
  });

  it("numérique naturel : « Pose 2 splits » avant « Pose 10 splits »", () => {
    const tries = trierModeles([
      { numero: "1", nom_modele: "Pose 10 splits" },
      { numero: "2", nom_modele: "Pose 2 splits" },
    ]);
    expect(tries.map((m) => m.nom_modele)).toEqual([
      "Pose 2 splits",
      "Pose 10 splits",
    ]);
  });
});
