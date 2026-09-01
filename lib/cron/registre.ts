import "server-only";

import type { JobDef } from "@/lib/cron/jobs";
import { jobSauvegarde } from "@/lib/cron/jobs/sauvegarde";
import { jobRelances } from "@/lib/cron/jobs/relances";
import { jobRappels } from "@/lib/cron/jobs/rappels";
import { jobEmailTaches } from "@/lib/cron/jobs/taches";

/**
 * Registre des tâches orchestrées par /api/cron/quotidien (UN SEUL
 * cron Vercel — le plan Hobby limite à 2 crons quotidiens ; chaque job
 * garde sa propre cadence via doitTournerAujourdhui).
 */
export const JOBS: JobDef[] = [
  jobSauvegarde,
  jobRelances,
  jobRappels,
  jobEmailTaches,
];
