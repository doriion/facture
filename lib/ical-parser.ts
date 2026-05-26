/**
 * Parser iCal minimal pour importer un flux externe (iCloud, Google
 * Calendar publié, etc.) dans l'agenda en lecture seule.
 *
 * Couvre les VEVENT all-day (DTSTART;VALUE=DATE) ET timed (DTSTART
 * avec heure), avec ou sans TZID. Pas de support des RRULE
 * (récurrences) pour rester simple — un évènement récurrent ne
 * remonte que sa première occurrence.
 *
 * Pas une implémentation RFC 5545 complète mais largement suffisante
 * pour les calendriers publiés depuis iPhone (iCloud) ou Google.
 */

export type ParsedIcalEvent = {
  uid: string;
  summary: string;
  description: string | null;
  /** YYYY-MM-DD (date locale, sans heure) */
  date_start: string;
  /** YYYY-MM-DD (date locale, inclusive, sans heure) */
  date_end: string;
  /** HH:MM ou null si all-day */
  time_start: string | null;
  /** HH:MM ou null si all-day */
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
      params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
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

/**
 * Parse une date iCal. 3 formats possibles :
 *   - "20260511"            → date all-day
 *   - "20260511T093000"     → datetime locale (TZID éventuel)
 *   - "20260511T093000Z"    → datetime UTC
 *
 * Renvoie { ymd, hm, allDay } où ymd = "YYYY-MM-DD" et hm = "HH:MM" ou null.
 * Les conversions de fuseau sont approximatives (on garde la date/heure
 * telle qu'elle apparaît, sans recalculer vers Europe/Paris).
 */
function parseIcalDate(raw: string): {
  ymd: string;
  hm: string | null;
  allDay: boolean;
} {
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
  const dtMatch = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (dtMatch) {
    return {
      ymd: `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`,
      hm: `${dtMatch[4]}:${dtMatch[5]}`,
      allDay: false,
    };
  }
  // Fallback : aujourd'hui
  return {
    ymd: new Date().toISOString().slice(0, 10),
    hm: null,
    allDay: true,
  };
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Parse un texte iCal complet. Tolérant aux erreurs : un VEVENT invalide
 * est ignoré, le reste continue.
 */
export function parseIcal(text: string): ParsedIcalEvent[] {
  const events: ParsedIcalEvent[] = [];
  const lines = unfoldLines(text);

  let current: Partial<{
    uid: string;
    summary: string;
    description: string;
    rawStart: { value: string; params: Record<string, string> };
    rawEnd: { value: string; params: Record<string, string> };
  }> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current && current.rawStart) {
        const start = parseIcalDate(current.rawStart.value);
        let end = current.rawEnd
          ? parseIcalDate(current.rawEnd.value)
          : { ymd: start.ymd, hm: start.hm, allDay: start.allDay };

        // RFC 5545 : pour les évènements all-day, DTEND est exclusif.
        // On le rend inclusif pour notre modèle interne en retirant 1 jour
        // (sauf si DTEND == DTSTART).
        if (start.allDay && current.rawEnd && end.ymd !== start.ymd) {
          end = { ...end, ymd: addDaysYmd(end.ymd, -1) };
        }

        events.push({
          uid: current.uid ?? `${Date.now()}-${Math.random()}`,
          summary: (current.summary ?? "").trim() || "(sans titre)",
          description: current.description?.trim() || null,
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
      case "DTSTART":
        current.rawStart = { value, params };
        break;
      case "DTEND":
        current.rawEnd = { value, params };
        break;
    }
  }
  return events;
}
