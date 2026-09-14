/**
 * Choix clair / sombre / système. Logique PURE, testée dans
 * theme-mode.test.ts : les composants ne font que l'appliquer.
 *
 * Les couleurs des deux modes existent déjà dans app/globals.css ; il
 * ne manquait que de quoi poser la classe `.dark` sur le document.
 */

export type PreferenceTheme = "clair" | "sombre" | "systeme";

/** Clé de stockage local. Nommée pour ne pas entrer en collision. */
export const CLE_THEME = "facture-ae:theme";

/** Classe posée sur <html>, imposée par la configuration Tailwind. */
export const CLASSE_SOMBRE = "dark";

/** Par défaut on suit le système : c'est le choix que l'utilisateur
 *  a déjà fait au niveau de son ordinateur, inutile de le redemander. */
export const PREFERENCE_DEFAUT: PreferenceTheme = "systeme";

const VALEURS: PreferenceTheme[] = ["clair", "sombre", "systeme"];

/**
 * Lecture défensive d'une valeur stockée : un stockage vidé, corrompu
 * ou écrit par une version antérieure ne doit jamais casser l'affichage.
 */
export function preferenceValide(valeur: unknown): PreferenceTheme {
  return VALEURS.includes(valeur as PreferenceTheme)
    ? (valeur as PreferenceTheme)
    : PREFERENCE_DEFAUT;
}

/** Le mode réellement appliqué, une fois « système » résolu. */
export function themeEffectif(
  preference: PreferenceTheme,
  systemeEstSombre: boolean,
): "clair" | "sombre" {
  if (preference === "clair") return "clair";
  if (preference === "sombre") return "sombre";
  return systemeEstSombre ? "sombre" : "clair";
}

/** Libellés de l'interface. */
export const LABELS_THEME: Record<PreferenceTheme, string> = {
  clair: "Clair",
  sombre: "Sombre",
  systeme: "Système",
};

/**
 * Script injecté dans le <head>, exécuté AVANT le premier rendu.
 *
 * Sans lui, la page s'affiche en clair puis bascule en sombre une fois
 * React monté : un éclair blanc en pleine figure, exactement ce qu'on
 * cherche à éviter quand on travaille le soir.
 *
 * Il est volontairement autonome et silencieux : un stockage
 * inaccessible (navigation privée, cookies bloqués) ne doit pas
 * empêcher la page de s'afficher.
 */
export function scriptAppliquerTheme(): string {
  return `(function(){try{
var p=localStorage.getItem(${JSON.stringify(CLE_THEME)});
var s=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
var sombre = p==="sombre" || ((p==null||p==="systeme") && s);
document.documentElement.classList.toggle(${JSON.stringify(CLASSE_SOMBRE)}, !!sombre);
}catch(e){}})();`;
}
