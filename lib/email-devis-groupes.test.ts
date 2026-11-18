import { describe, expect, it } from "vitest";

import { buildDocumentEmail, listeNumeros } from "./email";

/**
 * Plusieurs devis du même client dans un seul e-mail : chacun est
 * nommé avec son montant, chaque devis non signé a son lien de
 * signature, un devis déjà signé est joint sans lien.
 */
describe("e-mail de plusieurs devis", () => {
  const email = buildDocumentEmail({
    type: "devis",
    numero: "D-2026-0040",
    clientNom: "M. Dupont",
    expediteurNom: "Nathan Geneve EI",
    totalText: "1 200,00 €",
    dateText: "18/11/2026",
    validiteText: "18/12/2026",
    natureActivite: "plomberie",
    lienSignature: "https://app.test/d/jeton-40",
    acompteText: "360,00 € (30 %)",
    autresDevis: [
      { numero: "D-2026-0041", totalText: "1 850,00 €", lienSignature: "https://app.test/d/jeton-41", validiteText: "18/12/2026" },
      { numero: "D-2026-0038", totalText: "300,00 €", lienSignature: null, signeLe: "02/11/2026" },
    ],
  });

  it("l'objet et le titre nomment tous les devis", () => {
    expect(email.subject).toBe("Vos devis D-2026-0040, D-2026-0041 et D-2026-0038 — Nathan Geneve EI");
    expect(email.html).toContain("Devis D-2026-0040, D-2026-0041 et D-2026-0038");
  });

  it("chaque devis figure dans l'encadré avec son montant", () => {
    for (const [numero, total] of [
      ["D-2026-0040", "1 200,00 €"],
      ["D-2026-0041", "1 850,00 €"],
      ["D-2026-0038", "300,00 €"],
    ]) {
      expect(email.text).toContain(`Devis ${numero}`);
      expect(email.text).toContain(total!);
    }
    expect(email.text).toContain("Devis D-2026-0038 (signé le 02/11/2026)");
  });

  it("un lien de signature par devis non signé, aucun pour le devis signé", () => {
    expect(email.text).toContain("Lire et signer le devis D-2026-0040 en ligne : https://app.test/d/jeton-40");
    expect(email.text).toContain("Signer le devis D-2026-0041 en ligne : https://app.test/d/jeton-41");
    expect(email.html).toContain('href="https://app.test/d/jeton-41"');
    expect(email.text).not.toContain("Signer le devis D-2026-0038");
    expect(email.text).toContain("vous pouvez n'en retenir qu'un");
  });

  it("l'intro dit combien de devis sont joints et pour quoi", () => {
    expect(email.text).toContain("voici vos 3 devis pour les travaux de plomberie");
    expect(email.text).toContain("valables jusqu'au 18/12/2026");
  });

  it("validités différentes : rappelées devis par devis, pas de phrase commune", () => {
    const e = buildDocumentEmail({
      type: "devis", numero: "D-1", clientNom: "X", expediteurNom: "N", totalText: "10,00 €", validiteText: "01/12/2026",
      autresDevis: [{ numero: "D-2", totalText: "20,00 €", validiteText: "15/12/2026" }],
    });
    expect(e.text).not.toContain("Ils sont valables");
    expect(e.text).toContain("Devis D-1 (valable jusqu'au 01/12/2026) : 10,00 €");
    expect(e.text).toContain("Devis D-2 (valable jusqu'au 15/12/2026) : 20,00 €");
  });

  it("sans autre devis, l'e-mail d'un seul devis est inchangé", () => {
    const seul = buildDocumentEmail({ type: "devis", numero: "D-1", clientNom: "X", expediteurNom: "N", totalText: "10,00 €", autresDevis: [] });
    expect(seul.subject).toBe("Votre devis D-1 — N");
  });

  it("listeNumeros", () => {
    expect(listeNumeros([])).toBe("");
    expect(listeNumeros(["A"])).toBe("A");
    expect(listeNumeros(["A", "B"])).toBe("A et B");
    expect(listeNumeros(["A", "B", "C"])).toBe("A, B et C");
  });
});
