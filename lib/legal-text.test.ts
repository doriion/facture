import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DATE_BASCULE_MENTION_CIBS,
  MENTION_TVA_FRANCHISE_CGI,
  MENTION_TVA_FRANCHISE_CIBS,
  mentionTvaFranchise,
} from "./legal-text";

describe("mentionTvaFranchise (recodification CGI → CIBS, bascule prudente au 01/01/2027)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("garde l'ancienne mention CGI pour les documents émis avant le 01/01/2027 (tolérée jusqu'au 31/12/2027)", () => {
    expect(mentionTvaFranchise("2026-05-11")).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(mentionTvaFranchise("2026-09-15")).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(mentionTvaFranchise("2026-12-31")).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(mentionTvaFranchise("2024-01-01")).toBe(MENTION_TVA_FRANCHISE_CGI);
  });

  it("applique la mention CIBS à partir du 01/01/2027 inclus", () => {
    expect(mentionTvaFranchise("2027-01-01")).toBe(MENTION_TVA_FRANCHISE_CIBS);
    expect(mentionTvaFranchise("2027-03-15")).toBe(MENTION_TVA_FRANCHISE_CIBS);
  });

  it("utilise la date du jour si aucune date d'émission n'est fournie", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-07-06T10:00:00Z"));
    expect(mentionTvaFranchise()).toBe(MENTION_TVA_FRANCHISE_CGI);
    expect(mentionTvaFranchise(null)).toBe(MENTION_TVA_FRANCHISE_CGI);

    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    expect(mentionTvaFranchise()).toBe(MENTION_TVA_FRANCHISE_CIBS);
    expect(mentionTvaFranchise(null)).toBe(MENTION_TVA_FRANCHISE_CIBS);
  });

  it("expose les rédactions légales exactes", () => {
    expect(DATE_BASCULE_MENTION_CIBS).toBe("2027-01-01");
    expect(MENTION_TVA_FRANCHISE_CGI).toBe("TVA non applicable, art. 293 B du CGI");
    expect(MENTION_TVA_FRANCHISE_CIBS).toBe(
      "TVA non applicable, article L. 223-3 du Code des impositions sur les biens et les services (CIBS)",
    );
  });
});
