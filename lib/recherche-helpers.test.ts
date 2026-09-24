import { describe, expect, it } from "vitest";

import {
  aplatirGroupes,
  deplacerSelection,
  normaliserRequete,
  resumerGroupes,
  type GroupeRecherche,
} from "./recherche-helpers";

const groupes: GroupeRecherche[] = [
  { cle: "clients", libelle: "Clients", resultats: [{ id: "c1", href: "/clients/c1", titre: "Dupont" }] },
  { cle: "factures", libelle: "Factures", resultats: [] },
  {
    cle: "devis",
    libelle: "Devis",
    resultats: [
      { id: "d1", href: "/devis/d1", titre: "D-2026-0001" },
      { id: "d2", href: "/devis/d2", titre: "D-2026-0002" },
    ],
  },
];

describe("normaliserRequete", () => {
  it("réduit les espaces, borne la longueur, refuse trop court", () => {
    expect(normaliserRequete("  dup   ont ")).toBe("dup ont");
    expect(normaliserRequete("a")).toBeNull();
    expect(normaliserRequete("   ")).toBeNull();
    expect(normaliserRequete("x".repeat(200))).toHaveLength(80);
  });
});

describe("navigation clavier", () => {
  it("aplatit dans l'ordre d'affichage", () => {
    expect(aplatirGroupes(groupes).map((r) => r.id)).toEqual(["c1", "d1", "d2"]);
  });

  it("boucle en bas et en haut, −1 sans résultat", () => {
    expect(deplacerSelection(-1, 3, 1)).toBe(0);
    expect(deplacerSelection(-1, 3, -1)).toBe(2);
    expect(deplacerSelection(2, 3, 1)).toBe(0);
    expect(deplacerSelection(0, 3, -1)).toBe(2);
    expect(deplacerSelection(0, 0, 1)).toBe(-1);
  });

  it("résume en ignorant les groupes vides", () => {
    const r = resumerGroupes(groupes);
    expect(r.groupes.map((g) => g.cle)).toEqual(["clients", "devis"]);
    expect(r.total).toBe(3);
  });
});
