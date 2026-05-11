// Supabase Edge Function : flux iCal public.
//
// Pourquoi cette fonction existe alors qu'on a déjà la route Next.js
// /api/calendar/[token] : la "Deployment Protection" de Vercel renvoie
// 401 sur toutes les URLs *.vercel.app, ce qui rend le flux iCal
// inaccessible à l'app Calendrier d'iOS. On déplace donc l'endpoint sur
// Supabase (no-verify-jwt = pas d'auth requise), ce qui le rend public.
//
// Sécurité : l'auth repose sur le token opaque (32 octets) dans l'URL.
// La fonction Postgres calendar_events_for_token est SECURITY DEFINER et
// filtre par token ; un token invalide renvoie 0 ligne.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Token accepté via path (...calendar-ics/TOKEN[.ics]) ou query ?token=...
  const pathMatch = url.pathname.match(/calendar-ics\/(.+?)(?:\.ics)?$/i);
  const rawToken =
    (pathMatch && pathMatch[1]) || url.searchParams.get("token") || "";
  const token = rawToken.replace(/\.ics$/i, "");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let events: AgendaRow[] = [];
  if (token && token.length >= 16) {
    const { data } = await supabase.rpc("calendar_events_for_token", {
      p_token: token,
    });
    if (Array.isArray(data)) events = data as AgendaRow[];
  }

  const ics = buildIcs(events);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": 'inline; filename="facture-ae-agenda.ics"',
    },
  });
});

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

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  chunks.push(line.slice(i, i + 75));
  i += 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

function formatIcsTimestamp(d: Date): string {
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
