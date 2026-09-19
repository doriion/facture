/**
 * Helpers PURS de pré-remplissage du formulaire de devis (duplication
 * d'un devis existant ou création depuis un modèle). Pas de "use
 * server", pas d'accès base — testable en isolation.
 *
 * La duplication ne crée RIEN en base : elle ouvre le formulaire de
 * nouveau devis pré-rempli. Le numéro de devis n'est consommé que
 * quand l'utilisateur valide — une duplication abandonnée ne laisse
 * aucune trace.
 */

import { dateValiditeDevis } from "@/lib/devis-validite";
import { aujourdhuiParis } from "@/lib/dates";
import type { Database } from "@/types/database";

type DevisRow = Database["public"]["Tables"]["devis"]["Row"];
type DevisLigneRow = Database["public"]["Tables"]["devis_lignes"]["Row"];

export type DevisPrefill = {
  devis: Partial<DevisRow>;
  lignes: Array<{
    designation: string;
    quantite: number;
    prix_unitaire_ht: number;
    nature_fiscale: string;
    type: string;
    /** Coût réel privé (TTC payé au fournisseur) — jamais côté client. */
    prix_achat_ttc_unitaire: number | null;
    fournisseur: string;
  }>;
};

export type OptionsDuplicata = {
  /** Réglage profil_entreprise.duree_validite_devis_jours (défaut 30). */
  dureeValiditeJours?: unknown;
  /** Injectable pour les tests. */
  now?: Date;
};

/**
 * Construit la copie de travail d'un devis source : reprise complète
 * des lignes (coûts privés inclus — ils restent invisibles du client),
 * de l'équipement, des performances énergétiques, des aides et des
 * conditions — mais SANS le client (à choisir) et avec les dates
 * remises à aujourd'hui. La validité suit le réglage du profil
 * (lib/devis-validite), comme pour un devis neuf.
 */
export function buildDevisDuplicata(
  source: DevisRow,
  lignes: DevisLigneRow[],
  options: OptionsDuplicata = {},
): DevisPrefill {
  const now = options.now ?? new Date();
  const today = aujourdhuiParis(now);
  const validite = dateValiditeDevis(today, options.dureeValiditeJours);

  return {
    devis: {
      client_id: "",
      type_activite: source.type_activite,
      date_emission: today,
      date_validite: validite,
      date_debut_travaux: null,
      duree_estimee_jours: source.duree_estimee_jours,
      conditions: source.conditions,
      mode_conclusion: source.mode_conclusion,
      adresse_chantier: source.adresse_chantier,
      signe_a_domicile: source.signe_a_domicile,
      notes: source.notes,
      equipement_info: source.equipement_info,
      performances_energetiques: source.performances_energetiques,
      aides_financieres: source.aides_financieres,
    },
    lignes: lignes.map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      nature_fiscale: l.nature_fiscale ?? "bic_prestations",
      type: l.type ?? "ligne",
      prix_achat_ttc_unitaire:
        l.prix_achat_ttc_unitaire === null ||
        l.prix_achat_ttc_unitaire === undefined
          ? null
          : Number(l.prix_achat_ttc_unitaire),
      fournisseur: l.fournisseur ?? "",
    })),
  };
}
