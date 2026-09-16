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
});
