import "server-only";

import type { JobDef } from "@/lib/cron/jobs";
import { effectuerSauvegarde } from "@/lib/sauvegarde-core";

/**
 * Sauvegarde mensuelle automatique — la seule automatisation ACTIVE
 * par défaut (aucun envoi client). Tourne le 1er du mois ; le mode
 * simulation ne s'applique pas (concerneLesClients = false).
 */
export const jobSauvegarde: JobDef = {
  tache: "sauvegarde",
  concerneLesClients: false,
  estActive: (profil) => profil.auto_sauvegarde_active !== false,
  doitTournerAujourdhui: (today) => today.endsWith("-01"),
  executer: async ({ service, userId, profil, today }) =>
    effectuerSauvegarde({
      client: service,
      userId,
      emailDestinataire: profil.email_pro,
      dateIso: today,
    }),
};
