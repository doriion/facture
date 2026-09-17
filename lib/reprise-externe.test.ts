import { describe, expect, it } from "vitest";

import { interventionDepuisRdv, rdvAReprendre } from "./reprise-externe";

describe("interventionDepuisRdv", () => {
  it("titre → description, lieu et texte → notes, fin = début + 1 h si absente", () => {
    expect(
      interventionDepuisRdv({
        id: "u1",
        title: "Fuite ballon Mme Dupont",
        description: "Sonner 2 fois",
        lieu: "12 rue des Lilas, Grenoble",
        date_start: "2026-09-18",
        date_end: "2026-09-18",
        heure_debut: "14:00:00",
        heure_fin: null,
      }),
    ).toEqual({
      date_intervention: "2026-09-18",
      date_fin: null,
      heure_debut: "14:00:00",
      heure_fin: "15:00:00",
      type: "autre",
      description: "Fuite ballon Mme Dupont",
      notes: "Lieu : 12 rue des Lilas, Grenoble\n\nSonner 2 fois",
    });
  });

  it("journée entière sur plusieurs jours, sans lieu ni texte", () => {
    expect(
      interventionDepuisRdv({
        id: "u2", title: "Chantier Martin", description: null, lieu: null,
        date_start: "2026-09-21", date_end: "2026-09-23", heure_debut: null, heure_fin: null,
      }),
    ).toMatchObject({ date_fin: "2026-09-23", heure_debut: null, heure_fin: null, notes: null });
    expect(interventionDepuisRdv({ id: "u3", title: "", description: null, lieu: null, date_start: "2026-09-21", date_end: "2026-09-21", heure_debut: "23:30:00", heure_fin: null })).toMatchObject({ description: "Rendez-vous", heure_fin: "23:59:00" });
  });
});

describe("rdvAReprendre", () => {
  it("seulement les RDV iPhone d'aujourd'hui ou à venir", () => {
    const ev = (kind: "external" | "intervention", date_end: string) => ({ kind, date_end });
    expect(
      rdvAReprendre([ev("external", "2026-09-15"), ev("external", "2026-09-16"), ev("external", "2026-10-01"), ev("intervention", "2026-10-01")], "2026-09-16"),
    ).toEqual([ev("external", "2026-09-16"), ev("external", "2026-10-01")]);
  });
});
