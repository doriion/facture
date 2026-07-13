/**
 * Helpers PURS de pré-remplissage du formulaire de facture depuis une
 * intervention (pas de "use server", pas d'accès base — testable en
 * isolation).
 *
 * Le flux « Créer la facture » depuis une intervention ne crée RIEN en
 * base : il ouvre le formulaire de nouvelle facture pré-rempli. La
 * numérotation et la création n'ont lieu que quand l'utilisateur valide
 * le formulaire — même parcours qu'une facture saisie à la main.
 */

import type { Database } from "@/types/database";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import type { TypeActivite } from "@/lib/validations/facture";

type InterventionRow = Database["public"]["Tables"]["interventions"]["Row"];

export type LignePrefill = {
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
};

export type FacturePrefill = {
  client_id: string;
  type_activite: TypeActivite;
  date_prestation: string;
  date_prestation_fin: string;
  equipement_info: {
    marque?: string;
    modele?: string;
    num_serie?: string;
    fluide_frigo_type?: string;
  };
  lignes: LignePrefill[];
};

/**
 * Mappe le type d'intervention vers un type d'activité de facture.
 * Simple pré-sélection : l'utilisateur peut la changer dans le
 * formulaire. Une installation avec fluide frigorigène est
 * vraisemblablement une clim/PAC ; sans fluide on retombe sur la
 * plomberie (cœur de métier).
 */
export function mapInterventionTypeToActivite(
  type: string,
  fluideFrigoType: string | null,
): TypeActivite {
  switch (type) {
    case "entretien":
      return "entretien";
    case "depannage":
      return "depannage";
    case "installation":
      return fluideFrigoType ? "installation_clim" : "plomberie";
    default:
      return "autre";
  }
}

/**
 * Durée facturable en heures (arrondie au centième) :
 * - `duree_minutes` si renseignée ;
 * - sinon calculée depuis heure_debut/heure_fin pour une intervention
 *   d'une seule journée ;
 * - null si rien d'exploitable (la quantité de la ligne retombe à 1).
 */
export function computeHeuresFacturables(intervention: {
  duree_minutes: number | null;
  heure_debut: string | null;
  heure_fin: string | null;
  date_intervention: string;
  date_fin: string | null;
}): number | null {
  if (intervention.duree_minutes && intervention.duree_minutes > 0) {
    return Math.round((intervention.duree_minutes / 60) * 100) / 100;
  }

  const sameDay =
    !intervention.date_fin ||
    intervention.date_fin === intervention.date_intervention;
  if (sameDay && intervention.heure_debut && intervention.heure_fin) {
    const minutes =
      toMinutes(intervention.heure_fin) - toMinutes(intervention.heure_debut);
    if (minutes > 0) {
      return Math.round((minutes / 60) * 100) / 100;
    }
  }
  return null;
}

function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Construit le pré-remplissage complet du formulaire de facture depuis
 * une intervention : client, dates de prestation, type d'activité,
 * équipement, et une première ligne reprenant le descriptif (quantité
 * = heures passées si renseignées, prix unitaire à compléter).
 */
export function buildFacturePrefill(
  intervention: InterventionRow,
): FacturePrefill {
  const typeLabel =
    LABELS_TYPE_INTERVENTION[
      intervention.type as keyof typeof LABELS_TYPE_INTERVENTION
    ] ?? intervention.type;

  const equipementResume = [
    intervention.equipement_marque,
    intervention.equipement_modele,
  ]
    .filter(Boolean)
    .join(" ");

  const designation =
    intervention.description?.trim() ||
    (equipementResume ? `${typeLabel} — ${equipementResume}` : typeLabel);

  const heures = computeHeuresFacturables(intervention);

  const equipement_info: FacturePrefill["equipement_info"] = {};
  if (intervention.equipement_marque)
    equipement_info.marque = intervention.equipement_marque;
  if (intervention.equipement_modele)
    equipement_info.modele = intervention.equipement_modele;
  if (intervention.equipement_num_serie)
    equipement_info.num_serie = intervention.equipement_num_serie;
  if (intervention.fluide_frigo_type)
    equipement_info.fluide_frigo_type = intervention.fluide_frigo_type;

  return {
    client_id: intervention.client_id,
    type_activite: mapInterventionTypeToActivite(
      intervention.type,
      intervention.fluide_frigo_type,
    ),
    date_prestation: intervention.date_intervention,
    date_prestation_fin:
      intervention.date_fin && intervention.date_fin !== intervention.date_intervention
        ? intervention.date_fin
        : "",
    equipement_info,
    lignes: [
      {
        designation: heures ? `${designation} (${formatHeures(heures)})` : designation,
        quantite: heures ?? 1,
        prix_unitaire_ht: 0,
      },
    ],
  };
}

function formatHeures(heures: number): string {
  const rendered = Number.isInteger(heures)
    ? String(heures)
    : String(heures).replace(".", ",");
  return `${rendered} h`;
}
