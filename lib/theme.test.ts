import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACCENT,
  BORDURE_BLEUE,
  CLAIR,
  COULEURS_GRAPHIQUES,
  FOND_PALE,
  MARINE,
  PRINCIPAL,
  SIGNATURE,
  SUCCES,
  TEXTE,
} from "./theme";

/* --- Outils couleur (WCAG 2.1) ---------------------------------------- */

function versRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = versRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste entre deux couleurs, de 1:1 à 21:1. */
export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

function versHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = versRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    h =
      max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const BLANC = "#ffffff";

/* --- Contrastes ------------------------------------------------------- */

describe("accessibilité : ce qui peut porter du texte", () => {
  it("le marine est lisible partout (AAA sur blanc)", () => {
    expect(contraste(MARINE, BLANC)).toBeGreaterThanOrEqual(7);
  });

  it("le principal porte du texte blanc (AA)", () => {
    expect(contraste(PRINCIPAL, BLANC)).toBeGreaterThanOrEqual(4.5);
  });

  it("le marine reste lisible sur le bleu clair (AAA)", () => {
    expect(contraste(MARINE, CLAIR)).toBeGreaterThanOrEqual(7);
  });

  it("le texte courant reste lisible sur les fonds pâles", () => {
    expect(contraste(TEXTE, FOND_PALE)).toBeGreaterThanOrEqual(7);
    expect(contraste(TEXTE, CLAIR)).toBeGreaterThanOrEqual(7);
  });

  /**
   * Ces trois couleurs sont trop claires pour du texte sur blanc. Le
   * test l'ACTE plutôt que de l'ignorer : si quelqu'un les éclaircit
   * encore, rien ne change ; si quelqu'un croit pouvoir les utiliser
   * en texte, le commentaire et ce test le détrompent.
   */
  it("signature, accent et clair sont trop pâles pour du texte sur blanc", () => {
    expect(contraste(SIGNATURE, BLANC)).toBeLessThan(4.5);
    expect(contraste(ACCENT, BLANC)).toBeLessThan(4.5);
    expect(contraste(CLAIR, BLANC)).toBeLessThan(4.5);
  });

  it("les bordures bleues restent visibles sans faire de barre noire", () => {
    const c = contraste(BORDURE_BLEUE, BLANC);
    expect(c).toBeGreaterThan(1.1);
    expect(c).toBeLessThan(3);
  });
});

describe("palette des graphiques", () => {
  it("commence par les trois bleus de la marque, du foncé au clair", () => {
    expect(COULEURS_GRAPHIQUES.slice(0, 3)).toEqual([
      MARINE,
      PRINCIPAL,
      ACCENT,
    ]);
  });

  it("chaque série se distingue de la précédente en niveaux de gris", () => {
    // Impression noir et blanc : deux séries voisines de luminance
    // trop proche deviennent la même barre.
    for (let i = 1; i < COULEURS_GRAPHIQUES.length; i++) {
      const ecart = Math.abs(
        luminance(COULEURS_GRAPHIQUES[i]) - luminance(COULEURS_GRAPHIQUES[i - 1]),
      );
      expect(ecart).toBeGreaterThan(0.02);
    }
  });

  it("aucun doublon", () => {
    expect(new Set(COULEURS_GRAPHIQUES).size).toBe(COULEURS_GRAPHIQUES.length);
  });
});

/* --- Cohérence entre les deux sources de vérité ----------------------- */

/**
 * L'interface web lit les variables CSS, les PDF et les e-mails lisent
 * lib/theme. Deux sources, donc deux occasions de diverger : ce test
 * est ce qui garantit qu'un changement de charte reste un changement
 * unique et non une chasse aux oublis.
 */
describe("le web et les documents partagent la même palette", () => {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

  // On découpe sur l'ouverture du bloc « .dark { », pas sur « .dark » :
  // le mot apparaît aussi dans le commentaire d'en-tête, et la portée
  // du mode clair se retrouvait alors vide.
  const debutDark = css.indexOf(".dark {");

  function variableCss(nom: string, dansLeDark = false): string {
    const portee = dansLeDark
      ? css.slice(debutDark)
      : css.slice(0, debutDark);
    const m = portee.match(new RegExp(`--${nom}:\\s*([^;]+);`));
    if (!m) throw new Error(`Variable --${nom} introuvable`);
    return m[1].trim();
  }

  it("--primary vaut exactement le bleu principal", () => {
    const { h, s, l } = versHsl(PRINCIPAL);
    expect(variableCss("primary")).toBe(`${h} ${s}% ${l}%`);
  });

  it("--ring suit --primary", () => {
    expect(variableCss("ring")).toBe(variableCss("primary"));
  });

  it("--accent-foreground vaut le marine", () => {
    const { h, s, l } = versHsl(MARINE);
    expect(variableCss("accent-foreground")).toBe(`${h} ${s}% ${l}%`);
  });

  it("le texte blanc des boutons est bien déclaré", () => {
    expect(variableCss("primary-foreground")).toBe("0 0% 100%");
  });

  it("plus aucune trace du vert de marque dans le thème web", () => {
    expect(css).not.toContain("154 50%");
    expect(css).not.toContain("2A7D5B");
  });

  it("le mode sombre garde un primaire plus clair que le mode clair", () => {
    // Sur fond très sombre, le bleu du mode clair devient illisible.
    const clair = Number(variableCss("primary").split(" ")[2].replace("%", ""));
    const sombre = Number(
      variableCss("primary", true).split(" ")[2].replace("%", ""),
    );
    expect(sombre).toBeGreaterThan(clair);
  });
});

/* --- Garde-fou : plus de couleur de marque recopiée ------------------- */

describe("garde-fou : la palette n'est plus recopiée ailleurs", () => {
  const RACINE = join(__dirname, "..");
  const FICHIERS = [
    "components/devis/devis-pdf.tsx",
    "components/devis/devis-pdf-simple.tsx",
    "components/factures/facture-pdf.tsx",
    "components/contrats/contrat-pdf.tsx",
    "components/dashboard/ca-mensuel-chart.tsx",
    "components/dashboard/repartition-activite-chart.tsx",
    "lib/email.ts",
  ];

  for (const fichier of FICHIERS) {
    it(`${fichier} importe la palette au lieu de la recopier`, () => {
      const contenu = readFileSync(join(RACINE, fichier), "utf8");
      const code = contenu
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(code).toContain("@/lib/theme");
      expect(code).not.toContain("#2A7D5B");
      // Les hexadécimaux de la marque ne doivent plus apparaître en
      // clair : ils viennent tous du module.
      for (const couleur of [MARINE, PRINCIPAL, SIGNATURE, ACCENT, CLAIR]) {
        expect(code).not.toContain(couleur);
      }
    });
  }

  it("le vert de succès se distingue du bleu par la TEINTE", () => {
    // Le rapport de contraste ne convient pas ici : il mesure une
    // différence de luminance, et ces deux couleurs sont presque aussi
    // sombres l'une que l'autre. Ce qui les sépare à l'œil, c'est la
    // teinte — c'est donc elle qu'on mesure.
    const ecart = Math.abs(versHsl(SUCCES).h - versHsl(PRINCIPAL).h);
    expect(Math.min(ecart, 360 - ecart)).toBeGreaterThan(60);
  });
});
