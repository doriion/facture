/**
 * Suivi de validité des attestations (décennale, capacité fluides) —
 * helpers PURS testés.
 *
 * Règle d'alerte : rien tant que l'échéance est à plus de `seuilJours`
 * jours ; « bientot » dans la fenêtre des 30 jours ; « expiree » (rouge)
 * dès le lendemain de la date de fin (la date de fin elle-même est
 * encore valide).
 */

export type AlerteValidite = {
  niveau: "bientot" | "expiree";
  /** Jours restants (≥ 0) si « bientot », jours de dépassement si « expiree » */
  jours: number;
};

const JOUR_MS = 24 * 3600 * 1000;

export function alerteValidite(
  dateFin: string | null | undefined,
  today: string,
  seuilJours = 30,
): AlerteValidite | null {
  if (!dateFin) return null;
  const fin = Date.parse(dateFin + "T00:00:00Z");
  const auj = Date.parse(today + "T00:00:00Z");
  if (!Number.isFinite(fin) || !Number.isFinite(auj)) return null;

  const joursRestants = Math.round((fin - auj) / JOUR_MS);
  if (joursRestants < 0) {
    return { niveau: "expiree", jours: -joursRestants };
  }
  if (joursRestants <= seuilJours) {
    return { niveau: "bientot", jours: joursRestants };
  }
  return null;
}
