import { describe, expect, it } from "vitest";

import { isSiretValide, normalizeSiret } from "./siret";

describe("normalizeSiret", () => {
  it("retire espaces, points et tirets", () => {
    expect(normalizeSiret("732 829 320 00074")).toBe("73282932000074");
    expect(normalizeSiret("732.829.320-00074")).toBe("73282932000074");
  });
});

describe("isSiretValide", () => {
  it("accepte un SIRET valide (exemple de la documentation INSEE)", () => {
    expect(isSiretValide("73282932000074")).toBe(true);
    // Tolère la saisie formatée
    expect(isSiretValide("732 829 320 00074")).toBe(true);
  });

  it("rejette une clé de Luhn incorrecte", () => {
    expect(isSiretValide("73282932000075")).toBe(false);
    expect(isSiretValide("73282932000073")).toBe(false);
  });

  it("rejette les mauvais formats", () => {
    expect(isSiretValide("1234")).toBe(false); // trop court
    expect(isSiretValide("123456789001234")).toBe(false); // 15 chiffres
    expect(isSiretValide("7328293200007A")).toBe(false); // lettre
  });

  it("vide ou absent = non renseigné, accepté (champ optionnel)", () => {
    expect(isSiretValide("")).toBe(true);
    expect(isSiretValide("   ")).toBe(true);
    expect(isSiretValide(null)).toBe(true);
    expect(isSiretValide(undefined)).toBe(true);
  });

  it("exception La Poste (SIREN 356000000) : somme des chiffres mod 5", () => {
    // Synthétique : 3+5+6+0…0+1+0 = 15, multiple de 5 → valide
    expect(isSiretValide("35600000000010")).toBe(true);
    // Somme 16 : ni multiple de 5 ni Luhn → invalide
    expect(isSiretValide("35600000000011")).toBe(false);
    // Le siège de La Poste respecte Luhn : accepté aussi
    expect(isSiretValide("35600000000048")).toBe(true);
  });
});
