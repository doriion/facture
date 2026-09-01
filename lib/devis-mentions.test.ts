import { describe, expect, it } from "vitest";

import { mentionAcompte } from "./devis-mentions";

describe("mentionAcompte", () => {
  it("pourcentage : calcule le montant sur le total et l'affiche", () => {
    expect(mentionAcompte(4500, 30, null)).toBe(
      "Acompte à la commande : 30 % (1 350,00 €), solde à réception de facture.",
    );
  });

  it("pourcentage non entier : virgule française, arrondi au centime", () => {
    expect(mentionAcompte(1000, 33.5, null)).toBe(
      "Acompte à la commande : 33,5 % (335,00 €), solde à réception de facture.",
    );
    // 1/3 de 100 € → arrondi
    expect(mentionAcompte(100, 33.33, null)).toContain("(33,33 €)");
  });

  it("montant fixe sans pourcentage", () => {
    expect(mentionAcompte(4500, null, 500)).toBe(
      "Acompte à la commande : 500,00 €, solde à réception de facture.",
    );
  });

  it("le pourcentage PRIME sur le montant si les deux sont renseignés", () => {
    expect(mentionAcompte(1000, 30, 999)).toContain("30 % (300,00 €)");
  });

  it("null sans acompte (ou valeurs nulles/zéro)", () => {
    expect(mentionAcompte(4500, null, null)).toBeNull();
    expect(mentionAcompte(4500, 0, 0)).toBeNull();
    expect(mentionAcompte(4500, undefined, undefined)).toBeNull();
  });
});
