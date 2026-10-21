import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { ajouterJours } from "@/lib/agenda-vues";
import {
  creneauxLibres,
  expirationProposition,
  libelleCreneau,
  type Creneau,
  type Occupation,
} from "@/lib/creneaux-visite";
import {
  buildPropositionVisiteEmail,
  isEmailConfigured,
  sendEmail,
  signatureDepuisProfil,
} from "@/lib/email";
import { formatDateFr } from "@/lib/format";
import { normaliserHoraires } from "@/lib/horaires-visites";
import { parseIcal } from "@/lib/ical-parser";

/** Client Supabase de l'utilisateur (RLS) ou service role (tâches planifiées : filtrer par user_id). */
export type Db = SupabaseClient<Database>;
export type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

/** Forme du JSON `creneaux` d'une proposition. */
export type CreneauxProposition = { propose: Creneau; autres: Creneau[] };

export function nomExpediteur(profil: Profil | null | undefined): string {
  return (
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    "Votre artisan"
  );
}

/**
 * Rendez-vous du calendrier du téléphone (abonnement iCal, lecture
 * seule) sur une période : eux aussi rendent un créneau indisponible.
 * Un flux lent, absent ou en panne ne bloque rien : liste vide.
 */
async function occupationsTelephone(url: string | null, debut: string, fin: string): Promise<Occupation[]> {
  if (!url) return [];
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const texte = await res.text();
    if (texte.length > 2 * 1024 * 1024) return [];
    return parseIcal(texte)
      .filter((e) => e.date_end >= debut && e.date_start <= fin)
      .map((e) => ({
        date_start: e.date_start,
        date_end: e.date_end,
        heure_debut: e.time_start ? `${e.time_start}:00` : null,
        heure_fin: e.time_end ? `${e.time_end}:00` : null,
        libelle: `📱 ${e.summary || "Rendez-vous"}`,
      }));
  } catch {
    return [];
  }
}

/**
 * Tout ce qui occupe l'agenda sur une période : interventions (hors
 * corbeille), visites d'entretien planifiées des autres contrats,
 * travaux de devis planifiés (date de début + durée estimée), tâches à
 * l'heure non faites, et rendez-vous du téléphone. Sert à ne proposer
 * au client que des créneaux libres, et à montrer à l'artisan où il
 * est pris.
 */
export async function occupationsAgenda(
  db: Db,
  userId: string,
  debut: string,
  fin: string,
  saufContratId?: string,
  calendrierTelephoneUrl?: string | null,
): Promise<Occupation[]> {
  const visites = db
    .from("contrats_maintenance")
    .select("id, prochaine_visite, prochaine_visite_heure, intitule, client:clients(nom)")
    .eq("user_id", userId)
    .eq("statut", "actif")
    .not("prochaine_visite", "is", null)
    .gte("prochaine_visite", debut)
    .lte("prochaine_visite", fin);
  const [interv, vis, devis, taches, telephone] = await Promise.all([
    db
      .from("interventions")
      .select("date_intervention, date_fin, heure_debut, heure_fin, description, type, client:clients(nom)")
      .eq("user_id", userId)
      .is("supprime_le", null)
      // Un chantier commencé avant la période peut la couvrir : on
      // remonte un mois et on filtre sur la date de fin.
      .gte("date_intervention", ajouterJours(debut, -31))
      .lte("date_intervention", fin),
    saufContratId ? visites.neq("id", saufContratId) : visites,
    db
      .from("devis")
      .select("numero, date_debut_travaux, duree_estimee_jours, statut, client:clients(nom)")
      .eq("user_id", userId)
      .eq("est_modele", false)
      .not("date_debut_travaux", "is", null)
      .not("statut", "in", "(refuse,expire)")
      .gte("date_debut_travaux", ajouterJours(debut, -31))
      .lte("date_debut_travaux", fin),
    db
      .from("taches")
      .select("titre, date_echeance, heure")
      .eq("user_id", userId)
      .eq("fait", false)
      .not("heure", "is", null)
      .gte("date_echeance", debut)
      .lte("date_echeance", fin),
    occupationsTelephone(calendrierTelephoneUrl ?? null, debut, fin),
  ]);
  const occupations: Occupation[] = [...telephone];
  const nomClient = (c: unknown): string | null => {
    const o = (Array.isArray(c) ? c[0] : c) as { nom?: string } | null | undefined;
    return o?.nom ?? null;
  };
  for (const i of interv.data ?? []) {
    const date_end = i.date_fin ?? i.date_intervention;
    if (date_end < debut) continue;
    occupations.push({
      date_start: i.date_intervention,
      date_end,
      heure_debut: i.heure_debut,
      heure_fin: i.heure_fin,
      libelle: [i.description || i.type, nomClient(i.client)].filter(Boolean).join(" · "),
    });
  }
  for (const v of vis.data ?? []) {
    occupations.push({
      date_start: v.prochaine_visite!,
      date_end: v.prochaine_visite!,
      heure_debut: v.prochaine_visite_heure,
      heure_fin: null,
      libelle: ["Visite d'entretien", nomClient(v.client) ?? v.intitule].filter(Boolean).join(" · "),
    });
  }
  for (const d of devis.data ?? []) {
    const jours = Math.max(1, d.duree_estimee_jours ?? 1);
    const date_end = ajouterJours(d.date_debut_travaux!, jours - 1);
    if (date_end < debut) continue;
    occupations.push({
      date_start: d.date_debut_travaux!,
      date_end,
      heure_debut: null,
      heure_fin: null,
      libelle: [`Travaux devis ${d.numero}`, nomClient(d.client)].filter(Boolean).join(" · "),
    });
  }
  for (const t of taches.data ?? []) {
    if (!t.date_echeance || !t.heure) continue;
    occupations.push({
      date_start: t.date_echeance,
      date_end: t.date_echeance,
      heure_debut: t.heure,
      heure_fin: null,
      libelle: `Tâche · ${t.titre}`,
    });
  }
  return occupations;
}

export type PropositionEnvoyee = {
  /** null en simulation (rien n'est écrit ni envoyé). */
  id: string | null;
  clientEmail: string;
  propose: Creneau;
  autres: Creneau[];
};

/**
 * Propose un créneau de visite au client par e-mail, avec d'autres
 * créneaux libres de l'agenda au choix ; le lien de réponse crée le
 * rendez-vous dans l'agenda (lib/visites/public). Le contrat prend la
 * date proposée comme prochaine visite (non confirmée) et
 * rappel_envoye_pour, pour qu'aucun rappel ne reparte pour cette
 * échéance. En simulation, rien n'est écrit ni envoyé.
 */
export async function envoyerPropositionVisite(args: {
  db: Db;
  userId: string;
  contratId: string;
  profil: Profil | null;
  propose: Creneau;
  origine: "manuel" | "automatique";
  baseUrl: string;
  today: string;
  dryRun?: boolean;
}): Promise<{ ok: true; data: PropositionEnvoyee } | { ok: false; error: string }> {
  const { db, userId, contratId, profil, propose } = args;
  const { data: contrat } = await db
    .from("contrats_maintenance")
    .select("id, statut, intitule, equipement, client_id, client:clients(nom, email)")
    .eq("id", contratId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!contrat) return { ok: false, error: "Contrat introuvable." };
  if (contrat.statut !== "actif") return { ok: false, error: "Contrat non actif." };
  const client = (Array.isArray(contrat.client) ? contrat.client[0] : contrat.client) as
    | { nom: string; email: string | null }
    | null;
  if (!client?.email) {
    return { ok: false, error: "Le client n'a pas d'adresse e-mail : ajoutez-la sur sa fiche." };
  }
  if (!isEmailConfigured()) {
    return { ok: false, error: "Envoi d'e-mail non configuré (GMAIL_USER / GMAIL_APP_PASSWORD)." };
  }
  if (propose.date < args.today) {
    return { ok: false, error: "La date proposée est déjà passée." };
  }

  // Autres créneaux libres : la semaine avant la date proposée (jamais
  // avant demain) jusqu'à trois semaines après.
  const demain = ajouterJours(args.today, 1);
  const depuis = ajouterJours(propose.date, -7) > demain ? ajouterJours(propose.date, -7) : demain;
  const jusquau = ajouterJours(propose.date, 21);
  const occupations = await occupationsAgenda(db, userId, depuis, jusquau, contratId, profil?.external_calendar_url);
  const autres = creneauxLibres({
    depuis,
    jusquau,
    occupations,
    exclure: propose,
    max: 6,
    horaires: normaliserHoraires(profil?.horaires_visites),
  });

  if (args.dryRun) {
    return { ok: true, data: { id: null, clientEmail: client.email, propose, autres } };
  }

  const nowIso = new Date().toISOString();
  const token = randomBytes(32).toString("base64url");
  const expireLe = expirationProposition(nowIso);
  const creneaux: CreneauxProposition = { propose, autres };
  const { data: cree, error } = await db
    .from("visites_propositions")
    .insert({
      user_id: userId,
      contrat_id: contratId,
      token,
      origine: args.origine,
      date_proposee: propose.date,
      heure_proposee: propose.debut ? `${propose.debut}:00` : null,
      creneaux: creneaux as unknown as Database["public"]["Tables"]["visites_propositions"]["Insert"]["creneaux"],
      statut: "envoyee",
      envoyee_le: nowIso,
      expire_le: expireLe,
    })
    .select("id")
    .single();
  if (error || !cree) return { ok: false, error: error?.message ?? "Enregistrement impossible." };

  const expediteurNom = nomExpediteur(profil);
  const email = buildPropositionVisiteEmail({
    clientNom: client.nom,
    expediteurNom,
    objetEntretien: contrat.equipement || contrat.intitule || "votre installation",
    creneauText: libelleCreneau(propose),
    nbAutres: autres.length,
    lien: `${args.baseUrl.replace(/\/$/, "")}/visite/${token}`,
    expireLeText: formatDateFr(expireLe.slice(0, 10)),
    signature: signatureDepuisProfil(profil, expediteurNom),
  });
  const envoi = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil?.email_pro ?? undefined,
    fromName: expediteurNom,
  });
  if (!envoi.ok) {
    await db.from("visites_propositions").delete().eq("id", cree.id).eq("user_id", userId);
    return { ok: false, error: `E-mail non parti : ${envoi.error}` };
  }

  // Rien ne reste en suspens : la date proposée devient la prochaine
  // visite (non confirmée) et aucun rappel ne repart pour elle.
  await db
    .from("contrats_maintenance")
    .update({
      prochaine_visite: propose.date,
      prochaine_visite_heure: propose.debut ? `${propose.debut}:00` : null,
      rappel_envoye_pour: propose.date,
    })
    .eq("id", contratId)
    .eq("user_id", userId);

  return { ok: true, data: { id: cree.id, clientEmail: client.email, propose, autres } };
}
