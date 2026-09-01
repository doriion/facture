/**
 * Logique PURE du pense-bête : classement des tâches par échéance —
 * aucune I/O, entièrement testée dans taches-logic.test.ts.
 *
 * Vues :
 * - « Aujourd'hui » = en retard (rouge) + échues aujourd'hui + SANS date
 *   (une note prise en saisie éclair sans échéance doit rester sous les
 *   yeux, pas disparaître dans « À venir ») ;
 * - « À venir »   = échéance strictement future ;
 * - « Faites »    = les 30 derniers jours (mémoire de chantier).
 *
 * Le badge de navigation ne compte que retard + aujourd'hui (pas les
 * sans-date : elles n'ont pas d'urgence datée).
 */

export type TacheClassable = {
  id: string;
  fait: boolean;
  /** YYYY-MM-DD ou null (tâche sans échéance) */
  date_echeance: string | null;
  /** HH:MM ou null */
  heure: string | null;
  /** ISO timestamp de réalisation, null si pas faite */
  fait_le: string | null;
  priorite: string; // 'normale' | 'urgente'
};

export type ClassementTaches<T extends TacheClassable> = {
  enRetard: Array<T & { joursRetard: number }>;
  aujourdhui: T[];
  sansDate: T[];
  aVenir: T[];
  faites: T[];
};

const JOUR_MS = 24 * 60 * 60 * 1000;

function joursEntre(deIso: string, aIso: string): number {
  return Math.round(
    (Date.parse(`${aIso}T00:00:00Z`) - Date.parse(`${deIso}T00:00:00Z`)) /
      JOUR_MS,
  );
}

/** Tri commun : urgentes d'abord, puis par heure (sans heure en dernier). */
function parPrioritePuisHeure(a: TacheClassable, b: TacheClassable): number {
  const prio =
    Number(b.priorite === "urgente") - Number(a.priorite === "urgente");
  if (prio !== 0) return prio;
  if (a.heure && b.heure) return a.heure.localeCompare(b.heure);
  if (a.heure) return -1;
  if (b.heure) return 1;
  return 0;
}

export function classerTaches<T extends TacheClassable>(
  taches: T[],
  today: string,
  joursHistorique = 30,
): ClassementTaches<T> {
  const enRetard: Array<T & { joursRetard: number }> = [];
  const aujourdhui: T[] = [];
  const sansDate: T[] = [];
  const aVenir: T[] = [];
  const faites: T[] = [];

  for (const t of taches) {
    if (t.fait) {
      // Fenêtre d'historique : fait_le dans les N derniers jours
      // (fait_le manquant = on garde, mieux vaut montrer que perdre)
      if (t.fait_le) {
        const faitJour = t.fait_le.slice(0, 10);
        if (joursEntre(faitJour, today) > joursHistorique) continue;
      }
      faites.push(t);
      continue;
    }
    if (!t.date_echeance) {
      sansDate.push(t);
      continue;
    }
    const retard = joursEntre(t.date_echeance, today);
    if (retard > 0) enRetard.push({ ...t, joursRetard: retard });
    else if (retard === 0) aujourdhui.push(t);
    else aVenir.push(t);
  }

  // Retard : les plus anciennes d'abord (les plus urgentes à traiter)
  enRetard.sort(
    (a, b) => b.joursRetard - a.joursRetard || parPrioritePuisHeure(a, b),
  );
  aujourdhui.sort(parPrioritePuisHeure);
  sansDate.sort(parPrioritePuisHeure);
  // À venir : les échéances les plus proches d'abord
  aVenir.sort(
    (a, b) =>
      a.date_echeance!.localeCompare(b.date_echeance!) ||
      parPrioritePuisHeure(a, b),
  );
  // Faites : les plus récentes d'abord
  faites.sort((a, b) => (b.fait_le ?? "").localeCompare(a.fait_le ?? ""));

  return { enRetard, aujourdhui, sansDate, aVenir, faites };
}

/**
 * Nombre affiché sur le badge de navigation et dans l'email quotidien :
 * tâches en retard + échues aujourd'hui (les sans-date ne comptent pas).
 */
export function compteurTachesDuJour(
  taches: TacheClassable[],
  today: string,
): number {
  const { enRetard, aujourdhui } = classerTaches(taches, today);
  return enRetard.length + aujourdhui.length;
}

/** Filtre de recherche plein texte simple (titre + notes), insensible à la casse/aux accents. */
export function filtrerTaches<T extends { titre: string; notes: string | null }>(
  taches: T[],
  recherche: string,
): T[] {
  const q = normaliser(recherche.trim());
  if (!q) return taches;
  return taches.filter(
    (t) =>
      normaliser(t.titre).includes(q) ||
      (t.notes ? normaliser(t.notes).includes(q) : false),
  );
}

/**
 * Date « du jour » vue de France (Europe/Paris), au format YYYY-MM-DD.
 * Sur le serveur (UTC), entre minuit et 2 h du matin heure française,
 * la date UTC est encore celle de la veille — d'où ce helper, utilisé
 * partout où l'on classe les tâches.
 */
export function aujourdhuiParis(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
