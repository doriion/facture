import { describe, expect, it } from "vitest";

import {
  adresseDetectee,
  clientDepuisEvenement,
  decomposerAdresse,
  extraireEmail,
  nomDepuisTexte,
} from "./client-depuis-evenement";

describe("decomposerAdresse", () => {
  it("voie, code postal et ville", () => {
    expect(decomposerAdresse("12 rue des Alpes, 38000 Grenoble")).toEqual({
      adresse_ligne1: "12 rue des Alpes",
      code_postal: "38000",
      ville: "Grenoble",
    });
    expect(decomposerAdresse("12 rue des Alpes 38000 Grenoble")).toEqual({
      adresse_ligne1: "12 rue des Alpes",
      code_postal: "38000",
      ville: "Grenoble",
    });
  });

  it("lieu iPhone sur plusieurs lignes, « France » retiré", () => {
    expect(decomposerAdresse("12 Rue des Alpes\n38000 Grenoble\nFrance")).toEqual({
      adresse_ligne1: "12 Rue des Alpes",
      code_postal: "38000",
      ville: "Grenoble",
    });
  });

  it("sans code postal : la ville après la virgule, sinon tout en ligne 1", () => {
    expect(decomposerAdresse("1 Av. du Centenaire, Valgelon-La Rochette")).toEqual({
      adresse_ligne1: "1 Av. du Centenaire",
      code_postal: null,
      ville: "Valgelon-La Rochette",
    });
    expect(decomposerAdresse("580 chemin de la Croix verte")).toEqual({
      adresse_ligne1: "580 chemin de la Croix verte",
      code_postal: null,
      ville: null,
    });
  });
});

describe("extraireEmail / nomDepuisTexte", () => {
  it("e-mail dans le texte", () => {
    expect(extraireEmail("RDV Dupont, dupont.jean@gmail.com demain")).toBe("dupont.jean@gmail.com");
    expect(extraireEmail("rien ici")).toBeNull();
  });

  it("civilité prioritaire, mots de métier retirés, descriptif de travaux refusé", () => {
    expect(nomDepuisTexte("Dépannage chez Mme Martin", [])).toBe("Mme Martin");
    expect(nomDepuisTexte("RDV Dupont — contrôle chaudière", [])).toBe("Dupont");
    expect(nomDepuisTexte("DEHEEKEREN Marie 1 Av. du Centenaire 06 64 19 18 15", ["1 Av. du Centenaire", "06 64 19 18 15"])).toBe(
      "DEHEEKEREN Marie",
    );
    expect(nomDepuisTexte("Remplacement ballon eau chaude 200 L", [])).toBeNull();
    expect(nomDepuisTexte("06 64 19 18 15", ["06 64 19 18 15"])).toBeNull();
  });
});

describe("clientDepuisEvenement", () => {
  it("RDV iPhone : nom et téléphone dans le libellé, adresse dans le lieu, e-mail dans les notes", () => {
    expect(
      clientDepuisEvenement({
        title: "Dupont 06 64 19 18 15",
        lieu: "12 Rue des Alpes\n38000 Grenoble\nFrance",
        description: "Contact : dupont@gmail.com",
      }),
    ).toEqual({
      nom: "Dupont",
      telephone: "06 64 19 18 15",
      email: "dupont@gmail.com",
      adresse_ligne1: "12 Rue des Alpes",
      code_postal: "38000",
      ville: "Grenoble",
    });
  });

  it("tout dans le libellé : nom, adresse, téléphone", () => {
    const c = clientDepuisEvenement({ title: "DEHEEKEREN Marie 1 Av. du Centenaire, Valgelon-La Rochette 06 64 19 18 15" });
    expect(c).toEqual({
      nom: "DEHEEKEREN Marie",
      telephone: "06 64 19 18 15",
      email: null,
      adresse_ligne1: "1 Av. du Centenaire",
      code_postal: null,
      ville: "Valgelon-La Rochette",
    });
    expect(adresseDetectee(c!)).toBe("1 Av. du Centenaire, Valgelon-La Rochette");
  });

  it("description d'une intervention tapée dans l'application (une info par ligne)", () => {
    const c = clientDepuisEvenement({
      title: "Jean Dupont\n06 12 34 56 78\n8 chemin du Vercors 38100 Grenoble\njean.dupont@orange.fr",
      description: "Jean Dupont\n06 12 34 56 78\n8 chemin du Vercors 38100 Grenoble\njean.dupont@orange.fr",
    });
    expect(c).toEqual({
      nom: "Jean Dupont",
      telephone: "06 12 34 56 78",
      email: "jean.dupont@orange.fr",
      adresse_ligne1: "8 chemin du Vercors",
      code_postal: "38100",
      ville: "Grenoble",
    });
  });

  it("civilité et e-mail seuls suffisent ; e-mail collé à l'adresse n'est pas pris dedans", () => {
    expect(clientDepuisEvenement({ title: "Mme Martin martin@ex.fr" })).toEqual({
      nom: "Mme Martin",
      telephone: null,
      email: "martin@ex.fr",
      adresse_ligne1: null,
      code_postal: null,
      ville: null,
    });
    const c = clientDepuisEvenement({ title: "Durand 3 rue Haute 38000 Grenoble durand@ex.fr" });
    expect(c?.adresse_ligne1).toBe("3 rue Haute");
    expect(c?.ville).toBe("Grenoble");
    expect(c?.email).toBe("durand@ex.fr");
    expect(c?.nom).toBe("Durand");
  });

  it("rien à proposer : pas de coordonnée, ou pas de nom", () => {
    expect(clientDepuisEvenement({ title: "Pose clim" })).toBeNull();
    expect(clientDepuisEvenement({ title: "Remplacement ballon eau chaude 200 L", description: "Remplacement ballon eau chaude 200 L" })).toBeNull();
    expect(clientDepuisEvenement({ title: "06 64 19 18 15" })).toBeNull();
    expect(clientDepuisEvenement({ title: "", description: null, lieu: "12 rue des Alpes, 38000 Grenoble" })).toBeNull();
  });
});
