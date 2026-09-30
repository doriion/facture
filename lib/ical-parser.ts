/**
 * Parser iCal minimal pour importer un flux externe (iCloud, Google
 * Calendar publié, etc.) dans l'agenda en lecture seule.
 *
 * Couvre les VEVENT all-day (DTSTART;VALUE=DATE) ET timed (DTSTART
 * avec heure), avec ou sans TZID, en UTC (suffixe Z) ou avec DURATION.
 * Les heures sont ramenées en heure de PARIS : un flux Google Calendar
 * publie ses heures en UTC (un RDV à 8 h 30 s'affichait à 6 h 30, et
 * un RDV à 0 h 30 la veille). Pas de support des RRULE (récurrences)
 * pour rester simple — un évènement récurrent ne remonte que sa
 * première occurrence ; une occurrence MODIFIÉE (RECURRENCE-ID) est
 * bien remontée, avec un identifiant distinct de la série.
 *
 * Pas une implémentation RFC 5545 complète mais largement suffisante
 * pour les calendriers publiés depuis iPhone (iCloud) ou Google.
 */

import { dateHeureParis, fuseauConnu, instantDepuisLocale } from "@/lib/dates";

export type ParsedIcalEvent = {
  /** UID iCal ; pour une occurrence modifiée d'une série : « uid#RECURRENCE-ID ». */
  uid: string;
  summary: string;
  description: string | null;
  /** LOCATION iCal (adresse saisie sur l'iPhone), null si absente */
  location: string | null;
  /** YYYY-MM-DD (date locale Paris, sans heure) */
  date_start: string;
  /** YYYY-MM-DD (date locale Paris, inclusive, sans heure) */
  date_end: string;
  /** HH:MM (heure de Paris) ou null si all-day */
  time_start: string | null;
  /** HH:MM (heure de Paris) ou null si all-day */
  time_end: string | null;
  all_day: boolean;
};

/**
 * Reconstruit les lignes pliées RFC 5545 (continuation = ligne suivante
 * commence par espace ou tab) puis split en lignes logiques.
 */
function unfoldLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      out[out.length - 1] = (out[out.length - 1] ?? "") + line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Découpe une ligne iCal "NAME;PARAM=VAL:VALUE" en { name, params, value }.
 * Les valeurs sont dé-escapées (\\n → newline, \\\\ → \\, etc.).
 */
function parseLine(line: string): {
  name: string;
  params: Record<string, string>;
  value: string;
} {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) {
    return { name: line, params: {}, value: "" };
  }
  const head = line.slice(0, colonIdx);
  const rawValue = line.slice(colonIdx + 1);
  const headParts = head.split(";");
  const name = headParts[0]!.toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < headParts.length; i++) {
    const p = headParts[i]!;
    const eq = p.indexOf("=");
    if (eq !== -1) {
      params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
    }
  }
  // Dé-escape RFC 5545
  const value = rawValue
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
  return { name, params, value };
}

type DateIcal = { ymd: string; hm: string | null; allDay: boolean };

const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * Parse une date iCal. 3 formats possibles :
 *   - "20260511"            → date all-day
 *   - "20260511T093000"     → datetime locale (TZID éventuel, Paris sinon)
 *   - "20260511T093000Z"    → datetime UTC
 *
 * Les heures UTC et celles d'un autre fuseau (TZID connu) sont
 * converties en heure de Paris. null si la valeur est illisible :
 * l'évènement est alors ignoré (il apparaissait « aujourd'hui »).
 */
function parseIcalDate(raw: string, params: Record<string, string> = {}): DateIcal | null {
  const s = raw.trim();
  // Date pure (8 chiffres)
  const dateMatch = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    return {
      ymd: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`,
      hm: null,
      allDay: true,
    };
  }
  // Datetime
  const dtMatch = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/);
  if (!dtMatch) return null;
  const [annee, mois, jour, heure, minute] = [1, 2, 3, 4, 5].map((i) => Number(dtMatch[i]));
  const utc = dtMatch[7] === "Z";
  const tzid = params.TZID;
  if (utc) {
    return { ...dateHeureParis(new Date(Date.UTC(annee!, mois! - 1, jour!, heure!, minute!))), allDay: false };
  }
  if (tzid && tzid !== "Europe/Paris" && fuseauConnu(tzid)) {
    return { ...dateHeureParis(instantDepuisLocale(tzid, annee!, mois!, jour!, heure!, minute!)), allDay: false };
  }
  // Heure locale (TZID Paris, absent ou inconnu) : telle quelle.
  return {
    ymd: `${annee}-${p2(mois!)}-${p2(jour!)}`,
    hm: `${p2(heure!)}:${p2(minute!)}`,
    allDay: false,
  };
}

/** Durée RFC 5545 (P1DT2H30M, PT45M, P2W) en minutes ; null si illisible. */
export function parseIcalDuration(raw: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(raw.trim());
  if (!m) return null;
  const [, signe, w, d, h, mi, s] = m;
  const minutes =
    Number(w ?? 0) * 7 * 24 * 60 +
    Number(d ?? 0) * 24 * 60 +
    Number(h ?? 0) * 60 +
    Number(mi ?? 0) +
    Math.floor(Number(s ?? 0) / 60);
  return signe === "-" ? -minutes : minutes;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Date/heure « naïve » + minutes (sans fuseau : déjà en heure de Paris). */
function ajouterMinutes(start: DateIcal, minutes: number): DateIcal {
  const [y, m, d] = start.ymd.split("-").map(Number);
  const [h, mi] = (start.hm ?? "00:00").split(":").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, h!, mi!) + minutes * 60_000);
  if (start.allDay) {
    // Durée en jours entiers : DTEND exclusif → inclusif (−1 jour)
    return { ymd: addDaysYmd(dt.toISOString().slice(0, 10), -1), hm: null, allDay: true };
  }
  return {
    ymd: dt.toISOString().slice(0, 10),
    hm: `${p2(dt.getUTCHours())}:${p2(dt.getUTCMinutes())}`,
    allDay: false,
  };
}

/**
 * Parse un texte iCal complet. Tolérant aux erreurs : un VEVENT invalide
 * (sans DTSTART lisible) est ignoré, le reste continue.
 */
export function parseIcal(text: string): ParsedIcalEvent[] {
  const events: ParsedIcalEvent[] = [];
  const lines = unfoldLines(text);

  let current: Partial<{
    uid: string;
    summary: string;
    description: string;
    location: string;
    recurrenceId: string;
    rawStart: { value: string; params: Record<string, string> };
    rawEnd: { value: string; params: Record<string, string> };
    rawDuration: string;
  }> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current && current.rawStart) {
        const start = parseIcalDate(current.rawStart.value, current.rawStart.params);
        if (!start) {
          current = null;
          continue;
        }
        let end: DateIcal | null = null;
        if (current.rawEnd) {
          end = parseIcalDate(current.rawEnd.value, current.rawEnd.params);
          // RFC 5545 : pour les évènements all-day, DTEND est exclusif.
          // On le rend inclusif pour notre modèle interne en retirant 1
          // jour (sauf si DTEND == DTSTART).
          if (end && start.allDay && end.ymd !== start.ymd) {
            end = { ...end, ymd: addDaysYmd(end.ymd, -1) };
          }
        } else if (current.rawDuration) {
          const minutes = parseIcalDuration(current.rawDuration);
          if (minutes !== null && minutes > 0) end = ajouterMinutes(start, minutes);
        }
        if (!end) end = { ymd: start.ymd, hm: start.hm, allDay: start.allDay };

        const uidBase = (current.uid ?? "").trim() || `${Date.now()}-${Math.random()}`;
        // Occurrence modifiée d'une série : même UID que le maître dans
        // le flux → identifiant distinct chez nous, sinon deux évènements
        // partageaient la même clé (rattachement et reprise confondus).
        const uid = current.recurrenceId ? `${uidBase}#${current.recurrenceId.trim()}` : uidBase;

        events.push({
          uid,
          summary: (current.summary ?? "").trim() || "(sans titre)",
          description: current.description?.trim() || null,
          location: current.location?.trim() || null,
          date_start: start.ymd,
          date_end: end.ymd,
          time_start: start.hm,
          time_end: end.hm,
          all_day: start.allDay,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const { name, params, value } = parseLine(line);
    switch (name) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.summary = value;
        break;
      case "DESCRIPTION":
        current.description = value;
        break;
      case "LOCATION":
        current.location = value;
        break;
      case "DTSTART":
        current.rawStart = { value, params };
        break;
      case "DTEND":
        current.rawEnd = { value, params };
        break;
      case "DURATION":
        current.rawDuration = value;
        break;
      case "RECURRENCE-ID":
        current.recurrenceId = value;
        break;
    }
  }
  return events;
}
