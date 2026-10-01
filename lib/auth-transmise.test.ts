import { describe, expect, it } from "vitest";

import { encoderUtilisateur, lireUtilisateurTransmis } from "./auth-transmise";

describe("identité transmise par le middleware", () => {
  const u = { id: "4f3c2b1a-0000-4000-8000-000000000001", email: "nathan@exemple.fr" };

  it("aller-retour", () => {
    expect(lireUtilisateurTransmis(encoderUtilisateur(u))).toEqual(u);
  });

  it("valeur absente, forgée ou sans UUID → null", () => {
    expect(lireUtilisateurTransmis(null)).toBeNull();
    expect(lireUtilisateurTransmis("")).toBeNull();
    expect(lireUtilisateurTransmis("n'importe quoi")).toBeNull();
    expect(lireUtilisateurTransmis(encodeURIComponent(JSON.stringify({ id: "admin" })))).toBeNull();
    expect(lireUtilisateurTransmis(encodeURIComponent(JSON.stringify({ email: "x" })))).toBeNull();
  });

  it("l'en-tête reste ASCII même avec des accents", () => {
    const v = encoderUtilisateur({ id: u.id, email: "élodie@exemple.fr" });
    expect(/^[\x20-\x7e]+$/.test(v)).toBe(true);
    expect(lireUtilisateurTransmis(v)?.email).toBe("élodie@exemple.fr");
  });
});
