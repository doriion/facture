import { describe, expect, it } from "vitest";

import {
  additionnerVentilations,
  ecartDeclaration,
  totalVentilation,
  ventilerMontant,
  VENTILATION_VIDE,
} from "./fiscal";

describe("ventilerMontant", () => {
  it("met tout en bic_prestations pour une facture 100 % prestations", () => {
    const v = ventilerMontant(1000, [
      { total_ht: 600, nature_fiscale: "bic_prestations" },
      { total_ht: 400, nature_fiscale: "bic_prestations" },
    ]);
    expect(v).toEqual({ bic_prestations: 1000, bic_ventes: 0, bnc: 0 });
  });

  it("ventile un paiement partiel au prorata des natures (acompte 30 %)", () => {
    // Facture 1000 € : 800 presta + 200 vente ; acompte 300 €
    const v = ventilerMontant(300, [
      { total_ht: 800, nature_fiscale: "bic_prestations" },
      { total_ht: 200, nature_fiscale: "bic_ventes" },
    ]);
    expect(v.bic_prestations).toBe(240);
    expect(v.bic_ventes).toBe(60);
    expect(totalVentilation(v)).toBe(300);
  });

  it("le reliquat d'arrondi va à la nature majoritaire, somme exacte", () => {
    // 100 € sur 3 tiers → 33,33 + 33,33 + 33,33 = 99,99 → +0,01 au majoritaire
    const v = ventilerMontant(100, [
      { total_ht: 1, nature_fiscale: "bic_prestations" },
      { total_ht: 1, nature_fiscale: "bic_ventes" },
      { total_ht: 1.000001, nature_fiscale: "bnc" },
    ]);
    expect(totalVentilation(v)).toBe(100);
  });

  it("sans lignes (ou total nul) : défaut sûr bic_prestations", () => {
    expect(ventilerMontant(500, [])).toEqual({
      bic_prestations: 500,
      bic_ventes: 0,
      bnc: 0,
    });
    expect(
      ventilerMontant(500, [{ total_ht: 0, nature_fiscale: "bic_ventes" }]),
    ).toEqual({ bic_prestations: 500, bic_ventes: 0, bnc: 0 });
  });

  it("nature inconnue → traitée comme bic_prestations", () => {
    const v = ventilerMontant(100, [
      { total_ht: 100, nature_fiscale: "n_importe_quoi" },
    ]);
    expect(v.bic_prestations).toBe(100);
  });

  it("montant nul → ventilation vide", () => {
    expect(ventilerMontant(0, [])).toEqual(VENTILATION_VIDE);
  });
});

describe("additionnerVentilations / totalVentilation", () => {
  it("accumule au centime près", () => {
    const somme = additionnerVentilations(
      { bic_prestations: 0.1, bic_ventes: 0, bnc: 0 },
      { bic_prestations: 0.2, bic_ventes: 5, bnc: 0 },
    );
    expect(somme.bic_prestations).toBe(0.3);
    expect(totalVentilation(somme)).toBe(5.3);
  });
});

describe("ecartDeclaration", () => {
  it("détecte un écart après coup (facture modifiée)", () => {
    expect(ecartDeclaration(1000, 1150)).toBe(150);
    expect(ecartDeclaration(1000, 900)).toBe(-100);
  });

  it("tolère les poussières d'arrondi", () => {
    expect(ecartDeclaration(1000, 1000)).toBeNull();
    expect(ecartDeclaration(1000, 1000.01)).toBeNull();
  });
});
