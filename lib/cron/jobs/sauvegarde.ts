import "server-only";

import type { JobDef } from "@/lib/cron/jobs";
import { effectuerSauvegarde } from "@/lib/sauvegarde-core";
import { sauvegardeMensuelleDue } from "@/lib/sauvegarde-helpers";

/**
 * Sauvegarde mensuelle automatique — la seule automatisation ACTIVE
 * par défaut (aucun envoi client). Visée le 1er du mois, avec
 * RATTRAPAGE : tant qu'aucune sauvegarde en succès (automatique ou
 * manuelle) n'existe ce mois-ci, elle est due chaque matin. Un cron en
 * panne le 1er ne coûte plus un mois entier. Le mode simulation ne
 * s'applique pas (concerneLesClients = false).
 */
export const jobSauvegarde: JobDef = {
  tache: "sauvegarde",
  concerneLesClients: false,
  estActive: (profil) => profil.auto_sauvegarde_active !== false,
  doitTournerAujourdhui: async (today, { service, userId }) => {
    const debutMois = `${today.slice(0, 7)}-01`;
    const { data, error } = await service
      .from("taches_journal")
      .select("date_execution, statut, dry_run, tache")
      .eq("user_id", userId)
      .in("tache", ["sauvegarde", "sauvegarde-manuelle"])
      .gte("date_execution", debutMois)
      .lte("date_execution", today);
    if (error) throw new Error(`journal illisible (sauvegarde) : ${error.message}`);
    const lignes = data ?? [];
    return sauvegardeMensuelleDue(
      today,
      lignes.filter((l) => l.statut === "succes" && !l.dry_run).map((l) => l.date_execution),
      lignes.filter((l) => l.tache === "sauvegarde").map((l) => l.date_execution),
    );
  },
  executer: async ({ service, userId, profil, today }) =>
    effectuerSauvegarde({
      client: service,
      userId,
      emailDestinataire: profil.email_pro,
      dateIso: today,
    }),
};
