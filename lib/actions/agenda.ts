"use server";

import { createClient } from "@/lib/supabase/server";
import { parseIcal } from "@/lib/ical-parser";

export type AgendaEventKind =
  | "intervention"
  | "facture_prestation"
  | "devis_planifie"
  | "visite_maintenance"
  | "external";

export type AgendaEvent = {
  id: string;
  kind: AgendaEventKind;
  date_start: string; // YYYY-MM-DD
  date_end: string;   // YYYY-MM-DD (= date_start si single-day)
  title: string;
  /** Description libre saisie par l'utilisateur (sépare le « titre fallback » du contenu réellement tapé) */
  description: string | null;
  client_nom: string | null;
  client_id: string | null;
  href: string;
  statut?: string | null;
  /** HH:MM:SS — null si évènement all-day */
  heure_debut: string | null;
  heure_fin: string | null;
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
    nbExternal: number;
  };
  /** True si l'utilisateur a un calendrier externe configuré */
  hasExternalCalendar: boolean;
  /** True si le fetch du calendrier externe a échoué */
  externalCalendarError: string | null;
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

  // Récupération de l'URL externe pour fetcher en parallèle des requêtes DB
  const profilExternalRes = await supabase
    .from("profil_entreprise")
    .select("external_calendar_url")
    .maybeSingle();
  const externalUrl = profilExternalRes.data?.external_calendar_url ?? null;

  const [
    interventionsRes,
    facturesRes,
    devisRes,
    contratsRes,
    externalEventsRes,
  ] = await Promise.all([
    supabase
      .from("interventions")
      .select(
        "id, date_intervention, date_fin, heure_debut, heure_fin, type, description, facture_id, client_id, client:clients(nom)",
      )
      // Pour les interventions multi-jours, on doit inclure celles qui
      // *intersectent* la fenêtre, pas seulement celles qui commencent dedans.
      .gte("date_intervention", new Date(new Date(ws).getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10))
      .lte("date_intervention", we)
      .order("date_intervention", { ascending: true })
      .order("heure_debut", { ascending: true, nullsFirst: true }),
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
    fetchExternalCalendar(externalUrl),
  ]);

  const events: AgendaEvent[] = [];

  type InterventionRow = {
    id: string;
    date_intervention: string;
    date_fin: string | null;
    heure_debut: string | null;
    heure_fin: string | null;
    type: string;
    description: string | null;
    facture_id: string | null;
    client_id: string;
    client: { nom: string } | null;
  };
  for (const it of (interventionsRes.data ?? []) as InterventionRow[]) {
    const end = it.date_fin ?? it.date_intervention;
    // Filtre côté Node : ignorer les interventions dont la plage est
    // entièrement hors de la fenêtre du calendrier.
    if (end < ws) continue;
    events.push({
      id: it.id,
      kind: "intervention",
      date_start: it.date_intervention,
      date_end: end,
      title: it.description || it.type || "Intervention",
      description: it.description,
      client_nom: it.client?.nom ?? null,
      client_id: it.client_id,
      heure_debut: it.heure_debut,
      heure_fin: it.heure_fin,
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
      description: null,
      client_nom: f.client?.nom ?? null,
      client_id: null,
      heure_debut: null,
      heure_fin: null,
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
      description: null,
      client_nom: d.client?.nom ?? null,
      client_id: null,
      heure_debut: null,
      heure_fin: null,
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
      description: null,
      client_nom: c.client?.nom ?? null,
      client_id: null,
      heure_debut: null,
      heure_fin: null,
      href: `/maintenance/${c.id}`,
    });
  }

  // Évènements externes (calendrier iCloud / Google publié)
  for (const ext of externalEventsRes.events) {
    // Ne garde que ceux dans la fenêtre du mois (élargie)
    if (ext.date_end < ws || ext.date_start > we) continue;
    events.push({
      id: ext.uid,
      kind: "external",
      date_start: ext.date_start,
      date_end: ext.date_end,
      title: ext.summary,
      description: ext.description,
      client_nom: null,
      client_id: null,
      heure_debut: ext.time_start ? ext.time_start + ":00" : null,
      heure_fin: ext.time_end ? ext.time_end + ":00" : null,
      // Pas de fiche associée — on garde le lien vers /agenda lui-même
      // (clic = no-op équivalent, juste un visuel non cliquable).
      href: "#",
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
    nbExternal: events.filter((e) => e.kind === "external" && inMonth(e))
      .length,
  };

  return {
    year,
    month,
    events,
    stats,
    hasExternalCalendar: Boolean(externalUrl),
    externalCalendarError: externalEventsRes.error,
  };
}

/**
 * Fetch + parse un flux iCal externe. Tolérant aux erreurs : si l'URL
 * est absente ou le fetch échoue, renvoie une liste vide + l'erreur.
 * Cache HTTP 5 min pour limiter les appels répétés.
 */
async function fetchExternalCalendar(
  url: string | null,
): Promise<{
  events: ReturnType<typeof parseIcal>;
  error: string | null;
}> {
  if (!url) return { events: [], error: null };
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
    if (!res.ok) {
      return {
        events: [],
        error: `Le calendrier externe a renvoyé HTTP ${res.status}.`,
      };
    }
    const text = await res.text();
    return { events: parseIcal(text), error: null };
  } catch (e) {
    return {
      events: [],
      error: e instanceof Error ? e.message : "Échec du fetch du calendrier.",
    };
  }
}
