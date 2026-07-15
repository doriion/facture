import { describe, expect, it } from "vitest";

import {
  buildCerfaData,
  naturesParDefaut,
  type CerfaOptions,
} from "./cerfa";
import type { Database } from "@/types/database";

type Intervention = Database["public"]["Tables"]["interventions"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

function intervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: "abcdef12-0000-0000-0000-000000000000",
    user_id: "user-1",
    client_id: "client-1",
    date_intervention: "2026-07-10",
    date_fin: null,
    heure_debut: null,
    heure_fin: null,
    type: "entretien",
    description: "Entretien annuel PAC",
    equipement_marque: "Daikin",
    equipement_modele: "Altherma 3",
    equipement_num_serie: "SN-4242",
    fluide_frigo_type: "R32",
    fluide_frigo_kg_ajoute: 0.5,
    fluide_frigo_kg_recupere: null,
    fluide_charge_totale_kg: 2.4,
    etancheite_controle: true,
    etancheite_detecteur: "Inficon D-TEK SN 987",
    etancheite_detecteur_controle_le: "2026-01-15",
    etancheite_fuite: false,
    etancheite_fuite_localisation: null,
    fluide_observations: "RAS",
    duree_minutes: null,
    facture_id: null,
    notes: null,
    created_at: "2026-07-10T08:00:00Z",
    updated_at: "2026-07-10T08:00:00Z",
    ...overrides,
  };
}

const client = {
  id: "client-1",
  nom: "SARL Les Oliviers",
  siret: "12345678901234",
  adresse_ligne1: "4 rue des Fleurs",
  adresse_ligne2: null,
  code_postal: "34000",
  ville: "Montpellier",
} as unknown as Client;

const profil = {
  prenom: "Nathan",
  nom: "Geneve",
  nom_commercial: null,
  siret: "98765432109876",
  num_attestation_fluides_frigo: "AC-2025-1234",
  adresse_ligne1: "12 avenue du Chantier",
  adresse_ligne2: null,
  code_postal: "34070",
  ville: "Montpellier",
} as unknown as Profil;

const baseOptions: CerfaOptions = {
  natures: ["maintenance", "controle_periodique"],
  systemePermanentDetection: false,
};

describe("naturesParDefaut", () => {
  it("mappe le type d'intervention vers les cases du cadre 4", () => {
    expect(
      naturesParDefaut({ type: "installation", etancheite_controle: null }),
    ).toEqual(["assemblage", "mise_en_service"]);
    expect(
      naturesParDefaut({ type: "entretien", etancheite_controle: null }),
    ).toEqual(["maintenance"]);
    expect(
      naturesParDefaut({ type: "depannage", etancheite_controle: null }),
    ).toEqual(["maintenance"]);
    expect(
      naturesParDefaut({ type: "autre", etancheite_controle: null }),
    ).toEqual([]);
  });

  it("ajoute le contrôle d'étanchéité si effectué", () => {
    expect(
      naturesParDefaut({ type: "entretien", etancheite_controle: true }),
    ).toEqual(["maintenance", "controle_periodique"]);
  });
});

describe("buildCerfaData", () => {
  const data = buildCerfaData(intervention(), client, profil, baseOptions);

  it("remplit l'opérateur depuis le profil (attestation de capacité)", () => {
    expect(data.operateur.nom).toBe("Nathan Geneve");
    expect(data.operateur.attestationCapacite).toBe("AC-2025-1234");
    expect(data.operateur.siret).toBe("98765432109876");
    expect(data.operateur.adresse).toBe(
      "12 avenue du Chantier, 34070 Montpellier",
    );
  });

  it("remplit le détenteur depuis le client", () => {
    expect(data.detenteur.nom).toBe("SARL Les Oliviers");
    expect(data.detenteur.adresse).toBe("4 rue des Fleurs, 34000 Montpellier");
  });

  it("calcule PRG et t éq. CO2 de la charge (cadre 3)", () => {
    expect(data.equipement.fluide).toBe("R32");
    expect(data.equipement.prg).toBe(675);
    // 2,4 kg × 675 / 1000 = 1,62 t
    expect(data.equipement.chargeTeqCo2).toBe(1.62);
    expect(data.equipement.marqueModele).toBe("Daikin Altherma 3");
  });

  it("ventile les quantités : chargé vierge par défaut = kg ajoutés", () => {
    expect(data.quantites.chargeViergeKg).toBe(0.5);
    expect(data.quantites.totalChargeKg).toBe(0.5);
    expect(data.quantites.recupereTraitementKg).toBe(0);
    expect(data.quantites.totalRecupereKg).toBe(0);
  });

  it("respecte la ventilation explicite des options et totalise", () => {
    const d = buildCerfaData(intervention(), client, profil, {
      ...baseOptions,
      chargeViergeKg: 1,
      chargeRecycleKg: 0.25,
      chargeRegenereKg: 0.25,
      recupereTraitementKg: 1.2,
      recupereReutilisationKg: 0.3,
    });
    expect(d.quantites.totalChargeKg).toBe(1.5);
    expect(d.quantites.totalRecupereKg).toBe(1.5);
  });

  it("reprend le contrôle d'étanchéité (détecteur, fuite)", () => {
    expect(data.detecteur).toEqual({
      identification: "Inficon D-TEK SN 987",
      dernierControle: "2026-01-15",
    });
    expect(data.fuite.constatee).toBe(false);
  });

  it("détecteur absent si pas de contrôle effectué", () => {
    const d = buildCerfaData(
      intervention({ etancheite_controle: false }),
      client,
      profil,
      baseOptions,
    );
    expect(d.detecteur).toBeNull();
    expect(d.fuite.constatee).toBeNull();
  });

  it("périodicité en t éq. CO2 (art. 5 du 2024/573) — cadres 8-9", () => {
    // Fixture : R32 2,4 kg → 1,62 t éq. CO2 < 5 t → NON SOUMIS
    expect(data.periodiciteMois).toBeNull();
    expect(data.periodiciteLabel).toContain("Non soumis");

    // Chambre froide R404A 25 kg → 98 t éq. CO2 → contrôle SEMESTRIEL
    const chambreFroide = buildCerfaData(
      intervention({ fluide_frigo_type: "R404A", fluide_charge_totale_kg: 25 }),
      client,
      profil,
      baseOptions,
    );
    expect(chambreFroide.periodiciteMois).toBe(6);
    expect(chambreFroide.periodiciteLabel).toBe("Tous les 6 mois");

    // R22 : seuils en kg (règlement SAO 2024/590)
    const r22 = buildCerfaData(
      intervention({ fluide_frigo_type: "R22", fluide_charge_totale_kg: 25 }),
      client,
      profil,
      baseOptions,
    );
    expect(r22.periodiciteMois).toBe(12);

    const avecSysteme = buildCerfaData(intervention(), client, profil, {
      ...baseOptions,
      systemePermanentDetection: true,
    });
    expect(avecSysteme.periodiciteMois).toBeNull();
    expect(avecSysteme.periodiciteLabel).toContain("système permanent");
  });

  it("charge totale non renseignée → « non déterminable », jamais « non soumis »", () => {
    const sansCharge = buildCerfaData(
      intervention({ fluide_charge_totale_kg: null }),
      client,
      profil,
      baseOptions,
    );
    expect(sansCharge.periodiciteMois).toBeNull();
    expect(sansCharge.periodiciteLabel).toContain("non renseignée");
    expect(sansCharge.periodiciteLabel).not.toContain("Non soumis");
  });

  it("numéro de fiche généré par défaut, ou repris des options", () => {
    expect(data.ficheNumero).toBe("FI-2026-07-10-ABCDEF");
    const custom = buildCerfaData(intervention(), client, profil, {
      ...baseOptions,
      ficheNumero: "FI-2026-042",
    });
    expect(custom.ficheNumero).toBe("FI-2026-042");
  });

  it("cadres déchets absents si aucune donnée déchets", () => {
    expect(data.dechets).toBeNull();
    const avec = buildCerfaData(intervention(), client, profil, {
      ...baseOptions,
      dechets: { numeroBsff: "BSFF-123", destinationNom: "Collecteur X" },
    });
    expect(avec.dechets?.numeroBsff).toBe("BSFF-123");
  });

  it("tolère client et profil absents (tirets)", () => {
    const d = buildCerfaData(intervention(), null, null, baseOptions);
    expect(d.operateur.nom).toBe("—");
    expect(d.operateur.attestationCapacite).toBe("—");
    expect(d.detenteur.nom).toBe("—");
  });
});
