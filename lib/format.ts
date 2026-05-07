/**
 * Helpers de formatage et validation pour le contexte français.
 */

/**
 * Formate un montant en euros au format FR (avec espace milliers, virgule décimale).
 */
export function formatEuros(amount: number, options?: { withSymbol?: boolean }) {
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: options?.withSymbol === false ? "decimal" : "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

/**
 * Formate une date ISO en JJ/MM/AAAA.
 */
export function formatDateFr(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Extrait le SIREN (9 premiers chiffres) depuis un SIRET (14 chiffres).
 * Renvoie null si le SIRET fourni n'est pas conforme.
 */
export function siretToSiren(siret?: string | null): string | null {
  if (!siret) return null;
  const cleaned = siret.replace(/\s+/g, "");
  if (cleaned.length !== 14 || !/^\d+$/.test(cleaned)) return null;
  return cleaned.slice(0, 9);
}

/**
 * Affiche un SIRET au format lisible : "XXX XXX XXX XXXXX".
 */
export function formatSiret(siret?: string | null) {
  if (!siret) return "";
  const cleaned = siret.replace(/\s+/g, "");
  if (cleaned.length !== 14) return siret;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
}

/**
 * Affiche un IBAN par groupes de 4 caractères.
 */
export function formatIban(iban?: string | null) {
  if (!iban) return "";
  const cleaned = iban.replace(/\s+/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Régex de validation côté Zod (réutilisables).
 * Note : les regex sont permissives (espaces autorisés, casse insensible),
 * la normalisation est faite côté serveur.
 */
export const REGEX = {
  // 14 chiffres, espaces tolérés
  siret: /^(?:\s*\d\s*){14}$/,
  // 9 chiffres
  siren: /^(?:\s*\d\s*){9}$/,
  // Format APE : 4 chiffres + 1 lettre (ex 4322A pour plomberie)
  codeApe: /^\d{4}\s?[A-Za-z]$/,
  // Code postal FR : 5 chiffres
  codePostal: /^\d{5}$/,
  // IBAN français : FR + 2 chiffres clé + 23 caractères alphanumériques (espaces tolérés)
  ibanFr: /^FR\s?(?:\s*[A-Za-z0-9]\s*){25}$/i,
  // BIC : 8 ou 11 caractères alphanumériques
  bic: /^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/,
  // Téléphone FR (lenient) : +33 ou 0 suivi de 9 chiffres avec séparateurs tolérés
  telephoneFr: /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/,
};

/**
 * Normalise une chaîne en supprimant tous les espaces.
 */
export function stripSpaces(s: string): string {
  return s.replace(/\s+/g, "");
}

/**
 * Catégories de prestations (libellés FR pour l'UI).
 * Les clés correspondent aux valeurs stockées en base.
 */
export const CATEGORIES_PRESTATIONS = {
  plomberie: "Plomberie",
  installation_clim: "Installation climatisation",
  installation_pac: "Installation pompe à chaleur",
  entretien: "Entretien",
  depannage: "Dépannage",
  autre: "Autre",
} as const;

export type CategoriePrestation = keyof typeof CATEGORIES_PRESTATIONS;

/**
 * Types de clients (libellés FR pour l'UI).
 */
export const TYPES_CLIENT = {
  particulier: "Particulier",
  professionnel: "Professionnel",
  syndic: "Syndic de copropriété",
} as const;

export type TypeClient = keyof typeof TYPES_CLIENT;

/**
 * Unités de prestation usuelles.
 */
export const UNITES = [
  "unité",
  "heure",
  "forfait",
  "jour",
  "demi-journée",
  "m²",
  "m³",
  "ml",
  "kg",
] as const;
