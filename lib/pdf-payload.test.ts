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
 * /api/public/**) ne doit référencer les colonnes de coût privées.
 * Les tables de lignes elles-mêmes restent autorisées : une future
 * page publique de devis DOIT pouvoir afficher désignation / qté /
 * P.U. / total — seuls les coûts sont interdits.
 */
describe("garde-fou : pas de coûts privés dans les surfaces publiques", () => {
  const RACINE = join(__dirname, "..");
  const DOSSIERS_PUBLICS = ["app/c", "app/api/public"];
  const MOTIFS_INTERDITS = [/prix_achat/i, /\bfournisseur\b/i];

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

  it("app/c/** et app/api/public/** ne mentionnent ni prix_achat ni fournisseur", () => {
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
});
