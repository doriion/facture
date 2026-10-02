import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildAvisChatelEmail, buildDocumentEmail } from "./email";
import { escapeHtml } from "./email-gabarit";
import {
  MENTION_TVA_FRANCHISE_CGI,
  MENTION_TVA_FRANCHISE_CIBS,
  mentionTvaFranchise,
} from "./legal-text";

/**
 * Les e-mails partent MAINTENANT : leur pied de page doit porter la
 * rédaction en vigueur au moment de l'envoi, pas celle figée dans le
 * code à l'écriture du gabarit.
 */
describe("mention de TVA dans les e-mails", () => {
  const avis = buildAvisChatelEmail({
    clientNom: "Mme Durand <test>",
    expediteurNom: "Nathan Geneve EI",
    numero: "2026-001",
    dateEcheanceText: "10 novembre 2026",
    dateLimiteText: "10 septembre 2026",
  });

  it("le rendu reprend la valeur centralisée, échappée en HTML, brute en texte", () => {
    expect(avis.html).toContain(escapeHtml(mentionTvaFranchise()));
    expect(avis.text).toContain(mentionTvaFranchise());
  });

  it("aucune rédaction n'est recopiée dans les fichiers d'e-mail", () => {
    for (const f of ["email.ts", "email-gabarit.ts"]) {
      const code = readFileSync(join(__dirname, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(code).not.toContain("293 B");
      expect(code).not.toContain("L. 223-3");
      expect(code).not.toContain("TVA non applicable");
    }
  });

  it("aujourd'hui, c'est la rédaction CIBS", () => {
    expect(mentionTvaFranchise()).toBe(MENTION_TVA_FRANCHISE_CIBS);
  });

  it("la fonction reste capable de rendre l'ancienne rédaction", () => {
    expect(mentionTvaFranchise("2026-05-11")).toBe(MENTION_TVA_FRANCHISE_CGI);
  });
});

describe("gabarit des e-mails de documents", () => {
  const mail = buildDocumentEmail({
    type: "devis",
    numero: "D-2026-0026",
    clientNom: "M. <b>Test</b>",
    expediteurNom: "Nathan Geneve EI",
    totalText: "100,00 €",
    validiteText: "01/11/2026",
    dateText: "02/10/2026",
    messagePerso: "voila le devis\nà bientôt",
    natureActivite: "plomberie",
    signature: { nom: "Nathan Geneve EI", telephone: "06 12 34 56 78", email: "x@gmail.com", adresse: "12 rue des Alpes, 38000 Grenoble", siret: "123 456 789 01234" },
  });

  it("échappe le HTML venant des données et garde les retours à la ligne", () => {
    expect(mail.html).toContain("M. &lt;b&gt;Test&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Test</b>");
    expect(mail.html).toContain("voila le devis<br/>à bientôt");
  });

  it("résumé, signature complète et versions HTML / texte cohérentes", () => {
    for (const attendu of ["D-2026-0026", "100,00 €", "01/11/2026", "Tél. 06 12 34 56 78", "x@gmail.com", "SIRET 123 456 789 01234", "bon pour accord"]) {
      expect(mail.html).toContain(escapeHtml(attendu));
      expect(mail.text).toContain(attendu);
    }
    expect(mail.subject).toBe("Votre devis D-2026-0026 — Nathan Geneve EI");
    // Ton direct : nature de la prestation et validité dans le texte, plus de « ci-joint ».
    expect(mail.text).toContain("Comme convenu, voici votre devis D-2026-0026 pour les travaux de plomberie");
    expect(mail.text).toContain("valable jusqu'au 01/11/2026");
    expect(mail.text).not.toContain("Veuillez trouver ci-joint");
    expect(mail.text).not.toMatch(/<(p|table|td|div|a)\b/);
  });

  it("facture : nature de la prestation, date d'intervention, virement et remerciement", () => {
    const facture = buildDocumentEmail({
      type: "facture",
      numero: "F-2026-0051",
      clientNom: "Mme Martin",
      expediteurNom: "Nathan Geneve EI",
      totalText: "640,00 €",
      dateText: "02/10/2026",
      echeanceText: "01/11/2026",
      natureActivite: "depannage",
      interventionText: "du 25/09/2026 au 28/09/2026",
    });
    expect(facture.subject).toBe("Votre facture F-2026-0051 — Nathan Geneve EI");
    expect(facture.text).toContain(
      "Comme convenu, voici votre facture F-2026-0051 pour le dépannage, suite à mon intervention du 25/09/2026 au 28/09/2026.",
    );
    expect(facture.text).toContain("à régler avant le 01/11/2026, par virement : les coordonnées bancaires figurent sur la facture");
    expect(facture.text).toContain("À régler avant le");
    expect(facture.text.trimEnd().includes("Merci pour votre confiance")).toBe(true);
    expect(facture.text).not.toContain("Veuillez trouver ci-joint");
    expect(facture.text).not.toContain("correspondant aux travaux réalisés");

    // Sans date d'intervention ni échéance : aucune information inventée.
    const sansDates = buildDocumentEmail({
      type: "facture",
      numero: "F-2026-0052",
      clientNom: "M. Durand",
      expediteurNom: "Nathan Geneve EI",
      totalText: "100,00 €",
      natureActivite: "autre",
    });
    expect(sansDates.text).toContain("voici votre facture F-2026-0052 pour les travaux dont nous avons parlé. Vous la trouverez en pièce jointe.");
    expect(sansDates.text).toContain("Elle est à régler par virement : les coordonnées bancaires figurent sur la facture.");
    expect(sansDates.text).not.toContain("suite à mon intervention");
  });
});
