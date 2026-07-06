/**
 * Seuils micro-entreprise pour un artisan BTP (prestations de services /
 * travaux, BIC) — constantes configurables.
 *
 * ⚠️ À VÉRIFIER CHAQUE ANNÉE (loi de finances) et mettre à jour ici.
 *
 * Valeurs en vigueur pour 2026, vérifiées le 06/07/2026 :
 *
 * - Franchise en base de TVA (art. L.223-3 CIBS, ex-293 B CGI) :
 *   37 500 € (seuil de base) / 41 250 € (seuil majoré) pour les
 *   prestations de services. Le « seuil unique » à 25 000 € voté en
 *   LF 2025 a été abrogé (loi n° 2025-1044 du 03/11/2025) et le seuil
 *   spécifique 25 000 € pour les travaux immobiliers proposé à
 *   l'article 25 du PLF 2026 a été SUPPRIMÉ par les deux chambres :
 *   les seuils restent donc inchangés en 2026, BTP inclus.
 *   Sources : economie.gouv.fr (franchise en base de TVA),
 *   legifiscal.fr « PLF 2026 : la franchise en base de TVA à 37 500 €
 *   sauf pour le BTP » + « Nouveaux seuils micro-entreprises 2026 »,
 *   lecoindesentrepreneurs.fr (franchise-en-base-de-tva-nouvelles-regles-2026).
 *   NB : ce dossier a beaucoup bougé en 2025 — re-vérifier à chaque LF.
 *
 * - Plafond du régime micro-BIC, prestations de services :
 *   83 600 € (revalorisation triennale 2026-2028, contre 77 700 €
 *   sur 2023-2025). Perte du régime après 2 années consécutives de
 *   dépassement.
 *   Source : autoentrepreneur.urssaf.fr, actualité « 2026 :
 *   modification des seuils de chiffre d'affaires ou de recettes »
 *   (83 600 € services / 203 100 € ventes).
 */

/** Année de validité des seuils ci-dessous. */
export const ANNEE_SEUILS = 2026;

/** Franchise en base de TVA — prestations de services (seuil de base). */
export const SEUIL_FRANCHISE_TVA = 37_500;

/** Franchise en base de TVA — seuil majoré (sortie immédiate si dépassé). */
export const SEUIL_FRANCHISE_TVA_MAJORE = 41_250;

/** Plafond micro-BIC — prestations de services / travaux. */
export const PLAFOND_MICRO_SERVICES = 83_600;

export type NiveauAlerte = "ok" | "warn" | "danger" | "critical";

/**
 * Pourcentage (entier arrondi) du seuil atteint par un CA.
 * Un seuil nul ou négatif renvoie 0 (garde-fou de configuration).
 */
export function pourcentageSeuil(ca: number, seuil: number): number {
  if (seuil <= 0) return 0;
  return Math.round((ca / seuil) * 100);
}

/**
 * Niveau d'alerte visuel : vert < 80 %, amber ≥ 80 %, orange ≥ 90 %,
 * rouge ≥ 100 %.
 */
export function niveauAlerte(pourcentage: number): NiveauAlerte {
  if (pourcentage >= 100) return "critical";
  if (pourcentage >= 90) return "danger";
  if (pourcentage >= 80) return "warn";
  return "ok";
}
