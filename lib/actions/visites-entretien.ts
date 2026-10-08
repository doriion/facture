"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfil } from "@/lib/actions/profil";
import {
  buildConfirmationVisiteEmail,
  isEmailConfigured,
  sendEmail,
  signatureDepuisProfil,
} from "@/lib/email";
import { adresseClient } from "@/lib/agenda-contact";
import { libelleJourLong } from "@/lib/agenda-vues";
import { formatDateFr } from "@/lib/format";
import {
  heureLisible,
  planificationVisiteSchema,
  type PlanificationVisiteInput,
} from "@/lib/visite-entretien";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type VisitePlanifiee = {
  /** true : l'e-mail de confirmation est parti chez le client. */
  confirmationEnvoyee: boolean;
  /** Date enregistrée mais confirmation non envoyée : pourquoi. */
  motif?: string;
};

/**
 * Enregistre la date (et l'heure) de la prochaine visite d'entretien
 * convenue avec le client, et lui envoie si demandé un e-mail de
 * confirmation. La date est TOUJOURS enregistrée ; si l'e-mail ne peut
 * pas partir (client sans adresse, envoi non configuré, échec), le
 * motif est renvoyé pour l'afficher.
 *
 * Une confirmation envoyée vaut rappel : la colonne rappel_envoye_pour
 * est posée sur cette date pour que le rappel automatique d'entretien
 * (« pour convenir d'un rendez-vous… ») ne reparte pas pour une visite
 * déjà convenue.
 */
export async function planifierVisiteAction(
  contratId: string,
  input: PlanificationVisiteInput,
): Promise<ActionResult<VisitePlanifiee>> {
  const parsed = planificationVisiteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: contrat } = await supabase
    .from("contrats_maintenance")
    .select(
      "id, statut, intitule, equipement, client:clients(id, nom, email, adresse_ligne1, adresse_ligne2, code_postal, ville)",
    )
    .eq("id", contratId)
    .maybeSingle();
  if (!contrat) return { ok: false, error: "Contrat introuvable." };
  if (contrat.statut !== "actif") {
    return { ok: false, error: "Contrat non actif : réactivez-le avant de planifier une visite." };
  }
  type ClientJoint = {
    id: string;
    nom: string;
    email: string | null;
    adresse_ligne1: string | null;
    adresse_ligne2: string | null;
    code_postal: string | null;
    ville: string | null;
  };
  const client = (Array.isArray(contrat.client) ? contrat.client[0] : contrat.client) as ClientJoint | null;

  const heure = v.heure ? `${v.heure}:00` : null;
  const { error } = await supabase
    .from("contrats_maintenance")
    .update({ prochaine_visite: v.date, prochaine_visite_heure: heure })
    .eq("id", contratId);
  if (error) return { ok: false, error: error.message };

  let confirmationEnvoyee = false;
  let motif: string | undefined;
  if (v.envoyerConfirmation) {
    if (!client?.email) {
      motif = "Le client n'a pas d'adresse e-mail : date enregistrée, confirmation non envoyée.";
    } else if (!isEmailConfigured()) {
      motif = "Envoi d'e-mail non configuré : date enregistrée, confirmation non envoyée.";
    } else {
      const profil = await getProfil();
      const expediteurNom =
        profil?.nom_commercial ||
        [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
        "Votre artisan";
      const email = buildConfirmationVisiteEmail({
        clientNom: client.nom,
        expediteurNom,
        objetEntretien: contrat.equipement || contrat.intitule || "votre installation",
        dateVisiteLongue: libelleJourLong(v.date),
        dateVisiteCourte: formatDateFr(v.date),
        heureText: heureLisible(heure),
        adresse: adresseClient(client),
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
        motif = `Date enregistrée, mais l'e-mail n'est pas parti : ${envoi.error}`;
      } else {
        confirmationEnvoyee = true;
        const { error: erreurTrace } = await supabase
          .from("contrats_maintenance")
          .update({
            confirmation_envoyee_pour: v.date,
            confirmation_envoyee_le: new Date().toISOString(),
            rappel_envoye_pour: v.date,
          })
          .eq("id", contratId);
        if (erreurTrace) motif = `Confirmation envoyée, mais non tracée : ${erreurTrace.message}`;
      }
    }
  }

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${contratId}`);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  if (client?.id) revalidatePath(`/clients/${client.id}`);
  return { ok: true, data: { confirmationEnvoyee, motif } };
}
