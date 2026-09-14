import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  acompteDevis,
  blocsAssurance,
  CLAUSE_MATERIEL_DISPO,
  CLAUSE_TRAVAUX_SUPPLEMENTAIRES,
  conditionsOffre,
  estLigneMainDoeuvreVide,
  lignesPourRendu,
  MODELE_DEVIS_V1,
  MODELE_DEVIS_V2,
  nettoyerDesignation,
  versionModeleDevis,
} from "./devis-v2";

describe("versionModeleDevis (les devis émis restent en v1)", () => {
  it("NULL, undefined ou valeur inconnue → v1", () => {
    for (const v of [null, undefined, 0, 1, "1", 3, "zzz", NaN]) {
      expect(versionModeleDevis(v)).toBe(MODELE_DEVIS_V1);
    }
  });

  it("2 (nombre ou texte) → v2", () => {
    expect(versionModeleDevis(2)).toBe(MODELE_DEVIS_V2);
    expect(versionModeleDevis("2")).toBe(MODELE_DEVIS_V2);
  });
});

describe("estLigneMainDoeuvreVide", () => {
  const ligne = (over = {}) => ({
    designation: "Main d'œuvre",
    quantite: 1,
    prix_unitaire_ht: 0,
    total_ht: 0,
    type: "ligne",
    ...over,
  });

  it("retire la main-d'œuvre à 0 €, accents et apostrophes comprises", () => {
    expect(estLigneMainDoeuvreVide(ligne())).toBe(true);
    expect(
      estLigneMainDoeuvreVide(ligne({ designation: "MAIN D'OEUVRE" })),
    ).toBe(true);
    expect(
      estLigneMainDoeuvreVide(ligne({ designation: "Main d'oeuvre incluse" })),
    ).toBe(true);
  });

  it("garde une main-d'œuvre facturée", () => {
    expect(
      estLigneMainDoeuvreVide(
        ligne({ prix_unitaire_ht: 350, total_ht: 350 }),
      ),
    ).toBe(false);
  });

  it("ne touche ni aux titres de section ni aux autres lignes à 0 €", () => {
    expect(
      estLigneMainDoeuvreVide(
        ligne({ designation: "MAIN D'ŒUVRE", type: "titre" }),
      ),
    ).toBe(false);
    expect(
      estLigneMainDoeuvreVide(ligne({ designation: "Remise commerciale" })),
    ).toBe(false);
  });
});

describe("nettoyerDesignation", () => {
  it("retire le préfixe quand il répète la quantité", () => {
    expect(nettoyerDesignation("2x Split mural", 2)).toBe("Split mural");
    expect(nettoyerDesignation("2 x Split mural", 2)).toBe("Split mural");
    expect(nettoyerDesignation("3X Console", 3)).toBe("Console");
  });

  it("garde le préfixe s'il ne correspond pas à la quantité", () => {
    expect(nettoyerDesignation("2x 5 m", 3)).toBe("2x 5 m");
    expect(nettoyerDesignation("2x Split", 1)).toBe("2x Split");
  });

  it("laisse intactes les désignations sans préfixe", () => {
    expect(nettoyerDesignation("Split mural 2,5 kW", 2)).toBe(
      "Split mural 2,5 kW",
    );
    expect(nettoyerDesignation("Liaison 2x1,5 mm²", 1)).toBe(
      "Liaison 2x1,5 mm²",
    );
  });
});

describe("lignesPourRendu", () => {
  it("combine filtrage et nettoyage sans toucher aux titres", () => {
    const rendu = lignesPourRendu([
      { designation: "FOURNITURES", quantite: 1, prix_unitaire_ht: 0, total_ht: 0, type: "titre" },
      { designation: "2x Split mural", quantite: 2, prix_unitaire_ht: 600, total_ht: 1200, type: "ligne" },
      { designation: "Main d'œuvre", quantite: 1, prix_unitaire_ht: 0, total_ht: 0, type: "ligne" },
    ]);
    expect(rendu.map((l) => l.designation)).toEqual([
      "FOURNITURES",
      "Split mural",
    ]);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const source = [
      { designation: "2x Split", quantite: 2, prix_unitaire_ht: 10, total_ht: 20, type: "ligne" },
    ];
    lignesPourRendu(source);
    expect(source[0].designation).toBe("2x Split");
  });
});

describe("acompteDevis", () => {
  it("calcule montant, solde et phrase depuis un pourcentage", () => {
    const a = acompteDevis(4500, 40, null);
    expect(a).toMatchObject({ montant: 1800, solde: 2700, pct: 40 });
    expect(a?.phrase).toContain("Acompte 40 %");
    expect(a?.phrase).toContain("solde");
  });

  it("accepte un montant fixe (sans pourcentage affiché)", () => {
    const a = acompteDevis(1000, null, 250);
    expect(a).toMatchObject({ montant: 250, solde: 750, pct: null });
    expect(a?.phrase).not.toContain("%");
  });

  it("le pourcentage prime sur le montant fixe", () => {
    expect(acompteDevis(1000, 30, 900)?.montant).toBe(300);
  });

  it("arrondit au centime", () => {
    expect(acompteDevis(1234.57, 40, null)).toMatchObject({
      montant: 493.83,
      solde: 740.74,
    });
  });

  it("n'imprime jamais un solde négatif", () => {
    const a = acompteDevis(500, null, 900);
    expect(a?.montant).toBe(500);
    expect(a?.solde).toBe(0);
  });

  it("renvoie null sans acompte, ou sur un total nul", () => {
    expect(acompteDevis(1000, null, null)).toBeNull();
    expect(acompteDevis(1000, 0, 0)).toBeNull();
    expect(acompteDevis(0, 40, null)).toBeNull();
  });

  it("montant + solde redonne toujours le total", () => {
    for (const [total, pct] of [
      [4500, 40],
      [999.99, 33.3],
      [12345.67, 15],
    ] as const) {
      const a = acompteDevis(total, pct, null)!;
      expect(Math.round((a.montant + a.solde) * 100) / 100).toBe(total);
    }
  });
});

describe("conditionsOffre", () => {
  it("n'affiche que les entrées renseignées", () => {
    expect(conditionsOffre({})).toEqual([]);
    const c = conditionsOffre({
      delaiIntervention: "2 à 3 semaines après acceptation",
      dureeEstimeeJours: 2,
      fraisDeplacement: "Inclus dans un rayon de 30 km",
      validiteJours: 30,
    });
    expect(c.map((e) => e.label)).toEqual([
      "Délai d'intervention",
      "Durée estimée",
      "Frais de déplacement",
      "Validité de l'offre",
    ]);
    expect(c[1].valeur).toBe("2 jours");
  });

  it("accorde le singulier et ignore les valeurs vides ou nulles", () => {
    expect(
      conditionsOffre({ dureeEstimeeJours: 1 })[0].valeur,
    ).toBe("1 jour");
    expect(
      conditionsOffre({
        delaiIntervention: "   ",
        dureeEstimeeJours: 0,
        validiteJours: 0,
      }),
    ).toEqual([]);
  });

  it("formate la date de début quand un formateur est fourni", () => {
    const c = conditionsOffre({
      dateDebutTravaux: "2026-10-01",
      formatDate: () => "1 octobre 2026",
    });
    expect(c[0]).toEqual({ label: "Début prévu", valeur: "1 octobre 2026" });
  });

  it("les deux clauses fixes sont non vides", () => {
    expect(CLAUSE_MATERIEL_DISPO.length).toBeGreaterThan(20);
    expect(CLAUSE_TRAVAUX_SUPPLEMENTAIRES.length).toBeGreaterThan(20);
  });
});

describe("blocsAssurance", () => {
  it("profil vide ou sans numéro → aucun bloc", () => {
    expect(blocsAssurance(null)).toEqual([]);
    expect(blocsAssurance({})).toEqual([]);
  });

  it("décennale : assureur, police, adresse et couverture", () => {
    const [bloc] = blocsAssurance({
      num_assurance_decennale: "AB123",
      assureur_decennale: "ERGO France",
      assureur_decennale_adresse: "12 rue des Lilas, 75000 Paris",
      zone_couverture_decennale: "France métropolitaine",
    });
    expect(bloc.titre).toBe("Assurance décennale");
    expect(bloc.lignes[0]).toBe("ERGO France — police n° AB123");
    expect(bloc.lignes[1]).toContain("rue des Lilas");
    expect(bloc.lignes[2]).toBe("Couverture : France métropolitaine");
  });

  it("couverture par défaut si la zone n'est pas renseignée", () => {
    const [bloc] = blocsAssurance({ num_assurance_decennale: "AB123" });
    expect(bloc.lignes[0]).toBe("Police n° AB123");
    expect(bloc.lignes[1]).toBe("Couverture : France métropolitaine");
  });

  it("fluides et RGE apparaissent seulement s'ils existent", () => {
    const blocs = blocsAssurance({
      num_attestation_fluides_frigo: "F-2026-01",
      num_rge_qualipac: "RGE-99",
    });
    expect(blocs.map((b) => b.titre)).toEqual([
      "Attestation de capacité fluides frigorigènes",
      "Qualification RGE QualiPAC",
    ]);
  });
});

/**
 * GARDE-FOU STATIQUE : la séparation v1 / v2 est ce qui garantit qu'un
 * devis déjà émis se réimprime à l'identique. Si quelqu'un supprime le
 * modèle v1 ou court-circuite l'aiguillage, ce test casse.
 */
describe("garde-fou : aiguillage des modèles de devis", () => {
  const RACINE = join(__dirname, "..");
  const source = readFileSync(
    join(RACINE, "components/devis/devis-pdf.tsx"),
    "utf8",
  );

  it("le modèle historique existe toujours sous le nom DevisPdfV1", () => {
    expect(source).toContain("export function DevisPdfV1(");
  });

  it("DevisPdf aiguille sur la version figée du devis", () => {
    expect(source).toContain("versionModeleDevis(");
    expect(source).toContain("pdf_template_version");
    expect(source).toMatch(/DevisPdfV2\(props\)\s*:\s*DevisPdfV1\(props\)/);
  });

  it("les points d'entrée appellent DevisPdf, jamais un modèle directement", () => {
    for (const fichier of [
      "app/api/devis/[id]/pdf/route.ts",
      "lib/actions/emails.ts",
    ]) {
      const contenu = readFileSync(join(RACINE, fichier), "utf8");
      expect(contenu).not.toContain("DevisPdfV1(");
      expect(contenu).not.toContain("DevisPdfV2(");
      expect(contenu).toContain("DevisPdf(");
    }
  });

  it("le modèle v2 n'écrit aucune mention de TVA en dur", () => {
    const v2 = readFileSync(
      join(RACINE, "components/devis/devis-pdf-v2.tsx"),
      "utf8",
    );
    expect(v2).toContain("mentionTvaFranchise(");
    expect(v2).not.toContain("293 B");
    expect(v2).not.toContain("223-3");
  });
});
