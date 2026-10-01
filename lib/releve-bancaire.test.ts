import { describe, expect, it } from "vitest";

import {
  decouperLigne,
  lireDate,
  lireMontant,
  lireReleveCsv,
  rapprocher,
  scoreRapprochement,
  type FactureARapprocher,
  type OperationBancaire,
} from "./releve-bancaire";

describe("lecture des champs", () => {
  it("montants français et anglais", () => {
    expect(lireMontant("1 234,56")).toBe(1234.56);
    expect(lireMontant("+1 234,56 €")).toBe(1234.56);
    expect(lireMontant("-12,30")).toBe(-12.3);
    expect(lireMontant("1234.56")).toBe(1234.56);
    expect(lireMontant("1.234,56")).toBe(1234.56);
    expect(lireMontant("(12,00)")).toBe(-12);
    expect(Number.isNaN(lireMontant("abc"))).toBe(true);
    expect(Number.isNaN(lireMontant(""))).toBe(true);
  });

  it("dates", () => {
    expect(lireDate("30/09/2026")).toBe("2026-09-30");
    expect(lireDate("2026-09-30")).toBe("2026-09-30");
    expect(lireDate("30-09-26")).toBe("2026-09-30");
    expect(lireDate("1/2/2026")).toBe("2026-02-01");
    expect(lireDate("32/13/2026")).toBeNull();
    expect(lireDate("hier")).toBeNull();
  });

  it("guillemets et séparateur dans un champ", () => {
    expect(decouperLigne('"VIR SEPA; DUPONT";"1 200,00"', ";")).toEqual(["VIR SEPA; DUPONT", "1 200,00"]);
    expect(decouperLigne('a,"b ""c""",d', ",")).toEqual(["a", 'b "c"', "d"]);
  });
});

describe("lireReleveCsv", () => {
  it("Crédit Agricole : point-virgule, Débit/Crédit, dates FR, préambule", () => {
    const csv = [
      "Relevé du compte 12345",
      "",
      "Date;Libellé;Débit euros;Crédit euros;",
      "30/09/2026;VIR SEPA M DUPONT JEAN FACTURE F-2026-0012;;1 200,00;",
      "29/09/2026;PRLV EDF;89,10;;",
      "28/09/2026;CARTE 27/09 LEROY MERLIN;45,90;;",
    ].join("\r\n");
    const r = lireReleveCsv(csv);
    expect(r.erreur).toBeNull();
    expect(r.operations).toEqual([
      { ligne: 4, date: "2026-09-30", libelle: "VIR SEPA M DUPONT JEAN FACTURE F-2026-0012", montant: 1200 },
    ]);
    expect(r.nbIgnorees).toBe(2);
  });

  it("Qonto / néobanque : virgule, montant signé, BOM, guillemets", () => {
    const csv =
      "\uFEFF" +
      'Date,Label,Amount,Reference\n' +
      '2026-09-30,"Virement de DURAND, Marie",350.00,F-2026-0010\n' +
      "2026-09-29,Achat matériel,-120.00,\n";
    const r = lireReleveCsv(csv);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0]).toMatchObject({ date: "2026-09-30", montant: 350, libelle: "Virement de DURAND, Marie F-2026-0010" });
  });

  it("colonnes inconnues → erreur explicite", () => {
    expect(lireReleveCsv("a;b;c\n1;2;3").erreur).toMatch(/Colonnes non reconnues/);
    expect(lireReleveCsv("").erreur).toMatch(/vide/);
  });
});

const facture = (over: Partial<FactureARapprocher> = {}): FactureARapprocher => ({
  id: "f1",
  numero: "F-2026-0012",
  client_nom: "Dupont Jean",
  date_emission: "2026-09-15",
  reste_du: 1200,
  paiements: [],
  ...over,
});
const op = (over: Partial<OperationBancaire> = {}): OperationBancaire => ({
  ligne: 2,
  date: "2026-09-30",
  libelle: "VIR SEPA M DUPONT JEAN FACTURE F-2026-0012",
  montant: 1200,
  ...over,
});

describe("scoreRapprochement", () => {
  it("numéro + montant + nom : quasi certain", () => {
    const { score, raisons } = scoreRapprochement(op(), facture());
    expect(score).toBeGreaterThanOrEqual(10);
    expect(raisons).toContain("numéro de facture dans le libellé");
    expect(raisons).toContain("montant égal au reste dû");
    expect(raisons).toContain("nom du client dans le libellé");
  });

  it("le numéro seul (sans tirets, ou juste 12) suffit", () => {
    expect(scoreRapprochement(op({ libelle: "VIR FA20260012", montant: 100 }), facture()).score).toBeGreaterThanOrEqual(3);
    expect(scoreRapprochement(op({ libelle: "VIR FACT 12", montant: 100 }), facture()).score).toBeGreaterThanOrEqual(3);
  });

  it("montant seul : pas suffisant ; montant + nom : oui ; montant supérieur : pénalisé", () => {
    expect(scoreRapprochement(op({ libelle: "VIR SEPA" }), facture()).score).toBeLessThan(3);
    expect(scoreRapprochement(op({ libelle: "VIR DUPONT" }), facture()).score).toBeGreaterThanOrEqual(3);
    expect(scoreRapprochement(op({ libelle: "VIR DUPONT", montant: 5000 }), facture()).score).toBeLessThan(3);
  });

  it("virement antérieur à la facture : pénalisé", () => {
    const avant = scoreRapprochement(op({ date: "2026-09-01" }), facture()).score;
    const apres = scoreRapprochement(op(), facture()).score;
    expect(avant).toBe(apres - 2);
  });
});

describe("rapprocher", () => {
  it("attribue la meilleure facture, une seule fois, et signale un doublon", () => {
    const factures = [
      facture(),
      facture({ id: "f2", numero: "F-2026-0013", client_nom: "Martin", reste_du: 1200, paiements: [{ date_paiement: "2026-09-29", montant: 1200 }] }),
    ];
    const r = rapprocher(
      [op(), op({ ligne: 3, libelle: "VIR MARTIN", montant: 1200 }), op({ ligne: 4, libelle: "VIR INCONNU", montant: 77 })],
      factures,
    );
    expect(r[0]!.facture?.id).toBe("f1");
    expect(r[0]!.dejaEnregistre).toBe(false);
    expect(r[1]!.facture?.id).toBe("f2");
    expect(r[1]!.dejaEnregistre).toBe(true);
    expect(r[2]!.facture).toBeNull();
  });
});
