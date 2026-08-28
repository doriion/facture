/**
 * Validation de SIRET (14 chiffres + clé de Luhn) — helper PUR.
 *
 * Règles (vérifiées le 28/08/2026, documentation INSEE « Contrôle de
 * validité d'un numéro SIREN/SIRET ») :
 * - SIRET = 14 chiffres (SIREN 9 chiffres + NIC 5 chiffres), vérifiés
 *   par la formule de Luhn (somme pondérée ≡ 0 mod 10) ;
 * - EXCEPTION La Poste (SIREN 356 000 000) : ses établissements ne
 *   respectent pas Luhn ; la règle est alors somme SIMPLE des 14
 *   chiffres ≡ 0 mod 5 (le siège 35600000000048 respecte, lui, Luhn).
 */

/** Retire espaces, points et tirets de saisie ("123 456 789 00012"). */
export function normalizeSiret(raw: string): string {
  return raw.replace(/[\s.\-]/g, "");
}

function luhnOk(digits: string): boolean {
  let sum = 0;
  // Parcours depuis la droite : on double un chiffre sur deux (2e, 4e…)
  for (let i = 0; i < digits.length; i++) {
    const c = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) {
      const doubled = c * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += c;
    }
  }
  return sum % 10 === 0;
}

/**
 * Valide un SIRET saisi librement. Chaîne vide = « non renseigné »,
 * accepté (le champ est optionnel — la présence est exigée ailleurs).
 */
export function isSiretValide(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return true;
  const siret = normalizeSiret(raw);
  if (!/^\d{14}$/.test(siret)) return false;
  // Exception La Poste : somme simple des chiffres multiple de 5
  if (siret.startsWith("356000000")) {
    let somme = 0;
    for (let i = 0; i < siret.length; i++) {
      somme += siret.charCodeAt(i) - 48;
    }
    return somme % 5 === 0 || luhnOk(siret);
  }
  return luhnOk(siret);
}

export const MESSAGE_SIRET_INVALIDE =
  "SIRET invalide : 14 chiffres attendus, et la clé de contrôle ne correspond pas (vérifiez votre saisie sur l'avis de situation INSEE).";
