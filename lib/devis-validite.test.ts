import { describe, expect, it } from "vitest";

import {
  dateValiditeDevis,
  dureeValiditeSure,
  DUREE_VALIDITE_DEVIS_DEFAUT,
} from "./devis-validite";

describe("dureeValiditeSure", () => {
  it("accepte 1-365, arrondit les décimales", () => {
    expect(dureeValiditeSure(30)).toBe(30);
    expect(dureeValiditeSure(1)).toBe(1);
    expect(dureeValiditeSure(365)).toBe(365);
    expect(dureeValiditeSure(45.6)).toBe(46);
  });

  it("valeurs invalides → défaut 30 (0, négatif, > 365, null, NaN)", () => {
    for (const v of [0, -5, 366, null, undefined, "abc", NaN]) {
      expect(dureeValiditeSure(v)).toBe(DUREE_VALIDITE_DEVIS_DEFAUT);
    }
  });
});

describe("dateValiditeDevis", () => {
  it("défaut 30 jours", () => {
    expect(dateValiditeDevis("2026-09-10", 30)).toBe("2026-10-10");
  });

  it("passage de mois et d'année", () => {
    expect(dateValiditeDevis("2026-12-15", 30)).toBe("2027-01-14");
    expect(dateValiditeDevis("2026-01-31", 30)).toBe("2026-03-02");
  });

  it("année bissextile", () => {
    expect(dateValiditeDevis("2028-01-30", 30)).toBe("2028-02-29");
  });

  it("durée invalide → 30 jours ; date invalide → renvoyée telle quelle", () => {
    expect(dateValiditeDevis("2026-09-10", 0)).toBe("2026-10-10");
    expect(dateValiditeDevis("n'importe quoi", 30)).toBe("n'importe quoi");
  });
});
