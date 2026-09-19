import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DATE_BASCULE_MENTION_CIBS,
  MENTION_TVA_FRANCHISE_CGI,
  MENTION_TVA_FRANCHISE_CIBS,
  mentionTvaFranchise,
} from "./legal-text";

describe("mentionTvaFranchise (recodification CGI → CIBS, bascule au 01/09/2026)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("garde l'ancienne mention CGI pour les documents émis AVANT le 01/09/2026", () => {
    expect(mentionTvaFranchise("2026-05-11")).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(mentionTvaFranchise("2026-08-31")).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(mentionTvaFranchise("2024-01-01")).toBe(MENTION_TVA_FRANCHISE_CGI);
  });

  it("applique la mention CIBS à partir du 01/09/2026 inclus", () => {
    expect(mentionTvaFranchise("2026-09-01")).toBe(MENTION_TVA_FRANCHISE_CIBS);
    expect(mentionTvaFranchise("2026-09-15")).toBe(MENTION_TVA_FRANCHISE_CIBS);
    expect(mentionTvaFranchise("2026-12-31")).toBe(MENTION_TVA_FRANCHISE_CIBS);
    expect(mentionTvaFranchise("2027-03-15")).toBe(MENTION_TVA_FRANCHISE_CIBS);
  });

  it("utilise la date du jour si aucune date d'émission n'est fournie", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-07-06T10:00:00Z"));
    expect(mentionTvaFranchise()).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(mentionTvaFranchise(null)).toBe(MENTION_TVA_FRANCHISE_CGI);

    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    expect(mentionTvaFranchise()).toBe(MENTION_TVA_FRANCHISE_CIBS);
    expect(mentionTvaFranchise(null)).toBe(MENTION_TVA_FRANCHISE_CIBS);
  });

  it("expose les rédactions légales exactes", () => {
    expect(DATE_BASCULE_MENTION_CIBS).toBe("2026-09-01");
    expect(MENTION_TVA_FRANCHISE_CGI).toBe("TVA non applicable, art. 293 B du CGI");
    expect(MENTION_TVA_FRANCHISE_CIBS).toBe(
      "TVA non applicable, article L. 223-3 du Code des impositions sur les biens et les services (CIBS)",
    );
  });
});

describe("mentions ajoutées le 19/09/2026", () => {
  it("pénalités : 40 € seulement entre professionnels, texte perso prioritaire", async () => {
    const { mentionPenalitesRetard, MENTION_PENALITES_RETARD_DEFAULT, MENTION_PENALITES_RETARD_PARTICULIER } =
      await import("./legal-text");
    expect(mentionPenalitesRetard(null, "professionnel")).toBe(MENTION_PENALITES_RETARD_DEFAULT);
    expect(mentionPenalitesRetard(null, "particulier")).toBe(MENTION_PENALITES_RETARD_PARTICULIER);
    expect(mentionPenalitesRetard(null, "particulier")).not.toMatch(/40 €/);
    expect(mentionPenalitesRetard("Mon texte", "particulier")).toBe("Mon texte");
  });

  it("rétractation : hors établissement et à distance, rien en établissement", async () => {
    const { mentionRetractation } = await import("./legal-text");
    expect(mentionRetractation("hors_etablissement")).toMatch(/hors établissement/);
    expect(mentionRetractation("distance")).toMatch(/à distance/);
    expect(mentionRetractation("etablissement")).toBeNull();
    expect(mentionRetractation(null)).toBeNull();
  });

  it("décennale : pas de zone inventée, rien au-delà de la validité", async () => {
    const { mentionDecennale, estExpiree } = await import("./legal-text");
    const base = { numero: "D-1", assureur: "ERGO" };
    expect(mentionDecennale(base)).toBe("Assurance décennale n° D-1 souscrite auprès de ERGO.");
    expect(mentionDecennale({ ...base, zone: "Isère" })).toMatch(/couvrant le territoire : Isère\.$/);
    expect(mentionDecennale({ ...base, valideJusquau: "2026-01-01", dateDocument: "2026-09-19" })).toBeNull();
    expect(mentionDecennale({ ...base, valideJusquau: "2027-01-01", dateDocument: "2026-09-19" })).not.toBeNull();
    expect(estExpiree(null, "2026-09-19")).toBe(false);
    expect(estExpiree("2026-09-18", "2026-09-19")).toBe(true);
    expect(estExpiree("2026-09-19", "2026-09-19")).toBe(false);
  });

  it("fluides : rien au-delà de la validité", async () => {
    const { mentionFluidesFrigo } = await import("./legal-text");
    expect(mentionFluidesFrigo("F-1", { valideJusquau: "2026-01-01", dateDocument: "2026-09-19" })).toBeNull();
    expect(mentionFluidesFrigo("F-1", { valideJusquau: "2027-01-01", dateDocument: "2026-09-19" })).toMatch(/F-1/);
  });
});
