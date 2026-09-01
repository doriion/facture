import "server-only";

import type { ServiceClient } from "@/lib/supabase/service";

/**
 * Petite ligne « pense-bête » ajoutée aux emails récapitulatifs des
 * automatisations (relances, rappels) : nombre de tâches en retard,
 * s'il y en a. Chaîne vide sinon — l'email reste inchangé.
 */
export async function lignePenseBeteHtml(
  service: ServiceClient,
  userId: string,
  today: string,
): Promise<string> {
  const { count } = await service
    .from("taches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("fait", false)
    .not("date_echeance", "is", null)
    .lt("date_echeance", today);

  if (!count) return "";
  return `<p>Au passage : ${count} tâche(s) en retard dans votre pense-bête « À faire ».</p>`;
}
