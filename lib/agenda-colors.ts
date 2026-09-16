/**
 * Couleurs de l'agenda — logique PURE, testée dans agenda-colors.test.ts.
 *
 * Chaque TYPE d'évènement a une couleur choisie par l'utilisateur
 * (profil_entreprise.agenda_couleurs, JSONB), et un évènement précis
 * peut avoir SA couleur (table agenda_couleurs_evenements) qui prime
 * sur celle de son type.
 *
 * Les couleurs sont des hex « #rrggbb » : palette proposée + choix
 * libre. Le texte d'un évènement est choisi automatiquement (sombre ou
 * clair) d'après la luminance du fond, pour rester lisible quelle que
 * soit la couleur — en mode clair comme en mode sombre, le fond de la
 * pastille étant opaque.
 *
 * Compatibilité : les anciens réglages stockaient des noms de couleurs
 * Tailwind (« emerald », « amber »…) ; ils sont toujours acceptés et
 * convertis vers leur hex.
 */

export type AgendaCategory =
  | "intervention_facturee"
  | "intervention_a_facturer"
  | "facture"
  | "retard"
  | "devis"
  | "maintenance"
  | "external"
  | "ferie"
  | "weekend";

/** Ordre d'affichage (réglages et légende). */
export const CATEGORY_ORDER: AgendaCategory[] = [
  "intervention_facturee",
  "intervention_a_facturer",
  "facture",
  "retard",
  "devis",
  "maintenance",
  "external",
  "ferie",
  "weekend",
];

export const CATEGORY_LABELS: Record<AgendaCategory, string> = {
  intervention_facturee: "Facturée / payée",
  intervention_a_facturer: "À facturer",
  facture: "Facture",
  retard: "En retard",
  devis: "Devis planifié",
  maintenance: "Maintenance",
  external: "📱 RDV iPhone à facturer",
  ferie: "Jour férié",
  weekend: "Week-end",
};

export type AgendaCouleurs = Record<AgendaCategory, string>;

/** Couleurs d'origine (teintes Tailwind 100, telles qu'affichées avant). */
export const DEFAULT_AGENDA_COULEURS: AgendaCouleurs = {
  intervention_facturee: "#d1fae5", // emerald
  intervention_a_facturer: "#fef3c7", // amber
  facture: "#dbeafe", // blue
  retard: "#fee2e2", // red
  devis: "#ede9fe", // violet
  maintenance: "#cffafe", // cyan
  external: "#fef3c7", // amber — même couleur que « à facturer »
  ferie: "#ffe4e6", // rose
  weekend: "#ffedd5", // orange
};

/** Palette proposée dans les réglages (choix libre possible en plus). */
export const PALETTE: Array<{ hex: string; label: string }> = [
  { hex: "#d1fae5", label: "Vert" },
  { hex: "#fef3c7", label: "Ambre" },
  { hex: "#dbeafe", label: "Bleu" },
  { hex: "#fee2e2", label: "Rouge" },
  { hex: "#ede9fe", label: "Violet" },
  { hex: "#cffafe", label: "Cyan" },
  { hex: "#ffe4e6", label: "Rose" },
  { hex: "#e0e7ff", label: "Indigo" },
  { hex: "#fef9c3", label: "Jaune" },
  { hex: "#ffedd5", label: "Orange" },
  { hex: "#fae8ff", label: "Fuchsia" },
  { hex: "#e2e8f0", label: "Gris" },
  { hex: "#059669", label: "Vert foncé" },
  { hex: "#d97706", label: "Ambre foncé" },
  { hex: "#2563eb", label: "Bleu foncé" },
  { hex: "#dc2626", label: "Rouge foncé" },
  { hex: "#7c3aed", label: "Violet foncé" },
  { hex: "#0891b2", label: "Cyan foncé" },
  { hex: "#db2777", label: "Rose foncé" },
  { hex: "#0f172a", label: "Nuit" },
];

/** Anciens réglages : nom Tailwind → hex (teinte 100). */
const ANCIENS_NOMS: Record<string, string> = {
  emerald: "#d1fae5",
  amber: "#fef3c7",
  blue: "#dbeafe",
  red: "#fee2e2",
  violet: "#ede9fe",
  cyan: "#cffafe",
  rose: "#ffe4e6",
  indigo: "#e0e7ff",
  yellow: "#fef9c3",
  orange: "#ffedd5",
  fuchsia: "#fae8ff",
  slate: "#e2e8f0",
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function estHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

/**
 * Accepte un hex (« #ABCDEF », « abcdef », « #abc ») ou un ancien nom
 * Tailwind ; renvoie « #rrggbb » minuscule, ou null si invalide.
 */
export function normaliserCouleur(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s in ANCIENS_NOMS) return ANCIENS_NOMS[s]!;
  const sans = s.startsWith("#") ? s.slice(1) : s;
  if (/^[0-9a-f]{6}$/.test(sans)) return `#${sans}`;
  if (/^[0-9a-f]{3}$/.test(sans)) {
    return `#${sans[0]}${sans[0]}${sans[1]}${sans[1]}${sans[2]}${sans[2]}`;
  }
  return null;
}

/**
 * Normalise une valeur stockée en base (manquante, partielle, anciens
 * noms, clés étrangères) vers un objet complet en hex.
 */
export function normalizeCouleurs(raw: unknown): AgendaCouleurs {
  const result: AgendaCouleurs = { ...DEFAULT_AGENDA_COULEURS };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of CATEGORY_ORDER) {
      const c = normaliserCouleur(o[k]);
      if (c) result[k] = c;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lisibilité : texte sombre ou clair selon le fond
// ---------------------------------------------------------------------------

export const TEXTE_SOMBRE = "#111827";
export const TEXTE_CLAIR = "#ffffff";

export function hexVersRgb(hex: string): { r: number; g: number; b: number } {
  const h = normaliserCouleur(hex) ?? "#000000";
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

/** Luminance relative (WCAG 2), de 0 (noir) à 1 (blanc). */
export function luminance(hex: string): number {
  const { r, g, b } = hexVersRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

/**
 * Texte à poser sur un fond : celui des deux (sombre / blanc) qui
 * contraste le plus. Sur toutes les teintes pastel, c'est le sombre ;
 * sur un bleu ou un rouge francs, le blanc.
 */
export function couleurTexte(fond: string): string {
  return contraste(fond, TEXTE_SOMBRE) >= contraste(fond, TEXTE_CLAIR)
    ? TEXTE_SOMBRE
    : TEXTE_CLAIR;
}

/** « rgba(r, g, b, alpha) » — pour teinter une case (week-end, férié). */
export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexVersRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Style inline d'une pastille d'évènement : fond opaque + texte lisible. */
export function styleEvenement(fond: string): {
  backgroundColor: string;
  color: string;
} {
  const hex = normaliserCouleur(fond) ?? DEFAULT_AGENDA_COULEURS.facture;
  return { backgroundColor: hex, color: couleurTexte(hex) };
}

// ---------------------------------------------------------------------------
// Couleur d'un évènement précis
// ---------------------------------------------------------------------------

/** Clé stable d'un évènement de l'agenda : « kind:id ». */
export function cleEvenement(e: { kind: string; id: string }): string {
  return `${e.kind}:${e.id}`;
}

export type CouleursEvenements = Record<string, string>;

/**
 * Couleur finale d'un évènement : la sienne si elle existe, sinon
 * celle de sa catégorie.
 */
export function couleurEvenement(
  categorie: AgendaCategory,
  cle: string,
  couleurs: AgendaCouleurs,
  parEvenement: CouleursEvenements = {},
): string {
  const propre = normaliserCouleur(parEvenement[cle]);
  return propre ?? couleurs[categorie];
}
