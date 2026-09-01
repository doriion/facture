import { describe, expect, it } from "vitest";

import { computeSections, estTitre, totalLignes } from "./sections";

const titre = (designation: string) => ({
  designation,
  total_ht: 0,
  type: "titre",
});
const ligne = (designation: string, total_ht: number) => ({
  designation,
  total_ht,
  type: "ligne",
});

describe("computeSections", () => {
  it("découpe en sections avec sous-totaux (cas nominal matériel/main-d'œuvre)", () => {
    const { sections, hasSections } = computeSections([
      titre("MATÉRIEL"),
      ligne("Unité extérieure", 2900),
      ligne("Liaisons frigorifiques", 726),
      titre("MAIN-D'ŒUVRE"),
      ligne("Pose et mise en service", 520),
    ]);
    expect(hasSections).toBe(true);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.titre).toBe("MATÉRIEL");
    expect(sections[0]!.sousTotal).toBe(3626);
    expect(sections[0]!.lignes).toHaveLength(2);
    expect(sections[1]!.titre).toBe("MAIN-D'ŒUVRE");
    expect(sections[1]!.sousTotal).toBe(520);
  });

  it("les lignes avant le premier titre forment une section sans titre", () => {
    const { sections } = computeSections([
      ligne("Déplacement", 50),
      titre("MATÉRIEL"),
      ligne("Robinet", 80),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.titre).toBeNull();
    expect(sections[0]!.sousTotal).toBe(50);
    expect(sections[1]!.sousTotal).toBe(80);
  });

  it("document sans titre : une seule section anonyme, hasSections=false (rendu inchangé)", () => {
    const { sections, hasSections } = computeSections([
      ligne("Entretien PAC", 180),
      ligne("Déplacement", 40),
    ]);
    expect(hasSections).toBe(false);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.titre).toBeNull();
    expect(sections[0]!.sousTotal).toBe(220);
  });

  it("titre vide de lignes : sous-total 0 (pas de crash)", () => {
    const { sections } = computeSections([
      titre("MATÉRIEL"),
      titre("MAIN-D'ŒUVRE"),
      ligne("Pose", 300),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.sousTotal).toBe(0);
    expect(sections[1]!.sousTotal).toBe(300);
  });

  it("arrondit les sous-totaux au centime (flottants)", () => {
    const { sections } = computeSections([
      titre("S"),
      ligne("a", 0.1),
      ligne("b", 0.2),
    ]);
    expect(sections[0]!.sousTotal).toBe(0.3);
  });

  it("liste vide : aucune section", () => {
    expect(computeSections([])).toEqual({ sections: [], hasSections: false });
  });
});

describe("totalLignes / estTitre", () => {
  it("le total général ignore les titres", () => {
    expect(
      totalLignes([
        titre("MATÉRIEL"),
        ligne("a", 100),
        // un titre avec un total_ht parasite ne compte pas
        { designation: "T", total_ht: 999, type: "titre" },
        ligne("b", 23.45),
      ]),
    ).toBe(123.45);
  });

  it("estTitre ne reconnaît que type='titre' (défaut = ligne)", () => {
    expect(estTitre({ type: "titre" })).toBe(true);
    expect(estTitre({ type: "ligne" })).toBe(false);
    expect(estTitre({})).toBe(false);
    expect(estTitre({ type: null })).toBe(false);
  });
});
