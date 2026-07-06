import { describe, expect, it } from "vitest";

import {
  REGEX,
  formatDateFr,
  formatEuros,
  formatIban,
  formatSiret,
  parseMoneyInput,
  siretToSiren,
  stripSpaces,
} from "./format";

describe("formatEuros", () => {
  it("formate au format FR avec espace normal pour les milliers", () => {
    // L'espace doit être U+0020 (pas d'insécable) pour le rendu PDF
    expect(formatEuros(6000)).toBe("6 000,00 €");
    expect(formatEuros(1234567.89)).toBe("1 234 567,89 €");
  });

  it("gère les décimales et les négatifs", () => {
    expect(formatEuros(0)).toBe("0,00 €");
    expect(formatEuros(12.5)).toBe("12,50 €");
    expect(formatEuros(-42)).toBe("-42,00 €");
  });

  it("omet le symbole avec withSymbol: false", () => {
    expect(formatEuros(6000, { withSymbol: false })).toBe("6 000,00");
  });
});

describe("formatDateFr", () => {
  it("formate une date ISO en JJ/MM/AAAA", () => {
    expect(formatDateFr("2026-05-11")).toBe("11/05/2026");
    expect(formatDateFr(new Date(2026, 0, 3))).toBe("03/01/2026");
  });

  it("renvoie une chaîne vide si null/undefined", () => {
    expect(formatDateFr(null)).toBe("");
    expect(formatDateFr(undefined)).toBe("");
  });
});

describe("siretToSiren", () => {
  it("extrait les 9 premiers chiffres d'un SIRET valide", () => {
    expect(siretToSiren("12345678901234")).toBe("123456789");
    expect(siretToSiren("123 456 789 01234")).toBe("123456789");
  });

  it("renvoie null si non conforme", () => {
    expect(siretToSiren("123")).toBeNull();
    expect(siretToSiren("1234567890123A")).toBeNull();
    expect(siretToSiren(null)).toBeNull();
  });
});

describe("formatSiret", () => {
  it("groupe en 3+3+3+5", () => {
    expect(formatSiret("12345678901234")).toBe("123 456 789 01234");
  });

  it("laisse tel quel si longueur inattendue", () => {
    expect(formatSiret("123")).toBe("123");
    expect(formatSiret(null)).toBe("");
  });
});

describe("formatIban", () => {
  it("groupe par 4 caractères en majuscules", () => {
    expect(formatIban("fr7630001007941234567890185")).toBe(
      "FR76 3000 1007 9412 3456 7890 185",
    );
  });

  it("renvoie vide si null", () => {
    expect(formatIban(null)).toBe("");
  });
});

describe("stripSpaces", () => {
  it("supprime tous les espaces", () => {
    expect(stripSpaces(" a b\tc ")).toBe("abc");
  });
});

describe("parseMoneyInput", () => {
  it("accepte virgule OU point comme séparateur décimal", () => {
    expect(parseMoneyInput("1500,50")).toBe(1500.5);
    expect(parseMoneyInput("1500.50")).toBe(1500.5);
  });

  it("tolère les séparateurs de milliers et le symbole €", () => {
    expect(parseMoneyInput("1 500,50")).toBe(1500.5);
    expect(parseMoneyInput("1 500,50 €")).toBe(1500.5);
    expect(parseMoneyInput("1.500,50")).toBe(1500.5);
    expect(parseMoneyInput("1,500.50")).toBe(1500.5);
  });

  it("gère les nombres déjà typés et le signe négatif", () => {
    expect(parseMoneyInput(42)).toBe(42);
    expect(parseMoneyInput("-12,5")).toBe(-12.5);
  });

  it("renvoie NaN pour vide ou non parsable", () => {
    expect(parseMoneyInput("")).toBeNaN();
    expect(parseMoneyInput("abc")).toBeNaN();
    expect(parseMoneyInput(null)).toBeNaN();
    expect(parseMoneyInput(undefined)).toBeNaN();
  });
});

describe("REGEX", () => {
  it("valide SIRET/SIREN avec espaces tolérés", () => {
    expect(REGEX.siret.test("123 456 789 01234")).toBe(true);
    expect(REGEX.siret.test("123456789")).toBe(false);
    expect(REGEX.siren.test("123456789")).toBe(true);
  });

  it("valide code APE, code postal, téléphone FR", () => {
    expect(REGEX.codeApe.test("4322A")).toBe(true);
    expect(REGEX.codeApe.test("43220")).toBe(false);
    expect(REGEX.codePostal.test("75001")).toBe(true);
    expect(REGEX.telephoneFr.test("06 12 34 56 78")).toBe(true);
    expect(REGEX.telephoneFr.test("+33 6 12 34 56 78")).toBe(true);
  });

  it("valide IBAN FR et BIC", () => {
    expect(REGEX.ibanFr.test("FR76 3000 1007 9412 3456 7890 185")).toBe(true);
    expect(REGEX.bic.test("BNPAFRPP")).toBe(true);
    expect(REGEX.bic.test("BNPAFRPPXXX")).toBe(true);
    expect(REGEX.bic.test("BN")).toBe(false);
  });
});
