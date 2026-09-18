import { describe, expect, it } from "vitest";

import {
  conversionDevisAutorisee,
  devisModifiable,
  motifVerrouDevis,
  signatureDevisAutorisee,
  STATUTS_DEVIS_STOCKES,
  TRANSITIONS_DEVIS,
  transitionDevisAutorisee,
} from "./devis-transitions";

const STATUTS_AFFICHES = [
  "brouillon",
  "envoye",
  "expire",
  "refuse",
  "accepte",
] as const;

describe("TRANSITIONS_DEVIS (table)", () => {
  it("ne vise que des statuts réellement stockés", () => {
    for (const cibles of Object.values(TRANSITIONS_DEVIS)) {
      for (const cible of cibles) {
        expect(STATUTS_DEVIS_STOCKES).toContain(cible);
      }
    }
  });

  it("couvre tous les statuts affichés, « expire » compris", () => {
    for (const statut of STATUTS_AFFICHES) {
      expect(TRANSITIONS_DEVIS[statut]).toBeDefined();
    }
  });

  it("un devis accepté n'a aucune sortie manuelle", () => {
    expect(TRANSITIONS_DEVIS.accepte).toEqual(["brouillon"]);
  });
});

describe("transitionDevisAutorisee — matrice complète", () => {
  const attendues: Record<string, string[]> = {
    brouillon: ["envoye"],
    envoye: ["accepte", "refuse", "brouillon"],
    expire: ["brouillon"],
    refuse: ["brouillon"],
    accepte: ["brouillon"],
  };

  it.each(STATUTS_AFFICHES)("depuis « %s »", (depart) => {
    for (const cible of STATUTS_DEVIS_STOCKES) {
      const res = transitionDevisAutorisee(depart, cible);
      expect(res.ok).toBe(attendues[depart].includes(cible));
    }
  });

  it("refuse une cible identique au statut courant", () => {
    const res = transitionDevisAutorisee("envoye", "envoye");
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ error: expect.stringContaining("déjà") });
  });

  it("refuse une cible inconnue ou non stockable (« expire »)", () => {
    expect(transitionDevisAutorisee("envoye", "expire").ok).toBe(false);
    expect(transitionDevisAutorisee("envoye", "archive").ok).toBe(false);
  });

  it("refuse tout passage sur un devis signé, converti ou modèle", () => {
    for (const ctx of [
      { signee: true },
      { convertie: true },
      { modele: true },
    ]) {
      for (const depart of STATUTS_AFFICHES) {
        for (const cible of STATUTS_DEVIS_STOCKES) {
          expect(transitionDevisAutorisee(depart, cible, ctx).ok).toBe(false);
        }
      }
    }
  });

  it("retour en brouillon impossible sur un devis signé", () => {
    const res = transitionDevisAutorisee("envoye", "brouillon", {
      signee: true,
    });
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ error: expect.stringContaining("signé") });
  });
});

describe("motifVerrouDevis / devisModifiable", () => {
  it("devis libre : modifiable", () => {
    expect(motifVerrouDevis()).toBeNull();
    expect(devisModifiable({})).toBe(true);
  });

  it("signé ou converti : verrouillé, motif explicite", () => {
    expect(motifVerrouDevis({ signee: true })).toContain("signé");
    expect(motifVerrouDevis({ convertie: true })).toContain("facture");
    expect(devisModifiable({ signee: true })).toBe(false);
    expect(devisModifiable({ convertie: true })).toBe(false);
  });

  it("la conversion prime sur la signature dans le message", () => {
    expect(motifVerrouDevis({ signee: true, convertie: true })).toContain(
      "facture",
    );
  });

  it("un modèle reste modifiable (seul son statut est gelé)", () => {
    expect(devisModifiable({ modele: true })).toBe(true);
  });
});

describe("signatureDevisAutorisee", () => {
  it("autorise un devis envoyé ou affiché expiré", () => {
    expect(signatureDevisAutorisee("envoye").ok).toBe(true);
    expect(signatureDevisAutorisee("expire").ok).toBe(true);
  });

  it("refuse un brouillon jamais transmis au client", () => {
    const res = signatureDevisAutorisee("brouillon");
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ error: expect.stringContaining("brouillon") });
  });

  it("refuse un devis refusé, déjà accepté, déjà signé, converti ou modèle", () => {
    expect(signatureDevisAutorisee("refuse").ok).toBe(false);
    expect(signatureDevisAutorisee("accepte").ok).toBe(false);
    expect(signatureDevisAutorisee("envoye", { signee: true }).ok).toBe(false);
    expect(signatureDevisAutorisee("envoye", { convertie: true }).ok).toBe(
      false,
    );
    expect(signatureDevisAutorisee("envoye", { modele: true }).ok).toBe(false);
  });
});

describe("conversionDevisAutorisee", () => {
  it("n'autorise que le devis accepté", () => {
    expect(conversionDevisAutorisee("accepte").ok).toBe(true);
    for (const s of ["brouillon", "envoye", "expire", "refuse"]) {
      expect(conversionDevisAutorisee(s).ok).toBe(false);
    }
  });

  it("refuse une deuxième conversion et les modèles", () => {
    expect(conversionDevisAutorisee("accepte", { convertie: true }).ok).toBe(
      false,
    );
    expect(conversionDevisAutorisee("accepte", { modele: true }).ok).toBe(false);
  });

  it("un devis signé reste convertible (la signature l'a rendu accepté)", () => {
    expect(conversionDevisAutorisee("accepte", { signee: true }).ok).toBe(true);
  });
});
