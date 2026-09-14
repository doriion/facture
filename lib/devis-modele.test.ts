import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  coordonneesEmetteur,
  enseigneEmetteur,
  joursDeValidite,
  ligneePiedDePage,
  MODELE_DEVIS_HISTORIQUE,
  MODELE_DEVIS_SIMPLE,
  versionModeleDevis,
} from "./devis-modele";

describe("versionModeleDevis (les devis déjà émis ne bougent pas)", () => {
  it("NULL, undefined ou valeur inconnue → modèle historique", () => {
    for (const v of [null, undefined, 0, 1, "1", 3, "zzz", NaN]) {
      expect(versionModeleDevis(v)).toBe(MODELE_DEVIS_HISTORIQUE);
    }
  });

  it("2 (nombre ou texte) → modèle simple", () => {
    expect(versionModeleDevis(2)).toBe(MODELE_DEVIS_SIMPLE);
    expect(versionModeleDevis("2")).toBe(MODELE_DEVIS_SIMPLE);
  });
});

describe("enseigneEmetteur", () => {
  it("ajoute la mention EI au nom et prénom", () => {
    expect(enseigneEmetteur({ prenom: "Nathan", nom: "Geneve" })).toBe(
      "Nathan Geneve EI",
    );
  });

  it("le nom commercial prime", () => {
    expect(
      enseigneEmetteur({
        prenom: "Nathan",
        nom: "Geneve",
        nom_commercial: "Alpes Clim",
      }),
    ).toBe("Alpes Clim EI");
  });

  it("ne double jamais la mention déjà présente", () => {
    expect(enseigneEmetteur({ nom_commercial: "Alpes Clim EI" })).toBe(
      "Alpes Clim EI",
    );
    expect(enseigneEmetteur({ nom_commercial: "EI Dupont" })).toBe("EI Dupont");
  });

  it("profil vide → repli neutre", () => {
    expect(enseigneEmetteur(null)).toBe("Auto-entrepreneur EI");
    expect(enseigneEmetteur({})).toBe("Auto-entrepreneur EI");
  });
});

describe("coordonneesEmetteur", () => {
  it("une entrée par ligne, dans l'ordre", () => {
    expect(
      coordonneesEmetteur({
        adresse_ligne1: "12 rue des Alpes",
        code_postal: "38000",
        ville: "Grenoble",
        telephone: "06 12 34 56 78",
        email_pro: "contact@exemple.fr",
      }),
    ).toEqual([
      "12 rue des Alpes",
      "38000 Grenoble",
      "06 12 34 56 78",
      "contact@exemple.fr",
    ]);
  });

  it("omet les champs vides plutôt que d'imprimer des lignes blanches", () => {
    expect(coordonneesEmetteur({ ville: "Grenoble" })).toEqual(["Grenoble"]);
    expect(coordonneesEmetteur({ adresse_ligne1: "   " })).toEqual([]);
    expect(coordonneesEmetteur(null)).toEqual([]);
  });
});

describe("ligneePiedDePage", () => {
  it("SIRET et assurance sur une seule ligne", () => {
    expect(
      ligneePiedDePage({
        siret: "12345678901234",
        num_assurance_decennale: "DEC-7781",
        assureur_decennale: "ERGO France",
      }),
    ).toBe(
      "SIRET 123 456 789 01234 — Assurance décennale ERGO France n° DEC-7781",
    );
  });

  it("se réduit quand une partie manque, sans rien inventer", () => {
    expect(ligneePiedDePage({ siret: "12345678901234" })).toBe(
      "SIRET 123 456 789 01234",
    );
    expect(ligneePiedDePage({ num_assurance_decennale: "DEC-7781" })).toBe(
      "Assurance décennale n° DEC-7781",
    );
    expect(ligneePiedDePage(null)).toBe("");
    expect(ligneePiedDePage({})).toBe("");
  });

  it("tient sur une seule ligne (aucun retour chariot)", () => {
    const ligne = ligneePiedDePage({
      siret: "12345678901234",
      num_assurance_decennale: "DEC-7781",
      assureur_decennale: "ERGO France",
    });
    expect(ligne).not.toContain("\n");
  });
});

describe("joursDeValidite", () => {
  it("compte les jours entre émission et validité", () => {
    expect(joursDeValidite("2026-09-14", "2026-10-14")).toBe(30);
    expect(joursDeValidite("2026-12-15", "2027-01-14")).toBe(30);
  });

  it("null si une date manque, est invalide, ou si l'écart est nul ou négatif", () => {
    expect(joursDeValidite(null, "2026-10-14")).toBeNull();
    expect(joursDeValidite("2026-09-14", null)).toBeNull();
    expect(joursDeValidite("pas une date", "2026-10-14")).toBeNull();
    expect(joursDeValidite("2026-10-14", "2026-10-14")).toBeNull();
    expect(joursDeValidite("2026-10-14", "2026-09-14")).toBeNull();
  });
});

/**
 * GARDE-FOU STATIQUE : la séparation entre modèle historique et modèle
 * simple est ce qui garantit qu'un devis déjà émis se réimprime à
 * l'identique. Ces contrôles cassent si quelqu'un la court-circuite.
 */
describe("garde-fou : aiguillage et contenu du modèle simple", () => {
  const RACINE = join(__dirname, "..");
  const routeur = readFileSync(
    join(RACINE, "components/devis/devis-pdf.tsx"),
    "utf8",
  );
  const simple = readFileSync(
    join(RACINE, "components/devis/devis-pdf-simple.tsx"),
    "utf8",
  );

  it("le modèle d'origine existe toujours, sous le nom DevisPdfHistorique", () => {
    expect(routeur).toContain("export function DevisPdfHistorique(");
  });

  it("DevisPdf aiguille sur la version figée du devis", () => {
    expect(routeur).toContain("versionModeleDevis(");
    expect(routeur).toContain("pdf_template_version");
    expect(routeur).toContain("DevisPdfSimple(props)");
    expect(routeur).toContain("DevisPdfHistorique(props)");
  });

  it("les points d'entrée appellent DevisPdf, jamais un modèle directement", () => {
    for (const fichier of [
      "app/api/devis/[id]/pdf/route.ts",
      "lib/actions/emails.ts",
    ]) {
      const contenu = readFileSync(join(RACINE, fichier), "utf8");
      expect(contenu).toContain("DevisPdf(");
      expect(contenu).not.toContain("DevisPdfSimple(");
      expect(contenu).not.toContain("DevisPdfHistorique(");
    }
  });

  it("aucune mention de TVA écrite en dur dans le modèle simple", () => {
    expect(simple).toContain("mentionTvaFranchise(");
    expect(simple).not.toContain("293 B");
    expect(simple).not.toContain("223-3");
  });

  it("le modèle simple ne réintroduit aucune section écartée", () => {
    for (const interdit of [
      "Conditions de l'offre",
      "Gestion des déchets",
      "Acompte",
      "Assurances et qualifications",
    ]) {
      expect(simple).not.toContain(interdit);
    }
  });
});
