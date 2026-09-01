import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { estAppelCronAutorise } from "@/lib/cron/protect";
import { dejaExecuteeAujourdhui, journaliser } from "@/lib/cron/journal";
import { JOBS } from "@/lib/cron/registre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  const today = new Date().toISOString().slice(0, 10);

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
      if (await dejaExecuteeAujourdhui(service, userId, job.tache, today)) {
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
        await journaliser(
          service,
          userId,
          job.tache,
          today,
          { statut: "erreur", details: message },
          dryRun,
        );
        // Remonté à Sentry par l'instrumentation globale, sans données
        // client (le message ne contient pas de PII).
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
