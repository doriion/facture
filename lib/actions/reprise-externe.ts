"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { computeExternalEventKey } from "@/lib/external-event-key";
import { interventionDepuisRdv, rdvAReprendre, type RdvExterne } from "@/lib/reprise-externe";
import { aujourdhuiParis } from "@/lib/agenda-facturation";
import { getAgendaExternes } from "@/lib/actions/agenda";
import { ajouterJours } from "@/lib/agenda-vues";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Reprend UN RDV iPhone comme intervention NG Gestion : crée
 * l'intervention (mêmes date, heures, titre ; lieu et texte en notes ;
 * rattachée à la facture si le RDV l'était déjà) et enregistre la
 * correspondance pour masquer la copie iPhone. Idempotent : un RDV déjà
 * repris renvoie l'intervention existante.
 */
export async function reprendreRdvIphoneAction(
  rdv: RdvExterne,
): Promise<ActionResult<{ intervention_id: string; deja: boolean }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const key = computeExternalEventKey({ uid: rdv.id, date_start: rdv.date_start, title: rdv.title });

  const { data: existant } = await supabase
    .from("external_events_importes")
    .select("intervention_id")
    .eq("external_uid", key.external_uid)
    .maybeSingle();
  if (existant?.intervention_id) {
    return { ok: true, data: { intervention_id: existant.intervention_id, deja: true } };
  }

  // Déjà rattaché à une facture depuis l'agenda ? On garde le lien.
  const { data: lien } = await supabase
    .from("facture_external_events")
    .select("facture_id")
    .eq("external_uid", key.external_uid)
    .maybeSingle();

  const v = interventionDepuisRdv(rdv);
  const { data: intervention, error } = await supabase
    .from("interventions")
    .insert({
      user_id: user.id,
      client_id: null,
      date_intervention: v.date_intervention,
      date_fin: v.date_fin,
      heure_debut: v.heure_debut,
      heure_fin: v.heure_fin,
      type: v.type,
      description: v.description,
      notes: v.notes,
      facture_id: lien?.facture_id ?? null,
      a_facturer: true,
    })
    .select("id")
    .single();
  if (error || !intervention) {
    return { ok: false, error: error?.message ?? "Échec de la création." };
  }

  const { error: erreurLien } = await supabase.from("external_events_importes").upsert(
    {
      user_id: user.id,
      external_uid: key.external_uid,
      fallback_key: key.fallback_key,
      intervention_id: intervention.id,
      snapshot_title: rdv.title,
      snapshot_date_start: rdv.date_start,
    },
    { onConflict: "user_id,external_uid" },
  );
  if (erreurLien) {
    // Pas d'intervention orpheline : on annule.
    await supabase.from("interventions").delete().eq("id", intervention.id);
    return { ok: false, error: erreurLien.message };
  }

  revalidatePath("/agenda");
  revalidatePath("/interventions");
  return { ok: true, data: { intervention_id: intervention.id, deja: false } };
}

/**
 * Reprend TOUS les RDV iPhone à venir (12 mois) pas encore repris —
 * pour basculer sur NG Gestion comme agenda principal en une fois.
 */
export async function reprendreTousLesRdvIphoneAction(): Promise<
  ActionResult<{ repris: number; erreurs: number }>
> {
  const aujourdhui = aujourdhuiParis();
  const externes = await getAgendaExternes({ debut: aujourdhui, fin: ajouterJours(aujourdhui, 365) });
  if (!externes.hasExternalCalendar) {
    return { ok: false, error: "Aucun calendrier téléphone configuré." };
  }
  if (externes.error) return { ok: false, error: externes.error };
  const aReprendre = rdvAReprendre(externes.events, aujourdhui);
  let repris = 0;
  let erreurs = 0;
  for (const e of aReprendre) {
    const r = await reprendreRdvIphoneAction(e);
    if (r.ok && !r.data.deja) repris += 1;
    else if (!r.ok) erreurs += 1;
  }
  revalidatePath("/agenda");
  revalidatePath("/parametres");
  return { ok: true, data: { repris, erreurs } };
}
