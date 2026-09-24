import { describe, expect, it } from "vitest";

import { equipementsDepuisInterventions } from "./equipements-client";

describe("equipementsDepuisInterventions", () => {
  it("regroupe par numéro de série, sinon par marque + modèle, et compte les passages", () => {
    const eq = equipementsDepuisInterventions([
      { date_intervention: "2026-03-01", equipement_marque: "Daikin", equipement_modele: "Perfera", equipement_num_serie: "SN-1", fluide_frigo_type: "R32" },
      { date_intervention: "2026-09-01", equipement_marque: "daikin", equipement_modele: null, equipement_num_serie: "sn-1", fluide_frigo_type: null },
      { date_intervention: "2026-05-10", equipement_marque: "Atlantic", equipement_modele: "Chauffeo", equipement_num_serie: null },
      { date_intervention: "2026-06-10", equipement_marque: "atlantic", equipement_modele: "chauffeo", equipement_num_serie: null },
      { date_intervention: "2026-07-01", equipement_marque: null, equipement_modele: null, equipement_num_serie: null },
    ]);
    expect(eq).toHaveLength(2);
    expect(eq[0]).toMatchObject({ numSerie: "SN-1", marque: "Daikin", modele: "Perfera", fluide: "R32", nbInterventions: 2, derniereIntervention: "2026-09-01" });
    expect(eq[1]).toMatchObject({ marque: "Atlantic", modele: "Chauffeo", numSerie: null, nbInterventions: 2, derniereIntervention: "2026-06-10" });
  });

  it("renvoie une liste vide sans équipement", () => {
    expect(equipementsDepuisInterventions([])).toEqual([]);
  });
});
