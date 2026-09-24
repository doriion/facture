import { describe, expect, it } from "vitest";

import {
  compterStatuts,
  dureeDepuisHeures,
  formatDuree,
  statutIntervention,
} from "./interventions-helpers";

const J = "2026-09-25";

describe("statutIntervention", () => {
  it("facturée > rien à facturer > à venir > à facturer", () => {
    expect(statutIntervention({ date_intervention: "2026-09-01", facture: { id: "f" } }, J)).toBe("facturee");
    expect(statutIntervention({ date_intervention: "2026-09-01", a_facturer: false }, J)).toBe("rien_a_facturer");
    expect(statutIntervention({ date_intervention: "2026-09-26" }, J)).toBe("a_venir");
    expect(statutIntervention({ date_intervention: "2026-09-25" }, J)).toBe("a_facturer");
    expect(statutIntervention({ date_intervention: "2026-09-01", a_facturer: true }, J)).toBe("a_facturer");
  });

  it("compte par statut", () => {
    expect(
      compterStatuts(
        [
          { date_intervention: "2026-09-01" },
          { date_intervention: "2026-09-02", facture: { id: "f" } },
          { date_intervention: "2026-10-01" },
        ],
        J,
      ),
    ).toEqual({ a_venir: 1, a_facturer: 1, facturee: 1, rien_a_facturer: 0 });
  });
});

describe("durée", () => {
  it("déduit les minutes des heures, ignore l'incohérent", () => {
    expect(dureeDepuisHeures("09:00", "11:30")).toBe(150);
    expect(dureeDepuisHeures("09:00:00", "09:45:00")).toBe(45);
    expect(dureeDepuisHeures("11:00", "09:00")).toBeNull();
    expect(dureeDepuisHeures("", "09:00")).toBeNull();
    expect(dureeDepuisHeures(null, undefined)).toBeNull();
  });

  it("formate en heures et minutes", () => {
    expect(formatDuree(150)).toBe("2 h 30");
    expect(formatDuree(120)).toBe("2 h");
    expect(formatDuree(45)).toBe("45 min");
    expect(formatDuree(0)).toBeNull();
  });
});
