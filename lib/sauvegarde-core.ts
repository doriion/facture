import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  BUCKETS_SAUVEGARDE,
  BUDGET_FICHIERS_OCTETS,
  cleTri,
  nomArchiveFichiers,
  nomFichierSauvegarde,
  PAGE_EXPORT,
  sauvegardesASupprimer,
  TABLES_SAUVEGARDE,
} from "@/lib/sauvegarde-helpers";
import { construireZip, type EntreeZip } from "@/lib/zip-store";

type AnyClient = SupabaseClient<Database>;

const NOTE =
  "Sauvegarde JSON complète (obligation de conservation des pièces : 10 ans — conservez ce fichier hors de l'application). Les fichiers du Storage (PDF signés, signatures, CERFA, bons, logo, photos) sont dans l'archive « -fichiers.zip » produite avec cette sauvegarde.";

/** ~8 Mo : au-delà, lien signé plutôt que pièce jointe. */
const MAX_PIECE_JOINTE_OCTETS = 8 * 1024 * 1024;

/**
 * Lit TOUTES les lignes d'une table, par pages : PostgREST tronque
 * silencieusement à 1 000 lignes une requête sans borne, ce qui aurait
 * amputé la sauvegarde sans aucun signal. Le nombre exact est demandé
 * à part et comparé : un écart fait échouer l'export plutôt que de
 * produire une sauvegarde incomplète.
 */
export async function lireTableComplete(
  client: AnyClient,
  table: (typeof TABLES_SAUVEGARDE)[number],
  userId: string,
): Promise<unknown[]> {
  const lignes: unknown[] = [];
  let depuis = 0;
  let attendu: number | null = null;
  for (;;) {
    let requete = client
      .from(table)
      .select("*", depuis === 0 ? { count: "exact" } : undefined)
      .eq("user_id", userId);
    for (const col of cleTri(table)) requete = requete.order(col, { ascending: true });
    const { data, error, count } = await requete.range(depuis, depuis + PAGE_EXPORT - 1);
    if (error) throw new Error(`Export table ${table} : ${error.message}`);
    if (depuis === 0 && typeof count === "number") attendu = count;
    const page = data ?? [];
    lignes.push(...page);
    if (page.length < PAGE_EXPORT) break;
    depuis += PAGE_EXPORT;
    if (depuis > 1_000_000) throw new Error(`Export table ${table} : pagination sans fin.`);
  }
  if (attendu !== null && attendu !== lignes.length) {
    throw new Error(
      `Export table ${table} : ${lignes.length} lignes lues pour ${attendu} attendues — sauvegarde refusée.`,
    );
  }
  return lignes;
}

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
    TABLES_SAUVEGARDE.map((table) => lireTableComplete(client, table, userId)),
  );

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (let i = 0; i < TABLES_SAUVEGARDE.length; i++) {
    const table = TABLES_SAUVEGARDE[i]!;
    data[table] = results[i]!;
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

type FichierStorage = { bucket: string; chemin: string; taille: number };

/** Liste récursive d'un dossier de bucket (l'API Storage n'est pas récursive). */
async function listerDossier(
  client: AnyClient,
  bucket: string,
  prefixe: string,
  profondeur: number,
): Promise<FichierStorage[]> {
  if (profondeur > 6) return [];
  const fichiers: FichierStorage[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefixe, { limit: 200, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Storage ${bucket}/${prefixe} : ${error.message}`);
    for (const objet of data ?? []) {
      const chemin = `${prefixe}/${objet.name}`;
      if (objet.id === null) {
        // Sous-dossier
        fichiers.push(...(await listerDossier(client, bucket, chemin, profondeur + 1)));
      } else {
        const meta = objet.metadata as { size?: number } | null;
        fichiers.push({ bucket, chemin, taille: Number(meta?.size ?? 0) });
      }
    }
    if ((data ?? []).length < 200) break;
    offset += 200;
  }
  return fichiers;
}

/**
 * Récupère les fichiers du Storage de l'utilisateur (PDF signés,
 * signatures, CERFA, bons, logo, puis photos) dans la limite d'un
 * budget : au-delà, les fichiers restants sont listés dans le rapport
 * plutôt que d'échouer ou de dépasser la durée d'une fonction.
 */
export async function collecterFichiersStorage(
  client: AnyClient,
  userId: string,
  budgetOctets = BUDGET_FICHIERS_OCTETS,
): Promise<{ entrees: EntreeZip[]; nb: number; octets: number; ignores: string[]; erreurs: string[] }> {
  const entrees: EntreeZip[] = [];
  const ignores: string[] = [];
  const erreurs: string[] = [];
  let octets = 0;
  for (const bucket of BUCKETS_SAUVEGARDE) {
    let fichiers: FichierStorage[];
    try {
      fichiers = await listerDossier(client, bucket, userId, 0);
    } catch (e) {
      erreurs.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    for (const f of fichiers) {
      if (octets + f.taille > budgetOctets) {
        ignores.push(`${bucket}/${f.chemin}`);
        continue;
      }
      const { data, error } = await client.storage.from(bucket).download(f.chemin);
      if (error || !data) {
        erreurs.push(`${bucket}/${f.chemin} : ${error?.message ?? "vide"}`);
        continue;
      }
      const contenu = new Uint8Array(await data.arrayBuffer());
      if (octets + contenu.length > budgetOctets) {
        ignores.push(`${bucket}/${f.chemin}`);
        continue;
      }
      octets += contenu.length;
      entrees.push({ nom: `fichiers/${bucket}/${f.chemin}`, contenu });
    }
  }
  return { entrees, nb: entrees.length, octets, ignores, erreurs };
}

/** Archive ZIP des fichiers + un index JSON (chemins, tailles, fichiers ignorés). */
export async function construireArchiveFichiers(
  client: AnyClient,
  userId: string,
  dateIso: string,
): Promise<{ zip: Uint8Array; nb: number; octets: number; ignores: string[]; erreurs: string[] }> {
  const { entrees, nb, octets, ignores, erreurs } = await collecterFichiersStorage(client, userId);
  const index = {
    app: "facture-ae",
    date: dateIso,
    user_id: userId,
    fichiers: entrees.map((e) => ({ nom: e.nom, octets: e.contenu.length })),
    ignores,
    erreurs,
    note: "Chaque entrée fichiers/<bucket>/<chemin> correspond à un objet du Storage ; <chemin> est la valeur stockée en base (storage_path, pdf_path, signature_path, logo…).",
  };
  const zip = construireZip([
    { nom: "index.json", contenu: new TextEncoder().encode(JSON.stringify(index, null, 2)) },
    ...entrees,
  ]);
  return { zip, nb, octets, ignores, erreurs };
}

/**
 * Sauvegarde complète : export JSON + archive des fichiers → dépôt dans
 * le bucket privé `sauvegardes` (rotation : 12 mensuelles + 6 autres)
 * → email avec pièces jointes (ou liens signés 7 jours si volumineux).
 * Idempotente au jour près : les noms sont datés, relancer écrase les
 * mêmes objets.
 */
export async function effectuerSauvegarde(opts: {
  client: AnyClient;
  userId: string;
  emailDestinataire: string | null;
  dateIso: string;
}): Promise<{ statut: "succes" | "erreur"; details: string }> {
  const { client, userId, emailDestinataire, dateIso } = opts;
  const morceaux: string[] = [];
  let echec = false;

  const { json, counts } = await construireExportJson(client, userId);
  const totalLignes = Object.values(counts).reduce((s, n) => s + n, 0);
  const fichier = nomFichierSauvegarde(dateIso);
  const chemin = `${userId}/${fichier}`;
  const contenu = Buffer.from(json, "utf-8");

  // 1) Dépôt Storage du JSON (upsert : relance du même jour = écrasement)
  const { error: uploadErr } = await client.storage
    .from("sauvegardes")
    .upload(chemin, contenu, { contentType: "application/json", upsert: true });
  if (uploadErr) {
    throw new Error(`Dépôt Storage : ${uploadErr.message}`);
  }
  morceaux.push(`export déposé (${totalLignes} lignes, ${Math.round(contenu.length / 1024)} Ko)`);

  // 2) Fichiers du Storage : archive à part. Un échec ici n'annule pas le
  //    JSON déjà déposé, mais le statut le dit.
  let archive: Buffer | null = null;
  const fichierZip = nomArchiveFichiers(dateIso);
  const cheminZip = `${userId}/${fichierZip}`;
  try {
    const res = await construireArchiveFichiers(client, userId, dateIso);
    archive = Buffer.from(res.zip);
    const { error: zipErr } = await client.storage
      .from("sauvegardes")
      .upload(cheminZip, archive, { contentType: "application/zip", upsert: true });
    if (zipErr) throw new Error(zipErr.message);
    morceaux.push(`${res.nb} fichier(s) archivé(s) (${Math.round(res.octets / 1024)} Ko)`);
    if (res.ignores.length > 0) {
      echec = true;
      morceaux.push(`${res.ignores.length} fichier(s) hors budget non archivé(s)`);
    }
    if (res.erreurs.length > 0) {
      echec = true;
      morceaux.push(`fichiers en erreur : ${res.erreurs.slice(0, 3).join(" ; ")}`);
    }
  } catch (e) {
    echec = true;
    archive = null;
    morceaux.push(`archive des fichiers échouée : ${e instanceof Error ? e.message : String(e)}`);
  }

  // 3) Rotation
  const { data: existants, error: erreurListe } = await client.storage
    .from("sauvegardes")
    .list(userId, { limit: 200 });
  if (erreurListe) {
    echec = true;
    morceaux.push(`rotation impossible : ${erreurListe.message}`);
  }
  const aSupprimer = sauvegardesASupprimer((existants ?? []).map((f) => f.name));
  if (aSupprimer.length > 0) {
    const { error: erreurRotation } = await client.storage
      .from("sauvegardes")
      .remove(aSupprimer.map((n) => `${userId}/${n}`));
    if (erreurRotation) {
      echec = true;
      morceaux.push(`rotation échouée : ${erreurRotation.message}`);
    } else {
      morceaux.push(`rotation : ${aSupprimer.length} ancien(s) fichier(s) supprimé(s)`);
    }
  }

  // 4) Email (pièces jointes, ou liens signés si volumineux)
  if (!emailDestinataire) {
    morceaux.push("email non envoyé : adresse pro absente du profil");
  } else if (!isEmailConfigured()) {
    morceaux.push("email non envoyé : canal e-mail non configuré");
  } else {
    const sujet = `Sauvegarde NG Gestion — ${dateIso}`;
    let corps = `<p>Bonjour,</p><p>Voici la sauvegarde complète de vos données NG Gestion (${totalLignes} lignes). Conservez ces fichiers hors de l'application — obligation de conservation des pièces : 10 ans. Ils contiennent vos prix d'achat : ne les transmettez jamais à un client.</p>`;
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    let total = 0;
    const candidats: Array<{ filename: string; content: Buffer; contentType: string; chemin: string }> = [
      { filename: fichier, content: contenu, contentType: "application/json", chemin },
    ];
    if (archive) {
      candidats.push({ filename: fichierZip, content: archive, contentType: "application/zip", chemin: cheminZip });
    }
    for (const c of candidats) {
      if (total + c.content.length <= MAX_PIECE_JOINTE_OCTETS) {
        attachments.push({ filename: c.filename, content: c.content, contentType: c.contentType });
        total += c.content.length;
      } else {
        const { data: signee } = await client.storage
          .from("sauvegardes")
          .createSignedUrl(c.chemin, 7 * 24 * 3600);
        corps += signee?.signedUrl
          ? `<p>Fichier volumineux : <a href="${signee.signedUrl}">${c.filename}</a> (lien valable 7 jours).</p>`
          : `<p>Fichier volumineux (${c.filename}) — récupérez-le depuis Paramètres → Sauvegarde des données.</p>`;
      }
    }
    const res = await sendEmail({
      to: emailDestinataire,
      subject: sujet,
      html: `${corps}<p>— NG Gestion</p>`,
      attachments,
    });
    if (!res.ok) echec = true;
    morceaux.push(res.ok ? `email envoyé à ${emailDestinataire}` : `échec email : ${res.error}`);
  }

  // Statut honnête : une pastille verte pour une sauvegarde jamais reçue
  // ou une rotation en panne cachait le problème.
  return { statut: echec ? "erreur" : "succes", details: morceaux.join(" · ") };
}
