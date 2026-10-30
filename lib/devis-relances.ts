/**
 * Devis à relancer — logique PURE, testée. Un devis « envoyé », encore
 * valable, dont le dernier envoi au client (e-mail d'envoi ou relance,
 * sinon la date d'émission) remonte à DELAI_RELANCE_JOURS ou plus.
 * La relance reste MANUELLE (bouton) : ici on ne fait que la proposer.
 */

import { ajouterJours } from "@/lib/agenda-vues";

export const DELAI_RELANCE_JOURS = 7;

export type DevisRelancable = {
  statut: string;
  est_modele?: boolean;
  date_emission: string;
  date_validite: string | null;
  email_envoye_le: string | null;
  facture_id?: string | null;
};

/** Date (YYYY-MM-DD) du dernier envoi au client. */
export function dernierContactDevis(d: Pick<DevisRelancable, "date_emission" | "email_envoye_le">): string {
  return (d.email_envoye_le ?? "").slice(0, 10) || d.date_emission;
}

export function joursDepuisContact(d: Pick<DevisRelancable, "date_emission" | "email_envoye_le">, today: string): number {
  const a = new Date(`${dernierContactDevis(d)}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function devisARelancer<T extends DevisRelancable>(devis: T[], today: string, delaiJours = DELAI_RELANCE_JOURS): T[] {
  const limite = ajouterJours(today, -delaiJours);
  return devis
    .filter((d) => d.statut === "envoye" && !d.est_modele && !d.facture_id)
    .filter((d) => !d.date_validite || d.date_validite >= today)
    .filter((d) => dernierContactDevis(d) <= limite)
    .sort((a, b) => dernierContactDevis(a).localeCompare(dernierContactDevis(b)));
}
