"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { totalVentilation, type Ventilation } from "@/lib/fiscal";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type DeclarationUrssaf = {
  id: string;
  periode_label: string;
  periode_start: string;
  periode_end: string;
  montant_declare: number;
  ventilation: Ventilation | null;
  declare_le: string;
  notes: string | null;
};

/** Déclaration enregistrée pour une période exacte, ou null. */
export async function getDeclaration(
  start: string,
  end: string,
): Promise<DeclarationUrssaf | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("declarations_urssaf")
    .select("*")
    .eq("periode_start", start)
    .eq("periode_end", end)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    periode_label: data.periode_label,
    periode_start: data.periode_start,
    periode_end: data.periode_end,
    montant_declare: Number(data.montant_declare),
    ventilation: (data.ventilation as Ventilation | null) ?? null,
    declare_le: data.declare_le,
    notes: data.notes,
  };
}

/**
 * Marque une période comme déclarée à l'URSSAF, en figeant montant et
 * ventilation du moment. Un ré-appel sur la même période écrase la
 * précédente (correction volontaire de saisie) — l'écart entre montant
 * figé et total actuel est recalculé à l'affichage.
 */
export async function marquerDeclareeAction(input: {
  label: string;
  start: string;
  end: string;
  montant: number;
  ventilation: Ventilation;
  declare_le?: string;
  notes?: string;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  if (!Number.isFinite(input.montant) || input.montant < 0) {
    return { ok: false, error: "Montant invalide." };
  }
  // Cohérence ventilation ↔ montant (au centime près)
  if (Math.abs(totalVentilation(input.ventilation) - input.montant) > 0.02) {
    return { ok: false, error: "Ventilation incohérente avec le total." };
  }

  const { error } = await supabase.from("declarations_urssaf").upsert(
    {
      user_id: user.id,
      periode_label: input.label,
      periode_start: input.start,
      periode_end: input.end,
      montant_declare: input.montant,
      ventilation: input.ventilation,
      declare_le: input.declare_le || new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || null,
    },
    { onConflict: "user_id,periode_start,periode_end" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/exports");
  return { ok: true, data: undefined };
}

/** Annule le marquage « déclarée » d'une période (erreur de saisie). */
export async function supprimerDeclarationAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("declarations_urssaf")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/exports");
  return { ok: true, data: undefined };
}
