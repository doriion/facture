import { describe, expect, it } from "vitest";

import { buildFicheGazEmail, buildFicheSigneeArtisanEmail, buildSignatureFicheEmail } from "./email";

describe("e-mails des fiches gaz", () => {
  it("envoi des documents : objet, pièces jointes annoncées, mention de conservation", () => {
    const m = buildFicheGazEmail({
      clientNom: "Julien Clément",
      expediteurNom: "Nathan Geneve",
      dateText: "30/10/2026",
      ficheNumero: "261030",
      equipementText: "Climatisation Daikin — repère UE1",
      signature: { nom: "Nathan Geneve", telephone: "0647214864" },
    });
    expect(m.subject).toBe("Fiche d'intervention fluide frigorigène n° 261030 — 30/10/2026");
    expect(m.text).toContain("Bonjour Julien Clément,");
    expect(m.text).toContain("CERFA 15497");
    expect(m.text).toContain("bon de réception");
    expect(m.text).toContain("cinq ans");
    expect(m.text).toContain("Climatisation Daikin — repère UE1");
    expect(m.html).toContain("06 47 21 48 64");
  });

  it("invitation à signer : bouton vers le lien, validité indiquée", () => {
    const m = buildSignatureFicheEmail({
      clientNom: "Julien Clément",
      expediteurNom: "Nathan Geneve",
      dateText: "30/10/2026",
      ficheNumero: null,
      equipementText: null,
      lien: "https://facture-green.vercel.app/f/abc",
      expireLeText: "29/11/2026",
    });
    expect(m.subject).toBe("À signer : fiche d'intervention du 30/10/2026");
    expect(m.html).toContain('href="https://facture-green.vercel.app/f/abc"');
    expect(m.html).toContain("Lire et signer la fiche");
    expect(m.text).toContain("https://facture-green.vercel.app/f/abc");
    expect(m.text).toContain("jusqu'au 29/11/2026");
    expect(m.text).not.toContain("Fiche n°");
  });

  it("copie artisan : signataire, réserves, lien vers la fiche", () => {
    const m = buildFicheSigneeArtisanEmail({
      clientNom: "Julien Clément",
      signataireNom: "J. Clément",
      dateSignatureText: "30 octobre 2026 à 18:05",
      ficheNumero: "261030",
      reservesText: "Avec réserves : grille à refixer",
      lienFiche: "https://facture-green.vercel.app/fiches-gaz/xyz",
    });
    expect(m.subject).toBe("Fiche gaz n° 261030 signée en ligne par J. Clément");
    expect(m.text).toContain("Avec réserves : grille à refixer");
    expect(m.html).toContain("https://facture-green.vercel.app/fiches-gaz/xyz");
  });
});
