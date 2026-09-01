import { describe, expect, it } from "vitest";

import { buildDevisDuplicata } from "./devis-prefill";
import type { Database } from "@/types/database";

type DevisRow = Database["public"]["Tables"]["devis"]["Row"];
type DevisLigneRow = Database["public"]["Tables"]["devis_lignes"]["Row"];

const source: DevisRow = {
  id: "dev-1",
  user_id: "user-1",
  numero: "DEV-2026-0042",
  client_id: "client-1",
  date_emission: "2026-03-15",
  date_validite: "2026-06-15",
  date_debut_travaux: "2026-04-01",
  date_signature: null,
  emetteur: null,
  acompte_pct: null,
  acompte_montant: null,
  signe_a_domicile: false,
  duree_estimee_jours: 3,
  est_modele: false,
  type_activite: "installation_clim",
  statut: "accepte",
  total_ht: 4500,
  conditions: "Acompte 30 % à la commande",
  notes: "Accès toiture par l'arrière",
  equipement_info: { marque: "Daikin", modele: "Perfera" },
  performances_energetiques: { seer: 8.5, classe_energetique: "A+++" },
  aides_financieres: { cee: 300 },
  facture_id: "fac-99",
  email_envoye_le: "2026-03-16T10:00:00Z",
  pdf_url: null,
  signature_client_url: null,
  created_at: "2026-03-15T09:00:00Z",
  updated_at: "2026-03-16T10:00:00Z",
};

const lignes: DevisLigneRow[] = [
  {
    id: "l-1",
    user_id: "user-1",
    devis_id: "dev-1",
    ordre: 0,
    designation: "Pose clim mono-split 2,5 kW",
    quantite: 1,
    prix_unitaire_ht: 3800,
    total_ht: 3800,
    nature_fiscale: "bic_prestations",
    type: "ligne",
    created_at: "2026-03-15T09:00:00Z",
  },
  {
    id: "l-2",
    user_id: "user-1",
    devis_id: "dev-1",
    ordre: 1,
    designation: "Liaison frigorifique (ml)",
    quantite: 7,
    prix_unitaire_ht: 100,
    total_ht: 700,
    nature_fiscale: "bic_ventes",
    type: "ligne",
    created_at: "2026-03-15T09:00:00Z",
  },
];

const now = new Date("2026-07-07T10:00:00Z");

describe("buildDevisDuplicata", () => {
  const copie = buildDevisDuplicata(source, lignes, now);

  it("vide le client (à choisir) et remet les dates à aujourd'hui", () => {
    expect(copie.devis.client_id).toBe("");
    expect(copie.devis.date_emission).toBe("2026-07-07");
    expect(copie.devis.date_validite).toBe("2026-10-05"); // +90 jours
    expect(copie.devis.date_debut_travaux).toBeNull();
  });

  it("recopie lignes (nature fiscale incluse), équipement, performances, aides et conditions", () => {
    expect(copie.lignes).toEqual([
      {
        designation: "Pose clim mono-split 2,5 kW",
        quantite: 1,
        prix_unitaire_ht: 3800,
        nature_fiscale: "bic_prestations",
    type: "ligne",
      },
      {
        designation: "Liaison frigorifique (ml)",
        quantite: 7,
        prix_unitaire_ht: 100,
        nature_fiscale: "bic_ventes",
    type: "ligne",
      },
    ]);
    expect(copie.devis.equipement_info).toEqual({
      marque: "Daikin",
      modele: "Perfera",
    });
    expect(copie.devis.performances_energetiques).toEqual({
      seer: 8.5,
      classe_energetique: "A+++",
    });
    expect(copie.devis.aides_financieres).toEqual({ cee: 300 });
    expect(copie.devis.conditions).toBe("Acompte 30 % à la commande");
    expect(copie.devis.duree_estimee_jours).toBe(3);
    expect(copie.devis.type_activite).toBe("installation_clim");
  });

  it("ne recopie ni numéro, ni statut, ni lien facture, ni envoi email", () => {
    expect(copie.devis.numero).toBeUndefined();
    expect(copie.devis.statut).toBeUndefined();
    expect(copie.devis.facture_id).toBeUndefined();
    expect(copie.devis.email_envoye_le).toBeUndefined();
    expect(copie.devis.id).toBeUndefined();
  });

  it("fonctionne avec un devis sans lignes", () => {
    expect(buildDevisDuplicata(source, [], now).lignes).toEqual([]);
  });
});
