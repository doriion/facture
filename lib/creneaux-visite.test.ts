import { describe, expect, it } from "vitest";

import {
  creneauOccupe,
  creneauPropose,
  creneauxLibres,
  estJourOuvre,
  etatProposition,
  expirationProposition,
  libelleCreneau,
  libellePlage,
  reponseVisiteSchema,
} from "./creneaux-visite";

describe("estJourOuvre / libellés", () => {
  it("samedi et dimanche exclus", () => {
    expect(estJourOuvre("2026-10-19")).toBe(true); // lundi
    expect(estJourOuvre("2026-10-24")).toBe(false); // samedi
    expect(estJourOuvre("2026-10-25")).toBe(false); // dimanche
  });
  it("libellés lisibles", () => {
    expect(libelleCreneau({ date: "2026-10-20", debut: "08:00", fin: "12:00" })).toBe("Mardi 20 octobre 2026, le matin (8 h – 12 h)");
    expect(libellePlage({ date: "2026-10-20", debut: "14:00", fin: "18:00" })).toBe("l'après-midi (14 h – 18 h)");
    expect(libellePlage({ date: "2026-10-20", debut: "09:30", fin: "11:30" })).toBe("entre 9 h 30 et 11 h 30");
    expect(libellePlage({ date: "2026-10-20", debut: null, fin: null })).toBe("dans la journée");
  });
  it("créneau proposé par l'artisan : deux heures à partir de l'heure donnée, ou la journée", () => {
    expect(creneauPropose("2026-10-20", "09:30:00")).toEqual({ date: "2026-10-20", debut: "09:30", fin: "11:30" });
    expect(creneauPropose("2026-10-20", null)).toEqual({ date: "2026-10-20", debut: null, fin: null });
  });
});

describe("creneauOccupe / creneauxLibres", () => {
  const matin = { date: "2026-10-20", debut: "08:00", fin: "12:00" };
  const aprem = { date: "2026-10-20", debut: "14:00", fin: "18:00" };
  it("un rendez-vous à l'heure bloque sa demi-journée, pas l'autre", () => {
    const occ = [{ date_start: "2026-10-20", date_end: "2026-10-20", heure_debut: "10:00:00", heure_fin: "11:00:00" }];
    expect(creneauOccupe(matin, occ)).toBe(true);
    expect(creneauOccupe(aprem, occ)).toBe(false);
  });
  it("un rendez-vous sans heure (journée, ou chantier sur plusieurs jours) bloque tout", () => {
    const occ = [{ date_start: "2026-10-19", date_end: "2026-10-21", heure_debut: null, heure_fin: null }];
    expect(creneauOccupe(matin, occ)).toBe(true);
    expect(creneauOccupe(aprem, occ)).toBe(true);
    expect(creneauOccupe({ date: "2026-10-22", debut: "08:00", fin: "12:00" }, occ)).toBe(false);
  });
  it("un rendez-vous sans heure de fin compte une heure", () => {
    const occ = [{ date_start: "2026-10-20", date_end: "2026-10-20", heure_debut: "13:30:00", heure_fin: null }];
    expect(creneauOccupe(aprem, occ)).toBe(true); // 13:30 → 14:30 chevauche
    expect(creneauOccupe(matin, occ)).toBe(false);
  });
  it("liste les demi-journées ouvrées libres, dans l'ordre, en excluant le créneau déjà proposé", () => {
    const libres = creneauxLibres({
      depuis: "2026-10-19", // lundi
      jusquau: "2026-10-25",
      occupations: [
        { date_start: "2026-10-19", date_end: "2026-10-19", heure_debut: "09:00:00", heure_fin: "10:00:00" },
        { date_start: "2026-10-21", date_end: "2026-10-21", heure_debut: null, heure_fin: null },
      ],
      exclure: { date: "2026-10-20", debut: "08:00", fin: "12:00" },
      max: 4,
    });
    expect(libres).toEqual([
      { date: "2026-10-19", debut: "14:00", fin: "18:00" },
      { date: "2026-10-20", debut: "14:00", fin: "18:00" },
      { date: "2026-10-22", debut: "08:00", fin: "12:00" },
      { date: "2026-10-22", debut: "14:00", fin: "18:00" },
    ]);
  });
});

describe("etatProposition", () => {
  const base = { statut: "envoyee", expire_le: "2026-11-20T00:00:00.000Z", date_proposee: "2026-11-05" };
  it("utilisable, puis répondue / expirée / annulée / introuvable", () => {
    expect(etatProposition(base, "2026-10-21T08:00:00.000Z", "2026-10-21")).toBe("utilisable");
    expect(etatProposition({ ...base, statut: "confirmee" }, "2026-10-21T08:00:00.000Z", "2026-10-21")).toBe("repondue");
    expect(etatProposition({ ...base, statut: "annulee" }, "2026-10-21T08:00:00.000Z", "2026-10-21")).toBe("annulee");
    expect(etatProposition(base, "2026-11-21T08:00:00.000Z", "2026-11-21")).toBe("expiree");
    expect(etatProposition(base, "2026-11-06T08:00:00.000Z", "2026-11-06")).toBe("expiree"); // date proposée passée
    expect(etatProposition(null, "2026-10-21T08:00:00.000Z", "2026-10-21")).toBe("introuvable");
  });
  it("le lien vaut 30 jours", () => {
    expect(expirationProposition("2026-10-21T10:00:00.000Z")).toBe("2026-11-20T10:00:00.000Z");
  });
});

describe("reponseVisiteSchema", () => {
  it("accepte le créneau proposé, un index, ou aucun avec message", () => {
    expect(reponseVisiteSchema.safeParse({ choix: "propose" }).success).toBe(true);
    expect(reponseVisiteSchema.safeParse({ choix: 2, message: "" }).success).toBe(true);
    expect(reponseVisiteSchema.safeParse({ choix: "aucun", message: "Plutôt en novembre" }).success).toBe(true);
    expect(reponseVisiteSchema.safeParse({ choix: "autre" }).success).toBe(false);
    expect(reponseVisiteSchema.safeParse({ choix: -1 }).success).toBe(false);
  });
});
