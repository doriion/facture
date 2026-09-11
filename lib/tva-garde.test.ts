import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assujettiTvaEffectif,
  documentEmis,
  estErreurMoteurTva,
  explicationMoteurTva,
  MESSAGE_MOTEUR_TVA,
  MoteurTvaNonImplementeError,
  verifierMoteurTva,
} from "./tva-garde";
import type { Database } from "@/types/database";

type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

function profil(assujetti: boolean): Profil {
  return { assujetti_tva: assujetti, siret: "12345678901234" } as Profil;
}

describe("assujettiTvaEffectif", () => {
  it("profil absent → false", () => {
    expect(assujettiTvaEffectif(null, null)).toBe(false);
  });

  it("brouillon (pas de snapshot) → suit le profil courant", () => {
    expect(assujettiTvaEffectif(profil(false), null)).toBe(false);
    expect(assujettiTvaEffectif(profil(true), null)).toBe(true);
  });

  it("document émis : le snapshot fait autorité, même si le profil a changé", () => {
    // Émis assujetti, profil repassé en franchise → reste assujetti
    expect(
      assujettiTvaEffectif(profil(false), { assujetti_tva: true }),
    ).toBe(true);
    // Émis en franchise, profil basculé assujetti → reste en franchise
    expect(
      assujettiTvaEffectif(profil(true), { assujetti_tva: false }),
    ).toBe(false);
  });

  it("snapshot antérieur au réglage (champ absent) → false, jamais le profil courant", () => {
    expect(assujettiTvaEffectif(profil(true), { siret: "x" })).toBe(false);
  });

  it("snapshot invalide (non objet) → retombe sur le profil", () => {
    expect(assujettiTvaEffectif(profil(true), "n'importe quoi")).toBe(true);
    expect(assujettiTvaEffectif(profil(false), 42)).toBe(false);
  });
});

describe("verifierMoteurTva", () => {
  it("ne lève pas en franchise en base (cas nominal)", () => {
    expect(() => verifierMoteurTva(null, null)).not.toThrow();
    expect(() => verifierMoteurTva(profil(false), null)).not.toThrow();
    expect(() =>
      verifierMoteurTva(profil(true), { assujetti_tva: false }),
    ).not.toThrow();
  });

  it("lève « Moteur TVA non implémenté » pour un document assujetti", () => {
    expect(() => verifierMoteurTva(profil(true), null)).toThrow(
      MESSAGE_MOTEUR_TVA,
    );
    expect(() =>
      verifierMoteurTva(profil(false), { assujetti_tva: true }),
    ).toThrow(MoteurTvaNonImplementeError);
  });

  it("l'erreur est identifiable et porte une explication utilisateur", () => {
    let erreur: unknown;
    try {
      verifierMoteurTva(profil(true), null);
    } catch (e) {
      erreur = e;
    }
    expect(estErreurMoteurTva(erreur)).toBe(true);
    expect(estErreurMoteurTva(new Error(MESSAGE_MOTEUR_TVA))).toBe(false);
    expect((erreur as MoteurTvaNonImplementeError).message).toBe(
      MESSAGE_MOTEUR_TVA,
    );
    expect((erreur as MoteurTvaNonImplementeError).explication).toContain(
      MESSAGE_MOTEUR_TVA,
    );
  });
});

describe("explicationMoteurTva", () => {
  it("brouillon : conseille de décocher le réglage", () => {
    const texte = explicationMoteurTva(false);
    expect(texte).toContain("brouillon");
    expect(texte).toContain("décochez");
  });

  it("document émis : ne promet PAS que décocher débloquera ce document", () => {
    const texte = explicationMoteurTva(true);
    expect(texte).toContain("figées");
    expect(texte).toContain("ne débloquera pas celui-ci");
  });

  it("l'erreur choisit le message selon la présence du snapshot", () => {
    expect(
      new MoteurTvaNonImplementeError({ assujetti_tva: true }).explication,
    ).toBe(explicationMoteurTva(true));
    expect(new MoteurTvaNonImplementeError(null).explication).toBe(
      explicationMoteurTva(false),
    );
  });

  it("documentEmis ne retient que les snapshots exploitables", () => {
    expect(documentEmis({ siret: "x" })).toBe(true);
    expect(documentEmis(null)).toBe(false);
    expect(documentEmis(undefined)).toBe(false);
    expect(documentEmis("texte")).toBe(false);
  });
});

/**
 * GARDE-FOU STATIQUE : chaque point de rendu d'un PDF client (routes de
 * téléchargement, envois par email) DOIT appeler verifierMoteurTva
 * avant de rendre. Sans ça un document assujetti sortirait sans TVA.
 */
describe("garde-fou : tous les rendus PDF client passent par verifierMoteurTva", () => {
  const RACINE = join(__dirname, "..");
  const POINTS_DE_RENDU = [
    "app/api/devis/[id]/pdf/route.ts",
    "app/api/factures/[id]/pdf/route.ts",
    "lib/actions/emails.ts",
  ];

  it.each(POINTS_DE_RENDU)("%s appelle verifierMoteurTva(", (fichier) => {
    const contenu = readFileSync(join(RACINE, fichier), "utf8");
    const rendus = (contenu.match(/\b(DevisPdf|FacturePdf)\(/g) ?? []).length;
    const gardes = (contenu.match(/\bverifierMoteurTva\(/g) ?? []).length;
    expect(rendus).toBeGreaterThan(0);
    // Autant de gardes que de rendus : un rendu ajouté sans garde casse ici
    expect(gardes).toBe(rendus);
  });
});
