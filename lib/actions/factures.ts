"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  computeTotalHt,
  factureSchema,
  type FactureFormValues,
} from "@/lib/validations/facture";
import type { Database, Json } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Facture = Database["public"]["Tables"]["factures"]["Row"];
type Ligne = Database["public"]["Tables"]["factures_lignes"]["Row"];

/**
 * Liste des factures avec filtres.
 * Calcule à la volée les statuts "retard" (statut 'envoyee' + échéance dépassée).
 */
export async function listFactures(params?: {
  search?: string;
  statut?: string;
  type?: string;
  client_id?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("factures")
    .select("*, client:clients(id, nom, type)")
    .order("date_emission", { ascending: false })
    .order("numero", { ascending: false });

  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(`numero.ilike.${s},notes.ilike.${s}`);
  }
  if (params?.statut && params.statut !== "tous") {
    query = query.eq("statut", params.statut);
  }
  if (params?.type && params.type !== "tous") {
    query = query.eq("type_activite", params.type);
  }
  if (params?.client_id) {
    query = query.eq("client_id", params.client_id);
  }

  const { data } = await query;
  // Statut dérivé "retard" (calculé pour l'affichage uniquement, pas persisté ici).
  const today = new Date().toISOString().slice(0, 10);
  const result = (data ?? []).map((f) => {
    const isLate =
      f.statut === "envoyee" && f.date_echeance && f.date_echeance < today;
    return { ...f, statut_affichage: isLate ? "retard" : f.statut };
  });
  return result;
}

/**
 * Récupère une facture complète : en-tête, lignes, client, profil entreprise.
 * Utilisé pour l'édition et la génération PDF.
 */
export async function getFacture(id: string): Promise<{
  facture: Facture | null;
  lignes: Ligne[];
  client: Database["public"]["Tables"]["clients"]["Row"] | null;
  profil: Database["public"]["Tables"]["profil_entreprise"]["Row"] | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { facture: null, lignes: [], client: null, profil: null };
  }

  const [factureRes, lignesRes, profilRes] = await Promise.all([
    supabase
      .from("factures")
      .select("*, client:clients(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("factures_lignes")
      .select("*")
      .eq("facture_id", id)
      .order("ordre", { ascending: true }),
    supabase
      .from("profil_entreprise")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // factureRes.data inclut `client:clients(*)` — extraction
  const factureRaw = factureRes.data as
    | (Facture & {
        client: Database["public"]["Tables"]["clients"]["Row"] | null;
      })
    | null;

  if (!factureRaw) {
    return { facture: null, lignes: [], client: null, profil: profilRes.data };
  }

  const { client, ...factureClean } = factureRaw;
  return {
    facture: factureClean,
    lignes: lignesRes.data ?? [],
    client,
    profil: profilRes.data,
  };
}

/**
 * Crée une nouvelle facture (brouillon par défaut). Numérotation atomique
 * via la RPC `next_document_number`. Insère les lignes en transaction logique.
 */
export async function createFactureAction(
  values: FactureFormValues,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const parsed = factureSchema.safeParse(values);
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

  // Numérotation atomique
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

  const total_ht = computeTotalHt(v.lignes);

  const { data: facture, error: insertErr } = await supabase
    .from("factures")
    .insert({
      user_id: user.id,
      numero,
      client_id: v.client_id,
      date_emission: v.date_emission,
      date_echeance: v.date_echeance,
      date_prestation: v.date_prestation || null,
      type_activite: v.type_activite,
      statut: "brouillon",
      total_ht,
      conditions_paiement: v.conditions_paiement || null,
      notes: v.notes || null,
      equipement_info: cleanedEquipement(v.equipement),
      aides_financieres: cleanedAides(v.aides_financieres),
    })
    .select("id, numero")
    .single();

  if (insertErr || !facture) {
    return {
      ok: false,
      error: insertErr?.message ?? "Échec de la création.",
    };
  }

  const lignesPayload = v.lignes.map((l, idx) => ({
    user_id: user.id,
    facture_id: facture.id,
    ordre: idx,
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire_ht: l.prix_unitaire_ht,
    total_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
  }));

  const { error: lignesErr } = await supabase
    .from("factures_lignes")
    .insert(lignesPayload);

  if (lignesErr) {
    // Best-effort rollback : supprimer la facture qu'on vient de créer
    await supabase.from("factures").delete().eq("id", facture.id);
    return { ok: false, error: lignesErr.message };
  }

  revalidatePath("/factures");
  return { ok: true, data: { id: facture.id, numero: facture.numero } };
}

/**
 * Met à jour une facture existante : en-tête + remplacement des lignes.
 * Refuse si la facture est annulée.
 */
export async function updateFactureAction(
  id: string,
  values: FactureFormValues,
): Promise<ActionResult> {
  const parsed = factureSchema.safeParse(values);
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

  const { data: existing } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Facture introuvable." };
  if (existing.statut === "annulee") {
    return { ok: false, error: "Cette facture est annulée et ne peut pas être modifiée." };
  }

  const total_ht = computeTotalHt(v.lignes);

  const { error: updateErr } = await supabase
    .from("factures")
    .update({
      client_id: v.client_id,
      date_emission: v.date_emission,
      date_echeance: v.date_echeance,
      date_prestation: v.date_prestation || null,
      type_activite: v.type_activite,
      total_ht,
      conditions_paiement: v.conditions_paiement || null,
      notes: v.notes || null,
      equipement_info: cleanedEquipement(v.equipement),
      aides_financieres: cleanedAides(v.aides_financieres),
    })
    .eq("id", id);

  if (updateErr) return { ok: false, error: updateErr.message };

  // Remplacement intégral des lignes (suppression puis ré-insertion).
  // Acceptable côté perfs (lignes peu nombreuses) et plus simple qu'un diff.
  const { error: deleteErr } = await supabase
    .from("factures_lignes")
    .delete()
    .eq("facture_id", id);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  const lignesPayload = v.lignes.map((l, idx) => ({
    user_id: user.id,
    facture_id: id,
    ordre: idx,
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire_ht: l.prix_unitaire_ht,
    total_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
  }));
  const { error: insertErr } = await supabase
    .from("factures_lignes")
    .insert(lignesPayload);

  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath("/factures");
  revalidatePath(`/factures/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Bascule le statut d'une facture (brouillon → envoyée → payée, ou annulée).
 */
export async function setFactureStatutAction(
  id: string,
  statut: "brouillon" | "envoyee" | "payee" | "annulee",
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("factures")
    .update({ statut })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/factures");
  revalidatePath(`/factures/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Supprime une facture (uniquement les brouillons — les autres doivent
 * être annulées pour conserver la traçabilité légale).
 */
/**
 * Duplique une facture existante : recopie l'en-tête, les lignes,
 * l'équipement, les aides. La copie est créée en brouillon avec un
 * nouveau numéro et une date d'émission = aujourd'hui (échéance +30j).
 * Le lien vers le devis source éventuel n'est pas recopié (la nouvelle
 * facture est autonome).
 */
export async function duplicateFactureAction(
  id: string,
): Promise<ActionResult<{ factureId: string; numero: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: source } = await supabase
    .from("factures")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!source) return { ok: false, error: "Facture introuvable." };

  const { data: lignes } = await supabase
    .from("factures_lignes")
    .select("*")
    .eq("facture_id", id)
    .order("ordre");

  // Nouveau numéro
  const { data: numero, error: numeroErr } = await supabase.rpc(
    "next_document_number",
    { p_type: "facture" },
  );
  if (numeroErr || !numero) {
    return {
      ok: false,
      error: numeroErr?.message ?? "Échec de la numérotation.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const echeance = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: facture, error: insertErr } = await supabase
    .from("factures")
    .insert({
      user_id: user.id,
      numero,
      client_id: source.client_id,
      date_emission: today,
      date_echeance: echeance,
      date_prestation: null,
      type_activite: source.type_activite,
      statut: "brouillon",
      total_ht: source.total_ht,
      conditions_paiement: source.conditions_paiement,
      notes: `Dupliquée depuis la facture ${source.numero}.`,
      equipement_info: source.equipement_info,
      aides_financieres: source.aides_financieres,
    })
    .select("id, numero")
    .single();

  if (insertErr || !facture) {
    return {
      ok: false,
      error: insertErr?.message ?? "Échec de la duplication.",
    };
  }

  if (lignes && lignes.length > 0) {
    const lignesPayload = lignes.map((l, idx) => ({
      user_id: user.id,
      facture_id: facture.id,
      ordre: idx,
      designation: l.designation,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      total_ht: Number(l.total_ht),
    }));
    const { error: lignesErr } = await supabase
      .from("factures_lignes")
      .insert(lignesPayload);
    if (lignesErr) {
      await supabase.from("factures").delete().eq("id", facture.id);
      return { ok: false, error: lignesErr.message };
    }
  }

  revalidatePath("/factures");
  return { ok: true, data: { factureId: facture.id, numero: facture.numero } };
}

export async function deleteFactureAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Facture introuvable." };
  if (existing.statut !== "brouillon") {
    return {
      ok: false,
      error:
        "Seuls les brouillons peuvent être supprimés. Pour les autres, utilisez « Annuler ».",
    };
  }
  const { error } = await supabase.from("factures").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/factures");
  return { ok: true, data: undefined };
}

// ----- Helpers internes -----

/**
 * Nettoie l'objet équipement avant insertion JSONB :
 * supprime les clés vides pour éviter des chaînes "" en base.
 */
function cleanedEquipement(eq: FactureFormValues["equipement"]): Json {
  const out: Record<string, string | number> = {};
  if (eq.marque) out.marque = eq.marque;
  if (eq.modele) out.modele = eq.modele;
  if (eq.num_serie) out.num_serie = eq.num_serie;
  if (eq.fluide_frigo_type) out.fluide_frigo_type = eq.fluide_frigo_type;
  if (eq.fluide_frigo_kg !== null && eq.fluide_frigo_kg !== undefined) {
    out.fluide_frigo_kg = eq.fluide_frigo_kg;
  }
  return out as Json;
}

function cleanedAides(a: FactureFormValues["aides_financieres"]): Json {
  const out: Record<string, number> = {};
  if (a.maprimerenov !== null && a.maprimerenov !== undefined)
    out.maprimerenov = a.maprimerenov;
  if (a.cee !== null && a.cee !== undefined) out.cee = a.cee;
  if (a.eco_ptz !== null && a.eco_ptz !== undefined) out.eco_ptz = a.eco_ptz;
  return out as Json;
}
