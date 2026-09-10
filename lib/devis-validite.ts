/**
 * Calcul de la date « Valable jusqu'au » d'un devis — PUR, testé dans
 * devis-validite.test.ts. Durée par défaut : réglage
 * profil_entreprise.duree_validite_devis_jours (30 jours), borné 1-365
 * comme la contrainte SQL ; toute valeur invalide retombe sur 30.
 */

export const DUREE_VALIDITE_DEVIS_DEFAUT = 30;

export function dureeValiditeSure(duree: unknown): number {
  const n = Math.round(Number(duree));
  if (!Number.isFinite(n) || n < 1 || n > 365) {
    return DUREE_VALIDITE_DEVIS_DEFAUT;
  }
  return n;
}

/** Date d'émission (YYYY-MM-DD) + durée en jours → YYYY-MM-DD. */
export function dateValiditeDevis(
  dateEmissionIso: string,
  dureeJours: unknown,
): string {
  const d = new Date(`${dateEmissionIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateEmissionIso;
  d.setUTCDate(d.getUTCDate() + dureeValiditeSure(dureeJours));
  return d.toISOString().slice(0, 10);
}
