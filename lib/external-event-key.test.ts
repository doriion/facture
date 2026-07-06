import { describe, expect, it } from "vitest";

import { computeExternalEventKey } from "./external-event-key";

const base = {
  uid: "ABC-123-DEF@icloud.com",
  date_start: "2026-05-11",
  title: "RDV chaudière Mme Martin",
};

describe("computeExternalEventKey", () => {
  it("utilise l'UID iCal comme clé primaire (trim inclus)", () => {
    const key = computeExternalEventKey({ ...base, uid: "  ABC-123-DEF@icloud.com  " });
    expect(key.external_uid).toBe("ABC-123-DEF@icloud.com");
  });

  it("calcule un fallback SHA-256 hex tronqué à 24 caractères", () => {
    const key = computeExternalEventKey(base);
    expect(key.fallback_key).toMatch(/^[0-9a-f]{24}$/);
  });

  it("est déterministe : mêmes entrées → mêmes clés", () => {
    expect(computeExternalEventKey(base)).toEqual(computeExternalEventKey(base));
  });

  it("bascule sur le fallback si l'UID est vide ou trop court", () => {
    const empty = computeExternalEventKey({ ...base, uid: "" });
    expect(empty.external_uid).toBe(empty.fallback_key);

    const short = computeExternalEventKey({ ...base, uid: "ab " });
    expect(short.external_uid).toBe(short.fallback_key);

    // 4 caractères = juste assez pour être gardé tel quel
    const ok = computeExternalEventKey({ ...base, uid: "abcd" });
    expect(ok.external_uid).toBe("abcd");
  });

  it("normalise le titre pour le fallback (casse, espaces multiples)", () => {
    const a = computeExternalEventKey({ ...base, uid: "" });
    const b = computeExternalEventKey({
      ...base,
      uid: "",
      title: "  rdv   CHAUDIÈRE mme martin ",
    });
    expect(a.fallback_key).toBe(b.fallback_key);
  });

  it("change le fallback si la date ou le titre change", () => {
    const a = computeExternalEventKey({ ...base, uid: "" });
    const autreDate = computeExternalEventKey({
      ...base,
      uid: "",
      date_start: "2026-05-12",
    });
    const autreTitre = computeExternalEventKey({
      ...base,
      uid: "",
      title: "Autre RDV",
    });
    expect(autreDate.fallback_key).not.toBe(a.fallback_key);
    expect(autreTitre.fallback_key).not.toBe(a.fallback_key);
  });
});
