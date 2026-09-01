"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ReglagesAutomatisations = {
  auto_sauvegarde_active: boolean;
  auto_relances_active: boolean;
  relances_delai_jours: number;
  auto_rappels_active: boolean;
  rappels_fenetre_jours: number;
  automatisations_simulation: boolean;
};

export type LigneJournal = {
  id: string;
  tache: string;
  date_execution: string;
  statut: string;
  details: string | null;
  dry_run: boolean;
};

/** Dernières exécutions de tâches planifiées (RLS : celles de l'utilisateur). */
export async function getJournalTaches(): Promise<LigneJournal[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("taches_journal")
    .select("id, tache, date_execution, statut, details, dry_run")
    .order("date_execution", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

/**
 * Enregistre les interrupteurs d'automatisation. Bornes serveur sur
 * les délais ; les envois clients restent gouvernés par le mode
 * simulation tant qu'il est actif.
 */
export async function saveReglagesAutomatisationsAction(
  input: ReglagesAutomatisations,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const delaiRelances = Math.round(Number(input.relances_delai_jours));
  const fenetreRappels = Math.round(Number(input.rappels_fenetre_jours));
  if (!Number.isFinite(delaiRelances) || delaiRelances < 1 || delaiRelances > 90) {
    return { ok: false, error: "Délai de relance : entre 1 et 90 jours." };
  }
  if (
    !Number.isFinite(fenetreRappels) ||
    fenetreRappels < 1 ||
    fenetreRappels > 120
  ) {
    return { ok: false, error: "Fenêtre de rappel : entre 1 et 120 jours." };
  }

  const { error } = await supabase
    .from("profil_entreprise")
    .update({
      auto_sauvegarde_active: input.auto_sauvegarde_active === true,
      auto_relances_active: input.auto_relances_active === true,
      relances_delai_jours: delaiRelances,
      auto_rappels_active: input.auto_rappels_active === true,
      rappels_fenetre_jours: fenetreRappels,
      automatisations_simulation: input.automatisations_simulation === true,
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/parametres");
  return { ok: true, data: undefined };
}
