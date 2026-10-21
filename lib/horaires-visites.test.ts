import { describe, expect, it } from "vitest";

import { horairesParDefaut, horairesVisitesSchema, normaliserHoraires } from "./horaires-visites";

describe("horaires de visite", () => {
  it("défauts : lundi à vendredi, 8 h – 12 h et 14 h – 18 h", () => {
    expect(horairesParDefaut()).toEqual({
      jours: [1, 2, 3, 4, 5],
      matin: { debut: "08:00", fin: "12:00" },
      apres_midi: { debut: "14:00", fin: "18:00" },
    });
    expect(normaliserHoraires({})).toEqual(horairesParDefaut());
    expect(normaliserHoraires(null)).toEqual(horairesParDefaut());
  });
  it("valeur valide reprise, jours triés sans doublon", () => {
    expect(normaliserHoraires({ jours: [3, 1, 1, 6], matin: { debut: "07:30", fin: "12:30" }, apres_midi: null })).toEqual({
      jours: [1, 3, 6],
      matin: { debut: "07:30", fin: "12:30" },
      apres_midi: null,
    });
  });
  it("refuse une tranche à l'envers, un après-midi avant le matin, aucun jour ou aucune tranche", () => {
    expect(horairesVisitesSchema.safeParse({ jours: [1], matin: { debut: "12:00", fin: "08:00" }, apres_midi: null }).success).toBe(false);
    expect(horairesVisitesSchema.safeParse({ jours: [1], matin: { debut: "08:00", fin: "12:00" }, apres_midi: { debut: "11:00", fin: "18:00" } }).success).toBe(false);
    expect(horairesVisitesSchema.safeParse({ jours: [], matin: { debut: "08:00", fin: "12:00" }, apres_midi: null }).success).toBe(false);
    expect(horairesVisitesSchema.safeParse({ jours: [1], matin: null, apres_midi: null }).success).toBe(false);
    // Une valeur invalide stockée ne casse rien : défauts.
    expect(normaliserHoraires({ jours: [], matin: null, apres_midi: null })).toEqual(horairesParDefaut());
  });
});
