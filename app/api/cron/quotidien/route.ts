import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { createServiceClient } from "@/lib/supabase/service";
import { estAppelCronAutorise } from "@/lib/cron/protect";
import { dejaExecuteeAujourdhui, journaliser } from "@/lib/cron/journal";
import { JOBS } from "@/lib/cron/registre";
import { aujourdhuiParis } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Plan Hobby : 60 s maximum par exécution. Les jobs journalisent au fil
// de l'eau, une coupure ne rejoue donc pas ce qui est déjà passé.
export const maxDuration = 60;

/**
 * Orchestrateur des tâches planifiées — appelé chaque matin par Vercel
 * Cron (voir vercel.json). Un seul cron pour tout : chaque job décide
 * de sa cadence (doitTournerAujourdhui) et de son activation
 * (interrupteur du profil).
 *
 * Garanties :
 * - refuse tout appel sans `Authorization: Bearer CRON_SECRET` ;
 * - idempotent : une tâche en SUCCÈS réel aujourd'hui n'est pas
 *   rejouée (table taches_journal, contrainte unique par jour) ;
 * - dry-run : tant que `automatisations_simulation` est actif, les
 *   jobs qui écrivent aux CLIENTS journalisent ce qu'ils AURAIENT
 *   envoyé sans rien envoyer ;
 * - un job qui échoue n'empêche pas les suivants (erreur journalisée).
 */
export async function GET(request: Request) {
  if (!estAppelCronAutorise(request)) {
    return new NextResponse("Non autorisé", { status: 401 });
  }

  const service = createServiceClient();
  // Heure de Paris : même clé de jour que la sauvegarde manuelle et les
  // fenêtres métier (entre 0 h et 2 h, la date UTC est encore la veille).
  const today = aujourdhuiParis();

  const { data: profils, error } = await service
    .from("profil_entreprise")
    .select("*");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const compteRendu: Array<{
    user: string;
    tache: string;
    statut: string;
    details: string;
  }> = [];

  for (const profil of profils ?? []) {
    const userId = profil.user_id;
    for (const job of JOBS) {
      if (!job.doitTournerAujourdhui(today)) continue;
      if (!job.estActive(profil)) continue;
      // Journal illisible : on n'exécute RIEN pour cette tâche (on ne
      // rejoue pas des envois sur une panne de lecture).
      let dejaFaite: boolean;
      try {
        dejaFaite = await dejaExecuteeAujourdhui(service, userId, job.tache, today);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        Sentry.captureException(e, { tags: { tache: job.tache } });
        compteRendu.push({ user: userId, tache: job.tache, statut: "erreur", details: message });
        continue;
      }
      if (dejaFaite) {
        compteRendu.push({
          user: userId,
          tache: job.tache,
          statut: "deja-executee",
          details: "",
        });
        continue;
      }

      const dryRun = job.concerneLesClients
        ? (profil.automatisations_simulation ?? true)
        : false;

      try {
        const resultat = await job.executer({
          service,
          userId,
          profil,
          today,
          dryRun,
        });
        await journaliser(service, userId, job.tache, today, resultat, dryRun);
        compteRendu.push({
          user: userId,
          tache: job.tache,
          statut: resultat.statut,
          details: resultat.details,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Remonté explicitement à Sentry (un console.error n'y va pas),
        // sans données client : le message ne contient pas de PII.
        Sentry.captureException(e, { tags: { tache: job.tache } });
        try {
          await journaliser(
            service,
            userId,
            job.tache,
            today,
            { statut: "erreur", details: message },
            dryRun,
          );
        } catch (ej) {
          Sentry.captureException(ej, { tags: { tache: job.tache, etape: "journal" } });
        }
        console.error(`[cron:${job.tache}]`, message);
        compteRendu.push({
          user: userId,
          tache: job.tache,
          statut: "erreur",
          details: message,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, date: today, taches: compteRendu });
}
