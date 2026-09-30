/**
 * Helpers PURS de la sauvegarde automatique (testés).
 */

/**
 * Tables métier exportées.
 * INVARIANT : couvrir TOUTES les tables du schéma public. Le test
 * lib/sauvegarde-tables.test.ts parcourt supabase/migrations et échoue
 * si une table créée par une migration manque ici — une nouvelle table
 * ne peut donc plus être oubliée (7 l'avaient été entre le 04/09 et le
 * 18/09/2026 : couleurs d'agenda, barème d'entretien, séries, RDV
 * iPhone repris, abonnements push).
 *
 * CONFIDENTIALITÉ : cette sauvegarde est PRIVÉE (elle part sur votre
 * adresse et dans votre stockage). Le `select *` embarque donc aussi
 * les coûts d'achat et les fournisseurs — des lignes de documents
 * comme du catalogue. C'est voulu : une sauvegarde amputée ne
 * permettrait pas de restaurer. Ne la transmettez jamais à un client.
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
  "intervention_bons",
  "contrats_maintenance",
  "facture_external_events",
  "numerotation",
  "agenda_couleurs_evenements",
  "bareme_entretien_zones",
  "bareme_entretien_postes",
  "bareme_entretien_reglages",
  "interventions_series",
  "external_events_importes",
  "push_abonnements",
] as const;

export type TableSauvegarde = (typeof TABLES_SAUVEGARDE)[number];

/**
 * Colonnes de tri STABLE pour paginer l'export (PostgREST tronque à
 * 1 000 lignes par requête : on lit par pages, et une page doit être
 * déterministe). Par défaut la clé primaire `id` ; les deux tables sans
 * `id` ont leur propre clé.
 */
export const CLE_TRI_SAUVEGARDE: Partial<Record<TableSauvegarde, string[]>> = {
  numerotation: ["annee", "type_document"],
  bareme_entretien_reglages: ["user_id"],
};

export function cleTri(table: TableSauvegarde): string[] {
  return CLE_TRI_SAUVEGARDE[table] ?? ["id"];
}

/** Taille de page de l'export (limite PostgREST par défaut : 1 000). */
export const PAGE_EXPORT = 1000;

/**
 * Buckets Storage joints à la sauvegarde, dans l'ordre de priorité :
 * d'abord les pièces à valeur probante (petites), les photos en dernier
 * (les plus volumineuses, coupées si le budget est dépassé).
 */
export const BUCKETS_SAUVEGARDE = [
  "pdfs",
  "signatures",
  "cerfa",
  "bons",
  "logos",
  "intervention-photos",
  "taches-photos",
] as const;

/** Budget de fichiers joints (mémoire et durée d'une fonction Vercel). */
export const BUDGET_FICHIERS_OCTETS = 40 * 1024 * 1024;

/** Nom de fichier stable par jour → relancer le même jour écrase (idempotent). */
export function nomFichierSauvegarde(dateIso: string): string {
  return `sauvegarde-facture-ae-${dateIso}.json`;
}

/** Archive des fichiers du Storage, datée comme le JSON. */
export function nomArchiveFichiers(dateIso: string): string {
  return `sauvegarde-facture-ae-${dateIso}-fichiers.zip`;
}

const MOTIF_JSON = /^sauvegarde-facture-ae-(\d{4}-\d{2}-\d{2})\.json$/;
const MOTIF_ZIP = /^sauvegarde-facture-ae-(\d{4}-\d{2}-\d{2})-fichiers\.zip$/;

/**
 * Rotation : parmi des noms de fichiers datés, renvoie ceux à
 * SUPPRIMER. Les sauvegardes MENSUELLES (datées du 1er) et les autres
 * (manuelles, rattrapages) ont chacune leur quota : une série de
 * « Sauvegarder maintenant » ne peut plus évincer l'historique mensuel.
 * JSON et archive de fichiers sont traités séparément mais de la même
 * façon. Ne touche jamais aux fichiers dont le nom ne matche pas les
 * motifs (prudence : on ne supprime que ce qu'on a soi-même créé).
 */
export function sauvegardesASupprimer(
  noms: string[],
  quotas: { mensuelles: number; autres: number } | number = { mensuelles: 12, autres: 6 },
): string[] {
  const q =
    typeof quotas === "number" ? { mensuelles: quotas, autres: quotas } : quotas;
  const aSupprimer: string[] = [];
  for (const motif of [MOTIF_JSON, MOTIF_ZIP]) {
    const datees = noms
      .map((n) => ({ n, m: motif.exec(n) }))
      .filter((x): x is { n: string; m: RegExpExecArray } => x.m !== null)
      .sort((a, b) => (a.m[1]! < b.m[1]! ? 1 : a.m[1]! > b.m[1]! ? -1 : 0));
    const mensuelles = datees.filter((x) => x.m[1]!.endsWith("-01"));
    const autres = datees.filter((x) => !x.m[1]!.endsWith("-01"));
    aSupprimer.push(
      ...mensuelles.slice(Math.max(0, q.mensuelles)).map((x) => x.n),
      ...autres.slice(Math.max(0, q.autres)).map((x) => x.n),
    );
  }
  return aSupprimer;
}

/** Écart en jours entre deux dates YYYY-MM-DD (b − a). */
function joursEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86_400_000);
}

/**
 * Sauvegarde mensuelle avec rattrapage : à faire aujourd'hui si aucune
 * sauvegarde (automatique ou manuelle) en succès n'existe depuis le 1er
 * du mois. Un cron en panne le 1er ne coûte plus un mois entier. Pour
 * ne pas envoyer un email par jour quand l'échec persiste (Resend en
 * panne, fichier hors budget), on ne réessaie que tous les 3 jours
 * après une tentative, sauf le 1er.
 */
export function sauvegardeMensuelleDue(
  today: string,
  datesSuccesCeMois: string[],
  datesTentativesCeMois: string[] = [],
): boolean {
  const debutMois = `${today.slice(0, 7)}-01`;
  const ceMois = (d: string) => d >= debutMois && d <= today;
  if (datesSuccesCeMois.some(ceMois)) return false;
  if (today.endsWith("-01")) return true;
  const derniere = datesTentativesCeMois.filter(ceMois).sort().at(-1);
  return derniere === undefined || joursEntre(derniere, today) >= 3;
}
