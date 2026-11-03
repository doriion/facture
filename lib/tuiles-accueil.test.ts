import { describe, expect, it } from "vitest";

import { deplacer, normaliserTuiles, TUILES_PAR_DEFAUT, TUILES_POSSIBLES, tuilesDepuis } from "./tuiles-accueil";

describe("tuiles de l'accueil", () => {
  it("liens connus et distincts gardés dans l'ordre, l'accueil lui-même exclu", () => {
    expect(normaliserTuiles(["/factures", "/agenda", "/devis/nouveau", "/agenda", "/inconnu", "/accueil"])).toEqual(["/factures", "/agenda", "/devis/nouveau"]);
    expect(TUILES_POSSIBLES.some((t) => t.href === "/accueil")).toBe(false);
  });
  it("valeur absente, abîmée ou vide → défaut (tous proposables)", () => {
    expect(normaliserTuiles(null)).toEqual(TUILES_PAR_DEFAUT);
    expect(normaliserTuiles([])).toEqual(TUILES_PAR_DEFAUT);
    expect(normaliserTuiles(["/rien"])).toEqual(TUILES_PAR_DEFAUT);
    for (const h of TUILES_PAR_DEFAUT) expect(tuilesDepuis([h])).toHaveLength(1);
  });
  it("déplacer monte ou descend une tuile sans sortir des bornes", () => {
    expect(deplacer(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(deplacer(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(deplacer(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(deplacer(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
