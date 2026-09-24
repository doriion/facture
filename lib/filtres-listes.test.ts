import { describe, expect, it } from "vitest";

import {
  contient,
  filtrerClients,
  filtrerDevis,
  filtrerFactures,
  filtrerInterventions,
  parametresFiltres,
} from "./filtres-listes";

describe("contient (recherche sans casse ni accents, tous les mots)", () => {
  it("trouve « deheekeren » dans « DEHEEKEREN Marie » et « cedres » dans « Les Cèdres »", () => {
    expect(contient(["DEHEEKEREN Marie"], "deheekeren")).toBe(true);
    expect(contient(["SCI Les Cèdres"], "cedres")).toBe(true);
    expect(contient(["F-2026-0042", null], "0042")).toBe(true);
  });
  it("tous les mots doivent être présents, dans n'importe quel champ ; vide = tout", () => {
    expect(contient(["Entretien PAC", "BALDET"], "pac baldet")).toBe(true);
    expect(contient(["Entretien PAC", "BALDET"], "pac durand")).toBe(false);
    expect(contient(["x"], "  ")).toBe(true);
  });
});

const factures = [
  { numero: "F-2026-0041", notes: null, statut_affichage: "payee", type_activite: "plomberie", client: { nom: "BALDET Maurice" } },
  { numero: "F-2026-0042", notes: "urgent", statut_affichage: "retard", type_activite: "depannage", client: { nom: "SCI Les Cèdres" } },
  { numero: "F-2026-0043", notes: null, statut_affichage: "envoyee", type_activite: "depannage", client: null },
];

describe("filtrerFactures", () => {
  it("statut sur l'affichage : « envoyee » exclut les retards, « retard » les inclut", () => {
    expect(filtrerFactures(factures, { statut: "envoyee" }).map((f) => f.numero)).toEqual(["F-2026-0043"]);
    expect(filtrerFactures(factures, { statut: "retard" }).map((f) => f.numero)).toEqual(["F-2026-0042"]);
    expect(filtrerFactures(factures, { statut: "tous" })).toHaveLength(3);
  });
  it("type d'activité, recherche sur numéro, notes et nom du client", () => {
    expect(filtrerFactures(factures, { type: "depannage" })).toHaveLength(2);
    expect(filtrerFactures(factures, { search: "cedres" }).map((f) => f.numero)).toEqual(["F-2026-0042"]);
    expect(filtrerFactures(factures, { search: "urgent", type: "plomberie" })).toHaveLength(0);
  });
});

describe("filtrerDevis", () => {
  const devis = [
    { numero: "DEV-1", notes: null, statut_affichage: "envoye", type_activite: "plomberie", client: { nom: "A" } },
    { numero: "DEV-2", notes: null, statut_affichage: "expire", type_activite: "plomberie", client: { nom: "B" } },
  ];
  it("« expire » et « envoye » sont distincts", () => {
    expect(filtrerDevis(devis, { statut: "expire" }).map((d) => d.numero)).toEqual(["DEV-2"]);
    expect(filtrerDevis(devis, { statut: "envoye" }).map((d) => d.numero)).toEqual(["DEV-1"]);
  });
});

describe("filtrerClients / filtrerInterventions", () => {
  it("clients : nom, ville, email, téléphone, raison sociale + type", () => {
    const clients = [
      { nom: "BALDET Maurice", type: "particulier", ville: "Grenoble", email: null, telephone: "06 64 19 18 15", raison_sociale: null },
      { nom: "Cabinet Foncia", type: "syndic", ville: "Lyon", email: "contact@foncia.fr", telephone: null, raison_sociale: "Foncia Lyon" },
    ];
    expect(filtrerClients(clients, { search: "grenoble" }).map((c) => c.nom)).toEqual(["BALDET Maurice"]);
    expect(filtrerClients(clients, { search: "06 64" })).toHaveLength(1);
    expect(filtrerClients(clients, { type: "syndic" })).toHaveLength(1);
  });
  it("interventions : description, équipement, n° de série, client + type", () => {
    const its = [
      { type: "entretien", description: "Entretien PAC", equipement_marque: "Daikin", equipement_modele: null, equipement_num_serie: "SN-123", client: { nom: "BALDET" } },
      { type: "depannage", description: null, equipement_marque: null, equipement_modele: null, equipement_num_serie: null, client: null },
    ];
    expect(filtrerInterventions(its, { search: "daikin" })).toHaveLength(1);
    expect(filtrerInterventions(its, { search: "sn-123 baldet" })).toHaveLength(1);
    expect(filtrerInterventions(its, { type: "depannage" })).toHaveLength(1);
  });
  it("interventions : statut terrain (à facturer, à venir, facturées, rien à facturer)", () => {
    const base = { type: "entretien", description: null, equipement_marque: null, equipement_modele: null, equipement_num_serie: null, client: null };
    const its = [
      { ...base, date_intervention: "2026-09-01" },
      { ...base, date_intervention: "2026-09-02", facture: { id: "f" } },
      { ...base, date_intervention: "2026-10-01" },
      { ...base, date_intervention: "2026-09-03", a_facturer: false },
    ];
    const J = "2026-09-25";
    expect(filtrerInterventions(its, { statut: "a_facturer" }, J)).toHaveLength(1);
    expect(filtrerInterventions(its, { statut: "a_venir" }, J)).toHaveLength(1);
    expect(filtrerInterventions(its, { statut: "facturee" }, J)).toHaveLength(1);
    expect(filtrerInterventions(its, { statut: "rien_a_facturer" }, J)).toHaveLength(1);
    expect(filtrerInterventions(its, { statut: "tous" }, J)).toHaveLength(4);
  });
});

describe("parametresFiltres", () => {
  it("n'écrit que les filtres actifs", () => {
    expect(parametresFiltres({ search: "", statut: "tous", type: "plomberie" })).toBe("?type=plomberie");
    expect(parametresFiltres({ search: "", statut: "" })).toBe("");
  });
});

describe("filtrerProduits", () => {
  const produits = [
    { designation: "Entretien chaudière gaz", description: null, categorie: "entretien" },
    { designation: "Pose clim réversible", description: "Split mural", categorie: "installation_clim" },
  ];
  it("recherche sans accents ni casse, sur la description aussi", async () => {
    const { filtrerProduits } = await import("./filtres-listes");
    expect(filtrerProduits(produits, { search: "CHAUDIERE" })).toHaveLength(1);
    expect(filtrerProduits(produits, { search: "split" })).toHaveLength(1);
    expect(filtrerProduits(produits, { search: "zzz" })).toHaveLength(0);
  });
  it("catégorie « toutes » = pas de filtre", async () => {
    const { filtrerProduits } = await import("./filtres-listes");
    expect(filtrerProduits(produits, { categorie: "toutes" })).toHaveLength(2);
    expect(filtrerProduits(produits, { categorie: "entretien" })).toHaveLength(1);
  });
});
