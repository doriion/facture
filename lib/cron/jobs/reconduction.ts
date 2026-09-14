import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import { contratsAReconduire } from "@/lib/contrats/reconduction";
import { formatDateFr } from "@/lib/format";

/**
 * Tacite reconduction annuelle des contrats signés — tenue du REGISTRE
 * uniquement : ce job n'écrit ni n'envoie rien au client, il avance la
 * date d'échéance des contrats dont le terme est passé, comme
 * l'article 7 du contrat le prévoit. Sans lui, l'échéance restait
 * figée à la première année et l'avis loi Chatel n'aurait jamais pu
 * se déclencher pour les années suivantes.
 *
 * Toujours actif (aucun contact client), idempotent (un contrat déjà
 * reconduit ne ressort pas), et journalisé avec les numéros traités.
 * La sélection est PURE et testée dans lib/contrats/reconduction.
 */
export const jobReconduction: JobDef = {
  tache: "reconduction-contrats",
  concerneLesClients: false,
  estActive: () => true,
  doitTournerAujourdhui: () => true,
  executer: async (ctx) => executerReconduction(ctx),
};

async function executerReconduction({
  service,
  userId,
  today,
}: ContexteJob): Promise<ResultatTache> {
  const { data: contrats, error } = await service
    .from("contrats")
    .select("id, numero, statut, date_echeance")
    .eq("user_id", userId)
    .in("statut", ["signe", "actif"]);

  if (error) {
    return { statut: "erreur", details: `Lecture des contrats : ${error.message}` };
  }

  const aReconduire = contratsAReconduire(contrats ?? [], { today });
  if (aReconduire.length === 0) {
    return { statut: "succes", details: "Aucun contrat à reconduire." };
  }

  const faits: string[] = [];
  const echecs: string[] = [];

  for (const c of aReconduire) {
    // `.eq("date_echeance", …)` : n'avance que si l'échéance est
    // toujours celle qu'on a lue (aucun écrasement d'une modification
    // faite entre-temps depuis l'interface).
    const { data, error: updateErr } = await service
      .from("contrats")
      .update({
        date_echeance: c.nouvelleEcheance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id)
      .eq("user_id", userId)
      // date_echeance est garanti non nul : contratsAReconduire écarte
      // les contrats sans échéance.
      .eq("date_echeance", c.date_echeance as string)
      .select("id");

    if (updateErr) {
      echecs.push(`${c.numero ?? c.id} : ${updateErr.message}`);
      continue;
    }
    if (!data || data.length === 0) continue; // modifié entre-temps
    faits.push(
      `${c.numero ?? c.id} → ${formatDateFr(c.nouvelleEcheance)}`,
    );
  }

  const details = [
    faits.length
      ? `${faits.length} contrat(s) reconduit(s) : ${faits.join(" ; ")}`
      : "Aucun contrat reconduit (modifiés entre-temps).",
    echecs.length ? `échecs : ${echecs.join(" ; ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { statut: echecs.length > 0 ? "erreur" : "succes", details };
}
