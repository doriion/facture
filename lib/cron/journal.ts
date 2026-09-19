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
 *
 * Une lecture IMPOSSIBLE du journal jette : on ne doit jamais conclure
 * « pas encore exécutée » (et rejouer des envois) sur une panne.
 */
export async function dejaExecuteeAujourdhui(
  service: ServiceClient,
  userId: string,
  tache: string,
  today: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("taches_journal")
    .select("statut, dry_run")
    .eq("user_id", userId)
    .eq("tache", tache)
    .eq("date_execution", today)
    .maybeSingle();
  if (error) throw new Error(`journal illisible : ${error.message}`);
  return data?.statut === "succes" && data.dry_run === false;
}

/**
 * Écrit (ou remplace) la ligne de journal du jour pour une tâche.
 * Jette si l'écriture échoue : sans journal, la tâche serait rejouée
 * demain (double envoi) — mieux vaut que l'échec soit visible.
 */
export async function journaliser(
  service: ServiceClient,
  userId: string,
  tache: string,
  today: string,
  resultat: ResultatTache,
  dryRun: boolean,
): Promise<void> {
  const { error } = await service.from("taches_journal").upsert(
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
  if (error) throw new Error(`journal non écrit : ${error.message}`);
}
