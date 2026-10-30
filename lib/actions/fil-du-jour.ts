"use server";

import { getAgendaEvents, type AFacturerItem, type AgendaEvent } from "@/lib/actions/agenda";
import { aujourdhuiParis, composantesYmd } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { devisARelancer, joursDepuisContact } from "@/lib/devis-relances";

export type DevisDuFil = {
  id: string;
  numero: string;
  client_nom: string | null;
  client_email: string | null;
  total_ht: number;
  date_validite: string | null;
  /** Jours depuis le dernier envoi au client (devis à relancer). */
  joursSansReponse: number;
};

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
  /** Devis acceptés qui n'ont pas encore de facture. */
  devisAFacturer: DevisDuFil[];
  /** Devis envoyés sans réponse depuis 7 jours, encore valables. */
  devisARelancer: DevisDuFil[];
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

  const { devisAFacturer, devisARelancer: aRelancer } = await devisDuFil(date);

  return {
    date,
    rdv,
    aFacturer: aFacturer.slice(0, MAX_A_FACTURER),
    nbAFacturer: aFacturer.length,
    devisAFacturer,
    devisARelancer: aRelancer,
  };
}

/** Devis qui attendent une action : acceptés sans facture, envoyés sans réponse. */
async function devisDuFil(today: string): Promise<{ devisAFacturer: DevisDuFil[]; devisARelancer: DevisDuFil[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("devis")
    .select("id, numero, statut, est_modele, date_emission, date_validite, email_envoye_le, facture_id, total_ht, client:clients(nom, email)")
    .eq("est_modele", false)
    .in("statut", ["accepte", "envoye"])
    .is("facture_id", null)
    .order("date_emission", { ascending: true });
  type Row = NonNullable<typeof data>[number] & { client: { nom: string; email: string | null } | null };
  const rows = (data ?? []) as Row[];
  const versFil = (d: Row): DevisDuFil => ({
    id: d.id,
    numero: d.numero,
    client_nom: d.client?.nom ?? null,
    client_email: d.client?.email ?? null,
    total_ht: Number(d.total_ht),
    date_validite: d.date_validite,
    joursSansReponse: joursDepuisContact(d, today),
  });
  return {
    devisAFacturer: rows.filter((d) => d.statut === "accepte").map(versFil),
    devisARelancer: devisARelancer(rows, today).map(versFil),
  };
}
