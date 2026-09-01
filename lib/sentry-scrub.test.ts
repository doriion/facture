import { describe, expect, it } from "vitest";

import { masquerPII, nettoyerEvenementSentry } from "./sentry-scrub";

describe("masquerPII", () => {
  it("masque les emails", () => {
    expect(masquerPII("échec envoi à jean.dupont@exemple.fr : timeout")).toBe(
      "échec envoi à [email] : timeout",
    );
  });

  it("masque les montants en euros (formats FR variés)", () => {
    expect(masquerPII("relance facture de 1 234,56 € refusée")).toBe(
      "relance facture de [montant] refusée",
    );
    expect(masquerPII("total 40€")).toBe("total [montant]");
    expect(masquerPII("montant 1 350,00 € invalide")).toBe(
      "montant [montant] invalide",
    );
  });

  it("masque les téléphones FR et les IBAN", () => {
    expect(masquerPII("rappeler le 06 12 34 56 78")).toBe("rappeler le [tel]");
    expect(masquerPII("vers +33612345678 échoué")).toBe("vers [tel] échoué");
    expect(masquerPII("IBAN FR7630006000011234567890189 rejeté")).toBe(
      "IBAN [iban] rejeté",
    );
  });

  it("laisse intacts les messages techniques sans PII", () => {
    const msg = "TypeError: fetch failed (ECONNRESET) sur /api/cron/quotidien";
    expect(masquerPII(msg)).toBe(msg);
  });
});

describe("nettoyerEvenementSentry", () => {
  it("supprime user/request/breadcrumb data et masque les textes", () => {
    const event = nettoyerEvenementSentry({
      user: { email: "nathan@exemple.fr" },
      request: {
        url: "https://app.fr/factures/123?client=dupont@mail.fr",
      },
      message: "échec relance dupont@mail.fr pour 500,00 €",
      breadcrumbs: [
        { message: "clic sur envoyer à dupont@mail.fr", data: { secret: 1 } },
      ],
      exception: {
        values: [{ value: "Resend a refusé dupont@mail.fr (40 €)" }],
      },
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: "https://app.fr/factures/123" });
    expect(event.message).toBe("échec relance [email] pour [montant]");
    expect(event.breadcrumbs?.[0]).toEqual({
      message: "clic sur envoyer à [email]",
    });
    expect(event.exception?.values?.[0]?.value).toBe(
      "Resend a refusé [email] ([montant])",
    );
  });
});
