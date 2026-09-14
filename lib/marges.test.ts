import { describe, expect, it } from "vitest";

import { margeLigne, margeReelle, totauxMarges } from "./marges";

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

describe("margeReelle : total HT − achats renseignés", () => {
  it("l'exemple de l'utilisateur : 4 196,50 − 2 264,23 = 1 932,27 € (46,04 %)", () => {
    // 1 932,27 / 4 196,50 = 0,46045… → 46,04 % (arrondi au centième,
    // pas au demi : une première version de ce test attendait 46,05).
    expect(margeReelle(4196.5, 2264.23)).toEqual({
      totalHt: 4196.5,
      coutRenseigne: 2264.23,
      margeEuros: 1932.27,
      margePct: 46.04,
    });
  });

  it("diffère de la marge matériel : la main-d'œuvre sans PA compte dans le total, pas dans le coût", () => {
    const lignes = [
      { quantite: 1, prix_unitaire_ht: 1000, prix_achat_ttc_unitaire: 700 }, // matériel
      { quantite: 4, prix_unitaire_ht: 50 }, // main-d'œuvre, sans PA
    ];
    const materiel = totauxMarges(lignes);
    const totalHt = 1000 + 200;
    const reelle = margeReelle(totalHt, materiel.coutTotal);

    // Marge matériel : sur la seule ligne couverte → 300 € (30 %)
    expect(materiel.margeTotale).toBe(300);
    expect(materiel.tauxMargePct).toBe(30);
    // Marge réelle : 1 200 − 700 = 500 € (41,67 %) — la main-d'œuvre
    // est de l'encaissé, rien n'est déduit pour elle.
    expect(reelle.margeEuros).toBe(500);
    expect(reelle.margePct).toBe(41.67);
  });

  it("n'invente AUCUN coût : sans aucun PA, marge réelle = total HT", () => {
    const materiel = totauxMarges([{ quantite: 2, prix_unitaire_ht: 150 }]);
    expect(materiel.coutTotal).toBe(0);
    expect(margeReelle(300, materiel.coutTotal)).toEqual({
      totalHt: 300,
      coutRenseigne: 0,
      margeEuros: 300,
      margePct: 100,
    });
  });

  it("partage strictement le coût d'achat de totauxMarges (même source)", () => {
    const lignes = [
      { quantite: 3, prix_unitaire_ht: 40, prix_achat_ttc_unitaire: 25.5 },
      { quantite: 1, prix_unitaire_ht: 80, prix_achat_ttc_unitaire: 61.2 },
    ];
    const materiel = totauxMarges(lignes);
    const reelle = margeReelle(200, materiel.coutTotal);
    expect(reelle.coutRenseigne).toBe(materiel.coutTotal);
  });

  it("total HT nul : marge en euros négative possible, % null (pas de division par zéro)", () => {
    expect(margeReelle(0, 40)).toEqual({
      totalHt: 0,
      coutRenseigne: 40,
      margeEuros: -40,
      margePct: null,
    });
  });

  it("marge négative quand les achats dépassent le total", () => {
    const r = margeReelle(500, 650);
    expect(r.margeEuros).toBe(-150);
    expect(r.margePct).toBe(-30);
  });

  it("tolère des entrées non numériques (formulaire) sans produire de NaN", () => {
    const r = margeReelle(Number("abc"), Number(""));
    expect(r.totalHt).toBe(0);
    expect(r.coutRenseigne).toBe(0);
    expect(r.margeEuros).toBe(0);
    expect(r.margePct).toBeNull();
  });
});
