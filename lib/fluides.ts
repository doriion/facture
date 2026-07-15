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
 * Cristal, Danfoss, fiches fabricants) et les déclarations françaises.
 *
 * Nuance (vérifiée sur EUR-Lex/EFCTC/Tecumseh) : pour les mélanges
 * contenant des HFO (R448A, R449A, R452B, R454B, R454C, R513A), le
 * calcul STRICT de l'annexe VI du 2024/573 utilise les PRG AR6 de
 * l'annexe II pour les HFO (R1234yf = 0,501…) et donne des valeurs
 * ~1 % plus basses (ex. R454B 465 au lieu de 466, R454C 146 au lieu
 * de 148). On retient les valeurs conventionnelles des fiches
 * fabricants : plus élevées, donc CONSERVATRICES pour les seuils
 * (5/50/500 t éq. CO2) — l'écart est sans impact réglementaire.
 *
 * R22 (HCFC) : suivi réglementaire en KG (règlement 2024/590), pas en
 * t éq. CO2 — le PRG n'est fourni qu'à titre indicatif.
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
 * Périodicité réglementaire du contrôle d'étanchéité (cadres 8-9 du
 * CERFA 15497*04) pour un équipement SANS système permanent de
 * détection des fuites.
 *
 * - Fluides F-Gas (HFC/HFO, règlement UE 2024/573 art. 5) : seuils en
 *   TONNES ÉQ. CO2 — ≥ 5 t → 12 mois · ≥ 50 t → 6 mois · ≥ 500 t → 3
 *   mois ; en dessous de 5 t, pas de contrôle périodique obligatoire.
 * - R22/HCFC (règlement UE 2024/590, art. R543-79-1 c. env.) : seuils
 *   en KG — 2 ≤ Q < 30 kg → 12 mois · 30 ≤ Q < 300 kg → 6 mois ·
 *   Q ≥ 300 kg → 3 mois.
 * - Fluide inconnu de la table ou charge absente → null (« non
 *   déterminable », à distinguer de « non soumis » à l'affichage).
 * Les fluides naturels (R290, R600a, R744, R717) tombent naturellement
 * sous le seuil des 5 t → null.
 */
export function periodiciteControleMois(
  fluide: string | null | undefined,
  chargeKg: number | null | undefined,
): number | null {
  if (
    chargeKg === null ||
    chargeKg === undefined ||
    !Number.isFinite(chargeKg)
  ) {
    return null;
  }

  // HCFC : suivi en kg (hors F-Gas)
  if (normalizeFluide(fluide) === "R22") {
    if (chargeKg >= 300) return 3;
    if (chargeKg >= 30) return 6;
    if (chargeKg >= 2) return 12;
    return null;
  }

  const teq = equivalentCo2Tonnes(fluide, chargeKg);
  if (teq === null) return null;
  if (teq >= 500) return 3;
  if (teq >= 50) return 6;
  if (teq >= 5) return 12;
  return null;
}
