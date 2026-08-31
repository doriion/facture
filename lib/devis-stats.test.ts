import { describe, expect, it } from "vitest";

import { computeTauxConversionDevis } from "./devis-stats";

const s = (statut: string) => ({ statut });

describe("computeTauxConversionDevis", () => {
  it("null (affiché « — ») quand le dénominateur est nul", () => {
    expect(computeTauxConversionDevis([])).toBeNull();
    // Que des brouillons : rien d'envoyé ni de tranché
    expect(computeTauxConversionDevis([s("brouillon")])).toBeNull();
    expect(
      computeTauxConversionDevis([s("brouillon"), s("expire")]),
    ).toBeNull();
  });

  it("calcule accepté / (accepté + refusé + envoyé)", () => {
    expect(
      computeTauxConversionDevis([s("accepte"), s("refuse")]),
    ).toBe(50);
    expect(
      computeTauxConversionDevis([s("accepte"), s("accepte"), s("envoye")]),
    ).toBe(67);
    expect(computeTauxConversionDevis([s("envoye")])).toBe(0);
  });

  it("ignore brouillons et expirés dans le calcul", () => {
    expect(
      computeTauxConversionDevis([
        s("accepte"),
        s("brouillon"),
        s("brouillon"),
        s("expire"),
      ]),
    ).toBe(100);
  });
});
