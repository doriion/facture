import { describe, expect, it } from "vitest";

import {
  blocsVisibles,
  echeanceInitiale,
  etatLienPublic,
  expirationToken,
  getTemplateContrat,
  netAPayer,
  remplirTexte,
  retractationApplicable,
  TEMPLATE_VERSION_COURANTE,
  type ContexteAffichage,
} from "./logic";

const PARTICULIER_DISTANCE: ContexteAffichage = {
  qualiteClient: "particulier",
  modeConclusion: "distance",
};
const PARTICULIER_PRESENTIEL: ContexteAffichage = {
  qualiteClient: "particulier",
  modeConclusion: "presentiel",
};
const PRO_DISTANCE: ContexteAffichage = {
  qualiteClient: "professionnel",
  modeConclusion: "distance",
};

describe("template versionné", () => {
  it("la version courante existe et porte 12 articles + annexe", () => {
    const t = getTemplateContrat(TEMPLATE_VERSION_COURANTE);
    expect(t.articles).toHaveLength(12);
    expect(t.articles.map((a) => a.numero)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(t.annexe.visible).toBe("retractation");
  });

  it("une version inconnue lève une erreur franche", () => {
    expect(() => getTemplateContrat(99)).toThrow("Version de contrat inconnue");
  });

  it("aucun calcul de TVA : le texte porte la mention 293 B", () => {
    const t = getTemplateContrat(1);
    const article6 = t.articles.find((a) => a.numero === 6)!;
    const textes = article6.blocs
      .map((b) => ("texte" in b ? b.texte : ""))
      .join(" ");
    expect(textes).toContain("TVA non applicable, article 293 B");
  });
});

describe("retractationApplicable", () => {
  it("particulier + à distance ou hors établissement → oui", () => {
    expect(retractationApplicable(PARTICULIER_DISTANCE)).toBe(true);
    expect(
      retractationApplicable({
        qualiteClient: "particulier",
        modeConclusion: "hors_etablissement",
      }),
    ).toBe(true);
  });

  it("présentiel ou professionnel → non", () => {
    expect(retractationApplicable(PARTICULIER_PRESENTIEL)).toBe(false);
    expect(retractationApplicable(PRO_DISTANCE)).toBe(false);
  });
});

describe("visibilité des sections (art. 7, 8, 12)", () => {
  const t = getTemplateContrat(1);
  const blocsDe = (numero: number, ctx: ContexteAffichage) =>
    blocsVisibles(t.articles.find((a) => a.numero === numero)!.blocs, ctx)
      .map((b) => ("texte" in b ? b.texte : ""))
      .join(" ");

  it("art. 7 : la clause loi Chatel (L. 215-1) n'apparaît que pour un particulier", () => {
    expect(blocsDe(7, PARTICULIER_DISTANCE)).toContain("L. 215-1");
    expect(blocsDe(7, PRO_DISTANCE)).not.toContain("L. 215-1");
  });

  it("art. 8 : rétractation complète si applicable, constat d'inapplicabilité sinon", () => {
    expect(blocsDe(8, PARTICULIER_DISTANCE)).toContain("quatorze (14) jours");
    const sansRetractation = blocsDe(8, PARTICULIER_PRESENTIEL);
    expect(sansRetractation).not.toContain("quatorze (14) jours");
    expect(sansRetractation).toContain("ne trouve pas à s'appliquer");
    expect(blocsDe(8, PRO_DISTANCE)).toContain("ne trouve pas à s'appliquer");
  });

  it("art. 12 : tribunal de commerce de Grenoble pour les pros, médiateur pour les particuliers", () => {
    expect(blocsDe(12, PRO_DISTANCE)).toContain(
      "tribunal de commerce de Grenoble",
    );
    expect(blocsDe(12, PRO_DISTANCE)).not.toContain("médiateur");
    expect(blocsDe(12, PARTICULIER_DISTANCE)).toContain("médiateur");
    expect(blocsDe(12, PARTICULIER_DISTANCE)).not.toContain(
      "tribunal de commerce",
    );
  });
});

describe("remplirTexte", () => {
  it("remplace les espaces réservés, pointillés si valeur absente", () => {
    expect(
      remplirTexte("n° {num} du {date}", { num: "2026-001", date: "" }),
    ).toBe("n° 2026-001 du ……");
    expect(remplirTexte("chez {inconnu}", {})).toBe("chez ……");
  });
});

describe("montants et échéance", () => {
  it("net à payer = redevance − remise, jamais négatif", () => {
    expect(netAPayer(220, 20)).toBe(200);
    expect(netAPayer(180.5, 0)).toBe(180.5);
    expect(netAPayer(100, 150)).toBe(0);
  });

  it("échéance initiale : un an après la date d'effet (29 février géré)", () => {
    expect(echeanceInitiale("2026-10-01")).toBe("2027-10-01");
    expect(echeanceInitiale("2028-02-29")).toBe("2029-03-01");
  });
});

describe("etatLienPublic", () => {
  const NOW = "2026-09-04T12:00:00.000Z";
  const base = {
    statut: "envoye",
    access_token: "tok",
    token_expires_at: "2026-09-20T00:00:00.000Z",
  };

  it("utilisable : envoyé, token présent, non expiré", () => {
    expect(etatLienPublic(base, NOW)).toBe("utilisable");
  });

  it("expiré après 30 jours ; révoqué si token retiré ou brouillon", () => {
    expect(
      etatLienPublic({ ...base, token_expires_at: "2026-09-01T00:00:00Z" }, NOW),
    ).toBe("expire");
    expect(etatLienPublic({ ...base, access_token: null }, NOW)).toBe(
      "revoque",
    );
    expect(etatLienPublic({ ...base, statut: "brouillon" }, NOW)).toBe(
      "revoque",
    );
  });

  it("déjà signé (ou actif/résilié/expiré) → confirmation seulement", () => {
    for (const statut of ["signe", "actif", "resilie", "expire"]) {
      expect(etatLienPublic({ ...base, statut }, NOW)).toBe("deja-signe");
    }
  });

  it("introuvable si aucun contrat", () => {
    expect(etatLienPublic(null, NOW)).toBe("introuvable");
  });

  it("expirationToken : 30 jours", () => {
    expect(expirationToken("2026-09-04T12:00:00.000Z")).toBe(
      "2026-10-04T12:00:00.000Z",
    );
  });
});
