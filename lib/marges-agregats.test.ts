import { describe, expect, it } from "vitest";

import { margesParChantier, margesParMois, totalMarges, type LigneMargeFacture } from "./marges-agregats";

const facture = (over: Partial<NonNullable<LigneMargeFacture["facture"]>> = {}) => ({
  id: "f1",
  numero: "F-2026-0001",
  date_emission: "2026-09-10",
  statut: "payee",
  type_facture: "normale",
  total_ht: 1000,
  client: { nom: "Dupont" },
  ...over,
});

const ligne = (over: Partial<LigneMargeFacture> = {}): LigneMargeFacture => ({
  quantite: 1,
  prix_unitaire_ht: 400,
  prix_achat_ttc_unitaire: 250,
  facture: facture(),
  ...over,
});

describe("margesParChantier", () => {
  it("marge réelle = total HT − achats renseignés, lignes sans PA comptées", () => {
    const [c] = margesParChantier([
      ligne(),
      ligne({ prix_unitaire_ht: 600, prix_achat_ttc_unitaire: null }), // main-d'œuvre
    ]);
    expect(c).toMatchObject({
      numero: "F-2026-0001",
      totalHt: 1000,
      coutRenseigne: 250,
      margeEuros: 750,
      margePct: 75,
      nbLignesSansPa: 1,
      client_nom: "Dupont",
    });
  });

  it("exclut annulées, brouillons et lignes orphelines ; les titres ne comptent pas", () => {
    const lignes = [
      ligne({ facture: facture({ id: "a", statut: "annulee" }) }),
      ligne({ facture: facture({ id: "b", statut: "brouillon" }) }),
      ligne({ facture: null }),
      ligne({ type: "titre", prix_unitaire_ht: 0, prix_achat_ttc_unitaire: null }),
      ligne(),
    ];
    const r = margesParChantier(lignes);
    expect(r).toHaveLength(1);
    expect(r[0]!.nbLignesSansPa).toBe(0);
  });

  it("un avoir vient en négatif", () => {
    const [c] = margesParChantier([
      ligne({ facture: facture({ id: "av", numero: "AV-1", type_facture: "avoir", total_ht: 100 }), prix_unitaire_ht: 100, prix_achat_ttc_unitaire: 40 }),
    ]);
    expect(c).toMatchObject({ avoir: true, totalHt: -100, coutRenseigne: -40, margeEuros: -60 });
  });

  it("trie par date puis numéro décroissants", () => {
    const r = margesParChantier([
      ligne({ facture: facture({ id: "1", numero: "F-1", date_emission: "2026-08-01" }) }),
      ligne({ facture: facture({ id: "2", numero: "F-2", date_emission: "2026-09-01" }) }),
      ligne({ facture: facture({ id: "3", numero: "F-3", date_emission: "2026-09-01" }) }),
    ]);
    expect(r.map((c) => c.numero)).toEqual(["F-3", "F-2", "F-1"]);
  });
});

describe("margesParMois / totalMarges", () => {
  it("agrège par mois d'émission et calcule le taux global", () => {
    const chantiers = margesParChantier([
      ligne({ facture: facture({ id: "1", date_emission: "2026-09-02", total_ht: 1000 }) }),
      ligne({ facture: facture({ id: "2", date_emission: "2026-09-20", total_ht: 500 }), prix_achat_ttc_unitaire: null }),
      ligne({ facture: facture({ id: "3", date_emission: "2026-08-05", total_ht: 200 }), prix_achat_ttc_unitaire: 50 }),
    ]);
    const mois = margesParMois(chantiers);
    expect(mois.map((m) => m.mois)).toEqual(["2026-09", "2026-08"]);
    expect(mois[0]).toMatchObject({ nbFactures: 2, totalHt: 1500, coutRenseigne: 250, margeEuros: 1250, nbLignesSansPa: 1 });
    expect(mois[0]!.margePct).toBeCloseTo(83.33, 2);
    const total = totalMarges(mois);
    expect(total).toMatchObject({ nbFactures: 3, totalHt: 1700, coutRenseigne: 300, margeEuros: 1400 });
    expect(total.margePct).toBeCloseTo(82.35, 2);
  });

  it("vide → zéro, taux null", () => {
    expect(totalMarges([])).toEqual({ nbFactures: 0, totalHt: 0, coutRenseigne: 0, margeEuros: 0, nbLignesSansPa: 0, margePct: null });
  });
});
