import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { payloadLignesPdf } from "./pdf-payload";

const LIGNE_COMPLETE = {
  id: "l1",
  designation: "Remplacement ballon thermodynamique",
  quantite: 1,
  prix_unitaire_ht: 2400,
  total_ht: 2400,
  nature_fiscale: "bic_prestations",
  type: "ligne",
  ordre: 0,
  // Champs PRIVÉS — ne doivent jamais atteindre un document client
  prix_achat_ttc_unitaire: 1450,
  fournisseur: "Yukai",
  // Champs techniques
  user_id: "u1",
  facture_id: "f1",
  created_at: "2026-09-10T08:00:00Z",
};

describe("payloadLignesPdf (liste blanche du rendu client)", () => {
  it("ne laisse JAMAIS passer le prix d'achat ni le fournisseur", () => {
    const payload = payloadLignesPdf([LIGNE_COMPLETE]);
    const json = JSON.stringify(payload);
    expect(json).not.toContain("prix_achat");
    expect(json).not.toContain("fournisseur");
    expect(json).not.toContain("Yukai");
    expect(json).not.toContain("1450");
    // Et ne laisse pas non plus fuiter les champs techniques
    expect(json).not.toContain("user_id");
  });

  it("conserve exactement les champs destinés au client", () => {
    const [ligne] = payloadLignesPdf([LIGNE_COMPLETE]);
    expect(ligne).toEqual({
      id: "l1",
      designation: "Remplacement ballon thermodynamique",
      quantite: 1,
      prix_unitaire_ht: 2400,
      total_ht: 2400,
      nature_fiscale: "bic_prestations",
      type: "ligne",
      ordre: 0,
    });
  });
});

/**
 * GARDE-FOU STATIQUE : aucune surface publique (pages /c/**, routes
 * /api/public/**) ne doit référencer les colonnes de coût privées, ni
 * lire le catalogue (qui porte désormais les mêmes coûts).
 * Les tables de LIGNES elles-mêmes restent autorisées : une future
 * page publique de devis DOIT pouvoir afficher désignation / qté /
 * P.U. / total — seuls les coûts sont interdits.
 */
describe("garde-fou : pas de coûts privés dans les surfaces publiques", () => {
  const RACINE = join(__dirname, "..");
  const DOSSIERS_PUBLICS = ["app/c", "app/api/public"];
  const MOTIFS_INTERDITS = [
    /prix_achat/i,
    /\bfournisseur\b/i,
    // Le catalogue porte prix_achat_ttc : aucune surface publique n'a
    // de raison de le lire, ni directement ni via listProduits.
    /produits_services/i,
    /\blistProduits\b/,
  ];

  function fichiersDe(dossier: string): string[] {
    const resultat: string[] = [];
    const abs = join(RACINE, dossier);
    let entrees: string[];
    try {
      entrees = readdirSync(abs);
    } catch {
      return resultat; // le dossier peut ne pas exister
    }
    for (const nom of entrees) {
      const chemin = join(abs, nom);
      if (statSync(chemin).isDirectory()) {
        resultat.push(...fichiersDe(join(dossier, nom)));
      } else if (/\.(ts|tsx)$/.test(nom)) {
        resultat.push(join(dossier, nom));
      }
    }
    return resultat;
  }

  it("app/c/** et app/api/public/** ne mentionnent ni coût privé ni catalogue", () => {
    const fichiers = DOSSIERS_PUBLICS.flatMap(fichiersDe);
    expect(fichiers.length).toBeGreaterThan(0); // les surfaces existent
    const violations: string[] = [];
    for (const fichier of fichiers) {
      const contenu = readFileSync(join(RACINE, fichier), "utf8");
      for (const motif of MOTIFS_INTERDITS) {
        if (motif.test(contenu)) violations.push(`${fichier} → ${motif}`);
      }
    }
    expect(violations).toEqual([]);
  });

  /**
   * Deuxième garde-fou : tout rendu d'un document client doit passer
   * par la liste blanche. Un rendu qui recevrait les lignes brutes
   * embarquerait le prix d'achat et le fournisseur dans le PDF.
   */
  it("chaque rendu PDF client passe par payloadLignesPdf", () => {
    const POINTS_DE_RENDU = [
      "app/api/devis/[id]/pdf/route.ts",
      "app/api/factures/[id]/pdf/route.ts",
      "lib/actions/emails.ts",
    ];
    for (const fichier of POINTS_DE_RENDU) {
      const contenu = readFileSync(join(RACINE, fichier), "utf8");
      const rendus = (contenu.match(/\b(DevisPdf|FacturePdf)\(/g) ?? []).length;
      const listesBlanches = (contenu.match(/\bpayloadLignesPdf\(/g) ?? [])
        .length;
      expect(rendus, `${fichier} : aucun rendu trouvé`).toBeGreaterThan(0);
      expect(
        listesBlanches,
        `${fichier} : ${rendus} rendu(s) pour ${listesBlanches} liste(s) blanche(s)`,
      ).toBe(rendus);
    }
  });
});

/**
 * GARDE-FOU : le bloc de marges (matériel + réelle) est un outil de
 * pilotage pour l'artisan. Il n'a AUCUNE raison d'atteindre un document
 * client — ni le calcul, ni ses résultats. Aucun composant PDF ne doit
 * donc importer lib/marges ni manipuler une notion de marge ou de coût
 * d'achat.
 */
describe("garde-fou : aucune marge dans les rendus PDF", () => {
  const RACINE = join(__dirname, "..");
  const COMPOSANTS_PDF = [
    "components/devis/devis-pdf.tsx",
    "components/devis/devis-pdf-simple.tsx",
    "components/factures/facture-pdf.tsx",
    "components/contrats/contrat-pdf.tsx",
    "components/interventions/cerfa-pdf.tsx",
  ];
  const MOTIFS = [
    /@\/lib\/marges/,
    /\bmargeReelle\b/,
    /\btotauxMarges\b/,
    /\bmargeLigne\b/,
    /\bcoutTotal\b/,
    /\bcoutRenseigne\b/,
    /\bmarge\b/i,
  ];

  for (const fichier of COMPOSANTS_PDF) {
    it(`${fichier} ne connaît pas la marge`, () => {
      const code = readFileSync(join(RACINE, fichier), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const motif of MOTIFS) {
        expect(code, `${fichier} contient ${motif}`).not.toMatch(motif);
      }
    });
  }
});
