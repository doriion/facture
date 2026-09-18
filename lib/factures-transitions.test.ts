import { describe, expect, it } from "vitest";

import {
  estFactureVentilee,
  paiementAutorise,
  statutAffichageFacture,
  transitionFactureAutorisee,
} from "./factures-transitions";

describe("transitionFactureAutorisee", () => {
  it("brouillon → envoyée, envoyée → brouillon / annulée, annulée → brouillon", () => {
    expect(transitionFactureAutorisee("brouillon", "envoyee").ok).toBe(true);
    expect(transitionFactureAutorisee("envoyee", "brouillon").ok).toBe(true);
    expect(transitionFactureAutorisee("envoyee", "annulee").ok).toBe(true);
    expect(transitionFactureAutorisee("annulee", "brouillon").ok).toBe(true);
  });

  it("« payée » ne se décrète jamais à la main", () => {
    expect(transitionFactureAutorisee("brouillon", "payee").ok).toBe(false);
    expect(transitionFactureAutorisee("envoyee", "payee").ok).toBe(false);
  });

  it("payée → envoyée directe refusée (flux dédié), payée → annulée possible", () => {
    expect(transitionFactureAutorisee("payee", "envoyee").ok).toBe(false);
    expect(transitionFactureAutorisee("payee", "brouillon").ok).toBe(false);
    expect(transitionFactureAutorisee("payee", "annulee").ok).toBe(true);
  });

  it("avec des paiements, pas de retour en brouillon", () => {
    const r = transitionFactureAutorisee("envoyee", "brouillon", { nbPaiements: 1 });
    expect(r.ok).toBe(false);
    expect(transitionFactureAutorisee("envoyee", "brouillon", { nbPaiements: 0 }).ok).toBe(true);
  });

  it("une facture ventilée ne s'envoie pas", () => {
    const r = transitionFactureAutorisee("brouillon", "envoyee", { ventilee: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ventilée/);
    expect(transitionFactureAutorisee("brouillon", "annulee", { ventilee: true }).ok).toBe(true);
  });

  it("statuts inconnus et statut identique refusés", () => {
    expect(transitionFactureAutorisee("envoyee", "envoyee").ok).toBe(false);
    expect(transitionFactureAutorisee("envoyee", "zzz").ok).toBe(false);
    expect(transitionFactureAutorisee("retard", "envoyee").ok).toBe(false);
  });
});

describe("paiementAutorise", () => {
  it("refuse annulée, ventilée, montant nul ou trop-perçu", () => {
    expect(paiementAutorise("annulee", { resteDu: 100, montant: 50 }).ok).toBe(false);
    expect(paiementAutorise("envoyee", { ventilee: true, resteDu: 100, montant: 50 }).ok).toBe(false);
    expect(paiementAutorise("envoyee", { resteDu: 100, montant: 0 }).ok).toBe(false);
    expect(paiementAutorise("envoyee", { resteDu: 100, montant: 100.5 }).ok).toBe(false);
  });

  it("accepte un acompte, le solde exact et un centime d'arrondi", () => {
    expect(paiementAutorise("envoyee", { resteDu: 100, montant: 40 }).ok).toBe(true);
    expect(paiementAutorise("envoyee", { resteDu: 100, montant: 100 }).ok).toBe(true);
    expect(paiementAutorise("brouillon", { resteDu: 100, montant: 100.01 }).ok).toBe(true);
  });
});

describe("estFactureVentilee", () => {
  it("normale avec un enfant non annulé", () => {
    expect(estFactureVentilee({ type_facture: "normale" }, [{ statut: "envoyee" }])).toBe(true);
    expect(estFactureVentilee({ type_facture: "normale" }, [{ statut: "annulee" }])).toBe(false);
    expect(estFactureVentilee({ type_facture: "normale" }, [])).toBe(false);
    expect(estFactureVentilee({ type_facture: "acompte" }, [{ statut: "envoyee" }])).toBe(false);
    expect(estFactureVentilee({}, [{ statut: "payee" }])).toBe(true);
  });
});

describe("statutAffichageFacture", () => {
  it("retard, ventilée, sinon stocké", () => {
    expect(statutAffichageFacture({ statut: "envoyee", date_echeance: "2026-09-01" }, "2026-09-18")).toBe("retard");
    expect(statutAffichageFacture({ statut: "envoyee", date_echeance: "2026-09-30" }, "2026-09-18")).toBe("envoyee");
    expect(statutAffichageFacture({ statut: "payee", date_echeance: "2026-09-01" }, "2026-09-18")).toBe("payee");
    expect(statutAffichageFacture({ statut: "brouillon" }, "2026-09-18", { ventilee: true })).toBe("ventilee");
    expect(statutAffichageFacture({ statut: "annulee" }, "2026-09-18", { ventilee: true })).toBe("annulee");
  });
});
