import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  nomFichierSauvegarde,
  sauvegardesASupprimer,
} from "@/lib/sauvegarde-helpers";

type AnyClient = SupabaseClient<Database>;

/**
 * Tables métier exportées.
 * INVARIANT : couvrir TOUTES les tables du schéma public (vérifié le
 * 04/09/2026 : 22/22 avec contrats). Toute migration qui crée une
 * table doit l'ajouter ici.
 */
export const TABLES_SAUVEGARDE = [
  "profil_entreprise",
  "clients",
  "produits_services",
  "factures",
  "factures_lignes",
  "devis",
  "devis_lignes",
  "paiements",
  "relances",
  "declarations_urssaf",
  "taux_cotisations",
  "taches_journal",
  "taches",
  "taches_photos",
  "contrats",
  "interventions",
  "intervention_photos",
  "intervention_signatures",
  "intervention_cerfa",
  "contrats_maintenance",
  "facture_external_events",
  "numerotation",
] as const;

const NOTE =
  "Sauvegarde JSON complète (obligation de conservation des pièces : 10 ans — conservez ce fichier hors de l'application). Les fichiers du Storage (logo, photos, signatures, CERFA PDF) ne sont pas inclus, seulement leurs chemins : téléchargez aussi les PDF archivés depuis les fiches.";

/** ~8 Mo : au-delà, lien signé plutôt que pièce jointe. */
const MAX_PIECE_JOINTE_OCTETS = 8 * 1024 * 1024;

/**
 * Construit l'export JSON complet d'un utilisateur.
 * `userId` filtre CHAQUE table : indispensable avec le client service
 * role (qui contourne la RLS) ; redondant mais sans danger avec un
 * client de session.
 */
export async function construireExportJson(
  client: AnyClient,
  userId: string,
): Promise<{ json: string; counts: Record<string, number> }> {
  const results = await Promise.all(
    TABLES_SAUVEGARDE.map((table) =>
      client.from(table).select("*").eq("user_id", userId),
    ),
  );

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (let i = 0; i < TABLES_SAUVEGARDE.length; i++) {
    const table = TABLES_SAUVEGARDE[i]!;
    const res = results[i]!;
    if (res.error) {
      throw new Error(`Export table ${table} : ${res.error.message}`);
    }
    data[table] = res.data ?? [];
    counts[table] = data[table].length;
  }

  const payload = {
    meta: {
      app: "facture-ae",
      format_version: 1,
      exported_at: new Date().toISOString(),
      user_id: userId,
      tables: counts,
      note: NOTE,
    },
    data,
  };

  return { json: JSON.stringify(payload, null, 2), counts };
}

/**
 * Sauvegarde complète : export JSON → dépôt dans le bucket privé
 * `sauvegardes` (rotation : 12 conservées) → email avec pièce jointe
 * (ou lien signé 7 jours si volumineuse). Idempotente au jour près :
 * le nom de fichier est daté, relancer écrase le même objet.
 */
export async function effectuerSauvegarde(opts: {
  client: AnyClient;
  userId: string;
  emailDestinataire: string | null;
  dateIso: string;
}): Promise<{ statut: "succes" | "erreur"; details: string }> {
  const { client, userId, emailDestinataire, dateIso } = opts;
  const morceaux: string[] = [];

  const { json, counts } = await construireExportJson(client, userId);
  const totalLignes = Object.values(counts).reduce((s, n) => s + n, 0);
  const fichier = nomFichierSauvegarde(dateIso);
  const chemin = `${userId}/${fichier}`;
  const contenu = Buffer.from(json, "utf-8");

  // 1) Dépôt Storage (upsert : relance du même jour = écrasement)
  const { error: uploadErr } = await client.storage
    .from("sauvegardes")
    .upload(chemin, contenu, {
      contentType: "application/json",
      upsert: true,
    });
  if (uploadErr) {
    throw new Error(`Dépôt Storage : ${uploadErr.message}`);
  }
  morceaux.push(
    `export déposé (${totalLignes} lignes, ${Math.round(contenu.length / 1024)} Ko)`,
  );

  // 2) Rotation : ne garder que les 12 plus récentes
  const { data: existants } = await client.storage
    .from("sauvegardes")
    .list(userId, { limit: 100 });
  const aSupprimer = sauvegardesASupprimer(
    (existants ?? []).map((f) => f.name),
    12,
  );
  if (aSupprimer.length > 0) {
    await client.storage
      .from("sauvegardes")
      .remove(aSupprimer.map((n) => `${userId}/${n}`));
    morceaux.push(`rotation : ${aSupprimer.length} ancienne(s) supprimée(s)`);
  }

  // 3) Email (pièce jointe, ou lien signé si volumineux)
  if (!emailDestinataire) {
    morceaux.push("email non envoyé : adresse pro absente du profil");
  } else if (!isEmailConfigured()) {
    morceaux.push("email non envoyé : Resend non configuré");
  } else {
    const sujet = `Sauvegarde Facture AE — ${dateIso}`;
    let corps = `<p>Bonjour,</p><p>Voici la sauvegarde mensuelle complète de vos données Facture AE (${totalLignes} lignes). Conservez ce fichier hors de l'application — obligation de conservation des pièces : 10 ans.</p>`;
    let attachments;
    if (contenu.length <= MAX_PIECE_JOINTE_OCTETS) {
      attachments = [
        { filename: fichier, content: contenu, contentType: "application/json" },
      ];
    } else {
      const { data: signee } = await client.storage
        .from("sauvegardes")
        .createSignedUrl(chemin, 7 * 24 * 3600);
      corps += signee?.signedUrl
        ? `<p>Fichier volumineux : <a href="${signee.signedUrl}">télécharger la sauvegarde</a> (lien valable 7 jours).</p>`
        : `<p>Fichier volumineux — récupérez-le depuis Paramètres → Exporter mes données.</p>`;
    }
    const res = await sendEmail({
      to: emailDestinataire,
      subject: sujet,
      html: `${corps}<p>— Facture AE</p>`,
      attachments,
    });
    morceaux.push(
      res.ok ? `email envoyé à ${emailDestinataire}` : `échec email : ${res.error}`,
    );
  }

  return { statut: "succes", details: morceaux.join(" · ") };
}
