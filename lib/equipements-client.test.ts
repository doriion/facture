import { describe, expect, it } from "vitest";

import { carnetEquipements, equipementsDepuisInterventions } from "./equipements-client";

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

describe("carnetEquipements", () => {
  it("rattache chaque passage à son matériel, cumule les fluides, ignore les interventions sans matériel", () => {
    const carnet = carnetEquipements([
      { id: "a", date_intervention: "2026-03-01", type: "entretien", description: null, equipement_marque: "Daikin", equipement_modele: "FTXM", equipement_num_serie: "S1", fluide_frigo_type: "R32", fluide_frigo_kg_ajoute: 0.25, fluide_frigo_kg_recupere: null },
      { id: "b", date_intervention: "2026-09-01", type: "depannage", description: "Fuite", equipement_marque: "daikin", equipement_modele: null, equipement_num_serie: "s1", fluide_frigo_type: null, fluide_frigo_kg_ajoute: 0.5, fluide_frigo_kg_recupere: 0.1 },
      { id: "c", date_intervention: "2026-05-01", type: "plomberie", description: null, equipement_marque: null, equipement_modele: null, equipement_num_serie: null, fluide_frigo_type: null },
    ]);
    expect(carnet).toHaveLength(1);
    expect(carnet[0]!.interventions.map((i) => i.id)).toEqual(["b", "a"]);
    expect(carnet[0]).toMatchObject({ numSerie: "S1", kgAjoute: 0.75, kgRecupere: 0.1, nbInterventions: 2 });
  });
});
