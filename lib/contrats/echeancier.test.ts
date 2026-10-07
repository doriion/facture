import { describe, expect, it } from "vitest";

import {
  ligneEcheancierDepuisContrat,
  type ContratARattacher,
} from "./echeancier";

const TODAY = "2026-10-07";

function contrat(over: Partial<ContratARattacher> = {}): ContratARattacher {
  return {
    numero: "2026-004",
    client_id: "client-1",
    equipements: [
      {
        type: "PAC air/eau",
        marque_modele: "Daikin Altherma",
        num_serie: "SN123",
        puissance_kw: "8",
        fluide_charge: "R32",
      },
    ],
    redevance: 180,
    remise: 20,
    date_effet: "2026-11-01",
    ...over,
  };
}

describe("ligneEcheancierDepuisContrat", () => {
  it("reprend client, équipement, numéro et prix net annuel", () => {
    const l = ligneEcheancierDepuisContrat(contrat(), TODAY);
    expect(l).toMatchObject({
      client_id: "client-1",
      intitule: "Contrat d'entretien n° 2026-004",
      equipement: "PAC air/eau Daikin Altherma",
      equipement_num_serie: "SN123",
      frequence: "annuelle",
      prix_annuel_ht: 160,
      statut: "actif",
      date_debut: "2026-11-01",
      prochaine_visite: "2026-11-01",
    });
  });

  it("date d'effet passée : la visite est à programmer dès aujourd'hui", () => {
    const l = ligneEcheancierDepuisContrat(contrat({ date_effet: "2025-03-01" }), TODAY);
    expect(l.date_debut).toBe("2025-03-01");
    expect(l.prochaine_visite).toBe(TODAY);
  });

  it("sans date d'effet ni équipement ni numéro", () => {
    const l = ligneEcheancierDepuisContrat(
      contrat({ date_effet: null, equipements: null, numero: null }),
      TODAY,
    );
    expect(l.date_debut).toBe(TODAY);
    expect(l.prochaine_visite).toBe(TODAY);
    expect(l.equipement).toBeNull();
    expect(l.equipement_num_serie).toBeNull();
    expect(l.intitule).toBe("Contrat d'entretien");
  });

  it("plusieurs équipements joints, remise supérieure à la redevance plafonnée à 0", () => {
    const l = ligneEcheancierDepuisContrat(
      contrat({
        equipements: [
          { type: "Clim", marque_modele: "", num_serie: "A1", puissance_kw: "", fluide_charge: "" },
          { type: "PAC", marque_modele: "Atlantic", num_serie: "", puissance_kw: "", fluide_charge: "" },
        ],
        redevance: 50,
        remise: 80,
      }),
      TODAY,
    );
    expect(l.equipement).toBe("Clim, PAC Atlantic");
    expect(l.equipement_num_serie).toBe("A1");
    expect(l.prix_annuel_ht).toBe(0);
  });
});
