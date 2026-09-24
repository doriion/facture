import { describe, expect, it } from "vitest";

import {
  facteursTotpNonVerifies,
  facteurTotpVerifie,
  normaliserCodeTotp,
  verificationRequise,
} from "./mfa-helpers";

const verifie = { id: "f1", factor_type: "totp", status: "verified" };
const brouillon = { id: "f2", factor_type: "totp", status: "unverified" };
const telephone = { id: "f3", factor_type: "phone", status: "verified" };

describe("normaliserCodeTotp", () => {
  it("accepte 6 chiffres, avec espaces, refuse le reste", () => {
    expect(normaliserCodeTotp("123456")).toBe("123456");
    expect(normaliserCodeTotp(" 123 456 ")).toBe("123456");
    expect(normaliserCodeTotp("12345")).toBeNull();
    expect(normaliserCodeTotp("12345a")).toBeNull();
    expect(normaliserCodeTotp("")).toBeNull();
  });
});

describe("facteurs", () => {
  it("ne retient que le TOTP vérifié", () => {
    expect(facteurTotpVerifie([brouillon, telephone, verifie])?.id).toBe("f1");
    expect(facteurTotpVerifie([brouillon, telephone])).toBeNull();
    expect(facteurTotpVerifie(undefined)).toBeNull();
  });

  it("liste les enrôlements TOTP inachevés", () => {
    expect(facteursTotpNonVerifies([brouillon, verifie, telephone]).map((f) => f.id)).toEqual(["f2"]);
  });
});

describe("verificationRequise", () => {
  it("exige le code quand un facteur est actif et la session au mot de passe seul", () => {
    expect(verificationRequise("aal1", [verifie])).toBe(true);
    expect(verificationRequise(null, [verifie])).toBe(true);
    expect(verificationRequise("aal2", [verifie])).toBe(false);
    expect(verificationRequise("aal1", [brouillon])).toBe(false);
    expect(verificationRequise("aal1", [])).toBe(false);
  });
});
