import { describe, expect, it } from "vitest";

import { etatLienDevis, expirationLienDevis, signatureDevisPubliqueSchema } from "./devis-public";

const NOW = "2026-10-26T10:00:00.000Z";
const TODAY = "2026-10-26";
const base = {
  statut: "envoye",
  est_modele: false,
  access_token: "jeton-0123456789abcdef",
  token_expires_at: "2026-11-20T22:59:00.000Z",
  signature_client_url: null,
  facture_id: null,
  date_validite: "2026-11-20",
};

describe("etatLienDevis", () => {
  it("utilisable, puis signé / expiré / révoqué / introuvable", () => {
    expect(etatLienDevis(base, NOW, TODAY)).toBe("utilisable");
    expect(etatLienDevis({ ...base, signature_client_url: "x.png", statut: "accepte" }, NOW, TODAY)).toBe("signe");
    expect(etatLienDevis({ ...base, statut: "accepte" }, NOW, TODAY)).toBe("signe");
    expect(etatLienDevis({ ...base, token_expires_at: "2026-10-01T00:00:00.000Z" }, NOW, TODAY)).toBe("expire");
    expect(etatLienDevis({ ...base, date_validite: "2026-10-25" }, NOW, TODAY)).toBe("expire");
    expect(etatLienDevis({ ...base, statut: "refuse" }, NOW, TODAY)).toBe("revoque");
    expect(etatLienDevis({ ...base, statut: "brouillon" }, NOW, TODAY)).toBe("revoque");
    expect(etatLienDevis({ ...base, facture_id: "f1" }, NOW, TODAY)).toBe("revoque");
    expect(etatLienDevis({ ...base, est_modele: true }, NOW, TODAY)).toBe("revoque");
    expect(etatLienDevis({ ...base, access_token: null }, NOW, TODAY)).toBe("introuvable");
    expect(etatLienDevis(null, NOW, TODAY)).toBe("introuvable");
  });
});

describe("expirationLienDevis", () => {
  it("fin de la journée de validité à Paris (été −2 h, hiver −1 h), sinon 30 jours", () => {
    expect(expirationLienDevis("2026-10-20", NOW)).toBe("2026-10-20T21:59:00.000Z");
    expect(expirationLienDevis("2026-12-15", NOW)).toBe("2026-12-15T22:59:00.000Z");
    expect(expirationLienDevis(null, NOW)).toBe("2026-11-25T10:00:00.000Z");
  });
});

describe("signatureDevisPubliqueSchema", () => {
  it("nom et case cochée obligatoires", () => {
    expect(signatureDevisPubliqueSchema.safeParse({ signataire_nom: "Julien Clément", accepte: true }).success).toBe(true);
    expect(signatureDevisPubliqueSchema.safeParse({ signataire_nom: "J", accepte: true }).success).toBe(false);
    expect(signatureDevisPubliqueSchema.safeParse({ signataire_nom: "Julien Clément", accepte: false }).success).toBe(false);
  });
});
