import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BAREME_PAR_DEFAUT,
  calculerEntretien,
  coutZone,
  equipementsContratDepuisCalcul,
  libelleTranche,
  lignesDocumentDepuisCalcul,
  normaliserTranches,
  prixUnitaire,
  type BaremeEntretien,
} from "./bareme-entretien";

const poste = (code: string) => {
  const p = BAREME_PAR_DEFAUT.postes.find((x) => x.code === code);
  if (!p) throw new Error(`poste ${code} absent du barème par défaut`);
  return p;
};
const zone = (code: string) => {
  const z = BAREME_PAR_DEFAUT.zones.find((x) => x.code === code);
  if (!z) throw new Error(`zone ${code} absente`);
  return z;
};

describe("prixUnitaire : tranches dégressives « <2 / 2 à 5 / 6 et plus »", () => {
  const split = poste("split_reversible").tranches; // 189 / 146 / 105

  it("1 unité → tranche 1, 2 à 5 → tranche 2, 6 et plus → tranche 3", () => {
    expect(prixUnitaire(split, 1)).toBe(189);
    expect(prixUnitaire(split, 2)).toBe(146);
    expect(prixUnitaire(split, 5)).toBe(146);
    expect(prixUnitaire(split, 6)).toBe(105);
    expect(prixUnitaire(split, 40)).toBe(105);
  });

  it("quantité nulle, négative ou invalide → pas de prix", () => {
    expect(prixUnitaire(split, 0)).toBeNull();
    expect(prixUnitaire(split, -3)).toBeNull();
    expect(prixUnitaire(split, Number.NaN)).toBeNull();
    expect(prixUnitaire([], 2)).toBeNull();
  });

  it("l'ordre de saisie des tranches est sans effet", () => {
    const desordre = [split[2]!, split[0]!, split[1]!];
    expect(prixUnitaire(desordre, 3)).toBe(146);
    expect(prixUnitaire(desordre, 1)).toBe(189);
  });

  it("tranche unique (unité intérieure 17 €) : même prix quelle que soit la quantité", () => {
    const ui = poste("ui_multi_reversible").tranches;
    expect(prixUnitaire(ui, 1)).toBe(17);
    expect(prixUnitaire(ui, 12)).toBe(17);
  });

  it("VRV : 380 € pour 1 unité, 285 € l'unité au-delà", () => {
    const vrv = poste("vrv").tranches;
    expect(prixUnitaire(vrv, 1)).toBe(380);
    expect(prixUnitaire(vrv, 2)).toBe(285);
    expect(prixUnitaire(vrv, 9)).toBe(285);
  });
});

describe("le barème par défaut reproduit les tarifs unitaires du fichier d'origine", () => {
  const attendu: Record<string, number[]> = {
    split_reversible: [189, 146, 105],
    split_froid: [126, 105, 63],
    ui_multi_reversible: [17],
    ui_multi_froid: [9],
    cta: [500, 395, 275],
    filtre_g4: [45],
    filtre_f7: [120],
    pac: [120, 100, 60],
    vmc_simple: [60, 46, 33],
    vmc_double: [128, 100, 60],
    vrv: [380, 285],
    ui_vrv_reversible: [17],
    ui_vrv_froid: [9],
  };

  it.each(Object.entries(attendu))("%s → %j", (code, prix) => {
    expect(poste(code).tranches.map((t) => t.prix)).toEqual(prix);
  });

  it("tous les codes sont uniques et chaque poste a une tranche à 1", () => {
    const codes = BAREME_PAR_DEFAUT.postes.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of BAREME_PAR_DEFAUT.postes) {
      expect(p.tranches[0]!.a_partir_de).toBe(1);
    }
  });
});

describe("totaux par catégorie : prix de la tranche × nombre d'unités", () => {
  it("3 splits réversibles → 3 × 146 = 438 €", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { split_reversible: 3 },
      zoneCode: null,
    });
    expect(r.lignes).toEqual([
      expect.objectContaining({ code: "split_reversible", quantite: 3, prixUnitaire: 146, total: 438 }),
    ]);
    expect(r.sousTotalEquipements).toBe(438);
    expect(r.total).toBe(438);
  });

  it("7 VMC simple flux → 7 × 33 = 231 € ; 1 CTA + 2 filtres F7 → 500 + 240", () => {
    const vmc = calculerEntretien(BAREME_PAR_DEFAUT, { quantites: { vmc_simple: 7 }, zoneCode: null });
    expect(vmc.total).toBe(231);
    const cta = calculerEntretien(BAREME_PAR_DEFAUT, { quantites: { cta: 1, filtre_f7: 2 }, zoneCode: null });
    expect(cta.lignes.map((l) => l.total)).toEqual([500, 240]);
    expect(cta.total).toBe(740);
  });

  it("quantités à 0, absentes, négatives ou décimales : ignorées ou tronquées", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { split_reversible: 0, pac: -2, vmc_double: 2.9, cta: Number.NaN },
      zoneCode: null,
    });
    expect(r.lignes.map((l) => [l.code, l.quantite, l.total])).toEqual([["vmc_double", 2, 200]]);
  });

  it("un poste désactivé n'est jamais chiffré", () => {
    const bareme: BaremeEntretien = {
      ...BAREME_PAR_DEFAUT,
      postes: BAREME_PAR_DEFAUT.postes.map((p) =>
        p.code === "pac" ? { ...p, actif: false } : p,
      ),
    };
    const r = calculerEntretien(bareme, { quantites: { pac: 3 }, zoneCode: null });
    expect(r.lignes).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("les lignes suivent l'ordre du barème, pas celui de la sélection", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { vrv: 1, split_froid: 2, cta: 1 },
      zoneCode: null,
    });
    expect(r.lignes.map((l) => l.code)).toEqual(["split_froid", "cta", "vrv"]);
  });
});

describe("forfaits de déplacement : km × tarif + péage + heures × taux", () => {
  const reglages = BAREME_PAR_DEFAUT.reglages; // 0,60 €/km, 25 €/h

  it("Grenoble : 15 km × 0,60 + 0 + 1 h × 25 = 34 €", () => {
    expect(coutZone(zone("grenoble"), reglages)).toEqual({
      kilometrage: 9,
      peage: 0,
      tempsRoute: 25,
      total: 34,
    });
  });

  it("Chambéry : 150 × 0,60 + 14 + 1,5 × 25 = 141,50 € ; Lyon : 150 + 22 + 75 = 247 €", () => {
    expect(coutZone(zone("chambery"), reglages).total).toBe(141.5);
    expect(coutZone(zone("lyon"), reglages).total).toBe(247);
  });

  it("les réglages sont paramétrables : tarif au km et taux horaire changés → forfait recalculé", () => {
    expect(coutZone(zone("grenoble"), { tarif_km: 0.5, taux_horaire: 30 }).total).toBe(37.5);
    expect(coutZone(zone("lyon"), { tarif_km: 0, taux_horaire: 0 }).total).toBe(22);
  });

  it("arrondi au centime", () => {
    expect(coutZone({ ...zone("grenoble"), distance_km: 33.3 }, { tarif_km: 0.333, taux_horaire: 0 }).total).toBe(11.09);
  });
});

describe("total général = équipements + déplacement", () => {
  it("l'exemple : 3 splits réversibles + 2 unités intérieures + zone Grenoble", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { split_reversible: 3, ui_multi_reversible: 2 },
      zoneCode: "grenoble",
    });
    expect(r.lignes.map((l) => l.total)).toEqual([438, 34]);
    expect(r.sousTotalEquipements).toBe(472);
    expect(r.deplacement?.detail.total).toBe(34);
    expect(r.total).toBe(506);
  });

  it("zone inconnue ou désactivée → pas de déplacement", () => {
    expect(
      calculerEntretien(BAREME_PAR_DEFAUT, { quantites: { pac: 1 }, zoneCode: "mars" }).deplacement,
    ).toBeNull();
    const bareme: BaremeEntretien = {
      ...BAREME_PAR_DEFAUT,
      zones: BAREME_PAR_DEFAUT.zones.map((z) => ({ ...z, actif: false })),
    };
    expect(calculerEntretien(bareme, { quantites: { pac: 1 }, zoneCode: "lyon" }).total).toBe(120);
  });

  it("sélection vide → total 0, aucune ligne", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, { quantites: {}, zoneCode: null });
    expect(r.lignes).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("le total est EXACTEMENT la somme des lignes et du déplacement — rien d'autre n'est ajouté", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { split_reversible: 6, split_froid: 1, cta: 2, filtre_g4: 4, pac: 5, vmc_double: 1, vrv: 2, ui_vrv_froid: 8 },
      zoneCode: "lyon",
    });
    const somme = r.lignes.reduce((s, l) => s + l.total, 0) + (r.deplacement?.detail.total ?? 0);
    expect(r.total).toBe(Math.round(somme * 100) / 100);
    // Contrôle chiffré indépendant : 630 + 126 + 790 + 180 + 500 + 128 + 570 + 72 + 247
    expect(r.total).toBe(3243);
  });
});

describe("AUCUNE TVA : franchise en base", () => {
  it("le module ne contient ni « TVA » ni coefficient 1,10 / 1,20", () => {
    const source = readFileSync(join(__dirname, "bareme-entretien.ts"), "utf8")
      // Retire les commentaires : le mot y apparaît pour dire qu'il n'y en a pas.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/\btva\b/i);
    expect(source).not.toMatch(/\b1\.(1|2|05|055)\b/);
  });

  it("un devis entier à partir du barème : le total des lignes est le total du calcul, sans majoration", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { split_reversible: 3, ui_multi_reversible: 2 },
      zoneCode: "grenoble",
    });
    const lignes = lignesDocumentDepuisCalcul(r);
    const totalLignes = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire_ht, 0);
    expect(totalLignes).toBe(506);
    expect(totalLignes).toBe(r.total);
  });
});

describe("lignesDocumentDepuisCalcul : vers l'éditeur de devis", () => {
  it("une ligne par poste + une ligne de déplacement, libellés explicites", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { split_reversible: 3, ui_multi_reversible: 2 },
      zoneCode: "grenoble",
    });
    expect(lignesDocumentDepuisCalcul(r)).toEqual([
      {
        designation: "Entretien annuel — Split réversible / PAC air-air",
        quantite: 3,
        prix_unitaire_ht: 146,
        prix_achat_ttc_unitaire: null,
        fournisseur: "",
        nature_fiscale: "bic_prestations",
        type: "ligne",
      },
      expect.objectContaining({
        designation: "Entretien annuel — Unité intérieure supplémentaire (multi) — réversible",
        quantite: 2,
        prix_unitaire_ht: 17,
      }),
      expect.objectContaining({
        designation: "Déplacement — zone Grenoble et agglomération",
        quantite: 1,
        prix_unitaire_ht: 34,
      }),
    ]);
  });

  it("sans zone : pas de ligne de déplacement", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, { quantites: { pac: 1 }, zoneCode: null });
    expect(lignesDocumentDepuisCalcul(r)).toHaveLength(1);
  });
});

describe("equipementsContratDepuisCalcul : « Installation couverte »", () => {
  it("une ligne par UNITÉ, les filtres exclus, le reste à compléter", () => {
    const r = calculerEntretien(BAREME_PAR_DEFAUT, {
      quantites: { split_reversible: 2, filtre_g4: 3, cta: 1 },
      zoneCode: "lyon",
    });
    const eq = equipementsContratDepuisCalcul(r);
    expect(eq.map((e) => e.type)).toEqual([
      "Split réversible / PAC air-air",
      "Split réversible / PAC air-air",
      "Centrale de traitement d'air (CTA)",
    ]);
    expect(eq[0]).toEqual({ type: "Split réversible / PAC air-air", marque_modele: "", num_serie: "", puissance_kw: "", fluide_charge: "" });
  });
});

describe("normaliserTranches / libelleTranche (réglages)", () => {
  it("accepte des tranches saisies dans le désordre et les trie", () => {
    const r = normaliserTranches([{ a_partir_de: "6", prix: "105" }, { a_partir_de: 1, prix: 189 }, { a_partir_de: 2, prix: "146,00" as unknown as number }]);
    // « 146,00 » n'est pas un nombre JS : refusé — les réglages passent par parseMoneyInput avant.
    expect(r.ok).toBe(false);
    const r2 = normaliserTranches([{ a_partir_de: "6", prix: "105" }, { a_partir_de: 1, prix: 189 }, { a_partir_de: 2, prix: 146 }]);
    expect(r2).toEqual({ ok: true, valeur: [{ a_partir_de: 1, prix: 189 }, { a_partir_de: 2, prix: 146 }, { a_partir_de: 6, prix: 105 }] });
  });

  it("refuse : vide, seuil non entier ou < 1, prix négatif, doublon de seuil, pas de tranche à 1", () => {
    expect(normaliserTranches([]).ok).toBe(false);
    expect(normaliserTranches([{ a_partir_de: 1.5, prix: 10 }]).ok).toBe(false);
    expect(normaliserTranches([{ a_partir_de: 0, prix: 10 }]).ok).toBe(false);
    expect(normaliserTranches([{ a_partir_de: 1, prix: -1 }]).ok).toBe(false);
    expect(normaliserTranches([{ a_partir_de: 1, prix: 10 }, { a_partir_de: 1, prix: 9 }]).ok).toBe(false);
    expect(normaliserTranches([{ a_partir_de: 2, prix: 10 }]).ok).toBe(false);
  });

  it("libellés : « 1 », « 2 à 5 », « 6 et plus » ; tranche unique → « par unité »", () => {
    const split = poste("split_reversible").tranches;
    expect([0, 1, 2].map((i) => libelleTranche(split, i))).toEqual(["1", "2 à 5", "6 et plus"]);
    expect(libelleTranche(poste("ui_multi_froid").tranches, 0)).toBe("par unité");
    expect([0, 1].map((i) => libelleTranche(poste("vrv").tranches, i))).toEqual(["1", "2 et plus"]);
  });
});
