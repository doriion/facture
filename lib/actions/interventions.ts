"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  interventionSchema,
  LABELS_TYPE_INTERVENTION,
  type InterventionFormValues,
} from "@/lib/validations/intervention";
import type { Database, Json } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Intervention = Database["public"]["Tables"]["interventions"]["Row"];

/**
 * Liste des interventions, optionnellement filtrées par client/type/période.
 */
export async function listInterventions(params?: {
  search?: string;
  type?: string;
  client_id?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("interventions")
    .select("*, client:clients(id, nom, type)")
    .order("date_intervention", { ascending: false });

  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(
      `description.ilike.${s},equipement_marque.ilike.${s},equipement_modele.ilike.${s},equipement_num_serie.ilike.${s}`,
    );
  }
  if (params?.type && params.type !== "tous") {
    query = query.eq("type", params.type);
  }
  if (params?.client_id) {
    query = query.eq("client_id", params.client_id);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getIntervention(id: string): Promise<{
  intervention: Intervention | null;
  client: Database["public"]["Tables"]["clients"]["Row"] | null;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("interventions")
    .select("*, client:clients(*)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { intervention: null, client: null };

  type WithClient = NonNullable<typeof data> & {
    client: Database["public"]["Tables"]["clients"]["Row"] | null;
  };
  const { client, ...intervention } = data as WithClient;
  return { intervention, client };
}

/**
 * Bilan annuel des fluides frigorigènes manipulés (utile pour la
 * déclaration F-Gas et le rapport au client).
 */
export async function bilanFluidesFrigo(annee?: number) {
  const supabase = createClient();
  const year = annee ?? new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const { data } = await supabase
    .from("interventions")
    .select(
      "fluide_frigo_type,fluide_frigo_kg_ajoute,fluide_frigo_kg_recupere",
    )
    .gte("date_intervention", start)
    .lt("date_intervention", end);

  const bilan: Record<string, { ajoute: number; recupere: number }> = {};
  for (const row of data ?? []) {
    const fluide = row.fluide_frigo_type ?? "Inconnu";
    if (!bilan[fluide]) bilan[fluide] = { ajoute: 0, recupere: 0 };
    bilan[fluide].ajoute += Number(row.fluide_frigo_kg_ajoute ?? 0);
    bilan[fluide].recupere += Number(row.fluide_frigo_kg_recupere ?? 0);
  }
  return { annee: year, bilan };
}

export async function createInterventionAction(
  values: InterventionFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = interventionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data, error } = await supabase
    .from("interventions")
    .insert({
      user_id: user.id,
      client_id: v.client_id,
      date_intervention: v.date_intervention,
      date_fin: v.date_fin || null,
      heure_debut: v.heure_debut || null,
      heure_fin: v.heure_fin || null,
      type: v.type,
      description: v.description || null,
      equipement_marque: v.equipement_marque || null,
      equipement_modele: v.equipement_modele || null,
      equipement_num_serie: v.equipement_num_serie || null,
      fluide_frigo_type: v.fluide_frigo_type || null,
      fluide_frigo_kg_ajoute: v.fluide_frigo_kg_ajoute,
      fluide_frigo_kg_recupere: v.fluide_frigo_kg_recupere,
      duree_minutes: v.duree_minutes,
      facture_id: v.facture_id ?? null,
      notes: v.notes || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Échec de la création." };
  }

  revalidatePath("/interventions");
  return { ok: true, data: { id: data.id } };
}

export async function updateInterventionAction(
  id: string,
  values: InterventionFormValues,
): Promise<ActionResult> {
  const parsed = interventionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const { error } = await supabase
    .from("interventions")
    .update({
      client_id: v.client_id,
      date_intervention: v.date_intervention,
      date_fin: v.date_fin || null,
      heure_debut: v.heure_debut || null,
      heure_fin: v.heure_fin || null,
      type: v.type,
      description: v.description || null,
      equipement_marque: v.equipement_marque || null,
      equipement_modele: v.equipement_modele || null,
      equipement_num_serie: v.equipement_num_serie || null,
      fluide_frigo_type: v.fluide_frigo_type || null,
      fluide_frigo_kg_ajoute: v.fluide_frigo_kg_ajoute,
      fluide_frigo_kg_recupere: v.fluide_frigo_kg_recupere,
      duree_minutes: v.duree_minutes,
      facture_id: v.facture_id ?? null,
      notes: v.notes || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  revalidatePath(`/interventions/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Crée une facture brouillon pré-remplie à partir d'une intervention puis
 * relie les deux via `interventions.facture_id`. L'intervention bascule
 * alors de « à facturer » à « facturée » dans l'agenda.
 *
 * La facture reprend le client, la période de prestation, l'équipement et
 * une ligne pré-remplie (prix à 0, à compléter). Refuse si l'intervention
 * est déjà rattachée à une facture.
 */
export async function facturerInterventionAction(
  interventionId: string,
): Promise<ActionResult<{ factureId: string; numero: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: intervention } = await supabase
    .from("interventions")
    .select("*")
    .eq("id", interventionId)
    .maybeSingle();
  if (!intervention) return { ok: false, error: "Intervention introuvable." };
  if (intervention.facture_id) {
    return {
      ok: false,
      error: "Cette intervention est déjà rattachée à une facture.",
    };
  }

  // Numérotation atomique (même RPC que la création directe de facture)
  const { data: numero, error: numeroErr } = await supabase.rpc(
    "next_document_number",
    { p_type: "facture" },
  );
  if (numeroErr || !numero) {
    return {
      ok: false,
      error: numeroErr?.message ?? "Échec de la génération du numéro.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const echeance = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  // Équipement repris de l'intervention (JSONB facture)
  const equipement: Record<string, string> = {};
  if (intervention.equipement_marque)
    equipement.marque = intervention.equipement_marque;
  if (intervention.equipement_modele)
    equipement.modele = intervention.equipement_modele;
  if (intervention.equipement_num_serie)
    equipement.num_serie = intervention.equipement_num_serie;
  if (intervention.fluide_frigo_type)
    equipement.fluide_frigo_type = intervention.fluide_frigo_type;

  const { data: facture, error: insertErr } = await supabase
    .from("factures")
    .insert({
      user_id: user.id,
      numero,
      client_id: intervention.client_id,
      date_emission: today,
      date_echeance: echeance,
      date_prestation: intervention.date_intervention,
      date_prestation_fin: intervention.date_fin,
      type_activite: factureTypeFromIntervention(intervention.type),
      statut: "brouillon",
      total_ht: 0,
      notes: `Facturation de l'intervention du ${intervention.date_intervention}.`,
      equipement_info: equipement as Json,
    })
    .select("id, numero")
    .single();

  if (insertErr || !facture) {
    return {
      ok: false,
      error: insertErr?.message ?? "Échec de la création de la facture.",
    };
  }

  // Ligne pré-remplie : reprend la description (ou le type), prix à compléter.
  const designation =
    intervention.description?.trim() ||
    LABELS_TYPE_INTERVENTION[
      intervention.type as keyof typeof LABELS_TYPE_INTERVENTION
    ] ||
    "Prestation";
  const { error: ligneErr } = await supabase.from("factures_lignes").insert({
    user_id: user.id,
    facture_id: facture.id,
    ordre: 0,
    designation,
    quantite: 1,
    prix_unitaire_ht: 0,
    total_ht: 0,
  });
  if (ligneErr) {
    // Rollback best-effort de la facture orpheline
    await supabase.from("factures").delete().eq("id", facture.id);
    return { ok: false, error: ligneErr.message };
  }

  // Lien intervention → facture (passe l'intervention en « facturée »)
  const { error: linkErr } = await supabase
    .from("interventions")
    .update({ facture_id: facture.id })
    .eq("id", interventionId);
  if (linkErr) {
    await supabase.from("factures").delete().eq("id", facture.id);
    return { ok: false, error: linkErr.message };
  }

  revalidatePath("/interventions");
  revalidatePath(`/interventions/${interventionId}`);
  revalidatePath("/agenda");
  revalidatePath("/factures");
  return { ok: true, data: { factureId: facture.id, numero: facture.numero } };
}

export async function deleteInterventionAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("interventions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}

/**
 * Mise à jour partielle utilisée par le dialogue rapide depuis l'agenda :
 * ne touche que les champs édités (planning + métadonnées), préserve
 * équipement / fluides / notes / facture_id. À utiliser à la place de
 * updateInterventionAction quand seul le planning est modifié.
 */
export async function quickEditInterventionAction(
  id: string,
  partial: {
    client_id: string;
    date_intervention: string;
    date_fin: string | null;
    heure_debut: string | null;
    heure_fin: string | null;
    type: string;
    description: string | null;
  },
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("interventions")
    .update({
      client_id: partial.client_id,
      date_intervention: partial.date_intervention,
      date_fin: partial.date_fin,
      heure_debut: partial.heure_debut,
      heure_fin: partial.heure_fin,
      type: partial.type,
      description: partial.description,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  revalidatePath(`/interventions/${id}`);
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}

/**
 * Traduit le type d'intervention vers le `type_activite` des factures
 * (jeux de valeurs distincts). Les types sans correspondance directe
 * (installation…) retombent sur « autre ».
 */
function factureTypeFromIntervention(type: string): string {
  switch (type) {
    case "depannage":
      return "depannage";
    case "entretien":
      return "entretien";
    default:
      return "autre";
  }
}
