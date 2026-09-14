/**
 * Tacite reconduction annuelle des contrats d'entretien — PUR, testé
 * dans reconduction.test.ts. Aucune I/O, aucun email : ce module ne
 * fait qu'avancer la date d'échéance du registre, exactement comme
 * l'article 7 du contrat le prévoit (« renouvellement par périodes
 * successives d'un an, sauf dénonciation »).
 */

export type ContratReconductible = {
  id: string;
  numero: string | null;
  statut: string;
  date_echeance: string | null;
};

/** Statuts pour lesquels la reconduction joue. */
export const STATUTS_RECONDUCTIBLES = ["signe", "actif"] as const;

/**
 * Échéance suivante : +1 an, en UTC. Le 29 février est ramené au 28
 * (setUTCFullYear glisserait sinon au 1er mars, ce qui décalerait
 * toutes les échéances suivantes d'un jour).
 */
export function prochaineEcheance(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateIso;
  const jour = d.getUTCDate();
  const mois = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  if (d.getUTCDate() !== jour || d.getUTCMonth() !== mois) {
    // 29 février → 28 février de l'année suivante
    d.setUTCDate(0);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Contrats dont l'échéance est dépassée et qui se sont donc reconduits
 * tacitement. Idempotent par construction : une fois l'échéance
 * avancée au-delà d'aujourd'hui, le contrat ne ressort plus.
 *
 * Une échéance très ancienne (plusieurs années sans exécution du job)
 * est rattrapée en une fois : on avance autant d'années qu'il faut
 * pour repasser devant la date du jour.
 */
export function contratsAReconduire<T extends ContratReconductible>(
  contrats: T[],
  { today }: { today: string },
): Array<T & { nouvelleEcheance: string }> {
  const resultat: Array<T & { nouvelleEcheance: string }> = [];
  for (const c of contrats) {
    if (!(STATUTS_RECONDUCTIBLES as readonly string[]).includes(c.statut)) {
      continue;
    }
    if (!c.date_echeance) continue;
    if (Number.isNaN(Date.parse(`${c.date_echeance}T00:00:00Z`))) continue;
    if (c.date_echeance >= today) continue; // pas encore échu

    let nouvelleEcheance = prochaineEcheance(c.date_echeance);
    // Garde-fou : 50 tours au maximum (protection contre une date
    // aberrante), largement au-delà de la durée de vie d'un contrat.
    let tours = 0;
    while (nouvelleEcheance < today && tours < 50) {
      nouvelleEcheance = prochaineEcheance(nouvelleEcheance);
      tours += 1;
    }
    if (nouvelleEcheance < today) continue; // date aberrante : on n'y touche pas
    resultat.push({ ...c, nouvelleEcheance });
  }
  return resultat;
}
