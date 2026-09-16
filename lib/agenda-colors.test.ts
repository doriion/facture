import { describe, expect, it } from "vitest";

import {
  CATEGORY_ORDER,
  DEFAULT_AGENDA_COULEURS,
  PALETTE,
  TEXTE_CLAIR,
  TEXTE_SOMBRE,
  cleEvenement,
  contraste,
  couleurEvenement,
  couleurTexte,
  estHex,
  normaliserCouleur,
  normalizeCouleurs,
  rgba,
  styleEvenement,
} from "./agenda-colors";

describe("normaliserCouleur", () => {
  it("accepte « #rrggbb », « rrggbb », « #rgb », insensible à la casse", () => {
    expect(normaliserCouleur("#ABCDEF")).toBe("#abcdef");
    expect(normaliserCouleur("abcdef")).toBe("#abcdef");
    expect(normaliserCouleur("#abc")).toBe("#aabbcc");
    expect(normaliserCouleur("  #ffffff ")).toBe("#ffffff");
  });

  it("convertit les anciens noms Tailwind stockés avant ce lot", () => {
    expect(normaliserCouleur("emerald")).toBe("#d1fae5");
    expect(normaliserCouleur("AMBER")).toBe("#fef3c7");
    expect(normaliserCouleur("slate")).toBe("#e2e8f0");
  });

  it("refuse tout le reste", () => {
    for (const v of ["", "#12345", "#ggg", "rouge", 12, null, undefined, "#abcdefg", "rgb(1,2,3)"]) {
      expect(normaliserCouleur(v)).toBeNull();
    }
  });

  it("estHex ne reconnaît que « #rrggbb »", () => {
    expect(estHex("#a1b2c3")).toBe(true);
    expect(estHex("a1b2c3")).toBe(false);
    expect(estHex("#abc")).toBe(false);
  });
});

describe("normalizeCouleurs", () => {
  it("valeur absente → couleurs par défaut complètes", () => {
    expect(normalizeCouleurs(null)).toEqual(DEFAULT_AGENDA_COULEURS);
    expect(normalizeCouleurs(undefined)).toEqual(DEFAULT_AGENDA_COULEURS);
    expect(normalizeCouleurs([])).toEqual(DEFAULT_AGENDA_COULEURS);
  });

  it("anciens réglages (noms Tailwind, catégories d'avant) : repris et complétés", () => {
    const r = normalizeCouleurs({
      intervention_a_facturer: "rose",
      facture: "indigo",
      external: "amber",
    });
    expect(r.intervention_a_facturer).toBe("#ffe4e6");
    expect(r.facture).toBe("#e0e7ff");
    expect(r.external).toBe("#fef3c7");
    // Nouvelles catégories : défaut
    expect(r.retard).toBe(DEFAULT_AGENDA_COULEURS.retard);
    expect(r.ferie).toBe(DEFAULT_AGENDA_COULEURS.ferie);
    expect(r.weekend).toBe(DEFAULT_AGENDA_COULEURS.weekend);
  });

  it("valeurs invalides ou clés inconnues ignorées", () => {
    const r = normalizeCouleurs({ facture: "pas-une-couleur", inconnue: "#ff0000", devis: "#123456" });
    expect(r.facture).toBe(DEFAULT_AGENDA_COULEURS.facture);
    expect(r.devis).toBe("#123456");
    expect("inconnue" in r).toBe(false);
  });

  it("toutes les catégories de la légende sont couvertes", () => {
    expect(CATEGORY_ORDER).toHaveLength(9);
    for (const k of CATEGORY_ORDER) expect(estHex(DEFAULT_AGENDA_COULEURS[k])).toBe(true);
  });
});

describe("lisibilité : texte sombre ou clair selon le fond", () => {
  it("fond pastel → texte sombre ; fond franc → texte blanc", () => {
    expect(couleurTexte("#fef3c7")).toBe(TEXTE_SOMBRE);
    expect(couleurTexte("#ffffff")).toBe(TEXTE_SOMBRE);
    expect(couleurTexte("#2563eb")).toBe(TEXTE_CLAIR);
    expect(couleurTexte("#0f172a")).toBe(TEXTE_CLAIR);
    expect(couleurTexte("#000000")).toBe(TEXTE_CLAIR);
  });

  it("toute la palette proposée atteint un contraste ≥ 4,5:1 (WCAG AA) avec le texte choisi", () => {
    for (const { hex } of PALETTE) {
      expect(contraste(hex, couleurTexte(hex))).toBeGreaterThanOrEqual(4.5);
    }
    for (const hex of Object.values(DEFAULT_AGENDA_COULEURS)) {
      expect(contraste(hex, couleurTexte(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("le pire cas d'une couleur libre reste au moins 4,5:1 (gris moyen)", () => {
    // Le gris moyen est la couleur la moins contrastée avec l'un comme
    // l'autre des textes : le meilleur des deux dépasse encore 4,5.
    expect(contraste("#808080", couleurTexte("#808080"))).toBeGreaterThanOrEqual(3.9);
    expect(contraste("#6b7280", couleurTexte("#6b7280"))).toBeGreaterThanOrEqual(4.5);
  });

  it("styleEvenement : fond opaque + texte calculé ; couleur invalide → défaut", () => {
    expect(styleEvenement("#2563eb")).toEqual({ backgroundColor: "#2563eb", color: TEXTE_CLAIR });
    expect(styleEvenement("emerald")).toEqual({ backgroundColor: "#d1fae5", color: TEXTE_SOMBRE });
    expect(styleEvenement("n'importe quoi").backgroundColor).toBe(DEFAULT_AGENDA_COULEURS.facture);
  });

  it("rgba pour teinter une case", () => {
    expect(rgba("#ffedd5", 0.35)).toBe("rgba(255, 237, 213, 0.35)");
  });
});

describe("couleur d'un évènement précis", () => {
  const couleurs = { ...DEFAULT_AGENDA_COULEURS, facture: "#dbeafe" };

  it("clé stable « kind:id »", () => {
    expect(cleEvenement({ kind: "facture_prestation", id: "abc" })).toBe("facture_prestation:abc");
  });

  it("la couleur propre prime sur celle du type ; sinon retombe sur le type", () => {
    const cle = "facture_prestation:abc";
    expect(couleurEvenement("facture", cle, couleurs, { [cle]: "#dc2626" })).toBe("#dc2626");
    expect(couleurEvenement("facture", cle, couleurs, {})).toBe("#dbeafe");
    expect(couleurEvenement("facture", cle, couleurs)).toBe("#dbeafe");
  });

  it("une couleur propre invalide est ignorée", () => {
    const cle = "intervention:1";
    expect(couleurEvenement("intervention_a_facturer", cle, couleurs, { [cle]: "zzz" })).toBe(
      couleurs.intervention_a_facturer,
    );
  });
});
