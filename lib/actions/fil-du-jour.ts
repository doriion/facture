"use server";

import { getAgendaEvents, type AFacturerItem, type AgendaEvent } from "@/lib/actions/agenda";
import { aujourdhuiParis, composantesYmd } from "@/lib/dates";

export type RdvDuJour = Pick<
  AgendaEvent,
  | "id"
  | "kind"
  | "title"
  | "client_nom"
  | "heure_debut"
  | "heure_fin"
  | "href"
  | "client_adresse"
  | "client_telephone"
  | "facture_emise"
  | "a_facturer"
>;

export type FilDuJour = {
  date: string;
  /** Rendez-vous du jour (interventions, visites d'entretien, débuts de travaux), par heure. */
  rdv: RdvDuJour[];
  /** Interventions passées sans facture, les plus récentes d'abord. */
  aFacturer: AFacturerItem[];
  /** Nombre total d'interventions à facturer (la liste est tronquée). */
  nbAFacturer: number;
};

const MAX_A_FACTURER = 5;

/**
 * Ce qu'il y a à faire aujourd'hui sur le terrain : les RDV du jour et
 * les interventions terminées qui attendent leur facture. Réutilise la
 * lecture de l'agenda (fenêtre réduite au jour) : même source, mêmes
 * règles que l'écran Agenda.
 */
export async function getFilDuJour(): Promise<FilDuJour> {
  const date = aujourdhuiParis();
  const { annee, mois } = composantesYmd(date);
  const { events, aFacturer } = await getAgendaEvents(annee, mois, { depuis: date, jusquau: date });

  const rdv = events
    .filter(
      (e) =>
        e.date_start <= date &&
        e.date_end >= date &&
        (e.kind === "intervention" || e.kind === "visite_maintenance" || e.kind === "devis_planifie"),
    )
    .sort((a, b) => (a.heure_debut ?? "99").localeCompare(b.heure_debut ?? "99"))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      client_nom: e.client_nom,
      heure_debut: e.heure_debut,
      heure_fin: e.heure_fin,
      href: e.href,
      client_adresse: e.client_adresse ?? null,
      client_telephone: e.client_telephone ?? null,
      facture_emise: e.facture_emise,
      a_facturer: e.a_facturer,
    }));

  return {
    date,
    rdv,
    aFacturer: aFacturer.slice(0, MAX_A_FACTURER),
    nbAFacturer: aFacturer.length,
  };
}
