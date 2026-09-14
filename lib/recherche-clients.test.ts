import { describe, expect, it } from "vitest";

import {
  chercherClients,
  libelleClient,
  MAX_CLIENTS_PROPOSES,
  type ClientRecherche,
} from "./recherche-clients";

const CLIENTS: ClientRecherche[] = [
  {
    id: "1",
    nom: "Marchand Isabelle",
    ville: "Grenoble",
    code_postal: "38100",
    email: "i.marchand@exemple.fr",
    telephone: "06 41 22 87 03",
  },
  {
    id: "2",
    nom: "Dupont Jean",
    ville: "Échirolles",
    code_postal: "38130",
    telephone: "0478451290",
  },
  {
    id: "3",
    nom: "SCI Les Écrins",
    raison_sociale: "SCI Les Écrins",
    ville: "Meylan",
    code_postal: "38240",
  },
  {
    id: "4",
    nom: "Bernard Marchandise",
    ville: "Voiron",
    code_postal: "38500",
  },
];

describe("libelleClient", () => {
  it("ajoute lieu et email quand ils existent", () => {
    expect(libelleClient(CLIENTS[0])).toBe(
      "Marchand Isabelle — 38100 Grenoble · i.marchand@exemple.fr",
    );
  });

  it("se réduit au nom seul quand il n'y a rien d'autre", () => {
    expect(libelleClient({ id: "x", nom: "Durand" })).toBe("Durand");
  });
});

describe("chercherClients", () => {
  it("champ vide → les premiers clients, pas une liste vide", () => {
    expect(chercherClients(CLIENTS, "").map((c) => c.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("le nom qui commence par la saisie passe devant", () => {
    const r = chercherClients(CLIENTS, "marchand");
    expect(r[0].id).toBe("1");
    expect(r.map((c) => c.id)).toContain("4");
  });

  it("trouve par ville, accents ignorés", () => {
    expect(chercherClients(CLIENTS, "echirolles").map((c) => c.id)).toEqual(["2"]);
  });

  it("trouve par email", () => {
    expect(chercherClients(CLIENTS, "exemple.fr").map((c) => c.id)).toEqual(["1"]);
  });

  it("trouve un téléphone tapé sans les espaces", () => {
    expect(chercherClients(CLIENTS, "0641").map((c) => c.id)).toEqual(["1"]);
    expect(chercherClients(CLIENTS, "06 41").map((c) => c.id)).toEqual(["1"]);
  });

  it("trouve par code postal", () => {
    expect(chercherClients(CLIENTS, "38240").map((c) => c.id)).toEqual(["3"]);
  });

  it("un seul chiffre ne déclenche pas la recherche par numéro", () => {
    // Sinon « 3 » remonterait tous les clients de l'Isère.
    expect(chercherClients(CLIENTS, "3")).toEqual([]);
  });

  it("rien ne correspond → liste vide", () => {
    expect(chercherClients(CLIENTS, "zzzzz")).toEqual([]);
  });

  it("à score égal, ordre alphabétique français", () => {
    const r = chercherClients(
      [
        { id: "a", nom: "Zoé", ville: "Lyon" },
        { id: "b", nom: "Émile", ville: "Lyon" },
      ],
      "lyon",
    );
    expect(r.map((c) => c.nom)).toEqual(["Émile", "Zoé"]);
  });

  it("plafonne la liste", () => {
    const gros = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      nom: `Client ${i}`,
    }));
    expect(chercherClients(gros, "client").length).toBe(MAX_CLIENTS_PROPOSES);
    expect(chercherClients(gros, "", { limite: 3 }).length).toBe(3);
  });
});
