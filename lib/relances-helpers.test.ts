import { describe, expect, it } from "vitest";

import { estEnRetard, joursDeRetard } from "./relances-helpers";

describe("joursDeRetard", () => {
  it("compte les jours entiers depuis l'échéance", () => {
    expect(joursDeRetard("2026-06-01", "2026-07-06")).toBe(35);
    expect(joursDeRetard("2026-07-05", "2026-07-06")).toBe(1);
  });

  it("vaut 0 le jour même de l'échéance", () => {
    expect(joursDeRetard("2026-07-06", "2026-07-06")).toBe(0);
  });

  it("est négatif si l'échéance est future", () => {
    expect(joursDeRetard("2026-07-10", "2026-07-06")).toBe(-4);
  });

  it("traverse correctement les fins de mois et d'année", () => {
    expect(joursDeRetard("2025-12-31", "2026-01-01")).toBe(1);
    expect(joursDeRetard("2026-02-28", "2026-03-01")).toBe(1);
    expect(joursDeRetard("2025-12-15", "2026-01-15")).toBe(31);
  });
});

describe("estEnRetard", () => {
  const today = "2026-07-06";

  it("vrai pour une facture envoyée dont l'échéance est dépassée", () => {
    expect(estEnRetard("envoyee", "2026-07-05", today)).toBe(true);
  });

  it("faux le jour même de l'échéance (pas encore en retard)", () => {
    expect(estEnRetard("envoyee", "2026-07-06", today)).toBe(false);
  });

  it("faux pour les autres statuts, même échéance dépassée", () => {
    expect(estEnRetard("payee", "2026-01-01", today)).toBe(false);
    expect(estEnRetard("brouillon", "2026-01-01", today)).toBe(false);
    expect(estEnRetard("annulee", "2026-01-01", today)).toBe(false);
  });

  it("faux sans date d'échéance", () => {
    expect(estEnRetard("envoyee", null, today)).toBe(false);
    expect(estEnRetard("envoyee", undefined, today)).toBe(false);
  });
});
