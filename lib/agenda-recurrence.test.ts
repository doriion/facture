import { describe, expect, it } from "vitest";

import {
  MAX_OCCURRENCES,
  choixDeRegle,
  datesOccurrences,
  depassePlafond,
  ecartJours,
  finParDefaut,
  libelleRecurrence,
  occurrence,
  occurrencesSuivantes,
  regleDuChoix,
} from "./agenda-recurrence";

describe("choix du formulaire ↔ règle", () => {
  it("chaque choix donne une règle, et inversement", () => {
    expect(regleDuChoix("jamais")).toBeNull();
    expect(regleDuChoix("hebdomadaire")).toEqual({ frequence: "hebdomadaire", intervalle: 1 });
    expect(regleDuChoix("quinzaine")).toEqual({ frequence: "hebdomadaire", intervalle: 2 });
    expect(regleDuChoix("mensuelle")).toEqual({ frequence: "mensuelle", intervalle: 1 });
    expect(regleDuChoix("annuelle")).toEqual({ frequence: "annuelle", intervalle: 1 });
    expect(choixDeRegle({ frequence: "hebdomadaire", intervalle: 2 })).toBe("quinzaine");
    expect(choixDeRegle({ frequence: "hebdomadaire", intervalle: 1 })).toBe("hebdomadaire");
    expect(choixDeRegle({ frequence: "annuelle", intervalle: 1 })).toBe("annuelle");
  });

  it("fin par défaut : un an, cinq ans pour l'annuel", () => {
    expect(finParDefaut("2026-09-16", "hebdomadaire")).toBe("2027-09-16");
    expect(finParDefaut("2026-09-16", "mensuelle")).toBe("2027-09-16");
    expect(finParDefaut("2026-09-16", "annuelle")).toBe("2031-09-16");
  });
});

describe("occurrences", () => {
  it("hebdomadaire : toutes les semaines, puis une sur deux", () => {
    expect(datesOccurrences("2026-09-16", { frequence: "hebdomadaire", intervalle: 1, date_fin: "2026-10-10" })).toEqual([
      "2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07",
    ]);
    expect(datesOccurrences("2026-09-16", { frequence: "hebdomadaire", intervalle: 2, date_fin: "2026-10-14" })).toEqual([
      "2026-09-16", "2026-09-30", "2026-10-14",
    ]);
  });

  it("mensuelle : garde le jour du mois, rogné quand il n'existe pas (31 → 28/30)", () => {
    expect(datesOccurrences("2026-01-31", { frequence: "mensuelle", intervalle: 1, date_fin: "2026-05-31" })).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31",
    ]);
    // Passage d'année
    expect(occurrence("2026-11-15", { frequence: "mensuelle", intervalle: 1 }, 3)).toBe("2027-02-15");
    expect(occurrence("2026-11-15", { frequence: "mensuelle", intervalle: 3 }, 1)).toBe("2027-02-15");
  });

  it("annuelle : 29 février → 28 février, puis 29 à nouveau l'année bissextile", () => {
    expect(datesOccurrences("2028-02-29", { frequence: "annuelle", intervalle: 1, date_fin: "2032-12-31" })).toEqual([
      "2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29",
    ]);
  });

  it("date de fin incluse, date de début toujours présente", () => {
    expect(datesOccurrences("2026-09-16", { frequence: "hebdomadaire", intervalle: 1, date_fin: "2026-09-23" })).toEqual([
      "2026-09-16", "2026-09-23",
    ]);
    expect(datesOccurrences("2026-09-16", { frequence: "hebdomadaire", intervalle: 1, date_fin: "2026-09-16" })).toEqual([
      "2026-09-16",
    ]);
  });

  it("plafond : jamais plus de MAX_OCCURRENCES, et on sait quand la série déborde", () => {
    const rec = { frequence: "hebdomadaire" as const, intervalle: 1, date_fin: "2030-12-31" };
    expect(datesOccurrences("2026-09-16", rec)).toHaveLength(MAX_OCCURRENCES);
    expect(depassePlafond("2026-09-16", rec)).toBe(true);
    expect(depassePlafond("2026-09-16", { ...rec, date_fin: "2027-09-16" })).toBe(false);
  });

  it("le changement d'heure ne décale pas les dates hebdomadaires", () => {
    expect(datesOccurrences("2026-10-19", { frequence: "hebdomadaire", intervalle: 1, date_fin: "2026-11-02" })).toEqual([
      "2026-10-19", "2026-10-26", "2026-11-02",
    ]);
    expect(ecartJours("2026-10-23", "2026-10-27")).toBe(4);
  });
});

describe("libellé et portée", () => {
  it("libellé lisible", () => {
    expect(libelleRecurrence({ frequence: "hebdomadaire", intervalle: 1, date_fin: "2027-09-16" })).toBe("toutes les semaines jusqu'au Jeudi 16 sept. 2027");
    expect(libelleRecurrence({ frequence: "hebdomadaire", intervalle: 2, date_fin: "2027-09-16" })).toBe("toutes les 2 semaines jusqu'au Jeudi 16 sept. 2027");
    expect(libelleRecurrence({ frequence: "mensuelle", intervalle: 1, date_fin: "2027-09-16" })).toMatch(/^tous les mois jusqu'au/);
    expect(libelleRecurrence({ frequence: "annuelle", intervalle: 1, date_fin: "2031-09-16" })).toMatch(/^tous les ans jusqu'au/);
  });

  it("« et les suivants » : même série, à partir de la date, jamais les facturées", () => {
    const occ = [
      { id: "a", serie_id: "s1", date_intervention: "2026-09-09", facture_id: null },
      { id: "b", serie_id: "s1", date_intervention: "2026-09-16", facture_id: null },
      { id: "c", serie_id: "s1", date_intervention: "2026-09-23", facture_id: "f1" },
      { id: "d", serie_id: "s1", date_intervention: "2026-09-30", facture_id: null },
      { id: "e", serie_id: "s2", date_intervention: "2026-09-30", facture_id: null },
      { id: "f", serie_id: null, date_intervention: "2026-09-30", facture_id: null },
    ];
    expect(occurrencesSuivantes(occ, "s1", "2026-09-16").map((o) => o.id)).toEqual(["b", "d"]);
  });
});
