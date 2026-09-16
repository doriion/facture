import { describe, expect, it } from "vitest";

import { aujourdhuiParis, estAFacturer, statutFacturation } from "./agenda-facturation";

const AUJOURDHUI = "2026-09-16";

describe("statutFacturation", () => {
  it("intervention passée sans facture → à facturer ; future → prévue", () => {
    expect(statutFacturation({ kind: "intervention", date_start: "2026-09-10" }, AUJOURDHUI)).toBe("a_facturer");
    expect(statutFacturation({ kind: "intervention", date_start: AUJOURDHUI }, AUJOURDHUI)).toBe("a_facturer");
    expect(statutFacturation({ kind: "intervention", date_start: "2026-09-17" }, AUJOURDHUI)).toBe("prevue");
  });

  it("« rien à facturer » l'emporte, passé ou futur ; une facture émise l'emporte sur tout", () => {
    expect(statutFacturation({ kind: "intervention", date_start: "2026-09-10", a_facturer: false }, AUJOURDHUI)).toBe("sans_facturation");
    expect(statutFacturation({ kind: "intervention", date_start: "2026-09-30", a_facturer: false }, AUJOURDHUI)).toBe("sans_facturation");
    expect(statutFacturation({ kind: "intervention", date_start: "2026-09-10", a_facturer: false, facture_emise: true }, AUJOURDHUI)).toBe("facturee");
  });

  it("RDV iPhone : même règle passé / futur, pas de « rien à facturer »", () => {
    expect(statutFacturation({ kind: "external", date_start: "2026-09-10" }, AUJOURDHUI)).toBe("a_facturer");
    expect(statutFacturation({ kind: "external", date_start: "2026-09-20" }, AUJOURDHUI)).toBe("prevue");
    expect(statutFacturation({ kind: "external", date_start: "2026-09-10", facture_emise: true }, AUJOURDHUI)).toBe("facturee");
  });

  it("factures, devis et visites ne sont pas concernés", () => {
    expect(statutFacturation({ kind: "facture_prestation", date_start: "2026-09-10" }, AUJOURDHUI)).toBeNull();
    expect(statutFacturation({ kind: "devis_planifie", date_start: "2026-09-10" }, AUJOURDHUI)).toBeNull();
    expect(estAFacturer({ kind: "visite_maintenance", date_start: "2026-09-10" }, AUJOURDHUI)).toBe(false);
  });

  it("estAFacturer : seulement le statut « a_facturer »", () => {
    expect(estAFacturer({ kind: "intervention", date_start: "2026-09-10" }, AUJOURDHUI)).toBe(true);
    expect(estAFacturer({ kind: "intervention", date_start: "2026-09-10", a_facturer: false }, AUJOURDHUI)).toBe(false);
    expect(estAFacturer({ kind: "intervention", date_start: "2026-09-20" }, AUJOURDHUI)).toBe(false);
  });
});

describe("aujourdhuiParis", () => {
  it("date de Paris même quand le serveur est en UTC (23h30 UTC = lendemain à Paris en été)", () => {
    expect(aujourdhuiParis(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-16");
    expect(aujourdhuiParis(new Date("2026-01-15T12:00:00Z"))).toBe("2026-01-15");
  });
});

describe("statsDuMois (compteurs calculés côté client)", () => {
  it("ne compte que le mois affiché, « à facturer » = passé hors « rien à facturer »", async () => {
    const { statsDuMois } = await import("./agenda-facturation");
    const ev = (kind: string, date_start: string, extra: Record<string, unknown> = {}) => ({ kind, date_start, date_end: date_start, ...extra });
    const events = [
      ev("intervention", "2026-09-10"),
      ev("intervention", "2026-09-25"), // future → prévue
      ev("intervention", "2026-09-12", { a_facturer: false }),
      ev("intervention", "2026-09-05", { facture_emise: true }),
      ev("intervention", "2026-08-30"), // autre mois
      ev("facture_prestation", "2026-09-03"),
      ev("devis_planifie", "2026-09-20"),
      ev("visite_maintenance", "2026-09-21"),
      ev("external", "2026-09-14"),
      ev("external", "2026-09-30"),
    ];
    expect(statsDuMois(events, 2026, 9, AUJOURDHUI)).toEqual({
      nbInterventions: 4,
      nbInterventionsAFacturer: 1,
      nbFactures: 1,
      nbDevis: 1,
      nbVisites: 1,
      nbExternal: 2,
      nbExternalAFacturer: 1,
    });
  });
});
