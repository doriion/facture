"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  devisSchema,
  type DevisFormValues,
} from "@/lib/validations/devis";
import { computeTotalHt } from "@/lib/validations/facture";
import type { Database, Json } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Devis = Database["public"]["Tables"]["devis"]["Row"];
type Ligne = Database["public"]["Tables"]["devis_lignes"]["Row"];

/**
 * Liste des devis avec filtres + calcul du statut affiché (expiré).
 * Les modèles (est_modele = true) sont toujours exclus : ils ont leur
 * propre liste (listModelesDevis) et ne comptent dans aucune stat.
 */
export async function listDevis(params?: {
  search?: string;
  statut?: string;
  type?: string;
  client_id?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("devis")
    .select("*, client:clients(id, nom, type)")
    .eq("est_modele", false)
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
  const today = new Date().toISOString().slice(0, 10);
  const result = (data ?? []).map((d) => {
    const isExpired =
      d.statut === "envoye" && d.date_validite && d.date_validite < today;
    return { ...d, statut_affichage: isExpired ? "expire" : d.statut };
  });
  return result;
}

/**
 * Liste des devis marqués comme modèles, pour la section « Modèles »
 * et le choix « Nouveau devis depuis un modèle ».
 */
export async function listModelesDevis() {
  const supabase = createClient();
  const { data } = await supabase
    .from("devis")
    .select("id, numero, type_activite, total_ht, notes, updated_at")
    .eq("est_modele", true)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

/**
 * Marque / démarque un devis comme modèle réutilisable. Réversible et
 * sans effet sur le contenu : le devis garde son numéro et ses lignes,
 * il est simplement déplacé entre la liste normale et la section
 * Modèles (exclu des stats et compteurs quand est_modele = true).
 */
export async function setDevisModeleAction(
  id: string,
  estModele: boolean,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("devis")
    .update({ est_modele: estModele })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/devis");
  revalidatePath(`/devis/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

/**
 * Récupère un devis complet avec lignes + client + profil entreprise.
 */
export async function getDevis(id: string): Promise<{
  devis: Devis | null;
  lignes: Ligne[];
  client: Database["public"]["Tables"]["clients"]["Row"] | null;
  profil: Database["public"]["Tables"]["profil_entreprise"]["Row"] | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { devis: null, lignes: [], client: null, profil: null };
  }

  const [devisRes, lignesRes, profilRes] = await Promise.all([
    supabase
      .from("devis")
      .select("*, client:clients(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("devis_lignes")
      .select("*")
      .eq("devis_id", id)
      .order("ordre", { ascending: true }),
    supabase
      .from("profil_entreprise")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  type DevisWithClient = NonNullable<typeof devisRes.data> & {
    client: Database["public"]["Tables"]["clients"]["Row"] | null;
  };
  const raw = devisRes.data as DevisWithClient | null;
  if (!raw) {
    return { devis: null, lignes: [], client: null, profil: profilRes.data };
  }

  const { client, ...devisClean } = raw;
  return {
    devis: devisClean,
    lignes: lignesRes.data ?? [],
    client,
    profil: profilRes.data,
  };
}

/**
 * Crée un nouveau devis (brouillon par défaut). Numérotation atomique
 * via la RPC `next_document_number`.
 */
export async function createDevisAction(
  values: DevisFormValues,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const parsed = devisSchema.safeParse(values);
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

  const { data: numero, error: numeroErr } = await supabase.rpc(
    "next_document_number",
    { p_type: "devis" },
  );
  if (numeroErr || !numero) {
    return {
      ok: false,
      error: numeroErr?.message ?? "Échec de la génération du numéro.",
    };
  }

  const total_ht = computeTotalHt(v.lignes);

  const { data: devis, error: insertErr } = await supabase
    .from("devis")
    .insert({
      user_id: user.id,
      numero,
      client_id: v.client_id,
      date_emission: v.date_emission,
      date_validite: v.date_validite,
      date_debut_travaux: v.date_debut_travaux || null,
      duree_estimee_jours: v.duree_estimee_jours,
      type_activite: v.type_activite,
      statut: "brouillon",
      total_ht,
      conditions: v.conditions || null,
      notes: v.notes || null,
      equipement_info: cleanedEquipement(v.equipement),
      performances_energetiques: cleanedPerformances(v.performances_energetiques),
      aides_financieres: cleanedAides(v.aides_financieres),
    })
    .select("id, numero")
    .single();

  if (insertErr || !devis) {
    return {
      ok: false,
      error: insertErr?.message ?? "Échec de la création.",
    };
  }

  const lignesPayload = v.lignes.map((l, idx) => ({
    user_id: user.id,
    devis_id: devis.id,
    ordre: idx,
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire_ht: l.prix_unitaire_ht,
    total_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
  }));

  const { error: lignesErr } = await supabase
    .from("devis_lignes")
    .insert(lignesPayload);

  if (lignesErr) {
    await supabase.from("devis").delete().eq("id", devis.id);
    return { ok: false, error: lignesErr.message };
  }

  revalidatePath("/devis");
  return { ok: true, data: { id: devis.id, numero: devis.numero } };
}

/**
 * Met à jour un devis existant. Refuse si le devis est lié à une facture
 * (devenu immuable une fois converti).
 */
export async function updateDevisAction(
  id: string,
  values: DevisFormValues,
): Promise<ActionResult> {
  const parsed = devisSchema.safeParse(values);
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
    .from("devis")
    .select("statut, facture_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Devis introuvable." };
  if (existing.facture_id) {
    return {
      ok: false,
      error: "Ce devis a été converti en facture et ne peut plus être modifié.",
    };
  }

  const total_ht = computeTotalHt(v.lignes);

  const { error: updateErr } = await supabase
    .from("devis")
    .update({
      client_id: v.client_id,
      date_emission: v.date_emission,
      date_validite: v.date_validite,
      date_debut_travaux: v.date_debut_travaux || null,
      duree_estimee_jours: v.duree_estimee_jours,
      type_activite: v.type_activite,
      total_ht,
      conditions: v.conditions || null,
      notes: v.notes || null,
      equipement_info: cleanedEquipement(v.equipement),
      performances_energetiques: cleanedPerformances(v.performances_energetiques),
      aides_financieres: cleanedAides(v.aides_financieres),
    })
    .eq("id", id);

  if (updateErr) return { ok: false, error: updateErr.message };

  // Remplacement intégral des lignes
  const { error: deleteErr } = await supabase
    .from("devis_lignes")
    .delete()
    .eq("devis_id", id);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  const lignesPayload = v.lignes.map((l, idx) => ({
    user_id: user.id,
    devis_id: id,
    ordre: idx,
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire_ht: l.prix_unitaire_ht,
    total_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
  }));
  const { error: insertErr } = await supabase
    .from("devis_lignes")
    .insert(lignesPayload);
  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath("/devis");
  revalidatePath(`/devis/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Bascule le statut d'un devis.
 */
export async function setDevisStatutAction(
  id: string,
  statut: "brouillon" | "envoye" | "accepte" | "refuse",
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("devis")
    .update({ statut })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/devis");
  revalidatePath(`/devis/${id}`);
  return { ok: true, data: undefined };
}

// NB : la duplication de devis ne passe plus par une server action —
// le bouton « Dupliquer » ouvre /devis/nouveau?source=<id> avec le
// formulaire pré-rempli (voir lib/devis-prefill.ts). Aucun numéro
// n'est consommé tant que l'utilisateur ne valide pas.

/**
 * Supprime un devis (uniquement les brouillons).
 */
export async function deleteDevisAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("devis")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Devis introuvable." };
  if (existing.statut !== "brouillon") {
    return {
      ok: false,
      error: "Seuls les brouillons peuvent être supprimés.",
    };
  }
  const { error } = await supabase.from("devis").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/devis");
  return { ok: true, data: undefined };
}

/**
 * Convertit un devis accepté en facture (brouillon).
 * Recopie les lignes, l'équipement, et les aides financières.
 * Lie les deux documents via `devis.facture_id`.
 */
export async function convertirDevisEnFactureAction(
  devisId: string,
): Promise<ActionResult<{ factureId: string; numero: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Charger le devis + ses lignes
  const { data: devis } = await supabase
    .from("devis")
    .select("*")
    .eq("id", devisId)
    .maybeSingle();
  if (!devis) return { ok: false, error: "Devis introuvable." };
  if (devis.facture_id) {
    return {
      ok: false,
      error: "Ce devis a déjà été converti en facture.",
    };
  }

  const { data: lignes } = await supabase
    .from("devis_lignes")
    .select("*")
    .eq("devis_id", devisId)
    .order("ordre");
  if (!lignes || lignes.length === 0) {
    return { ok: false, error: "Le devis ne contient aucune ligne." };
  }

  // Numéro de facture
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

  // Création facture (brouillon)
  const today = new Date().toISOString().slice(0, 10);
  const echeance = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: facture, error: insertErr } = await supabase
    .from("factures")
    .insert({
      user_id: user.id,
      numero,
      client_id: devis.client_id,
      date_emission: today,
      date_echeance: echeance,
      date_prestation: devis.date_debut_travaux,
      date_prestation_fin:
        devis.date_debut_travaux && devis.duree_estimee_jours
          ? new Date(
              new Date(devis.date_debut_travaux).getTime() +
                (devis.duree_estimee_jours - 1) * 24 * 3600 * 1000,
            )
              .toISOString()
              .slice(0, 10)
          : null,
      type_activite: devis.type_activite,
      statut: "brouillon",
      total_ht: devis.total_ht,
      conditions_paiement: devis.conditions,
      notes: `Convertie depuis le devis ${devis.numero}.`,
      equipement_info: devis.equipement_info,
      aides_financieres: devis.aides_financieres,
    })
    .select("id, numero")
    .single();

  if (insertErr || !facture) {
    return {
      ok: false,
      error: insertErr?.message ?? "Échec de la création de la facture.",
    };
  }

  // Recopie des lignes
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

  // Lien devis → facture + statut accepté
  await supabase
    .from("devis")
    .update({ facture_id: facture.id, statut: "accepte" })
    .eq("id", devisId);

  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  revalidatePath("/factures");
  return { ok: true, data: { factureId: facture.id, numero: facture.numero } };
}

// ----- Helpers internes -----

function cleanedEquipement(eq: DevisFormValues["equipement"]): Json {
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

function cleanedPerformances(
  p: DevisFormValues["performances_energetiques"],
): Json {
  const out: Record<string, string | number> = {};
  if (p.cop !== null && p.cop !== undefined) out.cop = p.cop;
  if (p.scop !== null && p.scop !== undefined) out.scop = p.scop;
  if (p.seer !== null && p.seer !== undefined) out.seer = p.seer;
  if (p.classe_energetique) out.classe_energetique = p.classe_energetique;
  return out as Json;
}

function cleanedAides(a: DevisFormValues["aides_financieres"]): Json {
  const out: Record<string, number> = {};
  if (a.maprimerenov !== null && a.maprimerenov !== undefined)
    out.maprimerenov = a.maprimerenov;
  if (a.cee !== null && a.cee !== undefined) out.cee = a.cee;
  if (a.eco_ptz !== null && a.eco_ptz !== undefined) out.eco_ptz = a.eco_ptz;
  return out as Json;
}
