/**
 * Avis de reconduction « loi Chatel » — sélection PURE, testée dans
 * chatel.test.ts. Aucune I/O.
 *
 * CADRE LÉGAL (art. L. 215-1 et suivants du code de la consommation,
 * repris à l'article 7 du contrat type figé) : pour un client
 * CONSOMMATEUR, le prestataire informe par écrit, au plus tôt trois
 * mois et au plus tard un mois avant l'échéance annuelle, de la
 * faculté de ne pas reconduire. À défaut d'information, le client peut
 * résilier gratuitement à tout moment à compter de la reconduction et
 * se faire rembourser les sommes versées après cette date.
 *
 * FENÊTRE RETENUE : les délais légaux (« au plus tôt trois mois et au
 * plus tard un mois avant le terme de la période autorisant le rejet
 * de la reconduction ») se comptent par rapport à la DATE LIMITE DE
 * DÉNONCIATION, c'est-à-dire l'échéance moins le préavis de deux mois
 * de l'article 7 — pas par rapport à l'échéance elle-même. Une
 * première version comptait depuis l'échéance : l'avis partait quand
 * la date limite qu'il annonçait était déjà passée.
 *
 * Envoi visé à 60 jours avant la date limite, rattrapage tant qu'il
 * reste au moins 32 jours avant elle (soit environ J-121 à J-93 avant
 * l'échéance). Les deux bornes gardent une marge sur les bornes légales
 * (90 et 30 jours) : le cron ne tourne qu'une fois par jour et peut
 * sauter un jour, il ne doit jamais envoyer un avis hors délai.
 *
 * Un avis envoyé trop tôt ou trop tard ne vaut pas information : mieux
 * vaut ne rien envoyer et le signaler que sortir de la fenêtre.
 */

export const CHATEL_JOURS_CIBLE = 60;
export const CHATEL_JOURS_MIN = 32;

export type ContratAviseable = {
  id: string;
  numero: string | null;
  statut: string;
  qualite_client: string;
  date_echeance: string | null;
  rappel_chatel_envoye_pour: string | null;
  client_email: string | null;
  client_nom: string;
};

export type OptionsChatel = {
  /** Date du jour au format YYYY-MM-DD (UTC) */
  today: string;
  joursCible?: number;
  joursMin?: number;
};

const JOUR_MS = 24 * 60 * 60 * 1000;

export function joursEntre(deIso: string, aIso: string): number {
  const de = Date.parse(`${deIso}T00:00:00Z`);
  const a = Date.parse(`${aIso}T00:00:00Z`);
  if (Number.isNaN(de) || Number.isNaN(a)) return Number.NaN;
  return Math.round((a - de) / JOUR_MS);
}

/** Statuts pour lesquels une reconduction annuelle est en jeu. */
export const STATUTS_AVISABLES = ["signe", "actif"] as const;

/**
 * Date limite de dénonciation = échéance − 2 mois (préavis de
 * l'article 7). Mois calendaires, avec écrêtage : le 31 décembre − 2
 * mois donne le 31 octobre, le 31 mars donne le 31 janvier, mais le
 * 30 avril − 2 mois donne bien le 28 (ou 29) février et non le 1er ou
 * 2 mars.
 */
export function dateLimiteDenonciation(echeanceIso: string): string {
  const d = new Date(`${echeanceIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return echeanceIso;
  const jour = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() - 2);
  if (d.getUTCDate() !== jour) {
    // Débordement (ex. 31 avril) : on recule au dernier jour du mois visé
    d.setUTCDate(0);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Contrats à aviser aujourd'hui. Règles cumulatives :
 *  - contrat signé ou actif (un contrat résilié ou expiré ne se
 *    reconduit pas) ;
 *  - client particulier (la loi Chatel ne protège que le consommateur) ;
 *  - échéance renseignée, date limite de dénonciation (échéance − 2
 *    mois) comprise dans la fenêtre [J-60, J-32] avant cette date ;
 *  - aucun avis déjà envoyé POUR CETTE échéance ;
 *  - adresse email du client connue.
 */
export function contratsAAviserChatel<T extends ContratAviseable>(
  contrats: T[],
  {
    today,
    joursCible = CHATEL_JOURS_CIBLE,
    joursMin = CHATEL_JOURS_MIN,
  }: OptionsChatel,
): Array<T & { joursAvantEcheance: number; joursAvantLimite: number }> {
  const resultat: Array<T & { joursAvantEcheance: number; joursAvantLimite: number }> = [];
  for (const c of contrats) {
    if (!(STATUTS_AVISABLES as readonly string[]).includes(c.statut)) continue;
    if (c.qualite_client !== "particulier") continue;
    if (!c.date_echeance) continue;
    if (!c.client_email) continue;
    // Anti-doublon : un seul avis par échéance. Si l'échéance avance
    // (reconduction), l'avis est ré-armé pour la nouvelle échéance.
    if (c.rappel_chatel_envoye_pour === c.date_echeance) continue;

    const joursAvantEcheance = joursEntre(today, c.date_echeance);
    const joursAvantLimite = joursEntre(today, dateLimiteDenonciation(c.date_echeance));
    if (!Number.isFinite(joursAvantEcheance) || !Number.isFinite(joursAvantLimite)) continue;
    if (joursAvantLimite > joursCible) continue; // trop tôt
    if (joursAvantLimite < joursMin) continue; // hors délai légal (date limite trop proche ou passée)
    resultat.push({ ...c, joursAvantEcheance, joursAvantLimite });
  }
  // Les échéances les plus proches d'abord
  resultat.sort((a, b) => a.joursAvantEcheance - b.joursAvantEcheance);
  return resultat;
}
