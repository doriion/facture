"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  computeExternalEventKey,
  type ExternalEventKeyInput,
} from "@/lib/external-event-key";
import { parseIcal } from "@/lib/ical-parser";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Input persistant côté formulaire : pour chaque event externe coché,
 * on a besoin du snapshot complet (pour calculer la clé serveur ET
 * stocker un audit affichable si l'event disparaît du flux).
 */
export type ExternalEventLink = ExternalEventKeyInput & {
  date_end?: string;
};

/**
 * Liste des événements actuellement couverts par une facture donnée.
 * Renvoie `interventionIds` (déjà liées via interventions.facture_id)
 * et `externalUids` (rangs dans facture_external_events).
 */
export async function getFactureCoveredEvents(factureId: string): Promise<{
  interventionIds: string[];
  externalUids: string[];
}> {
  const supabase = createClient();
  const [interventionsRes, externalsRes] = await Promise.all([
    supabase
      .from("interventions")
      .select("id")
      .eq("facture_id", factureId),
    supabase
      .from("facture_external_events")
      .select("external_uid")
      .eq("facture_id", factureId),
  ]);
  return {
    interventionIds: (interventionsRes.data ?? []).map((r) => r.id),
    externalUids: (externalsRes.data ?? []).map((r) => r.external_uid),
  };
}

/**
 * Met à jour les liens d'une facture vers les événements qu'elle couvre.
 *
 * - Interventions : update interventions.facture_id (set / unset).
 * - Externals : delete + reinsert dans facture_external_events.
 *
 * Idempotent : appeler plusieurs fois avec la même payload ne change rien.
 */
export async function setFactureCoveredEventsAction(
  factureId: string,
  payload: {
    interventionIds: string[];
    externalEvents: ExternalEventLink[];
  },
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Vérifie que la facture appartient à l'utilisateur (RLS l'aurait
  // bloquée sinon mais on remonte une erreur claire).
  const { data: facture } = await supabase
    .from("factures")
    .select("id")
    .eq("id", factureId)
    .maybeSingle();
  if (!facture) return { ok: false, error: "Facture introuvable." };

  // --- Interventions ---
  // 1) Détacher toutes celles qui étaient liées à cette facture mais
  //    plus dans la nouvelle liste.
  const { data: actuelles } = await supabase
    .from("interventions")
    .select("id")
    .eq("facture_id", factureId);
  const actuellesIds = new Set(
    (actuelles ?? []).map((r) => r.id as string),
  );
  const nouvellesIds = new Set(payload.interventionIds);
  const aDetacher = Array.from(actuellesIds).filter(
    (id) => !nouvellesIds.has(id),
  );
  const aAttacher = payload.interventionIds.filter(
    (id) => !actuellesIds.has(id),
  );

  if (aDetacher.length > 0) {
    const { error } = await supabase
      .from("interventions")
      .update({ facture_id: null })
      .in("id", aDetacher);
    if (error) return { ok: false, error: error.message };
  }

  if (aAttacher.length > 0) {
    // On refuse d'attacher une intervention déjà liée à une AUTRE facture
    // (sinon on l'arrache à l'autre facture sans avertir l'utilisateur).
    const { data: conflits } = await supabase
      .from("interventions")
      .select("id, facture_id")
      .in("id", aAttacher);
    const conflit = (conflits ?? []).find(
      (r) => r.facture_id && r.facture_id !== factureId,
    );
    if (conflit) {
      return {
        ok: false,
        error: `L'intervention ${conflit.id} est déjà liée à une autre facture.`,
      };
    }
    const { error } = await supabase
      .from("interventions")
      .update({ facture_id: factureId })
      .in("id", aAttacher);
    if (error) return { ok: false, error: error.message };
  }

  // --- Externals ---
  // Stratégie : on remplace l'ensemble. Delete-all puis insert.
  // Atomique côté Supabase grâce à la contrainte unique (facture, uid).
  const { error: delErr } = await supabase
    .from("facture_external_events")
    .delete()
    .eq("facture_id", factureId);
  if (delErr) return { ok: false, error: delErr.message };

  if (payload.externalEvents.length > 0) {
    const rows = payload.externalEvents.map((ev) => {
      const key = computeExternalEventKey(ev);
      return {
        user_id: user.id,
        facture_id: factureId,
        source: "ical_external",
        external_uid: key.external_uid,
        fallback_key: key.fallback_key,
        snapshot_title: ev.title,
        snapshot_date_start: ev.date_start,
        snapshot_date_end: ev.date_end ?? ev.date_start,
      };
    });
    const { error: insErr } = await supabase
      .from("facture_external_events")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath(`/factures/${factureId}`);
  revalidatePath("/factures");
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}

/**
 * Liste les évènements qui peuvent être cochés sur une facture donnée :
 * - interventions non rattachées à une autre facture (ou déjà à celle-ci)
 * - RDV iPhone du flux externe pas encore rattachés (ou déjà à celle-ci)
 *
 * Filtre temporel : ±N jours autour de la date d'émission de la facture
 * (paramètre `windowDays`). Sans filtre client : l'utilisateur peut tout
 * voir, à lui de cocher.
 */
export async function getAvailableEventsForFacture(args: {
  factureId: string;
  centerDate?: string; // YYYY-MM-DD, défaut = today
  windowDays?: number; // défaut = 90
}): Promise<{
  interventions: Array<{
    id: string;
    date_intervention: string;
    date_fin: string | null;
    description: string | null;
    type: string;
    client_nom: string | null;
    facture_id: string | null;
    already_linked_here: boolean;
  }>;
  externals: Array<{
    uid: string;
    title: string;
    date_start: string;
    date_end: string;
    time_start: string | null;
    linked_facture_id: string | null;
    already_linked_here: boolean;
  }>;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { interventions: [], externals: [] };

  const center = args.centerDate ?? new Date().toISOString().slice(0, 10);
  const windowDays = args.windowDays ?? 90;
  const fromMs =
    new Date(center + "T00:00:00Z").getTime() -
    windowDays * 24 * 3600 * 1000;
  const toMs =
    new Date(center + "T00:00:00Z").getTime() +
    windowDays * 24 * 3600 * 1000;
  const from = new Date(fromMs).toISOString().slice(0, 10);
  const to = new Date(toMs).toISOString().slice(0, 10);

  // --- Interventions : sans facture OU déjà liées à celle-ci ---
  const { data: interventionsRaw } = await supabase
    .from("interventions")
    .select(
      "id, date_intervention, date_fin, description, type, facture_id, client:clients(nom)",
    )
    .gte("date_intervention", from)
    .lte("date_intervention", to)
    .or(`facture_id.is.null,facture_id.eq.${args.factureId}`)
    .order("date_intervention", { ascending: false });

  type IntervRow = {
    id: string;
    date_intervention: string;
    date_fin: string | null;
    description: string | null;
    type: string;
    facture_id: string | null;
    client: { nom: string } | null;
  };
  const interventions = ((interventionsRaw ?? []) as IntervRow[]).map(
    (r) => ({
      id: r.id,
      date_intervention: r.date_intervention,
      date_fin: r.date_fin,
      description: r.description,
      type: r.type,
      client_nom: r.client?.nom ?? null,
      facture_id: r.facture_id,
      already_linked_here: r.facture_id === args.factureId,
    }),
  );

  // --- Externals : on doit fetcher le flux iCal puis filtrer ---
  const { data: profil } = await supabase
    .from("profil_entreprise")
    .select("external_calendar_url")
    .maybeSingle();

  let externals: Array<{
    uid: string;
    title: string;
    date_start: string;
    date_end: string;
    time_start: string | null;
    linked_facture_id: string | null;
    already_linked_here: boolean;
  }> = [];

  if (profil?.external_calendar_url) {
    try {
      const res = await fetch(profil.external_calendar_url, {
        next: { revalidate: 300 },
        headers: { Accept: "text/calendar, text/plain, */*" },
      });
      if (res.ok) {
        const text = await res.text();
        const events = parseIcal(text);

        // Charge tous les links existants pour ce user (sur la même fenêtre)
        const { data: links } = await supabase
          .from("facture_external_events")
          .select("external_uid, facture_id")
          .gte("snapshot_date_start", from)
          .lte("snapshot_date_start", to);
        const linkByUid = new Map<string, string>();
        for (const l of links ?? []) {
          linkByUid.set(l.external_uid, l.facture_id);
        }

        externals = events
          .filter(
            (ev) => ev.date_start >= from && ev.date_start <= to,
          )
          .map((ev) => {
            const key = computeExternalEventKey({
              uid: ev.uid,
              date_start: ev.date_start,
              title: ev.summary,
            });
            const linked = linkByUid.get(key.external_uid) ?? null;
            return {
              uid: key.external_uid,
              title: ev.summary,
              date_start: ev.date_start,
              date_end: ev.date_end,
              time_start: ev.time_start,
              linked_facture_id: linked,
              already_linked_here: linked === args.factureId,
            };
          })
          .sort((a, b) => (a.date_start < b.date_start ? 1 : -1));
      }
    } catch {
      // silencieux : le formulaire fonctionnera sans la section externals
    }
  }

  return { interventions, externals };
}
