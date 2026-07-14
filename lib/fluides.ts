/**
 * Fluides frigorigènes : PRG (potentiel de réchauffement global, GWP-100)
 * et calcul de l'équivalent CO2 réglementaire.
 *
 * Cadre réglementaire (juillet 2026) :
 * - Règlement (UE) 2024/573 du 7 février 2024 (« F-Gas III »), applicable
 *   depuis le 11 mars 2024, abroge le règlement (UE) 517/2014.
 *   https://eur-lex.europa.eu/eli/reg/2024/573/oj
 * - Les HFC purs (annexe I, section 1) utilisent les PRG du 4e rapport
 *   du GIEC (IPCC AR4) — inchangés depuis 517/2014 et alignés sur
 *   l'amendement de Kigali. C'est CETTE base qui sert aux tonnes
 *   équivalent CO2 réglementaires (seuils de contrôle d'étanchéité
 *   5 / 50 / 500 t éq. CO2, fiche d'intervention CERFA 15497).
 * - Le PRG d'un mélange = moyenne pondérée massique des composants
 *   (méthode de l'annexe VI du règlement 2024/573).
 * - Le R22 (HCFC) ne relève pas de la F-Gas mais du règlement (UE)
 *   2024/590 (substances appauvrissant la couche d'ozone).
 *   https://eur-lex.europa.eu/eli/reg/2024/590/oj
 */

/**
 * PRG (GWP-100, base IPCC AR4 pour les HFC — voir en-tête du fichier).
 * Mélanges : calcul annexe VI à partir des PRG AR4 des composants,
 * valeurs arrondies telles qu'utilisées par la profession (ATEE/Pôle
 * Cristal, Danfoss) et les déclarations françaises.
 */
export const PRG_FLUIDES: Record<string, number> = {
  // HFC purs — annexe I section 1 du règlement (UE) 2024/573 (AR4)
  R32: 675,
  R134A: 1430,
  R125: 3500,
  R143A: 4470,
  // Mélanges HFC/HFO — moyenne pondérée massique (annexe VI)
  R410A: 2088, // 50 % R32 / 50 % R125
  R407C: 1774, // 23 % R32 / 25 % R125 / 52 % R134a
  R404A: 3922, // 44 % R125 / 4 % R134a / 52 % R143a
  R448A: 1387,
  R449A: 1397,
  R452B: 698, // 67 % R32 / 7 % R125 / 26 % R1234yf
  R454B: 466, // 68,9 % R32 / 31,1 % R1234yf
  R454C: 148, // 21,5 % R32 / 78,5 % R1234yf
  R513A: 631,
  // Naturels (hors champ F-Gas) — valeurs AR4 usuelles
  R290: 3, // propane
  R600A: 3, // isobutane
  R744: 1, // CO2 (gaz de référence, PRG = 1 par définition)
  R717: 0, // ammoniac : aucun PRG direct assigné par le GIEC
  // HCFC — règlement (UE) 2024/590 (SAO), PRG AR4
  R22: 1810,
};

/** Liste triée des fluides connus, pour un <Select> côté UI. */
export const FLUIDES_CONNUS = Object.keys(PRG_FLUIDES).sort();

/**
 * Normalise une désignation saisie librement ("r 410a", "R-410A",
 * "r410a" → "R410A") pour la retrouver dans la table des PRG.
 */
export function normalizeFluide(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/**
 * PRG d'un fluide, ou null si inconnu de la table.
 */
export function prgFluide(fluide: string | null | undefined): number | null {
  const key = normalizeFluide(fluide);
  return key in PRG_FLUIDES ? PRG_FLUIDES[key]! : null;
}

/**
 * Équivalent CO2 en TONNES pour une masse de fluide donnée :
 *   t éq. CO2 = kg × PRG / 1000
 * (formule des seuils réglementaires — art. 4 et annexes du 2024/573).
 * Renvoie null si le fluide est inconnu ou la masse absente.
 * Arrondi à 3 décimales (au kg éq. CO2 près).
 */
export function equivalentCo2Tonnes(
  fluide: string | null | undefined,
  kg: number | null | undefined,
): number | null {
  const prg = prgFluide(fluide);
  if (prg === null || kg === null || kg === undefined || !Number.isFinite(kg)) {
    return null;
  }
  return Math.round(kg * prg) / 1000;
}

/**
 * Formate un équivalent CO2 pour affichage FR : "4,18 t éq. CO2"
 * (2 décimales suffisent à l'affichage ; le CERFA utilise la même unité).
 */
export function formatEquivalentCo2(tonnes: number | null): string {
  if (tonnes === null) return "—";
  return `${tonnes.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} t éq. CO2`;
}

/**
 * Périodicité réglementaire du contrôle d'étanchéité (cadre 8 du CERFA
 * 15497*04) pour un équipement SANS système permanent de détection des
 * fuites, selon la charge en kg :
 *   2 ≤ Q < 30 kg → 12 mois · 30 ≤ Q < 300 kg → 6 mois · Q ≥ 300 kg → 3 mois
 * En dessous de 2 kg (et < 5 t éq. CO2), pas de contrôle périodique
 * obligatoire → null.
 */
export function periodiciteControleMois(
  chargeKg: number | null | undefined,
): number | null {
  if (chargeKg === null || chargeKg === undefined || !Number.isFinite(chargeKg)) {
    return null;
  }
  if (chargeKg >= 300) return 3;
  if (chargeKg >= 30) return 6;
  if (chargeKg >= 2) return 12;
  return null;
}
