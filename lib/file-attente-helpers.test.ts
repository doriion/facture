import { describe, expect, it } from "vitest";

import {
  estErreurReseau,
  genererId,
  idParent,
  libelleEntree,
  ordonnerPourRejeu,
  resumerFile,
  type EntreeFile,
} from "./file-attente-helpers";

const entree = (partiel: Partial<EntreeFile> & Pick<EntreeFile, "type">): EntreeFile => ({
  id: genererId(),
  payload: {},
  creeLe: "2026-09-25T08:00:00.000Z",
  tentatives: 0,
  ...partiel,
});

describe("genererId", () => {
  it("produit un UUID v4 valide et unique", () => {
    const a = genererId();
    const b = genererId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe("libellés et résumé", () => {
  it("décrit chaque type d'entrée en français", () => {
    expect(libelleEntree(entree({ type: "tache_fait", payload: { fait: true, titre: "Purger" } }))).toBe(
      "Tâche faite : Purger",
    );
    expect(libelleEntree(entree({ type: "rdv_creer", payload: { date_intervention: "2026-09-26", clientNom: "Dupont" } }))).toBe(
      "Rendez-vous du 2026-09-26 — Dupont",
    );
    expect(libelleEntree(entree({ type: "paiement_ajouter", payload: { montantTexte: "120,00 €", numero: "F-2026-0003" } }))).toBe(
      "Paiement de 120,00 € sur F-2026-0003",
    );
  });

  it("compte en attente et en erreur", () => {
    expect(
      resumerFile([entree({ type: "tache_fait" }), entree({ type: "tache_fait", erreur: "refus" })]),
    ).toEqual({ total: 2, enAttente: 1, enErreur: 1 });
  });
});

describe("ordre de rejeu", () => {
  it("date croissante, créations avant ce qui en dépend à date égale", () => {
    const photo = entree({ type: "photo_tache", creeLe: "2026-09-25T08:00:00.000Z" });
    const tache = entree({ type: "tache_creer", creeLe: "2026-09-25T08:00:00.000Z" });
    const ancien = entree({ type: "tache_fait", creeLe: "2026-09-25T07:00:00.000Z" });
    expect(ordonnerPourRejeu([photo, tache, ancien]).map((e) => e.type)).toEqual([
      "tache_fait",
      "tache_creer",
      "photo_tache",
    ]);
  });

  it("connaît la dépendance d'une photo ou d'une couleur", () => {
    expect(idParent(entree({ type: "photo_tache", payload: { tacheId: "t1" } }))).toBe("t1");
    expect(idParent(entree({ type: "couleur_evenements", payload: { cles: ["intervention:i1"] } }))).toBe("i1");
    expect(idParent(entree({ type: "tache_fait" }))).toBeNull();
  });
});

describe("estErreurReseau", () => {
  it("reconnaît les messages réseau, pas les refus métier", () => {
    expect(estErreurReseau("Pas de réseau : la modification n'a pas été enregistrée.")).toBe(true);
    expect(estErreurReseau("Failed to fetch")).toBe(true);
    expect(estErreurReseau("Le montant dépasse le reste dû (12,00 €).")).toBe(false);
  });
});
