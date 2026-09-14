import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TEMPLATE_CONTRAT_V1 } from "./template-v1";
import { TEMPLATE_CONTRAT_V2 } from "./template-v2";
import { remplirTexte } from "./logic";
import { dateReferenceContrat, mentionTvaContrat } from "./rendu";
import {
  MENTION_TVA_FRANCHISE_CGI,
  MENTION_TVA_FRANCHISE_CIBS,
  mentionTvaFranchise,
} from "@/lib/legal-text";
import type { BlocContrat } from "./types";

const textesDe = (blocs: BlocContrat[]) =>
  blocs.map((b) => ("texte" in b ? b.texte : `[${b.kind}]`));

/**
 * La v2 est dérivée de la v1. Ce fichier est la preuve que la
 * dérivation ne change QUE ce qu'elle prétend changer : un contrat
 * d'entretien est un document juridique, une divergence silencieuse y
 * serait invisible en revue.
 */
describe("template v2 : dérivé de la v1, une seule différence", () => {
  it("même structure : mêmes articles, mêmes titres, mêmes blocs", () => {
    expect(TEMPLATE_CONTRAT_V2.articles.length).toBe(
      TEMPLATE_CONTRAT_V1.articles.length,
    );
    expect(TEMPLATE_CONTRAT_V2.articles.map((a) => a.numero)).toEqual(
      TEMPLATE_CONTRAT_V1.articles.map((a) => a.numero),
    );
    expect(TEMPLATE_CONTRAT_V2.articles.map((a) => a.titre)).toEqual(
      TEMPLATE_CONTRAT_V1.articles.map((a) => a.titre),
    );
    expect(TEMPLATE_CONTRAT_V2.titre).toBe(TEMPLATE_CONTRAT_V1.titre);
    expect(TEMPLATE_CONTRAT_V2.sousTitre).toBe(TEMPLATE_CONTRAT_V1.sousTitre);
    expect(TEMPLATE_CONTRAT_V2.preambule).toBe(TEMPLATE_CONTRAT_V1.preambule);
  });

  it("l'annexe est reprise à l'identique", () => {
    expect(TEMPLATE_CONTRAT_V2.annexe).toEqual(TEMPLATE_CONTRAT_V1.annexe);
  });

  it("les conditions d'affichage sont inchangées, bloc par bloc", () => {
    for (let i = 0; i < TEMPLATE_CONTRAT_V1.articles.length; i++) {
      expect(
        TEMPLATE_CONTRAT_V2.articles[i].blocs.map((b) => b.visible),
      ).toEqual(TEMPLATE_CONTRAT_V1.articles[i].blocs.map((b) => b.visible));
    }
  });

  it("EXACTEMENT un bloc de texte diffère, et c'est celui de la TVA", () => {
    const differences: string[] = [];
    for (let i = 0; i < TEMPLATE_CONTRAT_V1.articles.length; i++) {
      const avant = textesDe(TEMPLATE_CONTRAT_V1.articles[i].blocs);
      const apres = textesDe(TEMPLATE_CONTRAT_V2.articles[i].blocs);
      expect(apres.length).toBe(avant.length);
      for (let j = 0; j < avant.length; j++) {
        if (avant[j] !== apres[j]) differences.push(apres[j]);
      }
    }
    expect(differences).toEqual([
      "{mentionTvaFranchise}. Le prestataire relève du régime de la franchise en base de TVA : les montants indiqués sont nets de taxe et aucune TVA ne peut être récupérée par le client.",
    ]);
  });

  it("les listes à puces ne bougent pas", () => {
    for (let i = 0; i < TEMPLATE_CONTRAT_V1.articles.length; i++) {
      const items = (blocs: BlocContrat[]) =>
        blocs.filter((b) => b.kind === "li").map((b) => b.items);
      expect(items(TEMPLATE_CONTRAT_V2.articles[i].blocs)).toEqual(
        items(TEMPLATE_CONTRAT_V1.articles[i].blocs),
      );
    }
  });

  it("le numéro de version est le seul champ de tête modifié", () => {
    expect(TEMPLATE_CONTRAT_V1.version).toBe(1);
    expect(TEMPLATE_CONTRAT_V2.version).toBe(2);
  });
});

describe("template v2 : la mention rendue suit la date du contrat", () => {
  const paragraphe = TEMPLATE_CONTRAT_V2.articles
    .find((a) => a.numero === 6)!
    .blocs.map((b) => ("texte" in b ? b.texte : ""))
    .find((t) => t.includes("{mentionTvaFranchise}"))!;

  it("contrat récent → rédaction CIBS", () => {
    const rendu = remplirTexte(paragraphe, {
      mentionTvaFranchise: mentionTvaFranchise("2026-09-14"),
    });
    expect(rendu).toContain(MENTION_TVA_FRANCHISE_CIBS);
    expect(rendu).toContain("L. 223-3");
    expect(rendu).not.toContain("293 B");
    // La phrase d'explication qui suit est conservée mot pour mot.
    expect(rendu).toContain(
      "Le prestataire relève du régime de la franchise en base de TVA",
    );
  });

  it("contrat antérieur à la bascule → ancienne rédaction conservée", () => {
    const rendu = remplirTexte(paragraphe, {
      mentionTvaFranchise: mentionTvaFranchise("2026-05-11"),
    });
    expect(rendu).toContain(MENTION_TVA_FRANCHISE_CGI);
    expect(rendu).not.toContain("L. 223-3");
  });

  it("la ponctuation reste correcte : une seule phrase, un seul point", () => {
    const rendu = remplirTexte(paragraphe, {
      mentionTvaFranchise: mentionTvaFranchise("2026-09-14"),
    });
    expect(rendu).toContain("(CIBS). Le prestataire");
    expect(rendu).not.toContain("..");
    expect(rendu).not.toContain("……");
  });
});

describe("mentionTvaContrat : la version prime sur la date", () => {
  it("v1 → ancienne rédaction, même signé après la bascule", () => {
    // Un contrat v1 porte l'ancienne rédaction dans son article 6.1,
    // qui est figé. Le pied de page doit dire la même chose, sinon le
    // document se contredit d'une page à l'autre.
    expect(
      mentionTvaContrat({
        template_version: 1,
        signed_at: "2026-09-10T14:22:00Z",
      }),
    ).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(
      mentionTvaContrat({
        template_version: 1,
        signed_at: "2026-05-11T14:22:00Z",
      }),
    ).toBe(MENTION_TVA_FRANCHISE_CGI);
  });

  it("v2 → rédaction choisie d'après la date du contrat", () => {
    expect(
      mentionTvaContrat({
        template_version: 2,
        signed_at: "2026-09-14T10:00:00Z",
      }),
    ).toBe(MENTION_TVA_FRANCHISE_CIBS);
    expect(
      mentionTvaContrat({
        template_version: 2,
        signed_at: "2026-05-11T10:00:00Z",
      }),
    ).toBe(MENTION_TVA_FRANCHISE_CGI);
  });

  it("la signature prime sur l'envoi ; sans les deux, c'est un brouillon", () => {
    expect(
      dateReferenceContrat({
        signed_at: "2026-09-14T10:00:00Z",
        sent_at: "2026-08-20T10:00:00Z",
      }),
    ).toBe("2026-09-14");
    expect(
      dateReferenceContrat({ signed_at: null, sent_at: "2026-08-20T10:00:00Z" }),
    ).toBe("2026-08-20");
    expect(dateReferenceContrat({ signed_at: null, sent_at: null })).toBeNull();
  });
});

/**
 * GARDE-FOU STATIQUE : plus aucune mention de TVA écrite en dur dans
 * le module contrats, hors la v1 qui est figée par construction.
 */
describe("garde-fou : aucune mention de TVA en dur dans les contrats", () => {
  const RACINE = join(__dirname, "..", "..");
  const FICHIERS = [
    "components/contrats/contrat-pdf.tsx",
    "components/contrats/contrat-apercu.tsx",
    "components/contrats/contrat-entretien-form.tsx",
    "app/c/[token]/page.tsx",
    "lib/contrats/template-v2.ts",
  ];

  for (const fichier of FICHIERS) {
    it(`${fichier} ne contient pas « 293 B » ni « L. 223-3 »`, () => {
      const contenu = readFileSync(join(RACINE, fichier), "utf8");
      // On ne juge que le code EXÉCUTÉ. Les commentaires ont le droit
      // de citer les deux rédactions pour s'expliquer, et la v2 cite
      // en plus le paragraphe de la v1 comme repère de substitution.
      const code = contenu
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/const PARAGRAPHE_TVA_V1 =[\s\S]*?;\n/, "");
      expect(code).not.toContain("art. 293 B");
      expect(code).not.toContain("article 293 B");
      expect(code).not.toContain("L. 223-3");
    });
  }

  it("la v1 n'est jamais réécrite : elle garde son texte d'origine", () => {
    const v1 = readFileSync(join(RACINE, "lib/contrats/template-v1.ts"), "utf8");
    expect(v1).toContain("TVA non applicable, article 293 B du code général");
    expect(v1).not.toContain("{mentionTvaFranchise}");
  });
});
