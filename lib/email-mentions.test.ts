import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildAvisChatelEmail, buildConfirmationVisiteEmail, buildDocumentEmail, buildPropositionVisiteEmail, buildRappelVeilleEmail } from "./email";
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
    acompteText: "30,00 € (30 %)",
    signature: { nom: "Nathan Geneve EI", telephone: "0612345678", email: "x@gmail.com", adresse: "12 rue des Alpes, 38000 Grenoble", siret: "123 456 789 01234" },
  });

  it("signature : téléphone par paires et cliquable (lien tel:)", () => {
    expect(mail.text).toContain("Tél. 06 12 34 56 78");
    expect(mail.html).toContain('<a href="tel:+33612345678"');
    expect(mail.html).toContain(">06 12 34 56 78</a>");
    // Le libellé de la date d'émission ne se confond plus avec l'intervention.
    expect(mail.text).toContain("Émis le : 02/10/2026");
    expect(mail.text).not.toContain("Date : ");
  });

  it("échappe le HTML venant des données et garde les retours à la ligne", () => {
    expect(mail.html).toContain("M. &lt;b&gt;Test&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Test</b>");
    expect(mail.html).toContain("voila le devis<br/>à bientôt");
  });

  it("résumé, signature complète et versions HTML / texte cohérentes", () => {
    for (const attendu of ["D-2026-0026", "100,00 €", "01/11/2026", "06 12 34 56 78", "x@gmail.com", "SIRET 123 456 789 01234", "bon pour accord"]) {
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

  it("devis : l'acompte n'est mentionné que s'il y en a un", () => {
    expect(mail.text).toContain(
      "accompagné de l'acompte de 30,00 € (30 %) par virement, les coordonnées bancaires figurent sur le devis",
    );
    expect(mail.text).toContain("Acompte à la commande : 30,00 € (30 %)");

    const sansAcompte = buildDocumentEmail({
      type: "devis",
      numero: "D-2026-0027",
      clientNom: "M. Durand",
      expediteurNom: "Nathan Geneve EI",
      totalText: "100,00 €",
      natureActivite: "entretien",
    });
    expect(sansAcompte.text.toLowerCase()).not.toContain("acompte");
    expect(sansAcompte.text).toContain("un retour signé avec la mention « bon pour accord » suffit, ou répondez simplement à ce message");

    const signe = buildDocumentEmail({
      type: "devis",
      numero: "D-2026-0028",
      clientNom: "Mme Martin",
      expediteurNom: "Nathan Geneve EI",
      totalText: "1 250,00 €",
      signeLe: "02/10/2026",
      acompteText: "375,00 € (30 %)",
      natureActivite: "installation_pac",
    });
    expect(signe.text).toContain("L'acompte de 375,00 € (30 %) est à régler par virement");
    expect(signe.text).toContain("Acompte à la commande : 375,00 € (30 %)");
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
      "Voici votre facture F-2026-0051 pour le dépannage, suite à mon intervention du 25/09/2026 au 28/09/2026.",
    );
    expect(facture.text).not.toContain("Comme convenu");
    expect(facture.text).toContain("Émise le : 02/10/2026");
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
    expect(sansDates.text).toContain("Voici votre facture F-2026-0052 pour les travaux dont nous avons parlé. Vous la trouverez en pièce jointe.");
    expect(sansDates.text).toContain("Elle est à régler par virement : les coordonnées bancaires figurent sur la facture.");
    expect(sansDates.text).not.toContain("suite à mon intervention");
  });
});

describe("e-mail de confirmation de visite d'entretien", () => {
  it("date, heure et adresse convenues ; sans heure, « dans la journée »", () => {
    const avecHeure = buildConfirmationVisiteEmail({
      clientNom: "M. Clément",
      expediteurNom: "Nathan Geneve EI",
      objetEntretien: "PAC air/eau Daikin Altherma",
      dateVisiteLongue: "Mardi 15 octobre 2026",
      dateVisiteCourte: "15/10/2026",
      heureText: "9 h 30",
      adresse: "12 rue des Alpes, 38000 Grenoble",
    });
    expect(avecHeure.subject).toBe("Visite d'entretien le 15/10/2026 à 9 h 30 — Nathan Geneve EI");
    expect(avecHeure.text).toContain("Comme convenu, je passerai le mardi 15 octobre 2026 à 9 h 30 pour la visite d'entretien de votre installation.");
    expect(avecHeure.text).toContain("Adresse : 12 rue des Alpes, 38000 Grenoble");
    expect(avecHeure.text).toContain("Heure : 9 h 30");
    expect(avecHeure.html).toContain("PAC air/eau Daikin Altherma");

    const sansHeure = buildConfirmationVisiteEmail({
      clientNom: "Mme Martin",
      expediteurNom: "Nathan Geneve EI",
      objetEntretien: "Chaudière gaz",
      dateVisiteLongue: "Jeudi 17 octobre 2026",
      dateVisiteCourte: "17/10/2026",
    });
    expect(sansHeure.subject).toBe("Visite d'entretien le 17/10/2026 — Nathan Geneve EI");
    expect(sansHeure.text).toContain("le jeudi 17 octobre 2026 dans la journée pour la visite");
    expect(sansHeure.text).toContain("Heure : dans la journée");
    expect(sansHeure.text).not.toContain("Adresse :");
  });
});

describe("e-mail de proposition de visite", () => {
  it("créneau proposé, lien de réponse, autres créneaux annoncés", () => {
    const mail = buildPropositionVisiteEmail({
      clientNom: "M. Clément",
      expediteurNom: "Nathan Geneve EI",
      objetEntretien: "PAC air/eau Daikin Altherma",
      creneauText: "Mardi 20 octobre 2026, le matin (8 h – 12 h)",
      nbAutres: 4,
      lien: "https://facture-green.vercel.app/visite/abcdef0123456789",
      expireLeText: "20/11/2026",
    });
    expect(mail.subject).toBe("Visite d'entretien : Mardi 20 octobre 2026, le matin (8 h – 12 h) — Nathan Geneve EI");
    expect(mail.text).toContain("Je vous propose de passer le mardi 20 octobre 2026, le matin (8 h – 12 h).");
    expect(mail.text).toContain("4 autres proposés");
    expect(mail.text).toContain("https://facture-green.vercel.app/visite/abcdef0123456789");
    expect(mail.html).toContain('href="https://facture-green.vercel.app/visite/abcdef0123456789"');
    expect(mail.text).toContain("Lien valable jusqu'au 20/11/2026");
  });
  it("confirmation d'un créneau choisi en ligne : la plage remplace l'heure", () => {
    const mail = buildConfirmationVisiteEmail({
      clientNom: "M. Clément",
      expediteurNom: "Nathan Geneve EI",
      objetEntretien: "PAC",
      dateVisiteLongue: "Mardi 20 octobre 2026",
      dateVisiteCourte: "20/10/2026",
      plageText: "le matin (8 h – 12 h)",
    });
    expect(mail.subject).toBe("Visite d'entretien le 20/10/2026, le matin (8 h – 12 h) — Nathan Geneve EI");
    expect(mail.text).toContain("je passerai le mardi 20 octobre 2026, le matin (8 h – 12 h), pour la visite");
    expect(mail.text).toContain("Heure : Le matin (8 h – 12 h)");
  });
});

describe("relance et rappel de la veille", () => {
  it("relance : objet préfixé, intro de rappel, même lien", () => {
    const mail = buildPropositionVisiteEmail({
      clientNom: "M. Clément", expediteurNom: "Nathan Geneve EI", objetEntretien: "PAC",
      creneauText: "Mardi 20 octobre 2026, le matin (8 h – 12 h)", nbAutres: 2,
      lien: "https://facture-green.vercel.app/visite/abcdef0123456789", expireLeText: "20/11/2026", relance: true,
    });
    expect(mail.subject.startsWith("Rappel — Visite d'entretien")).toBe(true);
    expect(mail.text).toContain("Petit rappel : je vous ai proposé de passer le mardi 20 octobre 2026");
    expect(mail.text).toContain("/visite/abcdef0123456789");
  });
  it("veille : « à demain », plage et téléphone formaté", () => {
    const mail = buildRappelVeilleEmail({
      clientNom: "M. Clément", expediteurNom: "Nathan Geneve EI", objetEntretien: "PAC",
      dateVisiteLongue: "Mardi 20 octobre 2026", plageText: "le matin (8 h – 12 h)", telephone: "0647214864",
    });
    expect(mail.subject).toBe("À demain pour la visite d'entretien, le matin (8 h – 12 h) — Nathan Geneve EI");
    expect(mail.text).toContain("Je passe demain, le matin (8 h – 12 h), pour la visite d'entretien");
    expect(mail.text).toContain("appelez-moi au 06 47 21 48 64");
  });
});

describe("e-mail de devis avec lien de signature en ligne", () => {
  it("bouton vers la page publique et conclusion adaptée ; rien sans lien", () => {
    const avec = buildDocumentEmail({
      type: "devis", numero: "D-2026-0030", clientNom: "M. Clément", expediteurNom: "Nathan Geneve EI",
      totalText: "1 250,00 €", validiteText: "20/11/2026", natureActivite: "installation_pac", acompteText: "375,00 € (30 %)",
      lienSignature: "https://facture-green.vercel.app/d/jeton-0123456789abcdef",
    });
    expect(avec.html).toContain('href="https://facture-green.vercel.app/d/jeton-0123456789abcdef"');
    expect(avec.html).toContain("Lire et signer le devis en ligne");
    expect(avec.text).toContain("signez-le en ligne en un geste depuis votre téléphone");
    expect(avec.text).toContain("acompte de 375,00 € (30 %)");
    const sans = buildDocumentEmail({ type: "devis", numero: "D-2026-0031", clientNom: "M. X", expediteurNom: "N", totalText: "1,00 €", natureActivite: "autre" });
    expect(sans.html).not.toContain("/d/");
    expect(sans.text).toContain("un retour signé avec la mention « bon pour accord » suffit");
  });
});
