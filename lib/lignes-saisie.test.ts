import { describe, expect, it } from "vitest";

import {
  QUANTITE_DEFAUT,
  champVide,
  prixEffectif,
  prixSaisi,
  quantiteEffective,
  quantiteSaisie,
} from "./lignes-saisie";
import { chercherPrestations } from "./catalogue-recherche";
import { computeLigneTotalHt, computeTotalHt, ligneFactureSchema } from "./validations/facture";

describe("champVide", () => {
  it("vide pour '', null, undefined — pas pour 0 ni '0'", () => {
    expect(champVide("")).toBe(true);
    expect(champVide(null)).toBe(true);
    expect(champVide(undefined)).toBe(true);
    expect(champVide(0)).toBe(false);
    expect(champVide("0")).toBe(false);
    expect(champVide(" ")).toBe(false);
  });
});

describe("quantiteSaisie / prixSaisi (prétraitement du schéma)", () => {
  it("quantité vide → 1, prix vide → 0", () => {
    expect(quantiteSaisie("")).toBe(QUANTITE_DEFAUT);
    expect(quantiteSaisie(undefined)).toBe(1);
    expect(prixSaisi("")).toBe(0);
    expect(prixSaisi(null)).toBe(0);
  });

  it("saisie FR/EN tolérée, comme avant", () => {
    expect(quantiteSaisie("2,5")).toBe(2.5);
    expect(quantiteSaisie("1 000")).toBe(1000);
    expect(prixSaisi("1 234,50 €")).toBe(1234.5);
    expect(prixSaisi(80)).toBe(80);
  });

  it("une saisie non numérique reste NaN (le schéma la refuse)", () => {
    expect(Number.isNaN(quantiteSaisie("abc"))).toBe(true);
    expect(Number.isNaN(prixSaisi("x"))).toBe(true);
  });
});

describe("quantiteEffective / prixEffectif (totaux en direct)", () => {
  it("vide → 1 et 0, invalide → 0, jamais NaN", () => {
    expect(quantiteEffective("")).toBe(1);
    expect(quantiteEffective("abc")).toBe(0);
    expect(quantiteEffective("3")).toBe(3);
    expect(prixEffectif("")).toBe(0);
    expect(prixEffectif("abc")).toBe(0);
    expect(prixEffectif("12,5")).toBe(12.5);
  });
});

describe("ligneFactureSchema : désignation multi-lignes", () => {
  it("conserve les retours à la ligne TELS QUELS (seuls les bords sont rognés)", () => {
    const designation =
      "Multisplit Daikin 3MXM52A — groupe extérieur\n" +
      "• FTXM25R — séjour\n" +
      "• FTXM20R — chambre";
    const r = ligneFactureSchema.safeParse({
      designation: `  ${designation}\n`,
      quantite: "1",
      prix_unitaire_ht: "3250",
      prix_achat_ttc_unitaire: "",
      fournisseur: "",
      nature_fiscale: "bic_prestations",
      type: "ligne",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.designation).toBe(designation);
      expect(r.data.designation.split("\n")).toHaveLength(3);
    }
  });

  it("l'auto-complétion du catalogue continue de chercher sur un texte multi-lignes", () => {
    const catalogue = [
      { id: "p1", designation: "Pose monosplit mural", description: null, prix_ht: 850, unite: "unité", categorie: "installation", nature_fiscale: "bic_prestations", actif: true },
      { id: "p2", designation: "Entretien PAC", description: null, prix_ht: 120, unite: "unité", categorie: "entretien", nature_fiscale: "bic_prestations", actif: true },
    ];
    // Le retour à la ligne est traité comme un simple séparateur de mots.
    const trouve = chercherPrestations(catalogue, "pose\nmono");
    expect(trouve.map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("ligneFactureSchema : champs vides au départ", () => {
  const base = {
    designation: "Pose monosplit",
    prix_achat_ttc_unitaire: "",
    fournisseur: "",
    nature_fiscale: "bic_prestations",
    type: "ligne",
  };

  it("quantité laissée vide → 1 à l'enregistrement (le calcul ne change pas)", () => {
    const r = ligneFactureSchema.safeParse({
      ...base,
      quantite: "",
      prix_unitaire_ht: "850",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.quantite).toBe(1);
      expect(r.data.prix_unitaire_ht).toBe(850);
      expect(computeTotalHt([r.data])).toBe(850);
    }
  });

  it("prix laissé vide → 0 (ligne offerte), quantité saisie conservée", () => {
    const r = ligneFactureSchema.safeParse({
      ...base,
      quantite: "3",
      prix_unitaire_ht: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.quantite).toBe(3);
      expect(r.data.prix_unitaire_ht).toBe(0);
    }
  });

  it("une quantité saisie n'est jamais remplacée par le défaut", () => {
    const r = ligneFactureSchema.safeParse({
      ...base,
      quantite: "2,5",
      prix_unitaire_ht: "100",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantite).toBe(2.5);
  });

  it("quantité 0 ou négative toujours refusée, texte invalide aussi", () => {
    expect(
      ligneFactureSchema.safeParse({ ...base, quantite: "0", prix_unitaire_ht: "10" })
        .success,
    ).toBe(false);
    expect(
      ligneFactureSchema.safeParse({ ...base, quantite: "-1", prix_unitaire_ht: "10" })
        .success,
    ).toBe(false);
    const r = ligneFactureSchema.safeParse({
      ...base,
      quantite: "abc",
      prix_unitaire_ht: "10",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Quantité invalide.");
    }
  });
});

describe("computeTotalHt — arrondi ligne par ligne", () => {
  it("le total est la somme des totaux de ligne imprimés (pas des produits bruts)", () => {
    // 3 lignes à 0,125 € : brut 0,375 → 0,38 ; imprimé 3 × 0,13 = 0,39.
    const lignes = [1, 2, 3].map(() => ({ quantite: 1, prix_unitaire_ht: 0.125 }));
    expect(computeLigneTotalHt(lignes[0]!)).toBe(0.13);
    expect(computeTotalHt(lignes)).toBe(0.39);
  });

  it("une ligne « titre » ne compte jamais dans le total", () => {
    expect(
      computeTotalHt([
        { quantite: 1, prix_unitaire_ht: 500, type: "titre" },
        { quantite: 2, prix_unitaire_ht: 10, type: "ligne" },
      ]),
    ).toBe(20);
  });

  it("inchangé sur des montants ordinaires", () => {
    expect(computeTotalHt([{ quantite: 2, prix_unitaire_ht: 45.5 }, { quantite: 1.5, prix_unitaire_ht: 60 }])).toBe(181);
  });
});
