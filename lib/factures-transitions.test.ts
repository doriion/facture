import { describe, expect, it } from "vitest";

import {
  estFactureVentilee,
  montantAvoirAutorise,
  montantAvoirMax,
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

describe("avoirs", () => {
  const base = { totalFacture: 1000, totalEncaisse: 0, avoirsImputes: 0, avoirsRembourses: 0 };

  it("plafond : imputation = reste dû, remboursement = encaissé non rendu", () => {
    expect(montantAvoirMax("imputation", base)).toBe(1000);
    expect(montantAvoirMax("imputation", { ...base, totalEncaisse: 300, avoirsImputes: 200 })).toBe(500);
    expect(montantAvoirMax("remboursement", base)).toBe(0);
    expect(montantAvoirMax("remboursement", { ...base, totalEncaisse: 1000, avoirsRembourses: 250 })).toBe(750);
    expect(montantAvoirMax("imputation", { ...base, totalEncaisse: 1200 })).toBe(0);
  });

  it("refuse brouillon, annulée, ventilée, avoir sur avoir, montant nul", () => {
    const ctx = { ...base, statutFacture: "envoyee" };
    expect(montantAvoirAutorise("imputation", 100, { ...ctx, statutFacture: "brouillon" }).ok).toBe(false);
    expect(montantAvoirAutorise("imputation", 100, { ...ctx, statutFacture: "annulee" }).ok).toBe(false);
    expect(montantAvoirAutorise("imputation", 100, { ...ctx, ventilee: true }).ok).toBe(false);
    expect(montantAvoirAutorise("imputation", 100, { ...ctx, typeFacture: "avoir" }).ok).toBe(false);
    expect(montantAvoirAutorise("imputation", 0, ctx).ok).toBe(false);
  });

  it("respecte le plafond du mode (un centime d'arrondi toléré)", () => {
    const ctx = { ...base, statutFacture: "envoyee" };
    expect(montantAvoirAutorise("imputation", 1000, ctx).ok).toBe(true);
    expect(montantAvoirAutorise("imputation", 1000.01, ctx).ok).toBe(true);
    expect(montantAvoirAutorise("imputation", 1000.5, ctx).ok).toBe(false);
    const r = montantAvoirAutorise("remboursement", 50, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/imputation/);
    expect(
      montantAvoirAutorise("remboursement", 400, { ...ctx, statutFacture: "payee", totalEncaisse: 1000 }).ok,
    ).toBe(true);
  });

  it("un avoir émis ne revient pas en brouillon, il s'annule", () => {
    expect(transitionFactureAutorisee("envoyee", "brouillon", { typeFacture: "avoir" }).ok).toBe(false);
    expect(transitionFactureAutorisee("envoyee", "annulee", { typeFacture: "avoir" }).ok).toBe(true);
    expect(transitionFactureAutorisee("brouillon", "envoyee", { typeFacture: "avoir" }).ok).toBe(true);
    expect(transitionFactureAutorisee("annulee", "brouillon", { typeFacture: "avoir" }).ok).toBe(true);
  });

  it("paiement : refusé sur un avoir imputé ou en brouillon, accepté en remboursement émis", () => {
    const ctx = { resteDu: 100, montant: 100, typeFacture: "avoir" };
    expect(paiementAutorise("envoyee", { ...ctx, modeAvoir: "imputation" }).ok).toBe(false);
    expect(paiementAutorise("brouillon", { ...ctx, modeAvoir: "remboursement" }).ok).toBe(false);
    expect(paiementAutorise("envoyee", { ...ctx, modeAvoir: "remboursement" }).ok).toBe(true);
  });

  it("les avoirs ne ventilent pas la facture d'origine", () => {
    expect(estFactureVentilee({ type_facture: "normale" }, [{ statut: "envoyee", type_facture: "avoir" }])).toBe(false);
    expect(
      estFactureVentilee({ type_facture: "normale" }, [
        { statut: "envoyee", type_facture: "avoir" },
        { statut: "envoyee", type_facture: "acompte" },
      ]),
    ).toBe(true);
  });

  it("statut affiché d'un avoir : émis / à rembourser / remboursé, jamais en retard", () => {
    const hier = "2026-09-01";
    expect(statutAffichageFacture({ statut: "envoyee", date_echeance: hier, type_facture: "avoir", mode_avoir: "imputation" }, "2026-09-18")).toBe("avoir_emis");
    expect(statutAffichageFacture({ statut: "envoyee", date_echeance: hier, type_facture: "avoir", mode_avoir: "remboursement" }, "2026-09-18")).toBe("avoir_a_rembourser");
    expect(statutAffichageFacture({ statut: "payee", type_facture: "avoir", mode_avoir: "remboursement" }, "2026-09-18")).toBe("avoir_rembourse");
    expect(statutAffichageFacture({ statut: "brouillon", type_facture: "avoir", mode_avoir: "imputation" }, "2026-09-18", { ventilee: true })).toBe("brouillon");
    expect(statutAffichageFacture({ statut: "annulee", type_facture: "avoir", mode_avoir: "imputation" }, "2026-09-18")).toBe("annulee");
  });
});
