import { describe, expect, it } from "vitest";

import {
  ajouterJours,
  creneauxDuJour,
  debutSemaine,
  grouperParJour,
  horodatesDuJour,
  journeeEntiere,
  joursSemaine,
  libelleJour,
  libelleMois,
  libelleSemaine,
  naviguer,
  normaliserVue,
  vueInitiale,
} from "./agenda-vues";

describe("vue initiale", () => {
  it("URL > mémorisée > défaut selon l'écran (liste sur mobile, mois sur desktop)", () => {
    expect(vueInitiale({ depuisUrl: "semaine", memorisee: "jour", mobile: true })).toBe("semaine");
    expect(vueInitiale({ memorisee: "jour", mobile: true })).toBe("jour");
    expect(vueInitiale({ mobile: true })).toBe("liste");
    expect(vueInitiale({ mobile: false })).toBe("mois");
  });

  it("valeurs inconnues ignorées", () => {
    expect(normaliserVue("annee")).toBeNull();
    expect(normaliserVue(undefined)).toBeNull();
    expect(vueInitiale({ depuisUrl: "x", memorisee: "y", mobile: false })).toBe("mois");
  });
});

describe("dates", () => {
  it("semaine du lundi au dimanche, y compris à cheval sur deux mois", () => {
    // 16 sept. 2026 = mercredi
    expect(debutSemaine("2026-09-16")).toBe("2026-09-14");
    expect(joursSemaine("2026-09-16")).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20",
    ]);
    // dimanche 4 oct. → semaine du lundi 28 sept.
    expect(debutSemaine("2026-10-04")).toBe("2026-09-28");
    expect(ajouterJours("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("navigation : jour ±1, semaine ±7, mois ±1 (au 1er)", () => {
    expect(naviguer("jour", "2026-09-30", 1)).toBe("2026-10-01");
    expect(naviguer("semaine", "2026-09-16", -1)).toBe("2026-09-09");
    expect(naviguer("mois", "2026-01-31", 1)).toBe("2026-02-01");
    expect(naviguer("mois", "2026-03-15", -1)).toBe("2026-02-01");
  });

  it("libellés : Aujourd'hui / Demain / « Jeudi 18 sept. », semaine, mois", () => {
    expect(libelleJour("2026-09-16", "2026-09-16")).toBe("Aujourd'hui");
    expect(libelleJour("2026-09-17", "2026-09-16")).toBe("Demain");
    expect(libelleJour("2026-09-18", "2026-09-16")).toBe("Vendredi 18 sept.");
    expect(libelleJour("2026-09-18")).toBe("Vendredi 18 sept.");
    expect(libelleSemaine("2026-09-16")).toBe("14 – 20 sept. 2026");
    expect(libelleSemaine("2026-10-01")).toBe("28 sept. – 4 oct. 2026");
    expect(libelleMois("2026-09-16")).toBe("Septembre 2026");
  });
});

const ev = (p: { date_start: string; date_end?: string; heure_debut?: string | null; heure_fin?: string | null; id?: string }) => ({
  id: p.id ?? `${p.date_start}-${p.heure_debut ?? "jour"}`,
  date_start: p.date_start,
  date_end: p.date_end ?? p.date_start,
  heure_debut: p.heure_debut ?? null,
  heure_fin: p.heure_fin ?? null,
});

describe("grouperParJour (vue liste)", () => {
  const evenements = [
    ev({ date_start: "2026-09-18", heure_debut: "14:00:00", id: "b" }),
    ev({ date_start: "2026-09-16", heure_debut: "09:00:00", id: "a" }),
    ev({ date_start: "2026-09-16", id: "journee" }),
    ev({ date_start: "2026-09-15", id: "passe" }),
    ev({ date_start: "2026-09-17", date_end: "2026-09-19", id: "multi" }),
    ev({ date_start: "2026-12-25", id: "loin" }),
  ];

  it("à partir d'aujourd'hui, groupé par jour, journée entière avant les horaires, jours vides omis", () => {
    const groupes = grouperParJour(evenements, "2026-09-16", 10);
    expect(groupes.map((g) => g.jour)).toEqual(["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"]);
    expect(groupes[0]!.evenements.map((e) => e.id)).toEqual(["journee", "a"]);
    // le multi-jours apparaît sous chacun de ses jours
    expect(groupes[1]!.evenements.map((e) => e.id)).toEqual(["multi"]);
    expect(groupes[2]!.evenements.map((e) => e.id)).toEqual(["multi", "b"]);
    // le passé et ce qui est au-delà de la fenêtre sont exclus
    expect(groupes.flatMap((g) => g.evenements.map((e) => e.id))).not.toContain("passe");
    expect(groupes.flatMap((g) => g.evenements.map((e) => e.id))).not.toContain("loin");
  });

  it("tri horaire dans un jour", () => {
    const groupes = grouperParJour(
      [ev({ date_start: "2026-09-16", heure_debut: "16:30:00", id: "tard" }), ev({ date_start: "2026-09-16", heure_debut: "08:00:00", id: "tot" })],
      "2026-09-16",
      1,
    );
    expect(groupes[0]!.evenements.map((e) => e.id)).toEqual(["tot", "tard"]);
  });
});

describe("creneauxDuJour (vues jour / semaine)", () => {
  it("position et hauteur en % de la grille 7h → 20h", () => {
    const [c] = creneauxDuJour([ev({ date_start: "2026-09-16", heure_debut: "09:00:00", heure_fin: "12:00:00" })]);
    // 9h = 2h après 7h sur 13h → 15,38 % ; 3h → 23,08 %
    expect(c!.creneau.top).toBeCloseTo(15.38, 1);
    expect(c!.creneau.height).toBeCloseTo(23.08, 1);
    expect(c!.creneau.colonnes).toBe(1);
  });

  it("heure de fin absente → 1 h ; débordements rognés ; hors grille exclu", () => {
    const [sansFin] = creneauxDuJour([ev({ date_start: "2026-09-16", heure_debut: "14:00:00" })]);
    expect(sansFin!.creneau.height).toBeCloseTo(100 / 13, 1);
    const [deborde] = creneauxDuJour([ev({ date_start: "2026-09-16", heure_debut: "19:00:00", heure_fin: "22:00:00" })]);
    expect(deborde!.creneau.top + deborde!.creneau.height).toBeCloseTo(100, 5);
    expect(creneauxDuJour([ev({ date_start: "2026-09-16", heure_debut: "22:00:00", heure_fin: "23:00:00" })])).toEqual([]);
  });

  it("chevauchements répartis en colonnes, groupes indépendants", () => {
    const res = creneauxDuJour([
      ev({ date_start: "2026-09-16", heure_debut: "09:00:00", heure_fin: "11:00:00", id: "a" }),
      ev({ date_start: "2026-09-16", heure_debut: "10:00:00", heure_fin: "12:00:00", id: "b" }),
      ev({ date_start: "2026-09-16", heure_debut: "14:00:00", heure_fin: "15:00:00", id: "c" }),
    ]);
    const par = Object.fromEntries(res.map((r) => [r.evenement.id, r.creneau]));
    expect([par.a!.colonne, par.a!.colonnes]).toEqual([0, 2]);
    expect([par.b!.colonne, par.b!.colonnes]).toEqual([1, 2]);
    expect([par.c!.colonne, par.c!.colonnes]).toEqual([0, 1]);
  });

  it("journée entière vs horodatés du jour", () => {
    const evenements = [
      ev({ date_start: "2026-09-16", id: "j" }),
      ev({ date_start: "2026-09-15", date_end: "2026-09-17", id: "multi" }),
      ev({ date_start: "2026-09-16", heure_debut: "09:00:00", id: "h" }),
    ];
    expect(journeeEntiere(evenements, "2026-09-16").map((e) => e.id)).toEqual(["j", "multi"]);
    expect(horodatesDuJour(evenements, "2026-09-16").map((e) => e.id)).toEqual(["h"]);
  });
});

describe("creneauDepuisHeures (clic sur la grille horaire)", () => {
  it("l'heure cliquée devient l'heure de début, fin = +1 h", async () => {
    const { creneauDepuisHeures, formatHeure } = await import("./agenda-vues");
    expect(creneauDepuisHeures(14)).toEqual({ heure_debut: "14:00", heure_fin: "15:00" });
    expect(creneauDepuisHeures(7)).toEqual({ heure_debut: "07:00", heure_fin: "08:00" });
    expect(formatHeure(8.5)).toBe("08:30");
  });

  it("clic-glisser : de la première à la dernière ligne, dans les deux sens", async () => {
    const { creneauDepuisHeures } = await import("./agenda-vues");
    // lignes 14 h et 15 h sélectionnées → fin exclusive 16 h
    expect(creneauDepuisHeures(14, 16)).toEqual({ heure_debut: "14:00", heure_fin: "16:00" });
    expect(creneauDepuisHeures(16, 14)).toEqual({ heure_debut: "14:00", heure_fin: "16:00" });
    // même ligne → 1 h
    expect(creneauDepuisHeures(9, 9)).toEqual({ heure_debut: "09:00", heure_fin: "10:00" });
  });

  it("ne dépasse jamais 23:59 (dernière ligne de la grille)", async () => {
    const { creneauDepuisHeures } = await import("./agenda-vues");
    expect(creneauDepuisHeures(23)).toEqual({ heure_debut: "23:00", heure_fin: "23:59" });
  });
});

describe("libellés longs et courts", () => {
  it("jour long avec majuscule initiale, jour court pour les colonnes mobiles", async () => {
    const { libelleJourLong, libelleJourCourt } = await import("./agenda-vues");
    expect(libelleJourLong("2026-09-16")).toBe("Mercredi 16 septembre 2026");
    expect(libelleJourCourt("2026-09-14")).toBe("Lun 14");
  });
});
