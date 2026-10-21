import { nextVisitDate, type Frequence } from "@/lib/validations/contrat";

/**
 * Sélection PURE des contrats d'entretien dont la visite est à proposer
 * au client — aucune I/O, entièrement testée dans
 * rappels-entretien.test.ts.
 *
 * Règles (toutes cumulatives) :
 * - contrat au statut "actif" ;
 * - échéance = prochaine visite renseignée, sinon date de début +
 *   fréquence (visite « à convenir » : on la propose à l'échéance du
 *   contrat, jamais avant aujourd'hui) ;
 * - échéance comprise entre aujourd'hui et aujourd'hui + fenêtre
 *   (défaut 30 j) — une visite déjà passée n'est PAS relancée
 *   automatiquement (à gérer de vive voix) ;
 * - pas de proposition pour une visite déjà confirmée au client
 *   (`confirmation_envoyee_pour` = échéance) ;
 * - une seule proposition par échéance : si `rappel_envoye_pour` vaut
 *   déjà l'échéance, on ne renvoie rien ;
 * - le client a un email.
 */

export type ContratRappelable = {
  id: string;
  intitule: string | null;
  equipement: string | null;
  statut: string;
  date_debut: string;
  frequence: string;
  prochaine_visite: string | null;
  rappel_envoye_pour: string | null;
  confirmation_envoyee_pour: string | null;
  client_email: string | null;
};

export type OptionsRappels = {
  /** Date du jour au format YYYY-MM-DD (UTC) */
  today: string;
  /** Fenêtre d'anticipation en jours (défaut 30) */
  fenetreJours?: number;
};

const JOUR_MS = 24 * 60 * 60 * 1000;

function joursEntre(deIso: string, aIso: string): number {
  return Math.round(
    (Date.parse(`${aIso}T00:00:00Z`) - Date.parse(`${deIso}T00:00:00Z`)) /
      JOUR_MS,
  );
}

/** Date à laquelle la visite est due : prochaine visite, sinon début + fréquence (jamais avant aujourd'hui). */
export function echeanceVisite(c: Pick<ContratRappelable, "prochaine_visite" | "date_debut" | "frequence">, today: string): string {
  if (c.prochaine_visite) return c.prochaine_visite;
  const calculee = nextVisitDate(c.date_debut, c.frequence as Frequence);
  return calculee > today ? calculee : today;
}

export function contratsARappeler<T extends ContratRappelable>(
  contrats: T[],
  { today, fenetreJours = 30 }: OptionsRappels,
): Array<T & { echeance: string; joursAvantVisite: number }> {
  const resultat: Array<T & { echeance: string; joursAvantVisite: number }> = [];
  for (const c of contrats) {
    if (c.statut !== "actif") continue;
    if (!c.client_email) continue;
    const echeance = echeanceVisite(c, today);
    if (c.confirmation_envoyee_pour === echeance) continue; // déjà convenue et confirmée
    if (c.rappel_envoye_pour === echeance) continue; // déjà proposée
    const joursAvantVisite = joursEntre(today, echeance);
    if (joursAvantVisite < 0) continue; // visite déjà passée
    if (joursAvantVisite > fenetreJours) continue; // trop tôt
    resultat.push({ ...c, echeance, joursAvantVisite });
  }
  // Les visites les plus proches d'abord
  resultat.sort((a, b) => a.joursAvantVisite - b.joursAvantVisite);
  return resultat;
}
