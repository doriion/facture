/**
 * Rendez-vous récurrents — logique PURE, testée dans
 * agenda-recurrence.test.ts.
 *
 * Une série = une règle (toutes les N semaines / N mois / N ans, du… au…)
 * dont chaque occurrence est une intervention ordinaire. Ici : le calcul
 * des dates d'occurrences, les libellés, les valeurs par défaut du
 * formulaire, et les changements « ce rendez-vous et les suivants ».
 */

import { ajouterJours, depuisYmd, libelleJour, ymd } from "@/lib/agenda-vues";

export const FREQUENCES = ["hebdomadaire", "mensuelle", "annuelle"] as const;
export type Frequence = (typeof FREQUENCES)[number];

export type Recurrence = {
  frequence: Frequence;
  /** Toutes les N semaines / mois / ans (1 à 12). */
  intervalle: number;
  /** Dernière date possible (incluse), YYYY-MM-DD. */
  date_fin: string;
};

/** Garde-fou : une série ne crée jamais plus de rendez-vous que cela. */
export const MAX_OCCURRENCES = 100;

/** Choix proposés dans le formulaire (« Répéter »). */
export const CHOIX_REPETITION = [
  "jamais",
  "hebdomadaire",
  "quinzaine",
  "mensuelle",
  "annuelle",
] as const;
export type ChoixRepetition = (typeof CHOIX_REPETITION)[number];

export const LABELS_REPETITION: Record<ChoixRepetition, string> = {
  jamais: "Jamais",
  hebdomadaire: "Toutes les semaines",
  quinzaine: "Toutes les 2 semaines",
  mensuelle: "Tous les mois",
  annuelle: "Tous les ans",
};

/** Fréquence + intervalle d'un choix du formulaire (null = pas de série). */
export function regleDuChoix(
  choix: ChoixRepetition,
): { frequence: Frequence; intervalle: number } | null {
  switch (choix) {
    case "jamais":
      return null;
    case "hebdomadaire":
      return { frequence: "hebdomadaire", intervalle: 1 };
    case "quinzaine":
      return { frequence: "hebdomadaire", intervalle: 2 };
    case "mensuelle":
      return { frequence: "mensuelle", intervalle: 1 };
    case "annuelle":
      return { frequence: "annuelle", intervalle: 1 };
  }
}

/** Choix du formulaire correspondant à une règle enregistrée. */
export function choixDeRegle(r: { frequence: Frequence; intervalle: number }): ChoixRepetition {
  if (r.frequence === "hebdomadaire") return r.intervalle === 2 ? "quinzaine" : "hebdomadaire";
  return r.frequence;
}

/**
 * Date de fin proposée par défaut : un an pour les séries hebdo et
 * mensuelles, cinq ans pour les annuelles (visite annuelle d'entretien).
 */
export function finParDefaut(date_debut: string, frequence: Frequence): string {
  const d = depuisYmd(date_debut);
  d.setFullYear(d.getFullYear() + (frequence === "annuelle" ? 5 : 1));
  return ymd(d);
}

function joursDansMois(annee: number, mois0: number): number {
  return new Date(annee, mois0 + 1, 0).getDate();
}

/**
 * N-ième occurrence (0 = date de début). Les mois et les ans gardent le
 * jour du mois de départ, rogné au dernier jour du mois quand il n'existe
 * pas (31 janv. → 28 févr. → 31 mars ; 29 févr. → 28 févr. l'an suivant).
 */
export function occurrence(date_debut: string, rec: Pick<Recurrence, "frequence" | "intervalle">, n: number): string {
  const d = depuisYmd(date_debut);
  if (rec.frequence === "hebdomadaire") return ajouterJours(date_debut, 7 * rec.intervalle * n);
  const jour = d.getDate();
  const moisTotal =
    d.getMonth() + (rec.frequence === "mensuelle" ? rec.intervalle * n : 12 * rec.intervalle * n);
  const annee = d.getFullYear() + Math.floor(moisTotal / 12);
  const mois0 = ((moisTotal % 12) + 12) % 12;
  return ymd(new Date(annee, mois0, Math.min(jour, joursDansMois(annee, mois0))));
}

/**
 * Toutes les dates de la série, date de début incluse, jusqu'à la date
 * de fin (incluse) et au plus MAX_OCCURRENCES.
 */
export function datesOccurrences(date_debut: string, rec: Recurrence): string[] {
  const dates: string[] = [];
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const d = occurrence(date_debut, rec, n);
    if (d > rec.date_fin) break;
    dates.push(d);
  }
  return dates;
}

/** Vrai si la série dépasserait le plafond (on refuse plutôt que tronquer). */
export function depassePlafond(date_debut: string, rec: Recurrence): boolean {
  return occurrence(date_debut, rec, MAX_OCCURRENCES) <= rec.date_fin;
}

/** « toutes les 2 semaines jusqu'au Vendredi 17 sept. 2027 ». */
export function libelleRecurrence(rec: Recurrence): string {
  const n = rec.intervalle;
  let quoi: string;
  switch (rec.frequence) {
    case "hebdomadaire":
      quoi = n === 1 ? "toutes les semaines" : `toutes les ${n} semaines`;
      break;
    case "mensuelle":
      quoi = n === 1 ? "tous les mois" : `tous les ${n} mois`;
      break;
    case "annuelle":
      quoi = n === 1 ? "tous les ans" : `tous les ${n} ans`;
      break;
  }
  return `${quoi} jusqu'au ${libelleJourAvecAnnee(rec.date_fin)}`;
}

function libelleJourAvecAnnee(d: string): string {
  return `${libelleJour(d)} ${d.slice(0, 4)}`;
}

/** Nombre de jours entre deux dates (b − a), robuste aux changements d'heure. */
export function ecartJours(a: string, b: string): number {
  return Math.round((depuisYmd(b).getTime() - depuisYmd(a).getTime()) / 86_400_000);
}

/**
 * Portée d'une modification ou d'une suppression sur une occurrence :
 * ce rendez-vous seul, ou lui et tous les suivants de la série (les
 * occurrences déjà facturées ne sont jamais touchées).
 */
export type PorteeSerie = "seule" | "suivantes";

/** Occurrences visées par « ce rendez-vous et les suivants ». */
export function occurrencesSuivantes<
  T extends { serie_id?: string | null; date_intervention: string; facture_id?: string | null },
>(occurrences: T[], serie_id: string, depuis: string): T[] {
  return occurrences.filter(
    (o) => o.serie_id === serie_id && o.date_intervention >= depuis && !o.facture_id,
  );
}
