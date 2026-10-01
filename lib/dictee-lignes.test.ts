import { describe, expect, it } from "vitest";

import type { PrestationCatalogue } from "@/lib/catalogue-recherche";
import { extraireQuantite, lignesDepuisDictee, meilleurePrestation, segmentsDictee } from "./dictee-lignes";

const catalogue: PrestationCatalogue[] = [
  { id: "1", designation: "Main-d'œuvre plomberie", description: "Taux horaire", prix_ht: 55, nature_fiscale: "bic_prestations", actif: true } as PrestationCatalogue,
  { id: "2", designation: "Ballon d'eau chaude 200 L", description: "Fourniture et pose", prix_ht: 890, prix_achat_ttc: 520, fournisseur: "Cedeo", nature_fiscale: "bic_ventes", actif: true } as PrestationCatalogue,
  { id: "3", designation: "Tube cuivre 16 mm", description: "au mètre", prix_ht: 12, nature_fiscale: "bic_ventes", actif: true } as PrestationCatalogue,
  { id: "4", designation: "Pose complète PAC air/eau", description: "", prix_ht: 2500, nature_fiscale: "bic_prestations", actif: true } as PrestationCatalogue,
  { id: "5", designation: "Ancienne prestation", description: "", prix_ht: 1, nature_fiscale: "bic_prestations", actif: false } as PrestationCatalogue,
];

describe("segmentsDictee", () => {
  it("coupe sur virgules, « et », « puis », retours à la ligne", () => {
    expect(segmentsDictee("deux heures de main d'œuvre, un ballon 200 litres et 3 mètres de cuivre puis déplacement")).toEqual([
      "deux heures de main d'œuvre",
      "un ballon 200 litres",
      "3 mètres de cuivre",
      "déplacement",
    ]);
    expect(segmentsDictee("- pose\n- raccordement")).toEqual(["pose", "raccordement"]);
  });
});

describe("extraireQuantite", () => {
  it("chiffres, mots, « x », décimales", () => {
    expect(extraireQuantite("2 heures de main d'œuvre")).toEqual({ quantite: 2, reste: "heures de main d'œuvre" });
    expect(extraireQuantite("deux heures")).toEqual({ quantite: 2, reste: "heures" });
    expect(extraireQuantite("3 x ballon")).toEqual({ quantite: 3, reste: "ballon" });
    expect(extraireQuantite("x3 ballon")).toEqual({ quantite: 3, reste: "ballon" });
    expect(extraireQuantite("1,5 heure")).toEqual({ quantite: 1.5, reste: "heure" });
    expect(extraireQuantite("cuivre 12 m")).toEqual({ quantite: 12, reste: "cuivre (m)" });
    expect(extraireQuantite("déplacement")).toEqual({ quantite: 1, reste: "déplacement" });
  });
});

describe("meilleurePrestation", () => {
  it("retrouve la prestation malgré les mots de liaison et les pluriels", () => {
    expect(meilleurePrestation("heures de main d'œuvre", catalogue)?.id).toBe("1");
    expect(meilleurePrestation("ballon 200 litres", catalogue)?.id).toBe("2");
    expect(meilleurePrestation("mètres de cuivre", catalogue)?.id).toBe("3");
  });

  it("ne choisit rien sur un mot trop vague, ni une prestation archivée", () => {
    expect(meilleurePrestation("déplacement", catalogue)).toBeNull();
    expect(meilleurePrestation("ancienne prestation", catalogue)).toBeNull();
  });
});

describe("lignesDepuisDictee", () => {
  it("quantités + catalogue, ligne libre sinon", () => {
    const lignes = lignesDepuisDictee("deux heures de main d'œuvre, un ballon 200 litres et 3 mètres de cuivre puis déplacement", catalogue);
    expect(lignes.map((l) => [l.quantite, l.prestation?.id ?? null, l.prix_unitaire_ht])).toEqual([
      [2, "1", 55],
      [1, "2", 890],
      [3, "3", 12],
      [1, null, ""],
    ]);
    expect(lignes[1]).toMatchObject({ prix_achat_ttc_unitaire: 520, fournisseur: "Cedeo", nature_fiscale: "bic_ventes" });
    expect(lignes[3]!.designation).toBe("Déplacement");
  });

  it("texte vide → aucune ligne", () => {
    expect(lignesDepuisDictee("   ", catalogue)).toEqual([]);
  });
});
