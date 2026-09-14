import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CLASSE_SOMBRE,
  CLE_THEME,
  LABELS_THEME,
  PREFERENCE_DEFAUT,
  preferenceValide,
  scriptAppliquerTheme,
  themeEffectif,
} from "./theme-mode";

describe("preferenceValide : lecture défensive du stockage", () => {
  it("accepte les trois valeurs prévues", () => {
    expect(preferenceValide("clair")).toBe("clair");
    expect(preferenceValide("sombre")).toBe("sombre");
    expect(preferenceValide("systeme")).toBe("systeme");
  });

  it("retombe sur le défaut pour tout le reste", () => {
    // Stockage vidé, corrompu, ou écrit par une version antérieure :
    // l'affichage ne doit jamais en dépendre.
    for (const v of [null, undefined, "", "dark", "AUTO", 42, {}, []]) {
      expect(preferenceValide(v)).toBe(PREFERENCE_DEFAUT);
    }
  });

  it("le défaut suit le système", () => {
    expect(PREFERENCE_DEFAUT).toBe("systeme");
  });
});

describe("themeEffectif", () => {
  it("un choix explicite ignore le système", () => {
    expect(themeEffectif("clair", true)).toBe("clair");
    expect(themeEffectif("clair", false)).toBe("clair");
    expect(themeEffectif("sombre", false)).toBe("sombre");
    expect(themeEffectif("sombre", true)).toBe("sombre");
  });

  it("« système » suit la préférence de l'ordinateur", () => {
    expect(themeEffectif("systeme", true)).toBe("sombre");
    expect(themeEffectif("systeme", false)).toBe("clair");
  });
});

describe("libellés", () => {
  it("les trois choix sont nommés en français", () => {
    expect(LABELS_THEME).toEqual({
      clair: "Clair",
      sombre: "Sombre",
      systeme: "Système",
    });
  });
});

/**
 * Le script anti-scintillement est du texte injecté tel quel dans la
 * page : on ne peut pas le typer, donc on vérifie ce qu'il contient et
 * ce qu'il fait, en l'exécutant sur un document simulé.
 */
describe("script anti-scintillement", () => {
  const script = scriptAppliquerTheme();

  it("cite la vraie clé de stockage et la vraie classe", () => {
    expect(script).toContain(JSON.stringify(CLE_THEME));
    expect(script).toContain(JSON.stringify(CLASSE_SOMBRE));
  });

  it("est enveloppé dans un try/catch : un stockage bloqué n'a pas d'effet", () => {
    // Navigation privée, cookies refusés : localStorage peut lever.
    expect(script).toContain("try{");
    expect(script).toContain("catch");
  });

  it("ne contient ni balise fermante ni saut hors chaîne qui casserait le HTML", () => {
    expect(script).not.toContain("</script");
  });

  /** Exécute le script dans un faux document et renvoie l'état final. */
  function executer(stocke: string | null, systemeSombre: boolean): boolean {
    let sombre = false;
    const faux = {
      localStorage: { getItem: () => stocke },
      matchMedia: () => ({ matches: systemeSombre }),
      document: {
        documentElement: {
          classList: {
            toggle: (_c: string, v: boolean) => {
              sombre = v;
            },
          },
        },
      },
    };
    new Function(
      "window",
      "localStorage",
      "document",
      script.replace(/window\./g, "window."),
    )(faux, faux.localStorage, faux.document);
    return sombre;
  }

  it("choix explicite « sombre » → classe posée, quel que soit le système", () => {
    expect(executer("sombre", false)).toBe(true);
    expect(executer("sombre", true)).toBe(true);
  });

  it("choix explicite « clair » → classe retirée, même si le système est sombre", () => {
    expect(executer("clair", true)).toBe(false);
  });

  it("sans choix enregistré, on suit le système", () => {
    expect(executer(null, true)).toBe(true);
    expect(executer(null, false)).toBe(false);
    expect(executer("systeme", true)).toBe(true);
    expect(executer("systeme", false)).toBe(false);
  });
});

/**
 * GARDE-FOU : le mode sombre n'a d'intérêt que s'il est atteignable.
 * Avant ce lot, les couleurs existaient mais aucune ligne de code ne
 * posait jamais la classe — il était défini et inaccessible.
 */
describe("garde-fou : le mode sombre reste atteignable", () => {
  const RACINE = join(__dirname, "..");

  it("le script est bien injecté dans la mise en page racine", () => {
    const layout = readFileSync(join(RACINE, "app", "layout.tsx"), "utf8");
    expect(layout).toContain("scriptAppliquerTheme");
  });

  it("une bascule est présente dans la barre du haut", () => {
    const topbar = readFileSync(join(RACINE, "components", "topbar.tsx"), "utf8");
    expect(topbar).toContain("ThemeToggle");
  });

  it("les couleurs sombres existent toujours dans le thème", () => {
    const css = readFileSync(join(RACINE, "app", "globals.css"), "utf8");
    expect(css).toContain(".dark {");
    expect(css).toContain("--background: 222 14% 8%");
  });
});
