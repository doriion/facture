import { describe, expect, it } from "vitest";

import {
  cerfaOptionsDepuisFiche,
  descriptionDepuisFiche,
  interventionPourCerfa,
  libelleEquipement,
  libelleReserves,
  etatLienFiche,
  ficheGazSchema,
  manipulationsDepuisJson,
  numeroFiche,
  totauxManipulations,
  typeInterventionDepuisNatures,
} from "./fiches-gaz";

describe("manipulations de fluide", () => {
  it("totaux par type et par nature, arrondis au gramme", () => {
    const t = totauxManipulations([
      { type: "injection", nature: "vierge", kg: 0.68 },
      { type: "injection", nature: "recycle", kg: 0.1 },
      { type: "recuperation", nature: "traitement", kg: 0.25 },
    ]);
    expect(t).toEqual({ ajoute: 0.78, recupere: 0.25, vierge: 0.68, recycle: 0.1, regenere: 0, traitement: 0.25, reutilisation: 0 });
  });
  it("JSON abîmé : lignes invalides ignorées", () => {
    expect(manipulationsDepuisJson([{ type: "injection", nature: "vierge", kg: "1,5" }, { type: "x" }, null])).toEqual([
      { type: "injection", nature: "vierge", kg: 1.5 },
    ]);
    // Une récupération « vierge » n'a pas de sens : ignorée.
    expect(manipulationsDepuisJson([{ type: "recuperation", nature: "vierge", kg: 1 }])).toEqual([]);
    expect(manipulationsDepuisJson("rien")).toEqual([]);
  });
});

describe("numéro et type", () => {
  it("numéro AAMMJJ, suffixe à partir de la deuxième fiche du jour", () => {
    expect(numeroFiche("2026-10-30", 1)).toBe("261030");
    expect(numeroFiche("2026-10-30", 2)).toBe("261030-2");
  });
  it("type d'intervention déduit des natures", () => {
    expect(typeInterventionDepuisNatures(["assemblage", "mise_en_service"])).toBe("installation");
    expect(typeInterventionDepuisNatures(["maintenance"])).toBe("entretien");
    expect(typeInterventionDepuisNatures(["controle_non_periodique"])).toBe("depannage");
    expect(typeInterventionDepuisNatures([])).toBe("autre");
  });
});

describe("options CERFA depuis la fiche", () => {
  it("natures, détection permanente et ventilation A–E sans ressaisie", () => {
    const o = cerfaOptionsDepuisFiche({
      fiche_numero: "261030",
      natures_cerfa: ["mise_en_service", "inconnue"],
      detection_permanente: false,
      fluide_manipulations: [
        { type: "injection", nature: "vierge", kg: 0.68 },
        { type: "recuperation", nature: "reutilisation", kg: 0.2 },
      ],
    });
    expect(o.ficheNumero).toBe("261030");
    expect(o.natures).toEqual(["mise_en_service"]);
    expect(o.chargeViergeKg).toBe(0.68);
    expect(o.recupereReutilisationKg).toBe(0.2);
    expect(o.recupereTraitementKg).toBe(0);
  });
});

describe("ficheGazSchema", () => {
  it("client et date obligatoires, nombres tolérants à la virgule", () => {
    const r = ficheGazSchema.safeParse({
      client_id: "11111111-1111-4111-8111-111111111111",
      date_intervention: "2026-10-30",
      natures_cerfa: ["mise_en_service"],
      fluide_frigo_type: "R32",
      fluide_charge_totale_kg: "0,68",
      fluide_manipulations: [],
      detection_permanente: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fluide_charge_totale_kg).toBe(0.68);
    expect(ficheGazSchema.safeParse({ client_id: "", date_intervention: "2026-10-30" }).success).toBe(false);
  });
});

describe("etatLienFiche", () => {
  const it0 = { signature_token: "jeton-0123456789abcdef", signature_token_expires_at: "2026-11-30T00:00:00.000Z", supprime_le: null };
  it("utilisable, signé, expiré, introuvable", () => {
    expect(etatLienFiche(it0, false, "2026-10-30T00:00:00.000Z")).toBe("utilisable");
    expect(etatLienFiche(it0, true, "2026-10-30T00:00:00.000Z")).toBe("signe");
    expect(etatLienFiche(it0, false, "2026-12-01T00:00:00.000Z")).toBe("expire");
    expect(etatLienFiche({ ...it0, supprime_le: "2026-10-30T00:00:00.000Z" }, false, "2026-10-30T00:00:00.000Z")).toBe("introuvable");
    expect(etatLienFiche(null, false, "2026-10-30T00:00:00.000Z")).toBe("introuvable");
  });
});

describe("libellés et intervention pour le CERFA", () => {
  it("libelleEquipement / libelleReserves / descriptionDepuisFiche", () => {
    expect(libelleEquipement({ equipement_type: "climatisation", equipement_marque: "Daikin", equipement_repere: "UE1" })).toBe("Climatisation Daikin — repère UE1");
    expect(libelleEquipement({ equipement_type: null, equipement_marque: null, equipement_repere: null })).toBeNull();
    expect(libelleReserves("sans", null)).toBe("Sans réserve");
    expect(libelleReserves("avec", " grille à refixer ")).toBe("Avec réserves : grille à refixer");
    expect(libelleReserves(null, null)).toBe("Réserves non renseignées");
    expect(descriptionDepuisFiche({ bon_objet: "Fourniture et pose d'une climatisation", natures_cerfa: [], equipement_type: null })).toBe("Fourniture et pose d'une climatisation");
    expect(descriptionDepuisFiche({ bon_objet: "", natures_cerfa: ["mise_en_service", "assemblage"], equipement_type: "pompe_a_chaleur" })).toBe("Mise en service, Assemblage — pompe à chaleur");
    expect(descriptionDepuisFiche({ bon_objet: null, natures_cerfa: [], equipement_type: null })).toBe("Fiche fluides frigorigènes");
  });
  it("interventionPourCerfa : contrôle réputé fait avec un détecteur, localisation nettoyée", () => {
    const base = {
      description: "Travaux",
      equipement_type: "pompe_a_chaleur",
      equipement_repere: "PAC garage",
      etancheite_controle: null,
      etancheite_detecteur: "TIF XP-1A",
      etancheite_fuite: true,
      etancheite_fuite_localisation: "raccord UE",
      fuite_reparation: "realisee",
      natures_cerfa: ["mise_en_service"],
    };
    const r = interventionPourCerfa(base);
    expect(r.description).toBe("Pompe à chaleur — repère PAC garage");
    expect(r.etancheite_controle).toBe(true);
    expect(r.etancheite_fuite_localisation).toBe("raccord UE");
    expect(r.fuite_reparation).toBe("realisee");
    // Sans détecteur ni contrôle : rien n'est inventé.
    const sans = interventionPourCerfa({ ...base, etancheite_detecteur: null, etancheite_fuite: null, etancheite_fuite_localisation: null, fuite_reparation: null });
    expect(sans.etancheite_controle).toBeNull();
    expect(sans.etancheite_fuite_localisation).toBeNull();
  });
});
