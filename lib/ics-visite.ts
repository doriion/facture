/**
 * Fichier calendrier (.ics) d'une visite d'entretien, joint à l'e-mail
 * de confirmation : le client l'ajoute à son calendrier en un geste.
 * Logique PURE, testée dans ics-visite.test.ts. Les heures sont celles
 * de Paris, converties en UTC (pas de VTIMEZONE à embarquer).
 */

import { instantDepuisLocale } from "@/lib/dates";

export type VisiteIcs = {
  uid: string;
  titre: string;
  description?: string | null;
  lieu?: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, null = journée entière */
  debut: string | null;
  fin: string | null;
  /** Instant de génération (DTSTAMP), ISO. */
  maintenantIso: string;
};

function echapper(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function instantParis(date: string, heure: string): Date {
  const [a, m, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  return instantDepuisLocale("Europe/Paris", a!, m!, j!, h!, mi!);
}

function lendemain(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function icsVisite(v: VisiteIcs): string {
  const lignes = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NG Gestion//Visite d'entretien//FR", "METHOD:PUBLISH", "BEGIN:VEVENT"];
  lignes.push(`UID:${echapper(v.uid)}`);
  lignes.push(`DTSTAMP:${utc(new Date(v.maintenantIso))}`);
  if (v.debut) {
    const fin = v.fin ?? `${String(Math.min(Number(v.debut.slice(0, 2)) + 1, 23)).padStart(2, "0")}:${v.debut.slice(3, 5)}`;
    lignes.push(`DTSTART:${utc(instantParis(v.date, v.debut))}`);
    lignes.push(`DTEND:${utc(instantParis(v.date, fin))}`);
  } else {
    lignes.push(`DTSTART;VALUE=DATE:${v.date.replace(/-/g, "")}`);
    lignes.push(`DTEND;VALUE=DATE:${lendemain(v.date).replace(/-/g, "")}`);
  }
  lignes.push(`SUMMARY:${echapper(v.titre)}`);
  if (v.description) lignes.push(`DESCRIPTION:${echapper(v.description)}`);
  if (v.lieu) lignes.push(`LOCATION:${echapper(v.lieu)}`);
  lignes.push("END:VEVENT", "END:VCALENDAR");
  return lignes.join("\r\n") + "\r\n";
}
