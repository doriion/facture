"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  normaliserCouleur,
  type CouleursEvenements,
} from "@/lib/agenda-colors";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Couleurs propres aux évènements de l'utilisateur, indexées par clé
 * « kind:id ». Lecture séparée de getAgendaEvents : la logique de
 * l'agenda (sources, synchro iPhone, facturation) n'est pas touchée.
 * Si la table n'existe pas encore (migration à appliquer) : vide.
 */
export async function getCouleursEvenements(): Promise<CouleursEvenements> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agenda_couleurs_evenements")
    .select("evenement_cle, couleur");
  if (error || !data) return {};
  const out: CouleursEvenements = {};
  for (const row of data) {
    const c = normaliserCouleur(row.couleur);
    if (c) out[row.evenement_cle] = c;
  }
  return out;
}

/**
 * Donne une couleur à UN évènement (null = retirer, il reprend la
 * couleur de son type).
 */
export async function setCouleurEvenementAction(
  cle: string,
  couleur: string | null,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const evenement_cle = cle.trim();
  if (!/^[a-z_]+:.{1,280}$/.test(evenement_cle)) {
    return { ok: false, error: "Évènement inconnu." };
  }

  if (couleur === null) {
    const { error } = await supabase
      .from("agenda_couleurs_evenements")
      .delete()
      .eq("evenement_cle", evenement_cle);
    if (error) return { ok: false, error: error.message };
  } else {
    const hex = normaliserCouleur(couleur);
    if (!hex) return { ok: false, error: "Couleur invalide (attendu : #rrggbb)." };
    const { error } = await supabase
      .from("agenda_couleurs_evenements")
      .upsert(
        { user_id: user.id, evenement_cle, couleur: hex, updated_at: new Date().toISOString() },
        { onConflict: "user_id,evenement_cle" },
      );
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}
