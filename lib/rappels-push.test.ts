import { describe, expect, it } from "vitest";

import {
  contenuRappel,
  instantParis,
  instantRappel,
  joursACharger,
  rappelsDus,
} from "./rappels-push";

const base = {
  id: "i1",
  date_intervention: "2026-09-17",
  heure_debut: "09:00:00",
  heure_fin: "11:00:00",
  description: "Entretien PAC",
  type: "entretien",
  client_nom: "BALDET Maurice",
  client_adresse: "580 chemin de la Croix verte, 38330 Biviers",
};

describe("instantParis", () => {
  it("heure d'été (UTC+2) et heure d'hiver (UTC+1)", () => {
    expect(new Date(instantParis("2026-09-17", 9, 0)).toISOString()).toBe("2026-09-17T07:00:00.000Z");
    expect(new Date(instantParis("2026-12-17", 9, 0)).toISOString()).toBe("2026-12-17T08:00:00.000Z");
  });

  it("jour du passage à l'heure d'hiver (25 oct. 2026) : 9 h Paris = 8 h UTC", () => {
    expect(new Date(instantParis("2026-10-25", 9, 0)).toISOString()).toBe("2026-10-25T08:00:00.000Z");
    expect(new Date(instantParis("2026-10-25", 1, 30)).toISOString()).toBe("2026-10-24T23:30:00.000Z");
  });
});

describe("instantRappel", () => {
  it("30 min avant l'heure de début", () => {
    expect(new Date(instantRappel(base, 30)).toISOString()).toBe("2026-09-17T06:30:00.000Z");
    expect(new Date(instantRappel(base, 120)).toISOString()).toBe("2026-09-17T05:00:00.000Z");
  });

  it("journée entière : la veille à 18 h (Paris)", () => {
    expect(new Date(instantRappel({ ...base, heure_debut: null }, 30)).toISOString()).toBe("2026-09-16T16:00:00.000Z");
  });
});

describe("rappelsDus", () => {
  const t = (iso: string) => new Date(iso).getTime();

  it("dû quand l'instant est passé depuis moins de la grâce, pas avant, pas trop tard, jamais deux fois", () => {
    expect(rappelsDus([base], t("2026-09-17T06:29:00Z"), 30)).toEqual([]);
    expect(rappelsDus([base], t("2026-09-17T06:30:00Z"), 30)).toEqual([base]);
    expect(rappelsDus([base], t("2026-09-17T06:34:00Z"), 30)).toEqual([base]);
    expect(rappelsDus([base], t("2026-09-17T06:59:59Z"), 30)).toEqual([base]);
    expect(rappelsDus([base], t("2026-09-17T07:00:00Z"), 30)).toEqual([]);
    expect(rappelsDus([{ ...base, rappel_push_envoye_le: "2026-09-17T06:31:00Z" }], t("2026-09-17T06:34:00Z"), 30)).toEqual([]);
  });

  it("mélange horodatés et journée entière", () => {
    const entiere = { ...base, id: "i2", date_intervention: "2026-09-18", heure_debut: null, heure_fin: null };
    expect(rappelsDus([base, entiere], t("2026-09-17T16:05:00Z"), 30).map((i) => i.id)).toEqual(["i2"]);
  });
});

describe("joursACharger", () => {
  it("aujourd'hui et demain en heure de Paris (même après minuit Paris, avant minuit UTC)", () => {
    expect(joursACharger(new Date("2026-09-17T22:30:00Z").getTime())).toEqual({ depuis: "2026-09-18", jusquau: "2026-09-19" });
    expect(joursACharger(new Date("2026-09-17T10:00:00Z").getTime())).toEqual({ depuis: "2026-09-17", jusquau: "2026-09-18" });
  });
});

describe("contenuRappel", () => {
  it("titre client, corps avec délai, heures et adresse, lien vers le jour", () => {
    expect(contenuRappel(base, 30)).toEqual({
      titre: "Entretien PAC · BALDET Maurice",
      corps: "Dans 30 min · 09:00–11:00\n580 chemin de la Croix verte, 38330 Biviers",
      url: "/agenda?vue=jour&date=2026-09-17",
      tag: "rdv-i1",
    });
    expect(contenuRappel({ ...base, client_nom: null, client_adresse: null, heure_fin: null }, 60).corps).toBe("Dans 1 h · 09:00");
    expect(contenuRappel({ ...base, heure_debut: null }, 30).corps).toMatch(/^Demain, journée entière/);
    expect(contenuRappel({ ...base, description: null }, 90).titre).toBe("entretien · BALDET Maurice");
    expect(contenuRappel(base, 90).corps).toMatch(/^Dans 1 h 30/);
  });
});
