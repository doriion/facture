/**
 * Reprise d'un RDV iPhone (calendrier externe, lecture seule) comme
 * intervention NG Gestion — logique PURE, testée dans
 * reprise-externe.test.ts.
 */

import type { AgendaEvent } from "@/lib/actions/agenda";

export type RdvExterne = Pick<
  AgendaEvent,
  "id" | "title" | "description" | "lieu" | "date_start" | "date_end" | "heure_debut" | "heure_fin"
>;

export type InterventionReprise = {
  date_intervention: string;
  date_fin: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  type: "autre";
  description: string;
  notes: string | null;
};

/**
 * Valeurs de l'intervention créée depuis un RDV iPhone : le titre
 * devient la description (ce qui s'affiche sur l'agenda), le lieu et le
 * texte du RDV vont dans les notes de la fiche. Type « autre » : à
 * préciser depuis la fiche si besoin. Sans heure de fin, la fin vaut
 * début + 1 h comme sur la grille.
 */
export function interventionDepuisRdv(e: RdvExterne): InterventionReprise {
  const notes = [e.lieu ? `Lieu : ${e.lieu}` : null, e.description?.trim() || null]
    .filter(Boolean)
    .join("\n\n");
  return {
    date_intervention: e.date_start,
    date_fin: e.date_end !== e.date_start ? e.date_end : null,
    heure_debut: e.heure_debut,
    heure_fin: e.heure_fin ?? (e.heure_debut ? plusUneHeure(e.heure_debut) : null),
    type: "autre",
    description: (e.title || "Rendez-vous").slice(0, 2000),
    notes: notes || null,
  };
}

function plusUneHeure(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const total = Math.min((h ?? 0) * 60 + (m ?? 0) + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

/** RDV iPhone que « Tout reprendre » vise : à venir (ou aujourd'hui), pas encore repris. */
export function rdvAReprendre<T extends Pick<AgendaEvent, "kind" | "date_end">>(
  events: T[],
  aujourdhui: string,
): T[] {
  return events.filter((e) => e.kind === "external" && e.date_end >= aujourdhui);
}
