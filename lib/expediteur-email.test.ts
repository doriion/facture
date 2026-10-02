import { describe, expect, it } from "vitest";

import { adresseExpediteur } from "./expediteur-email";

describe("adresseExpediteur", () => {
  it("nom simple sans guillemets", () => {
    expect(adresseExpediteur("Nathan Geneve EI", "x@gmail.com")).toBe("Nathan Geneve EI <x@gmail.com>");
    expect(adresseExpediteur("Élodie Dupont-Martin", "x@gmail.com")).toBe("Élodie Dupont-Martin <x@gmail.com>");
  });

  it("nom avec caractères spéciaux entre guillemets, échappés", () => {
    expect(adresseExpediteur('Plomberie "Chez Nat" & Cie', "x@gmail.com")).toBe('"Plomberie \\"Chez Nat\\" & Cie" <x@gmail.com>');
  });

  it("sans nom, retours à la ligne neutralisés", () => {
    expect(adresseExpediteur("", "x@gmail.com")).toBe("x@gmail.com");
    expect(adresseExpediteur("Nathan\nBcc: pirate@x.fr", "x@gmail.com")).toBe("Nathan Bcc: pirate@x.fr <x@gmail.com>".replace("Nathan Bcc: pirate@x.fr", '"Nathan Bcc: pirate@x.fr"'));
  });
});
