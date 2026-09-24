/**
 * Helpers PURS du journal des tâches planifiées (testés).
 */

export type LigneJournalMinimale = { date_execution: string };

/**
 * Jours écoulés depuis la dernière exécution enregistrée (999 si aucune).
 * `aujourdhui` au format AAAA-MM-JJ.
 */
export function joursSansExecution(journal: LigneJournalMinimale[], aujourdhui: string): number {
  if (journal.length === 0) return 999;
  const derniere = journal.reduce((m, j) => (j.date_execution > m ? j.date_execution : m), "");
  const ms = Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${derniere}T00:00:00Z`);
  if (!Number.isFinite(ms)) return 999;
  return Math.max(0, Math.floor(ms / (24 * 3600 * 1000)));
}

/**
 * Faut-il alerter sur le tableau de bord ? Deux jours sans exécution :
 * la tâche quotidienne (5 h) a raté au moins une fois. Seuil volontaire
 * pour ne pas crier après un simple redéploiement à l'heure du cron.
 */
export function automatismesEnPanne(
  journal: LigneJournalMinimale[],
  aujourdhui: string,
): { jours: number; jamais: boolean } | null {
  const jours = joursSansExecution(journal, aujourdhui);
  if (jours < 2) return null;
  return { jours, jamais: journal.length === 0 };
}
