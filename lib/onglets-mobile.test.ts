import { describe, expect, it } from "vitest";

import { normaliserOnglets, ONGLETS_PAR_DEFAUT, ONGLETS_POSSIBLES } from "./onglets-mobile";

describe("onglets mobiles", () => {
  it("quatre liens connus et distincts sont gardés tels quels", () => {
    expect(normaliserOnglets(["/clients", "/agenda", "/fiches-gaz", "/taches"])).toEqual(["/clients", "/agenda", "/fiches-gaz", "/taches"]);
  });
  it("valeur absente, abîmée, doublon ou lien inconnu → défaut", () => {
    expect(normaliserOnglets(null)).toEqual(ONGLETS_PAR_DEFAUT);
    expect(normaliserOnglets("x")).toEqual(ONGLETS_PAR_DEFAUT);
    expect(normaliserOnglets(["/agenda", "/agenda", "/devis", "/factures"])).toEqual(ONGLETS_PAR_DEFAUT);
    expect(normaliserOnglets(["/agenda", "/devis", "/factures", "/inconnu"])).toEqual(ONGLETS_PAR_DEFAUT);
    expect(normaliserOnglets(["/agenda", "/devis", "/factures", "/parametres"])).toEqual(ONGLETS_PAR_DEFAUT);
  });
  it("les réglages ne sont pas proposés, le défaut est proposable", () => {
    expect(ONGLETS_POSSIBLES.some((o) => o.href === "/parametres")).toBe(false);
    for (const h of ONGLETS_PAR_DEFAUT) expect(ONGLETS_POSSIBLES.some((o) => o.href === h)).toBe(true);
  });
});
