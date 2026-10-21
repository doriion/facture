import { describe, expect, it } from "vitest";

import { icsVisite } from "./ics-visite";

describe("icsVisite", () => {
  it("visite à l'heure : heures de Paris converties en UTC (été : −2 h)", () => {
    const ics = icsVisite({
      uid: "visite-1@ng-gestion",
      titre: "Visite d'entretien — Nathan Geneve EI",
      description: "PAC air/eau, le matin.\nRépondez au message pour décaler.",
      lieu: "8 chemin du Vercors, 38100 Grenoble",
      date: "2026-10-20",
      debut: "08:00",
      fin: "12:00",
      maintenantIso: "2026-10-10T09:15:00.000Z",
    });
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261020T060000Z");
    expect(ics).toContain("DTEND:20261020T100000Z");
    expect(ics).toContain("DTSTAMP:20261010T091500Z");
    expect(ics).toContain("SUMMARY:Visite d'entretien — Nathan Geneve EI");
    expect(ics).toContain("DESCRIPTION:PAC air/eau\\, le matin.\\nRépondez au message pour décaler.");
    expect(ics).toContain("LOCATION:8 chemin du Vercors\\, 38100 Grenoble");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("hiver : −1 h ; journée entière : dates sans heure, fin le lendemain", () => {
    expect(icsVisite({ uid: "u", titre: "t", date: "2026-12-15", debut: "14:00", fin: "18:00", maintenantIso: "2026-12-01T00:00:00.000Z" })).toContain("DTSTART:20261215T130000Z");
    const journee = icsVisite({ uid: "u", titre: "t", date: "2026-12-15", debut: null, fin: null, maintenantIso: "2026-12-01T00:00:00.000Z" });
    expect(journee).toContain("DTSTART;VALUE=DATE:20261215");
    expect(journee).toContain("DTEND;VALUE=DATE:20261216");
  });
});
