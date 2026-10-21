import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database";
import { aujourdhuiParis } from "@/lib/dates";
import { ajouterJours, libelleJourLong } from "@/lib/agenda-vues";
import {
  creneauOccupe,
  etatProposition,
  libelleCreneau,
  libellePlage,
  type Creneau,
  type EtatProposition,
  type ReponseVisite,
} from "@/lib/creneaux-visite";
import { nomExpediteur, occupationsAgenda, type CreneauxProposition, type Profil } from "@/lib/visites/proposer";
import {
  buildConfirmationVisiteEmail,
  buildReponseVisiteEmail,
  isEmailConfigured,
  sendEmail,
  signatureDepuisProfil,
} from "@/lib/email";
import { envoyerNotification, pushConfigure } from "@/lib/push/envoi";
import { adresseClient } from "@/lib/agenda-contact";
import { formatDateFr } from "@/lib/format";

type PropositionRow = Database["public"]["Tables"]["visites_propositions"]["Row"];

export type PropositionPublique = {
  etat: EtatProposition | "indisponible";
  proposition: PropositionRow | null;
  prestataireNom: string;
  objetEntretien: string;
  propose: Creneau | null;
  /** Autres créneaux encore libres aujourd'hui, avec leur index d'origine. */
  autres: Array<{ index: number; creneau: Creneau }>;
  /** Créneau retenu, une fois répondu. */
  choix: Creneau | null;
};

function creneauxDe(p: PropositionRow): CreneauxProposition {
  const c = (p.creneaux ?? {}) as Partial<CreneauxProposition>;
  return {
    propose: c.propose ?? { date: p.date_proposee, debut: p.heure_proposee?.slice(0, 5) ?? null, fin: null },
    autres: Array.isArray(c.autres) ? c.autres : [],
  };
}

/**
 * Résolution d'une proposition par son jeton — CÔTÉ SERVEUR UNIQUEMENT
 * (service role). Les autres créneaux sont revérifiés : un rendez-vous
 * posé depuis l'envoi en retire un de la liste.
 */
export async function getPropositionParToken(token: string): Promise<PropositionPublique> {
  const vide: PropositionPublique = {
    etat: "introuvable",
    proposition: null,
    prestataireNom: "Votre artisan",
    objetEntretien: "votre installation",
    propose: null,
    autres: [],
    choix: null,
  };
  if (!token || token.length < 16) return vide;
  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (e) {
    console.error("Lien public visite — service indisponible :", e);
    return { ...vide, etat: "indisponible" };
  }
  const { data: p } = await service.from("visites_propositions").select("*").eq("token", token).maybeSingle();
  const today = aujourdhuiParis();
  const etat = etatProposition(p, new Date().toISOString(), today);
  if (!p) return vide;

  const [{ data: contrat }, { data: profil }] = await Promise.all([
    service.from("contrats_maintenance").select("intitule, equipement").eq("id", p.contrat_id).maybeSingle(),
    service.from("profil_entreprise").select("*").eq("user_id", p.user_id).maybeSingle(),
  ]);
  const { propose, autres } = creneauxDe(p);
  let autresLibres: Array<{ index: number; creneau: Creneau }> = [];
  if (etat === "utilisable" && autres.length > 0) {
    const dates = autres.map((c) => c.date).sort();
    const occupations = await occupationsAgenda(service, p.user_id, dates[0]!, dates[dates.length - 1]!, p.contrat_id);
    autresLibres = autres
      .map((creneau, index) => ({ index, creneau }))
      .filter(({ creneau }) => creneau.date >= ajouterJours(today, 1) && !creneauOccupe(creneau, occupations));
  }
  return {
    etat,
    proposition: p,
    prestataireNom: nomExpediteur(profil as Profil | null),
    objetEntretien: contrat?.equipement || contrat?.intitule || "votre installation",
    propose,
    autres: autresLibres,
    choix: p.choix_date ? { date: p.choix_date, debut: p.choix_debut?.slice(0, 5) ?? null, fin: p.choix_fin?.slice(0, 5) ?? null } : null,
  };
}

export type ResultatReponse =
  | { ok: true; resultat: "confirmee" | "replanifiee" | "refusee"; creneau: Creneau | null }
  | { ok: false; error: string; code: 400 | 409 | 410 | 503 };

/**
 * Réponse du client (page publique) : confirme le créneau proposé, en
 * choisit un autre, ou décline. Une confirmation crée le rendez-vous
 * dans l'agenda de l'artisan, met l'échéancier à jour, envoie la
 * confirmation au client et prévient l'artisan (e-mail + notification).
 */
export async function repondreProposition(token: string, reponse: ReponseVisite): Promise<ResultatReponse> {
  const pub = await getPropositionParToken(token);
  if (pub.etat === "indisponible") {
    return { ok: false, code: 503, error: "Service momentanément indisponible — réessayez dans quelques minutes." };
  }
  if (pub.etat !== "utilisable" || !pub.proposition || !pub.propose) {
    const messages: Record<string, string> = {
      repondue: "Vous avez déjà répondu à cette proposition.",
      expiree: "Ce lien a expiré : contactez votre artisan pour convenir d'une date.",
      annulee: "Cette proposition n'est plus valable.",
      introuvable: "Lien invalide.",
    };
    return { ok: false, code: 410, error: messages[pub.etat] ?? "Lien invalide." };
  }
  const p = pub.proposition;
  const service = createServiceClient();
  const nowIso = new Date().toISOString();

  let creneau: Creneau | null = null;
  if (reponse.choix === "propose") creneau = pub.propose;
  else if (typeof reponse.choix === "number") {
    const trouve = pub.autres.find((a) => a.index === reponse.choix);
    if (!trouve) {
      return { ok: false, code: 409, error: "Ce créneau vient d'être pris : choisissez-en un autre." };
    }
    creneau = trouve.creneau;
  }
  const message = reponse.message?.trim() || null;
  const statut = reponse.choix === "aucun" ? "refusee" : reponse.choix === "propose" ? "confirmee" : "replanifiee";

  // Une seule réponse : la revendication échoue si quelqu'un a répondu entre-temps.
  const { data: revendique, error: erreurClaim } = await service
    .from("visites_propositions")
    .update({
      statut,
      message_client: message,
      repondu_le: nowIso,
      choix_date: creneau?.date ?? null,
      choix_debut: creneau?.debut ? `${creneau.debut}:00` : null,
      choix_fin: creneau?.fin ? `${creneau.fin}:00` : null,
    })
    .eq("id", p.id)
    .eq("statut", "envoyee")
    .select("id");
  if (erreurClaim) return { ok: false, code: 503, error: erreurClaim.message };
  if (!revendique || revendique.length === 0) {
    return { ok: false, code: 410, error: "Vous avez déjà répondu à cette proposition." };
  }

  const [{ data: contrat }, { data: profil }] = await Promise.all([
    service
      .from("contrats_maintenance")
      .select("id, intitule, equipement, client_id, client:clients(nom, email, adresse_ligne1, adresse_ligne2, code_postal, ville)")
      .eq("id", p.contrat_id)
      .maybeSingle(),
    service.from("profil_entreprise").select("*").eq("user_id", p.user_id).maybeSingle(),
  ]);
  const client = (Array.isArray(contrat?.client) ? contrat?.client[0] : contrat?.client) as
    | { nom: string; email: string | null; adresse_ligne1: string | null; adresse_ligne2: string | null; code_postal: string | null; ville: string | null }
    | null
    | undefined;
  const expediteurNom = nomExpediteur(profil as Profil | null);
  const objet = pub.objetEntretien;
  const lienFiche = `/maintenance/${p.contrat_id}`;

  if (creneau && contrat) {
    // Le rendez-vous entre dans l'agenda, rattaché au client du contrat.
    const { data: intervention } = await service
      .from("interventions")
      .insert({
        user_id: p.user_id,
        client_id: contrat.client_id,
        date_intervention: creneau.date,
        heure_debut: creneau.debut ? `${creneau.debut}:00` : null,
        heure_fin: creneau.fin ? `${creneau.fin}:00` : null,
        type: "entretien",
        description: `Visite d'entretien — ${contrat.intitule || contrat.equipement || "contrat"}`,
        notes: `Créneau ${statut === "confirmee" ? "confirmé" : "choisi"} par le client en ligne le ${formatDateFr(nowIso.slice(0, 10))}.`,
        a_facturer: true,
      })
      .select("id")
      .single();
    if (intervention) {
      await service.from("visites_propositions").update({ intervention_id: intervention.id }).eq("id", p.id);
    }
    await service
      .from("contrats_maintenance")
      .update({
        prochaine_visite: creneau.date,
        prochaine_visite_heure: creneau.debut ? `${creneau.debut}:00` : null,
        confirmation_envoyee_pour: creneau.date,
        confirmation_envoyee_le: nowIso,
        rappel_envoye_pour: creneau.date,
      })
      .eq("id", p.contrat_id)
      .eq("user_id", p.user_id);

    if (client?.email && isEmailConfigured()) {
      const email = buildConfirmationVisiteEmail({
        clientNom: client.nom,
        expediteurNom,
        objetEntretien: objet,
        dateVisiteLongue: libelleJourLong(creneau.date),
        dateVisiteCourte: formatDateFr(creneau.date),
        plageText: libellePlage(creneau),
        adresse: adresseClient(client),
        signature: signatureDepuisProfil(profil as Profil | null, expediteurNom),
      });
      await sendEmail({
        to: client.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: (profil as Profil | null)?.email_pro ?? undefined,
        fromName: expediteurNom,
      });
    }
  }

  await prevenirArtisan(service, p.user_id, profil as Profil | null, {
    clientNom: client?.nom ?? "Le client",
    objetEntretien: objet,
    statut,
    creneauText: creneau ? libelleCreneau(creneau) : null,
    message,
    lienFiche,
  });

  return { ok: true, resultat: statut, creneau };
}

async function prevenirArtisan(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  profil: Profil | null,
  args: {
    clientNom: string;
    objetEntretien: string;
    statut: "confirmee" | "replanifiee" | "refusee";
    creneauText: string | null;
    message: string | null;
    lienFiche: string;
  },
): Promise<void> {
  const titre =
    args.statut === "refusee"
      ? `${args.clientNom} : aucun créneau ne convient`
      : args.statut === "confirmee"
        ? `${args.clientNom} a confirmé la visite`
        : `${args.clientNom} a choisi un autre créneau`;
  const corps = args.creneauText
    ? `${args.creneauText} — rendez-vous ajouté à l'agenda.`
    : args.message
      ? `Message : ${args.message}`
      : "À recontacter pour convenir d'une date.";

  if (profil?.email_pro && isEmailConfigured()) {
    const email = buildReponseVisiteEmail({ ...args, titre, corps });
    await sendEmail({ to: profil.email_pro, subject: email.subject, html: email.html, text: email.text });
  }
  if (pushConfigure()) {
    const { data: abonnements } = await service
      .from("push_abonnements")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    for (const a of abonnements ?? []) {
      const r = await envoyerNotification(a, { titre, corps, url: args.lienFiche, tag: `visite-${args.lienFiche}` });
      if (r.resultat === "expire") {
        await service.from("push_abonnements").delete().eq("endpoint", a.endpoint).eq("user_id", userId);
      }
    }
  }
}
