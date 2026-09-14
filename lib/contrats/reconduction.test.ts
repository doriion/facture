import { describe, expect, it } from "vitest";

import {
  contratsAReconduire,
  prochaineEcheance,
  type ContratReconductible,
} from "./reconduction";

const TODAY = "2026-09-11";

function contrat(over: Partial<ContratReconductible> = {}): ContratReconductible {
  return {
    id: "c-1",
    numero: "2026-001",
    statut: "actif",
    date_echeance: "2026-09-10",
    ...over,
  };
}

const reconduire = (cs: ContratReconductible[]) =>
  contratsAReconduire(cs, { today: TODAY });

describe("prochaineEcheance", () => {
  it("ajoute un an", () => {
    expect(prochaineEcheance("2026-09-10")).toBe("2027-09-10");
    expect(prochaineEcheance("2026-01-01")).toBe("2027-01-01");
  });

  it("29 février → 28 février (pas de glissement au 1er mars)", () => {
    expect(prochaineEcheance("2028-02-29")).toBe("2029-02-28");
  });

  it("reste stable sur une année bissextile suivante", () => {
    expect(prochaineEcheance("2027-02-28")).toBe("2028-02-28");
  });

  it("date invalide renvoyée telle quelle", () => {
    expect(prochaineEcheance("pas une date")).toBe("pas une date");
  });
});

describe("contratsAReconduire", () => {
  it("reconduit un contrat dont l'échéance est passée", () => {
    const [c] = reconduire([contrat()]);
    expect(c.nouvelleEcheance).toBe("2027-09-10");
  });

  it("ne touche pas une échéance future ou du jour", () => {
    expect(reconduire([contrat({ date_echeance: "2026-09-11" })])).toEqual([]);
    expect(reconduire([contrat({ date_echeance: "2027-01-01" })])).toEqual([]);
  });

  it("est idempotent : le résultat de la veille ne ressort pas", () => {
    const [c] = reconduire([contrat()]);
    expect(
      reconduire([contrat({ date_echeance: c.nouvelleEcheance })]),
    ).toEqual([]);
  });

  it("rattrape plusieurs années d'un coup", () => {
    const [c] = reconduire([contrat({ date_echeance: "2023-04-01" })]);
    expect(c.nouvelleEcheance).toBe("2027-04-01");
  });

  it("ne vise que les contrats signés ou actifs", () => {
    expect(reconduire([contrat({ statut: "signe" })])).toHaveLength(1);
    for (const statut of ["brouillon", "envoye", "resilie", "expire"]) {
      expect(reconduire([contrat({ statut })])).toHaveLength(0);
    }
  });

  it("ignore une échéance absente ou invalide", () => {
    expect(reconduire([contrat({ date_echeance: null })])).toEqual([]);
    expect(reconduire([contrat({ date_echeance: "31/12/2025" })])).toEqual([]);
  });

  it("la nouvelle échéance est toujours dans le futur", () => {
    for (const echeance of ["2026-09-10", "2024-02-29", "2020-01-01"]) {
      const [c] = reconduire([contrat({ date_echeance: echeance })]);
      expect(c.nouvelleEcheance >= TODAY).toBe(true);
    }
  });
});
