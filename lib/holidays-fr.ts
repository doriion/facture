/**
 * Calcul des jours fériés en France métropolitaine.
 *
 * 11 fériés par an : 7 dates fixes + 3 mobiles (basés sur Pâques) + 1er mai.
 * Les départements d'Alsace-Moselle ont 2 jours supplémentaires non gérés ici.
 *
 * Source : https://fr.wikipedia.org/wiki/F%C3%AAtes_et_jours_f%C3%A9ri%C3%A9s_en_France
 */

/**
 * Algorithme de Butcher (Anonymous Gregorian algorithm) pour le calcul
 * de la date de Pâques.
 */
function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=mars, 4=avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Retourne la map des jours fériés d'une année donnée :
 * { "2026-01-01": "Jour de l'an", "2026-04-06": "Lundi de Pâques", ... }
 */
export function getFrenchHolidays(year: number): Record<string, string> {
  const easter = easterDate(year);
  const result: Record<string, string> = {
    [`${year}-01-01`]: "Jour de l'an",
    [`${year}-05-01`]: "Fête du Travail",
    [`${year}-05-08`]: "Victoire 1945",
    [`${year}-07-14`]: "Fête nationale",
    [`${year}-08-15`]: "Assomption",
    [`${year}-11-01`]: "Toussaint",
    [`${year}-11-11`]: "Armistice 1918",
    [`${year}-12-25`]: "Noël",
    [ymd(addDays(easter, 1))]: "Lundi de Pâques",
    [ymd(addDays(easter, 39))]: "Ascension",
    [ymd(addDays(easter, 50))]: "Lundi de Pentecôte",
  };
  return result;
}

/**
 * Renvoie le nom du jour férié pour une date donnée, ou null.
 */
export function getHolidayName(date: string): string | null {
  const year = parseInt(date.slice(0, 4), 10);
  if (Number.isNaN(year)) return null;
  const map = getFrenchHolidays(year);
  return map[date] ?? null;
}
