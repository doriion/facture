import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import {
  contratsAAviserChatel,
  dateLimiteDenonciation,
  type ContratAviseable,
} from "@/lib/contrats/chatel";
import type { ClientSnapshot } from "@/lib/contrats/rendu";
import { buildAvisChatelEmail, isEmailConfigured, sendEmail } from "@/lib/email";
import { formatDateFr } from "@/lib/format";

/**
 * Avis de reconduction « loi Chatel » — OFF par défaut, soumis au mode
 * simulation comme tout envoi client.
 *
 * Pour un client CONSOMMATEUR, les articles L. 215-1 et suivants du
 * code de la consommation imposent d'informer par écrit, entre trois
 * mois et un mois avant l'échéance annuelle, de la faculté de ne pas
 * reconduire. À défaut, le client peut résilier gratuitement après la
 * reconduction et se faire rembourser. C'est l'article 7 du contrat
 * type (figé) qui le stipule ; ce job l'exécute.
 *
 * La sélection (statut, qualité du client, fenêtre, anti-doublon) est
 * PURE et testée dans lib/contrats/chatel. L'adresse du destinataire
 * vient du client_snapshot du contrat : c'est l'adresse qui figure au
 * contrat signé, pas celle de la fiche client modifiée depuis.
 */
export const jobChatel: JobDef = {
  tache: "avis-chatel",
  concerneLesClients: true,
  estActive: (profil) => profil.auto_chatel_active === true,
  doitTournerAujourdhui: () => true,
  executer: async (ctx) => executerChatel(ctx),
};

async function executerChatel({
  service,
  userId,
  profil,
  today,
  dryRun,
}: ContexteJob): Promise<ResultatTache> {
  const { data: contrats, error } = await service
    .from("contrats")
    .select(
      "id, numero, statut, qualite_client, date_echeance, rappel_chatel_envoye_pour, client_snapshot",
    )
    .eq("user_id", userId)
    .in("statut", ["signe", "actif"]);

  if (error) {
    return {
      statut: "erreur",
      details: `Lecture des contrats : ${error.message}`,
    };
  }

  const candidats: ContratAviseable[] = (contrats ?? []).map((c) => {
    const snapshot: ClientSnapshot =
      c.client_snapshot && typeof c.client_snapshot === "object"
        ? (c.client_snapshot as ClientSnapshot)
        : {};
    return {
      id: c.id,
      numero: c.numero,
      statut: c.statut,
      qualite_client: c.qualite_client,
      date_echeance: c.date_echeance,
      rappel_chatel_envoye_pour: c.rappel_chatel_envoye_pour,
      client_email: snapshot.email ?? null,
      client_nom: snapshot.raison_sociale || snapshot.nom || "client",
    };
  });

  const aAviser = contratsAAviserChatel(candidats, { today });
  if (aAviser.length === 0) {
    return {
      statut: "succes",
      details: "Aucun avis de reconduction à envoyer aujourd'hui.",
    };
  }

  const libelles = aAviser.map(
    (c) =>
      `${c.numero ?? c.id} (${c.client_nom}, échéance le ${formatDateFr(c.date_echeance!)}, J-${c.joursAvantEcheance})`,
  );

  if (dryRun) {
    return {
      statut: "succes",
      details: `SIMULATION : ${aAviser.length} avis de reconduction (loi Chatel) auraient été envoyés — ${libelles.join(", ")}. Désactivez le mode simulation pour envoyer réellement.`,
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

  const envoyes: string[] = [];
  const echecs: string[] = [];

  for (const c of aAviser) {
    const echeance = c.date_echeance!;
    const commun = {
      expediteurNom,
      numero: c.numero ?? "",
      dateEcheanceText: formatDateFr(echeance),
      dateLimiteText: formatDateFr(dateLimiteDenonciation(echeance)),
      telephone: profil.telephone,
      emailPro: profil.email_pro,
    };

    const emailClient = buildAvisChatelEmail({
      ...commun,
      clientNom: c.client_nom,
    });
    const res = await sendEmail({
      to: c.client_email!,
      subject: emailClient.subject,
      html: emailClient.html,
      text: emailClient.text,
      replyTo: profil.email_pro ?? undefined,
    });
    if (!res.ok) {
      echecs.push(`${c.numero ?? c.id} : ${res.error}`);
      continue;
    }

    // Anti-doublon : mémorise l'échéance avisée AVANT toute autre
    // étape — mieux vaut un avis non copié à l'artisan qu'un second
    // avis au client demain matin.
    await service
      .from("contrats")
      .update({
        rappel_chatel_envoye_pour: echeance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id)
      .eq("user_id", userId);

    // Copie à l'artisan : trace de l'information délivrée, utile en
    // cas de contestation ultérieure.
    if (profil.email_pro) {
      const copie = buildAvisChatelEmail({
        ...commun,
        clientNom: c.client_nom,
        pourArtisan: true,
      });
      await sendEmail({
        to: profil.email_pro,
        subject: copie.subject,
        html: copie.html,
        text: copie.text,
      });
    }

    envoyes.push(
      `${c.numero ?? c.id} — ${c.client_nom} — échéance le ${formatDateFr(echeance)}`,
    );
  }

  const details = [
    `${envoyes.length} avis de reconduction envoyé(s)${envoyes.length ? ` : ${envoyes.join(" ; ")}` : ""}`,
    echecs.length ? `échecs : ${echecs.join(" ; ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { statut: echecs.length > 0 ? "erreur" : "succes", details };
}
