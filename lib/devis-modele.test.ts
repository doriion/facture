import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  coordonneesEmetteur,
  enseigneEmetteur,
  joursDeValidite,
  ligneAcompte,
  ligneePiedDePage,
  mentionsReglementairesDevis,
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

describe("mentionsReglementairesDevis", () => {
  const profil = {
    num_attestation_fluides_frigo: "FF-2024-001",
    num_rge_qualipac: "QPAC-42",
    num_rm: "123 456 789 RM 38",
    mediateur_nom: "CM2C",
    mediateur_site_web: "https://cm2c.net",
  };

  it("clim/PAC pour un particulier : fluides, RGE, RM et médiateur", () => {
    const ligne = mentionsReglementairesDevis(profil, {
      typeActivite: "installation_pac",
      typeClient: "particulier",
    });
    expect(ligne).toContain("fluides frigorigènes catégorie I n° FF-2024-001");
    expect(ligne).toContain("RGE QualiPAC n° QPAC-42");
    expect(ligne).toContain("Répertoire des Métiers — n° 123 456 789 RM 38");
    expect(ligne).toContain("Médiateur de la consommation : CM2C — https://cm2c.net");
  });

  it("plomberie pour un professionnel : ni fluides, ni RGE, ni médiateur", () => {
    expect(
      mentionsReglementairesDevis(profil, {
        typeActivite: "plomberie",
        typeClient: "professionnel",
      }),
    ).toBe("Inscrit au Répertoire des Métiers — n° 123 456 789 RM 38.");
  });

  it("profil vide : rien d'inventé", () => {
    expect(
      mentionsReglementairesDevis(null, {
        typeActivite: "installation_clim",
        typeClient: "particulier",
      }),
    ).toBe("");
    expect(mentionsReglementairesDevis({}, {})).toBe("");
  });
});

describe("ligneePiedDePage", () => {
  it("SIRET, APE, qualité et décennale complète sur une ligne", () => {
    expect(
      ligneePiedDePage({
        siret: "12345678901234",
        code_ape: "4322B",
        num_assurance_decennale: "DEC-7781",
        assureur_decennale: "ERGO France",
        assureur_decennale_adresse: "Paris",
        zone_couverture_decennale: "Isère",
      }),
    ).toBe(
      "SIRET 123 456 789 01234 — APE 4322B — Auto-entrepreneur — Entreprise individuelle — Assurance décennale n° DEC-7781 souscrite auprès de ERGO France (Paris), couvrant le territoire : Isère",
    );
  });

  it("se réduit quand une partie manque, sans rien inventer (ni zone)", () => {
    expect(ligneePiedDePage({ siret: "12345678901234" })).toBe(
      "SIRET 123 456 789 01234 — Auto-entrepreneur — Entreprise individuelle",
    );
    expect(ligneePiedDePage({ num_assurance_decennale: "DEC-7781" })).toBe(
      "Auto-entrepreneur — Entreprise individuelle — Assurance décennale n° DEC-7781",
    );
    expect(
      ligneePiedDePage({ num_assurance_decennale: "DEC-7781", assureur_decennale: "ERGO" }),
    ).not.toMatch(/territoire/);
  });

  it("décennale expirée à la date du document : non imprimée", () => {
    expect(
      ligneePiedDePage(
        {
          num_assurance_decennale: "DEC-7781",
          assureur_decennale: "ERGO",
          decennale_valide_jusquau: "2026-01-01",
        },
        "2026-09-19",
      ),
    ).toBe("Auto-entrepreneur — Entreprise individuelle");
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

describe("ligneAcompte", () => {
  it("pourcentage : montant, solde et pourcentage du solde", () => {
    expect(ligneAcompte(4500, 40, null)).toBe(
      "Acompte 40 % à la commande : 1 800,00 € — solde 60 % : 2 700,00 € à la fin des travaux",
    );
  });

  it("montant fixe : aucun pourcentage affiché", () => {
    expect(ligneAcompte(1000, null, 250)).toBe(
      "Acompte à la commande : 250,00 € — solde : 750,00 € à la fin des travaux",
    );
  });

  it("le pourcentage prime sur le montant fixe", () => {
    expect(ligneAcompte(1000, 30, 900)).toContain("300,00 €");
  });

  it("rien à afficher sans acompte, ou sur un total nul", () => {
    expect(ligneAcompte(1000, null, null)).toBeNull();
    expect(ligneAcompte(1000, 0, 0)).toBeNull();
    expect(ligneAcompte(0, 40, null)).toBeNull();
    expect(ligneAcompte(-10, 40, null)).toBeNull();
  });

  it("arrondit au centime et ne produit jamais de solde négatif", () => {
    expect(ligneAcompte(1234.57, 40, null)).toContain("493,83 €");
    expect(ligneAcompte(1234.57, 40, null)).toContain("740,74 €");
    const borne = ligneAcompte(500, null, 900)!;
    expect(borne).toContain("500,00 €");
    expect(borne).toContain("0,00 €");
    expect(borne).not.toContain("-");
  });

  it("gère un pourcentage décimal des deux côtés", () => {
    const l = ligneAcompte(1000, 33.5, null)!;
    expect(l).toContain("33,5 %");
    expect(l).toContain("66,5 %");
  });

  it("tient sur une seule ligne", () => {
    expect(ligneAcompte(4500, 40, null)).not.toContain("\n");
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

  it("la ligne d'acompte passe par le helper, jamais recalculée dans le JSX", () => {
    expect(simple).toContain("ligneAcompte(");
    expect(simple).not.toContain("/ 100");
  });

  it("aucune mention de TVA écrite en dur dans le modèle simple", () => {
    expect(simple).toContain("mentionTvaFranchise(");
    expect(simple).not.toContain("293 B");
    expect(simple).not.toContain("223-3");
  });

  it("le modèle simple ne réintroduit aucune section écartée", () => {
    // « Acompte » n'est PAS interdit : la ligne d'acompte est demandée.
    for (const interdit of [
      "Conditions de l'offre",
      "Gestion des déchets",
      "Assurances et qualifications",
    ]) {
      expect(simple).not.toContain(interdit);
    }
  });
});
