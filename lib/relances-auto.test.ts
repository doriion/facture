import { describe, expect, it } from "vitest";

import {
  facturesARelancer,
  type FactureRelancable,
  type RelanceExistante,
} from "./relances-auto";

const TODAY = "2026-09-02";
const OPTS = { today: TODAY, delaiJours: 15 };

function facture(over: Partial<FactureRelancable> = {}): FactureRelancable {
  return {
    id: "f1",
    numero: "F-2026-0005",
    statut: "envoyee",
    date_echeance: "2026-08-01", // 32 j de retard
    exclure_relances_auto: false,
    client_email: "client@exemple.fr",
    ...over,
  };
}

const relance = (
  facture_id: string,
  envoyee_le: string,
  automatique = true,
): RelanceExistante => ({ facture_id, envoyee_le, automatique });

describe("facturesARelancer", () => {
  it("retient une facture envoyée, échue depuis N jours, avec email", () => {
    const res = facturesARelancer([facture()], [], OPTS);
    expect(res).toHaveLength(1);
    expect(res[0]!.joursRetard).toBe(32);
  });

  it("respecte le délai configurable (N jours après échéance)", () => {
    // Échéance dépassée de 10 j seulement
    const f = facture({ date_echeance: "2026-08-23" });
    expect(facturesARelancer([f], [], OPTS)).toHaveLength(0);
    expect(
      facturesARelancer([f], [], { today: TODAY, delaiJours: 10 }),
    ).toHaveLength(1);
  });

  it("écarte : payée/brouillon, exclusion manuelle, sans email", () => {
    expect(
      facturesARelancer(
        [
          facture({ statut: "payee" }),
          facture({ id: "f2", statut: "brouillon" }),
          facture({ id: "f3", exclure_relances_auto: true }),
          facture({ id: "f4", client_email: null }),
        ],
        [],
        OPTS,
      ),
    ).toHaveLength(0);
  });

  it("cooldown : pas de relance si une relance (même MANUELLE) date de moins de 15 j", () => {
    const recente = [relance("f1", "2026-08-25T08:00:00Z", false)];
    expect(facturesARelancer([facture()], recente, OPTS)).toHaveLength(0);
    // Relance vieille de plus de 15 j → OK
    const ancienne = [relance("f1", "2026-08-10T08:00:00Z", false)];
    expect(facturesARelancer([facture()], ancienne, OPTS)).toHaveLength(1);
  });

  it("plafond : 2 relances automatiques maximum par facture", () => {
    const deuxAutos = [
      relance("f1", "2026-07-01T08:00:00Z"),
      relance("f1", "2026-07-20T08:00:00Z"),
    ];
    expect(facturesARelancer([facture()], deuxAutos, OPTS)).toHaveLength(0);
    // Une auto + une manuelle anciennes → encore une auto possible
    const mixte = [
      relance("f1", "2026-07-01T08:00:00Z", true),
      relance("f1", "2026-07-20T08:00:00Z", false),
    ];
    expect(facturesARelancer([facture()], mixte, OPTS)).toHaveLength(1);
  });

  it("les relances d'une AUTRE facture ne comptent pas", () => {
    const autres = [
      relance("f-autre", "2026-09-01T08:00:00Z"),
      relance("f-autre", "2026-08-30T08:00:00Z"),
    ];
    expect(facturesARelancer([facture()], autres, OPTS)).toHaveLength(1);
  });
});
