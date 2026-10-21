import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import { propositionsARelancer, propositionsSansReponse, visitesDemain } from "@/lib/visites-suivi";
import { libelleCreneau, libellePlage, type Creneau } from "@/lib/creneaux-visite";
import type { CreneauxProposition } from "@/lib/visites/proposer";
import { nomExpediteur } from "@/lib/visites/proposer";
import { prevenirArtisan } from "@/lib/visites/public";
import { baseUrlPublique } from "@/lib/url-publique";
import {
  buildPropositionVisiteEmail,
  buildRappelVeilleEmail,
  isEmailConfigured,
  sendEmail,
  signatureDepuisProfil,
} from "@/lib/email";
import { adresseClient } from "@/lib/agenda-contact";
import { libelleJourLong } from "@/lib/agenda-vues";
import { formatDateFr } from "@/lib/format";

/**
 * Suivi des visites d'entretien — même interrupteur que les propositions
 * automatiques (auto_rappels_active), soumis au mode simulation :
 * - relance du client sans réponse après 7 jours (une seule) ;
 * - alerte à l'artisan après 14 jours sans réponse (une seule) ;
 * - rappel au client la veille d'une visite confirmée.
 * Sélection PURE dans lib/visites-suivi.
 */
export const jobVisitesSuivi: JobDef = {
  tache: "visites-suivi",
  concerneLesClients: true,
  estActive: (profil) => profil.auto_rappels_active === true,
  doitTournerAujourdhui: () => true,
  executer: async (ctx) => executer(ctx),
};

async function executer({ service, userId, profil, today, dryRun }: ContexteJob): Promise<ResultatTache> {
  const nowIso = new Date().toISOString();
  const [{ data: propositions, error: e1 }, { data: contrats, error: e2 }] = await Promise.all([
    service
      .from("visites_propositions")
      .select("id, contrat_id, token, statut, envoyee_le, expire_le, date_proposee, creneaux, relance_le, artisan_prevenu_le")
      .eq("user_id", userId)
      .eq("statut", "envoyee"),
    service
      .from("contrats_maintenance")
      .select("id, intitule, equipement, statut, prochaine_visite, prochaine_visite_heure, confirmation_envoyee_pour, rappel_veille_envoye_pour, client:clients(nom, email, adresse_ligne1, adresse_ligne2, code_postal, ville)")
      .eq("user_id", userId)
      .eq("statut", "actif"),
  ]);
  if (e1 || e2) return { statut: "erreur", details: `Lecture : ${(e1 ?? e2)!.message}` };

  type ClientJoint = { nom: string; email: string | null; adresse_ligne1: string | null; adresse_ligne2: string | null; code_postal: string | null; ville: string | null };
  const clientDe = (c: { client: unknown }): ClientJoint | null =>
    (Array.isArray(c.client) ? c.client[0] : c.client) as ClientJoint | null;
  const contratParId = new Map((contrats ?? []).map((c) => [c.id, c]));

  const aRelancer = propositionsARelancer(propositions ?? [], { today, nowIso });
  const aSignaler = propositionsSansReponse(propositions ?? [], { today, nowIso });
  const demain = visitesDemain(
    (contrats ?? []).map((c) => ({ ...c, client_email: clientDe(c)?.email ?? null })),
    today,
  );

  if (aRelancer.length === 0 && aSignaler.length === 0 && demain.length === 0) {
    return { statut: "succes", details: "Rien à relancer, aucune visite demain." };
  }
  const objetDe = (contratId: string) => {
    const c = contratParId.get(contratId);
    return c?.equipement || c?.intitule || "votre installation";
  };
  const nomClientDe = (contratId: string) => {
    const c = contratParId.get(contratId);
    return (c && clientDe(c)?.nom) || "client";
  };

  if (dryRun) {
    return {
      statut: "succes",
      details: `SIMULATION : ${aRelancer.length} relance(s) client, ${aSignaler.length} alerte(s) sans réponse, ${demain.length} rappel(s) de la veille — ${[
        ...aRelancer.map((p) => `relance ${nomClientDe(p.contrat_id)}`),
        ...aSignaler.map((p) => `alerte ${nomClientDe(p.contrat_id)}`),
        ...demain.map((c) => `veille ${clientDe(c)?.nom ?? "client"}`),
      ].join(", ")}.`,
    };
  }
  if (!isEmailConfigured()) {
    return { statut: "erreur", details: "Envoi d'e-mail non configuré (GMAIL_USER / GMAIL_APP_PASSWORD)." };
  }

  const expediteurNom = nomExpediteur(profil);
  const signature = signatureDepuisProfil(profil, expediteurNom);
  const baseUrl = await baseUrlPublique();
  const faits: string[] = [];
  const echecs: string[] = [];

  for (const p of aRelancer) {
    const contrat = contratParId.get(p.contrat_id);
    const client = contrat ? clientDe(contrat) : null;
    if (!client?.email) continue;
    const creneaux = (p.creneaux ?? {}) as Partial<CreneauxProposition>;
    const propose: Creneau = creneaux.propose ?? { date: p.date_proposee, debut: null, fin: null };
    const email = buildPropositionVisiteEmail({
      clientNom: client.nom,
      expediteurNom,
      objetEntretien: objetDe(p.contrat_id),
      creneauText: libelleCreneau(propose),
      nbAutres: creneaux.autres?.length ?? 0,
      lien: `${baseUrl}/visite/${p.token}`,
      expireLeText: formatDateFr(p.expire_le.slice(0, 10)),
      relance: true,
      signature,
    });
    const res = await sendEmail({ to: client.email, subject: email.subject, html: email.html, text: email.text, replyTo: profil.email_pro ?? undefined, fromName: expediteurNom });
    if (!res.ok) {
      echecs.push(`relance ${client.nom} : ${res.error}`);
      continue;
    }
    await service.from("visites_propositions").update({ relance_le: nowIso }).eq("id", p.id).eq("user_id", userId);
    faits.push(`relance ${client.nom}`);
  }

  for (const p of aSignaler) {
    const contrat = contratParId.get(p.contrat_id);
    const client = contrat ? clientDe(contrat) : null;
    await prevenirArtisan(service, userId, profil, {
      clientNom: client?.nom ?? "Le client",
      objetEntretien: objetDe(p.contrat_id),
      statut: "sans_reponse",
      creneauText: null,
      message: `Proposition envoyée le ${formatDateFr(p.envoyee_le.slice(0, 10))}, toujours sans réponse : appelez le client pour convenir d'une date.`,
      lienFiche: `/maintenance/${p.contrat_id}`,
    });
    await service.from("visites_propositions").update({ artisan_prevenu_le: nowIso }).eq("id", p.id).eq("user_id", userId);
    faits.push(`alerte ${client?.nom ?? "client"}`);
  }

  for (const c of demain) {
    const client = clientDe(c);
    if (!client?.email || !c.prochaine_visite) continue;
    const creneau: Creneau = { date: c.prochaine_visite, debut: c.prochaine_visite_heure?.slice(0, 5) ?? null, fin: null };
    const email = buildRappelVeilleEmail({
      clientNom: client.nom,
      expediteurNom,
      objetEntretien: c.equipement || c.intitule || "votre installation",
      dateVisiteLongue: libelleJourLong(c.prochaine_visite),
      plageText: libellePlage(creneau),
      adresse: adresseClient(client),
      telephone: profil.telephone,
      signature,
    });
    const res = await sendEmail({ to: client.email, subject: email.subject, html: email.html, text: email.text, replyTo: profil.email_pro ?? undefined, fromName: expediteurNom });
    if (!res.ok) {
      echecs.push(`veille ${client.nom} : ${res.error}`);
      continue;
    }
    await service.from("contrats_maintenance").update({ rappel_veille_envoye_pour: c.prochaine_visite }).eq("id", c.id).eq("user_id", userId);
    faits.push(`veille ${client.nom}`);
  }

  const details = [faits.length ? faits.join(", ") : "rien d'envoyé", echecs.length ? `échecs : ${echecs.join(" ; ")}` : null]
    .filter(Boolean)
    .join(" · ");
  return { statut: echecs.length > 0 ? "erreur" : "succes", details };
}
