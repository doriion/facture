import { describe, expect, it } from "vitest";

import { ageCorbeille, estDansCorbeille, sansCorbeille } from "./corbeille";

describe("corbeille", () => {
  const t0 = new Date("2026-09-17T17:00:00Z").getTime();

  it("âge lisible", () => {
    expect(ageCorbeille("2026-09-17T16:59:40Z", t0)).toBe("à l'instant");
    expect(ageCorbeille("2026-09-17T16:45:00Z", t0)).toBe("il y a 15 min");
    expect(ageCorbeille("2026-09-17T13:00:00Z", t0)).toBe("il y a 4 h");
    expect(ageCorbeille("2026-09-16T10:00:00Z", t0)).toBe("hier");
    expect(ageCorbeille("2026-09-10T10:00:00Z", t0)).toBe("il y a 7 jours");
    expect(ageCorbeille("2026-09-18T10:00:00Z", t0)).toBe("à l'instant");
  });

  it("filtre les interventions à la corbeille", () => {
    const a = { id: "a", supprime_le: null };
    const b = { id: "b", supprime_le: "2026-09-17T16:00:00Z" };
    const c = { id: "c", supprime_le: undefined };
    expect(estDansCorbeille(b)).toBe(true);
    expect(estDansCorbeille(a)).toBe(false);
    expect(sansCorbeille([a, b, c])).toEqual([a, c]);
  });
});
