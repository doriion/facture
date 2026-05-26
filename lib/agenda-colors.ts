/**
 * Palette de couleurs pour l'agenda. Choix limité à 12 couleurs
 * Tailwind prédéfinies pour rester cohérent visuellement (mode clair
 * + sombre) et permettre la personnalisation par l'utilisateur sans
 * complexité de pickers hexadécimaux.
 *
 * Les couleurs sont stockées en base par leur slug ("emerald", "amber"...)
 * et résolues au rendu via `getColorClasses()`.
 */

export type PaletteColor =
  | "emerald"
  | "amber"
  | "blue"
  | "red"
  | "violet"
  | "cyan"
  | "rose"
  | "indigo"
  | "yellow"
  | "orange"
  | "fuchsia"
  | "slate";

export const PALETTE_LABELS: Record<PaletteColor, string> = {
  emerald: "Vert",
  amber: "Ambre",
  blue: "Bleu",
  red: "Rouge",
  violet: "Violet",
  cyan: "Cyan",
  rose: "Rose",
  indigo: "Indigo",
  yellow: "Jaune",
  orange: "Orange",
  fuchsia: "Fuchsia",
  slate: "Gris",
};

export const PALETTE_ORDER: PaletteColor[] = [
  "emerald", "amber", "blue", "red", "violet", "cyan",
  "rose", "indigo", "yellow", "orange", "fuchsia", "slate",
];

/**
 * IMPORTANT : ne pas générer les noms de classes dynamiquement
 * (ex: `bg-${color}-100`) — le Tailwind JIT ne les détecterait pas
 * à la compilation. On garde un mapping statique et complet.
 */
const CLASSES: Record<PaletteColor, string> = {
  emerald:
    "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100",
  amber:
    "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100",
  blue:
    "bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-100",
  red:
    "bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-100",
  violet:
    "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-100",
  cyan:
    "bg-cyan-100 text-cyan-900 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100",
  rose:
    "bg-rose-100 text-rose-900 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-100",
  indigo:
    "bg-indigo-100 text-indigo-900 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100",
  yellow:
    "bg-yellow-100 text-yellow-900 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100",
  orange:
    "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-100",
  fuchsia:
    "bg-fuchsia-100 text-fuchsia-900 hover:bg-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-100",
  slate:
    "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200",
};

/** Classes Tailwind pour la pastille dans le sélecteur / la légende. */
const SWATCH_CLASSES: Record<PaletteColor, string> = {
  emerald: "bg-emerald-200",
  amber: "bg-amber-200",
  blue: "bg-blue-200",
  red: "bg-red-200",
  violet: "bg-violet-200",
  cyan: "bg-cyan-200",
  rose: "bg-rose-200",
  indigo: "bg-indigo-200",
  yellow: "bg-yellow-200",
  orange: "bg-orange-200",
  fuchsia: "bg-fuchsia-200",
  slate: "bg-slate-300",
};

export type AgendaCategory =
  | "intervention_a_facturer"
  | "intervention_facturee"
  | "facture"
  | "devis"
  | "maintenance"
  | "external";

export const CATEGORY_LABELS: Record<AgendaCategory, string> = {
  intervention_a_facturer: "Intervention à facturer",
  intervention_facturee: "Intervention facturée",
  facture: "Facture (prestation)",
  devis: "Devis planifié",
  maintenance: "Visite maintenance",
  external: "Calendrier externe (téléphone)",
};

export type AgendaCouleurs = Record<AgendaCategory, PaletteColor>;

export const DEFAULT_AGENDA_COULEURS: AgendaCouleurs = {
  intervention_a_facturer: "amber",
  intervention_facturee: "emerald",
  facture: "blue",
  devis: "violet",
  maintenance: "cyan",
  external: "slate",
};

/**
 * Normalise une valeur stockée en base (qui peut être manquante, ou avoir
 * des clés étrangères) vers un objet complet.
 */
export function normalizeCouleurs(raw: unknown): AgendaCouleurs {
  const result: AgendaCouleurs = { ...DEFAULT_AGENDA_COULEURS };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of Object.keys(result) as AgendaCategory[]) {
      const v = o[k];
      if (typeof v === "string" && v in CLASSES) {
        result[k] = v as PaletteColor;
      }
    }
  }
  return result;
}

export function getColorClasses(color: PaletteColor): string {
  return CLASSES[color];
}

export function getSwatchClass(color: PaletteColor): string {
  return SWATCH_CLASSES[color];
}
