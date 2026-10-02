import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import {
  contratsARappeler,
  type ContratRappelable,
} from "@/lib/rappels-entretien";
import { buildRappelEntretienEmail, escapeHtml, isEmailConfigured, sendEmail, signatureDepuisProfil } from "@/lib/email";
import { lignePenseBeteHtml } from "@/lib/cron/pense-bete";
import { formatDateFr } from "@/lib/format";
import { NOM_APPLICATION } from "@/lib/marque";

/**
 * Rappels d'entretien automatiques — OFF par défaut, soumis au mode
 * simulation. La sélection (contrat actif, visite dans la fenêtre,
 * un seul rappel par échéance, email client présent) est PURE et
 * testée dans lib/rappels-entretien. Traçabilité simple : la colonne
 * contrats_maintenance.rappel_envoye_pour mémorise l'échéance déjà
 * rappelée ; changer la date de prochaine visite ré-arme le rappel.
 */
export const jobRappels: JobDef = {
  tache: "rappels-entretien",
  concerneLesClients: true,
  estActive: (profil) => profil.auto_rappels_active === true,
  doitTournerAujourdhui: () => true,
  executer: async (ctx) => executerRappels(ctx),
};

async function executerRappels({
  service,
  userId,
  profil,
  today,
  dryRun,
}: ContexteJob): Promise<ResultatTache> {
  const { data: contrats, error: erreurLecture } = await service
    .from("contrats_maintenance")
    .select(
      "id, intitule, equipement, statut, prochaine_visite, rappel_envoye_pour, client:clients(nom, email)",
    )
    .eq("user_id", userId)
    .eq("statut", "actif");
  // Une lecture en panne ne vaut pas « rien à rappeler » (le journal
  // disait « succès » et bloquait tout nouvel essai le jour même).
  if (erreurLecture) {
    return { statut: "erreur", details: `Lecture des contrats : ${erreurLecture.message}` };
  }

  const candidates = (contrats ?? []).map((c) => ({
    id: c.id,
    intitule: c.intitule,
    equipement: c.equipement,
    statut: c.statut,
    prochaine_visite: c.prochaine_visite,
    rappel_envoye_pour: c.rappel_envoye_pour,
    client_email:
      (c.client as { email: string | null } | null)?.email ?? null,
    client_nom: (c.client as { nom: string } | null)?.nom ?? "client",
  }));

  const aRappeler = contratsARappeler(
    candidates as Array<
      ContratRappelable & { client_nom: string }
    >,
    { today, fenetreJours: profil.rappels_fenetre_jours ?? 30 },
  );

  if (aRappeler.length === 0) {
    return { statut: "succes", details: "Aucun rappel d'entretien à envoyer." };
  }

  const objet = (c: (typeof aRappeler)[number]) =>
    c.intitule || c.equipement || "votre équipement";

  const libelles = aRappeler.map(
    (c) =>
      `${objet(c)} (${c.client_nom}, visite le ${formatDateFr(c.prochaine_visite!)})`,
  );

  if (dryRun) {
    return {
      statut: "succes",
      details: `SIMULATION : ${aRappeler.length} rappel(s) d'entretien auraient été envoyé(s) — ${libelles.join(", ")}. Désactivez le mode simulation pour envoyer réellement.`,
    };
  }

  if (!isEmailConfigured()) {
    return {
      statut: "erreur",
      details: "Envoi d'e-mail non configuré (GMAIL_USER / GMAIL_APP_PASSWORD).",
    };
  }

  const expediteurNom =
    profil.nom_commercial ||
    [profil.prenom, profil.nom].filter(Boolean).join(" ") ||
    "Votre artisan";

  const envoyes: string[] = [];
  const echecs: string[] = [];

  for (const c of aRappeler) {
    const email = buildRappelEntretienEmail({
      clientNom: c.client_nom,
      expediteurNom,
      objetEntretien: objet(c),
      dateVisiteText: formatDateFr(c.prochaine_visite!),
      telephone: profil.telephone,
      emailPro: profil.email_pro,
      signature: signatureDepuisProfil(profil, expediteurNom),
    });
    // Un seul rappel par échéance : la marque est posée AVANT l'envoi
    // (conditionnelle : un déclencheur concurrent ne renvoie pas) et
    // retirée si l'envoi échoue. Avant, l'email partait d'abord : si la
    // marque échouait ensuite, le second déclencheur du jour ou le
    // lendemain renvoyait le même email au client.
    const { data: marque, error: erreurMarque } = await service
      .from("contrats_maintenance")
      .update({ rappel_envoye_pour: c.prochaine_visite })
      .eq("id", c.id)
      .eq("user_id", userId)
      .or(`rappel_envoye_pour.is.null,rappel_envoye_pour.neq.${c.prochaine_visite}`)
      .select("id");
    if (erreurMarque) {
      echecs.push(`${objet(c)} : anti-doublon non enregistré, rappel non envoyé (${erreurMarque.message})`);
      continue;
    }
    if (!marque || marque.length === 0) continue; // déjà rappelé entre-temps
    const res = await sendEmail({
      to: c.client_email!,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: profil.email_pro ?? undefined,
    });
    if (!res.ok) {
      await service
        .from("contrats_maintenance")
        .update({ rappel_envoye_pour: c.rappel_envoye_pour ?? null })
        .eq("id", c.id)
        .eq("user_id", userId);
      echecs.push(`${objet(c)} : ${res.error}`);
      continue;
    }
    envoyes.push(
      `${objet(c)} — ${c.client_nom} — visite le ${formatDateFr(c.prochaine_visite!)}`,
    );
  }

  // Récapitulatif à l'artisan dès qu'au moins un rappel est parti
  if (envoyes.length > 0 && profil.email_pro) {
    const penseBete = await lignePenseBeteHtml(service, userId, today);
    await sendEmail({
      to: profil.email_pro,
      subject: `${envoyes.length} rappel(s) d'entretien envoyé(s) — ${formatDateFr(today)}`,
      // Noms de clients et intitulés échappés (contenu HTML).
      html: `<p>Bonjour,</p><p>Les rappels d'entretien suivants sont partis ce matin :</p><ul>${envoyes
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join("")}</ul><p>Pensez à planifier ces visites dans votre agenda.</p>${penseBete}<p>— ${NOM_APPLICATION}</p>`,
    });
  }

  const details = [
    `${envoyes.length} rappel(s) envoyé(s)${envoyes.length ? ` : ${envoyes.join(" ; ")}` : ""}`,
    echecs.length ? `échecs : ${echecs.join(" ; ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { statut: echecs.length > 0 ? "erreur" : "succes", details };
}
