import { describe, expect, it } from "vitest";

import {
  chercherPrestations,
  indexSuivant,
  ligneAbsenteDuCatalogue,
  ligneDepuisPrestation,
  MAX_SUGGESTIONS,
  MIN_CARACTERES_SUGGESTION,
  normaliser,
  scorePrestation,
  type PrestationCatalogue,
} from "./catalogue-recherche";

const p = (
  id: string,
  designation: string,
  extra: Partial<PrestationCatalogue> = {},
): PrestationCatalogue => ({
  id,
  designation,
  prix_ht: 100,
  actif: true,
  ...extra,
});

const CATALOGUE: PrestationCatalogue[] = [
  p("1", "Pose de chaudière gaz à condensation", { prix_ht: 680 }),
  p("2", "Chaudière gaz Viessmann Vitodens 100-W", {
    prix_ht: 2450,
    prix_achat_ttc: 1830,
    fournisseur: "Yukai",
  }),
  p("3", "Dépose et évacuation ancienne chaudière", { prix_ht: 320 }),
  p("4", "Main d'œuvre plomberie", { prix_ht: 48, unite: "heure" }),
  p("5", "Désembouage du circuit de chauffage", { prix_ht: 450 }),
  p("6", "Remplacement robinet thermostatique", { prix_ht: 42 }),
  p("7", "Ancien modèle archivé", { actif: false }),
];

describe("normaliser", () => {
  it("efface casse, accents et ponctuation", () => {
    expect(normaliser("Dépose ÉVACUATION, n°2")).toBe("depose evacuation n 2");
  });

  it("décompose la ligature œ, que NFD laisse intacte", () => {
    expect(normaliser("Main d'œuvre")).toBe("main d'oeuvre");
    expect(normaliser("cœur")).toBe("coeur");
    expect(normaliser("æquo")).toBe("aequo");
  });

  it("ramène l'apostrophe typographique à celle du clavier", () => {
    expect(normaliser("Main d’œuvre")).toBe(normaliser("Main d'oeuvre"));
  });

  it("tolère une chaîne vide ou uniquement ponctuée", () => {
    expect(normaliser("")).toBe("");
    expect(normaliser("  —  ")).toBe("");
  });
});

describe("scorePrestation : le classement suit l'évidence", () => {
  it("0 quand la désignation commence par la saisie", () => {
    expect(scorePrestation(p("x", "Pose de chaudière"), "pose")).toBe(0);
  });

  it("1 quand un MOT commence par la saisie", () => {
    expect(scorePrestation(p("x", "Pose de chaudière"), "chau")).toBe(1);
  });

  it("2 quand c'est présent sans être en début de mot", () => {
    expect(scorePrestation(p("x", "Désembouage"), "bouage")).toBe(2);
  });

  it("trouve aussi dans la description", () => {
    const avecDesc = p("x", "Forfait entretien", {
      description: "Chaudière gaz murale",
    });
    expect(scorePrestation(avecDesc, "murale")).toBe(2);
  });

  it("null quand rien ne correspond", () => {
    expect(scorePrestation(p("x", "Pose de chaudière"), "zzz")).toBeNull();
  });

  it("saisie vide → null, jamais un score", () => {
    expect(scorePrestation(p("x", "Pose"), "")).toBeNull();
    expect(scorePrestation(p("x", "Pose"), "   ")).toBeNull();
  });

  it("plusieurs mots : chacun doit amorcer un mot de la désignation", () => {
    // « pose chaud » doit trouver « Pose DE chaudière » : une simple
    // recherche de sous-chaîne échouerait sur le « de » intercalé.
    expect(scorePrestation(p("x", "Pose de chaudière gaz"), "pose chaud")).toBe(
      1,
    );
    expect(scorePrestation(p("x", "Pose de chaudière gaz"), "pose zzz")).toBeNull();
  });
});

describe("chercherPrestations", () => {
  it("ne propose rien sous le seuil de caractères", () => {
    expect(chercherPrestations(CATALOGUE, "")).toEqual([]);
    expect(chercherPrestations(CATALOGUE, "c")).toEqual([]);
    expect(MIN_CARACTERES_SUGGESTION).toBe(2);
  });

  it("propose dès le seuil atteint", () => {
    expect(chercherPrestations(CATALOGUE, "ch").length).toBeGreaterThan(0);
  });

  it("classe le début de désignation avant le début de mot", () => {
    const r = chercherPrestations(CATALOGUE, "chaud");
    expect(r[0].designation).toBe("Chaudière gaz Viessmann Vitodens 100-W");
  });

  it("écarte les prestations archivées", () => {
    const r = chercherPrestations(CATALOGUE, "ancien");
    expect(r.map((x) => x.id)).not.toContain("7");
    expect(r.map((x) => x.id)).toContain("3");
  });

  it("trouve « main d'oeuvre » tapé sans ligature ni accent", () => {
    expect(chercherPrestations(CATALOGUE, "oeuvre").map((x) => x.id)).toEqual([
      "4",
    ]);
    expect(chercherPrestations(CATALOGUE, "main d'oeuvre").map((x) => x.id)).toEqual(
      ["4"],
    );
  });

  it("plafonne la liste et respecte une limite explicite", () => {
    const gros = Array.from({ length: 40 }, (_, i) =>
      p(`g${i}`, `Pose numéro ${i}`),
    );
    expect(chercherPrestations(gros, "pose").length).toBe(MAX_SUGGESTIONS);
    expect(chercherPrestations(gros, "pose", { limite: 3 }).length).toBe(3);
  });

  it("à score égal, ordre alphabétique français", () => {
    const acc = [p("a", "Élagage"), p("b", "Emballage"), p("c", "Étanchéité")];
    // Tous en score 0 sur « e » … mais « e » est sous le seuil : on
    // interroge avec deux lettres communes via la description.
    const r = chercherPrestations(
      [
        p("a", "Zébrure", { description: "commun" }),
        p("b", "Abattage", { description: "commun" }),
      ],
      "commun",
    );
    expect(r.map((x) => x.designation)).toEqual(["Abattage", "Zébrure"]);
    expect(acc.length).toBe(3);
  });

  it("catalogue vide → aucune proposition, aucune erreur", () => {
    expect(chercherPrestations([], "chaudiere")).toEqual([]);
  });
});

describe("indexSuivant : navigation au clavier", () => {
  it("la première flèche choisit toujours un élément", () => {
    expect(indexSuivant(-1, 5, 1)).toBe(0);
    expect(indexSuivant(-1, 5, -1)).toBe(4);
  });

  it("avance, recule, et boucle aux deux extrémités", () => {
    expect(indexSuivant(0, 3, 1)).toBe(1);
    expect(indexSuivant(2, 3, 1)).toBe(0);
    expect(indexSuivant(0, 3, -1)).toBe(2);
  });

  it("liste vide → rien de sélectionnable", () => {
    expect(indexSuivant(-1, 0, 1)).toBe(-1);
    expect(indexSuivant(2, 0, -1)).toBe(-1);
  });
});

describe("ligneDepuisPrestation", () => {
  it("reprend prix, prix d'achat, fournisseur et nature", () => {
    expect(ligneDepuisPrestation(CATALOGUE[1])).toEqual({
      designation: "Chaudière gaz Viessmann Vitodens 100-W",
      prix_unitaire_ht: 2450,
      prix_achat_ttc_unitaire: 1830,
      fournisseur: "Yukai",
      nature_fiscale: "bic_prestations",
    });
  });

  it("colle la description à la désignation, comme le catalogue", () => {
    const r = ligneDepuisPrestation(
      p("x", "Forfait entretien", { description: "Chaudière gaz murale" }),
    );
    expect(r.designation).toBe("Forfait entretien — Chaudière gaz murale");
  });

  it("sans prix d'achat, la ligne reste à null (pas 0)", () => {
    // 0 signifierait « acheté gratuitement » et fausserait la marge ;
    // null signifie « inconnu » et exclut la ligne du calcul.
    expect(ligneDepuisPrestation(p("x", "A")).prix_achat_ttc_unitaire).toBeNull();
    expect(
      ligneDepuisPrestation(p("x", "A", { prix_achat_ttc: "" }))
        .prix_achat_ttc_unitaire,
    ).toBeNull();
  });

  it("prix illisible → 0 plutôt qu'un NaN qui casserait le total", () => {
    expect(
      ligneDepuisPrestation(p("x", "A", { prix_ht: "n/a" })).prix_unitaire_ht,
    ).toBe(0);
  });

  it("ne renvoie aucune quantité : celle du chantier est conservée", () => {
    expect(ligneDepuisPrestation(CATALOGUE[0])).not.toHaveProperty("quantite");
  });
});

describe("ligneAbsenteDuCatalogue : quand proposer l'ajout", () => {
  it("oui pour une désignation inconnue", () => {
    expect(
      ligneAbsenteDuCatalogue({ designation: "Pose d'un adoucisseur" }, CATALOGUE),
    ).toBe(true);
  });

  it("non si elle y est déjà, casse et accents ignorés", () => {
    expect(
      ligneAbsenteDuCatalogue({ designation: "main d'oeuvre plomberie" }, CATALOGUE),
    ).toBe(false);
    expect(
      ligneAbsenteDuCatalogue({ designation: "MAIN D'ŒUVRE PLOMBERIE" }, CATALOGUE),
    ).toBe(false);
  });

  it("non pour la forme « désignation — description » déjà connue", () => {
    const cat = [p("x", "Forfait", { description: "Chaudière gaz" })];
    expect(
      ligneAbsenteDuCatalogue({ designation: "Forfait — Chaudière gaz" }, cat),
    ).toBe(false);
  });

  it("non pour une ligne vide ou un titre de section", () => {
    expect(ligneAbsenteDuCatalogue({ designation: "" }, CATALOGUE)).toBe(false);
    expect(ligneAbsenteDuCatalogue({ designation: "   " }, CATALOGUE)).toBe(false);
    expect(
      ligneAbsenteDuCatalogue({ designation: "MATÉRIEL", type: "titre" }, CATALOGUE),
    ).toBe(false);
  });
});
