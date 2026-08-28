import { describe, expect, it } from "vitest";

import { ecartDeclaration } from "@/lib/fiscal";
import {
  buildCsv,
  getExportPeriodes,
  summarizeEncaissements,
  totalFacturesEmises,
  type ExportSummary,
  type PaiementExportInput,
} from "./urssaf-helpers";

function paiement(
  overrides: Omit<Partial<PaiementExportInput>, "facture"> & {
    facture?: Partial<NonNullable<PaiementExportInput["facture"]>> | null;
  } = {},
): PaiementExportInput {
  const { facture, ...rest } = overrides;
  return {
    date_paiement: "2026-05-10",
    montant: 100,
    mode: "virement",
    reference: null,
    ...rest,
    facture:
      facture === null
        ? null
        : {
            id: "f1",
            numero: "FA-2026-0001",
            date_emission: "2026-05-01",
            total_ht: 100,
            type_activite: "prestation",
            statut: "payee",
            client: { nom: "Dupont" },
            ...facture,
          },
  };
}

describe("summarizeEncaissements", () => {
  it("somme les ENCAISSEMENTS (pas les montants de factures)", () => {
    const res = summarizeEncaissements([
      paiement({ montant: 150.5, facture: { id: "f1", total_ht: 1000 } }),
      paiement({ montant: 49.5, facture: { id: "f2", total_ht: 2000 } }),
    ]);
    expect(res.total_encaisse).toBe(200);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]!.montant_encaisse).toBe(150.5);
  });

  it("compte les factures distinctes, pas les paiements (acomptes)", () => {
    const res = summarizeEncaissements([
      paiement({ montant: 300, facture: { id: "f1" } }),
      paiement({ montant: 700, facture: { id: "f1" } }),
    ]);
    expect(res.nb_factures).toBe(1);
    expect(res.rows).toHaveLength(2);
    expect(res.total_encaisse).toBe(1000);
  });

  it("exclut les factures annulées et les paiements orphelins", () => {
    const res = summarizeEncaissements([
      paiement({ montant: 100 }),
      paiement({ montant: 50, facture: { id: "f2", statut: "annulee" } }),
      paiement({ montant: 25, facture: null }),
    ]);
    expect(res.total_encaisse).toBe(100);
    expect(res.rows).toHaveLength(1);
    expect(res.nb_factures).toBe(1);
  });

  it("arrondit le total à 2 décimales (flottants)", () => {
    const res = summarizeEncaissements([
      paiement({ montant: 0.1, facture: { id: "f1" } }),
      paiement({ montant: 0.2, facture: { id: "f2" } }),
    ]);
    expect(res.total_encaisse).toBe(0.3);
  });

  it("affiche un libellé de repli si le client a été supprimé", () => {
    const res = summarizeEncaissements([paiement({ facture: { client: null } })]);
    expect(res.rows[0]!.client).toBe("(client supprimé)");
  });

  it("renvoie un résumé vide sans paiements", () => {
    const res = summarizeEncaissements([]);
    expect(res).toEqual({
      rows: [],
      total_encaisse: 0,
      ventilation: { bic_prestations: 0, bic_ventes: 0, bnc: 0 },
      nb_factures: 0,
    });
  });

  it("ventile chaque encaissement dans les 3 cases URSSAF au prorata des lignes", () => {
    const res = summarizeEncaissements([
      // Facture mixte 1000 € (800 presta + 200 vente), acompte de 500 €
      paiement({
        montant: 500,
        facture: {
          id: "f1",
          total_ht: 1000,
          lignes: [
            { total_ht: 800, nature_fiscale: "bic_prestations" },
            { total_ht: 200, nature_fiscale: "bic_ventes" },
          ],
        },
      }),
      // Facture sans lignes chargées (rétrocompat) : tout en prestations
      paiement({ montant: 100, facture: { id: "f2" } }),
    ]);
    expect(res.rows[0]!.ventilation).toEqual({
      bic_prestations: 400,
      bic_ventes: 100,
      bnc: 0,
    });
    expect(res.ventilation).toEqual({
      bic_prestations: 500,
      bic_ventes: 100,
      bnc: 0,
    });
    expect(res.total_encaisse).toBe(600);
  });
});

describe("bout en bout : facture mixte encaissée sur deux trimestres", () => {
  // Facture 1000 € HT : 800 € de prestation (pose) + 200 € de vente
  // seule. Acompte de 300 € encaissé en T2, solde de 700 € en T3.
  const lignes = [
    { total_ht: 800, nature_fiscale: "bic_prestations" },
    { total_ht: 200, nature_fiscale: "bic_ventes" },
  ];
  const facture = { id: "f-mixte", total_ht: 1000, lignes };
  const acompteT2 = paiement({
    montant: 300,
    date_paiement: "2026-05-10",
    facture,
  });
  const soldeT3 = paiement({
    montant: 700,
    date_paiement: "2026-07-20",
    facture,
  });

  it("chaque trimestre reçoit sa part au prorata des natures", () => {
    // T2 ne voit que l'acompte
    const t2 = summarizeEncaissements([acompteT2]);
    expect(t2.total_encaisse).toBe(300);
    expect(t2.ventilation).toEqual({
      bic_prestations: 240, // 300 × 800/1000
      bic_ventes: 60, // 300 × 200/1000
      bnc: 0,
    });

    // T3 ne voit que le solde
    const t3 = summarizeEncaissements([soldeT3]);
    expect(t3.total_encaisse).toBe(700);
    expect(t3.ventilation).toEqual({
      bic_prestations: 560,
      bic_ventes: 140,
      bnc: 0,
    });
  });

  it("la somme des deux trimestres reconstitue exactement la facture", () => {
    const t2 = summarizeEncaissements([acompteT2]);
    const t3 = summarizeEncaissements([soldeT3]);
    expect(
      t2.ventilation.bic_prestations + t3.ventilation.bic_prestations,
    ).toBe(800);
    expect(t2.ventilation.bic_ventes + t3.ventilation.bic_ventes).toBe(200);
    expect(t2.total_encaisse + t3.total_encaisse).toBe(1000);
  });

  it("un paiement ajouté APRÈS déclaration du trimestre produit un écart détecté", () => {
    // Le trimestre est déclaré sur la base de l'acompte seul…
    const declare = summarizeEncaissements([acompteT2]).total_encaisse;
    // …puis un règlement complémentaire de 50 € est saisi sur T2
    const complement = paiement({
      montant: 50,
      date_paiement: "2026-06-28",
      facture,
    });
    const apres = summarizeEncaissements([acompteT2, complement]);
    // ecartDeclaration est ce que la carte Déclaration affiche en
    // alerte ambre (« Écart de X € en plus depuis la déclaration »)
    expect(ecartDeclaration(declare, apres.total_encaisse)).toBe(50);
    // Et un paiement SUPPRIMÉ après coup donne un écart négatif
    expect(ecartDeclaration(declare, 0)).toBe(-300);
  });
});

describe("totalFacturesEmises", () => {
  it("somme les total_ht avec arrondi", () => {
    expect(totalFacturesEmises([{ total_ht: 0.1 }, { total_ht: 0.2 }])).toBe(0.3);
    expect(totalFacturesEmises([])).toBe(0);
  });
});

describe("getExportPeriodes", () => {
  const periodes = getExportPeriodes(new Date("2026-07-06T12:00:00"));

  it("propose année en cours + 4 trimestres + année N-1 + 4 trimestres N-1", () => {
    expect(periodes).toHaveLength(10);
    expect(periodes.map((p) => p.label)).toEqual([
      "Année 2026",
      "T1 2026",
      "T2 2026",
      "T3 2026",
      "T4 2026",
      "Année 2025",
      "T1 2025",
      "T2 2025",
      "T3 2025",
      "T4 2025",
    ]);
  });

  it("borne les périodes en [start inclusif, end exclusif]", () => {
    const annee = periodes.find((p) => p.label === "Année 2026")!;
    expect(annee.start).toBe("2026-01-01");
    expect(annee.end).toBe("2027-01-01");

    const t2 = periodes.find((p) => p.label === "T2 2026")!;
    expect(t2.start).toBe("2026-04-01");
    expect(t2.end).toBe("2026-07-01");
  });

  it("fait déborder T4 sur l'année suivante", () => {
    const t4 = periodes.find((p) => p.label === "T4 2025")!;
    expect(t4.start).toBe("2025-10-01");
    expect(t4.end).toBe("2026-01-01");
  });
});

describe("buildCsv", () => {
  const summary: ExportSummary = {
    periode: { label: "T2 2026", start: "2026-04-01", end: "2026-07-01" },
    total_encaisse: 1234.5,
    ventilation: { bic_prestations: 1200, bic_ventes: 34.5, bnc: 0 },
    total_facture_emis: 2000,
    nb_factures: 1,
    rows: [
      {
        numero_facture: "FA-2026-0001",
        date_facture: "2026-05-01",
        client: "Syndic; Les \"Oliviers\"",
        type_activite: "prestation",
        total_facture: 1500,
        date_encaissement: "2026-05-10",
        mode_paiement: "virement",
        reference_paiement: null,
        montant_encaisse: 1234.5,
        ventilation: { bic_prestations: 1200, bic_ventes: 34.5, bnc: 0 },
      },
    ],
  };
  const csv = buildCsv(summary);
  const lines = csv.split("\r\n");

  it("commence par un BOM UTF-8 (Excel FR)", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("utilise le séparateur ; et l'en-tête attendu", () => {
    expect(lines[0]!.replace("﻿", "")).toBe(
      "N° Facture;Date facture;Client;Activité;Total facture (€);Date encaissement;Mode;Référence paiement;Montant encaissé (€)",
    );
  });

  it("échappe les champs contenant ; ou guillemets", () => {
    expect(lines[1]).toContain('"Syndic; Les ""Oliviers"""');
  });

  it("formate les montants à la française (virgule décimale)", () => {
    expect(lines[1]).toContain("1500,00");
    expect(lines[1]).toContain("1234,50");
  });

  it("termine par le total et la ventilation 3 cases", () => {
    expect(csv).toContain("TOTAL ENCAISSÉ;1234,50");
    expect(csv).toContain("dont BIC prestations de services;1200,00");
    expect(csv).toContain("dont BIC ventes de marchandises;34,50");
    expect(csv).toContain("dont BNC;0,00");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
