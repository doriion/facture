/**
 * Gel des mentions émetteur côté serveur. PAS un fichier "use server" :
 * simple helper importé par les server actions (factures, devis,
 * paiements, emails) aux points où un document quitte le statut
 * brouillon.
 */

import type { createClient } from "@/lib/supabase/server";
import { buildEmetteurSnapshot } from "@/lib/emetteur";

type Supabase = ReturnType<typeof createClient>;

/**
 * Fige les mentions émetteur d'un document s'il ne l'est pas déjà
 * (emetteur IS NULL). Idempotent et best-effort : ne JAMAIS bloquer
 * l'action appelante (envoi, paiement…) pour un échec de gel — le PDF
 * retombe alors sur le profil courant, comme avant cette
 * fonctionnalité.
 */
export async function figerEmetteurDocument(
  supabase: Supabase,
  table: "factures" | "devis",
  id: string,
): Promise<void> {
  try {
    const { data: doc } = await supabase
      .from(table)
      .select("emetteur")
      .eq("id", id)
      .maybeSingle();
    if (!doc || doc.emetteur !== null) return;

    const { data: profil } = await supabase
      .from("profil_entreprise")
      .select("*")
      .maybeSingle();
    const snapshot = buildEmetteurSnapshot(profil);
    if (!snapshot) return;

    // `.is("emetteur", null)` : ne jamais écraser un snapshot existant,
    // même en cas de course entre deux actions simultanées.
    await supabase
      .from(table)
      .update({ emetteur: snapshot })
      .eq("id", id)
      .is("emetteur", null);
  } catch {
    // silencieux (best-effort)
  }
}
