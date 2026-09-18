/**
 * Date « du jour » vue de France (Europe/Paris), au format YYYY-MM-DD.
 *
 * Le serveur (Vercel, crons) tourne en UTC : entre minuit et 2 h du
 * matin heure française, `new Date().toISOString().slice(0, 10)` donne
 * encore la date de la VEILLE. Une facture créée à 0 h 30 recevait une
 * date d'émission fausse d'un jour, un devis « expirait » avec un jour
 * de retard, une sauvegarde manuelle du 1er était datée du 31.
 *
 * Source unique pour toute l'application : lib/agenda-facturation et
 * lib/taches-logic ré-exportent cette fonction.
 */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  return maintenant.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

/** Composantes (année, mois 1–12, jour) d'une date YYYY-MM-DD. */
export function composantesYmd(ymd: string): { annee: number; mois: number; jour: number } {
  const [a, m, j] = ymd.split("-").map(Number);
  return { annee: a ?? 1970, mois: m ?? 1, jour: j ?? 1 };
}
