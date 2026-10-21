/**
 * Suivi des visites d'entretien — sélection PURE, testée dans
 * visites-suivi.test.ts :
 * - propositions sans réponse à relancer (une seule relance, après
 *   `delaiRelanceJours`, tant que le lien est utilisable) ;
 * - propositions toujours sans réponse après `delaiAlerteJours` : on
 *   prévient l'artisan (une seule fois) pour qu'il appelle ;
 * - visites confirmées qui ont lieu demain : rappel au client (une
 *   seule fois par date).
 */

import { ajouterJours } from "@/lib/agenda-vues";
import { etatProposition } from "@/lib/creneaux-visite";

export type PropositionSuivie = {
  id: string;
  statut: string;
  envoyee_le: string;
  expire_le: string;
  date_proposee: string;
  relance_le: string | null;
  artisan_prevenu_le: string | null;
};

export type OptionsSuivi = {
  today: string;
  nowIso: string;
  delaiRelanceJours?: number;
  delaiAlerteJours?: number;
};

function envoyeeDepuisJours(p: PropositionSuivie, today: string, jours: number): boolean {
  return p.envoyee_le.slice(0, 10) <= ajouterJours(today, -jours);
}

export function propositionsARelancer<T extends PropositionSuivie>(
  propositions: T[],
  { today, nowIso, delaiRelanceJours = 7 }: OptionsSuivi,
): T[] {
  return propositions.filter(
    (p) =>
      p.relance_le === null &&
      etatProposition(p, nowIso, today) === "utilisable" &&
      envoyeeDepuisJours(p, today, delaiRelanceJours),
  );
}

export function propositionsSansReponse<T extends PropositionSuivie>(
  propositions: T[],
  { today, delaiAlerteJours = 14 }: OptionsSuivi,
): T[] {
  return propositions.filter(
    (p) => p.statut === "envoyee" && p.artisan_prevenu_le === null && envoyeeDepuisJours(p, today, delaiAlerteJours),
  );
}

export type VisiteRappelable = {
  id: string;
  statut: string;
  prochaine_visite: string | null;
  confirmation_envoyee_pour: string | null;
  rappel_veille_envoye_pour: string | null;
  client_email: string | null;
};

/** Visites confirmées de demain, pas encore rappelées, client joignable. */
export function visitesDemain<T extends VisiteRappelable>(contrats: T[], today: string): T[] {
  const demain = ajouterJours(today, 1);
  return contrats.filter(
    (c) =>
      c.statut === "actif" &&
      c.prochaine_visite === demain &&
      c.confirmation_envoyee_pour === demain &&
      c.rappel_veille_envoye_pour !== demain &&
      Boolean(c.client_email),
  );
}
