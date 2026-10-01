import { describe, expect, it } from "vitest";

import {
  dateLimiteDeclaration,
  joursEntre,
  periodeADeclarer,
  periodiciteSure,
  rappelDeclaration,
} from "./declarations-urssaf";

describe("periodeADeclarer — trimestriel", () => {
  it("au 1er octobre, c'est T3 à déclarer avant le 31 octobre", () => {
    expect(periodeADeclarer("2026-10-01", "trimestrielle")).toEqual({
      label: "T3 2026",
      start: "2026-07-01",
      end: "2026-10-01",
      dateLimite: "2026-10-31",
    });
  });

  it("en janvier, c'est T4 de l'année précédente, avant le 31 janvier", () => {
    expect(periodeADeclarer("2027-01-15", "trimestrielle")).toEqual({
      label: "T4 2026",
      start: "2026-10-01",
      end: "2027-01-01",
      dateLimite: "2027-01-31",
    });
  });

  it("en plein trimestre, la période échue reste la précédente", () => {
    expect(periodeADeclarer("2026-12-20", "trimestrielle").label).toBe("T3 2026");
    expect(periodeADeclarer("2026-05-02", "trimestrielle").label).toBe("T1 2026");
  });

  it("les libellés correspondent à ceux de la page Exports (« T1 2026 »)", () => {
    expect(periodeADeclarer("2026-04-01", "trimestrielle")).toMatchObject({
      label: "T1 2026",
      start: "2026-01-01",
      end: "2026-04-01",
    });
  });
});

describe("periodeADeclarer — mensuel", () => {
  it("au 1er octobre, c'est septembre, avant le 31 octobre", () => {
    expect(periodeADeclarer("2026-10-01", "mensuelle")).toEqual({
      label: "Septembre 2026",
      start: "2026-09-01",
      end: "2026-10-01",
      dateLimite: "2026-10-31",
    });
  });

  it("en janvier, c'est décembre de l'année précédente", () => {
    expect(periodeADeclarer("2027-01-03", "mensuelle")).toEqual({
      label: "Décembre 2026",
      start: "2026-12-01",
      end: "2027-01-01",
      dateLimite: "2027-01-31",
    });
  });

  it("février : limite au 28 ou 29", () => {
    expect(dateLimiteDeclaration("2026-02-01")).toBe("2026-02-28");
    expect(dateLimiteDeclaration("2028-02-01")).toBe("2028-02-29");
  });
});

describe("rappelDeclaration", () => {
  it("compte les jours restants, négatif en retard", () => {
    expect(joursEntre("2026-10-01", "2026-10-31")).toBe(30);
    expect(rappelDeclaration("2026-10-01", "trimestrielle", () => false)?.joursRestants).toBe(30);
    expect(rappelDeclaration("2026-11-05", "trimestrielle", () => false)?.joursRestants).toBe(-5);
  });

  it("rien à rappeler quand la période est déclarée", () => {
    expect(
      rappelDeclaration("2026-10-01", "trimestrielle", (p) => p.start === "2026-07-01" && p.end === "2026-10-01"),
    ).toBeNull();
  });

  it("périodicité inconnue → trimestrielle", () => {
    expect(periodiciteSure("bidon")).toBe("trimestrielle");
    expect(periodiciteSure("mensuelle")).toBe("mensuelle");
  });
});
