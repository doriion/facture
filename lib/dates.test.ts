import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { dateHeureParis, dateParis, fuseauConnu, instantDepuisLocale } from "./dates";

describe("dateHeureParis", () => {
  it("convertit un instant UTC en date et heure de Paris (été / hiver, passage de minuit)", () => {
    expect(dateHeureParis(new Date("2026-05-11T14:00:00Z"))).toEqual({ ymd: "2026-05-11", hm: "16:00" });
    expect(dateHeureParis(new Date("2026-01-10T23:30:00Z"))).toEqual({ ymd: "2026-01-11", hm: "00:30" });
    expect(dateParis("2026-01-10T23:30:00Z")).toBe("2026-01-11");
  });
});

describe("instantDepuisLocale", () => {
  it("retrouve l'instant d'une heure locale d'un autre fuseau", () => {
    // 9 h à New York le 11 mai (EDT, UTC−4) = 13 h UTC = 15 h Paris
    const i = instantDepuisLocale("America/New_York", 2026, 5, 11, 9, 0);
    expect(i.toISOString()).toBe("2026-05-11T13:00:00.000Z");
    expect(dateHeureParis(i).hm).toBe("15:00");
    expect(fuseauConnu("Europe/Paris")).toBe(true);
    expect(fuseauConnu("Mars/Olympus")).toBe(false);
  });
});

/**
 * Garde-fou : la date du jour se calcule avec aujourdhuiParis(), jamais
 * avec new Date().toISOString().slice(0, 10) (date UTC = la veille entre
 * 0 h et 2 h en France). Le motif est interdit dans app/ et components/.
 */
function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else if (/\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom)) out.push(chemin);
  }
  return out;
}

describe("date du jour en heure de Paris", () => {
  it("aucun `new Date().toISOString().slice(0, 10)` dans app/ et components/", () => {
    const racine = join(__dirname, "..");
    const fautifs = [...fichiers(join(racine, "app")), ...fichiers(join(racine, "components"))]
      .filter((f) => /new Date\(\)\s*\.toISOString\(\)\s*\.slice\(0,\s*10\)/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(racine.length + 1));
    expect(fautifs).toEqual([]);
  });
});
