/**
 * Statut de facturation d'un évènement de l'agenda — logique PURE,
 * testée dans agenda-facturation.test.ts.
 *
 * « À facturer » n'est vrai que pour ce qui est PASSÉ (ou commencé
 * aujourd'hui) : un rendez-vous de la semaine prochaine n'est pas en
 * retard de facturation, il est simplement prévu. Et tout ce qui est
 * sur le planning n'est pas à facturer : une intervention marquée
 * « rien à facturer » (a_facturer = false) ne réclame jamais de facture.
 */

export type StatutFacturation =
  | "facturee"
  | "sans_facturation"
  | "a_facturer"
  | "prevue";

export type EvenementFacturable = {
  kind: string;
  date_start: string;
  facture_emise?: boolean;
  a_facturer?: boolean;
};

/** null pour ce qui ne se facture pas depuis l'agenda (factures, devis, visites). */
export function statutFacturation(
  e: EvenementFacturable,
  aujourdhui: string,
): StatutFacturation | null {
  if (e.kind !== "intervention" && e.kind !== "external") return null;
  if (e.facture_emise) return "facturee";
  if (e.kind === "intervention" && e.a_facturer === false) return "sans_facturation";
  return e.date_start <= aujourdhui ? "a_facturer" : "prevue";
}

export function estAFacturer(e: EvenementFacturable, aujourdhui: string): boolean {
  return statutFacturation(e, aujourdhui) === "a_facturer";
}

/** Date du jour (YYYY-MM-DD) en heure de Paris — source : lib/dates. */
export { aujourdhuiParis } from "@/lib/dates";

export type AgendaStats = {
  nbInterventions: number;
  nbInterventionsAFacturer: number;
  nbFactures: number;
  nbDevis: number;
  nbVisites: number;
  nbExternal: number;
  /** RDV iPhone du mois, passés, encore à facturer (non liés à une facture) */
  nbExternalAFacturer: number;
};

type EvenementPourStats = EvenementFacturable & { date_end: string };

/**
 * Compteurs du mois affiché, calculés côté client à partir des évènements
 * chargés : ils suivent la navigation (swipe d'un mois à l'autre) sans
 * repasser par le serveur.
 */
export function statsDuMois(
  events: EvenementPourStats[],
  year: number,
  month: number,
  aujourdhui: string,
): AgendaStats {
  const debut = `${year}-${String(month).padStart(2, "0")}-01`;
  const finExclusive =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const duMois = events.filter((e) => e.date_end >= debut && e.date_start < finExclusive);
  const interventions = duMois.filter((e) => e.kind === "intervention");
  const externes = duMois.filter((e) => e.kind === "external");
  return {
    nbInterventions: interventions.length,
    nbInterventionsAFacturer: interventions.filter((e) => estAFacturer(e, aujourdhui)).length,
    nbFactures: duMois.filter((e) => e.kind === "facture_prestation").length,
    nbDevis: duMois.filter((e) => e.kind === "devis_planifie").length,
    nbVisites: duMois.filter((e) => e.kind === "visite_maintenance").length,
    nbExternal: externes.length,
    nbExternalAFacturer: externes.filter((e) => estAFacturer(e, aujourdhui)).length,
  };
}
