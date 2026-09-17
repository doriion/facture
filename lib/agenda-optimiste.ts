/**
 * Mises à jour OPTIMISTES de l'agenda — logique PURE, testée dans
 * agenda-optimiste.test.ts.
 *
 * Quand on planifie, modifie, déplace, supprime ou bascule « rien à facturer »,
 * l'agenda affiche le résultat tout de suite ; le serveur confirme
 * derrière (et la page se rafraîchit avec les vraies données). En cas
 * d'échec, le composant remet la liste précédente.
 */

import type { AgendaEvent } from "@/lib/actions/agenda";
import type { ValeursDeplacement } from "@/lib/agenda-deplacement";

export type ValeursIntervention = {
  client_id?: string | null;
  date_intervention: string;
  date_fin?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  type: string;
  description?: string | null;
  a_facturer?: boolean;
};

export type ChangementOptimiste =
  | { type: "creation"; id: string; valeurs: ValeursIntervention; clientNom: string | null }
  | { type: "edition"; id: string; valeurs: ValeursIntervention; clientNom: string | null }
  | { type: "suppression"; id: string }
  | { type: "facturation"; id: string; a_facturer: boolean }
  | { type: "deplacement"; id: string; valeurs: ValeursDeplacement };

/** « 14:00 » (saisie) ou « 14:00:00 » (base) → « 14:00:00 » ; vide → null. */
function heureBase(h: string | null | undefined): string | null {
  if (!h) return null;
  return h.length === 5 ? `${h}:00` : h;
}

function evenementDepuisValeurs(
  id: string,
  v: ValeursIntervention,
  clientNom: string | null,
  existant?: AgendaEvent,
): AgendaEvent {
  const clientChange = (v.client_id || null) !== (existant?.client_id ?? null);
  return {
    ...existant,
    id,
    kind: "intervention",
    date_start: v.date_intervention,
    date_end: v.date_fin || v.date_intervention,
    title: v.description || v.type || "Intervention",
    description: v.description || null,
    client_nom: clientNom,
    client_id: v.client_id || null,
    heure_debut: heureBase(v.heure_debut),
    heure_fin: heureBase(v.heure_fin),
    href: `/interventions/${id}`,
    facture_emise: existant?.facture_emise ?? false,
    a_facturer: v.a_facturer ?? existant?.a_facturer ?? true,
    type_activite: v.type,
    // Les coordonnées viennent de la fiche client : inconnues si le client change.
    client_adresse: clientChange ? null : (existant?.client_adresse ?? null),
    client_telephone: clientChange ? null : (existant?.client_telephone ?? null),
  };
}

export function appliquerChangement(
  events: AgendaEvent[],
  c: ChangementOptimiste,
): AgendaEvent[] {
  switch (c.type) {
    case "creation":
      return [...events, evenementDepuisValeurs(c.id, c.valeurs, c.clientNom)];
    case "edition":
      return events.map((e) =>
        e.kind === "intervention" && e.id === c.id
          ? evenementDepuisValeurs(c.id, c.valeurs, c.clientNom, e)
          : e,
      );
    case "suppression":
      return events.filter((e) => !(e.kind === "intervention" && e.id === c.id));
    case "facturation":
      return events.map((e) =>
        e.kind === "intervention" && e.id === c.id ? { ...e, a_facturer: c.a_facturer } : e,
      );
    case "deplacement":
      return events.map((e) =>
        e.kind === "intervention" && e.id === c.id
          ? {
              ...e,
              date_start: c.valeurs.date_intervention,
              date_end: c.valeurs.date_fin ?? c.valeurs.date_intervention,
              heure_debut: c.valeurs.heure_debut,
              heure_fin: c.valeurs.heure_fin,
            }
          : e,
      );
  }
}
