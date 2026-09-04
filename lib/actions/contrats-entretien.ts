"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  contratEntretienSchema,
  type ContratEntretienFormInput,
} from "@/lib/validations/contrat-entretien";
import { echeanceInitiale, TEMPLATE_VERSION_COURANTE } from "@/lib/contrats/logic";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

import type { Database } from "@/types/database";

export type ContratEntretienRow =
  Database["public"]["Tables"]["contrats"]["Row"];

export type ContratEntretienListe = ContratEntretienRow & {
  client: { nom: string; email: string | null } | null;
};

/** Liste des contrats signables, filtrable par statut et recherche. */
export async function listContratsEntretien(params?: {
  search?: string;
  statut?: string;
}): Promise<ContratEntretienListe[]> {
  const supabase = createClient();
  let query = supabase
    .from("contrats")
    .select("*, client:clients(nom, email)")
    .order("created_at", { ascending: false });

  if (params?.statut && params.statut !== "tous") {
    query = query.eq("statut", params.statut);
  }

  const { data } = await query;
  let contrats = (data ?? []) as unknown as ContratEntretienListe[];

  const recherche = params?.search?.trim().toLowerCase();
  if (recherche) {
    contrats = contrats.filter(
      (c) =>
        (c.numero ?? "").toLowerCase().includes(recherche) ||
        (c.client?.nom ?? "").toLowerCase().includes(recherche) ||
        (c.adresse_site ?? "").toLowerCase().includes(recherche),
    );
  }
  return contrats;
}

export async function getContratEntretien(
  id: string,
): Promise<ContratEntretienListe | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("contrats")
    .select("*, client:clients(nom, email)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ContratEntretienListe) ?? null;
}

export async function createContratEntretienAction(
  input: ContratEntretienFormInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = contratEntretienSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data, error } = await supabase
    .from("contrats")
    .insert({
      user_id: user.id,
      client_id: v.client_id,
      adresse_site: v.adresse_site || null,
      equipements: v.equipements,
      redevance: v.redevance,
      remise: v.remise,
      plafond_pieces: v.plafond_pieces,
      date_effet: v.date_effet,
      date_echeance: echeanceInitiale(v.date_effet),
      qualite_client: v.qualite_client,
      mode_conclusion: v.mode_conclusion,
      template_version: TEMPLATE_VERSION_COURANTE,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur d'enregistrement." };
  }

  revalidatePath("/contrats");
  return { ok: true, data: { id: data.id } };
}

/** Modification — brouillon uniquement : un contrat envoyé ou signé est figé. */
export async function updateContratEntretienAction(
  id: string,
  input: ContratEntretienFormInput,
): Promise<ActionResult> {
  const parsed = contratEntretienSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const { data: existant } = await supabase
    .from("contrats")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Contrat introuvable." };
  if (existant.statut !== "brouillon") {
    return {
      ok: false,
      error: "Seul un brouillon peut être modifié — un contrat envoyé est figé.",
    };
  }

  const { error } = await supabase
    .from("contrats")
    .update({
      client_id: v.client_id,
      adresse_site: v.adresse_site || null,
      equipements: v.equipements,
      redevance: v.redevance,
      remise: v.remise,
      plafond_pieces: v.plafond_pieces,
      date_effet: v.date_effet,
      date_echeance: echeanceInitiale(v.date_effet),
      qualite_client: v.qualite_client,
      mode_conclusion: v.mode_conclusion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("statut", "brouillon");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contrats");
  revalidatePath(`/contrats/${id}`);
  return { ok: true, data: undefined };
}

/** Suppression — brouillon uniquement (un contrat envoyé/signé s'archive, il ne s'efface pas). */
export async function deleteContratEntretienAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existant } = await supabase
    .from("contrats")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Contrat introuvable." };
  if (existant.statut !== "brouillon") {
    return {
      ok: false,
      error:
        "Seul un brouillon peut être supprimé. Pour un contrat envoyé, révoquez le lien ; pour un contrat signé, résiliez-le.",
    };
  }

  const { error } = await supabase
    .from("contrats")
    .delete()
    .eq("id", id)
    .eq("statut", "brouillon");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contrats");
  return { ok: true, data: undefined };
}

/**
 * Changement de statut manuel côté admin, borné aux transitions
 * légitimes : signé → actif (mise en service), signé/actif → résilié,
 * actif → expiré. L'envoi et la signature ont leurs propres actions.
 */
const TRANSITIONS_MANUELLES: Record<string, string[]> = {
  signe: ["actif", "resilie"],
  actif: ["resilie", "expire"],
};

export async function changerStatutContratAction(
  id: string,
  statut: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existant } = await supabase
    .from("contrats")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Contrat introuvable." };

  const autorises = TRANSITIONS_MANUELLES[existant.statut] ?? [];
  if (!autorises.includes(statut)) {
    return {
      ok: false,
      error: `Passage « ${existant.statut} » → « ${statut} » non autorisé.`,
    };
  }

  const { error } = await supabase
    .from("contrats")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contrats");
  revalidatePath(`/contrats/${id}`);
  return { ok: true, data: undefined };
}
