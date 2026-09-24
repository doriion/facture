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

/** Nom de fichier stable par jour → relancer le même jour écrase (idempotent). */
export function nomFichierSauvegarde(dateIso: string): string {
  return `sauvegarde-facture-ae-${dateIso}.json`;
}

/**
 * Rotation : parmi des noms de fichiers datés (triables
 * lexicographiquement), renvoie ceux à SUPPRIMER pour n'en garder que
 * `garder` (les plus récents). Ne touche jamais aux fichiers dont le
 * nom ne matche pas le motif de sauvegarde (prudence : on ne supprime
 * que ce qu'on a soi-même créé).
 */
export function sauvegardesASupprimer(
  noms: string[],
  garder = 12,
): string[] {
  const motif = /^sauvegarde-facture-ae-\d{4}-\d{2}-\d{2}\.json$/;
  const datees = noms.filter((n) => motif.test(n)).sort().reverse();
  return datees.slice(Math.max(0, garder));
}
