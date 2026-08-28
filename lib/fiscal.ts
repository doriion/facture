/**
 * Nature fiscale URSSAF des recettes et ventilation des encaissements
 * dans les 3 cases du formulaire de déclaration micro-entrepreneur
 * (autoentrepreneur.urssaf.fr) :
 *   - BIC prestations de services (le cas normal en BTP)
 *   - BIC ventes de marchandises (revente SANS pose uniquement — les
 *     fournitures posées dans le cadre d'une prestation sont incorporées
 *     à la prestation)
 *   - BNC (prestations libérales — a priori sans objet ici)
 *
 * Helpers PURS (pas de "use server"), testés dans lib/fiscal.test.ts.
 */

export const NATURES_FISCALES = [
  "bic_prestations",
  "bic_ventes",
  "bnc",
] as const;

export type NatureFiscale = (typeof NATURES_FISCALES)[number];

export const LABELS_NATURE_FISCALE: Record<NatureFiscale, string> = {
  bic_prestations: "BIC — Prestations de services",
  bic_ventes: "BIC — Ventes de marchandises",
  bnc: "BNC — Autres prestations",
};

/** Libellés courts pour les cases du formulaire URSSAF. */
export const LABELS_CASE_URSSAF: Record<NatureFiscale, string> = {
  bic_prestations: "Prestations de services (BIC)",
  bic_ventes: "Ventes de marchandises (BIC)",
  bnc: "Autres prestations de services (BNC)",
};

export function isNatureFiscale(v: unknown): v is NatureFiscale {
  return (
    typeof v === "string" && (NATURES_FISCALES as readonly string[]).includes(v)
  );
}

export type Ventilation = Record<NatureFiscale, number>;

export const VENTILATION_VIDE: Ventilation = {
  bic_prestations: 0,
  bic_ventes: 0,
  bnc: 0,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Répartit un montant ENCAISSÉ dans les 3 cases URSSAF au prorata des
 * lignes de la facture. Nécessaire pour les paiements partiels (un
 * acompte de 30 % porte 30 % de chaque nature) et les factures mixtes
 * prestation + vente.
 *
 * - Lignes absentes ou total nul → tout en bic_prestations (défaut sûr
 *   pour une activité de prestations ; le total encaissé reste juste).
 * - Arrondi au centime, le reliquat d'arrondi va à la nature majoritaire
 *   pour que la somme des cases = le montant encaissé, au centime près.
 */
export function ventilerMontant(
  montant: number,
  lignes: Array<{ total_ht: number; nature_fiscale: string }>,
): Ventilation {
  const result: Ventilation = { ...VENTILATION_VIDE };
  if (!Number.isFinite(montant) || montant === 0) return result;

  const totaux: Ventilation = { ...VENTILATION_VIDE };
  let totalLignes = 0;
  for (const l of lignes) {
    const t = Number(l.total_ht);
    if (!Number.isFinite(t)) continue;
    const nature = isNatureFiscale(l.nature_fiscale)
      ? l.nature_fiscale
      : "bic_prestations";
    totaux[nature] += t;
    totalLignes += t;
  }

  if (totalLignes <= 0) {
    result.bic_prestations = round2(montant);
    return result;
  }

  let affecte = 0;
  let majoritaire: NatureFiscale = "bic_prestations";
  for (const nature of NATURES_FISCALES) {
    const part = round2((montant * totaux[nature]) / totalLignes);
    result[nature] = part;
    affecte += part;
    if (totaux[nature] > totaux[majoritaire]) majoritaire = nature;
  }
  // Reliquat d'arrondi (±0,01/0,02) sur la nature majoritaire
  const reliquat = round2(montant - affecte);
  if (reliquat !== 0) {
    result[majoritaire] = round2(result[majoritaire] + reliquat);
  }
  return result;
}

/** Additionne des ventilations (accumulation sur une période). */
export function additionnerVentilations(
  a: Ventilation,
  b: Ventilation,
): Ventilation {
  return {
    bic_prestations: round2(a.bic_prestations + b.bic_prestations),
    bic_ventes: round2(a.bic_ventes + b.bic_ventes),
    bnc: round2(a.bnc + b.bnc),
  };
}

export function totalVentilation(v: Ventilation): number {
  return round2(v.bic_prestations + v.bic_ventes + v.bnc);
}

/**
 * Compare le total encaissé actuel d'une période avec un montant
 * déclaré : un écart > 0,01 € signale qu'une facture ou un paiement a
 * bougé APRÈS la déclaration (à régulariser sur la déclaration
 * suivante, ou déclaration rectificative).
 */
export function ecartDeclaration(
  montantDeclare: number,
  totalActuel: number,
): number | null {
  const ecart = round2(totalActuel - montantDeclare);
  return Math.abs(ecart) > 0.01 ? ecart : null;
}
