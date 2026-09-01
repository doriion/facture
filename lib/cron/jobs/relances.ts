import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import {
  facturesARelancer,
  type FactureRelancable,
} from "@/lib/relances-auto";
import { buildRelanceEmail, isEmailConfigured, sendEmail } from "@/lib/email";
import { formatDateFr, formatEuros } from "@/lib/format";

/**
 * Relances d'impayés automatiques — OFF par défaut, soumises au mode
 * simulation. La sélection (délai N jours, cooldown 15 j, max 2 autos
 * par facture, opt-out) est PURE et testée dans lib/relances-auto.
 * Même template et même traçabilité (table relances) que la relance
 * manuelle ; pas de PDF joint en automatique (le client l'a déjà reçu,
 * et un cron doit rester léger).
 */
export const jobRelances: JobDef = {
  tache: "relances-impayes",
  concerneLesClients: true,
  estActive: (profil) => profil.auto_relances_active === true,
  doitTournerAujourdhui: () => true,
  executer: async (ctx) => executerRelances(ctx),
};

async function executerRelances({
  service,
  userId,
  profil,
  today,
  dryRun,
}: ContexteJob): Promise<ResultatTache> {
  const [{ data: factures }, { data: relances }] = await Promise.all([
    service
      .from("factures")
      .select(
        "id, numero, statut, date_echeance, total_ht, exclure_relances_auto, client:clients(nom, email)",
      )
      .eq("user_id", userId)
      .eq("statut", "envoyee"),
    service
      .from("relances")
      .select("facture_id, envoyee_le, automatique")
      .eq("user_id", userId),
  ]);

  const candidates = (factures ?? []).map((f) => ({
    id: f.id,
    numero: f.numero,
    statut: f.statut,
    date_echeance: f.date_echeance,
    exclure_relances_auto: f.exclure_relances_auto ?? false,
    client_email:
      (f.client as { email: string | null } | null)?.email ?? null,
    client_nom: (f.client as { nom: string } | null)?.nom ?? "client",
    total_ht: Number(f.total_ht),
  }));

  const aRelancer = facturesARelancer(
    candidates as unknown as FactureRelancable[],
    relances ?? [],
    { today, delaiJours: profil.relances_delai_jours ?? 15 },
  ) as unknown as Array<
    (typeof candidates)[number] & { joursRetard: number }
  >;

  if (aRelancer.length === 0) {
    return { statut: "succes", details: "Aucune facture à relancer." };
  }

  const libelles = aRelancer.map(
    (f) => `${f.numero} (${f.joursRetard} j de retard)`,
  );

  if (dryRun) {
    return {
      statut: "succes",
      details: `SIMULATION : ${aRelancer.length} relance(s) auraient été envoyée(s) — ${libelles.join(", ")}. Désactivez le mode simulation pour envoyer réellement.`,
    };
  }

  if (!isEmailConfigured()) {
    return {
      statut: "erreur",
      details: "Resend non configuré (RESEND_API_KEY / RESEND_FROM).",
    };
  }

  const expediteurNom =
    profil.nom_commercial ||
    [profil.prenom, profil.nom].filter(Boolean).join(" ") ||
    "Votre artisan";

  const envoyees: string[] = [];
  const echecs: string[] = [];

  for (const f of aRelancer) {
    const email = buildRelanceEmail({
      numero: f.numero,
      clientNom: f.client_nom,
      expediteurNom,
      totalText: formatEuros(f.total_ht),
      echeanceText: formatDateFr(f.date_echeance),
      joursRetard: f.joursRetard,
    });
    const res = await sendEmail({
      to: f.client_email!,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: profil.email_pro ?? undefined,
    });
    if (!res.ok) {
      echecs.push(`${f.numero} : ${res.error}`);
      continue;
    }
    await service.from("relances").insert({
      user_id: userId,
      facture_id: f.id,
      destinataire: f.client_email!,
      jours_retard: f.joursRetard,
      automatique: true,
    });
    envoyees.push(f.numero);
  }

  // Récapitulatif à l'artisan dès qu'au moins une relance est partie
  if (envoyees.length > 0 && profil.email_pro) {
    const lignes = aRelancer
      .filter((f) => envoyees.includes(f.numero))
      .map(
        (f) =>
          `<li>${f.numero} — ${f.client_nom} — ${formatEuros(f.total_ht)} — ${f.joursRetard} j de retard</li>`,
      )
      .join("");
    await sendEmail({
      to: profil.email_pro,
      subject: `${envoyees.length} relance(s) automatique(s) envoyée(s) — ${formatDateFr(today)}`,
      html: `<p>Bonjour,</p><p>Les relances suivantes sont parties ce matin :</p><ul>${lignes}</ul><p>Rappel : maximum 2 relances automatiques par facture — au-delà, un appel vaut mieux qu'un email.</p><p>— Facture AE</p>`,
    });
  }

  const details = [
    `${envoyees.length} relance(s) envoyée(s)${envoyees.length ? ` : ${envoyees.join(", ")}` : ""}`,
    echecs.length ? `échecs : ${echecs.join(" ; ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { statut: echecs.length > 0 ? "erreur" : "succes", details };
}
