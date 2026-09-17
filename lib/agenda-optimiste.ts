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
import { ecartJours, type Recurrence } from "@/lib/agenda-recurrence";
import { ajouterJours } from "@/lib/agenda-vues";

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
  | { type: "deplacement"; id: string; valeurs: ValeursDeplacement }
  /** Série : une occurrence par date, ids temporaires `${prefixe}-${i}`. */
  | {
      type: "creation_serie";
      prefixe: string;
      dates: string[];
      valeurs: ValeursIntervention;
      clientNom: string | null;
      recurrence: Recurrence;
    }
  /** « Ce rendez-vous et les suivants » : mêmes champs, dates décalées d'autant. */
  | {
      type: "edition_suivantes";
      id: string;
      serie_id: string;
      depuis: string;
      valeurs: ValeursIntervention;
      clientNom: string | null;
    }
  | { type: "suppression_suivantes"; serie_id: string; depuis: string };

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
    case "creation_serie": {
      const dureeJours = c.valeurs.date_fin
        ? ecartJours(c.valeurs.date_intervention, c.valeurs.date_fin)
        : 0;
      return [
        ...events,
        ...c.dates.map((d, i) => ({
          ...evenementDepuisValeurs(
            `${c.prefixe}-${i}`,
            { ...c.valeurs, date_intervention: d, date_fin: dureeJours > 0 ? ajouterJours(d, dureeJours) : null },
            c.clientNom,
          ),
          serie_id: c.prefixe,
          recurrence: c.recurrence,
        })),
      ];
    }
    case "edition_suivantes": {
      const delta = ecartJours(c.depuis, c.valeurs.date_intervention);
      const dureeJours = c.valeurs.date_fin
        ? ecartJours(c.valeurs.date_intervention, c.valeurs.date_fin)
        : 0;
      return events.map((e) => {
        if (e.kind !== "intervention") return e;
        const visee =
          e.id === c.id ||
          (e.serie_id === c.serie_id && e.date_start >= c.depuis && !e.facture_emise);
        if (!visee) return e;
        const date = e.id === c.id ? c.valeurs.date_intervention : ajouterJours(e.date_start, delta);
        return evenementDepuisValeurs(
          e.id,
          { ...c.valeurs, date_intervention: date, date_fin: dureeJours > 0 ? ajouterJours(date, dureeJours) : null },
          c.clientNom,
          e,
        );
      });
    }
    case "suppression_suivantes":
      return events.filter(
        (e) =>
          !(
            e.kind === "intervention" &&
            e.serie_id === c.serie_id &&
            e.date_start >= c.depuis &&
            !e.facture_emise
          ),
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
