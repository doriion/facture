/**
 * Sélection PURE des contrats d'entretien à rappeler — aucune I/O,
 * entièrement testée dans rappels-entretien.test.ts.
 *
 * Règles (toutes cumulatives) :
 * - contrat au statut "actif" ;
 * - prochaine visite renseignée, comprise entre aujourd'hui et
 *   aujourd'hui + fenêtre (défaut 30 j) — une visite déjà passée
 *   n'est PAS rappelée automatiquement (à gérer de vive voix) ;
 * - un seul rappel par échéance : si `rappel_envoye_pour` vaut déjà
 *   la date de la prochaine visite, on ne renvoie rien ;
 * - le client a un email.
 */

export type ContratRappelable = {
  id: string;
  intitule: string | null;
  equipement: string | null;
  statut: string;
  prochaine_visite: string | null;
  rappel_envoye_pour: string | null;
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

export function contratsARappeler<T extends ContratRappelable>(
  contrats: T[],
  { today, fenetreJours = 30 }: OptionsRappels,
): Array<T & { joursAvantVisite: number }> {
  const resultat: Array<T & { joursAvantVisite: number }> = [];
  for (const c of contrats) {
    if (c.statut !== "actif") continue;
    if (!c.prochaine_visite) continue;
    if (!c.client_email) continue;
    if (c.rappel_envoye_pour === c.prochaine_visite) continue;
    const joursAvantVisite = joursEntre(today, c.prochaine_visite);
    if (joursAvantVisite < 0) continue; // visite déjà passée
    if (joursAvantVisite > fenetreJours) continue; // trop tôt
    resultat.push({ ...c, joursAvantVisite });
  }
  // Les visites les plus proches d'abord
  resultat.sort((a, b) => a.joursAvantVisite - b.joursAvantVisite);
  return resultat;
}
