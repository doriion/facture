import { describe, expect, it } from "vitest";

import {
  aujourdhuiParis,
  dateRaccourci,
  classerTaches,
  compteurTachesDuJour,
  filtrerTaches,
  type TacheClassable,
} from "./taches-logic";

const TODAY = "2026-09-02";

function tache(over: Partial<TacheClassable> = {}): TacheClassable {
  return {
    id: "t1",
    fait: false,
    date_echeance: TODAY,
    heure: null,
    fait_le: null,
    priorite: "normale",
    ...over,
  };
}

describe("classerTaches", () => {
  it("répartit retard / aujourd'hui / sans date / à venir / faites", () => {
    const res = classerTaches(
      [
        tache({ id: "retard", date_echeance: "2026-08-30" }),
        tache({ id: "jour", date_echeance: TODAY }),
        tache({ id: "libre", date_echeance: null }),
        tache({ id: "futur", date_echeance: "2026-09-10" }),
        tache({
          id: "faite",
          fait: true,
          fait_le: "2026-09-01T10:00:00Z",
        }),
      ],
      TODAY,
    );
    expect(res.enRetard.map((t) => t.id)).toEqual(["retard"]);
    expect(res.enRetard[0]!.joursRetard).toBe(3);
    expect(res.aujourdhui.map((t) => t.id)).toEqual(["jour"]);
    expect(res.sansDate.map((t) => t.id)).toEqual(["libre"]);
    expect(res.aVenir.map((t) => t.id)).toEqual(["futur"]);
    expect(res.faites.map((t) => t.id)).toEqual(["faite"]);
  });

  it("une tâche faite sort des vues actives même si son échéance est passée", () => {
    const res = classerTaches(
      [
        tache({
          id: "f",
          fait: true,
          date_echeance: "2026-08-01",
          fait_le: "2026-08-20T09:00:00Z",
        }),
      ],
      TODAY,
    );
    expect(res.enRetard).toHaveLength(0);
    expect(res.faites.map((t) => t.id)).toEqual(["f"]);
  });

  it("« Faites » : fenêtre de 30 jours (borne incluse), fait_le manquant conservé", () => {
    const res = classerTaches(
      [
        tache({ id: "recent", fait: true, fait_le: "2026-08-03T12:00:00Z" }),
        tache({ id: "vieux", fait: true, fait_le: "2026-08-02T12:00:00Z" }),
        tache({ id: "sans-date-fait", fait: true, fait_le: null }),
      ],
      TODAY,
    );
    // 2026-08-03 → 30 j exactement : gardé ; 2026-08-02 → 31 j : exclu
    expect(res.faites.map((t) => t.id)).toEqual(["recent", "sans-date-fait"]);
  });

  it("trie le retard du plus ancien au plus récent, l'à-venir du plus proche au plus lointain", () => {
    const res = classerTaches(
      [
        tache({ id: "r1", date_echeance: "2026-09-01" }),
        tache({ id: "r10", date_echeance: "2026-08-23" }),
        tache({ id: "loin", date_echeance: "2026-10-01" }),
        tache({ id: "proche", date_echeance: "2026-09-05" }),
      ],
      TODAY,
    );
    expect(res.enRetard.map((t) => t.id)).toEqual(["r10", "r1"]);
    expect(res.aVenir.map((t) => t.id)).toEqual(["proche", "loin"]);
  });

  it("dans une même journée : urgentes d'abord, puis par heure, sans heure en dernier", () => {
    const res = classerTaches(
      [
        tache({ id: "sans-heure" }),
        tache({ id: "matin", heure: "08:00" }),
        tache({ id: "urgente", priorite: "urgente", heure: "15:00" }),
        tache({ id: "midi", heure: "12:00" }),
      ],
      TODAY,
    );
    expect(res.aujourdhui.map((t) => t.id)).toEqual([
      "urgente",
      "matin",
      "midi",
      "sans-heure",
    ]);
  });

  it("faites triées de la plus récente à la plus ancienne", () => {
    const res = classerTaches(
      [
        tache({ id: "avant", fait: true, fait_le: "2026-08-25T08:00:00Z" }),
        tache({ id: "apres", fait: true, fait_le: "2026-09-01T08:00:00Z" }),
      ],
      TODAY,
    );
    expect(res.faites.map((t) => t.id)).toEqual(["apres", "avant"]);
  });
});

describe("compteurTachesDuJour", () => {
  it("compte retard + aujourd'hui, ignore sans-date, à-venir et faites", () => {
    expect(
      compteurTachesDuJour(
        [
          tache({ id: "a", date_echeance: "2026-08-20" }),
          tache({ id: "b", date_echeance: TODAY }),
          tache({ id: "c", date_echeance: null }),
          tache({ id: "d", date_echeance: "2026-09-20" }),
          tache({ id: "e", fait: true, fait_le: "2026-09-01T08:00:00Z" }),
        ],
        TODAY,
      ),
    ).toBe(2);
  });
});

describe("aujourdhuiParis", () => {
  it("à 23h30 UTC un 1er septembre, il est déjà le 2 en France (été, UTC+2)", () => {
    expect(aujourdhuiParis(new Date("2026-09-01T23:30:00Z"))).toBe(
      "2026-09-02",
    );
    expect(aujourdhuiParis(new Date("2026-09-01T12:00:00Z"))).toBe(
      "2026-09-01",
    );
  });
});

describe("dateRaccourci", () => {
  it("aujourd'hui et demain", () => {
    expect(dateRaccourci("aujourdhui", "2026-09-02")).toBe("2026-09-02");
    expect(dateRaccourci("demain", "2026-09-02")).toBe("2026-09-03");
    // Passage de mois
    expect(dateRaccourci("demain", "2026-09-30")).toBe("2026-10-01");
  });

  it("« cette semaine » = le vendredi de la semaine en cours", () => {
    // 2026-09-02 est un mercredi → vendredi 4
    expect(dateRaccourci("semaine", "2026-09-02")).toBe("2026-09-04");
    // Lundi 2026-08-31 → vendredi 4
    expect(dateRaccourci("semaine", "2026-08-31")).toBe("2026-09-04");
  });

  it("« cette semaine » depuis vendredi/samedi → dimanche de la même semaine", () => {
    // Vendredi 2026-09-04 → dimanche 6
    expect(dateRaccourci("semaine", "2026-09-04")).toBe("2026-09-06");
    // Samedi 5 → dimanche 6 ; dimanche 6 → lui-même
    expect(dateRaccourci("semaine", "2026-09-05")).toBe("2026-09-06");
    expect(dateRaccourci("semaine", "2026-09-06")).toBe("2026-09-06");
  });
});

describe("filtrerTaches", () => {
  const liste = [
    { titre: "Acheter du cuivre Ø16", notes: null },
    { titre: "Relancer devis", notes: "Chantier Pérez — étage" },
  ];

  it("cherche dans le titre et les notes, sans tenir compte des accents ni de la casse", () => {
    expect(filtrerTaches(liste, "CUIVRE")).toHaveLength(1);
    expect(filtrerTaches(liste, "perez")).toHaveLength(1);
    expect(filtrerTaches(liste, "chaudière")).toHaveLength(0);
  });

  it("recherche vide → tout", () => {
    expect(filtrerTaches(liste, "  ")).toHaveLength(2);
  });
});
