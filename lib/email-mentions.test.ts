import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MENTION_TVA_FRANCHISE_CGI,
  MENTION_TVA_FRANCHISE_CIBS,
  mentionTvaFranchise,
} from "./legal-text";

/**
 * Les e-mails partent MAINTENANT : leur pied de page doit porter la
 * rédaction en vigueur au moment de l'envoi, pas celle figée dans le
 * code à l'écriture du gabarit.
 *
 * Le fichier lib/email.ts n'est pas testable en unité tel quel (il
 * instancie le client Resend au chargement), d'où un contrôle
 * statique : c'est le même garde-fou que celui posé sur les devis et
 * les contrats, et il suffit à empêcher la régression visée.
 */
describe("garde-fou : aucune mention de TVA en dur dans les e-mails", () => {
  const source = readFileSync(join(__dirname, "email.ts"), "utf8");
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("le gabarit reprend la valeur centralisée", () => {
    expect(code).toContain("mentionTvaFranchise(");
    expect(code).toContain("${escapeHtml(mentionTva)}");
    expect(code).toContain("${mentionTva}");
  });

  it("aucune rédaction n'est recopiée dans le fichier", () => {
    expect(code).not.toContain("293 B");
    expect(code).not.toContain("L. 223-3");
    expect(code).not.toContain("TVA non applicable");
  });

  it("la version HTML échappe la mention, comme le reste du gabarit", () => {
    // La mention vient du code, pas d'une saisie — mais l'échappement
    // reste la règle du fichier, et une future mention pourrait citer
    // un caractère à échapper.
    expect(code).toContain("escapeHtml(mentionTva)");
  });
});

describe("la mention envoyée suit la date du jour", () => {
  it("aujourd'hui, c'est la rédaction CIBS", () => {
    expect(mentionTvaFranchise()).toBe(MENTION_TVA_FRANCHISE_CIBS);
  });

  it("la fonction reste capable de rendre l'ancienne rédaction", () => {
    // Elle sert encore aux documents antérieurs à la bascule ; ce test
    // casse si quelqu'un supprime la branche historique.
    expect(mentionTvaFranchise("2026-05-11")).toBe(MENTION_TVA_FRANCHISE_CGI);
  });
});
