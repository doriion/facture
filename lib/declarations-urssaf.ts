/**
 * Calendrier de la déclaration de chiffre d'affaires du micro-entrepreneur.
 *
 * Règle URSSAF : la déclaration (et le paiement) d'une période se fait
 * au plus tard le dernier jour du mois qui suit la période — fin de
 * mois M+1 en mensuel ; 30 avril, 31 juillet, 31 octobre et 31 janvier
 * en trimestriel. Les périodes sont bornées [start inclus, end exclu),
 * comme sur la page Exports, pour retrouver la déclaration enregistrée.
 */

export const PERIODICITES_URSSAF = ["mensuelle", "trimestrielle"] as const;
export type PeriodiciteUrssaf = (typeof PERIODICITES_URSSAF)[number];

export const LABELS_PERIODICITE_URSSAF: Record<PeriodiciteUrssaf, string> = {
  mensuelle: "Tous les mois",
  trimestrielle: "Tous les trimestres",
};

export function periodiciteSure(v: unknown): PeriodiciteUrssaf {
  return v === "mensuelle" ? "mensuelle" : "trimestrielle";
}

export type PeriodeDeclaration = {
  /** Même forme que les périodes de la page Exports (« T3 2026 », « Septembre 2026 »). */
  label: string;
  start: string;
  end: string;
  /** Dernier jour pour déclarer (YYYY-MM-DD). */
  dateLimite: string;
};

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const p2 = (n: number) => String(n).padStart(2, "0");

/** Premier jour du mois (année, mois 1-12). */
function premierDuMois(annee: number, mois: number): string {
  // Reporte un mois 0 ou 13 sur l'année voisine.
  const d = new Date(Date.UTC(annee, mois - 1, 1));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-01`;
}

/** Dernier jour du mois qui contient la date (YYYY-MM-DD). */
function dernierJourDuMois(ymd: string): string {
  const [a, m] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m!, 0)); // jour 0 du mois suivant
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** Date limite de déclaration d'une période : fin du mois qui suit (end = 1er jour de ce mois). */
export function dateLimiteDeclaration(end: string): string {
  return dernierJourDuMois(end);
}

/**
 * La dernière période ÉCHUE à la date donnée (celle qu'il faut déclarer
 * maintenant), selon la périodicité.
 */
export function periodeADeclarer(today: string, periodicite: PeriodiciteUrssaf): PeriodeDeclaration {
  const [annee, mois] = today.split("-").map(Number) as [number, number];
  if (periodicite === "mensuelle") {
    const start = premierDuMois(annee, mois - 1);
    const end = premierDuMois(annee, mois);
    const [a, m] = start.split("-").map(Number) as [number, number];
    return { label: `${MOIS[m - 1]} ${a}`, start, end, dateLimite: dateLimiteDeclaration(end) };
  }
  const trimestreCourant = Math.floor((mois - 1) / 3) + 1;
  const trimestre = trimestreCourant === 1 ? 4 : trimestreCourant - 1;
  const anneeT = trimestreCourant === 1 ? annee - 1 : annee;
  const start = premierDuMois(anneeT, (trimestre - 1) * 3 + 1);
  const end = premierDuMois(anneeT, trimestre * 3 + 1);
  return { label: `T${trimestre} ${anneeT}`, start, end, dateLimite: dateLimiteDeclaration(end) };
}

/** Jours calendaires entre deux dates YYYY-MM-DD (négatif si b < a). */
export function joursEntre(a: string, b: string): number {
  const [a1, m1, j1] = a.split("-").map(Number) as [number, number, number];
  const [a2, m2, j2] = b.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a1, m1 - 1, j1)) / 86_400_000);
}

export type RappelDeclaration = PeriodeDeclaration & {
  /** Jours restants avant la date limite (négatif = en retard). */
  joursRestants: number;
};

/**
 * Rappel à afficher pour la période échue si elle n'est pas déclarée :
 * null quand elle l'est déjà. Le rappel reste tant que ce n'est pas
 * fait (en retard compris), c'est le but.
 */
export function rappelDeclaration(
  today: string,
  periodicite: PeriodiciteUrssaf,
  estDeclaree: (periode: PeriodeDeclaration) => boolean,
): RappelDeclaration | null {
  const periode = periodeADeclarer(today, periodicite);
  if (estDeclaree(periode)) return null;
  return { ...periode, joursRestants: joursEntre(today, periode.dateLimite) };
}
