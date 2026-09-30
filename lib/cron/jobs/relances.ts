import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import {
  facturesARelancer,
  type FactureRelancable,
} from "@/lib/relances-auto";
import { buildRelanceEmail, escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email";
import { lignePenseBeteHtml } from "@/lib/cron/pense-bete";
import { formatDateFr, formatEuros } from "@/lib/format";
import { montantRestant } from "@/lib/paiements-helpers";

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
  const [
    { data: factures, error: erreurFactures },
    { data: relances, error: erreurRelances },
  ] = await Promise.all([
    service
      .from("factures")
      .select(
        "id, numero, statut, date_echeance, total_ht, exclure_relances_auto, client:clients(nom, email)",
      )
      .eq("user_id", userId)
      .eq("statut", "envoyee")
      // Un avoir n'est pas un impayé à relancer.
      .neq("type_facture", "avoir"),
    service
      .from("relances")
      .select("facture_id, envoyee_le, automatique")
      .eq("user_id", userId),
  ]);
  // Sans l'historique des relances, le délai de 15 jours et le plafond de
  // 2 relances par facture n'existent plus : on n'envoie RIEN.
  if (erreurFactures || erreurRelances) {
    return {
      statut: "erreur",
      details: `Lecture impossible, aucune relance envoyée : ${(erreurFactures ?? erreurRelances)!.message}`,
    };
  }

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

  // Reste dû par facture (acompte encaissé, avoir d'imputation) : c'est
  // ce montant que la relance réclame, pas le total.
  const ids = aRelancer.map((f) => f.id);
  const [{ data: paiements, error: erreurPaiements }, { data: avoirs, error: erreurAvoirs }] =
    await Promise.all([
      service
        .from("paiements")
        .select("facture_id, montant")
        .eq("user_id", userId)
        .in("facture_id", ids),
      service
        .from("factures")
        .select("facture_parent_id, total_ht")
        .eq("user_id", userId)
        .eq("type_facture", "avoir")
        .eq("mode_avoir", "imputation")
        .in("statut", ["envoyee", "payee"])
        .in("facture_parent_id", ids),
    ]);
  if (erreurPaiements || erreurAvoirs) {
    return {
      statut: "erreur",
      details: `Reste dû illisible, aucune relance envoyée : ${(erreurPaiements ?? erreurAvoirs)!.message}`,
    };
  }
  const deduit = new Map<string, number>();
  for (const p of paiements ?? []) {
    deduit.set(p.facture_id, (deduit.get(p.facture_id) ?? 0) + Number(p.montant));
  }
  for (const a of avoirs ?? []) {
    if (!a.facture_parent_id) continue;
    deduit.set(a.facture_parent_id, (deduit.get(a.facture_parent_id) ?? 0) + Number(a.total_ht));
  }
  const avecReste = aRelancer
    .map((f) => ({ ...f, reste: montantRestant(f.total_ht, deduit.get(f.id) ?? 0) }))
    .filter((f) => f.reste > 0.005);
  if (avecReste.length === 0) {
    return { statut: "succes", details: "Aucune facture à relancer (toutes soldées)." };
  }

  const libelles = avecReste.map(
    (f) =>
      `${f.numero} (${f.joursRetard} j de retard${
        f.reste < f.total_ht - 0.005 ? `, reste ${formatEuros(f.reste)}` : ""
      })`,
  );

  if (dryRun) {
    return {
      statut: "succes",
      details: `SIMULATION : ${avecReste.length} relance(s) auraient été envoyée(s) — ${libelles.join(", ")}. Désactivez le mode simulation pour envoyer réellement.`,
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

  for (const f of avecReste) {
    const email = buildRelanceEmail({
      numero: f.numero,
      clientNom: f.client_nom,
      expediteurNom,
      totalText: formatEuros(f.total_ht),
      resteText: f.reste < f.total_ht - 0.005 ? formatEuros(f.reste) : undefined,
      echeanceText: formatDateFr(f.date_echeance),
      joursRetard: f.joursRetard,
    });
    // Trace AVANT l'envoi : c'est elle qui empêche une seconde relance
    // demain. Si elle ne peut pas être écrite, on n'envoie pas ; si
    // l'envoi échoue ensuite, on la retire.
    const { data: trace, error: erreurTrace } = await service
      .from("relances")
      .insert({
        user_id: userId,
        facture_id: f.id,
        destinataire: f.client_email!,
        jours_retard: f.joursRetard,
        automatique: true,
      })
      .select("id")
      .single();
    if (erreurTrace || !trace) {
      echecs.push(`${f.numero} : trace non enregistrée (${erreurTrace?.message ?? "?"}), relance non envoyée`);
      continue;
    }
    const res = await sendEmail({
      to: f.client_email!,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: profil.email_pro ?? undefined,
    });
    if (!res.ok) {
      await service.from("relances").delete().eq("id", trace.id);
      echecs.push(`${f.numero} : ${res.error}`);
      continue;
    }
    envoyees.push(f.numero);
  }

  // Récapitulatif à l'artisan dès qu'au moins une relance est partie
  if (envoyees.length > 0 && profil.email_pro) {
    // Noms de clients échappés (contenu HTML).
    const lignes = avecReste
      .filter((f) => envoyees.includes(f.numero))
      .map(
        (f) =>
          `<li>${escapeHtml(f.numero)} — ${escapeHtml(f.client_nom)} — ${formatEuros(f.reste)}${
            f.reste < f.total_ht - 0.005 ? ` (sur ${formatEuros(f.total_ht)})` : ""
          } — ${f.joursRetard} j de retard</li>`,
      )
      .join("");
    const penseBete = await lignePenseBeteHtml(service, userId, today);
    await sendEmail({
      to: profil.email_pro,
      subject: `${envoyees.length} relance(s) automatique(s) envoyée(s) — ${formatDateFr(today)}`,
      html: `<p>Bonjour,</p><p>Les relances suivantes sont parties ce matin :</p><ul>${lignes}</ul><p>Rappel : maximum 2 relances automatiques par facture — au-delà, un appel vaut mieux qu'un email.</p>${penseBete}<p>— Facture AE</p>`,
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
