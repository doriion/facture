import "server-only";

import type { Database } from "@/types/database";
import type { ServiceClient } from "@/lib/supabase/service";
import type { ResultatTache } from "@/lib/cron/journal";

export type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

export type ContexteJob = {
  service: ServiceClient;
  userId: string;
  profil: Profil;
  /** YYYY-MM-DD (UTC) du jour d'exécution */
  today: string;
  /** true = journaliser sans rien envoyer ni écrire côté métier */
  dryRun: boolean;
};

export type JobDef = {
  /** Identifiant stable, visible dans le journal (ex. "sauvegarde") */
  tache: string;
  /** Interrupteur dans les réglages de l'utilisateur */
  estActive: (profil: Profil) => boolean;
  /** Cadence propre au job (ex. sauvegarde : le 1er du mois seulement) */
  doitTournerAujourdhui: (today: string) => boolean;
  /** Ce job envoie-t-il des emails aux CLIENTS ? (soumis au dry-run) */
  concerneLesClients: boolean;
  executer: (ctx: ContexteJob) => Promise<ResultatTache>;
};

