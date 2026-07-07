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

import type { Database } from "@/types/database";

type DevisRow = Database["public"]["Tables"]["devis"]["Row"];
type DevisLigneRow = Database["public"]["Tables"]["devis_lignes"]["Row"];

export type DevisPrefill = {
  devis: Partial<DevisRow>;
  lignes: Array<{
    designation: string;
    quantite: number;
    prix_unitaire_ht: number;
  }>;
};

/**
 * Construit la copie de travail d'un devis source : reprise complète
 * des lignes, de l'équipement, des performances énergétiques, des
 * aides et des conditions — mais SANS le client (à choisir) et avec
 * les dates remises à aujourd'hui (validité +90 jours), comme pour un
 * devis neuf.
 */
export function buildDevisDuplicata(
  source: DevisRow,
  lignes: DevisLigneRow[],
  now: Date = new Date(),
): DevisPrefill {
  const today = now.toISOString().slice(0, 10);
  const validite = new Date(now.getTime() + 90 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  return {
    devis: {
      client_id: "",
      type_activite: source.type_activite,
      date_emission: today,
      date_validite: validite,
      date_debut_travaux: null,
      duree_estimee_jours: source.duree_estimee_jours,
      conditions: source.conditions,
      notes: source.notes,
      equipement_info: source.equipement_info,
      performances_energetiques: source.performances_energetiques,
      aides_financieres: source.aides_financieres,
    },
    lignes: lignes.map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
    })),
  };
}
