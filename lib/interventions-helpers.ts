/**
 * Helpers PURS des interventions (testés) : statut « terrain » d'une
 * intervention, durée déduite des heures, compteurs de la liste.
 */

export type StatutIntervention = "a_venir" | "a_facturer" | "facturee" | "rien_a_facturer";

export const LABELS_STATUT_INTERVENTION: Record<StatutIntervention, string> = {
  a_venir: "À venir",
  a_facturer: "À facturer",
  facturee: "Facturées",
  rien_a_facturer: "Rien à facturer",
};

export type InterventionStatutable = {
  date_intervention: string;
  date_fin?: string | null;
  facture?: { id: string } | null;
  a_facturer?: boolean | null;
};

/**
 * - facturée : une facture est liée ;
 * - rien à facturer : coché comme tel ;
 * - à venir : commence après aujourd'hui ;
 * - à facturer : passée (ou en cours), sans facture.
 */
export function statutIntervention(i: InterventionStatutable, aujourdhui: string): StatutIntervention {
  if (i.facture) return "facturee";
  if (i.a_facturer === false) return "rien_a_facturer";
  if (i.date_intervention > aujourdhui) return "a_venir";
  return "a_facturer";
}

export function compterStatuts<T extends InterventionStatutable>(
  interventions: T[],
  aujourdhui: string,
): Record<StatutIntervention, number> {
  const c: Record<StatutIntervention, number> = { a_venir: 0, a_facturer: 0, facturee: 0, rien_a_facturer: 0 };
  for (const i of interventions) c[statutIntervention(i, aujourdhui)] += 1;
  return c;
}

/**
 * Durée en minutes entre deux heures « HH:MM » (fin après début, même
 * jour). null si l'une manque ou si le résultat n'a pas de sens.
 */
export function dureeDepuisHeures(debut: string | null | undefined, fin: string | null | undefined): number | null {
  const re = /^([01]\d|2[0-3]):([0-5]\d)/;
  const a = re.exec(debut ?? "");
  const b = re.exec(fin ?? "");
  if (!a || !b) return null;
  const minutes = Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]));
  return minutes > 0 ? minutes : null;
}

/** « 2 h 30 », « 45 min ». */
export function formatDuree(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
