/**
 * Helpers PURS de la double authentification (TOTP) — testés dans
 * mfa-helpers.test.ts. Les appels Supabase sont dans lib/actions/mfa.ts.
 */

export type FacteurMfa = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
  created_at?: string;
};

/** Code d'application d'authentification : 6 chiffres (espaces tolérés). */
export function normaliserCodeTotp(saisie: string): string | null {
  const code = saisie.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** Premier facteur TOTP vérifié (celui qui impose la double authentification). */
export function facteurTotpVerifie<T extends FacteurMfa>(facteurs: T[] | null | undefined): T | null {
  return (facteurs ?? []).find((f) => f.factor_type === "totp" && f.status === "verified") ?? null;
}

/** Facteurs TOTP commencés mais jamais confirmés (à nettoyer avant un nouvel enrôlement). */
export function facteursTotpNonVerifies<T extends FacteurMfa>(facteurs: T[] | null | undefined): T[] {
  return (facteurs ?? []).filter((f) => f.factor_type === "totp" && f.status !== "verified");
}

/**
 * La session doit-elle passer par le code ? Oui quand un facteur vérifié
 * existe (niveau atteignable aal2) et que la session n'y est pas encore
 * (mot de passe seul = aal1).
 */
export function verificationRequise(
  niveauCourant: string | null | undefined,
  facteurs: FacteurMfa[] | null | undefined,
): boolean {
  return facteurTotpVerifie(facteurs) !== null && niveauCourant !== "aal2";
}
