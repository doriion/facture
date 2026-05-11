import { type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flux iCal public (sans auth) — abonnement depuis l'app Calendrier d'iOS
 * ou Google Calendar. Les évènements sont filtrés via un token opaque,
 * vérifié par la fonction Postgres `calendar_events_for_token` qui
 * tourne en SECURITY DEFINER.
 *
 * URL : /api/calendar/{token}
 *
 * Sécurité : un token invalide retourne un calendrier vide (200 OK)
 * — pas de fuite d'information sur l'existence d'un compte.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = decodeURIComponent(params.token).replace(/\.ics$/i, "");

  // Client anonyme (pas de cookies, pas de session) — l'auth est portée
  // par le token dans l'URL et la fonction Postgres.
  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );

  let events: NonNullable<
    Awaited<ReturnType<typeof supabase.rpc<"calendar_events_for_token">>>["data"]
  > = [];

  if (token && token.length >= 16) {
    const { data } = await supabase.rpc("calendar_events_for_token", {
      p_token: token,
    });
    if (data) events = data;
  }

  const ics = buildIcs(events);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Cache court : iOS rafraîchit toutes les ~15 min, on autorise
      // un cache CDN bref pour absorber les pics tout en restant frais.
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": 'inline; filename="facture-ae-agenda.ics"',
    },
  });
}

type AgendaRow = {
  kind: string;
  ev_id: string;
  date_start: string;
  date_end: string;
  title: string;
  client_nom: string | null;
  statut: string | null;
  numero: string | null;
  type_activite: string | null;
  facture_emise: boolean | null;
};

function buildIcs(events: AgendaRow[]): string {
  const now = formatIcsTimestamp(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Facture AE//Agenda pro//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Facture AE — Agenda",
    "X-WR-TIMEZONE:Europe/Paris",
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];

  for (const ev of events) {
    const startCompact = ev.date_start.replace(/-/g, "");
    // DTEND est exclusif pour les évènements all-day → +1 jour sur date_end
    const endExclusive = addOneDay(ev.date_end).replace(/-/g, "");
    const summary = buildSummary(ev);
    const description = buildDescription(ev);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.kind}-${ev.ev_id}@facture-ae`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${startCompact}`);
    lines.push(`DTEND;VALUE=DATE:${endExclusive}`);
    lines.push(foldLine(`SUMMARY:${escapeIcs(summary)}`));
    if (description) {
      lines.push(foldLine(`DESCRIPTION:${escapeIcs(description)}`));
    }
    if (ev.kind === "intervention" && ev.facture_emise === false) {
      lines.push("CATEGORIES:Intervention,A facturer");
    } else if (ev.kind === "intervention") {
      lines.push("CATEGORIES:Intervention");
    } else if (ev.kind === "facture_prestation") {
      lines.push("CATEGORIES:Facture");
    } else if (ev.kind === "devis_planifie") {
      lines.push("CATEGORIES:Devis");
    } else if (ev.kind === "visite_maintenance") {
      lines.push("CATEGORIES:Maintenance");
    }
    lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // iCal : lignes séparées par CRLF
  return lines.join("\r\n") + "\r\n";
}

function buildSummary(ev: AgendaRow): string {
  if (ev.kind === "intervention") {
    const prefix = ev.facture_emise ? "✓ " : "⚠︎ ";
    const client = ev.client_nom ? ` — ${ev.client_nom}` : "";
    return `${prefix}${ev.title}${client}`;
  }
  if (ev.kind === "facture_prestation") {
    const client = ev.client_nom ? ` — ${ev.client_nom}` : "";
    const statut = ev.statut ? ` (${labelStatutFacture(ev.statut)})` : "";
    return `📄 ${ev.title}${client}${statut}`;
  }
  if (ev.kind === "devis_planifie") {
    const client = ev.client_nom ? ` — ${ev.client_nom}` : "";
    return `📋 ${ev.title}${client}`;
  }
  // visite_maintenance
  const client = ev.client_nom ? ` — ${ev.client_nom}` : "";
  return `🔧 ${ev.title}${client}`;
}

function buildDescription(ev: AgendaRow): string {
  const parts: string[] = [];
  if (ev.kind === "intervention") {
    parts.push(
      ev.facture_emise
        ? "Intervention facturée"
        : "Intervention — pas encore facturée",
    );
    if (ev.type_activite) parts.push(`Type : ${ev.type_activite}`);
  } else if (ev.kind === "facture_prestation") {
    if (ev.statut) parts.push(`Statut : ${labelStatutFacture(ev.statut)}`);
    if (ev.type_activite) parts.push(`Activité : ${ev.type_activite}`);
  } else if (ev.kind === "devis_planifie") {
    if (ev.statut) parts.push(`Statut : ${ev.statut}`);
    if (ev.type_activite) parts.push(`Activité : ${ev.type_activite}`);
  }
  if (ev.client_nom) parts.push(`Client : ${ev.client_nom}`);
  return parts.join("\\n");
}

function labelStatutFacture(s: string): string {
  switch (s) {
    case "brouillon": return "brouillon";
    case "envoyee": return "envoyée";
    case "payee": return "payée";
    case "retard": return "en retard";
    case "annulee": return "annulée";
    default: return s;
  }
}

/**
 * Échappement iCal : virgules, points-virgules, antislashes et retours
 * à la ligne doivent être protégés (RFC 5545).
 */
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Pliage des lignes longues (RFC 5545 : 75 octets max par ligne).
 * Les continuations commencent par un espace.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  // Première ligne : 75 caractères max
  chunks.push(line.slice(i, i + 75));
  i += 75;
  // Suivantes : 74 caractères (le " " initial compte)
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

function formatIcsTimestamp(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function addOneDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}
