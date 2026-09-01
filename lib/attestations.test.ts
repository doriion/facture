import { describe, expect, it } from "vitest";

import { alerteValidite } from "./attestations";

describe("alerteValidite", () => {
  it("silencieux à plus de 30 jours de l'échéance", () => {
    expect(alerteValidite("2027-06-30", "2026-09-02")).toBeNull();
    expect(alerteValidite("2026-10-03", "2026-09-02")).toBeNull(); // J-31
  });

  it("« bientot » dans la fenêtre des 30 jours, bornes incluses", () => {
    expect(alerteValidite("2026-10-02", "2026-09-02")).toEqual({
      niveau: "bientot",
      jours: 30,
    });
    expect(alerteValidite("2026-09-10", "2026-09-02")).toEqual({
      niveau: "bientot",
      jours: 8,
    });
    // Le jour J : encore valide, alerte à 0 jour restant
    expect(alerteValidite("2026-09-02", "2026-09-02")).toEqual({
      niveau: "bientot",
      jours: 0,
    });
  });

  it("« expiree » dès le lendemain de la date de fin", () => {
    expect(alerteValidite("2026-09-01", "2026-09-02")).toEqual({
      niveau: "expiree",
      jours: 1,
    });
    expect(alerteValidite("2026-06-30", "2026-09-02")).toEqual({
      niveau: "expiree",
      jours: 64,
    });
  });

  it("seuil personnalisable", () => {
    expect(alerteValidite("2026-11-02", "2026-09-02", 61)).toEqual({
      niveau: "bientot",
      jours: 61,
    });
  });

  it("null sans date ou date invalide", () => {
    expect(alerteValidite(null, "2026-09-02")).toBeNull();
    expect(alerteValidite("", "2026-09-02")).toBeNull();
    expect(alerteValidite("pas-une-date", "2026-09-02")).toBeNull();
  });
});
