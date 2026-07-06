import { describe, expect, it } from "vitest";

import {
  ANNEE_SEUILS,
  PLAFOND_MICRO_SERVICES,
  SEUIL_FRANCHISE_TVA,
  SEUIL_FRANCHISE_TVA_MAJORE,
  niveauAlerte,
  pourcentageSeuil,
} from "./seuils-micro";

describe("constantes seuils micro 2026", () => {
  it("expose les montants vérifiés pour 2026", () => {
    expect(ANNEE_SEUILS).toBe(2026);
    expect(SEUIL_FRANCHISE_TVA).toBe(37_500);
    expect(SEUIL_FRANCHISE_TVA_MAJORE).toBe(41_250);
    expect(PLAFOND_MICRO_SERVICES).toBe(83_600);
  });

  it("garde une hiérarchie cohérente entre les seuils", () => {
    expect(SEUIL_FRANCHISE_TVA).toBeLessThan(SEUIL_FRANCHISE_TVA_MAJORE);
    expect(SEUIL_FRANCHISE_TVA_MAJORE).toBeLessThan(PLAFOND_MICRO_SERVICES);
  });
});

describe("pourcentageSeuil", () => {
  it("calcule le pourcentage arrondi", () => {
    expect(pourcentageSeuil(18_750, 37_500)).toBe(50);
    expect(pourcentageSeuil(30_000, 37_500)).toBe(80);
    expect(pourcentageSeuil(37_500, 37_500)).toBe(100);
    expect(pourcentageSeuil(45_000, 37_500)).toBe(120);
  });

  it("gère zéro et arrondit au plus proche", () => {
    expect(pourcentageSeuil(0, 37_500)).toBe(0);
    expect(pourcentageSeuil(124, 1_000)).toBe(12); // 12,4 → 12
    expect(pourcentageSeuil(125, 1_000)).toBe(13); // 12,5 → 13
  });

  it("renvoie 0 si le seuil est mal configuré (0 ou négatif)", () => {
    expect(pourcentageSeuil(10_000, 0)).toBe(0);
    expect(pourcentageSeuil(10_000, -5)).toBe(0);
  });
});

describe("niveauAlerte", () => {
  it("vert en dessous de 80 %", () => {
    expect(niveauAlerte(0)).toBe("ok");
    expect(niveauAlerte(79)).toBe("ok");
  });

  it("alerte à partir de 80 % (inclus)", () => {
    expect(niveauAlerte(80)).toBe("warn");
    expect(niveauAlerte(89)).toBe("warn");
  });

  it("vigilance forte à partir de 90 %", () => {
    expect(niveauAlerte(90)).toBe("danger");
    expect(niveauAlerte(99)).toBe("danger");
  });

  it("critique à partir de 100 %", () => {
    expect(niveauAlerte(100)).toBe("critical");
    expect(niveauAlerte(150)).toBe("critical");
  });
});
