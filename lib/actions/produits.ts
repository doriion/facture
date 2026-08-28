"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  produitSchema,
  type ProduitFormValues,
} from "@/lib/validations/produit";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Liste des prestations du catalogue, filtrable par catégorie ou état actif.
 */
export async function listProduits(params?: {
  search?: string;
  categorie?: string;
  inclureInactifs?: boolean;
}) {
  const supabase = createClient();
  let query = supabase
    .from("produits_services")
    .select("*")
    .order("designation", { ascending: true });

  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(`designation.ilike.${s},description.ilike.${s}`);
  }
  if (params?.categorie && params.categorie !== "toutes") {
    query = query.eq("categorie", params.categorie);
  }
  if (!params?.inclureInactifs) {
    query = query.eq("actif", true);
  }

  const { data } = await query;
  return data ?? [];
}

export async function createProduitAction(
  values: ProduitFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = produitSchema.safeParse(values);
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
    .from("produits_services")
    .insert({
      user_id: user.id,
      designation: v.designation,
      description: v.description || null,
      prix_ht: v.prix_ht,
      unite: v.unite,
      categorie: v.categorie,
      nature_fiscale: v.nature_fiscale,
      tva_taux_suggere: v.tva_taux_suggere ?? null,
      actif: v.actif,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/produits");
  return { ok: true, data: { id: data.id } };
}

export async function updateProduitAction(
  id: string,
  values: ProduitFormValues,
): Promise<ActionResult> {
  const parsed = produitSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const supabase = createClient();
  const v = parsed.data;
  const { error } = await supabase
    .from("produits_services")
    .update({
      designation: v.designation,
      description: v.description || null,
      prix_ht: v.prix_ht,
      unite: v.unite,
      categorie: v.categorie,
      nature_fiscale: v.nature_fiscale,
      tva_taux_suggere: v.tva_taux_suggere ?? null,
      actif: v.actif,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/produits");
  return { ok: true, data: undefined };
}

/**
 * Duplique un produit en ajoutant " (copie)" à la désignation.
 */
export async function duplicateProduitAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: source, error: fetchErr } = await supabase
    .from("produits_services")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !source) {
    return { ok: false, error: "Prestation introuvable." };
  }

  const { data, error } = await supabase
    .from("produits_services")
    .insert({
      user_id: user.id,
      designation: `${source.designation} (copie)`,
      description: source.description,
      prix_ht: source.prix_ht,
      unite: source.unite,
      categorie: source.categorie,
      tva_taux_suggere: source.tva_taux_suggere,
      actif: source.actif,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/produits");
  return { ok: true, data: { id: data.id } };
}

export async function deleteProduitAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("produits_services")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/produits");
  return { ok: true, data: undefined };
}
