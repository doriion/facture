import { describe, expect, it } from "vitest";

import { parseIcal } from "./ical-parser";

function ics(body: string): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", body, "END:VCALENDAR"].join("\r\n");
}

describe("parseIcal", () => {
  it("parse un évènement all-day mono-jour", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-1@icloud.com",
          "SUMMARY:Chantier Dupont",
          "DTSTART;VALUE=DATE:20260511",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: "evt-1@icloud.com",
      summary: "Chantier Dupont",
      date_start: "2026-05-11",
      date_end: "2026-05-11",
      time_start: null,
      time_end: null,
      all_day: true,
    });
  });

  it("rend DTEND inclusif pour les all-day multi-jours (RFC 5545 : exclusif)", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-2",
          "SUMMARY:Chantier 3 jours",
          "DTSTART;VALUE=DATE:20260511",
          "DTEND;VALUE=DATE:20260514",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    // DTEND 14/05 exclusif → dernier jour réel le 13/05
    expect(events[0]!.date_end).toBe("2026-05-13");
  });

  it("parse un évènement horodaté avec TZID", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-3",
          "SUMMARY:RDV client",
          "DTSTART;TZID=Europe/Paris:20260511T093000",
          "DTEND;TZID=Europe/Paris:20260511T103000",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events[0]).toMatchObject({
      date_start: "2026-05-11",
      time_start: "09:30",
      time_end: "10:30",
      all_day: false,
    });
  });

  it("accepte le format UTC (suffixe Z)", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-4",
          "SUMMARY:Visio",
          "DTSTART:20260511T140000Z",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events[0]!.time_start).toBe("14:00");
    expect(events[0]!.all_day).toBe(false);
  });

  it("déplie les lignes pliées RFC 5545 (continuation espace/tab)", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-5",
          "SUMMARY:Remplacement chaudière et",
          "  entretien climatisation",
          "DTSTART;VALUE=DATE:20260511",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events[0]!.summary).toBe(
      "Remplacement chaudière et entretien climatisation",
    );
  });

  it("dé-escape les valeurs (\\n, \\, virgules, points-virgules)", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-6",
          "SUMMARY:RDV\\, chez M. Martin\\; urgent",
          "DESCRIPTION:Ligne 1\\nLigne 2",
          "DTSTART;VALUE=DATE:20260511",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events[0]!.summary).toBe("RDV, chez M. Martin; urgent");
    expect(events[0]!.description).toBe("Ligne 1\nLigne 2");
  });

  it("ignore les VEVENT sans DTSTART et continue le parsing", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:invalide",
          "SUMMARY:Sans date",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:valide",
          "SUMMARY:Avec date",
          "DTSTART;VALUE=DATE:20260511",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.uid).toBe("valide");
  });

  it("met un titre de repli si SUMMARY absent ou vide", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-7",
          "DTSTART;VALUE=DATE:20260511",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events[0]!.summary).toBe("(sans titre)");
  });

  it("renvoie une liste vide sur un texte sans VEVENT", () => {
    expect(parseIcal("")).toEqual([]);
    expect(parseIcal("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toEqual([]);
  });
});
