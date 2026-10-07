/**
 * Passage d'un contrat d'entretien signé (table `contrats`) vers
 * l'échéancier interne des visites (table `contrats_maintenance`).
 *
 * Les deux tables sont distinctes : `contrats` est le document
 * juridique, `contrats_maintenance` porte les visites, les factures de
 * visite et les rappels. Un contrat mis en service doit y apparaître —
 * sinon sa visite annuelle n'est jamais programmée. Le lien est
 * `contrats.maintenance_id`.
 *
 * Sélection pure (aucun accès base) : l'action serveur insère la ligne
 * construite ici puis renseigne `maintenance_id`.
 */

import { netAPayer } from "./logic";
import type { EquipementContrat } from "./types";

export type ContratARattacher = {
  numero: string | null;
  client_id: string;
  equipements: unknown;
  redevance: number | string;
  remise: number | string;
  date_effet: string | null;
};

export type LigneEcheancier = {
  client_id: string;
  intitule: string;
  equipement: string | null;
  equipement_num_serie: string | null;
  date_debut: string;
  frequence: "annuelle";
  prix_annuel_ht: number;
  prochaine_visite: string;
  statut: "actif";
  notes: string;
};

function tronquer(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, max - 1)}…`;
}

function equipementsDe(valeur: unknown): EquipementContrat[] {
  return Array.isArray(valeur) ? (valeur as EquipementContrat[]) : [];
}

/**
 * Ligne d'échéancier d'un contrat actif. Le texte du contrat prévoit
 * une (1) visite par an (art. 2.1) : fréquence annuelle, prix annuel =
 * net à payer (redevance − remise). La première visite est due à la
 * date d'effet, ou aujourd'hui si celle-ci est déjà passée — le
 * contrat apparaît ainsi tout de suite dans « Visites à programmer ».
 */
export function ligneEcheancierDepuisContrat(
  contrat: ContratARattacher,
  aujourdhui: string,
): LigneEcheancier {
  const equipements = equipementsDe(contrat.equipements);
  const libelles = equipements
    .map((e) => [e.type, e.marque_modele].map((s) => (s ?? "").trim()).filter(Boolean).join(" "))
    .filter(Boolean);
  const numsSerie = equipements
    .map((e) => (e.num_serie ?? "").trim())
    .filter(Boolean);

  const dateDebut = contrat.date_effet ?? aujourdhui;
  const prochaine = dateDebut > aujourdhui ? dateDebut : aujourdhui;

  return {
    client_id: contrat.client_id,
    intitule: contrat.numero
      ? `Contrat d'entretien n° ${contrat.numero}`
      : "Contrat d'entretien",
    equipement: libelles.length ? tronquer(libelles.join(", "), 200) : null,
    equipement_num_serie: numsSerie.length
      ? tronquer(numsSerie.join(", "), 100)
      : null,
    date_debut: dateDebut,
    frequence: "annuelle",
    prix_annuel_ht: netAPayer(Number(contrat.redevance), Number(contrat.remise)),
    prochaine_visite: prochaine,
    statut: "actif",
    notes: "Créé automatiquement à la mise en service du contrat signé.",
  };
}
