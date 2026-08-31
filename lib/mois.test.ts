import { describe, expect, it } from "vitest";

import { ajouterMois, derniers12Mois } from "./mois";

describe("derniers12Mois", () => {
  it("le 31 août : 12 mois DISTINCTS, de sept 25 à août 26 (bug du 31)", () => {
    // Cas réel qui affichait « juil juil août » et faisait disparaître
    // juin : setMonth() avant setDate(1) débordait sur les mois à 30 j.
    const buckets = derniers12Mois(new Date("2026-08-31T15:47:29Z"));
    expect(buckets).toHaveLength(12);
    expect(new Set(buckets.map((b) => b.start)).size).toBe(12);
    expect(buckets[0]!.label).toBe("sept 25");
    expect(buckets[10]!).toEqual({
      label: "juil 26",
      start: "2026-07-01",
      end: "2026-08-01",
    });
    expect(buckets[11]!).toEqual({
      label: "août 26",
      start: "2026-08-01",
      end: "2026-09-01",
    });
    // juin est bien présent, entre mai et juillet
    expect(buckets[9]!.start).toBe("2026-06-01");
  });

  it("le 31 janvier et le 29 février (année bissextile) : aucun doublon", () => {
    for (const d of ["2026-01-31T10:00:00Z", "2028-02-29T10:00:00Z"]) {
      const buckets = derniers12Mois(new Date(d));
      expect(new Set(buckets.map((b) => b.start)).size).toBe(12);
    }
  });

  it("chevauchement d'année : bornes [start, end) contiguës", () => {
    const buckets = derniers12Mois(new Date("2026-02-15T10:00:00Z"));
    expect(buckets[0]!.start).toBe("2025-03-01");
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i]!.start).toBe(buckets[i - 1]!.end);
    }
    expect(buckets[11]!.end).toBe("2026-03-01");
  });
});

describe("ajouterMois", () => {
  it("borne au dernier jour du mois cible (fin de mois)", () => {
    expect(ajouterMois("2026-08-31", 6)).toBe("2027-02-28"); // pas le 3 mars
    expect(ajouterMois("2026-08-31", 1)).toBe("2026-09-30");
    expect(ajouterMois("2027-08-31", 6)).toBe("2028-02-29"); // bissextile
  });

  it("comportement normal en milieu de mois", () => {
    expect(ajouterMois("2026-05-10", 3)).toBe("2026-08-10");
    expect(ajouterMois("2026-11-15", 2)).toBe("2027-01-15");
    expect(ajouterMois("2026-05-10", 12)).toBe("2027-05-10");
  });
});
