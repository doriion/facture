"use server";

import { createClient } from "@/lib/supabase/server";
import { parseIcal } from "@/lib/ical-parser";
import { computeExternalEventKey } from "@/lib/external-event-key";
import { adresseClient } from "@/lib/agenda-contact";
import { aujourdhuiParis } from "@/lib/agenda-facturation";
import { fenetreAgenda, type Fenetre } from "@/lib/agenda-vues";
import type { Frequence, Recurrence } from "@/lib/agenda-recurrence";

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
  /** Interventions : false = « rien à facturer » (déplacement, outils, perso). */
  a_facturer?: boolean;
  numero?: string | null;
  type_activite?: string | null;
  /** Interventions : série de rendez-vous récurrents (null = isolé). */
  serie_id?: string | null;
  /** Règle de la série, pour l'afficher (« toutes les semaines jusqu'au… »). */
  recurrence?: Recurrence | null;
  /** LOCATION iCal d'un RDV iPhone (adresse saisie sur le téléphone). */
  lieu?: string | null;
  /** Adresse postale du client rattaché (pour « Itinéraire »). */
  client_adresse?: string | null;
  /** Téléphone du client rattaché (pour « Appeler »). */
  client_telephone?: string | null;
};

/** Intervention passée, sans facture ni « rien à facturer » — panneau À facturer. */
export type AFacturerItem = {
  id: string;
  date_intervention: string;
  date_fin: string | null;
  description: string | null;
  type: string;
  client_id: string | null;
  client_nom: string | null;
};

export type AgendaData = {
  year: number;
  month: number; // 1-12
  /** Évènements de la base (interventions, factures, devis, visites) sur la fenêtre. */
  events: AgendaEvent[];
  /**
   * Toutes les interventions passées à facturer, quel que soit le mois
   * affiché (une facture oubliée ne doit pas disparaître en changeant
   * de mois).
   */
  aFacturer: AFacturerItem[];
  /** Plage de jours chargée : le client navigue dedans sans recharger. */
  fenetre: Fenetre;
};

/** RDV iPhone (calendrier externe), chargés après l'affichage pour ne pas le retarder. */
export type AgendaExternes = {
  events: AgendaEvent[];
  /** True si l'utilisateur a un calendrier externe configuré */
  hasExternalCalendar: boolean;
  /** Message si le fetch du calendrier externe a échoué */
  error: string | null;
};

type ClientJoint = {
  nom: string;
  adresse_ligne1: string | null;
  adresse_ligne2: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
};
const coordonnees = (c: ClientJoint | null) => ({
  client_adresse: c ? adresseClient(c) : null,
  client_telephone: c?.telephone ?? null,
});
const SELECT_CLIENT = "client:clients(nom, adresse_ligne1, adresse_ligne2, code_postal, ville, telephone)";

/**
 * Évènements de la BASE (interventions, prestations facturées, devis
 * planifiés, visites de maintenance) sur la fenêtre du mois demandé —
 * élargie aux mois voisins par la page pour que le swipe reste local.
 * Les RDV iPhone sont chargés à part (getAgendaExternes) : leur fetch
 * réseau ne doit pas retarder l'affichage.
 */
export async function getAgendaEvents(
  year: number,
  month: number, // 1-12
  options: { depuis?: string; jusquau?: string } = {},
): Promise<AgendaData> {
  const supabase = createClient();
  const fenetre = fenetreAgenda(year, month, options);

  // Garde d'auth explicite : la RLS protège déjà les données, mais on
  // évite de requêter pour rien et on renvoie un résultat vide propre.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { year, month, events: [], aFacturer: [], fenetre };

  const ws = fenetre.debut;
  const we = fenetre.fin;
  const aujourdhui = aujourdhuiParis();

  const [interventionsRes, facturesRes, devisRes, contratsRes, aFacturerRes] =
    await Promise.all([
      supabase
        .from("interventions")
        .select(
          `id, date_intervention, date_fin, heure_debut, heure_fin, type, description, facture_id, a_facturer, client_id, serie_id, serie:interventions_series(frequence, intervalle, date_fin), ${SELECT_CLIENT}`,
        )
        // Pour les interventions multi-jours, on doit inclure celles qui
        // *intersectent* la fenêtre, pas seulement celles qui commencent dedans.
        .is("supprime_le", null)
        .gte("date_intervention", new Date(new Date(ws).getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10))
        .lte("date_intervention", we)
        .order("date_intervention", { ascending: true })
        .order("heure_debut", { ascending: true, nullsFirst: true }),
      supabase
        .from("factures")
        .select(`id, numero, statut, date_prestation, date_prestation_fin, type_activite, ${SELECT_CLIENT}`)
        .not("date_prestation", "is", null)
        .gte("date_prestation", ws)
        .lte("date_prestation", we)
        .order("date_prestation", { ascending: true }),
      supabase
        .from("devis")
        .select(`id, numero, statut, date_debut_travaux, duree_estimee_jours, type_activite, ${SELECT_CLIENT}`)
        .eq("est_modele", false)
        .not("date_debut_travaux", "is", null)
        .gte("date_debut_travaux", ws)
        .lte("date_debut_travaux", we)
        .order("date_debut_travaux", { ascending: true }),
      supabase
        .from("contrats_maintenance")
        .select(`id, intitule, prochaine_visite, statut, ${SELECT_CLIENT}`)
        .eq("statut", "actif")
        .not("prochaine_visite", "is", null)
        .gte("prochaine_visite", ws)
        .lte("prochaine_visite", we)
        .order("prochaine_visite", { ascending: true }),
      // Panneau « À facturer » : passées, sans facture, pas « rien à facturer »,
      // tous mois confondus.
      supabase
        .from("interventions")
        .select("id, date_intervention, date_fin, description, type, client_id, client:clients(nom)")
        .is("facture_id", null)
        .is("supprime_le", null)
        .eq("a_facturer", true)
        .lte("date_intervention", aujourdhui)
        .order("date_intervention", { ascending: false })
        .limit(200),
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
    a_facturer: boolean | null;
    client_id: string | null;
    serie_id: string | null;
    serie: { frequence: string; intervalle: number; date_fin: string } | null;
    client: ClientJoint | null;
  };
  for (const it of (interventionsRes.data ?? []) as InterventionRow[]) {
    const end = it.date_fin ?? it.date_intervention;
    // Filtre côté Node : ignorer les interventions dont la plage est
    // entièrement hors de la fenêtre.
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
      a_facturer: it.a_facturer ?? true,
      type_activite: it.type,
      serie_id: it.serie_id,
      recurrence: it.serie
        ? { frequence: it.serie.frequence as Frequence, intervalle: it.serie.intervalle, date_fin: it.serie.date_fin }
        : null,
      ...coordonnees(it.client),
    });
  }

  type FactureRow = {
    id: string;
    numero: string;
    statut: string;
    date_prestation: string | null;
    date_prestation_fin: string | null;
    type_activite: string | null;
    client: ClientJoint | null;
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
      ...coordonnees(f.client),
    });
  }

  type DevisRow = {
    id: string;
    numero: string;
    statut: string;
    date_debut_travaux: string | null;
    duree_estimee_jours: number | null;
    type_activite: string | null;
    client: ClientJoint | null;
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
      ...coordonnees(d.client),
    });
  }

  type ContratRow = {
    id: string;
    intitule: string | null;
    prochaine_visite: string | null;
    statut: string;
    client: ClientJoint | null;
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
      ...coordonnees(c.client),
    });
  }

  type AFacturerRow = {
    id: string;
    date_intervention: string;
    date_fin: string | null;
    description: string | null;
    type: string;
    client_id: string | null;
    client: { nom: string } | null;
  };
  const aFacturer: AFacturerItem[] = ((aFacturerRes.data ?? []) as AFacturerRow[]).map((r) => ({
    id: r.id,
    date_intervention: r.date_intervention,
    date_fin: r.date_fin,
    description: r.description,
    type: r.type,
    client_id: r.client_id,
    client_nom: r.client?.nom ?? null,
  }));

  return { year, month, events, aFacturer, fenetre };
}

/**
 * RDV iPhone (calendrier iCloud / Google publié) sur la fenêtre, avec
 * leur rattachement éventuel à une facture. Appelé par le client APRÈS
 * l'affichage de l'agenda : si iCloud est lent, l'agenda ne l'est pas.
 */
export async function getAgendaExternes(fenetre: Fenetre): Promise<AgendaExternes> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { events: [], hasExternalCalendar: false, error: "Non authentifié." };

  const profilExternalRes = await supabase
    .from("profil_entreprise")
    .select("external_calendar_url")
    .maybeSingle();
  const externalUrl = profilExternalRes.data?.external_calendar_url ?? null;
  if (!externalUrl) return { events: [], hasExternalCalendar: false, error: null };

  const ws = fenetre.debut;
  const we = fenetre.fin;
  const [externalEventsRes, externalLinksRes, reprisRes] = await Promise.all([
    fetchExternalCalendar(externalUrl),
    // Liens RDV iPhone → factures (fenêtre ±60 j, on filtre côté code par UID).
    supabase
      .from("facture_external_events")
      .select("external_uid, facture_id, factures:factures(numero)")
      .gte("snapshot_date_start", new Date(new Date(ws).getTime() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10))
      .lte("snapshot_date_start", new Date(new Date(we).getTime() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)),
    // RDV iPhone REPRIS comme interventions : leur copie externe est masquée.
    supabase
      .from("external_events_importes")
      .select("external_uid")
      .gte("snapshot_date_start", new Date(new Date(ws).getTime() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10))
      .lte("snapshot_date_start", new Date(new Date(we).getTime() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)),
  ]);
  const repris = new Set((reprisRes.data ?? []).map((r) => r.external_uid));

  // Construction d'une map UID → facture liée pour le match O(1).
  type LinkRow = {
    external_uid: string;
    facture_id: string;
    factures: { numero: string } | { numero: string }[] | null;
  };
  const externalLinkByUid = new Map<string, { facture_id: string; numero: string }>();
  for (const link of (externalLinksRes.data ?? []) as LinkRow[]) {
    const factureRel = Array.isArray(link.factures) ? link.factures[0] : link.factures;
    externalLinkByUid.set(link.external_uid, {
      facture_id: link.facture_id,
      numero: factureRel?.numero ?? "",
    });
  }

  const events: AgendaEvent[] = [];
  for (const ext of externalEventsRes.events) {
    if (ext.date_end < ws || ext.date_start > we) continue;
    // Clé canonique (UID iCal ou fallback hash) : c'est elle qu'on a
    // stockée si l'utilisateur a déjà coché l'event dans une facture.
    const key = computeExternalEventKey({
      uid: ext.uid,
      date_start: ext.date_start,
      title: ext.summary,
    });
    if (repris.has(key.external_uid)) continue;
    const linked = externalLinkByUid.get(key.external_uid);
    events.push({
      id: key.external_uid,
      kind: "external",
      date_start: ext.date_start,
      date_end: ext.date_end,
      title: ext.summary,
      description: ext.description,
      lieu: ext.location,
      client_nom: null,
      client_id: null,
      heure_debut: ext.time_start ? ext.time_start + ":00" : null,
      heure_fin: ext.time_end ? ext.time_end + ":00" : null,
      facture_emise: Boolean(linked),
      numero: linked?.numero ?? null,
      // Si facturé → href vers la facture liée ; sinon le pill reste
      // non-cliquable (vue read-only).
      href: linked ? `/factures/${linked.facture_id}` : "#",
    });
  }

  return { events, hasExternalCalendar: true, error: externalEventsRes.error };
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
