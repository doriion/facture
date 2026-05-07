"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  contratSchema,
  nextVisitDate,
  pricePerVisit,
  type ContratFormValues,
  type Frequence,
} from "@/lib/validations/contrat";
import type { Database } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Contrat = Database["public"]["Tables"]["contrats_maintenance"]["Row"];

export async function listContrats(params?: {
  search?: string;
  statut?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("contrats_maintenance")
    .select("*, client:clients(id, nom, type, ville)")
    .order("prochaine_visite", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(
      `intitule.ilike.${s},equipement.ilike.${s},equipement_num_serie.ilike.${s}`,
    );
  }
  if (params?.statut && params.statut !== "tous") {
    query = query.eq("statut", params.statut);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Visites à venir dans les N prochains jours (calendrier compact pour
 * dashboard ou page maintenance).
 */
export async function prochainesVisites(joursAVenir = 60) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + joursAVenir * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data } = await supabase
    .from("contrats_maintenance")
    .select("*, client:clients(id, nom)")
    .eq("statut", "actif")
    .not("prochaine_visite", "is", null)
    .gte("prochaine_visite", today)
    .lte("prochaine_visite", limite)
    .order("prochaine_visite", { ascending: true });

  return data ?? [];
}

export async function getContrat(id: string): Promise<{
  contrat: Contrat | null;
  client: Database["public"]["Tables"]["clients"]["Row"] | null;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("contrats_maintenance")
    .select("*, client:clients(*)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { contrat: null, client: null };

  type WithClient = NonNullable<typeof data> & {
    client: Database["public"]["Tables"]["clients"]["Row"] | null;
  };
  const { client, ...contrat } = data as WithClient;
  return { contrat, client };
}

export async function createContratAction(
  values: ContratFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = contratSchema.safeParse(values);
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

  // Si pas de prochaine_visite renseignée, on calcule depuis date_debut
  const prochaine = v.prochaine_visite || nextVisitDate(v.date_debut, v.frequence);

  const { data, error } = await supabase
    .from("contrats_maintenance")
    .insert({
      user_id: user.id,
      client_id: v.client_id,
      intitule: v.intitule || null,
      equipement: v.equipement || null,
      equipement_num_serie: v.equipement_num_serie || null,
      date_debut: v.date_debut,
      date_fin: v.date_fin || null,
      frequence: v.frequence,
      prix_annuel_ht: v.prix_annuel_ht,
      prochaine_visite: prochaine,
      statut: v.statut,
      notes: v.notes || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Échec de la création." };
  }

  revalidatePath("/maintenance");
  return { ok: true, data: { id: data.id } };
}

export async function updateContratAction(
  id: string,
  values: ContratFormValues,
): Promise<ActionResult> {
  const parsed = contratSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const { error } = await supabase
    .from("contrats_maintenance")
    .update({
      client_id: v.client_id,
      intitule: v.intitule || null,
      equipement: v.equipement || null,
      equipement_num_serie: v.equipement_num_serie || null,
      date_debut: v.date_debut,
      date_fin: v.date_fin || null,
      frequence: v.frequence,
      prix_annuel_ht: v.prix_annuel_ht,
      prochaine_visite: v.prochaine_visite || null,
      statut: v.statut,
      notes: v.notes || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
  return { ok: true, data: undefined };
}

export async function deleteContratAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("contrats_maintenance")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/maintenance");
  return { ok: true, data: undefined };
}

/**
 * Génère une facture brouillon de visite de maintenance depuis un contrat,
 * et avance la `prochaine_visite` selon la fréquence.
 *
 * La facture créée est en brouillon, type d'activité "entretien", avec une
 * unique ligne au prix correspondant à la fréquence (annuel / semestriel /
 * trimestriel).
 */
export async function genererFactureVisiteAction(
  contratId: string,
): Promise<ActionResult<{ factureId: string; numero: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: contrat } = await supabase
    .from("contrats_maintenance")
    .select("*")
    .eq("id", contratId)
    .maybeSingle();
  if (!contrat) return { ok: false, error: "Contrat introuvable." };
  if (contrat.statut !== "actif") {
    return { ok: false, error: "Contrat non actif." };
  }

  // Numéro de facture
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

  const prixVisite = pricePerVisit(
    Number(contrat.prix_annuel_ht),
    contrat.frequence as Frequence,
  );
  const today = new Date().toISOString().slice(0, 10);
  const echeance = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const designation = [
    "Visite d'entretien",
    contrat.intitule ? `— ${contrat.intitule}` : null,
    contrat.equipement ? `(${contrat.equipement})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const { data: facture, error: insertErr } = await supabase
    .from("factures")
    .insert({
      user_id: user.id,
      numero,
      client_id: contrat.client_id,
      date_emission: today,
      date_echeance: echeance,
      date_prestation: contrat.prochaine_visite ?? today,
      type_activite: "entretien",
      statut: "brouillon",
      total_ht: prixVisite,
      notes: `Visite de maintenance — contrat #${contrat.id.slice(0, 8)}`,
      equipement_info: contrat.equipement
        ? {
            marque: null,
            modele: contrat.equipement,
            num_serie: contrat.equipement_num_serie,
          }
        : {},
    })
    .select("id, numero")
    .single();

  if (insertErr || !facture) {
    return {
      ok: false,
      error: insertErr?.message ?? "Échec de la création.",
    };
  }

  // Ligne unique
  const { error: ligneErr } = await supabase.from("factures_lignes").insert({
    user_id: user.id,
    facture_id: facture.id,
    ordre: 0,
    designation: designation || "Visite d'entretien",
    quantite: 1,
    prix_unitaire_ht: prixVisite,
    total_ht: prixVisite,
  });
  if (ligneErr) {
    await supabase.from("factures").delete().eq("id", facture.id);
    return { ok: false, error: ligneErr.message };
  }

  // Avance la prochaine visite
  const nouvelleDate = nextVisitDate(
    contrat.prochaine_visite ?? today,
    contrat.frequence as Frequence,
  );
  await supabase
    .from("contrats_maintenance")
    .update({ prochaine_visite: nouvelleDate })
    .eq("id", contratId);

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${contratId}`);
  revalidatePath("/factures");
  return { ok: true, data: { factureId: facture.id, numero: facture.numero } };
}
