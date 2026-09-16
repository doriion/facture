import { describe, expect, it } from "vitest";

import { interventionSchema, type InterventionFormInput } from "./intervention";

/** Saisie minimale du dialogue rapide (agenda). */
function saisie(overrides: Partial<InterventionFormInput> = {}): InterventionFormInput {
  return {
    client_id: "",
    date_intervention: "2026-09-18",
    date_fin: "",
    heure_debut: "",
    heure_fin: "",
    type: "installation",
    description: "",
    equipement_marque: "",
    equipement_modele: "",
    equipement_num_serie: "",
    fluide_frigo_type: "",
    fluide_frigo_kg_ajoute: null,
    fluide_frigo_kg_recupere: null,
    fluide_charge_totale_kg: null,
    duree_minutes: null,
    facture_id: null,
    notes: "",
    ...overrides,
  };
}

const CLIENT = "2f1a6b7e-3c4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("interventionSchema — créneau pré-rempli depuis la grille", () => {
  it("accepte 14:00–15:00 (clic sur la ligne 14 h)", () => {
    const r = interventionSchema.safeParse(
      saisie({ client_id: CLIENT, heure_debut: "14:00", heure_fin: "15:00" }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.heure_debut).toBe("14:00");
      expect(r.data.heure_fin).toBe("15:00");
    }
  });

  it("accepte une plage glissée 14:00–16:00 et refuse une fin avant le début", () => {
    expect(
      interventionSchema.safeParse(saisie({ heure_debut: "14:00", heure_fin: "16:00" })).success,
    ).toBe(true);
    const r = interventionSchema.safeParse(saisie({ heure_debut: "14:00", heure_fin: "13:00" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["heure_fin"]);
  });
});

describe("interventionSchema — client optionnel", () => {
  it("création sans client : accepté, client vide", () => {
    const r = interventionSchema.safeParse(saisie());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.client_id || null).toBeNull();
  });

  it("null (édition rapide d'une intervention sans client) est accepté aussi", () => {
    const r = interventionSchema.safeParse(saisie({ client_id: null }));
    expect(r.success).toBe(true);
  });

  it("ajout du client après coup : l'identifiant est conservé", () => {
    const r = interventionSchema.safeParse(saisie({ client_id: CLIENT }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.client_id).toBe(CLIENT);
  });

  it("un identifiant qui n'est pas un UUID est refusé (pas de client fantôme)", () => {
    const r = interventionSchema.safeParse(saisie({ client_id: "martin" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["client_id"]);
  });

  it("la date reste obligatoire", () => {
    expect(interventionSchema.safeParse(saisie({ date_intervention: "" })).success).toBe(false);
  });
});
