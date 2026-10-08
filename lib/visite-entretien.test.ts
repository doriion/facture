import { describe, expect, it } from "vitest";

import {
  confirmationValable,
  heureChamp,
  heureLisible,
  planificationVisiteSchema,
} from "./visite-entretien";

describe("planificationVisiteSchema", () => {
  it("date obligatoire, heure facultative au format HH:MM", () => {
    expect(planificationVisiteSchema.safeParse({ date: "2026-10-15", heure: "09:30", envoyerConfirmation: true }).success).toBe(true);
    expect(planificationVisiteSchema.safeParse({ date: "2026-10-15", heure: "", envoyerConfirmation: false }).success).toBe(true);
    expect(planificationVisiteSchema.safeParse({ date: "", heure: "", envoyerConfirmation: false }).success).toBe(false);
    expect(planificationVisiteSchema.safeParse({ date: "2026-10-15", heure: "25:00", envoyerConfirmation: false }).success).toBe(false);
  });
});

describe("heureLisible / heureChamp", () => {
  it("heure à la française, minutes omises à l'heure pile", () => {
    expect(heureLisible("09:30:00")).toBe("9 h 30");
    expect(heureLisible("14:00")).toBe("14 h");
    expect(heureLisible("08:05:00")).toBe("8 h 05");
    expect(heureLisible(null)).toBeNull();
    expect(heureLisible("")).toBeNull();
  });
  it("valeur du champ heure", () => {
    expect(heureChamp("09:30:00")).toBe("09:30");
    expect(heureChamp(null)).toBe("");
  });
});

describe("confirmationValable", () => {
  it("vaut pour la date affichée seulement", () => {
    expect(confirmationValable({ prochaine_visite: "2026-10-15", confirmation_envoyee_pour: "2026-10-15" })).toBe(true);
    expect(confirmationValable({ prochaine_visite: "2026-10-20", confirmation_envoyee_pour: "2026-10-15" })).toBe(false);
    expect(confirmationValable({ prochaine_visite: null, confirmation_envoyee_pour: null })).toBe(false);
  });
});
