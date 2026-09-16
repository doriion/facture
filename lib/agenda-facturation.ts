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

/** Date du jour (YYYY-MM-DD) en heure de Paris, quel que soit le serveur. */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  return maintenant.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}
