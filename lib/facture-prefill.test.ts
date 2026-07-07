import { describe, expect, it } from "vitest";

import {
  buildFacturePrefill,
  computeHeuresFacturables,
  mapInterventionTypeToActivite,
} from "./facture-prefill";
import type { Database } from "@/types/database";

type InterventionRow = Database["public"]["Tables"]["interventions"]["Row"];

function intervention(
  overrides: Partial<InterventionRow> = {},
): InterventionRow {
  return {
    id: "int-1",
    user_id: "user-1",
    client_id: "client-1",
    date_intervention: "2026-07-01",
    date_fin: null,
    heure_debut: null,
    heure_fin: null,
    type: "depannage",
    description: "Remplacement groupe de sécurité chauffe-eau",
    equipement_marque: null,
    equipement_modele: null,
    equipement_num_serie: null,
    fluide_frigo_type: null,
    fluide_frigo_kg_ajoute: null,
    fluide_frigo_kg_recupere: null,
    duree_minutes: null,
    facture_id: null,
    notes: null,
    created_at: "2026-07-01T08:00:00Z",
    updated_at: "2026-07-01T08:00:00Z",
    ...overrides,
  };
}

describe("mapInterventionTypeToActivite", () => {
  it("mappe entretien et dépannage à l'identique", () => {
    expect(mapInterventionTypeToActivite("entretien", null)).toBe("entretien");
    expect(mapInterventionTypeToActivite("depannage", null)).toBe("depannage");
  });

  it("mappe une installation avec fluide vers installation_clim", () => {
    expect(mapInterventionTypeToActivite("installation", "R32")).toBe(
      "installation_clim",
    );
  });

  it("mappe une installation sans fluide vers plomberie", () => {
    expect(mapInterventionTypeToActivite("installation", null)).toBe(
      "plomberie",
    );
  });

  it("retombe sur autre pour les types inconnus", () => {
    expect(mapInterventionTypeToActivite("autre", null)).toBe("autre");
    expect(mapInterventionTypeToActivite("inconnu", null)).toBe("autre");
  });
});

describe("computeHeuresFacturables", () => {
  it("privilégie duree_minutes (arrondi 2 décimales)", () => {
    expect(
      computeHeuresFacturables(
        intervention({ duree_minutes: 90, heure_debut: "08:00:00", heure_fin: "18:00:00" }),
      ),
    ).toBe(1.5);
    expect(computeHeuresFacturables(intervention({ duree_minutes: 100 }))).toBe(
      1.67,
    );
  });

  it("calcule depuis heure_debut/heure_fin sur une journée", () => {
    expect(
      computeHeuresFacturables(
        intervention({ heure_debut: "08:30:00", heure_fin: "12:00:00" }),
      ),
    ).toBe(3.5);
  });

  it("ignore les heures sur une intervention multi-jours", () => {
    expect(
      computeHeuresFacturables(
        intervention({
          date_fin: "2026-07-03",
          heure_debut: "08:00:00",
          heure_fin: "17:00:00",
        }),
      ),
    ).toBeNull();
  });

  it("renvoie null sans durée exploitable (ou incohérente)", () => {
    expect(computeHeuresFacturables(intervention())).toBeNull();
    expect(
      computeHeuresFacturables(
        intervention({ heure_debut: "14:00:00", heure_fin: "10:00:00" }),
      ),
    ).toBeNull();
  });
});

describe("buildFacturePrefill", () => {
  it("reprend client, dates de prestation et descriptif", () => {
    const p = buildFacturePrefill(
      intervention({ date_fin: "2026-07-02" }),
    );
    expect(p.client_id).toBe("client-1");
    expect(p.date_prestation).toBe("2026-07-01");
    expect(p.date_prestation_fin).toBe("2026-07-02");
    expect(p.lignes).toHaveLength(1);
    expect(p.lignes[0]).toEqual({
      designation: "Remplacement groupe de sécurité chauffe-eau",
      quantite: 1,
      prix_unitaire_ht: 0,
    });
  });

  it("laisse la date de fin vide pour une intervention d'un jour", () => {
    expect(buildFacturePrefill(intervention()).date_prestation_fin).toBe("");
    expect(
      buildFacturePrefill(intervention({ date_fin: "2026-07-01" }))
        .date_prestation_fin,
    ).toBe("");
  });

  it("met les heures en quantité et les mentionne dans la désignation", () => {
    const p = buildFacturePrefill(intervention({ duree_minutes: 150 }));
    expect(p.lignes[0]!.quantite).toBe(2.5);
    expect(p.lignes[0]!.designation).toContain("(2,5 h)");
    expect(p.lignes[0]!.prix_unitaire_ht).toBe(0);
  });

  it("compose une désignation de repli type + équipement sans descriptif", () => {
    const p = buildFacturePrefill(
      intervention({
        description: null,
        type: "installation",
        equipement_marque: "Daikin",
        equipement_modele: "Altherma 3",
      }),
    );
    expect(p.lignes[0]!.designation).toBe("Installation — Daikin Altherma 3");
  });

  it("reprend l'équipement et adapte le type d'activité", () => {
    const p = buildFacturePrefill(
      intervention({
        type: "installation",
        equipement_marque: "Daikin",
        equipement_num_serie: "SN-123",
        fluide_frigo_type: "R32",
      }),
    );
    expect(p.type_activite).toBe("installation_clim");
    expect(p.equipement_info).toEqual({
      marque: "Daikin",
      num_serie: "SN-123",
      fluide_frigo_type: "R32",
    });
  });
});
