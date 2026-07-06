import { describe, expect, it } from "vitest";

import {
  arrondi2,
  estSoldee,
  montantRestant,
  statutApresEncaissement,
  statutApresSuppressionPaiement,
} from "./paiements-helpers";

describe("montantRestant (pré-remplissage « Marquer payée »)", () => {
  it("vaut le total quand rien n'est encaissé", () => {
    expect(montantRestant(1500, 0)).toBe(1500);
  });

  it("déduit les acomptes déjà encaissés", () => {
    expect(montantRestant(1500, 500)).toBe(1000);
    expect(montantRestant(1500.5, 1000.25)).toBe(500.25);
  });

  it("ne descend jamais sous zéro (trop-perçu)", () => {
    expect(montantRestant(1000, 1200)).toBe(0);
  });

  it("arrondit au centime les flottants", () => {
    expect(montantRestant(0.3, 0.1)).toBe(0.2);
    expect(arrondi2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("estSoldee", () => {
  it("soldée à zéro et sous la tolérance d'arrondi", () => {
    expect(estSoldee(0)).toBe(true);
    expect(estSoldee(0.004)).toBe(true);
  });

  it("pas soldée au-delà de la tolérance", () => {
    expect(estSoldee(0.01)).toBe(false);
    expect(estSoldee(100)).toBe(false);
  });
});

describe("statutApresEncaissement (flux « Marquer payée » = créer un paiement)", () => {
  it("envoyée + soldée → payée", () => {
    expect(statutApresEncaissement("envoyee", 0)).toBe("payee");
  });

  it("brouillon + soldée → payée", () => {
    expect(statutApresEncaissement("brouillon", 0)).toBe("payee");
  });

  it("paiement partiel → le statut ne bouge pas", () => {
    expect(statutApresEncaissement("envoyee", 250)).toBe("envoyee");
  });

  it("annulée/payée → jamais modifiées par un encaissement", () => {
    expect(statutApresEncaissement("annulee", 0)).toBe("annulee");
    expect(statutApresEncaissement("payee", 0)).toBe("payee");
  });
});

describe("statutApresSuppressionPaiement (flux inverse payée → envoyée)", () => {
  it("payée dont le reste redevient positif → envoyée", () => {
    expect(statutApresSuppressionPaiement("payee", 1500)).toBe("envoyee");
  });

  it("payée encore soldée (suppression d'un trop-perçu) → reste payée", () => {
    expect(statutApresSuppressionPaiement("payee", 0)).toBe("payee");
  });

  it("les autres statuts ne bougent pas", () => {
    expect(statutApresSuppressionPaiement("envoyee", 1500)).toBe("envoyee");
    expect(statutApresSuppressionPaiement("brouillon", 1500)).toBe("brouillon");
  });
});
