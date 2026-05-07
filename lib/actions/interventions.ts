"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  interventionSchema,
  type InterventionFormValues,
} from "@/lib/validations/intervention";
import type { Database } from "@/types/database";

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

export async function deleteInterventionAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("interventions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  return { ok: true, data: undefined };
}
