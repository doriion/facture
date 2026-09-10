/**
 * LISTE BLANCHE des champs de ligne autorisés dans un document destiné
 * au client (PDF de devis/facture, pièce jointe email).
 *
 * Principe : on ne retire pas les champs sensibles, on ÉNUMÈRE les
 * champs autorisés — un futur champ privé ajouté aux tables de lignes
 * ne peut pas fuiter par oubli. `prix_achat_ttc_unitaire` et
 * `fournisseur` (coûts privés) ne figurent pas dans cette liste et ne
 * doivent JAMAIS y entrer. Testé dans pdf-payload.test.ts.
 */

export type LignePdf = {
  id: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  total_ht: number;
  nature_fiscale: string;
  type: string;
  ordre: number;
};

/**
 * Épure des lignes de document avant tout rendu destiné au client.
 * Accepte les Row complets de devis_lignes / factures_lignes et ne
 * laisse passer que la liste blanche ci-dessus.
 */
export function payloadLignesPdf(
  lignes: Array<{
    id: string;
    designation: string;
    quantite: number;
    prix_unitaire_ht: number;
    total_ht: number;
    nature_fiscale: string;
    type: string;
    ordre: number;
  }>,
): LignePdf[] {
  return lignes.map((l) => ({
    id: l.id,
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire_ht: l.prix_unitaire_ht,
    total_ht: l.total_ht,
    nature_fiscale: l.nature_fiscale,
    type: l.type,
    ordre: l.ordre,
  }));
}
