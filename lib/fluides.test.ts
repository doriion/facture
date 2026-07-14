import { describe, expect, it } from "vitest";

import {
  PRG_FLUIDES,
  equivalentCo2Tonnes,
  formatEquivalentCo2,
  normalizeFluide,
  periodiciteControleMois,
  prgFluide,
} from "./fluides";

describe("normalizeFluide", () => {
  it("normalise casse, espaces et tirets", () => {
    expect(normalizeFluide("r410a")).toBe("R410A");
    expect(normalizeFluide("R-410A")).toBe("R410A");
    expect(normalizeFluide(" r 32 ")).toBe("R32");
    expect(normalizeFluide(null)).toBe("");
    expect(normalizeFluide(undefined)).toBe("");
  });
});

describe("prgFluide", () => {
  it("retrouve les PRG réglementaires (base AR4, règlement UE 2024/573)", () => {
    expect(prgFluide("R32")).toBe(675);
    expect(prgFluide("R410A")).toBe(2088);
    expect(prgFluide("R134a")).toBe(1430);
    expect(prgFluide("R404A")).toBe(3922);
    expect(prgFluide("R454B")).toBe(466);
    expect(prgFluide("R290")).toBe(3);
    expect(prgFluide("R744")).toBe(1);
    expect(prgFluide("R22")).toBe(1810);
  });

  it("tolère les variantes d'écriture", () => {
    expect(prgFluide("r-410a")).toBe(2088);
    expect(prgFluide("R 32")).toBe(675);
  });

  it("renvoie null pour un fluide inconnu ou vide", () => {
    expect(prgFluide("R9999")).toBeNull();
    expect(prgFluide("")).toBeNull();
    expect(prgFluide(null)).toBeNull();
  });

  it("n'a que des PRG positifs ou nuls dans la table", () => {
    for (const [nom, prg] of Object.entries(PRG_FLUIDES)) {
      expect(prg, nom).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("equivalentCo2Tonnes", () => {
  it("calcule t éq. CO2 = kg × PRG / 1000", () => {
    // 2 kg de R410A → 2 × 2088 / 1000 = 4,176 t
    expect(equivalentCo2Tonnes("R410A", 2)).toBe(4.176);
    // 1,5 kg de R32 → 1,5 × 675 / 1000 = 1,0125 → arrondi 1,013 t (kg près)
    expect(equivalentCo2Tonnes("R32", 1.5)).toBe(1.013);
    // 10 kg de R404A → 39,22 t (au-dessus du seuil 5 t → contrôle requis)
    expect(equivalentCo2Tonnes("R404A", 10)).toBe(39.22);
  });

  it("gère les fluides à PRG négligeable ou nul", () => {
    expect(equivalentCo2Tonnes("R290", 0.5)).toBe(0.002); // arrondi de 0,0015
    expect(equivalentCo2Tonnes("R717", 10)).toBe(0);
  });

  it("renvoie null si fluide inconnu ou masse absente", () => {
    expect(equivalentCo2Tonnes("R9999", 2)).toBeNull();
    expect(equivalentCo2Tonnes("R410A", null)).toBeNull();
    expect(equivalentCo2Tonnes("R410A", undefined)).toBeNull();
    expect(equivalentCo2Tonnes("R410A", Number.NaN)).toBeNull();
  });

  it("masse nulle → 0 t (pas null : le fluide est connu)", () => {
    expect(equivalentCo2Tonnes("R32", 0)).toBe(0);
  });
});

describe("formatEquivalentCo2", () => {
  it("formate en français avec l'unité réglementaire", () => {
    expect(formatEquivalentCo2(4.176)).toBe("4,18 t éq. CO2");
    expect(formatEquivalentCo2(0)).toBe("0,00 t éq. CO2");
    expect(formatEquivalentCo2(null)).toBe("—");
  });
});

describe("periodiciteControleMois", () => {
  it("suit les seuils du cadre 8 du CERFA 15497*04 (sans détection permanente)", () => {
    expect(periodiciteControleMois(1)).toBeNull(); // < 2 kg
    expect(periodiciteControleMois(2)).toBe(12);
    expect(periodiciteControleMois(29.9)).toBe(12);
    expect(periodiciteControleMois(30)).toBe(6);
    expect(periodiciteControleMois(299)).toBe(6);
    expect(periodiciteControleMois(300)).toBe(3);
    expect(periodiciteControleMois(null)).toBeNull();
  });
});
