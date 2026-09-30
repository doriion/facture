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

  it("convertit le format UTC (suffixe Z, flux Google) en heure de Paris", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:evt-4",
          "SUMMARY:Visio",
          "DTSTART:20260511T140000Z",
          "DTEND:20260511T150000Z",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:evt-nuit",
          "SUMMARY:Astreinte",
          "DTSTART:20260110T233000Z",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    // Mai : UTC+2 ; janvier : UTC+1 — et 23:30 UTC devient le LENDEMAIN 00:30
    expect(events[0]!.time_start).toBe("16:00");
    expect(events[0]!.time_end).toBe("17:00");
    expect(events[0]!.all_day).toBe(false);
    expect(events[1]!.date_start).toBe("2026-01-11");
    expect(events[1]!.time_start).toBe("00:30");
  });

  it("convertit un TZID étranger en heure de Paris, garde l'heure locale pour Paris ou un TZID inconnu", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:ny",
          "SUMMARY:Appel",
          "DTSTART;TZID=America/New_York:20260511T090000",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:paris",
          "SUMMARY:Chantier",
          "DTSTART;TZID=Europe/Paris:20260511T090000",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:inconnu",
          "SUMMARY:Bizarre",
          "DTSTART;TZID=Mars/Olympus:20260511T090000",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events[0]!.time_start).toBe("15:00");
    expect(events[1]!.time_start).toBe("09:00");
    expect(events[2]!.time_start).toBe("09:00");
  });

  it("DURATION sans DTEND donne une fin, et une date illisible fait ignorer l'évènement", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:duree",
          "SUMMARY:Entretien",
          "DTSTART:20260511T090000",
          "DURATION:PT1H30M",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:duree-jours",
          "SUMMARY:Congés",
          "DTSTART;VALUE=DATE:20260511",
          "DURATION:P3D",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:illisible",
          "SUMMARY:Fantôme",
          "DTSTART:pas-une-date",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events.map((e) => e.uid)).toEqual(["duree", "duree-jours"]);
    expect(events[0]!.time_end).toBe("10:30");
    expect(events[1]!.date_end).toBe("2026-05-13");
  });

  it("une occurrence modifiée d'une série (RECURRENCE-ID) a un identifiant distinct du maître", () => {
    const events = parseIcal(
      ics(
        [
          "BEGIN:VEVENT",
          "UID:serie",
          "SUMMARY:Visite hebdo",
          "DTSTART:20260504T090000",
          "RRULE:FREQ=WEEKLY",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:serie",
          "RECURRENCE-ID:20260511T090000",
          "SUMMARY:Visite hebdo (déplacée)",
          "DTSTART:20260512T140000",
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    expect(events.map((e) => e.uid)).toEqual(["serie", "serie#20260511T090000"]);
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

  it("expose LOCATION (adresse saisie sur l'iPhone), null si absente", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:loc-1",
      "SUMMARY:DEHEEKEREN Marie",
      "LOCATION:1 Av. du Centenaire\\, Valgelon-La Rochette",
      "DTSTART;VALUE=DATE:20260918",
      "DTEND;VALUE=DATE:20260919",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:loc-2",
      "SUMMARY:Sans lieu",
      "DTSTART;VALUE=DATE:20260918",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [avec, sans] = parseIcal(ics);
    expect(avec?.location).toBe("1 Av. du Centenaire, Valgelon-La Rochette");
    expect(sans?.location).toBeNull();
  });
});
