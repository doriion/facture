"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { clientSchema, type ClientFormValues } from "@/lib/validations/client";
import { stripSpaces } from "@/lib/format";
import type { Database } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Client = Database["public"]["Tables"]["clients"]["Row"];

/**
 * Liste des clients avec recherche optionnelle (sur nom, ville, email).
 */
export async function listClients(params?: { search?: string; type?: string }) {
  const supabase = createClient();
  let query = supabase
    .from("clients")
    .select("*")
    .order("nom", { ascending: true });

  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(
      `nom.ilike.${s},ville.ilike.${s},email.ilike.${s},raison_sociale.ilike.${s}`,
    );
  }
  if (params?.type && params.type !== "tous") {
    query = query.eq("type", params.type);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Récupère un client par id, ainsi que les compteurs de factures et devis
 * pour la page de détail.
 */
export async function getClient(id: string): Promise<{
  client: Client | null;
  factures: Database["public"]["Tables"]["factures"]["Row"][];
  devis: Database["public"]["Tables"]["devis"]["Row"][];
}> {
  const supabase = createClient();
  const [{ data: client }, { data: factures }, { data: devis }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("factures")
      .select("*")
      .eq("client_id", id)
      .order("date_emission", { ascending: false }),
    supabase
      .from("devis")
      .select("*")
      .eq("client_id", id)
      // Les modèles gardent leur client d'origine mais ne doivent pas
      // apparaître dans l'historique du client.
      .eq("est_modele", false)
      .order("date_emission", { ascending: false }),
  ]);

  return {
    client,
    factures: factures ?? [],
    devis: devis ?? [],
  };
}

/**
 * Crée un nouveau client.
 */
export async function createClientAction(
  values: ClientFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const v = parsed.data;
  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      nom: v.nom,
      type: v.type,
      siret: v.siret ? stripSpaces(v.siret) : null,
      raison_sociale: v.raison_sociale || null,
      adresse_ligne1: v.adresse_ligne1 || null,
      adresse_ligne2: v.adresse_ligne2 || null,
      code_postal: v.code_postal || null,
      ville: v.ville || null,
      pays: v.pays || "France",
      email: v.email || null,
      telephone: v.telephone || null,
      notes: v.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/clients");
  return { ok: true, data: { id: data.id } };
}

/**
 * Met à jour un client existant.
 */
export async function updateClientAction(
  id: string,
  values: ClientFormValues,
): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const supabase = createClient();
  const v = parsed.data;
  const { error } = await supabase
    .from("clients")
    .update({
      nom: v.nom,
      type: v.type,
      siret: v.siret ? stripSpaces(v.siret) : null,
      raison_sociale: v.raison_sociale || null,
      adresse_ligne1: v.adresse_ligne1 || null,
      adresse_ligne2: v.adresse_ligne2 || null,
      code_postal: v.code_postal || null,
      ville: v.ville || null,
      pays: v.pays || "France",
      email: v.email || null,
      telephone: v.telephone || null,
      notes: v.notes || null,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Supprime un client. Échouera (FK restrict) si le client a des factures ou devis.
 */
export async function deleteClientAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    // Erreur 23503 = violation de FK (le client a encore des documents)
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "Ce client a des factures ou des devis. Supprimez-les d'abord ou archivez le client.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/clients");
  return { ok: true, data: undefined };
}
