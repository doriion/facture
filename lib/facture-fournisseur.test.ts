import { describe, expect, it } from "vitest";

import { lireMontant, parserFactureFournisseur, quantiteEtDesignation, scoreCorrespondance } from "./facture-fournisseur";

describe("montants et quantités", () => {
  it("lit les montants français et anglais", () => {
    expect(lireMontant("1 234,56")).toBe(1234.56);
    expect(lireMontant("861.22")).toBe(861.22);
    expect(lireMontant("12,5")).toBe(12.5);
  });
  it("quantité en tête ou en fin", () => {
    expect(quantiteEtDesignation("2 x Liaison frigo 1/4 3/8")).toEqual({ quantite: 2, designation: "Liaison frigo 1/4 3/8" });
    expect(quantiteEtDesignation("Goulotte 80x60 x3")).toEqual({ quantite: 3, designation: "Goulotte 80x60" });
    expect(quantiteEtDesignation("Tube cuivre 3/8 10 m")).toEqual({ quantite: 10, designation: "Tube cuivre 3/8" });
    expect(quantiteEtDesignation("Support sol clim")).toEqual({ quantite: 1, designation: "Support sol clim" });
  });
});

describe("facture fournisseur", () => {
  it("lignes chiffrées, total TTC, fournisseur et date", () => {
    const texte = `REXEL GRENOBLE
Facture n° 45821 du 28/10/2026
UE DAIKIN RXM35R 1 861,22 861,22
2 x Liaison frigo 1/4 3/8 isolé 65,00 130,00
Support sol clim + silent bloc 20,00
Câble 3G2.5 50 m 50,00
Sous-total HT 884,35
TVA 20 % 176,87
TOTAL TTC 1 061,22
Règlement CB 1 061,22`;
    const r = parserFactureFournisseur(texte);
    expect(r.fournisseur).toBe("REXEL GRENOBLE");
    expect(r.date).toBe("2026-10-28");
    expect(r.totalTtc).toBe(1061.22);
    expect(r.lignes.map((l) => [l.designation, l.quantite, l.prixUnitaire, l.montant])).toEqual([
      ["UE DAIKIN RXM35R", 1, 861.22, 861.22],
      ["Liaison frigo 1/4 3/8 isolé", 2, 65, 130],
      ["Support sol clim + silent bloc", 1, 20, 20],
      ["Câble 3G2.5", 50, 1, 50],
    ]);
  });
  it("score de correspondance par mots communs", () => {
    expect(scoreCorrespondance("Liaison frigo 1/4 3/8 isolé", "liaison frigo 1/4 3/8 isolé")).toBe(1);
    expect(scoreCorrespondance("UE DAIKIN RXM35R", "RAS-16E2AVG-E UNITE EXTERIEURE")).toBe(0);
    expect(scoreCorrespondance("Support sol clim + silent bloc", "support sol clim")).toBe(1);
  });
});
