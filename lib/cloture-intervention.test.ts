import { describe, expect, it } from "vitest";

import { BAREME_PAR_DEFAUT } from "./bareme-entretien";
import { posteBaremeDevine, propositionsFacturation } from "./cloture-intervention";

const intervention = {
  type: "entretien",
  description: "OMOBONI Nicole\n448 avenue Aristide Briand",
  equipement_marque: null,
  equipement_modele: null,
  duree_minutes: null,
  heure_debut: "09:00:00",
  heure_fin: "10:30:00",
  date_intervention: "2026-11-06",
  date_fin: null,
};
const catalogue = [
  { id: "p1", designation: "entretien journalier", description: null, prix_ht: 300, prix_achat_ttc: null, fournisseur: null, nature_fiscale: "bic_prestations", actif: true },
  { id: "p2", designation: "Entretien climatisation", description: "Nettoyage, contrôle, pressions", prix_ht: 120, prix_achat_ttc: null, fournisseur: null, nature_fiscale: "bic_prestations", actif: true },
] as never;

describe("poste du barème deviné", () => {
  it("reconnaît les familles usuelles", () => {
    expect(posteBaremeDevine("Entretien clim réversible salon")).toBe("split_reversible");
    expect(posteBaremeDevine("PAC Atlantic")).toBe("pac");
    expect(posteBaremeDevine("VMC double flux")).toBe("vmc_double");
    expect(posteBaremeDevine("Carte à remplacer")).toBeNull();
  });
});

describe("propositions de facturation", () => {
  it("devis accepté d'abord, catalogue, barème, puis ligne libre", () => {
    const props = propositionsFacturation({
      intervention,
      devisAcceptes: [{ id: "d1", numero: "D-2026-0031", total_ht: 2167, lignes: [{ designation: "Clim", quantite: 1, prix_unitaire_ht: 2167, prix_achat_ttc_unitaire: 861.22, fournisseur: null, nature_fiscale: "bic_ventes", type: "ligne" }] }],
      catalogue,
      bareme: BAREME_PAR_DEFAUT,
    });
    expect(props.map((p) => p.source)).toEqual(["devis", "catalogue", "bareme", "libre"]);
    expect(props[0]).toMatchObject({ titre: "Devis D-2026-0031 accepté", devisId: "d1", totalHt: 2167, prete: true });
    expect(props[1]).toMatchObject({ titre: "Entretien climatisation", totalHt: 120, prete: true });
    expect(props[2]).toMatchObject({ totalHt: 189, prete: true });
    expect(props[2]!.lignes[0]!.designation).toContain("Split réversible");
    // Ligne libre : descriptif sur une ligne, heures reprises, prix à saisir.
    expect(props[3]).toMatchObject({ source: "libre", prete: false, totalHt: 0 });
    expect(props[3]!.lignes[0]).toMatchObject({ designation: "OMOBONI Nicole — 448 avenue Aristide Briand", quantite: 1.5, prix_unitaire_ht: 0 });
  });
  it("sans devis ni catalogue ni barème : seulement la ligne libre", () => {
    const props = propositionsFacturation({ intervention: { ...intervention, type: "depannage", description: "Fuite sous évier" }, devisAcceptes: [], catalogue: [], bareme: null });
    expect(props.map((p) => p.source)).toEqual(["libre"]);
  });
});
