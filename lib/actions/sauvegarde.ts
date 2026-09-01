"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { effectuerSauvegarde } from "@/lib/sauvegarde-core";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * « Sauvegarder maintenant » : exécute la même sauvegarde que le cron
 * mensuel (Storage + rotation + email), avec le client de SESSION —
 * la RLS s'applique, aucune clé service requise. Journalisée comme
 * « sauvegarde-manuelle » (relancer le même jour écrase la ligne et le
 * fichier : idempotent).
 */
export async function sauvegarderMaintenantAction(): Promise<
  ActionResult<{ message: string }>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: profil } = await supabase
    .from("profil_entreprise")
    .select("email_pro")
    .eq("user_id", user.id)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  try {
    const resultat = await effectuerSauvegarde({
      client: supabase,
      userId: user.id,
      emailDestinataire: profil?.email_pro ?? null,
      dateIso: today,
    });
    await supabase.from("taches_journal").upsert(
      {
        user_id: user.id,
        tache: "sauvegarde-manuelle",
        date_execution: today,
        statut: resultat.statut,
        details: resultat.details.slice(0, 2000),
        dry_run: false,
      },
      { onConflict: "user_id,tache,date_execution" },
    );
    revalidatePath("/parametres");
    return { ok: true, data: { message: `Sauvegarde effectuée — ${resultat.details}` } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("taches_journal").upsert(
      {
        user_id: user.id,
        tache: "sauvegarde-manuelle",
        date_execution: today,
        statut: "erreur",
        details: message.slice(0, 2000),
        dry_run: false,
      },
      { onConflict: "user_id,tache,date_execution" },
    );
    revalidatePath("/parametres");
    return { ok: false, error: `Sauvegarde échouée : ${message}` };
  }
}
