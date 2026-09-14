"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { normaliser } from "@/lib/catalogue-recherche";
import { parseMoneyInput } from "@/lib/format";
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
      prix_achat_ttc: v.prix_achat_ttc ?? null,
      fournisseur: v.fournisseur || null,
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
      prix_achat_ttc: v.prix_achat_ttc ?? null,
      fournisseur: v.fournisseur || null,
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
      prix_achat_ttc: source.prix_achat_ttc,
      fournisseur: source.fournisseur,
      unite: source.unite,
      categorie: source.categorie,
      // nature_fiscale était oubliée : la copie retombait sur le défaut
      // « prestation », faussant la ventilation URSSAF des lignes créées
      // depuis elle.
      nature_fiscale: source.nature_fiscale,
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

/**
 * Enregistre au catalogue une ligne saisie à la main dans un devis ou
 * une facture. C'est ce qui fait que le catalogue se construit tout
 * seul au fil des documents, sans séance de saisie initiale.
 *
 * Ne crée QUE la prestation : le document en cours n'est pas touché,
 * et la ligne garde sa quantité et son prix propres au chantier.
 *
 * Refuse silencieusement un doublon (même désignation, casse et
 * accents ignorés) : un catalogue qui accumule les quasi-doublons se
 * cherche plus mal qu'un catalogue vide, et le bouton est juste à
 * côté du champ — un double clic est vite arrivé.
 */
export async function ajouterLigneAuCatalogueAction(ligne: {
  designation: string;
  prix_unitaire_ht: number | string;
  prix_achat_ttc_unitaire?: number | string | null;
  fournisseur?: string | null;
  nature_fiscale?: string | null;
}): Promise<ActionResult<{ id: string; deja: boolean }>> {
  const designation = (ligne.designation ?? "").trim();
  if (!designation) {
    return { ok: false, error: "Saisissez d'abord une désignation." };
  }
  if (designation.length > 200) {
    return { ok: false, error: "Désignation trop longue (200 caractères max)." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // La RLS filtre déjà sur user_id ; la comparaison se fait ensuite en
  // mémoire, avec la MÊME normalisation que le formulaire (accents,
  // ligatures, ponctuation) pour que le bouton disparaisse exactement
  // quand l'action refuserait.
  const { data: existants } = await supabase
    .from("produits_services")
    .select("id, designation, description");

  const cible = normaliser(designation);
  const doublon = (existants ?? []).find((p) => {
    const description = (p.description ?? "").trim();
    const complet = description
      ? `${p.designation} — ${description}`
      : p.designation;
    return normaliser(p.designation) === cible || normaliser(complet) === cible;
  });
  if (doublon) {
    return { ok: true, data: { id: doublon.id, deja: true } };
  }

  const prixHt = Number(parseMoneyInput(String(ligne.prix_unitaire_ht ?? 0)));
  const pa = ligne.prix_achat_ttc_unitaire;
  const prixAchat =
    pa === null || pa === undefined || pa === ""
      ? null
      : Number(parseMoneyInput(String(pa)));

  const { data, error } = await supabase
    .from("produits_services")
    .insert({
      user_id: user.id,
      designation,
      description: null,
      prix_ht: Number.isFinite(prixHt) ? prixHt : 0,
      prix_achat_ttc:
        prixAchat !== null && Number.isFinite(prixAchat) ? prixAchat : null,
      fournisseur: (ligne.fournisseur || "").trim() || null,
      // Valeurs neutres : la prestation est créée en un clic depuis un
      // devis, pas via le formulaire complet. L'unité et la catégorie
      // se précisent ensuite dans Catalogue si besoin.
      unite: "unité",
      categorie: "autre",
      nature_fiscale: ligne.nature_fiscale || "bic_prestations",
      tva_taux_suggere: null,
      actif: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/produits");
  return { ok: true, data: { id: data.id, deja: false } };
}
