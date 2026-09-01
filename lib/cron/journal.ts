import "server-only";

import type { ServiceClient } from "@/lib/supabase/service";

export type ResultatTache = {
  statut: "succes" | "erreur" | "ignoree";
  details: string;
};

/**
 * Idempotence des tâches : une ligne de journal par (user, tâche,
 * jour). Si une exécution en SUCCÈS existe déjà aujourd'hui, la tâche
 * ne refait rien — un cron relancé deux fois le même jour est sans
 * effet. Une exécution en erreur ou en simulation n'empêche pas de
 * réessayer (la ligne est alors mise à jour).
 */
export async function dejaExecuteeAujourdhui(
  service: ServiceClient,
  userId: string,
  tache: string,
  today: string,
): Promise<boolean> {
  const { data } = await service
    .from("taches_journal")
    .select("statut, dry_run")
    .eq("user_id", userId)
    .eq("tache", tache)
    .eq("date_execution", today)
    .maybeSingle();
  return data?.statut === "succes" && data.dry_run === false;
}

/** Écrit (ou remplace) la ligne de journal du jour pour une tâche. */
export async function journaliser(
  service: ServiceClient,
  userId: string,
  tache: string,
  today: string,
  resultat: ResultatTache,
  dryRun: boolean,
): Promise<void> {
  await service.from("taches_journal").upsert(
    {
      user_id: userId,
      tache,
      date_execution: today,
      statut: resultat.statut,
      details: resultat.details.slice(0, 2000),
      dry_run: dryRun,
    },
    { onConflict: "user_id,tache,date_execution" },
  );
}
