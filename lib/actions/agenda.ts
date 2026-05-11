"use server";

import { createClient } from "@/lib/supabase/server";

export type AgendaEventKind =
  | "intervention"
  | "facture_prestation"
  | "devis_planifie"
  | "visite_maintenance";

export type AgendaEvent = {
  id: string;
  kind: AgendaEventKind;
  date_start: string; // YYYY-MM-DD
  date_end: string;   // YYYY-MM-DD (= date_start si single-day)
  title: string;
  client_nom: string | null;
  href: string;
  statut?: string | null;
  /**
   * Pour les interventions : true si une facture est rattachée.
   * Permet d'afficher l'alerte "à facturer".
   */
  facture_emise?: boolean;
  numero?: string | null;
  type_activite?: string | null;
};

export type AgendaData = {
  year: number;
  month: number; // 1-12
  events: AgendaEvent[];
  /** Stats globales pour le mois affiché */
  stats: {
    nbInterventions: number;
    nbInterventionsAFacturer: number;
    nbFactures: number;
    nbDevis: number;
    nbVisites: number;
  };
};

/**
 * Récupère tous les événements (interventions, prestations facturées,
 * devis planifiés, visites de maintenance) intersectant le mois demandé.
 *
 * On élargit la fenêtre de quelques jours pour couvrir le rendu du
 * calendrier (qui affiche aussi la fin du mois précédent et le début
 * du suivant).
 */
export async function getAgendaEvents(
  year: number,
  month: number, // 1-12
): Promise<AgendaData> {
  const supabase = createClient();

  // Fenêtre élargie : 7 jours avant le 1er du mois → 7 jours après le dernier.
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const windowStart = new Date(firstOfMonth);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const windowEnd = new Date(lastOfMonth);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

  const ws = windowStart.toISOString().slice(0, 10);
  const we = windowEnd.toISOString().slice(0, 10);

  const [
    interventionsRes,
    facturesRes,
    devisRes,
    contratsRes,
  ] = await Promise.all([
    supabase
      .from("interventions")
      .select(
        "id, date_intervention, type, description, facture_id, client:clients(nom)",
      )
      .gte("date_intervention", ws)
      .lte("date_intervention", we)
      .order("date_intervention", { ascending: true }),
    supabase
      .from("factures")
      .select(
        "id, numero, statut, date_prestation, date_prestation_fin, type_activite, client:clients(nom)",
      )
      .not("date_prestation", "is", null)
      .gte("date_prestation", ws)
      .lte("date_prestation", we)
      .order("date_prestation", { ascending: true }),
    supabase
      .from("devis")
      .select(
        "id, numero, statut, date_debut_travaux, duree_estimee_jours, type_activite, client:clients(nom)",
      )
      .not("date_debut_travaux", "is", null)
      .gte("date_debut_travaux", ws)
      .lte("date_debut_travaux", we)
      .order("date_debut_travaux", { ascending: true }),
    supabase
      .from("contrats_maintenance")
      .select("id, intitule, prochaine_visite, statut, client:clients(nom)")
      .eq("statut", "actif")
      .not("prochaine_visite", "is", null)
      .gte("prochaine_visite", ws)
      .lte("prochaine_visite", we)
      .order("prochaine_visite", { ascending: true }),
  ]);

  const events: AgendaEvent[] = [];

  type InterventionRow = {
    id: string;
    date_intervention: string;
    type: string;
    description: string | null;
    facture_id: string | null;
    client: { nom: string } | null;
  };
  for (const it of (interventionsRes.data ?? []) as InterventionRow[]) {
    events.push({
      id: it.id,
      kind: "intervention",
      date_start: it.date_intervention,
      date_end: it.date_intervention,
      title: it.description || it.type || "Intervention",
      client_nom: it.client?.nom ?? null,
      href: `/interventions/${it.id}`,
      facture_emise: Boolean(it.facture_id),
      type_activite: it.type,
    });
  }

  type FactureRow = {
    id: string;
    numero: string;
    statut: string;
    date_prestation: string | null;
    date_prestation_fin: string | null;
    type_activite: string | null;
    client: { nom: string } | null;
  };
  for (const f of (facturesRes.data ?? []) as FactureRow[]) {
    if (!f.date_prestation) continue;
    events.push({
      id: f.id,
      kind: "facture_prestation",
      date_start: f.date_prestation,
      date_end: f.date_prestation_fin ?? f.date_prestation,
      title: `Facture ${f.numero}`,
      client_nom: f.client?.nom ?? null,
      href: `/factures/${f.id}`,
      statut: f.statut,
      numero: f.numero,
      type_activite: f.type_activite,
    });
  }

  type DevisRow = {
    id: string;
    numero: string;
    statut: string;
    date_debut_travaux: string | null;
    duree_estimee_jours: number | null;
    type_activite: string | null;
    client: { nom: string } | null;
  };
  for (const d of (devisRes.data ?? []) as DevisRow[]) {
    if (!d.date_debut_travaux) continue;
    const start = d.date_debut_travaux;
    let end = start;
    if (d.duree_estimee_jours && d.duree_estimee_jours > 1) {
      const endDate = new Date(start + "T00:00:00Z");
      endDate.setUTCDate(endDate.getUTCDate() + d.duree_estimee_jours - 1);
      end = endDate.toISOString().slice(0, 10);
    }
    events.push({
      id: d.id,
      kind: "devis_planifie",
      date_start: start,
      date_end: end,
      title: `Devis ${d.numero}`,
      client_nom: d.client?.nom ?? null,
      href: `/devis/${d.id}`,
      statut: d.statut,
      numero: d.numero,
      type_activite: d.type_activite,
    });
  }

  type ContratRow = {
    id: string;
    intitule: string | null;
    prochaine_visite: string | null;
    statut: string;
    client: { nom: string } | null;
  };
  for (const c of (contratsRes.data ?? []) as ContratRow[]) {
    if (!c.prochaine_visite) continue;
    events.push({
      id: c.id,
      kind: "visite_maintenance",
      date_start: c.prochaine_visite,
      date_end: c.prochaine_visite,
      title: c.intitule || "Visite maintenance",
      client_nom: c.client?.nom ?? null,
      href: `/maintenance/${c.id}`,
    });
  }

  // Stats restreintes au mois affiché (pas la fenêtre élargie)
  const startMonthIso = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonthIso = lastOfMonth.toISOString().slice(0, 10);
  const inMonth = (e: AgendaEvent) =>
    e.date_end >= startMonthIso && e.date_start <= endMonthIso;

  const interventionsInMonth = events.filter(
    (e) => e.kind === "intervention" && inMonth(e),
  );
  const stats = {
    nbInterventions: interventionsInMonth.length,
    nbInterventionsAFacturer: interventionsInMonth.filter(
      (e) => !e.facture_emise,
    ).length,
    nbFactures: events.filter(
      (e) => e.kind === "facture_prestation" && inMonth(e),
    ).length,
    nbDevis: events.filter((e) => e.kind === "devis_planifie" && inMonth(e))
      .length,
    nbVisites: events.filter(
      (e) => e.kind === "visite_maintenance" && inMonth(e),
    ).length,
  };

  return { year, month, events, stats };
}
