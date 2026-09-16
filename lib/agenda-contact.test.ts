import { describe, expect, it } from "vitest";

import {
  adresseClient,
  contactEvenement,
  extraireAdresse,
  extraireTelephone,
  lienAppel,
  lienItineraire,
  telephoneNormalise,
} from "./agenda-contact";

describe("extraireTelephone", () => {
  it("numéros français avec espaces, points, tirets, +33", () => {
    expect(extraireTelephone("DEHEEKEREN Marie 1 Av. du Centenaire 06 64 19 18 15")).toBe("06 64 19 18 15");
    expect(extraireTelephone("Tel 04.76.00.11.22 le matin")).toBe("04.76.00.11.22");
    expect(extraireTelephone("+33 6 64 19 18 15")).toBe("+33 6 64 19 18 15");
    expect(extraireTelephone("0664191815")).toBe("0664191815");
  });

  it("ne confond pas un numéro de voie ou une référence avec un téléphone", () => {
    expect(extraireTelephone("580 chemin de la Croix verte")).toBeNull();
    expect(extraireTelephone("Devis DEV-2026-0060")).toBeNull();
    expect(extraireTelephone(null)).toBeNull();
  });

  it("lien tel: normalisé en +33", () => {
    expect(telephoneNormalise("06 64 19 18 15")).toBe("+33664191815");
    expect(telephoneNormalise("+33 6 64 19 18 15")).toBe("+33664191815");
    expect(lienAppel("04.76.00.11.22")).toBe("tel:+33476001122");
  });
});

describe("extraireAdresse", () => {
  it("les exemples de l'utilisateur", () => {
    expect(extraireAdresse("BALDET Maurice 580 chemin de la Croix verte")).toBe("580 chemin de la Croix verte");
    expect(
      extraireAdresse("DEHEEKEREN Marie 1 Av. du Centenaire, Valgelon-La Rochette 06 64 19 18 15"),
    ).toBe("1 Av. du Centenaire, Valgelon-La Rochette");
  });

  it("types de voie variés, bis/ter, ne prend pas le téléphone", () => {
    expect(extraireAdresse("12 bis rue des Alpes 38000 Grenoble")).toBe("12 bis rue des Alpes 38000 Grenoble");
    expect(extraireAdresse("Rdv 8 impasse du Lac — apporter échelle")).toBe("8 impasse du Lac");
    expect(extraireAdresse("Lot 5 lotissement Les Cèdres 04 76 00 11 22")).toBe("5 lotissement Les Cèdres");
  });

  it("incertain → null (pas de numéro de voie, trop court, vide)", () => {
    expect(extraireAdresse("Entretien PAC chez Martin")).toBeNull();
    expect(extraireAdresse("12 rue")).toBeNull();
    expect(extraireAdresse("")).toBeNull();
    expect(extraireAdresse(undefined)).toBeNull();
  });

  it("lien d'itinéraire encodé", () => {
    expect(lienItineraire("1 Av. du Centenaire, Valgelon-La Rochette")).toBe(
      "https://maps.google.com/?q=1%20Av.%20du%20Centenaire%2C%20Valgelon-La%20Rochette",
    );
  });
});

describe("adresseClient", () => {
  it("assemble les champs présents", () => {
    expect(adresseClient({ adresse_ligne1: "8 chemin du Vercors", code_postal: "38100", ville: "Grenoble" })).toBe(
      "8 chemin du Vercors, 38100 Grenoble",
    );
    expect(adresseClient({ adresse_ligne1: null, ville: "Grenoble" })).toBe("Grenoble");
    expect(adresseClient({})).toBeNull();
  });
});

describe("contactEvenement", () => {
  it("client rattaché : ses champs priment sur le texte", () => {
    const c = contactEvenement({
      title: "Pose monosplit 06 00 00 00 00 12 rue Fausse",
      client_adresse: "8 chemin du Vercors, 38100 Grenoble",
      client_telephone: "04 76 12 34 56",
    });
    expect(c).toEqual({
      adresse: "8 chemin du Vercors, 38100 Grenoble",
      adresseSource: "client",
      telephone: "04 76 12 34 56",
      telephoneSource: "client",
      rechercheLibelle: null,
    });
  });

  it("RDV iPhone avec LOCATION : le lieu iCal sert d'adresse", () => {
    const c = contactEvenement({ title: "BALDET Maurice", lieu: "580 chemin de la Croix verte, 38000 Grenoble" });
    expect(c.adresse).toBe("580 chemin de la Croix verte, 38000 Grenoble");
    expect(c.adresseSource).toBe("lieu");
    expect(c.telephone).toBeNull();
  });

  it("RDV iPhone tout dans le libellé : adresse et téléphone extraits", () => {
    const c = contactEvenement({
      title: "DEHEEKEREN Marie 1 Av. du Centenaire, Valgelon-La Rochette 06 64 19 18 15",
    });
    expect(c.adresse).toBe("1 Av. du Centenaire, Valgelon-La Rochette");
    expect(c.adresseSource).toBe("texte");
    expect(c.telephone).toBe("06 64 19 18 15");
    expect(c.telephoneSource).toBe("texte");
    expect(c.rechercheLibelle).toBeNull();
  });

  it("extraction incertaine : recherche sur le libellé (sans le téléphone) plutôt que rien", () => {
    const c = contactEvenement({ title: "Chez Martin, ferme du haut 06 64 19 18 15" });
    expect(c.adresse).toBeNull();
    expect(c.telephone).toBe("06 64 19 18 15");
    expect(c.rechercheLibelle).toBe("Chez Martin, ferme du haut");
  });

  it("ni adresse ni téléphone : rien ne casse", () => {
    const c = contactEvenement({ title: "Visite" });
    expect(c).toEqual({
      adresse: null,
      adresseSource: null,
      telephone: null,
      telephoneSource: null,
      rechercheLibelle: null,
    });
  });

  it("le téléphone du client est ignoré s'il n'est pas un numéro valide", () => {
    const c = contactEvenement({ title: "RDV 06 64 19 18 15", client_telephone: "à demander" });
    expect(c.telephone).toBe("06 64 19 18 15");
    expect(c.telephoneSource).toBe("texte");
  });
});
