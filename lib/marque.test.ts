import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MONOGRAMME, NOM_APPLICATION, titrePage } from "./marque";

const RACINE = join(__dirname, "..");
const ANCIEN_NOM = "Facture AE";

function fichiers(dossier: string, extensions: string[]): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      sortie.push(...fichiers(chemin, extensions));
    } else if (extensions.some((e) => entree.endsWith(e))) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe("nom de l'application", () => {
  it("vaut NG Gestion", () => {
    expect(NOM_APPLICATION).toBe("NG Gestion");
  });

  it("le monogramme reprend les initiales", () => {
    expect(MONOGRAMME).toBe("NG");
  });

  it("titrePage compose « Section — Nom »", () => {
    expect(titrePage("Devis")).toBe("Devis — NG Gestion");
  });
});

/**
 * GARDE-FOU : l'ancien nom traînait dans une trentaine d'endroits, il
 * était impossible de savoir à l'œil s'il en restait. Ce test le dit.
 *
 * Périmètre (30/09/2026) : l'interface, les e-mails (clients et
 * récapitulatifs internes), les PDF (métadonnée « creator »), le flux
 * ICS et le code de lib/. Restent hors périmètre les noms TECHNIQUES
 * (paquet, routes, projet d'hébergement, `meta.app` de la sauvegarde
 * et noms de fichiers « sauvegarde-facture-ae-… », qui sont des
 * identifiants, pas des libellés).
 */
describe("garde-fou : plus d'ancien nom dans l'interface", () => {
  const CIBLES = [
    ...fichiers(join(RACINE, "app"), [".tsx", ".ts"]),
    ...fichiers(join(RACINE, "components"), [".tsx"]),
    ...fichiers(join(RACINE, "lib"), [".ts"]),
    ...fichiers(join(RACINE, "supabase", "functions"), [".ts"]),
  ].filter((f) => !f.endsWith("marque.test.ts"));

  it(`aucun « ${ANCIEN_NOM} » dans l'interface, les e-mails, les PDF, lib/ et le flux ICS`, () => {
    const fautifs = CIBLES.filter((f) =>
      readFileSync(f, "utf8").includes(ANCIEN_NOM),
    ).map((f) => f.replace(`${RACINE}/`, ""));
    expect(fautifs).toEqual([]);
  });

  it("le manifeste de l'application porte le nouveau nom", () => {
    const manifeste = JSON.parse(
      readFileSync(join(RACINE, "public", "manifest.json"), "utf8"),
    );
    expect(manifeste.short_name).toBe(NOM_APPLICATION);
    expect(manifeste.name).toContain(NOM_APPLICATION);
    expect(JSON.stringify(manifeste)).not.toContain(ANCIEN_NOM);
  });

  it("les endroits qui affichent le nom passent par la constante", () => {
    for (const f of [
      "components/sidebar.tsx",
      "components/topbar.tsx",
      "components/mobile-nav.tsx",
      "app/layout.tsx",
      "app/(auth)/login/page.tsx",
    ]) {
      expect(readFileSync(join(RACINE, f), "utf8")).toContain(
        "NOM_APPLICATION",
      );
    }
  });

  it("les anciennes icônes « F » et « NG » ne peuvent plus être servies", () => {
    // Un téléphone garde l'icône d'accueil en cache tant que son URL
    // existe : les anciens fichiers doivent avoir DISPARU, pas juste
    // avoir été redessinés.
    for (const ancien of [
      "favicon.svg",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
      "apple-touch-icon.png",
    ]) {
      expect(existsSync(join(RACINE, "public", ancien))).toBe(false);
    }
    // Convention de l'App Router : un app/favicon.ico est servi à
    // /favicon.ico AVANT public/, et il portait l'ancienne icône. Il
    // avait échappé à toutes les recherches dans public/ — c'est lui
    // que l'iPhone continuait d'afficher.
    expect(existsSync(join(RACINE, "app", "favicon.ico"))).toBe(false);
  });

  it("les icônes du logo original existent et sont référencées", () => {
    for (const f of [
      "icones/logo-192.png",
      "icones/logo-512.png",
      "icones/logo-maskable-512.png",
      "icones/logo-apple-180.png",
      "favicon.ico",
      "logo.png",
    ]) {
      expect(existsSync(join(RACINE, "public", f))).toBe(true);
    }
    // L'ancien tracé redessiné (logo.svg, icônes vague-*) a disparu :
    // il ne doit rester aucune référence, sinon un écran garde l'ancien dessin.
    for (const ancien of ["logo.svg", "icones/vague.svg", "icones/vague-192.png"]) {
      expect(existsSync(join(RACINE, "public", ancien))).toBe(false);
    }
    const manifeste = readFileSync(join(RACINE, "public", "manifest.json"), "utf8");
    const layout = readFileSync(join(RACINE, "app", "layout.tsx"), "utf8");
    const sw = readFileSync(join(RACINE, "public", "sw.js"), "utf8");
    const marque = readFileSync(join(RACINE, "components", "logo-marque.tsx"), "utf8");
    for (const ancien of ["icon-192", "icon-512", "icon-maskable", "apple-touch-icon", "favicon.svg", "vague"]) {
      expect(manifeste).not.toContain(ancien);
      expect(layout).not.toContain(ancien);
      expect(sw).not.toContain(`/icones/${ancien}`);
    }
    expect(manifeste).toContain("/icones/logo-maskable-512.png");
    expect(layout).toContain("/icones/logo-apple-180.png");
    expect(sw).toContain("/icones/logo-192.png");
    expect(marque).toContain('src="/logo.png"');
  });
});

/**
 * Les documents restent au nom légal de l'entreprise. Le nom du
 * logiciel n'a rien à y faire : c'est une mention obligatoire, pas
 * une marque.
 */
describe("les documents ne portent pas le nom du logiciel", () => {
  it("le modèle de devis affiche la raison sociale, pas l'application", () => {
    const source = readFileSync(
      join(RACINE, "lib", "devis-modele.ts"),
      "utf8",
    );
    expect(source).not.toContain(NOM_APPLICATION);
    expect(source).not.toContain(ANCIEN_NOM);
  });
});
