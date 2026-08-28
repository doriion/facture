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
 *
 * `options.interventionId` : lie l'intervention d'origine à la facture
 * créée (flux « Créer la facture » depuis une intervention). Le lien
 * n'est posé que si l'intervention n'est pas déjà facturée.
 */
export async function createFactureAction(
  values: FactureFormValues,
  options?: { interventionId?: string },
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
      date_prestation_fin: v.date_prestation_fin || null,
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
    nature_fiscale: l.nature_fiscale ?? "bic_prestations",
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

  if (options?.interventionId) {
    // `.is("facture_id", null)` : ne jamais écraser un lien existant
    // (protection contre la double facturation d'une intervention).
    await supabase
      .from("interventions")
      .update({ facture_id: facture.id })
      .eq("id", options.interventionId)
      .is("facture_id", null);
    revalidatePath("/interventions");
    revalidatePath(`/interventions/${options.interventionId}`);
    revalidatePath("/agenda");
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
      date_prestation_fin: v.date_prestation_fin || null,
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
    nature_fiscale: l.nature_fiscale ?? "bic_prestations",
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
  motif?: string,
): Promise<ActionResult> {
  const supabase = createClient();
  // Gestion spécifique annulation : on enregistre date + motif pour la
  // traçabilité fiscale (justifie le « trou » dans la séquence des numéros).
  // Si on sort du statut annulée (restauration), on nettoie les champs.
  const today = new Date().toISOString().slice(0, 10);
  const update: {
    statut: string;
    date_annulation?: string | null;
    motif_annulation?: string | null;
  } = { statut };
  if (statut === "annulee") {
    update.date_annulation = today;
    if (motif !== undefined) {
      update.motif_annulation = motif.trim() || null;
    }
  } else {
    update.date_annulation = null;
    update.motif_annulation = null;
  }

  const { error } = await supabase
    .from("factures")
    .update(update)
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
      nature_fiscale: l.nature_fiscale ?? "bic_prestations",
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

/**
 * Crée une facture d'acompte (type='acompte') liée à une facture parent.
 * - Si pourcentage : montant = total parent × pct
 * - Sinon : montant = montantOverride
 * Le brouillon généré contient une seule ligne « Acompte de X% sur F-XXX ».
 */
export async function createAcompteAction(
  parentId: string,
  options: { pourcentage?: number; montant?: number },
): Promise<ActionResult<{ factureId: string; numero: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: parent } = await supabase
    .from("factures")
    .select("*")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return { ok: false, error: "Facture parent introuvable." };
  if (parent.type_facture !== "normale") {
    return {
      ok: false,
      error: "Un acompte ne peut être créé que depuis une facture normale.",
    };
  }

  let montant: number;
  let pct: number | null = null;
  if (options.pourcentage !== undefined) {
    if (options.pourcentage <= 0 || options.pourcentage > 100) {
      return { ok: false, error: "Pourcentage entre 0 et 100." };
    }
    pct = options.pourcentage;
    montant =
      Math.round(Number(parent.total_ht) * (options.pourcentage / 100) * 100) /
      100;
  } else if (options.montant !== undefined) {
    if (options.montant <= 0 || options.montant >= Number(parent.total_ht)) {
      return { ok: false, error: "Montant invalide (doit être < total parent)." };
    }
    montant = Math.round(options.montant * 100) / 100;
  } else {
    return { ok: false, error: "Pourcentage ou montant requis." };
  }

  // Numéro
  const { data: numero, error: numeroErr } = await supabase.rpc(
    "next_document_number",
    { p_type: "facture" },
  );
  if (numeroErr || !numero) {
    return { ok: false, error: numeroErr?.message ?? "Échec numérotation." };
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
      client_id: parent.client_id,
      date_emission: today,
      date_echeance: echeance,
      type_activite: parent.type_activite,
      statut: "brouillon",
      total_ht: montant,
      type_facture: "acompte",
      facture_parent_id: parent.id,
      pourcentage_acompte: pct,
      conditions_paiement: parent.conditions_paiement,
      equipement_info: parent.equipement_info,
      aides_financieres: parent.aides_financieres,
    })
    .select("id, numero")
    .single();

  if (insertErr || !facture) {
    return { ok: false, error: insertErr?.message ?? "Échec création." };
  }

  const designation = pct
    ? `Acompte de ${pct}% sur facture ${parent.numero}`
    : `Acompte sur facture ${parent.numero}`;
  await supabase.from("factures_lignes").insert({
    user_id: user.id,
    facture_id: facture.id,
    ordre: 0,
    designation,
    quantite: 1,
    prix_unitaire_ht: montant,
    total_ht: montant,
  });

  revalidatePath("/factures");
  revalidatePath(`/factures/${parentId}`);
  return { ok: true, data: { factureId: facture.id, numero: facture.numero } };
}

/**
 * Crée la facture de solde liée à un parent. Calcule auto le reste à
 * facturer = total parent − somme des acomptes (factures enfants de
 * type 'acompte' non annulées).
 */
export async function createSoldeAction(
  parentId: string,
): Promise<ActionResult<{ factureId: string; numero: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: parent } = await supabase
    .from("factures")
    .select("*")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return { ok: false, error: "Facture parent introuvable." };
  if (parent.type_facture !== "normale") {
    return {
      ok: false,
      error: "Le solde ne peut être créé que depuis une facture normale.",
    };
  }

  // Acomptes existants (non annulés)
  const { data: acomptes } = await supabase
    .from("factures")
    .select("total_ht, numero, statut, type_facture")
    .eq("facture_parent_id", parentId)
    .neq("statut", "annulee");
  const totalAcomptes = (acomptes ?? [])
    .filter((a) => a.type_facture === "acompte")
    .reduce((s, a) => s + Number(a.total_ht), 0);

  const reste =
    Math.round((Number(parent.total_ht) - totalAcomptes) * 100) / 100;
  if (reste <= 0) {
    return {
      ok: false,
      error: "Aucun reste à facturer (acomptes ≥ total parent).",
    };
  }

  const { data: numero, error: numeroErr } = await supabase.rpc(
    "next_document_number",
    { p_type: "facture" },
  );
  if (numeroErr || !numero) {
    return { ok: false, error: numeroErr?.message ?? "Échec numérotation." };
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
      client_id: parent.client_id,
      date_emission: today,
      date_echeance: echeance,
      type_activite: parent.type_activite,
      statut: "brouillon",
      total_ht: reste,
      type_facture: "solde",
      facture_parent_id: parent.id,
      conditions_paiement: parent.conditions_paiement,
      equipement_info: parent.equipement_info,
      aides_financieres: parent.aides_financieres,
    })
    .select("id, numero")
    .single();

  if (insertErr || !facture) {
    return { ok: false, error: insertErr?.message ?? "Échec création." };
  }

  await supabase.from("factures_lignes").insert({
    user_id: user.id,
    facture_id: facture.id,
    ordre: 0,
    designation: `Solde sur facture ${parent.numero} — déduction des acomptes`,
    quantite: 1,
    prix_unitaire_ht: reste,
    total_ht: reste,
  });

  revalidatePath("/factures");
  revalidatePath(`/factures/${parentId}`);
  return { ok: true, data: { factureId: facture.id, numero: facture.numero } };
}

/**
 * Liste les factures enfants (acomptes + solde) d'une facture donnée.
 */
export async function listFactureEnfants(parentId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("factures")
    .select("id, numero, type_facture, statut, total_ht, date_emission, pourcentage_acompte")
    .eq("facture_parent_id", parentId)
    .order("date_emission", { ascending: true });
  return data ?? [];
}

export async function deleteFactureAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Facture introuvable." };
  // Suppression autorisée pour brouillons et factures annulées.
  // - Brouillon : pas de numéro réellement utilisé en pratique.
  // - Annulée : utile pour purger les tests. ⚠️ En usage réel, conserver
  //   la facture annulée est recommandé pour justifier le « trou » dans
  //   la séquence des numéros (art. 242 nonies A annexe II CGI).
  // Les statuts envoyée / payée / retard sont protégés : annulation
  // obligatoire au préalable.
  if (existing.statut !== "brouillon" && existing.statut !== "annulee") {
    return {
      ok: false,
      error:
        "Cette facture doit d'abord être annulée avant d'être supprimée.",
    };
  }
  const { error } = await supabase.from("factures").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/factures");
  return { ok: true, data: undefined };
}

/**
 * Réinitialise le compteur de numérotation pour un type de document
 * (facture ou devis) et une année. Utilisé après suppression de données
 * de test pour repartir d'une séquence propre.
 *
 * ⚠️ Refuse l'opération s'il reste des documents non supprimés pour
 * cette année afin d'éviter les collisions de numéros.
 */
export async function resetNumerotationAction(
  type: "facture" | "devis",
  annee: number,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const yearStart = `${annee}-01-01`;
  const yearEnd = `${annee + 1}-01-01`;
  const table = type === "facture" ? "factures" : "devis";
  const { count, error: countErr } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte("date_emission", yearStart)
    .lt("date_emission", yearEnd);

  if (countErr) return { ok: false, error: countErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Il reste ${count} ${type}(s) en base pour ${annee}. Supprimez-les d'abord (en passant par "Annulé" → "Supprimer définitivement" si nécessaire).`,
    };
  }

  const { error } = await supabase
    .from("numerotation")
    .delete()
    .eq("user_id", user.id)
    .eq("annee", annee)
    .eq("type_document", type);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/factures");
  revalidatePath("/devis");
  revalidatePath("/parametres");
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
