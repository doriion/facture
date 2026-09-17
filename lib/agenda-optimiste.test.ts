import { describe, expect, it } from "vitest";

import type { AgendaEvent } from "@/lib/actions/agenda";
import { appliquerChangement } from "./agenda-optimiste";

const existant: AgendaEvent = {
  id: "i1",
  kind: "intervention",
  date_start: "2026-09-16",
  date_end: "2026-09-16",
  title: "Entretien PAC",
  description: "Entretien PAC",
  client_nom: "BALDET Maurice",
  client_id: "c1",
  href: "/interventions/i1",
  heure_debut: "09:00:00",
  heure_fin: "11:00:00",
  facture_emise: false,
  a_facturer: true,
  type_activite: "entretien",
  client_adresse: "580 chemin de la Croix verte",
  client_telephone: "06 64 19 18 15",
};
const facture: AgendaEvent = {
  id: "f1", kind: "facture_prestation", date_start: "2026-09-15", date_end: "2026-09-15", title: "Facture", description: null, client_nom: null, client_id: null, href: "#", heure_debut: null, heure_fin: null,
};

describe("appliquerChangement", () => {
  it("création : le rendez-vous apparaît tout de suite avec les valeurs saisies (heures au format base)", () => {
    const res = appliquerChangement([facture], {
      type: "creation",
      id: "tmp-1",
      valeurs: { client_id: "", date_intervention: "2026-09-18", heure_debut: "14:00", heure_fin: "16:00", type: "depannage", description: "Fuite" },
      clientNom: null,
    });
    expect(res).toHaveLength(2);
    const e = res[1]!;
    expect(e).toMatchObject({
      id: "tmp-1", kind: "intervention", date_start: "2026-09-18", date_end: "2026-09-18", title: "Fuite",
      client_id: null, client_nom: null, heure_debut: "14:00:00", heure_fin: "16:00:00", facture_emise: false, a_facturer: true, type_activite: "depannage",
    });
  });

  it("édition : conserve ce que le formulaire ne gère pas (facturée, coordonnées) sauf si le client change", () => {
    const meme = appliquerChangement([existant], {
      type: "edition", id: "i1",
      valeurs: { client_id: "c1", date_intervention: "2026-09-17", heure_debut: "10:00", heure_fin: "", type: "entretien", description: "Entretien PAC + filtres", a_facturer: false },
      clientNom: "BALDET Maurice",
    })[0]!;
    expect(meme).toMatchObject({ date_start: "2026-09-17", heure_debut: "10:00:00", heure_fin: null, title: "Entretien PAC + filtres", a_facturer: false, client_adresse: "580 chemin de la Croix verte" });

    const autre = appliquerChangement([existant], {
      type: "edition", id: "i1",
      valeurs: { client_id: "c2", date_intervention: "2026-09-16", type: "entretien" },
      clientNom: "DURAND",
    })[0]!;
    expect(autre.client_nom).toBe("DURAND");
    expect(autre.client_adresse).toBeNull();
    expect(autre.client_telephone).toBeNull();
  });

  it("suppression et bascule « rien à facturer » ne touchent que l'intervention visée", () => {
    expect(appliquerChangement([existant, facture], { type: "suppression", id: "i1" })).toEqual([facture]);
    const res = appliquerChangement([existant, facture], { type: "facturation", id: "i1", a_facturer: false });
    expect(res[0]!.a_facturer).toBe(false);
    expect(res[1]).toBe(facture);
  });

  it("déplacement : dates et heures remplacées, le reste conservé", () => {
    const res = appliquerChangement([existant, facture], {
      type: "deplacement",
      id: "i1",
      valeurs: { date_intervention: "2026-09-18", date_fin: "2026-09-19", heure_debut: "14:00:00", heure_fin: "16:00:00" },
    });
    expect(res[0]).toMatchObject({
      date_start: "2026-09-18", date_end: "2026-09-19", heure_debut: "14:00:00", heure_fin: "16:00:00",
      client_nom: "BALDET Maurice", client_adresse: "580 chemin de la Croix verte", a_facturer: true,
    });
    expect(res[1]).toBe(facture);
    const sansFin = appliquerChangement([existant], {
      type: "deplacement", id: "i1",
      valeurs: { date_intervention: "2026-09-20", date_fin: null, heure_debut: null, heure_fin: null },
    })[0]!;
    expect(sansFin).toMatchObject({ date_start: "2026-09-20", date_end: "2026-09-20", heure_debut: null, heure_fin: null });
  });

  it("série : une occurrence par date, durée en jours conservée, règle attachée", () => {
    const res = appliquerChangement([facture], {
      type: "creation_serie",
      prefixe: "tmp-9",
      dates: ["2026-09-16", "2026-09-23"],
      valeurs: { client_id: "c1", date_intervention: "2026-09-16", date_fin: "2026-09-17", type: "entretien", heure_debut: "09:00" },
      clientNom: "BALDET Maurice",
      recurrence: { frequence: "hebdomadaire", intervalle: 1, date_fin: "2026-09-23" },
    });
    expect(res).toHaveLength(3);
    expect(res[1]).toMatchObject({ id: "tmp-9-0", date_start: "2026-09-16", date_end: "2026-09-17", serie_id: "tmp-9", heure_debut: "09:00:00" });
    expect(res[2]).toMatchObject({ id: "tmp-9-1", date_start: "2026-09-23", date_end: "2026-09-24", recurrence: { frequence: "hebdomadaire" } });
  });

  it("« et les suivants » : les occurrences suivantes de la série suivent, les facturées et les antérieures non", () => {
    const occ = (id: string, date: string, extra: Partial<AgendaEvent> = {}): AgendaEvent => ({
      ...existant, id, date_start: date, date_end: date, serie_id: "s1", ...extra,
    });
    const events = [occ("a", "2026-09-09"), occ("b", "2026-09-16"), occ("c", "2026-09-23", { facture_emise: true }), occ("d", "2026-09-30"), facture];
    const res = appliquerChangement(events, {
      type: "edition_suivantes",
      id: "b",
      serie_id: "s1",
      depuis: "2026-09-16",
      valeurs: { client_id: "c1", date_intervention: "2026-09-17", type: "entretien", description: "Filtres", heure_debut: "10:00", heure_fin: "11:00" },
      clientNom: "BALDET Maurice",
    });
    expect(res[0]).toMatchObject({ id: "a", date_start: "2026-09-09", title: "Entretien PAC" });
    expect(res[1]).toMatchObject({ id: "b", date_start: "2026-09-17", title: "Filtres", heure_debut: "10:00:00" });
    expect(res[2]).toMatchObject({ id: "c", date_start: "2026-09-23", title: "Entretien PAC" });
    expect(res[3]).toMatchObject({ id: "d", date_start: "2026-10-01", title: "Filtres" });
    expect(res[4]).toBe(facture);

    const restants = appliquerChangement(events, { type: "suppression_suivantes", serie_id: "s1", depuis: "2026-09-16" });
    expect(restants.map((e) => e.id)).toEqual(["a", "c", "f1"]);
  });
});
