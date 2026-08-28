import { describe, expect, it } from "vitest";

import {
  BAREME_DEFAUT,
  prochaineBascule,
  provisionCotisations,
  tauxApplicable,
  tauxTotalPct,
  trimestreCourant,
} from "./cotisations";

describe("tauxApplicable", () => {
  it("choisit la ligne la plus récente ≤ date", () => {
    expect(tauxApplicable(BAREME_DEFAUT, "2026-08-28")?.taux_social).toBe(10.6);
    expect(tauxApplicable(BAREME_DEFAUT, "2027-03-31")?.taux_social).toBe(10.6);
    expect(tauxApplicable(BAREME_DEFAUT, "2027-04-01")?.taux_social).toBe(21.2);
  });

  it("null avant la première ligne du barème", () => {
    expect(tauxApplicable(BAREME_DEFAUT, "2026-01-15")).toBeNull();
  });
});

describe("provisionCotisations", () => {
  it("calcule la provision ACRE (12,6 % au total)", () => {
    const p = provisionCotisations(10000, BAREME_DEFAUT, "2026-08-28")!;
    expect(p.tauxTotalPct).toBe(12.6);
    expect(p.montantSocial).toBe(1060);
    expect(p.montantCfp).toBe(30);
    expect(p.montantVl).toBe(170);
    expect(p.montantTotal).toBe(1260);
  });

  it("au taux plein la provision fait 23,2 %", () => {
    const p = provisionCotisations(10000, BAREME_DEFAUT, "2027-06-01")!;
    expect(p.tauxTotalPct).toBe(23.2);
    expect(p.montantTotal).toBe(2320);
  });

  it("null sans barème applicable ou montant invalide", () => {
    expect(provisionCotisations(1000, [], "2026-08-28")).toBeNull();
    expect(provisionCotisations(-5, BAREME_DEFAUT, "2026-08-28")).toBeNull();
  });
});

describe("prochaineBascule", () => {
  it("prévient dans les 6 mois précédant la fin de l'ACRE", () => {
    const b = prochaineBascule(BAREME_DEFAUT, "2026-11-15")!;
    expect(b.date).toBe("2027-04-01");
    expect(tauxTotalPct(b.avant)).toBe(12.6);
    expect(tauxTotalPct(b.apres)).toBe(23.2);
  });

  it("silencieux tant que la bascule est loin, ou déjà passée", () => {
    expect(prochaineBascule(BAREME_DEFAUT, "2026-08-28")).toBeNull();
    expect(prochaineBascule(BAREME_DEFAUT, "2027-05-01")).toBeNull();
  });
});

describe("trimestreCourant", () => {
  it("borne les trimestres civils [start, end)", () => {
    expect(trimestreCourant("2026-08-28")).toEqual({
      label: "T3 2026",
      start: "2026-07-01",
      end: "2026-10-01",
    });
    expect(trimestreCourant("2026-12-31")).toEqual({
      label: "T4 2026",
      start: "2026-10-01",
      end: "2027-01-01",
    });
    expect(trimestreCourant("2026-01-01")).toEqual({
      label: "T1 2026",
      start: "2026-01-01",
      end: "2026-04-01",
    });
  });
});
