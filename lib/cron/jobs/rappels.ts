import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import {
  contratsARappeler,
  type ContratRappelable,
} from "@/lib/rappels-entretien";
import { ajouterJours } from "@/lib/agenda-vues";
import { creneauxLibres, libelleCreneau, type Creneau } from "@/lib/creneaux-visite";
import { envoyerPropositionVisite, occupationsAgenda } from "@/lib/visites/proposer";
import { baseUrlPublique } from "@/lib/url-publique";
import { escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email";
import { lignePenseBeteHtml } from "@/lib/cron/pense-bete";
import { formatDateFr } from "@/lib/format";
import { NOM_APPLICATION } from "@/lib/marque";

/**
 * Propositions de visite automatiques (rappels d'entretien) — OFF par
 * défaut, soumises au mode simulation. La sélection (contrat actif,
 * échéance dans la fenêtre, pas déjà proposée ni confirmée, email
 * client présent) est PURE et testée dans lib/rappels-entretien. Le
 * client reçoit un créneau libre de l'agenda à l'échéance et d'autres
 * au choix ; sa réponse crée le rendez-vous (lib/visites/public).
 * Traçabilité : contrats_maintenance.rappel_envoye_pour mémorise
 * l'échéance proposée ; replanifier la visite ré-arme la proposition.
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
      "id, intitule, equipement, statut, date_debut, frequence, prochaine_visite, rappel_envoye_pour, confirmation_envoyee_pour, client:clients(nom, email)",
    )
    .eq("user_id", userId)
    .eq("statut", "actif");
  // Une lecture en panne ne vaut pas « rien à proposer » (le journal
  // disait « succès » et bloquait tout nouvel essai le jour même).
  if (erreurLecture) {
    return { statut: "erreur", details: `Lecture des contrats : ${erreurLecture.message}` };
  }

  const candidates = (contrats ?? []).map((c) => ({
    id: c.id,
    intitule: c.intitule,
    equipement: c.equipement,
    statut: c.statut,
    date_debut: c.date_debut,
    frequence: c.frequence,
    prochaine_visite: c.prochaine_visite,
    rappel_envoye_pour: c.rappel_envoye_pour,
    confirmation_envoyee_pour: c.confirmation_envoyee_pour,
    client_email: (c.client as { email: string | null } | null)?.email ?? null,
    client_nom: (c.client as { nom: string } | null)?.nom ?? "client",
  }));

  const aProposer = contratsARappeler(
    candidates as Array<ContratRappelable & { client_nom: string }>,
    { today, fenetreJours: profil.rappels_fenetre_jours ?? 30 },
  );

  if (aProposer.length === 0) {
    return { statut: "succes", details: "Aucune proposition de visite à envoyer." };
  }

  const objet = (c: (typeof aProposer)[number]) =>
    c.intitule || c.equipement || "votre équipement";

  // Premier créneau libre à partir de l'échéance (jamais avant demain) :
  // les rendez-vous déjà posés sont lus une fois pour tous les contrats.
  const demain = ajouterJours(today, 1);
  const occupations = await occupationsAgenda(service, userId, demain, ajouterJours(today, 120));
  const creneauDe = (echeance: string): Creneau => {
    const depuis = echeance > demain ? echeance : demain;
    const libres = creneauxLibres({ depuis, jusquau: ajouterJours(depuis, 30), occupations, max: 1 });
    return libres[0] ?? { date: depuis, debut: null, fin: null };
  };

  if (dryRun) {
    const libelles = aProposer.map(
      (c) => `${objet(c)} (${c.client_nom}, ${libelleCreneau(creneauDe(c.echeance))})`,
    );
    return {
      statut: "succes",
      details: `SIMULATION : ${aProposer.length} proposition(s) de visite auraient été envoyée(s) — ${libelles.join(", ")}. Désactivez le mode simulation pour envoyer réellement.`,
    };
  }

  if (!isEmailConfigured()) {
    return {
      statut: "erreur",
      details: "Envoi d'e-mail non configuré (GMAIL_USER / GMAIL_APP_PASSWORD).",
    };
  }

  const baseUrl = await baseUrlPublique();
  const envoyes: string[] = [];
  const echecs: string[] = [];

  for (const c of aProposer) {
    const propose = creneauDe(c.echeance);
    const res = await envoyerPropositionVisite({
      db: service,
      userId,
      contratId: c.id,
      profil,
      propose,
      origine: "automatique",
      baseUrl,
      today,
    });
    if (!res.ok) {
      echecs.push(`${objet(c)} : ${res.error}`);
      continue;
    }
    // Le créneau proposé est maintenant pris : les contrats suivants ne le reçoivent pas.
    occupations.push({ date_start: propose.date, date_end: propose.date, heure_debut: propose.debut ? `${propose.debut}:00` : null, heure_fin: propose.fin ? `${propose.fin}:00` : null });
    envoyes.push(`${objet(c)} — ${c.client_nom} — ${libelleCreneau(propose)}`);
  }

  // Récapitulatif à l'artisan dès qu'au moins une proposition est partie
  if (envoyes.length > 0 && profil.email_pro) {
    const penseBete = await lignePenseBeteHtml(service, userId, today);
    await sendEmail({
      to: profil.email_pro,
      subject: `${envoyes.length} proposition(s) de visite envoyée(s) — ${formatDateFr(today)}`,
      // Noms de clients et intitulés échappés (contenu HTML).
      html: `<p>Bonjour,</p><p>Les propositions de visite suivantes sont parties ce matin :</p><ul>${envoyes
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join("")}</ul><p>Dès qu'un client choisit son créneau, le rendez-vous apparaît dans votre agenda et vous êtes prévenu.</p>${penseBete}<p>— ${NOM_APPLICATION}</p>`,
    });
  }

  const details = [
    `${envoyes.length} proposition(s) envoyée(s)${envoyes.length ? ` : ${envoyes.join(" ; ")}` : ""}`,
    echecs.length ? `échecs : ${echecs.join(" ; ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { statut: echecs.length > 0 ? "erreur" : "succes", details };
}
