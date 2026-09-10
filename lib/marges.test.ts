import { describe, expect, it } from "vitest";

import { margeLigne, totauxMarges } from "./marges";

describe("margeLigne", () => {
  it("marge € et % : vente 100 (2 × 50), coût TTC 60 (2 × 30) → 40 € / 40 %", () => {
    expect(
      margeLigne({
        quantite: 2,
        prix_unitaire_ht: 50,
        prix_achat_ttc_unitaire: 30,
      }),
    ).toEqual({ coutTotal: 60, margeEuros: 40, margePct: 40 });
  });

  it("sans prix d'achat : aucune marge calculée (pas un coût nul)", () => {
    expect(
      margeLigne({ quantite: 3, prix_unitaire_ht: 100 }),
    ).toEqual({ coutTotal: null, margeEuros: null, margePct: null });
    expect(
      margeLigne({
        quantite: 3,
        prix_unitaire_ht: 100,
        prix_achat_ttc_unitaire: null,
      }),
    ).toEqual({ coutTotal: null, margeEuros: null, margePct: null });
  });

  it("division par zéro : PU = 0 → marge € négative mais % null", () => {
    expect(
      margeLigne({
        quantite: 1,
        prix_unitaire_ht: 0,
        prix_achat_ttc_unitaire: 25,
      }),
    ).toEqual({ coutTotal: 25, margeEuros: -25, margePct: null });
  });

  it("PA = 0 (pièce récupérée) : marge = 100 %", () => {
    expect(
      margeLigne({
        quantite: 1,
        prix_unitaire_ht: 80,
        prix_achat_ttc_unitaire: 0,
      }),
    ).toEqual({ coutTotal: 0, margeEuros: 80, margePct: 100 });
  });

  it("marge négative (vendu sous le coût)", () => {
    const m = margeLigne({
      quantite: 1,
      prix_unitaire_ht: 90,
      prix_achat_ttc_unitaire: 120,
    });
    expect(m.margeEuros).toBe(-30);
    expect(m.margePct).toBeCloseTo(-33.33, 1);
  });
});

describe("totauxMarges", () => {
  const lignes = [
    { quantite: 2, prix_unitaire_ht: 50, prix_achat_ttc_unitaire: 30 }, // vente 100, coût 60
    { quantite: 1, prix_unitaire_ht: 200, prix_achat_ttc_unitaire: 110 }, // vente 200, coût 110
    { quantite: 4, prix_unitaire_ht: 25 }, // sans PA → exclue, comptée
    { type: "titre", quantite: 0, prix_unitaire_ht: 0 }, // titre → ignoré
  ];

  it("totaux sur les lignes couvertes + compteur de lignes sans PA", () => {
    expect(totauxMarges(lignes)).toEqual({
      venteCouverte: 300,
      coutTotal: 170,
      margeTotale: 130,
      tauxMargePct: 43.33,
      nbLignesSansPa: 1,
    });
  });

  it("aucune ligne couverte : totaux à zéro, taux null (pas de division par zéro)", () => {
    expect(totauxMarges([{ quantite: 1, prix_unitaire_ht: 100 }])).toEqual({
      venteCouverte: 0,
      coutTotal: 0,
      margeTotale: 0,
      tauxMargePct: null,
      nbLignesSansPa: 1,
    });
    expect(totauxMarges([]).tauxMargePct).toBeNull();
  });

  it("vente couverte nulle avec coût (tout offert) : taux null, marge négative", () => {
    const t = totauxMarges([
      { quantite: 1, prix_unitaire_ht: 0, prix_achat_ttc_unitaire: 40 },
    ]);
    expect(t.margeTotale).toBe(-40);
    expect(t.tauxMargePct).toBeNull();
  });
});
