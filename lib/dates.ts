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

/** Date (YYYY-MM-DD) en heure de Paris d'un instant ISO (timestamptz). */
export function dateParis(iso: string): string {
  return aujourdhuiParis(new Date(iso));
}

/** Composantes d'un instant dans un fuseau IANA (via Intl, sans dépendance). */
function composantesDansFuseau(
  instant: Date,
  fuseau: string,
): { annee: number; mois: number; jour: number; heure: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { annee: v("year"), mois: v("month"), jour: v("day"), heure: v("hour") % 24, minute: v("minute") };
}

/** Date et heure de Paris (« YYYY-MM-DD », « HH:MM ») d'un instant. */
export function dateHeureParis(instant: Date): { ymd: string; hm: string } {
  const c = composantesDansFuseau(instant, "Europe/Paris");
  const p2 = (n: number) => String(n).padStart(2, "0");
  return {
    ymd: `${c.annee}-${p2(c.mois)}-${p2(c.jour)}`,
    hm: `${p2(c.heure)}:${p2(c.minute)}`,
  };
}

/**
 * Instant correspondant à une heure LOCALE d'un fuseau IANA (ex. un
 * DTSTART iCal avec TZID=America/New_York). Deux passes pour absorber
 * un changement d'heure entre l'estimation et l'instant réel.
 */
export function instantDepuisLocale(
  fuseau: string,
  annee: number,
  mois: number,
  jour: number,
  heure: number,
  minute: number,
): Date {
  const voulu = Date.UTC(annee, mois - 1, jour, heure, minute);
  let estimation = voulu;
  for (let i = 0; i < 2; i++) {
    const c = composantesDansFuseau(new Date(estimation), fuseau);
    const obtenu = Date.UTC(c.annee, c.mois - 1, c.jour, c.heure, c.minute);
    estimation += voulu - obtenu;
  }
  return new Date(estimation);
}

/** Le fuseau est-il connu du moteur Intl ? (un TZID exotique ne doit pas faire planter l'import) */
export function fuseauConnu(fuseau: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuseau });
    return true;
  } catch {
    return false;
  }
}
