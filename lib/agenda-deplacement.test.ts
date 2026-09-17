import { describe, expect, it } from "vitest";

import {
  aChange,
  arrondirAuPas,
  deplacer,
  estDeplacable,
  heureDeMinutes,
  libelleDeplacement,
  minutesDeHeure,
  redimensionner,
  valeursActuelles,
} from "./agenda-deplacement";
import { dispositionGrille, minutesDeY, yDeMinutes } from "./agenda-vues";

const rdv = {
  date_start: "2026-09-16",
  date_end: "2026-09-16",
  heure_debut: "09:00:00",
  heure_fin: "11:00:00",
};

describe("estDeplacable", () => {
  it("seules les interventions non facturées se glissent", () => {
    expect(estDeplacable({ kind: "intervention", facture_emise: false })).toBe(true);
    expect(estDeplacable({ kind: "intervention" })).toBe(true);
    expect(estDeplacable({ kind: "intervention", facture_emise: true })).toBe(false);
    expect(estDeplacable({ kind: "external" })).toBe(false);
    expect(estDeplacable({ kind: "facture_prestation" })).toBe(false);
  });
});

describe("heures", () => {
  it("conversions et arrondi au quart d'heure", () => {
    expect(minutesDeHeure("14:30:00")).toBe(870);
    expect(minutesDeHeure("14:30")).toBe(870);
    expect(heureDeMinutes(870)).toBe("14:30:00");
    expect(heureDeMinutes(-5)).toBe("00:00:00");
    expect(heureDeMinutes(24 * 60 + 30)).toBe("23:59:00");
    expect(arrondirAuPas(877)).toBe(870);
    expect(arrondirAuPas(878)).toBe(885);
    expect(arrondirAuPas(863, 30)).toBe(870);
  });
});

describe("deplacer", () => {
  it("sur la grille : jour + heure arrondie, durée conservée", () => {
    expect(deplacer(rdv, { jour: "2026-09-18", debut: 14 * 60 + 7 })).toEqual({
      date_intervention: "2026-09-18",
      date_fin: null,
      heure_debut: "14:00:00",
      heure_fin: "16:00:00",
    });
  });

  it("en vue mois (sans heure) : seul le jour change", () => {
    expect(deplacer(rdv, { jour: "2026-09-21" })).toEqual({
      date_intervention: "2026-09-21",
      date_fin: null,
      heure_debut: "09:00:00",
      heure_fin: "11:00:00",
    });
  });

  it("intervention sur plusieurs jours : le bloc se décale d'autant, y compris sur un changement de mois", () => {
    const multi = { date_start: "2026-09-28", date_end: "2026-09-30", heure_debut: null, heure_fin: null };
    expect(deplacer(multi, { jour: "2026-10-05", debut: 600 })).toEqual({
      date_intervention: "2026-10-05",
      date_fin: "2026-10-07",
      heure_debut: null,
      heure_fin: null,
    });
    // Le passage à l'heure d'hiver (25 oct.) ne fausse pas le décalage.
    const dst = { date_start: "2026-10-23", date_end: "2026-10-24", heure_debut: null, heure_fin: null };
    expect(deplacer(dst, { jour: "2026-10-26" }).date_fin).toBe("2026-10-27");
  });

  it("journée entière déposée sur la grille : reste sans heure", () => {
    const entiere = { ...rdv, heure_debut: null, heure_fin: null };
    expect(deplacer(entiere, { jour: "2026-09-17", debut: 600 })).toMatchObject({
      date_intervention: "2026-09-17",
      heure_debut: null,
      heure_fin: null,
    });
  });

  it("sans heure de fin : le début bouge, la fin reste vide ; heures saisies « HH:MM » normalisées", () => {
    const sansFin = { ...rdv, heure_debut: "09:00", heure_fin: null };
    expect(deplacer(sansFin, { jour: "2026-09-16", debut: 15 * 60 + 20 })).toEqual({
      date_intervention: "2026-09-16",
      date_fin: null,
      heure_debut: "15:15:00",
      heure_fin: null,
    });
  });

  it("borné : un créneau de 2 h glissé en bas de grille finit à 23:59 au plus tard", () => {
    expect(deplacer(rdv, { jour: "2026-09-16", debut: 23 * 60 })).toEqual({
      date_intervention: "2026-09-16",
      date_fin: null,
      heure_debut: "21:59:00",
      heure_fin: "23:59:00",
    });
    expect(deplacer(rdv, { jour: "2026-09-16", debut: -30 }).heure_debut).toBe("00:00:00");
  });
});

describe("aChange / valeursActuelles / libellé", () => {
  it("déposer au même endroit ne change rien", () => {
    expect(aChange(rdv, deplacer(rdv, { jour: "2026-09-16", debut: 9 * 60 + 5 }))).toBe(false);
    expect(aChange(rdv, deplacer(rdv, { jour: "2026-09-16", debut: 9 * 60 + 10 }))).toBe(true);
    expect(aChange(rdv, deplacer(rdv, { jour: "2026-09-17" }))).toBe(true);
  });

  it("valeurs actuelles au format base, prêtes pour « Annuler »", () => {
    expect(valeursActuelles({ ...rdv, date_end: "2026-09-17", heure_debut: "09:00", heure_fin: null })).toEqual({
      date_intervention: "2026-09-16",
      date_fin: "2026-09-17",
      heure_debut: "09:00:00",
      heure_fin: null,
    });
  });

  it("libellé lisible", () => {
    expect(
      libelleDeplacement(
        { date_intervention: "2026-09-18", date_fin: null, heure_debut: "14:15:00", heure_fin: "16:15:00" },
        "2026-09-16",
      ),
    ).toBe("Vendredi 18 sept. · 14:15–16:15");
    expect(
      libelleDeplacement(
        { date_intervention: "2026-09-17", date_fin: "2026-09-18", heure_debut: null, heure_fin: null },
        "2026-09-16",
      ),
    ).toBe("Demain → Vendredi 18 sept.");
  });
});

describe("minutesDeY (inverse de yDeMinutes)", () => {
  const lignes = dispositionGrille({
    debut: 7,
    fin: 20,
    occupees: new Set([9, 10]),
    hauteurPleine: 64,
    hauteurCompacte: 26,
    compacter: true,
    heureActuelle: null,
  });

  it("retrouve les minutes d'une position, lignes pleines et compactées", () => {
    for (const min of [7 * 60, 9 * 60 + 30, 10 * 60 + 45, 14 * 60 + 15, 19 * 60 + 59]) {
      expect(minutesDeY(lignes, yDeMinutes(lignes, min))).toBeCloseTo(min, 5);
    }
  });

  it("borné à la grille", () => {
    expect(minutesDeY(lignes, -10)).toBe(7 * 60);
    expect(minutesDeY(lignes, 100_000)).toBe(20 * 60);
    expect(minutesDeY([], 50)).toBe(7 * 60);
  });
});

describe("redimensionner (étirer par le bas)", () => {
  it("nouvelle fin arrondie au quart d'heure, dates et début intacts", () => {
    expect(redimensionner(rdv, 12 * 60 + 40)).toEqual({
      date_intervention: "2026-09-16",
      date_fin: null,
      heure_debut: "09:00:00",
      heure_fin: "12:45:00",
    });
  });

  it("jamais moins de 15 min, jamais après 23:59, rien sans heure de début", () => {
    expect(redimensionner(rdv, 8 * 60).heure_fin).toBe("09:15:00");
    expect(redimensionner(rdv, 9 * 60 + 5).heure_fin).toBe("09:15:00");
    expect(redimensionner(rdv, 25 * 60).heure_fin).toBe("23:59:00");
    const entiere = { ...rdv, heure_debut: null, heure_fin: null };
    expect(redimensionner(entiere, 600)).toEqual(valeursActuelles(entiere));
    expect(aChange(rdv, redimensionner(rdv, 11 * 60 + 3))).toBe(false);
  });
});
